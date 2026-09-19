import { buildCreationEvaluationPrompt, buildGameMasterSystemPrompt, buildGuidedVisitPrompt, buildInterpretationEvaluationPrompt, buildLevelSetupPrompt, buildTexturePrompt } from './gameMaster.js';
import { invokeJson, invokeText } from './llm.js';
import { predictionOutput, startModelPrediction } from './replicate.js';
import { storeExternalMedia } from './media.js';
import { insertRows, readRows, updateRow } from './supabase.js';

const one = async (table, id) => (await readRows(table, { id, limit: 1 }))[0] || null;
const requireOwner = (session, user) => {
  if (!session) { const error = new Error('Session not found'); error.status = 404; throw error; }
  if (session.player_email !== user.email) { const error = new Error('Not your session'); error.status = 403; throw error; }
};
const outputUrl = (output) => typeof output === 'string' ? output : Array.isArray(output) ? outputUrl(output[0]) : output?.url || output?.image || null;

async function generateTexture(theme, surface, mapType, tracking) {
  const prediction = await startModelPrediction('bytedance/seedream-4.5', {
    prompt: buildTexturePrompt(theme, surface, mapType), image_input: [], size: 'custom',
    width: 2048, height: 2048, aspect_ratio: '1:1',
  }, tracking);
  const url = outputUrl(await predictionOutput(prediction));
  return url ? storeExternalMedia(url, `game-${surface}-${mapType}`) : null;
}

export async function gameStartLevel(payload, user) {
  if (!payload.session_id) { const error = new Error('session_id required'); error.status = 400; throw error; }
  const session = await one('game_sessions', payload.session_id);
  requireOwner(session, user);
  const masterTracking = { user_email: user.email, user_id: user.id, tool_id: 'game_master' };
  const textureTracking = { user_email: user.email, user_id: user.id, tool_id: 'game_texture' };
  const theme = await one('game_themes', session.theme_id);
  if (!theme) { const error = new Error('Theme not found'); error.status = 404; throw error; }
  const textureSpecs = [
    ['floor_texture_url', 'floor', 'albedo'], ['wall_texture_url', 'wall', 'albedo'],
    ['floor_normal_url', 'floor', 'height'], ['wall_normal_url', 'wall', 'height'],
  ].filter(([key]) => !theme[key]);
  if (textureSpecs.length) {
    const urls = await Promise.all(textureSpecs.map(([, surface, type]) => generateTexture(theme, surface, type, textureTracking)));
    const updates = Object.fromEntries(textureSpecs.map(([key], index) => [key, urls[index]]).filter(([, url]) => url));
    if (Object.keys(updates).length) { await updateRow('game_themes', theme.id, updates); Object.assign(theme, updates); }
  }
  const levelNumber = session.current_level;
  const config = theme.levels_config?.find((item) => item.level_number === levelNumber) || { level_number: levelNumber, min_elements: 3 + levelNumber, max_elements: 4 + levelNumber * 2, passage_value: 500 * levelNumber, loss_threshold: 0 };
  const [existing] = await readRows('game_levels', { filters: { session_id: session.id, level_number: levelNumber }, limit: 1 });
  if (existing?.status === 'in_progress') return { level: existing, elements: await readRows('game_elements', { filters: { session_id: session.id, level_id: existing.id } }), message: 'Level already in progress' };
  const assets = await readRows('game_theme_assets', { filters: { theme_id: session.theme_id }, limit: 500 });
  const ai = await invokeJson(buildLevelSetupPrompt(theme, levelNumber, config, assets), buildGameMasterSystemPrompt(theme), masterTracking);
  const [level] = await insertRows('game_levels', { session_id: session.id, level_number: levelNumber, status: 'in_progress', merit_at_start: session.merit_points, passage_value: config.passage_value, loss_threshold: config.loss_threshold, total_elements: ai.selected_elements.length, connected_elements: 0, ai_seed: ai.seed, environment_config: ai.environment_config, started_at: new Date().toISOString(), created_by_id: user.id });
  const total = ai.selected_elements.length;
  const cols = Math.ceil(Math.sqrt(total));
  const spacing = 12 / Math.max(cols, 1);
  const elements = [];
  for (let index = 0; index < ai.selected_elements.length; index++) {
    const selected = ai.selected_elements[index];
    const asset = assets.find((item) => item.name === selected.asset_name);
    if (!asset) continue;
    const position = asset.default_position || { x: (index % cols) * spacing - 6 + spacing / 2, y: 0, z: Math.floor(index / cols) * spacing - 6 + spacing / 2 };
    const [element] = await insertRows('game_elements', { session_id: session.id, level_id: level.id, element_type: asset.asset_type === 'environment_3d' ? 'environment' : asset.asset_type, name: asset.name, description: asset.description, source_type: 'theme_asset', theme_asset_id: asset.id, media_url: asset.media_url, model_url: asset.model_url, position, rotation: asset.default_position ? asset.default_rotation || 0 : selected.rotation || 0, is_connected: false, ai_narrative_hint: selected.narrative_hint, created_by_id: user.id });
    elements.push(element);
  }
  return { level, elements, seed: ai.seed, theme_textures: { floor_texture_url: theme.floor_texture_url, floor_normal_url: theme.floor_normal_url, wall_texture_url: theme.wall_texture_url, wall_normal_url: theme.wall_normal_url } };
}

