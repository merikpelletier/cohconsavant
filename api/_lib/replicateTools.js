import { pollPrediction, predictionOutput, startModelPrediction, startVersionPrediction } from './replicate.js';
import { storeExternalMedia } from './media.js';
import { chargeTokens, tokenContext } from './tokens.js';

const ratioDimensions = {
  '4:3': { width: 2560, height: 1920 }, '3:4': { width: 1920, height: 2560 },
  '16:9': { width: 2560, height: 1440 }, '9:16': { width: 1440, height: 2560 },
  '1:1': { width: 2048, height: 2048 },
};

const extractUrl = (output) => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return extractUrl(output[0]);
  if (output && typeof output === 'object') return output.url || output.image || Object.values(output).find((value) => typeof value === 'string' && value.startsWith('http'));
  return null;
};

export async function generateCharacterSheet(payload, user) {
  const ratio = ratioDimensions[payload.aspect_ratio] ? payload.aspect_ratio : '4:3';
  const dims = ratioDimensions[ratio];
  const context = await tokenContext(user, 'character_sheet', 10);
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'character_sheet', tokens_charged: context.admin ? 0 : context.cost };
  const primaryPhoto = payload.image_urls?.[0] || null;
  const imageInput = [primaryPhoto, payload.costume_url].filter(Boolean);
  if (!primaryPhoto) { const error = new Error('image_urls required'); error.status = 400; throw error; }
  const accessoriesText = payload.accessories ? ` Include ${payload.accessories}.` : '';
  const overrideText = payload.prompt_override ? ` ${payload.prompt_override}` : '';
  let prompt;
  if (payload.replace_preset && payload.prompt_override?.trim()) prompt = payload.prompt_override.trim() + accessoriesText;
  else if (payload.costume_url) prompt = `Image A is the actor reference sheet and also the layout/composition reference. Preserve the same person's exact identity across all views: same face, skin tone, hair texture and hairstyle, age, body proportions, and overall appearance. Preserve the same reference-sheet structure, panel disposition, framing, and relative image sizes as Image A. Image B is the costume reference. Dress the actor from Image A in the outfit from Image B. Reproduce the costume design as closely as possible, including all colors, fabrics, cuts, panels, layers, sheer inserts, piping, translucent details, straps, buckles, rings, hardware, and structural elements visible in the reference.${accessoriesText} Generate a clean ${ratio} character reference sheet with five vertical panels: full-body front, full-body side, full-body back, portrait front, portrait profile. Use a seamless light grey studio background, even professional lighting, photorealistic rendering, and consistent appearance across all five views. No text, no labels, no borders.${overrideText}`;
  else prompt = `Image A is the actor reference sheet and also the layout/composition reference. Preserve the same person's exact identity across all views: same face, skin tone, hair texture and hairstyle, age, body proportions, and overall appearance.${accessoriesText} Generate a clean ${ratio} character reference sheet with five vertical panels: full-body front, full-body side, full-body back, portrait front, portrait profile. Use a seamless light grey studio background, even professional lighting, photorealistic rendering, and consistent appearance across all five views. No text, no labels, no borders.${overrideText}`;
  const prediction = await startModelPrediction('google/nano-banana-2', { prompt, image_input: imageInput, aspect_ratio: ratio, output_format: 'jpg' }, tracking);
  const outputUrl = extractUrl(await predictionOutput(prediction));
  if (!outputUrl) throw new Error('Replicate n’a retourné aucune image');
  const fileUrl = await storeExternalMedia(outputUrl, 'character-sheet');
  const newBalance = await chargeTokens(user, context, 'character_sheet');
  return { file_url: fileUrl, cost: context.cost, newBalance, aspect_ratio: ratio };
}

