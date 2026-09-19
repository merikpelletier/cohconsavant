const url = () => process.env.SUPABASE_URL;
const secret = () => process.env.SUPABASE_SECRET_KEY;
const publishable = () => process.env.SUPABASE_PUBLISHABLE_KEY;

function requireValue(value, name) {
  if (!value) {
    const error = new Error(`Variable serveur manquante: ${name}`);
    error.status = 500;
    throw error;
  }
  return value;
}

export async function supabaseRequest(path, options = {}) {
  const projectUrl = requireValue(url(), 'SUPABASE_URL');
  const serverKey = requireValue(secret(), 'SUPABASE_SECRET_KEY');
  const headers = new Headers(options.headers || {});
  headers.set('apikey', serverKey);
  if (options.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${projectUrl}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.error_description || data?.error || `Supabase ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export async function getRequestUser(request) {
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const projectUrl = requireValue(url(), 'SUPABASE_URL');
  const apiKey = requireValue(publishable(), 'SUPABASE_PUBLISHABLE_KEY');
  const response = await fetch(`${projectUrl}/auth/v1/user`, {
    headers: { apikey: apiKey, Authorization: authorization },
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) {
    const error = new Error('Validation de session impossible');
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function requireUser(user) {
  if (!user) {
    const error = new Error('Authentification requise');
    error.status = 401;
    throw error;
  }
  return user;
}

export function requireAdmin(user) {
  requireUser(user);
  if (user.app_metadata?.role !== 'admin') {
    const error = new Error('Accès administrateur requis');
    error.status = 403;
    throw error;
  }
  return user;
}

const cleanDirection = (sort) => {
  if (!sort || typeof sort !== 'string') return null;
  const descending = sort.startsWith('-');
  const column = sort.replace(/^-/, '');
  if (!/^[a-zA-Z0-9_]+$/.test(column)) return null;
  return `${column}.${descending ? 'desc' : 'asc'}`;
};

export function buildSelectPath(table, { filters = {}, sort, limit, skip, id } = {}) {
  const params = new URLSearchParams({ select: '*' });
  if (id) params.set('id', `eq.${id}`);
  for (const [key, value] of Object.entries(filters || {})) {
    if (/^[a-zA-Z0-9_]+$/.test(key) && value !== undefined && value !== null) params.set(key, `eq.${value}`);
  }
  const order = cleanDirection(sort);
  if (order) params.set('order', order);
  if (Number.isFinite(Number(limit))) params.set('limit', String(Math.max(1, Math.min(500, Number(limit)))));
  if (Number.isFinite(Number(skip)) && Number(skip) > 0) params.set('offset', String(Number(skip)));
  return `/rest/v1/${table}?${params}`;
}

export async function readRows(table, options = {}) {
  return supabaseRequest(buildSelectPath(table, options));
}

export async function insertRows(table, rows) {
  return supabaseRequest(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
}

export async function updateRow(table, id, data) {
  return supabaseRequest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ ...data, updated_date: new Date().toISOString() }),
  });
}

export async function deleteRow(table, id) {
  await supabaseRequest(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return { success: true };
}
