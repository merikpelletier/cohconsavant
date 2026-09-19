import { readRows } from './supabase.js';
import { predictionOutput, startModelPrediction } from './replicate.js';
import { chargeTokens, tokenContext } from './tokens.js';

export async function getMemberDossiers(memberEmail) {
  if (!memberEmail) { const error = new Error('Missing memberEmail'); error.status = 400; throw error; }
  let dossiers = await readRows('dossiers', { filters: { submitted_by_email: memberEmail, status: 'published' }, sort: 'order', limit: 500 });
  if (!dossiers.length) dossiers = (await readRows('dossiers', { filters: { status: 'published' }, sort: 'order', limit: 500 })).filter((item) => item.author_name === memberEmail || item.created_by === memberEmail);
  return { dossiers };
}

export async function getMemberMessages(memberEmail) {
  if (!memberEmail) { const error = new Error('Missing memberEmail'); error.status = 400; throw error; }
  const { dossiers } = await getMemberDossiers(memberEmail);
  const dossierMap = Object.fromEntries(dossiers.map((item) => [item.id, item.title]));
  const receivedDossier = [];
  for (const dossier of dossiers) {
    const comments = await readRows('dossier_comments', { filters: { dossier_id: dossier.id }, limit: 500 });
    receivedDossier.push(...comments.filter((item) => item.user_email !== memberEmail).map((item) => ({ ...item, source_type: 'dossier', source_title: dossier.title, source_id: dossier.id, date: item.created_date })));
  }
  const sentDossier = (await readRows('dossier_comments', { filters: { user_email: memberEmail }, limit: 500 })).map((item) => ({ ...item, source_type: 'dossier', source_title: dossierMap[item.dossier_id] || 'Dossier', source_id: item.dossier_id, date: item.created_date }));
  const posts = await readRows('member_posts', { filters: { member_email: memberEmail }, sort: '-created_date', limit: 500 });
  const postMap = Object.fromEntries(posts.map((item) => [item.id, item.title]));
  const receivedPost = [];
  for (const post of posts) {
    const comments = await readRows('post_comments', { filters: { post_id: post.id }, limit: 500 });
    receivedPost.push(...comments.filter((item) => item.author_email !== memberEmail).map((item) => ({ ...item, source_type: 'post', source_title: post.title, source_id: post.id, date: item.created_date })));
  }
  const sentPost = (await readRows('post_comments', { filters: { author_email: memberEmail }, limit: 500 })).map((item) => ({ ...item, source_type: 'post', source_title: postMap[item.post_id] || 'Post', source_id: item.post_id, date: item.created_date }));
  const received = [...receivedDossier, ...receivedPost].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const sent = [...sentDossier, ...sentPost].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return { received, sent, unreadCount: received.filter((item) => !item.read && item.status !== 'read').length };
}

export async function getStorySetup(user) {
  const [themes, characters, sets, topics, pricing] = await Promise.all([
    readRows('story_themes', { filters: { is_active: true }, sort: 'order', limit: 50 }),
    readRows('story_characters', { filters: { is_active: true }, limit: 500 }),
    readRows('story_sets', { limit: 500 }),
    readRows('starting_topics', { sort: 'order', limit: 50 }),
    readRows('tool_pricings', { filters: { tool_id: 'story_block', is_active: true }, limit: 1 }),
  ]);
  const linked = new Set(themes.flatMap((theme) => theme.story_character_ids || []));
  return { themes, characters: characters.filter((item) => linked.has(item.id) || item.created_by_id === user.id), sets, topics, token_cost: pricing[0]?.token_cost ?? 10 };
}

export async function getUserStorySessions(themeId, user) {
  if (!themeId) { const error = new Error('theme_id required'); error.status = 400; throw error; }
  return { sessions: await readRows('story_sessions', { filters: { theme_id: themeId, user_email: user.email, status: 'active' }, sort: '-created_date', limit: 50 }) };
}

export async function sendMemberContact(payload, user) {
  if (!payload.message || !payload.memberName) { const error = new Error('Missing required fields'); error.status = 400; throw error; }
  const context = await tokenContext(user, 'fake_member_chat', 5);
  const persona = payload.persona || {};
  const displayName = persona.display_name || payload.memberName;
  const system = `You are ${displayName}${persona.title ? `, a ${persona.title}` : ''}.${persona.bio ? ` Your bio: ${persona.bio}` : ''}${persona.ai_instructions ? ` Personality instructions from the admin (follow these strictly): ${persona.ai_instructions}` : ''} You are replying to messages from someone who contacted you through the Le Cochon Savant platform. Stay in character at all times. Be natural, warm, playful, and authentic. Keep replies brief (1-3 sentences). Reply in the same language as the user's message. Never mention that you are an AI, a bot, or fake. Never use markdown formatting.`;
  const history = (payload.conversationHistory || []).map((message) => `${message.role === 'user' ? 'Them' : displayName}: ${message.content}`).join('\n');
  const prompt = `${system}\n\n${history ? `Conversation so far:\n${history}\n\n` : ''}Their new message: ${payload.message}\n\nYour reply:`;
  const tracking = { user_email: user.email, user_id: user.id, tool_id: 'fake_member_chat', tokens_charged: context.admin ? 0 : context.cost };
  const output = await predictionOutput(await startModelPrediction('deepseek-ai/deepseek-v3', { prompt, max_tokens: 512, temperature: 0.7 }, tracking), tracking);
  const reply = (Array.isArray(output) ? output.join('') : String(output || '')).trim();
  const balanceAfter = await chargeTokens(user, context, 'fake_member_chat');
  return { reply, balance_after: balanceAfter, token_cost: context.admin ? 0 : context.cost };
}

export async function proxyImage(url) {
  if (!url) { const error = new Error('Invalid URL'); error.status = 400; throw error; }
  const parsed = new URL(url);
  const allowed = parsed.protocol === 'https:' && (parsed.hostname.endsWith('.supabase.co') || parsed.hostname === 'store.dreamlove.es' || parsed.hostname.endsWith('.base44.app'));
  if (!allowed) { const error = new Error('Invalid URL'); error.status = 400; throw error; }
  const response = await fetch(url);
  if (!response.ok) { const error = new Error(`Image inaccessible (${response.status})`); error.status = 502; throw error; }
  const type = response.headers.get('content-type') || 'image/jpeg';
  return { dataUrl: `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}` };
}