export async function generateVideo(payload, user) {
  const context = await tokenContext(user, 'ai_video');
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'ai_video', tokens_charged: context.admin ? 0 : context.cost };
  const { prompt, image_url = null, video_url = null, duration = 5, resolution = '720p', aspect_ratio = '16:9', use_as_reference = false, engine = 'nano_banana_kling', transformation_prompt = null } = payload;
  if (!prompt && !image_url && !video_url) { const error = new Error('Prompt, image_url, or video_url is required'); error.status = 400; throw error; }
  let model;
  let input;
  if (engine === 'nano_banana_kling') {
    if (!prompt?.trim()) { const error = new Error('Un prompt est requis pour créer la première image'); error.status = 400; throw error; }
    const imagePrediction = await startModelPrediction('google/nano-banana-2', {
      prompt: prompt.trim(),
      image_input: image_url ? [image_url] : [],
      aspect_ratio,
      output_format: 'jpg',
    }, tracking);
    const startImage = extractUrl(await predictionOutput(imagePrediction));
    if (!startImage) throw new Error('Nano Banana n’a retourné aucune image');
    model = 'kwaivgi/kling-v2.6';
    input = {
      prompt: prompt.trim(),
      start_image: startImage,
      duration: [5, 10].includes(duration) ? duration : 5,
      aspect_ratio,
      generate_audio: true,
      negative_prompt: 'blurry, distorted face, deformed, low quality, watermark',
    };
  } else if (engine === 'kling_motion') {
    if (!image_url || !video_url) { const error = new Error('Une image du sujet et une vidéo de mouvement sont requises'); error.status = 400; throw error; }
    model = 'kwaivgi/kling-v2.6-motion-control';
    input = { image: image_url, video: video_url };
  } else if (engine === 'kling_morph') {
    if (!image_url) throw new Error('image_url is required for kling_morph');
    model = 'kwaivgi/kling-v2.6';
    input = { prompt: [transformation_prompt?.trim(), prompt?.trim()].filter(Boolean).join(' '), start_image: image_url, duration: [5, 10].includes(duration) ? duration : 5, generate_audio: true, negative_prompt: 'blurry, distorted face, deformed, low quality, watermark' };
  } else if (engine === 'kling') {
    model = 'kwaivgi/kling-v2.6';
    input = { prompt: prompt || '', duration: [5, 10].includes(duration) ? duration : 5, cfg_scale: 0.85, negative_prompt: 'blurry, distorted face, deformed, low quality, watermark' };
    if (image_url && use_as_reference) { input.reference_images = [image_url]; input.aspect_ratio = aspect_ratio; }
    else if (image_url) input.start_image = image_url;
    else input.aspect_ratio = aspect_ratio;
  } else {
    const error = new Error(`Moteur vidéo non pris en charge: ${engine}`);
    error.status = 400;
    throw error;
  }
  const outputUrl = extractUrl(await predictionOutput(await startModelPrediction(model, input, tracking), tracking));
  if (!outputUrl) throw new Error('Replicate n’a retourné aucune vidéo');
  const fileUrl = await storeExternalMedia(outputUrl, 'generated-video');
  await chargeTokens(user, context, 'generateVideo');
  return { file_url: fileUrl };
}

export async function mixAudioVideo(payload, user) {
  if (!payload.audio_url || !payload.video_url) { const error = new Error('audio_url and video_url required'); error.status = 400; throw error; }
  const context = await tokenContext(user, 'dubbing');
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'dubbing', tokens_charged: context.admin ? 0 : context.cost };
  const prediction = await startVersionPrediction('8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109', {
    audio_file: payload.audio_url, video_file: payload.video_url, replace_audio: false, audio_volume: 1,
  }, tracking);
  const outputUrl = extractUrl(prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id, 240000, tracking));
  if (!outputUrl) throw new Error('Replicate n’a retourné aucune vidéo mixée');
  const fileUrl = await storeExternalMedia(outputUrl, 'voice-performance');
  await chargeTokens(user, context, 'mixAudioVideo');
  return { file_url: fileUrl };
}
