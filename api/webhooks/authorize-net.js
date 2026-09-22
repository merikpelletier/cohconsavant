import { insertRows, readRows, updateRow } from '../_lib/supabase.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAuthorizeNetTransactionDetails } from '../_lib/authorizeNet.js';

export const config = { api: { bodyParser: false } };

async function rawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function signatureIsValid(body, signature) {
  const signatureKey = process.env.AUTHORIZENET_SIGNATURE_KEY;
  if (!signatureKey || !signature?.startsWith('sha512=')) return false;
  const computed = createHmac('sha512', Buffer.from(signatureKey, 'hex')).update(body, 'utf8').digest();
  const receivedHex = signature.slice(7);
  if (!/^[0-9a-f]+$/i.test(receivedHex)) return false;
  const received = Buffer.from(receivedHex, 'hex');
  return received.length === computed.length && timingSafeEqual(received, computed);
}

async function activateMembership(email, membershipType) {
  if (!email || !membershipType) return;
  const [existing] = await readRows('memberships', { filters: { user_email: email }, limit: 1 });
  const now = new Date().toISOString();
  if (existing) {
    await updateRow('memberships', existing.id, { membership_type: membershipType, status: 'approved', approved_at: now });
  } else {
    await insertRows('memberships', { user_email: email, membership_type: membershipType, status: 'approved', approved_at: now });
  }
}

async function creditTokens(email, amount, transactionId) {
  if (!email || !amount) return;
  const [existingTransaction] = await readRows('token_transactions', { filters: { payment_id: transactionId }, limit: 1 });
  if (existingTransaction) return;
  let [balance] = await readRows('user_token_balances', { filters: { user_email: email }, limit: 1 });
  if (!balance) [balance] = await insertRows('user_token_balances', { user_email: email, balance: 0, last_updated: new Date().toISOString() });
  const newBalance = Number(balance.balance || 0) + Number(amount);
  await updateRow('user_token_balances', balance.id, { balance: newBalance, last_updated: new Date().toISOString() });
  await insertRows('token_transactions', { user_email: email, transaction_type: 'purchase', token_amount: Number(amount), balance_after: newBalance, payment_id: transactionId, created_at: new Date().toISOString() });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Méthode non permise' });
  try {
    const body = await rawBody(request);
    if (!(await signatureIsValid(body, request.headers['x-anet-signature']))) return json(response, 401, { error: 'Invalid signature' });
    const data = JSON.parse(body);
    if (data.eventType === 'net.authorize.payment.authcapture.created') {
      const payload = data.payload || {};
      const transactionId = String(payload.id || '');
      if (!transactionId) return json(response, 400, { error: 'Identifiant de transaction manquant' });
      const transaction = await getAuthorizeNetTransactionDetails(transactionId);
      const amount = Number(transaction.authAmount || transaction.settleAmount || payload.authAmount || 0);
      const billTo = transaction.billTo || {};
      const shipTo = transaction.shipTo || {};
      const userFields = Array.isArray(transaction.userFields) ? transaction.userFields : transaction.userFields?.userField || [];
      const field = (name) => userFields.find((item) => item.name === name)?.value;
      const email = field('user_email') || transaction.customer?.email || billTo.email || '';
      let items = [];
      try { items = JSON.parse(field('cart_data') || '[]'); } catch { items = []; }
      const tokenAmount = Number(field('token_amount') || 0);
      if (tokenAmount > 0) await creditTokens(email, tokenAmount, transactionId);
      const membershipType = field('membership_type') || '';
      if (membershipType) await activateMembership(email, membershipType);
      const subtotal = amount / 1.14975;
      const [existingOrder] = await readRows('orders', { filters: { order_id: transactionId }, limit: 1 });
      if (!existingOrder) {
        await insertRows('orders', {
          order_id: transactionId, items,
          subtotal: Number(subtotal.toFixed(2)), tps: Number((subtotal * 0.05).toFixed(2)),
          tvq: Number((subtotal * 0.09975).toFixed(2)), shipping: 0, total: amount,
          customer_email: email, customer_name: `${billTo.firstName || ''} ${billTo.lastName || ''}`.trim(),
          shipping_address: { street: shipTo.address || '', city: shipTo.city || '', state: shipTo.state || '', zip: shipTo.zip || '', country: shipTo.country || '' },
          status: 'completed', payment_date: new Date().toISOString(),
        });
      }
    }
    return json(response, 200, { received: true });
  } catch (error) {
    console.error('Authorize.Net webhook error:', error.message);
    return json(response, 500, { error: error.message });
  }
}
