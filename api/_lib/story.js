import { invokeJson } from './llm.js';
import { insertRows, readRows, updateRow } from './supabase.js';

const one = async (table, id) => (await readRows(table, { id, limit: 1 }))[0] || null;

export async function proposeStoryArc(payload, user) {
  const { theme_id, hero_character_id, starting_topic_id } = payload;
  if (!theme_id || !hero_character_id || !starting_topic_id) { const error = new Error('theme_id, hero_character_id, and starting_topic_id are required'); error.status = 400; throw error; }
  const [theme, hero, topic] = await Promise.all([one('story_themes', theme_id), one('story_characters', hero_character_id), one('starting_topics', starting_topic_id)]);
  if (!theme || !hero || !topic) { const error = new Error('Theme, hero or topic not found'); error.status = 404; throw error; }
  const prompt = `You are a master story architect. Given a story theme, a hero character, and a starting topic, design a compelling story arc blueprint that an AI will use to write the story chapter by chapter.

THEME:
- Title: ${theme.title}
- Description: ${theme.description}
- Tone rules: ${theme.tone_rules || 'N/A'}
- Story rules: ${theme.story_rules || 'N/A'}

HERO:
- Name: ${hero.name}
- Role: ${hero.character_type || 'Hero'}
- Bio: ${hero.description || 'N/A'}

STARTING TOPIC:
- Title: ${topic.title}
- Description: ${topic.description}

Return ONLY JSON with chapter_count (3 to 12), start, middle, and reveal.`;
  const arc = await invokeJson(prompt, 'Return only valid JSON without markdown.', { user_email: user?.email || null, user_id: user?.id || null, tool_id: 'story_arc' });
  return { chapter_count: Math.max(1, Math.min(20, Math.round(arc.chapter_count))), start: arc.start || '', middle: arc.middle || '', reveal: arc.reveal || '' };
}

export async function regenerateSegment(payload, user) {
  if (!payload.block_id || payload.segment_index === undefined) { const error = new Error('block_id and segment_index required'); error.status = 400; throw error; }
  const block = await one('story_blocks', payload.block_id);
  if (!block) { const error = new Error('Block not found'); error.status = 404; throw error; }
  const session = await one('story_sessions', block.session_id);
  if (!session || session.user_email !== user.email) { const error = new Error('Not your block'); error.status = 403; throw error; }
  const segments = [...(block.segment_instructions || [])];
  const media = [...(block.video_segments || [])];
  if (payload.segment_index < 0 || payload.segment_index >= segments.length) { const error = new Error('Invalid segment index'); error.status = 400; throw error; }
  while (media.length <= payload.segment_index) media.push('');
  media[payload.segment_index] = '';
  segments[payload.segment_index] = { ...segments[payload.segment_index], prediction_id: null, prediction_created_at: null, video_stage: null, first_frame_url: null, last_error: null, redo_note: payload.redo_note || null };
  const [updated] = await updateRow('story_blocks', block.id, { video_segments: media, segment_instructions: segments, generation_status: 'generating', active_prediction_id: null, last_error: null });
  return { block: updated };
}

export async function sendContactMessage(payload) {
  if (!payload.message) { const error = new Error('Message is required'); error.status = 400; throw error; }
  const [item] = await insertRows('contact_messages', {
    message: payload.message,
    email: null,
    status: 'unread',
  });
  return { success: true, item };
}

async function upsertPublishedDossier(referenceId, blockIds, dossierData, pageData, user) {
  const pages = await readRows('dossier_pages', { filters: { block_player_episode_page_id: referenceId }, limit: 500 });
  const wanted = [...(blockIds || [])].sort();
  const existing = pages.find((page) => page.page_type === 'block_player' && (() => {
    const have = [...(page.block_player_block_ids || [])].sort();
    return have.length === wanted.length && have.every((value, index) => value === wanted[index]);
  })());
  if (existing) {
    await updateRow('dossiers', existing.dossier_id, dossierData);
    await updateRow('dossier_pages', existing.id, { ...pageData, block_player_episode_page_id: referenceId, block_player_block_ids: blockIds || [] });
    return existing.dossier_id;
  }
  const [dossier] = await insertRows('dossiers', { ...dossierData, created_by_id: user.id });
  await insertRows('dossier_pages', { dossier_id: dossier.id, page_type: 'block_player', order: 0, ...pageData, block_player_episode_page_id: referenceId, block_player_block_ids: blockIds || [], created_by_id: user.id });
  return dossier.id;
}

