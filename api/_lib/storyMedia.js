import { getPrediction, startModelPrediction } from './replicate.js';
import { storeExternalMedia } from './media.js';
import { readRows, updateRow } from './supabase.js';
import { synthesizeSpeech } from './coreIntegrations.js';

function fail(message, status) { const error = new Error(message); error.status = status; throw error; }
const one = async (table, id) => (await readRows(table, { id, limit: 1 }))[0] || null;
const many = async (table, ids = []) => (await Promise.all(ids.map((id) => one(table, id)))).filter(Boolean);
const urlFrom = (output) => typeof output === 'string' ? output : Array.isArray(output) ? urlFrom(output[0]) : output?.url || output?.image || output?.video || null;

async function saveCompleted(block, segmentIndex, prediction, tracking = {}) {
  const segments = [...(block.segment_instructions || [])];
  const segment = segments[segmentIndex];
  const source = urlFrom(prediction.output);
  if (!source) fail('Replicate n’a retourné aucun média', 502);
  const stored = await storeExternalMedia(source, segment.video_stage === 'video' ? 'story-video' : 'story-image');

  if ((segment.media_type || 'image') === 'video' && segment.video_stage !== 'video') {
    const animation = await startModelPrediction('kwaivgi/kling-v2.6', {
      start_image: stored,
      prompt: (segment.prompt || 'Cinematic subtle natural motion, professional film quality.').slice(0, 500),
      duration: 5,
      aspect_ratio: '9:16',
      generate_audio: false,
    }, tracking);
    segments[segmentIndex] = { ...segment, prediction_id: animation.id, prediction_created_at: new Date().toISOString(), video_stage: 'video', first_frame_url: stored };
    await updateRow('story_blocks', block.id, { segment_instructions: segments, active_prediction_id: animation.id, last_error: null, generation_status: 'generating' });
    return null;
  }

  const media = [...(block.video_segments || [])];
  while (media.length < segmentIndex) media.push('');
  media[segmentIndex] = stored;
  segments[segmentIndex] = { ...segment, prediction_id: null, prediction_created_at: null, redo_note: null };
  await updateRow('story_blocks', block.id, { video_segments: media, segment_instructions: segments, active_prediction_id: null, last_error: null, generation_status: 'generating' });
  return media;
}

