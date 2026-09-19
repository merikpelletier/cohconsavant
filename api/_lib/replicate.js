import { insertRows, readRows } from './supabase.js';
import { claimQuotedPrediction } from './aiQuotes.js';

const REPLICATE_API = 'https://api.replicate.com/v1';
const predictionContexts = new Map();

async function recordPrediction(prediction, context = {}) {
  if (!prediction?.id || !['succeeded', 'failed', 'canceled'].includes(prediction.status)) return;
  try {
    const existing = await readRows('ai_usage_events', { filters: { prediction_id: prediction.id }, limit: 1 });
    if (existing.length) return;
    const modelKey = context.quote_rate?.model_key || prediction.model || context.model_key || null;
    const rate = context.quote_rate || (modelKey ? (await readRows('ai_model_cost_rates', { filters: { model_key: modelKey, is_active: true }, limit: 1 }))[0] : null);
    const predictTime = Number(prediction.metrics?.predict_time || 0);
    const inputUnits = Number(prediction.metrics?.input_token_count ?? prediction.metrics?.input_tokens ?? context.input_units ?? 0);
    const outputUnits = Number(prediction.metrics?.output_token_count ?? prediction.metrics?.output_tokens ?? context.output_units ?? 0);
    let estimatedCost = null;
    if (rate) {
      if (rate.billing_type === 'per_second') estimatedCost = prediction.metrics?.predict_time == null ? null : predictTime * Number(rate.unit_price_usd);
      else if (rate.billing_type === 'per_1k_input_tokens') estimatedCost = (prediction.metrics?.input_token_count ?? prediction.metrics?.input_tokens ?? context.input_units) == null ? null : inputUnits * Number(rate.unit_price_usd) / 1000;
      else if (rate.billing_type === 'per_1k_output_tokens') estimatedCost = (prediction.metrics?.output_token_count ?? prediction.metrics?.output_tokens ?? context.output_units) == null ? null : outputUnits * Number(rate.unit_price_usd) / 1000;
      else if (rate.billing_type === 'per_1k_characters') estimatedCost = context.input_units == null ? null : Number(context.input_units) * Number(rate.unit_price_usd) / 1000;
      else if (rate.billing_type === 'per_1k_tokens') estimatedCost = prediction.metrics?.input_token_count == null || prediction.metrics?.output_token_count == null ? null : (inputUnits * Number(rate.unit_price_usd) + outputUnits * Number(rate.output_unit_price_usd)) / 1000;
      else if (rate.billing_type === 'per_output_second') estimatedCost = context.output_seconds == null ? null : Number(context.output_seconds) * Number(rate.unit_price_usd);
      else if (rate.billing_type === 'per_prediction') estimatedCost = Number(rate.unit_price_usd);
    }
    await insertRows('ai_usage_events', {
      prediction_id: prediction.id,
      operation_id: context.operation_id || null,
      user_email: context.user_email || null,
      user_id: context.user_id || null,
      tool_id: context.tool_id || null,
      model_key: modelKey,
      model_version: prediction.version || context.model_version || null,
      status: prediction.status,
      predict_time_seconds: prediction.metrics?.predict_time ?? null,
      total_time_seconds: prediction.metrics?.total_time ?? null,
      input_units: inputUnits || null,
      output_units: outputUnits || null,
      tokens_charged: Number(context.tokens_charged || 0),
      billing_type: rate?.billing_type || null,
      unit_price_usd: rate?.unit_price_usd ?? null,
      estimated_cost_usd: estimatedCost == null ? null : Number(estimatedCost.toFixed(6)),
      started_at: prediction.started_at || null,
      completed_at: prediction.completed_at || null,
      error_message: prediction.error ? String(prediction.error).slice(0, 1000) : null,
    });
  } catch (error) {
    console.error('Replicate cost tracking failed:', error.message);
  } finally {
    predictionContexts.delete(prediction.id);
  }
}

function token() {
  if (!process.env.REPLICATE_API_TOKEN) {
    const error = new Error('Connexion Replicate non configurée');
    error.status = 503;
    throw error;
  }
  return process.env.REPLICATE_API_TOKEN;
}

async function replicateRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token()}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${REPLICATE_API}${path}`, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.detail || data?.title || `Replicate ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function startModelPrediction(modelPath, input, context = {}) {
  context = { ...context, ...claimQuotedPrediction(modelPath, input) };
  const prediction = await replicateRequest(`/models/${modelPath}/predictions`, {
    method: 'POST',
    headers: { Prefer: 'wait=5', ...(context.max_runtime_seconds ? { 'Cancel-After': `${context.max_runtime_seconds}s` } : {}) },
    body: JSON.stringify({ input }),
  });
  predictionContexts.set(prediction.id, { ...context, model_key: modelPath });
  await recordPrediction(prediction, predictionContexts.get(prediction.id));
  return prediction;
}

export async function startVersionPrediction(version, input, context = {}) {
  context = { ...context, ...claimQuotedPrediction('version:' + version, input) };
  const prediction = await replicateRequest('/predictions', {
    method: 'POST',
    headers: { Prefer: 'wait=5', ...(context.max_runtime_seconds ? { 'Cancel-After': `${context.max_runtime_seconds}s` } : {}) },
    body: JSON.stringify({ version, input }),
  });
  predictionContexts.set(prediction.id, { ...context, model_version: version });
  await recordPrediction(prediction, predictionContexts.get(prediction.id));
  return prediction;
}

export async function getPrediction(predictionId, context = {}) {
  const prediction = await replicateRequest(`/predictions/${encodeURIComponent(predictionId)}`);
  await recordPrediction(prediction, { ...context, ...predictionContexts.get(predictionId) });
  return prediction;
}

export async function checkReplicateConnection() {
  const account = await replicateRequest('/account');
  return { ok: Boolean(account) };
}

export async function pollPrediction(predictionId, timeoutMs = 240000, context = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const prediction = await replicateRequest(`/predictions/${predictionId}`);
    if (prediction.status === 'succeeded') {
      await recordPrediction(prediction, { ...context, ...predictionContexts.get(predictionId) });
      return prediction.output;
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      await recordPrediction(prediction, { ...context, ...predictionContexts.get(predictionId) });
      throw new Error(prediction.error || `Prédiction Replicate ${prediction.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  try { await replicateRequest(`/predictions/${encodeURIComponent(predictionId)}/cancel`, { method: 'POST' }); }
  catch (cancelError) { console.error('Replicate cancellation requires reconciliation', predictionId, cancelError.message); }
  const error = new Error('Délai Replicate dépassé');
  error.status = 504;
  throw error;
}

export async function predictionOutput(prediction, context = {}) {
  if (prediction.status === 'succeeded') {
    await recordPrediction(prediction, { ...context, ...predictionContexts.get(prediction.id) });
    return prediction.output;
  }
  return pollPrediction(prediction.id, 240000, context);
}
