import { insertRows, readRows, updateRow } from './supabase.js';

export async function importProducts(payload, user) {
  const { products, section_id } = payload;
  if (!Array.isArray(products) || !products.length) {
    const error = new Error('Aucun produit à importer'); error.status = 400; throw error;
  }
  const existing = await readRows('products', { limit: 500 });
  const byName = new Map(existing.filter((p) => p.name).map((p) => [p.name.toLowerCase().trim(), p.id]));
  const toCreate = [];
  const toUpdate = [];
  const errors = [];
  for (const product of products) {
    const name = String(product.name || '').trim();
    if (!name) { errors.push({ row: product, error: 'Nom manquant' }); continue; }
    const fields = {
      name,
      price: product.price != null ? String(product.price) : undefined,
      description: product.description || undefined,
      image_url: product.image_url || undefined,
      external_link: product.external_link || '',
      shipping: product.shipping || undefined,
      policy: product.policy || undefined,
      token_price: product.token_price != null ? Number(product.token_price) || 0 : undefined,
      category: product.category || 'product',
      section_id: product.section_id || section_id || undefined,
      is_active: product.is_active !== false,
      order: product.order || 0,
      product_options: Array.isArray(product.product_options) && product.product_options.length ? product.product_options : undefined,
      images: Array.isArray(product.images) && product.images.length ? product.images : undefined,
    };
    Object.keys(fields).forEach((key) => fields[key] === undefined && delete fields[key]);
    const id = byName.get(name.toLowerCase());
    if (id) toUpdate.push({ id, fields });
    else toCreate.push({ ...fields, section_id: fields.section_id || section_id || null, created_by_id: user.id });
  }
  let updated = 0;
  for (const item of toUpdate) {
    try { await updateRow('products', item.id, item.fields); updated++; }
    catch (error) { errors.push({ row: item.fields, error: error.message }); }
  }
  let created = 0;
  for (let i = 0; i < toCreate.length; i += 5) {
    const chunk = toCreate.slice(i, i + 5);
    try { await insertRows('products', chunk); created += chunk.length; }
    catch (error) { errors.push({ row: chunk[0], error: error.message }); }
  }
  return { created, updated, errors };
}

export async function getUserBalance(user) {
  const [balances, packages] = await Promise.all([
    readRows('user_token_balances', { filters: { user_email: user.email }, limit: 1 }),
    readRows('token_packages', { filters: { is_active: true }, sort: 'order' }),
  ]);
  let [balance] = balances;
  if (!balance) {
    [balance] = await insertRows('user_token_balances', { user_email: user.email, balance: 0, last_updated: new Date().toISOString(), created_by_id: user.id });
  }
  return { balance: Number(balance.balance || 0), record: balance, packages };
}

export async function purchaseShopProduct(payload, user, digitalOnly = false) {
  const productId = payload.product_id;
  if (!productId) { const error = new Error('Product ID required'); error.status = 400; throw error; }
  const [product] = await readRows('products', { id: productId, limit: 1 });
  if (!product) { const error = new Error('Product not found'); error.status = 404; throw error; }
  if (digitalOnly && (!product.is_digital || !product.r2_object_key)) {
    const error = new Error('Not a digital product'); error.status = 400; throw error;
  }
  const dollarAmount = parseFloat(String(product.price || '0').replace(/[^0-9.]/g, '')) || 0;
  const tokenCost = digitalOnly ? Math.round(dollarAmount) : Number(product.token_price || 0);
  if (tokenCost <= 0) { const error = new Error(digitalOnly ? 'Invalid product price' : 'Ce produit ne peut pas être acheté avec des tokens'); error.status = 400; throw error; }
  const balanceResult = await getUserBalance(user);
  if (balanceResult.balance < tokenCost) {
    const error = new Error('Solde de tokens insuffisant'); error.status = 402;
    error.details = { balance: balanceResult.balance, cost: tokenCost }; throw error;
  }
  const balanceAfter = balanceResult.balance - tokenCost;
  await updateRow('user_token_balances', balanceResult.record.id, { balance: balanceAfter, last_updated: new Date().toISOString() });
  const orderId = `${digitalOnly ? 'CRED' : 'TOK'}-${Date.now()}`;
  await insertRows('orders', {
    order_id: orderId,
    items: [{ id: product.id, name: product.name, price: product.price, quantity: 1, options: {} }],
    subtotal: dollarAmount, tps: 0, tvq: 0, shipping: 0, total: dollarAmount,
    customer_email: user.email, customer_name: user.user_metadata?.full_name || '',
    status: 'completed', payment_date: new Date().toISOString(), download_consumed: false,
    created_by_id: user.id,
  });
  await insertRows('token_transactions', {
    user_email: user.email, transaction_type: 'usage', token_amount: -tokenCost,
    balance_after: balanceAfter, related_entity: product.id, payment_id: orderId,
    created_at: new Date().toISOString(), created_by_id: user.id,
  });
  return { success: true, order_id: orderId, ...(digitalOnly ? { credit_cost: tokenCost } : { token_cost: tokenCost }), balance_after: balanceAfter };
}
