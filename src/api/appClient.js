import { confirmAIQuote } from './aiQuoteDialog';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SESSION_KEY = 'cochon_savant_session';

const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
};

const currentReturnPath = () => {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const decodeResponse = async (response) => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error_description || data?.message || data?.error || `Erreur ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

const apiRequest = async (path, options = {}) => {
  const session = readSession();
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const response = await fetch(path, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return decodeResponse(response);
};

const supabaseAuthRequest = async (path, options = {}) => {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Configuration Supabase publique manquante');
  const headers = new Headers(options.headers || {});
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, { ...options, headers });
  return decodeResponse(response);
};

const normalizeUser = (user) => user ? ({
  ...user,
  role: user.app_metadata?.role || 'user',
  full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
}) : null;

const refreshSession = async () => {
  const current = readSession();
  if (!current?.refresh_token) {
    const error = new Error('Votre session a expiré. Reconnectez-vous.');
    error.status = 401;
    throw error;
  }
  const session = await supabaseAuthRequest('/token?grant_type=refresh_token', {
    method: 'POST', body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  saveSession(session);
  return session;
};

const auth = {
  async signUp(email, password, displayName) {
    const redirectTo = typeof window === 'undefined' ? undefined : `${window.location.origin}/Login?confirmed=1`;
    const path = redirectTo ? `/signup?redirect_to=${encodeURIComponent(redirectTo)}` : '/signup';
    const response = await supabaseAuthRequest(path, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        data: { display_name: displayName },
      }),
    });
    if (response?.access_token) saveSession(response);
    return {
      user: normalizeUser(response?.user),
      requiresConfirmation: !response?.access_token,
    };
  },
  async signIn(email, password) {
    const session = await supabaseAuthRequest('/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    saveSession(session);
    return normalizeUser(session.user);
  },
  async me() {
    let session = readSession();
    if (!session?.access_token) {
      const error = new Error('Authentification requise');
      error.status = 401;
      throw error;
    }
    try {
      const user = await supabaseAuthRequest('/user', { headers: { Authorization: `Bearer ${session.access_token}` } });
      return normalizeUser(user);
    } catch (error) {
      if (error.status !== 401 || !session.refresh_token) throw error;
      session = await refreshSession();
      const user = await supabaseAuthRequest('/user', { headers: { Authorization: `Bearer ${session.access_token}` } });
      return normalizeUser(user);
    }
  },
  async isAuthenticated() {
    try { await this.me(); return true; } catch { return false; }
  },
  async logout(redirectTo) {
    const session = readSession();
    try {
      if (session?.access_token) {
        await supabaseAuthRequest('/logout?scope=local', {
          method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    } finally {
      saveSession(null);
      if (redirectTo && typeof window !== 'undefined') window.location.assign('/');
    }
  },
  redirectToLogin(returnTo) {
    if (typeof window === 'undefined') return;
    const requested = returnTo || currentReturnPath();
    let safeReturnTo = currentReturnPath();
    try {
      const parsed = new URL(requested, window.location.origin);
      if (parsed.origin === window.location.origin) safeReturnTo = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      safeReturnTo = currentReturnPath();
    }
    sessionStorage.setItem('cochon_savant_return_to', safeReturnTo);
    window.location.assign('/Login');
  },
};

const entityClient = (entity) => ({
  list: (sort, limit, skip) => apiRequest(`/api/entities/${entity}`, { method: 'POST', body: { operation: 'list', sort, limit, skip } }),
  filter: (filters, sort, limit, skip) => apiRequest(`/api/entities/${entity}`, { method: 'POST', body: { operation: 'filter', filters, sort, limit, skip } }),
  get: (id) => apiRequest(`/api/entities/${entity}`, { method: 'POST', body: { operation: 'get', id } }),
  create: (data) => apiRequest(`/api/entities/${entity}`, { method: 'POST', body: { operation: 'create', data } }),
  bulkCreate: (items) => apiRequest(`/api/entities/${entity}`, { method: 'POST', body: { operation: 'bulkCreate', items } }),
  update: (id, data) => apiRequest(`/api/entities/${entity}`, { method: 'POST', body: { operation: 'update', id, data } }),
  delete: (id) => apiRequest(`/api/entities/${entity}`, { method: 'POST', body: { operation: 'delete', id } }),
});

const entities = new Proxy({}, { get: (_, entity) => entityClient(String(entity)) });

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const uploadFile = async ({ file }) => apiRequest('/api/upload', {
  method: 'POST',
  body: {
    name: file.name || 'fichier',
    type: file.type || 'application/octet-stream',
    content: await fileToBase64(file),
  },
});

const uploadDigitalFile = async ({ file, folder = 'products' }) => {
  const target = await apiRequest('/api/functions/createDigitalUpload', {
    method: 'POST',
    body: { name: file.name || 'fichier', type: file.type || 'application/octet-stream', folder },
  });
  const response = await fetch(target.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'cache-control': 'max-age=3600',
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Téléversement impossible (${response.status})`);
  }
  return target;
};

