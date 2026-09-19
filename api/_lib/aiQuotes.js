import { createHash } from 'node:crypto';
import { readRows, insertRows, supabaseRequest } from './supabase.js';
import { currentAIQuote, withAIQuote } from './aiQuoteContext.js';
import { buildQuotePlan, costForLine, finalTokenPrice, quoteError, QUOTED_FUNCTIONS, DEFERRED_FUNCTIONS } from './aiQuoteMath.js';
export { QUOTED_FUNCTIONS, DEFERRED_FUNCTIONS };
const admin = (user) => user?.app_metadata?.role === 'admin';
export function payloadHash(name, payload) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).filter((key) => key !== '_ai_quote_id').sort().map((key) => [key, canonical(value[key])])) : value;
  return createHash('sha256').update(JSON.stringify({ name, payload: canonical(payload) })).digest('hex');
}
export async function createAIQuote(name, payload, user) {
  if (!user) throw quoteError('Authentification requise.', 401);
  if (!QUOTED_FUNCTIONS.has(name)) throw quoteError('Devis non disponible pour ce parcours.');
  const plan = buildQuotePlan(name, payload);
  const [rates, settingsRows, pricingRows] = await Promise.all([
    readRows('ai_model_cost_rates', { limit: 100 }),
    readRows('ai_cost_settings', { filters: { setting_key: 'default' }, limit: 1 }),
    readRows('tool_pricings', { filters: { tool_id: plan.tool_id, is_active: true }, limit: 1 }),
  ]);
  const floor = Number(pricingRows[0]?.token_cost);
  if (!Number.isFinite(floor) || floor <= 0) throw quoteError('Ce service doit être activé et son prix de départ configuré.');
  const lines = plan.lines.map((line) => costForLine(line, rates.find((rate) => rate.model_key === line.model_key)));
  const estimated = lines.reduce((sum, line) => sum + line.cost_usd, 0);
  const settings = settingsRows[0];
  const price = finalTokenPrice(estimated, settings, floor);
  const [quote] = await insertRows('ai_quotes', {
    user_id: user.id, user_email: user.email, function_name: name, tool_id: plan.tool_id,
    payload_hash: payloadHash(name, payload), token_price: price.tokens, starting_tokens: floor,
    estimated_cost_usd: estimated, token_value_cad: settings.token_value_cad,
    usd_to_cad_rate: settings.usd_to_cad_rate, plan: lines,
    fx_source: 'admin_configured', fx_date: new Date().toISOString().slice(0, 10),
    expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
  });
  return { id: quote.id, tokens: quote.token_price, starting_tokens: floor, expires_at: quote.expires_at,
    label: pricingRows[0]?.tool_name || plan.tool_id,
    currency: 'CAD', value_cad: price.revenue_cad,
    summary: lines.map((line) => ({ model: line.model_key, characters: line.characters, seconds: line.output_seconds })),
    admin_test: admin(user) };
}
const rpc = (name, body) => supabaseRequest('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body) });
export async function executeWithAIQuote(name, payload, user, execute) {
  if (!user) throw quoteError('Authentification requise.', 401);
  // Existing admin test workflows remain available without charging the administrator.
  if (admin(user) && !payload._ai_quote_id) return execute();
  if (DEFERRED_FUNCTIONS.has(name)) throw quoteError('Ce parcours est réservé aux essais administratifs tant que son budget complet n’est pas configuré.');
  if (!payload._ai_quote_id) throw quoteError('Confirmez le devis avant de lancer la génération.', 428);
  const [quote] = await readRows('ai_quotes', { id: payload._ai_quote_id, limit: 1 });
  if (!quote || quote.user_id !== user.id || quote.function_name !== name || quote.payload_hash !== payloadHash(name, payload)) throw quoteError('Devis invalide ou sélections modifiées. Demandez un nouveau prix.', 409);
  const reserved = await rpc('reserve_ai_quote', { p_quote_id: quote.id, p_user_id: user.id, p_hash: quote.payload_hash, p_admin: admin(user) });
  if (!reserved?.ok) throw quoteError(reserved?.error || 'Réservation impossible.', reserved?.code || 409);
  if (reserved.replay) return reserved.result;
  let result;
  try {
    result = await withAIQuote({ ...quote, admin: admin(user), balance_after: reserved.balance_after }, execute);
  } catch (error) {
    // A failed result is refunded once. Provider expenses are still kept in usage events.
    try { await rpc('finish_ai_quote', { p_quote_id: quote.id, p_user_id: user.id, p_success: false, p_result: { error: String(error.message).slice(0, 500) } }); }
    catch (settleError) { console.error('AI refund requires reconciliation', quote.id, settleError.message); }
    throw error;
  }
  // A persistence outage after success must NOT refund and relaunch an already completed generation.
  await rpc('finish_ai_quote', { p_quote_id: quote.id, p_user_id: user.id, p_success: true, p_result: result });
  return result;
}
export function claimQuotedPrediction(modelKey, input) {
  const quote = currentAIQuote();
  if (!quote) return {};
  const index = quote.plan.findIndex((line, i) => line.model_key === modelKey && !quote.used.has(i));
  if (index < 0) throw quoteError('Un appel fournisseur non inclus dans le devis a été bloqué.');
  const line = quote.plan[index];
  for (const [key, expected] of Object.entries(line.options || {})) {
    const actual = input[key] ?? (key === 'enable_pbr' ? false : 'default');
    if (actual !== expected) throw quoteError('Les options fournisseur diffèrent du devis.');
  }
  if (line.characters != null && String(input.prompt || input.text || '').length > line.characters) throw quoteError('Le texte dépasse le devis.');
  if (line.output_seconds != null && Number(input.duration) !== line.output_seconds) throw quoteError('La durée diffère du devis.');
  if (line.output_token_bound != null && (!Number.isFinite(Number(input.max_tokens)) || Number(input.max_tokens) > line.output_token_bound)) throw quoteError('La sortie texte dépasse le devis.');
  if (line.input_token_bound != null && new TextEncoder().encode(String(input.prompt || '') + String(input.system_prompt || '')).length > line.input_token_bound) throw quoteError('L’entrée texte dépasse le devis.');
  quote.used.add(index);
  return { operation_id: quote.id, tool_id: quote.tool_id, user_id: quote.user_id, user_email: quote.user_email,
    tokens_charged: 0, input_units: line.characters, output_seconds: line.output_seconds,
    max_runtime_seconds: line.max_runtime_seconds, quote_rate: line.rate };
}