export async function gameCompleteLevel(payload, user) {
  const session = await one('game_sessions', payload.session_id);
  requireOwner(session, user);
  const [level] = await readRows('game_levels', { filters: { session_id: session.id, level_number: session.current_level }, limit: 1 });
  if (!level) { const error = new Error('Level not found'); error.status = 404; throw error; }
  const elements = await readRows('game_elements', { filters: { session_id: session.id, level_id: level.id }, limit: 500 });
  const unconnected = elements.filter((item) => !item.is_connected);
  if (unconnected.length) { const error = new Error('Not all elements are connected'); error.status = 400; error.details = { unconnected_count: unconnected.length, total_elements: elements.length }; throw error; }
  await updateRow('game_levels', level.id, { status: 'completed', completed_at: new Date().toISOString() });
  const currentMerit = Number(session.merit_points || 0);
  if (currentMerit < Number(level.passage_value || 0)) return { level_completed: true, passed: false, current_merit: currentMerit, passage_value: level.passage_value, deficit: level.passage_value - currentMerit };
  const reserve = currentMerit - level.passage_value;
  if (session.current_level >= 4) { await updateRow('game_sessions', session.id, { status: 'completed', merit_points: reserve, completed_at: new Date().toISOString() }); return { level_completed: true, passed: true, game_completed: true, reserve }; }
  await updateRow('game_sessions', session.id, { current_level: session.current_level + 1, merit_points: reserve, reserve_points: reserve });
  return { level_completed: true, passed: true, game_completed: false, next_level: session.current_level + 1, reserve };
}

export async function gameEvaluateInterpretation(payload, user) {
  const { session_id, element_id, element_b_id, text } = payload;
  if (!session_id || !element_id || !element_b_id || !text) { const error = new Error('session_id, element_id, element_b_id, and text required'); error.status = 400; throw error; }
  const session = await one('game_sessions', session_id); requireOwner(session, user);
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'game_master' };
  const [elementA, elementB, theme] = await Promise.all([one('game_elements', element_id), one('game_elements', element_b_id), one('game_themes', session.theme_id)]);
  if (!elementA || !elementB) { const error = new Error('Element not found'); error.status = 404; throw error; }
  const connections = await readRows('game_connections', { filters: { session_id, level_id: elementA.level_id }, limit: 500 });
  const level = await one('game_levels', elementA.level_id);
  const [interpretation] = await insertRows('game_interpretations', { session_id, level_id: elementA.level_id, element_id, element_b_id, player_email: user.email, text, created_at: new Date().toISOString(), created_by_id: user.id });
  const ai = await invokeJson(buildInterpretationEvaluationPrompt(theme, elementA, elementB, { text }, connections.map((item) => ({ summary: `${item.element_a_id} ↔ ${item.element_b_id}: ${item.ai_evaluation || 'evaluated'}` })), level?.ai_seed || 'N/A'), buildGameMasterSystemPrompt(theme), tracking);
  await updateRow('game_interpretations', interpretation.id, { ai_evaluation: ai.evaluation, ai_score: ai.score, is_approved: ai.is_approved });
  const [request] = await insertRows('game_ai_requests', { session_id, interpretation_id: interpretation.id, element_id, request_text: ai.demand, expected_creation_type: ai.expected_creation_type || 'any', status: 'pending', created_at: new Date().toISOString(), created_by_id: user.id });
  return { interpretation: { ...interpretation, ai_evaluation: ai.evaluation, ai_score: ai.score, is_approved: ai.is_approved }, ai_request: request };
}

export async function gameGuidedVisit(payload, user) {
  const session = await one('game_sessions', payload.session_id);
  if (!session) { const error = new Error('Session not found'); error.status = 404; throw error; }
  const [theme, levels, connections, interpretations, creations, elements] = await Promise.all([
    one('game_themes', session.theme_id), readRows('game_levels', { filters: { session_id: session.id }, limit: 50 }),
    readRows('game_connections', { filters: { session_id: session.id }, limit: 500 }), readRows('game_interpretations', { filters: { session_id: session.id }, limit: 500 }),
    readRows('game_creations', { filters: { session_id: session.id }, limit: 500 }), readRows('game_elements', { filters: { session_id: session.id }, limit: 500 }),
  ]);
  const summaries = connections.sort((a, b) => a.order - b.order).map((item) => ({ summary: `${elements.find((element) => element.id === item.element_a_id)?.name || item.element_a_id} ↔ ${elements.find((element) => element.id === item.element_b_id)?.name || item.element_b_id}`, ai_evaluation: item.ai_evaluation, points_change: item.points_change }));
  const tour = await invokeText(buildGuidedVisitPrompt(theme, session, levels, summaries, interpretations.map((item) => ({ element_name: elements.find((element) => element.id === item.element_id)?.name || 'Unknown', text: item.text })), creations.map((item) => ({ creation_type: item.creation_type, description: item.description }))), '', { user_email: user.email, user_id: user.id, tool_id: 'game_master' });
  const [visit] = await insertRows('game_visits', { session_id: session.id, visitor_email: user.email, visitor_name: user.user_metadata?.full_name || user.email, ai_tour_log: tour, visited_at: new Date().toISOString(), created_by_id: user.id });
  return { visit, tour };
}