export async function generateBlockVideos(payload, user) {
  const blockId = payload.block_id;
  if (!blockId) fail('block_id required', 400);
  let block = await one('story_blocks', blockId);
  if (!block) fail('Block not found', 404);
  const session = await one('story_sessions', block.session_id);
  if (!session || session.user_email !== user.email) fail('Not your block', 403);
  const mediaTracking = { user_email: user.email, user_id: user.id, tool_id: 'story_media' };
  const narrationTracking = { user_email: user.email, user_id: user.id, tool_id: 'story_narration' };
  const segments = block.segment_instructions || [];
  if (!segments.length) {
    await updateRow('story_blocks', blockId, { generation_status: 'completed' });
    return { block_id: blockId, status: 'completed', video_segments: [], narration_audio_urls: [], total_segments: 0, completed_segments: 0 };
  }

  const media = [...(block.video_segments || [])];
  let index = 0;
  while (index < segments.length && media[index]) index += 1;
  if (index >= segments.length) {
    const narration = [...(block.narration_audio_urls || [])];
    for (let i = 0; i < segments.length; i += 1) {
      const text = [segments[i]?.narration_text, segments[i]?.dialogue].filter(Boolean).join(' ');
      if (!narration[i] && text) {
        try {
          narration[i] = (await synthesizeSpeech({ text, voice: session.narrator_voice || 'river', language_code: 'fr' }, narrationTracking)).url;
          await updateRow('story_blocks', blockId, { narration_audio_urls: narration });
          return { block_id: blockId, status: 'generating', video_segments: media, narration_audio_urls: narration, total_segments: segments.length, completed_segments: media.filter(Boolean).length, message: `Narration for scene ${i + 1} ready…` };
        } catch (error) {
          if (error.status !== 503) console.error(`[storyMedia] narration ${i + 1}: ${error.message}`);
        }
      }
    }
    await updateRow('story_blocks', blockId, { generation_status: 'completed', active_prediction_id: null });
    return { block_id: blockId, status: 'completed', video_segments: media, narration_audio_urls: narration, total_segments: segments.length, completed_segments: media.filter(Boolean).length };
  }

  let segment = segments[index];
  if (segment.prediction_id) {
    const prediction = await getPrediction(segment.prediction_id, mediaTracking);
    if (prediction.status === 'starting' || prediction.status === 'processing') return { block_id: blockId, status: 'generating', total_segments: segments.length, completed_segments: media.filter(Boolean).length, current_segment: index + 1, message: `Generating ${(segment.media_type || 'image')} ${index + 1}/${segments.length}…` };
    if (prediction.status === 'succeeded') {
      const updatedMedia = await saveCompleted(block, index, prediction, mediaTracking);
      return { block_id: blockId, status: 'generating', total_segments: segments.length, completed_segments: updatedMedia?.filter(Boolean).length ?? media.filter(Boolean).length, current_segment: index + 1, video_segments: updatedMedia || media, message: updatedMedia ? `Segment ${index + 1}/${segments.length} done. Generating audio…` : `Animating segment ${index + 1}/${segments.length}…` };
    }
    const updated = [...segments];
    updated[index] = { ...segment, prediction_id: null, prediction_created_at: null, last_error: prediction.error || prediction.status };
    await updateRow('story_blocks', blockId, { segment_instructions: updated, active_prediction_id: null, last_error: prediction.error || prediction.status });
    block = { ...block, segment_instructions: updated };
    segment = updated[index];
  }

  const narration = [...(block.narration_audio_urls || [])];
  const narrationText = [segment.narration_text, segment.dialogue].filter(Boolean).join(' ');
  if (!narration[index] && narrationText) {
    try {
      narration[index] = (await synthesizeSpeech({ text: narrationText, voice: session.narrator_voice || 'river', language_code: 'fr' }, narrationTracking)).url;
      await updateRow('story_blocks', blockId, { narration_audio_urls: narration });
    } catch (error) {
      if (error.status !== 503) console.error(`[storyMedia] narration ${index + 1}: ${error.message}`);
    }
  }

  const [theme, hero] = await Promise.all([one('story_themes', session.theme_id), one('story_characters', session.hero_story_character_id)]);
  const [characters, sets] = await Promise.all([many('story_characters', theme?.story_character_ids || []), many('story_sets', theme?.story_set_ids || [])]);
  const byName = new Map([hero, ...characters].filter(Boolean).map((character) => [character.name?.toLowerCase().trim(), character]));
  const references = [];
  const legend = [];
  for (const name of segment.characters_present || []) {
    const character = byName.get(String(name).toLowerCase().trim());
    if (!character) continue;
    for (const image of [character.photos?.[0], character.reference_sheet].filter(Boolean)) {
      if (!references.includes(image) && references.length < 8) { references.push(image); legend.push(`${character.name}: preserve exact identity, body and costume`); }
    }
  }
  const set = sets.find((item) => item.name === segment.selected_set);
  if (set?.images?.[0] && references.length < 9) { references.push(set.images[0]); legend.push(`${set.name}: preserve layout and atmosphere`); }
  for (let i = index - 1; i >= 0 && references.length < 12; i -= 1) if (media[i] && !references.includes(media[i])) { references.push(media[i]); legend.push(`Continuity frame from scene ${i + 1}`); }
  const exterior = segment.segment_purpose === 'establishing_exterior';
  const prompt = `${legend.length ? `Reference images:\n${legend.map((item, i) => `Image ${i + 1}: ${item}`).join('\n')}\n` : ''}${segment.prompt || 'Cinematic film scene.'}\n${exterior ? `Exterior establishing shot. Convey ${segment.emotional_tone || 'the scene mood'} through weather, lighting and environment.` : `Preserve every character's exact identity and costume. Their facial expressions must visibly show ${segment.emotional_tone || 'the scene emotion'}.`}\nLive-action 35mm cinematic film still, photorealistic, real people and textures, vertical 9:16. No illustration, painting, 3D render, anime or cartoon.${segment.redo_note ? `\nDirector correction: ${segment.redo_note}` : ''}`;
  let prediction;
  try {
    prediction = await startModelPrediction('google/nano-banana-2', { prompt, image_input: references.slice(0, 14), aspect_ratio: '9:16', resolution: '2K', output_format: 'jpg' }, mediaTracking);
  } catch (error) {
    if (error.status === 429) {
      await updateRow('story_blocks', blockId, { rate_limited_until: new Date(Date.now() + 30000).toISOString() });
      return { block_id: blockId, status: 'generating', total_segments: segments.length, completed_segments: media.filter(Boolean).length, current_segment: index + 1, cooldown_sec: 30, message: 'Rate limit — waiting…' };
    }
    throw error;
  }
  if (prediction.status === 'succeeded') {
    const updatedMedia = await saveCompleted(block, index, prediction, mediaTracking);
    return { block_id: blockId, status: 'generating', total_segments: segments.length, completed_segments: updatedMedia?.filter(Boolean).length ?? media.filter(Boolean).length, video_segments: updatedMedia || media, current_segment: index + 1, message: updatedMedia ? `Segment ${index + 1}/${segments.length} done.` : `Animating segment ${index + 1}/${segments.length}…` };
  }
  const updatedSegments = [...segments];
  updatedSegments[index] = { ...segment, prediction_id: prediction.id, prediction_created_at: new Date().toISOString(), video_stage: (segment.media_type || 'image') === 'video' ? 'image' : undefined };
  await updateRow('story_blocks', blockId, { segment_instructions: updatedSegments, active_prediction_id: prediction.id, last_error: null, generation_status: 'generating' });
  return { block_id: blockId, status: 'generating', total_segments: segments.length, completed_segments: media.filter(Boolean).length, current_segment: index + 1, message: `Segment ${index + 1}/${segments.length} started…` };
}
