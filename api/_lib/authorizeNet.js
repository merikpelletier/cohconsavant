import { readRows } from './supabase.js';

function configuration() {
  const loginId = process.env.AUTHORIZENET_API_LOGIN_ID;
  const transactionKey = process.env.AUTHORIZENET_TRANSACTION_KEY;
  if (!loginId || !transactionKey) {
    const error = new Error('Connexion Authorize.Net non configurée'); error.status = 503; throw error;
  }
  const sandbox = process.env.AUTHORIZENET_SANDBOX === 'true';
  return {
    loginId, transactionKey, sandbox,
    apiUrl: sandbox ? 'https://apitest.authorize.net/xml/v1/request.api' : 'https://api.authorize.net/xml/v1/request.api',
    paymentUrl: sandbox ? 'https://test.authorize.net/payment/payment' : 'https://accept.authorize.net/payment/payment',
  };
}

async function hostedPayment(transactionRequest, settings) {
  const config = configuration();
  const response = await fetch(config.apiUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ getHostedPaymentPageRequest: {
      merchantAuthentication: { name: config.loginId, transactionKey: config.transactionKey },
      transactionRequest,
      hostedPaymentSettings: { setting: settings },
    } }),
  });
  const data = await response.json();
  if (data.messages?.resultCode !== 'Ok') {
    const error = new Error(data.messages?.message?.[0]?.text || 'Authorize.Net a refusé la demande'); error.status = 400; throw error;
  }
  return { url: config.paymentUrl, token: data.token };
}

export async function getAuthorizeNetTransactionDetails(transactionId) {
  const config = configuration();
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      getTransactionDetailsRequest: {
        merchantAuthentication: { name: config.loginId, transactionKey: config.transactionKey },
        transId: String(transactionId),
      },
    }),
  });
  const data = await response.json();
  if (data.messages?.resultCode !== 'Ok' || !data.transaction) {
    const error = new Error(data.messages?.message?.[0]?.text || 'Impossible de récupérer la transaction Authorize.Net');
    error.status = 400;
    throw error;
  }
  return data.transaction;
}

export async function checkAuthorizeNetConnection() {
  const config = configuration();
  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      getMerchantDetailsRequest: {
        merchantAuthentication: { name: config.loginId, transactionKey: config.transactionKey },
      },
    }),
  });
  const data = await response.json();
  return {
    ok: response.ok && data.messages?.resultCode === 'Ok',
    status: response.status,
    code: data.messages?.message?.[0]?.code || null,
  };
}

const setting = (settingName, value) => ({ settingName, settingValue: JSON.stringify(value) });

