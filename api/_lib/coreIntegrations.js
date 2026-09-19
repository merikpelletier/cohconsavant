import { invokeJson, invokeText } from './llm.js';
import { predictionOutput, startModelPrediction } from './replicate.js';
import { storeExternalMedia } from './media.js';
import { chargeTokens, tokenContext } from './tokens.js';

const outputUrl = (output) => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return outputUrl(output[0]);
  if (output && typeof output === 'object') return output.url || output.image || output.video || null;
  return null;
};

export async function generateImage(payload, user) {
  if (!payload.prompt?.trim()) { const error = new Error('prompt required'); error.status = 400; throw error; }
  const context = await tokenContext(user, 'ai_image');
  const prediction = await startModelPrediction('google/nano-banana-2', {
    prompt: payload.prompt.trim(),
    aspect_ratio: payload.aspect_ratio || '1:1',
    image_input: (payload.image_input || payload.image_urls || []).filter(Boolean),
    output_format: 'jpg',
  }, { user_email: user.email, user_id: user.id, tool_id: 'ai_image', tokens_charged: context.admin ? 0 : context.cost });
  const source = outputUrl(await predictionOutput(prediction));
  if (!source) throw new Error('Replicate n’a retourné aucune image');
  const url = await storeExternalMedia(source, 'generated-image');
  await chargeTokens(user, context, 'generateImage');
  return { url, file_url: url };
}

export async function invokeLLM(payload, user) {
  if (!payload.prompt?.trim()) { const error = new Error('prompt required'); error.status = 400; throw error; }
  const system = payload.system_prompt || '';
  const tracking = { user_email: user?.email || null, user_id: user?.id || null, tool_id: 'admin_llm' };
  if (payload.response_json_schema || payload.response_format === 'json') return invokeJson(payload.prompt, system || 'Return only valid JSON without markdown.', tracking);
  return { response: await invokeText(payload.prompt, system, tracking) };
}

export async function transcribeAudio(payload, user) {
  if (!payload.audio_url) { const error = new Error('audio_url required'); error.status = 400; throw error; }
  const context = await tokenContext(user, 'transcription');
  const prediction = await startModelPrediction('openai/whisper', {
    audio: payload.audio_url,
    language: payload.language || 'fr',
    transcription: 'plain text',
  }, { user_email: user.email, user_id: user.id, tool_id: 'transcription', tokens_charged: context.admin ? 0 : context.cost });
  const output = await predictionOutput(prediction);
  const text = typeof output === 'string' ? output : output?.transcription || output?.text || '';
  await chargeTokens(user, context, 'transcribeAudio');
  return { text, transcription: text };
}

export async function synthesizeSpeech(payload, trackingContext = {}) {
  const text = payload.text?.trim();
  if (!text) { const error = new Error('Text is required'); error.status = 400; throw error; }
  const legacyVoices = { river: 'Clyde', spark: 'Aria', honey: 'Rachel', storm: 'Drew', sunny: 'Bella', sage: 'Antoni', ash: 'Dave' };
  const requestedVoice = payload.voice || 'Rachel';
  const voice = legacyVoices[requestedVoice] || requestedVoice;
  const prediction = await startModelPrediction('elevenlabs/v2-multilingual', {
    prompt: text.slice(0, 10000), voice,
    language_code: payload.language_code || 'fr',
    stability: Number(payload.stability ?? 0.5),
    similarity_boost: Number(payload.similarity_boost ?? 0.75),
    style: Number(payload.style ?? 0),
    speed: Number(payload.speed ?? 1),
  }, { ...trackingContext, input_units: text.slice(0, 10000).length });
  const source = outputUrl(await predictionOutput(prediction, trackingContext));
  if (!source) throw new Error('Replicate n’a retourné aucun fichier audio');
  const url = await storeExternalMedia(source, 'speech');
  return { url, file_url: url };
}

export async function generateSpeech(payload, user) {
  const context = await tokenContext(user, 'tts');
  const result = await synthesizeSpeech(payload, { user_email: user.email, user_id: user.id, tool_id: 'tts', tokens_charged: context.admin ? 0 : context.cost });
  const newBalance = await chargeTokens(user, context, 'generateSpeech');
  return { ...result, newBalance };
}

export async function sendEmail(payload) {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_FROM_EMAIL) {
    const error = new Error('Connexion courriel non configurée');
    error.status = 503;
    throw error;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL,
      to: payload.to,
      subject: payload.subject || 'Le Cochon Savant',
      html: payload.body || payload.html || '',
    }),
  });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data?.message || `Resend ${response.status}`); error.status = response.status; throw error; }
  return data;
}
