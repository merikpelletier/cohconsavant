import orchestrator from './story_orchestrator.json' with { type: 'json' };
import { getPrediction, startModelPrediction } from './replicate.js';
import { parseJsonOutput } from './llm.js';
import { insertRows, readRows, updateRow } from './supabase.js';
import { chargeTokens, tokenContext } from './tokens.js';

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

const one = async (table, id) => (await readRows(table, { id, limit: 1 }))[0] || null;
const referenced = async (table, ids = []) => (await Promise.all(ids.map((id) => one(table, id)))).filter(Boolean);

export async function generateStoryBlock(payload, user) {
  const { session_id: sessionId, is_storyline_switch: isStorylineSwitch = false, override_hero_id: overrideHeroId, override_topic_id: overrideTopicId } = payload;
  if (!sessionId) fail('session_id required', 400);
  const session = await one('story_sessions', sessionId);
  if (!session) fail('Session not found', 404);
  if (session.user_email !== user.email) fail('Not your session', 403);

  const [theme, hero, topic] = await Promise.all([
    one('story_themes', session.theme_id),
    one('story_characters', overrideHeroId || session.hero_story_character_id),
    one('starting_topics', overrideTopicId || session.starting_topic_id),
  ]);
  if (!theme) fail('Theme not found', 404);
  if (!hero) fail('Hero character not found', 404);
  if (!topic) fail('Starting topic not found', 404);
  const tokenTracking = await tokenContext(user, 'story_block', Number(theme.credit_cost_per_block || 10));
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'story_block', tokens_charged: tokenTracking.admin ? 0 : tokenTracking.cost };

  const [sets, characters, blocks] = await Promise.all([
    referenced('story_sets', theme.story_set_ids || []),
    referenced('story_characters', theme.story_character_ids || []),
    readRows('story_blocks', { filters: { session_id: sessionId }, sort: 'order', limit: 50 }),
  ]);
  const blockOrder = blocks.length;
  const lastBlock = blocks[blocks.length - 1] || null;
  const request = {
    theme,
    hero,
    starting_topic: topic,
    story_memory: session.story_memory || {},
    previous_blocks: blocks.map((block) => ({
      order: block.order,
      block_title: block.block_title,
      narrative_summary: block.narrative_summary,
      selected_choice: block.selected_choice,
      choice_options: block.choice_options,
      last_segment: block.segment_instructions?.at?.(-1) || null,
    })),
    selected_previous_choice: lastBlock?.choice_options?.find((choice) => choice.id === lastBlock.selected_choice) || lastBlock?.selected_choice || null,
    supporting_characters: characters,
    available_sets: sets,
    director_note: session.director_note || '',
    arc: { chapters: session.arc_chapter_count || 0, start: session.arc_start || '', middle: session.arc_middle || '', reveal: session.arc_reveal || '' },
    is_storyline_switch: isStorylineSwitch,
  };
  const prediction = await startModelPrediction('meta/meta-llama-3-70b-instruct', {
    prompt: `Create the next Story Block from this complete project data. Return only the required JSON object.\n\n${JSON.stringify(request)}`,
    system_prompt: orchestrator.instructions,
    max_tokens: 8192,
    temperature: 0.7,
  }, tracking);
  const [storyBlock] = await insertRows('story_blocks', {
    session_id: sessionId,
    order: blockOrder,
    video_segments: [],
    choice_options: [],
    selected_choice: null,
    narrative_summary: '',
    segment_instructions: [],
    block_title: `Block ${blockOrder + 1}`,
    selected_characters: [],
    selected_sets: [],
    generation_status: 'planning',
    planning_conversation_id: prediction.id,
    is_storyline_switch: isStorylineSwitch,
    director_note: session.director_note || '',
    created_by_id: user.id,
  });
  if (session.director_note) await updateRow('story_sessions', sessionId, { director_note: '' });
  return { story_block: storyBlock, phase: 'planning_started', next_step: 'poll checkStoryBlockPlan with block_id' };
}

export async function checkStoryBlockPlan(payload, user) {
  const blockId = payload.block_id;
  if (!blockId) fail('block_id required', 400);
  const block = await one('story_blocks', blockId);
  if (!block) fail('Block not found', 404);
  const session = await one('story_sessions', block.session_id);
  if (!session || session.user_email !== user.email) fail('Not your block', 403);

  const hasContent = block.narrative_summary || block.segment_instructions?.length;
  if (block.generation_status === 'failed') return { block_id: block.id, status: 'failed', story_block: block, error: block.last_error || 'Planning failed' };
  if (block.generation_status !== 'planning' && hasContent) return { block_id: block.id, status: block.generation_status, story_block: block };
  if (!block.planning_conversation_id) fail('No planning prediction found', 500);

  const prediction = await getPrediction(block.planning_conversation_id, { user_email: user.email, user_id: user.id, tool_id: 'story_block' });
  if (prediction.status === 'starting' || prediction.status === 'processing') return { block_id: block.id, status: 'planning', message: 'Agent is still writing the story…' };
  if (prediction.status !== 'succeeded') {
    await updateRow('story_blocks', blockId, { generation_status: 'failed', last_error: prediction.error || `Replicate ${prediction.status}` });
    fail(prediction.error || `Planning ${prediction.status}`, 502);
  }

  let plan;
  try { plan = parseJsonOutput(prediction.output); }
  catch { await updateRow('story_blocks', blockId, { generation_status: 'failed', last_error: 'Agent did not return valid JSON' }); fail('Agent did not return valid JSON', 502); }
  if (!Array.isArray(plan.segments) || plan.segments.length === 0) {
    await updateRow('story_blocks', blockId, { generation_status: 'failed', last_error: 'Agent response missing segments' });
    fail('Agent response missing segments', 502);
  }
  const choices = plan.choice_options || [];
  const [updatedBlock] = await updateRow('story_blocks', blockId, {
    choice_options: choices,
    selected_choice: choices[0]?.id || null,
    narrative_summary: plan.narrative_summary || '',
    segment_instructions: plan.segments,
    block_title: plan.block_title || `Block ${Number(block.order) + 1}`,
    selected_characters: plan.selected_characters || [],
    selected_sets: plan.selected_sets || [],
    generation_status: 'pending',
    last_error: null,
  });
  const sessionUpdate = { block_count: Number(session.block_count || 0) + 1 };
  if (!block.is_storyline_switch) sessionUpdate.story_memory = plan.updated_memory || session.story_memory || {};
  await updateRow('story_sessions', session.id, sessionUpdate);
  const theme = await one('story_themes', session.theme_id);
  const context = await tokenContext(user, 'story_block', Number(theme?.credit_cost_per_block || 10));
  const newBalance = await chargeTokens(user, context, `story_block_${blockId}`);
  return { block_id: block.id, status: 'pending', story_block: updatedBlock, balance_after: newBalance, total_segments: plan.segments.length };
}