export async function createAuthorizeNetCheckout(payload, user, origin) {
  const { cart } = payload;
  if (!cart?.length) { const error = new Error('Cart is empty'); error.status = 400; throw error; }
  const lineItem = [];
  let subtotal = 0;
  let taxableSubtotal = 0;
  let awardedTokens = 0;

  for (const item of cart) {
    const quantity = Math.max(1, Number(item.quantity || 1));
    let name = item.name;
    let unitPrice = Number.parseFloat(String(item.price).replace(/[^0-9.]/g, ''));
    if (item.kind === 'token_package') {
      const [pkg] = await readRows('token_packages', { id: item.id, limit: 1 });
      if (!pkg?.is_active) { const error = new Error('Pack de jetons invalide'); error.status = 400; throw error; }
      name = pkg.name;
      unitPrice = Number(pkg.price);
      const baseTokens = Number(pkg.token_amount || 0);
      awardedTokens += (baseTokens + Math.round(baseTokens * Number(pkg.bonus_percentage || 0) / 100)) * quantity;
    } else {
      taxableSubtotal += unitPrice * quantity;
    }
    subtotal += unitPrice * quantity;
    lineItem.push({
      itemId: String(item.id).substring(0, 31), name: String(name).substring(0, 31),
      description: item.options ? Object.entries(item.options).map(([key, value]) => `${key}: ${value}`).join(', ').substring(0, 255) : '',
      quantity: String(quantity), unitPrice: unitPrice.toFixed(2),
    });
  }

  const tps = Number((taxableSubtotal * 0.05).toFixed(2));
  const tvq = Number((taxableSubtotal * 0.09975).toFixed(2));
  const total = Number((subtotal + tps + tvq).toFixed(2));
  if (tps > 0) lineItem.push({ itemId: 'TPS', name: 'TPS (5%)', description: 'Taxe fédérale', quantity: '1', unitPrice: tps.toFixed(2) });
  if (tvq > 0) lineItem.push({ itemId: 'TVQ', name: 'TVQ (9.975%)', description: 'Taxe provinciale', quantity: '1', unitPrice: tvq.toFixed(2) });
  const userFields = [
    { name: 'cart_data', value: JSON.stringify(cart).substring(0, 255) },
    { name: 'user_email', value: user.email },
  ];
  if (awardedTokens > 0) userFields.push({ name: 'token_amount', value: String(awardedTokens) });
  return hostedPayment({
    transactionType: 'authCaptureTransaction', amount: total.toFixed(2), currencyCode: 'CAD', lineItems: { lineItem },
    customer: { email: user.email }, billTo: { firstName: '', lastName: '' }, shipTo: { firstName: '', lastName: '' },
    userFields: { userField: userFields },
  }, [
    setting('hostedPaymentReturnOptions', { showReceipt: true, url: `${origin}/cart?payment=success`, urlText: 'Retour à la boutique', cancelUrl: `${origin}/cart?payment=cancelled`, cancelUrlText: 'Annuler' }),
    setting('hostedPaymentButtonOptions', { text: 'Payer' }),
    setting('hostedPaymentStyleOptions', { bgColor: '#000000' }),
    setting('hostedPaymentBillingAddressOptions', { show: true, required: true }),
    setting('hostedPaymentShippingAddressOptions', { show: true, required: true }),
    setting('hostedPaymentCustomerOptions', { showEmail: true, requiredEmail: true }),
  ]);
}

export async function purchaseTokens(payload, user, origin) {
  if (!payload.package_id) { const error = new Error('Package ID required'); error.status = 400; throw error; }
  const [tokenPackage] = await readRows('token_packages', { id: payload.package_id, limit: 1 });
  if (!tokenPackage?.is_active) { const error = new Error('Invalid package'); error.status = 400; throw error; }
  const total = Number(tokenPackage.price).toFixed(2);
  const baseTokens = Number(tokenPackage.token_amount || 0);
  const bonusTokens = Math.round(baseTokens * Number(tokenPackage.bonus_percentage || 0) / 100);
  const awardedTokens = baseTokens + bonusTokens;
  return hostedPayment({
    transactionType: 'authCaptureTransaction', amount: total, currencyCode: 'CAD',
    lineItems: { lineItem: [{ itemId: String(tokenPackage.id).substring(0, 31), name: `${tokenPackage.name} - ${awardedTokens} jetons`.substring(0, 31), description: bonusTokens > 0 ? `${baseTokens} jetons + ${bonusTokens} jetons bonus` : `${baseTokens} jetons`, quantity: '1', unitPrice: total }] },
    customer: { email: user.email },
    userFields: { userField: [
      { name: 'package_id', value: tokenPackage.id },
      { name: 'token_amount', value: String(awardedTokens) },
      { name: 'user_email', value: user.email },
    ] },
  }, [
    setting('hostedPaymentReturnOptions', { showReceipt: true, url: `${origin}/studio?payment=success`, urlText: 'Retour au studio', cancelUrl: `${origin}/studio?payment=cancelled`, cancelUrlText: 'Annuler' }),
    setting('hostedPaymentButtonOptions', { text: 'Payer maintenant' }),
    setting('hostedPaymentStyleOptions', { bgColor: '#000000' }),
    setting('hostedPaymentBillingAddressOptions', { show: true, required: true }),
  ]);
}
