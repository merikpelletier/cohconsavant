// Pure pricing rules. Missing or unbounded costs fail closed, never become zero.
export function quoteError(message, status = 422) {
  const error = new Error(message);
  error.status = status;
  return error;
}
const positive = (value, label) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw quoteError(label);
  return number;
};
const nonnegative = (value, label) => {
  if (value == null || value === '') throw quoteError(label);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw quoteError(label);
  return number;
};
export function finalTokenPrice(costUsd, settings, floor = 0) {
  const cost = positive(costUsd, 'Coût fournisseur non calculable.');
  const fx = positive(settings?.usd_to_cad_rate, 'Conversion USD/CAD à configurer dans Coûts IA.');
  const tokenValue = positive(settings?.token_value_cad, 'Valeur nette du jeton à configurer dans Coûts IA.');
  const raw = cost * fx / 0.60 / tokenValue;
  if (!Number.isFinite(raw) || raw > 1e9) throw quoteError('Prix hors limites.');
  // Round upwards, then verify floating-point rounding has not reduced the margin.
  let tokens = Math.max(Math.ceil(raw), Math.ceil(Number(floor) || 0), 1);
  if (tokens * tokenValue * 0.60 < cost * fx) tokens += 1;
  return { tokens, cost_cad: cost * fx, revenue_cad: tokens * tokenValue, margin_percent: 100 * (1 - cost * fx / (tokens * tokenValue)) };
}
export function selectRate(rate, options = {}) {
  if (!rate?.is_active || !rate.quote_enabled) throw quoteError('Tarif fournisseur non validé pour le devis.');
  const variants = rate.quote_variants || [];
  if (!Array.isArray(variants)) throw quoteError('Variantes tarifaires invalides.');
  if (!variants.length) return rate;
  const matches = variants.filter((variant) => Object.entries(variant.match || {}).every(([key, value]) => options[key] === value));
  if (matches.length !== 1) throw quoteError('Aucun tarif unique pour ces options (résolution, audio ou format).');
  return { ...rate, ...matches[0], model_key: rate.model_key };
}
export function costForLine(line, baseRate) {
  const rate = selectRate(baseRate, line.options);
  const unit = positive(rate.unit_price_usd, 'Tarif fournisseur manquant ou invalide.');
  let quantity = 1;
  let usd;
  if (rate.billing_type === 'per_prediction') usd = unit;
  else if (rate.billing_type === 'per_1k_characters') {
    quantity = positive(line.characters, 'Nombre de caractères non calculable.');
    usd = quantity * unit / 1000;
  } else if (rate.billing_type === 'per_output_second') {
    // Only a server-controlled output duration is accepted. Never trust uploaded media metadata.
    quantity = positive(line.output_seconds, 'Durée du média non vérifiée côté serveur.');
    usd = quantity * unit;
  } else if (rate.billing_type === 'per_second') {
    quantity = positive(rate.max_runtime_seconds, 'Limite de calcul à configurer.');
    if (!Number.isInteger(quantity) || quantity < 5 || quantity > 240) throw quoteError('La limite de calcul doit être comprise entre 5 et 240 secondes.');
    usd = quantity * unit;
  } else if (rate.billing_type === 'per_1k_tokens') {
    const input = positive(line.input_token_bound, 'Entrée texte non bornée.');
    const output = positive(line.output_token_bound, 'Sortie texte non bornée.');
    const outputRate = nonnegative(rate.output_unit_price_usd, 'Tarif de sortie à configurer, même si nul.');
    quantity = input;
    usd = (input * unit + output * outputRate) / 1000;
  } else throw quoteError('Cette unité fournisseur ne permet pas encore un devis fiable.');
  return { ...line, rate, quantity, cost_usd: usd, max_runtime_seconds: rate.billing_type === 'per_second' ? quantity : 240 };
}