const quotedFunctions = new Set(['replicateGenerate', 'generateCharacterSheet', 'generateVideo', 'mixAudioVideo', 'generateImage', 'generateSpeech', 'transcribeAudio', 'sendMemberContact']);
const pendingQuotes = new Map();
const invokeQuoted = (name, payload) => {
  // One click sequence per identical request; never silently retry a paid operation.
  const input = JSON.parse(JSON.stringify(payload));
  const key = JSON.stringify([readSession()?.user?.id, name, input]);
  if (pendingQuotes.has(key)) return pendingQuotes.get(key);
  const request = (async () => {
    const quote = await apiRequest('/api/functions/getAIQuote', { method: 'POST', body: { function_name: name, input } });
    if (!await confirmAIQuote(quote)) throw new Error('Génération annulée ou devis expiré. Aucun jeton débité.');
    return { data: await apiRequest('/api/functions/' + encodeURIComponent(name), { method: 'POST', body: { ...input, _ai_quote_id: quote.id } }) };
  })().finally(() => pendingQuotes.delete(key));
  pendingQuotes.set(key, request);
  return request;
};

const invoke = async (name, payload = {}) => {
  if (name === 'uploadMemberImage' && payload.file instanceof File) {
    const data = await apiRequest('/api/upload', {
      method: 'POST', body: { name: payload.file.name, type: payload.file.type, folder: payload.folder, content: await fileToBase64(payload.file) },
    });
    return { data: { url: data.file_url } };
  }
  if (quotedFunctions.has(name) && readSession()?.user?.app_metadata?.role !== 'admin') return invokeQuoted(name, payload);
  return { data: await apiRequest(`/api/functions/${encodeURIComponent(name)}`, { method: 'POST', body: payload }) };
};

const core = {
  UploadFile: uploadFile,
  UploadDigitalFile: uploadDigitalFile,
  GenerateImage: (payload) => invoke('generateImage', payload).then((r) => r.data),
  GenerateSpeech: (payload) => invoke('generateSpeech', payload).then((r) => r.data),
  GenerateVideo: (payload) => invoke('generateVideo', payload).then((r) => r.data),
  InvokeLLM: (payload) => invoke('invokeLLM', payload).then((r) => r.data),
  SendEmail: (payload) => invoke('sendEmail', payload).then((r) => r.data),
  TranscribeAudio: (payload) => invoke('transcribeAudio', payload).then((r) => r.data),
};

const agentSubscribers = new Map();
const notifyAgentSubscribers = (conversation) => {
  for (const callback of agentSubscribers.get(conversation.id) || []) callback(conversation);
};

export const appClient = {
  auth,
  entities,
  functions: { invoke },
  integrations: { Core: core },
  agents: {
    listConversations: (payload) => apiRequest('/api/agents/list', { method: 'POST', body: payload }),
    createConversation: (payload) => apiRequest('/api/agents/create', { method: 'POST', body: payload }),
    addMessage: async (conversation, message) => {
      const updated = await apiRequest('/api/agents/message', { method: 'POST', body: { conversation, message } });
      notifyAgentSubscribers(updated);
      return updated;
    },
    subscribeToConversation: (id, callback) => {
      const callbacks = agentSubscribers.get(id) || new Set();
      callbacks.add(callback);
      agentSubscribers.set(id, callbacks);
      return () => { callbacks.delete(callback); if (!callbacks.size) agentSubscribers.delete(id); };
    },
  },
  appLogs: { logUserInApp: async () => undefined },
};
