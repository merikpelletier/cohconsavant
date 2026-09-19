import { insertRows, readRows, updateRow } from './supabase.js';
import { currentAIQuote } from './aiQuoteContext.js';

export function isAdmin(user) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  return user?.app_metadata?.role === 'admin' || user?.email?.toLowerCase().trim() === adminEmail;
}

export async function tokenContext(user, toolId, defaultCost = 0) {
  const quote = currentAIQuote();
  if (quote) {
    if (quote.user_id !== user.id || quote.tool_id !== toolId) throw new Error('Contexte de devis incohérent');
    return { cost: quote.token_price, current: quote.balance_after, admin: quote.admin, prepaid: true };
  }
  const [pricing] = await readRows('tool_pricings', { filters: { tool_id: toolId, is_active: true }, limit: 1 });
  const cost = Number(pricing?.token_cost ?? defaultCost);
  let [balance] = await readRows('user_token_balances', { filters: { user_email: user.email }, limit: 1 });
  if (!balance) {
    [balance] = await insertRows('user_token_balances', { user_email: user.email, balance: 0, last_updated: new Date().toISOString(), created_by_id: user.id });
  }
  const current = Number(balance.balance || 0);
  if (!isAdmin(user) && (!pricing || cost <= 0)) {
    const error = new Error('Ce service est temporairement indisponible : son prix en tokens doit être configuré.');
    error.status = 503;
    throw error;
  }
  if (!isAdmin(user) && current < cost) {
    const error = new Error('Solde de tokens insuffisant');
    error.status = 402;
    error.details = { required: cost, balance: current };
    throw error;
  }
  return { cost, balance, current, admin: isAdmin(user) };
}

export async function chargeTokens(user, context, relatedEntity) {
  if (context.prepaid) return context.current;
  if (context.admin) return context.current;
  const balanceAfter = context.current - context.cost;
  await updateRow('user_token_balances', context.balance.id, { balance: balanceAfter, last_updated: new Date().toISOString() });
  await insertRows('token_transactions', {
    user_email: user.email, transaction_type: 'usage', token_amount: -context.cost,
    balance_after: balanceAfter, related_entity: relatedEntity,
    created_at: new Date().toISOString(), created_by_id: user.id,
  });
  return balanceAfter;
}
