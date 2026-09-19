import { readRows, updateRow } from './supabase.js';
import { synthesizeSpeech } from './coreIntegrations.js';

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export async function regenerateNarration(payload, user) {
  const { block_id: blockId, voice } = payload;
  if (!blockId || !voice) fail('block_id and voice are required', 400);
  if (!['river', 'honey', 'sunny', 'storm', 'spark'].includes(voice)) fail('Invalid voice', 400);
  const [block] = await readRows('story_blocks', { id: blockId, limit: 1 });
  if (!block) fail('Block not found', 404);
  const [session] = await readRows('story_sessions', { id: block.session_id, limit: 1 });
  if (!session || session.user_email !== user.email) fail('Not your block', 403);

  const narrationUrls = [];
  for (const [index, segment] of (block.segment_instructions || []).entries()) {
    const text = [segment?.narration_text, segment?.dialogue].filter(Boolean).join(' ');
    if (!text) { narrationUrls[index] = ''; continue; }
    try {
      narrationUrls[index] = (await synthesizeSpeech({ text, voice })).url;
    } catch (error) {
      if (error.status === 503) throw error;
      console.error(`[regenerateNarration] segment ${index + 1}: ${error.message}`);
      narrationUrls[index] = '';
    }
  }

  await updateRow('story_blocks', blockId, { narration_audio_urls: narrationUrls });
  await updateRow('story_sessions', session.id, { narrator_voice: voice });
  return { block_id: blockId, narration_audio_urls: narrationUrls, voice };
}
