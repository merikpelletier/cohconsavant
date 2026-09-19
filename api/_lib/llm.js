import { predictionOutput, startModelPrediction } from './replicate.js';

const MODEL = 'meta/meta-llama-3-70b-instruct';

export function parseJsonOutput(output) {
  let text = Array.isArray(output) ? output.join('') : String(output || '');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1];
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text);
}

export async function invokeJson(prompt, systemPrompt = 'Return only valid JSON without markdown.', context = {}) {
  const prediction = await startModelPrediction(MODEL, {
    prompt, system_prompt: systemPrompt, max_tokens: 4096, temperature: 0.7,
  }, context);
  return parseJsonOutput(await predictionOutput(prediction));
}

export async function invokeText(prompt, systemPrompt = '', context = {}) {
  const prediction = await startModelPrediction(MODEL, {
    prompt, system_prompt: systemPrompt, max_tokens: 4096, temperature: 0.7,
  }, context);
  const output = await predictionOutput(prediction);
  return (Array.isArray(output) ? output.join('') : String(output || '')).trim();
}