export async function gameEvaluateCreation(payload, user) {
  const { session_id, ai_request_id, element_id, element_b_id, creation_type, media_url, model_url, description, position, rotation } = payload;
  if (!session_id || !ai_request_id || !element_id || !element_b_id || !creation_type) { const error = new Error('session_id, ai_request_id, element_id, element_b_id, creation_type required'); error.status = 400; throw error; }
  const session = await one('game_sessions', session_id); requireOwner(session, user);
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'game_master' };
  const [elementA, elementB, request, theme] = await Promise.all([one('game_elements', element_id), one('game_elements', element_b_id), one('game_ai_requests', ai_request_id), one('game_themes', session.theme_id)]);
  if (!elementA || !elementB || !request) { const error = new Error('Élément ou demande introuvable'); error.status = 404; throw error; }
  const interpretation = await one('game_interpretations', request.interpretation_id);
  const [creation] = await insertRows('game_creations', { session_id, level_id: elementA.level_id, ai_request_id, element_id, player_email: user.email, creation_type, media_url: media_url || null, model_url: model_url || null, description: description || '', position: position || { x: 0, y: 0, z: 0 }, rotation: rotation || 0, created_at: new Date().toISOString(), created_by_id: user.id });
  const [elements, connections] = await Promise.all([readRows('game_elements', { filters: { session_id, level_id: elementA.level_id }, limit: 500 }), readRows('game_connections', { filters: { session_id, level_id: elementA.level_id }, limit: 500 })]);
  const ai = await invokeJson(buildCreationEvaluationPrompt(theme, elementA, elementB, interpretation, request, creation, elements, connections.map((item) => ({ summary: `${item.element_a_id} ↔ ${item.element_b_id}` }))), buildGameMasterSystemPrompt(theme), tracking);
  await Promise.all([
    updateRow('game_creations', creation.id, { ai_evaluation: ai.evaluation, ai_score: ai.score, points_change: ai.points_change, credits_change: ai.credits_change, is_accepted: true }),
    updateRow('game_ai_requests', request.id, { status: 'evaluated' }),
    updateRow('game_elements', element_id, { is_connected: true }),
    updateRow('game_elements', element_b_id, { is_connected: true }),
  ]);
  await insertRows('game_elements', { session_id, level_id: elementA.level_id, element_type: ['character', 'character_variation'].includes(creation_type) ? 'character' : creation_type, name: description ? description.substring(0, 50) : `Creation ${creation.id.substring(0, 6)}`, description: description || 'Player creation', source_type: 'player_creation', creation_id: creation.id, media_url: media_url || null, model_url: model_url || null, position: position || { x: 0, y: 0, z: 0 }, rotation: rotation || 0, is_connected: false, created_by_id: user.id });
  const [connection] = await insertRows('game_connections', { session_id, level_id: elementA.level_id, element_a_id: element_id, element_b_id, interpretation_id: interpretation.id, creation_id: creation.id, order: connections.length + 1, ai_evaluation: ai.evaluation, points_change: ai.points_change, credits_change: ai.credits_change, is_red_rope: true, created_at: new Date().toISOString(), created_by_id: user.id });
  const newMerit = Number(session.merit_points || 0) + Number(ai.points_change || 0);
  const newCredits = Number(session.credits_earned || 0) + Number(ai.credits_change || 0);
  await updateRow('game_levels', elementA.level_id, { connected_elements: connections.length + 1 });
  const level = await one('game_levels', elementA.level_id);
  const gameLost = Boolean(ai.game_lost || (level && newMerit < level.loss_threshold));
  await updateRow('game_sessions', session_id, { status: gameLost ? 'lost' : session.status, merit_points: newMerit, credits_earned: newCredits, ...(gameLost ? { completed_at: new Date().toISOString() } : {}) });
  if (gameLost) await updateRow('game_levels', elementA.level_id, { status: 'failed' });
  return { creation: { ...creation, ai_evaluation: ai.evaluation, ai_score: ai.score, points_change: ai.points_change, is_accepted: true }, connection, merit_points: newMerit, credits_earned: newCredits, game_lost: gameLost };
}