export async function publishEpisode(payload, user) {
  if (!payload.production_id) { const error = new Error('Missing production_id'); error.status = 400; throw error; }
  const production = await one('timeline_stories', payload.production_id);
  if (!production || production.user_email !== user.email) { const error = new Error('Production not found'); error.status = 404; throw error; }
  const blocks = (production.blocks || []).filter((block) => block.media_url).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!blocks.length) { const error = new Error('No scenes with media to publish'); error.status = 400; throw error; }
  const coverImage = production.poster_image || blocks[0].media_url;
  const title = production.episode_title || 'My Episode';
  const dossierData = { title, subtitle: production.episode_description || '', class: 'Story', category: production.category || '', status: 'published', order: Date.now(), author_name: production.author_name || user.user_metadata?.full_name || user.email, cover_image: coverImage, has_portrait: true, has_landscape: false, submitted_by_email: user.email, submitted_by_name: user.user_metadata?.full_name || user.email, submitted_at: new Date().toISOString(), approved_at: new Date().toISOString() };
  const dossierId = await upsertPublishedDossier(production.id, [], dossierData, { title, content: production.episode_description || '', media_url: coverImage }, user);
  await updateRow('timeline_stories', production.id, { is_published: true });
  return { success: true, dossier_id: dossierId, message: 'Episode published successfully!' };
}

export async function publishStorySession(payload, user) {
  if (!payload.session_id) { const error = new Error('Missing session_id'); error.status = 400; throw error; }
  const session = await one('story_sessions', payload.session_id);
  if (!session || session.user_email !== user.email) { const error = new Error('Story session not found'); error.status = 404; throw error; }
  const allBlocks = await readRows('story_blocks', { filters: { session_id: session.id }, sort: 'order', limit: 200 });
  const requested = Array.isArray(payload.block_ids) && payload.block_ids.length ? new Set(payload.block_ids) : null;
  const blocks = requested ? allBlocks.filter((block) => requested.has(block.id)) : allBlocks;
  const playable = blocks.flatMap((block) => (block.video_segments || []).map((url, index) => url ? ({ url, media_type: block.segment_instructions?.[index]?.media_type || 'video', title: block.segment_instructions?.[index]?.story_action || block.block_title, description: block.segment_instructions?.[index]?.narration_text || block.narrative_summary || '', narration: block.narration_audio_urls?.[index] || '' }) : null).filter(Boolean));
  if (!playable.length) { const error = new Error('No video segments to publish. Produce your chapters first.'); error.status = 400; throw error; }
  const fullStory = blocks.length === allBlocks.length && allBlocks.length > 0;
  const storedIds = fullStory ? [] : blocks.map((block) => block.id);
  const [theme, hero] = await Promise.all([one('story_themes', session.theme_id), one('story_characters', session.hero_story_character_id)]);
  const firstVideo = playable.find((segment) => segment.media_type === 'video')?.url || '';
  const title = payload.title || (hero?.name ? `${hero.name}'s Story` : theme?.title || 'My Story');
  const subtitle = payload.description || blocks[0]?.narrative_summary?.slice(0, 200) || theme?.description || '';
  const cover = payload.cover_image || hero?.photos?.[0] || theme?.cover_image || '';
  const dossierData = { title, subtitle, class: payload.dossier_class || 'Story', category: payload.category || theme?.type || '', status: 'published', order: Date.now(), author_name: payload.author_name || user.user_metadata?.full_name || user.email, cover_image: cover, cover_template_image: theme?.cover_template_image || '', cover_video: firstVideo, has_portrait: true, has_landscape: false, submitted_by_email: user.email, submitted_by_name: user.user_metadata?.full_name || user.email, submitted_at: new Date().toISOString(), approved_at: new Date().toISOString() };
  const dossierId = await upsertPublishedDossier(session.id, storedIds, dossierData, { title, content: subtitle, media_url: cover }, user);
  await updateRow('story_sessions', session.id, { is_published: true, published_dossier_id: dossierId });
  return { success: true, dossier_id: dossierId, scene_count: playable.length, chapter_count: blocks.length, is_full_story: fullStory, message: 'Story published successfully!' };
}