const IMAGE = 'google/nano-banana-2';
const KLING = 'kwaivgi/kling-v2.6';
const MOTION = 'kwaivgi/kling-v2.6-motion-control';
const imageMethods = new Set(['character_sheet', 'headshot', 'compose_scene', 'character_photo', 'reference_sheet_swap']);
export const QUOTED_FUNCTIONS = new Set(['replicateGenerate', 'generateCharacterSheet', 'generateVideo', 'mixAudioVideo', 'generateImage', 'generateSpeech', 'transcribeAudio', 'sendMemberContact']);
export const DEFERRED_FUNCTIONS = new Set(['generateStoryBlock', 'checkStoryBlockPlan', 'generateBlockVideos', 'regenerateNarration', 'regenerateSegment', 'proposeStoryArc', 'gameStartLevel', 'gameEvaluateInterpretation', 'gameGuidedVisit', 'gameEvaluateCreation']);

export function buildQuotePlan(name, payload) {
  const p = payload || {};
  const image = (ratio = p.aspect_ratio || '4:3') => ({ model_key: IMAGE, options: { aspect_ratio: ratio, resolution: 'default' } });
  const video = (audio, duration = 5) => ({ model_key: KLING, output_seconds: duration, options: { generate_audio: audio, duration, resolution: 'default' } });
  const one = (tool, line) => ({ tool_id: tool, lines: [line] });
  if (name === 'generateSpeech') {
    if (typeof p.text !== 'string' || !p.text.trim() || p.text.trim().length > 10000) throw quoteError('Le texte doit contenir entre 1 et 10 000 caractères.');
    return one('tts', { model_key: 'elevenlabs/v2-multilingual', characters: p.text.trim().length, options: {} });
  }
  if (name === 'sendMemberContact') {
    if (!p.message?.trim() || !p.memberName) throw quoteError('Message et membre requis.');
    // UTF-8 bytes are a conservative bound for byte-level tokenization, including the fixed system prompt.
    const bytes = new TextEncoder().encode(JSON.stringify(p)).length + 4096;
    if (bytes > 64000) throw quoteError('Conversation trop longue : commencez une nouvelle conversation.');
    return one('fake_member_chat', { model_key: 'deepseek-ai/deepseek-v3', input_token_bound: bytes, output_token_bound: 512, options: {} });
  }
  if (name === 'generateImage') return one('ai_image', image(p.aspect_ratio || '1:1'));
  if (name === 'generateCharacterSheet') return one('character_sheet', image());
  if (name === 'transcribeAudio') return one('transcription', { model_key: 'openai/whisper', options: {} });
  if (name === 'mixAudioVideo') return one('dubbing', { model_key: 'version:8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109', options: {} });
  if (name === 'generateVideo') {
    const engine = p.engine || 'nano_banana_kling';
    const duration = [5, 10].includes(p.duration) ? p.duration : 5;
    if (engine === 'nano_banana_kling') return { tool_id: 'ai_video', lines: [image(p.aspect_ratio || '16:9'), video(true, duration)] };
    if (engine === 'kling_motion') return one('ai_video', { model_key: MOTION, options: {} });
    if (engine === 'kling_morph') return one('ai_video', video(true, duration));
    if (engine === 'kling') return one('ai_video', video('default', duration));
    throw quoteError('Moteur vidéo non pris en charge.');
  }
  if (name === 'replicateGenerate') {
    const method = p.method;
    if (imageMethods.has(method)) return one(method, image(method === 'character_sheet' ? p.aspect_ratio || '16:9' : method === 'headshot' ? p.aspect_ratio || '3:4' : p.aspect_ratio || '4:3'));
    if (method === 'animate_image' || method === 'text_to_video') return one(method, video('default'));
    if (method === 'animate_with_reference') return one(method, { model_key: MOTION, options: {} });
    if (method === 'body_and_voice') return one(method, { model_key: 'kwaivgi/kling-v3-omni-video', options: {} });
    if (method === 'lip_sync') return one(method, { model_key: 'kwaivgi/kling-lip-sync', options: {} });
    if (method === 'faceswitch') return { tool_id: method, lines: [
      { model_key: 'version:278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34', options: {} },
      { model_key: 'version:0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c', options: {} },
    ] };
    if (method === 'generate_3d') return { tool_id: method, lines: [
      ...(!p.photo_url ? [image('1:1')] : []),
      { model_key: 'firtoz/trellis', options: { generate_normal: Boolean(p.enable_pbr) } },
    ] };
  }
  throw quoteError('Ce parcours nécessite un budget complet avant son ouverture aux membres.');
}
