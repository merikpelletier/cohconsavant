import { deleteRow, insertRows, readRows, updateRow } from './supabase.js';

export async function runCrud(table, payload, user) {
  const { action = 'list', operation = action, filters, sort, limit, skip, id } = payload || {};
  const op = operation === 'save' ? (id ? 'update' : 'create') : operation;

  if (op === 'listActive') {
    return { items: await readRows(table, { filters: { is_active: true }, sort: sort || 'order', limit, skip }) };
  }
  if (op === 'listActiveByTheme') {
    const defaultSort = table === 'quiz_questions' ? 'created_date' : 'order';
    return { items: await readRows(table, { filters: { theme_id: payload.theme_id, is_active: true }, sort: sort || defaultSort, limit, skip }) };
  }
  if (op === 'listByTheme' || op === 'listAllByTheme') {
    const themeFilters = { theme_id: payload.theme_id };
    if (table === 'personality_questions' && op === 'listByTheme') themeFilters.is_active = true;
    return { items: await readRows(table, { filters: themeFilters, sort: sort || 'order', limit: limit || (op === 'listAllByTheme' ? 500 : undefined), skip }) };
  }
  if (op === 'listByUser') {
    return { items: await readRows(table, { filters: { user_email: payload.user_email || user?.email }, sort: sort || 'order', limit, skip }) };
  }
  if (op === 'getByEpisodePage') {
    const [item] = await readRows(table, { filters: { episode_page_id: payload.episode_page_id }, limit: 1 });
    return { item: item || null };
  }
  if (op === 'getByKey') {
    const [item] = await readRows(table, { filters: { key: payload.key }, limit: 1 });
    return { item: item || null };
  }
  if (op === 'markRead') {
    const [item] = await updateRow(table, id, { read: true });
    return { item: item || null };
  }

  if (op === 'list' || op === 'filter') {
    const items = await readRows(table, { filters: filters || {}, sort, limit, skip });
    return { items };
  }
  if (op === 'get') {
    const [item] = await readRows(table, { id, limit: 1 });
    if (!item) { const error = new Error('Élément introuvable'); error.status = 404; throw error; }
    return { item };
  }
  if (op === 'create') {
    const data = payload.data || Object.fromEntries(Object.entries(payload).filter(([key]) => !['action', 'operation', 'id'].includes(key)));
    const [item] = await insertRows(table, { ...data, created_by_id: data.created_by_id || user?.id || null });
    return { item };
  }
  if (op === 'bulkCreate') {
    const items = await insertRows(table, (payload.items || []).map((item) => ({ ...item, created_by_id: item.created_by_id || user?.id || null })));
    return { items };
  }
  if (op === 'update') {
    const data = payload.data || Object.fromEntries(Object.entries(payload).filter(([key]) => !['action', 'operation', 'id'].includes(key)));
    const [item] = await updateRow(table, id, data);
    return { item };
  }
  if (op === 'delete') return deleteRow(table, id);
  const error = new Error(`Opération non prise en charge: ${op}`);
  error.status = 400;
  throw error;
}
