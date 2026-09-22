import { runCrud } from '../_lib/crud.js';
import { handleError, methodNotAllowed, sendJson } from '../_lib/http.js';
import { ENTITY_TABLES, PUBLIC_READ_TABLES } from '../_lib/registry.js';
import { getRequestUser, readRows, requireAdmin, requireUser } from '../_lib/supabase.js';

const MEMBER_WRITE_TABLES = new Set([
  'campaigns', 'chat_messages', 'magazine_pages', 'member_posts', 'member_profiles',
  'post_comments', 'post_likes', 'private_messages', 'campaign_subscriptions',
  'character_sheets', 'memberships', 'profile_sponsors', 'promo_message_requests',
  'set_assets', 'story_blocks', 'story_sessions', 'user_timelines', 'vault_assets',
  'vault_folders',
]);

const GUEST_WRITE_TABLES = new Set(['temporary_users', 'profile_fan_subscriptions', 'contact_messages']);

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response);
  try {
    const entity = Array.isArray(request.query.entity) ? request.query.entity[0] : request.query.entity;
    const table = ENTITY_TABLES[entity];
    if (!table) { const error = new Error(`Entité non transférée: ${entity}`); error.status = 501; throw error; }

    const operation = request.body?.operation || 'list';
    const isRead = ['list', 'filter', 'get'].includes(operation);
    const user = await getRequestUser(request);
    if (isRead) {
      if (table === 'dossier_pages') {
        if (user?.app_metadata?.role !== 'admin') {
          requireUser(user);
          const memberships = await readRows('memberships', {
            filters: { user_email: user.email, status: 'approved' },
            limit: 1,
          });
          if (!memberships.length) {
            const error = new Error('Contenu réservé aux membres');
            error.status = 403;
            throw error;
          }
        }
      } else if (!PUBLIC_READ_TABLES.has(table)) requireUser(user);
    } else if (GUEST_WRITE_TABLES.has(table)) {
      // Ces flux utilisent leur propre identifiant de session ou courriel.
    } else if (MEMBER_WRITE_TABLES.has(table)) requireUser(user);
    else requireAdmin(user);

    const result = await runCrud(table, request.body, user);
    if (operation === 'get') return sendJson(response, 200, result.item);
    if (operation === 'list' || operation === 'filter') return sendJson(response, 200, result.items);
    if (operation === 'create' || operation === 'update') return sendJson(response, 200, result.item);
    if (operation === 'bulkCreate') return sendJson(response, 200, result.items);
    return sendJson(response, 200, result);
  } catch (error) {
    return handleError(response, error);
  }
}
