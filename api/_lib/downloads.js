import { insertRows, readRows, updateRow } from './supabase.js';
import { getUserBalance } from './shop.js';
import { isAdmin } from './tokens.js';
import { createDigitalDownload } from './digitalStorage.js';

export async function purchaseDossierDigital(payload, user) {
  if (!payload.page_id) { const error = new Error('Page ID required'); error.status = 400; throw error; }
  const [page] = await readRows('dossier_pages', { id: payload.page_id, limit: 1 });
  if (!page) { const error = new Error('Product not found'); error.status = 404; throw error; }
  if (!page.is_product || !page.is_digital) { const error = new Error('Not a digital product'); error.status = 400; throw error; }
  const tokenCost = Number(page.token_cost || 0);
  if (tokenCost <= 0) { const error = new Error('Token cost is not set for this product'); error.status = 400; throw error; }
  const objectKey = page.r2_object_key?.trim();
  if (!objectKey && !page.download_url) { const error = new Error('No download file configured for this product'); error.status = 400; throw error; }
  const balance = await getUserBalance(user);
  if (!isAdmin(user) && balance.balance < tokenCost) { const error = new Error('Insufficient tokens'); error.status = 402; error.details = { balance: balance.balance, cost: tokenCost }; throw error; }
  const balanceAfter = isAdmin(user) ? balance.balance : balance.balance - tokenCost;
  if (!isAdmin(user)) await updateRow('user_token_balances', balance.record.id, { balance: balanceAfter, last_updated: new Date().toISOString() });
  const downloadUrl = objectKey ? await createDigitalDownload(objectKey, page.title, 600) : page.download_url;
  const orderId = `DOS-${Date.now()}`;
  await insertRows('orders', {
    order_id: orderId, items: [{ id: page.id, name: page.title || 'Digital product', price: `${tokenCost} Ⓣ`, quantity: 1, options: { is_digital: true, r2_object_key: objectKey || undefined, download_url: objectKey ? undefined : page.download_url, token_cost: tokenCost } }],
    subtotal: 0, tps: 0, tvq: 0, shipping: 0, total: 0, customer_email: user.email,
    customer_name: user.user_metadata?.full_name || '', status: 'completed', payment_date: new Date().toISOString(),
    download_consumed: true, downloaded_at: new Date().toISOString(), created_by_id: user.id,
  });
  if (!isAdmin(user)) await insertRows('token_transactions', { user_email: user.email, transaction_type: 'usage', token_amount: -tokenCost, balance_after: balanceAfter, related_entity: page.id, payment_id: orderId, created_at: new Date().toISOString(), created_by_id: user.id });
  return { success: true, order_id: orderId, download_url: downloadUrl, token_cost: tokenCost, balance_after: balanceAfter };
}

export async function getR2DownloadLink(payload, user) {
  if (!payload.orderId) { const error = new Error('Order ID required'); error.status = 400; throw error; }
  const [order] = await readRows('orders', { id: payload.orderId, limit: 1 });
  if (!order) { const error = new Error('Order not found'); error.status = 404; throw error; }
  if (order.status !== 'completed' || order.customer_email?.toLowerCase() !== user.email?.toLowerCase()) { const error = new Error('This order is not available'); error.status = 403; throw error; }
  if (order.download_consumed) { const error = new Error('Download link for this order has already been used'); error.status = 403; throw error; }
  const downloads = [];
  const seen = new Set();
  for (const item of order.items || []) {
    let objectKey = item.options?.r2_object_key;
    if (!objectKey && item.id) objectKey = (await readRows('products', { id: item.id, limit: 1 }))[0]?.r2_object_key;
    if (!objectKey || seen.has(objectKey)) continue;
    seen.add(objectKey);
    downloads.push({ name: item.name, download_url: await createDigitalDownload(objectKey, item.name, 600) });
  }
  if (!downloads.length) { const error = new Error('No downloadable products in this order'); error.status = 404; throw error; }
  await updateRow('orders', order.id, { download_consumed: true, downloaded_at: new Date().toISOString() });
  return { downloads };
}
