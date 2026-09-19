import assistant from '../_lib/production_assistant.json' with { type: 'json' };
import { handleError, methodNotAllowed, sendJson } from '../_lib/http.js';
import { getRequestUser, insertRows, readRows, requireUser, updateRow } from '../_lib/supabase.js';
import { invokeText } from '../_lib/llm.js';

function fail(message, status) { const error = new Error(message); error.status = status; throw error; }

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response);
  try {
    const user = requireUser(await getRequestUser(request));
    const action = Array.isArray(request.query.action) ? request.query.action[0] : request.query.action;
    const payload = request.body || {};
    if (action === 'list') {
      const items = await readRows('agent_conversations', { filters: { user_email: user.email, agent_name: payload.agent_name || 'production_assistant' }, sort: '-updated_date', limit: 20 });
      return sendJson(response, 200, items);
    }
    if (action === 'create') {
      const [conversation] = await insertRows('agent_conversations', {
        user_email: user.email,
        agent_name: payload.agent_name || 'production_assistant',
        metadata: payload.metadata || {},
        messages: [],
        created_by_id: user.id,
      });
      return sendJson(response, 200, conversation);
    }
    if (action === 'message') {
      const conversationId = payload.conversation?.id || payload.conversation;
      if (!conversationId) fail('conversation required', 400);
      const [conversation] = await readRows('agent_conversations', { id: conversationId, limit: 1 });
      if (!conversation) fail('Conversation not found', 404);
      if (conversation.user_email !== user.email) fail('Not your conversation', 403);
      const userMessage = payload.message || {};
      if (userMessage.role !== 'user' || !userMessage.content?.trim()) fail('User message required', 400);
      const history = [...(conversation.messages || []), { role: 'user', content: userMessage.content.trim(), created_date: new Date().toISOString() }];
      const knowledge = await readRows('knowledge_entries', { limit: 30 }).catch(() => []);
      const prompt = `${history.slice(-12).map((message) => `${message.role}: ${message.content}`).join('\n')}\n\nKnowledge base:\n${knowledge.map((entry) => `${entry.title || ''}: ${entry.content || entry.description || ''}`).join('\n').slice(0, 12000)}\n\nassistant:`;
      const content = await invokeText(prompt, assistant.instructions, { user_email: user.email, user_id: user.id, tool_id: 'production_assistant' });
      const messages = [...history, { role: 'assistant', content, created_date: new Date().toISOString() }];
      const [updated] = await updateRow('agent_conversations', conversation.id, { messages });
      return sendJson(response, 200, updated);
    }
    fail(`Unknown agent action: ${action}`, 404);
  } catch (error) {
    return handleError(response, error);
  }
}
