import { deleteRow, insertRows, readRows, updateRow } from './supabase.js';

const isAdmin = (user) => user?.app_metadata?.role === 'admin';

const badRequest = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const getTemporaryUser = async (sessionId) => {
  if (!sessionId || typeof sessionId !== 'string') badRequest('Session de clavardage requise', 401);
  const [temporaryUser] = await readRows('temporary_users', { filters: { session_id: sessionId }, limit: 1 });
  if (!temporaryUser || temporaryUser.expelled) badRequest('Session de clavardage invalide', 403);
  return temporaryUser;
};

const touchTemporaryUser = async (temporaryUser) => {
  await updateRow('temporary_users', temporaryUser.id, {
    is_active: true,
    last_activity: new Date().toISOString(),
  });
};

export async function manageChat(payload, user) {
  const action = payload.action || 'list';
  if (action === 'list' || action === 'filter') {
    return { items: await readRows('chat_messages', { filters: payload.filters || {}, sort: payload.sort, limit: payload.limit, skip: payload.skip }) };
  }

  if (action === 'save' || action === 'create') {
    if (!payload.content?.trim()) badRequest('Message vide');
    if (!['contact', 'commercial', 'cochon'].includes(payload.salon)) badRequest('Salon invalide');

    if (!isAdmin(user)) {
      const temporaryUser = await getTemporaryUser(payload.session_id);
      if (temporaryUser.identifier !== payload.sender_identifier) badRequest('Identité de clavardage invalide', 403);
      if (payload.salon === 'cochon' && !user) badRequest('Connexion membre requise', 401);
      await touchTemporaryUser(temporaryUser);
    }

    const [item] = await insertRows('chat_messages', {
      salon: payload.salon,
      sender_identifier: payload.sender_identifier,
      content: String(payload.content).trim(),
      photo_url: payload.photo_url || null,
      session_id: payload.session_id,
      is_admin: isAdmin(user),
      created_by_id: user?.id || null,
    });
    return { item };
  }

  if (action === 'delete') {
    if (!isAdmin(user)) {
      const [message] = await readRows('chat_messages', { id: payload.id, limit: 1 });
      if (!message || message.session_id !== payload.viewer_session_id) badRequest('Suppression interdite', 403);
      await getTemporaryUser(payload.viewer_session_id);
    }
    return deleteRow('chat_messages', payload.id);
  }

  badRequest('Opération de clavardage non prise en charge');
}

export async function managePrivateChat(payload, user) {
  const action = payload.action || 'filter';

  if (action === 'list' || action === 'filter') {
    if (!isAdmin(user)) {
      const viewerSessionId = payload.viewer_session_id;
      await getTemporaryUser(viewerSessionId);
      const filters = payload.filters || {};
      if (filters.from_session_id !== viewerSessionId && filters.to_session_id !== viewerSessionId) {
        badRequest('Lecture de conversation interdite', 403);
      }
    }
    return { items: await readRows('private_messages', { filters: payload.filters || {}, sort: payload.sort, limit: payload.limit, skip: payload.skip }) };
  }

  if (action === 'save' || action === 'create') {
    if (!payload.content?.trim()) badRequest('Message vide');
    if (!isAdmin(user)) {
      const sender = await getTemporaryUser(payload.from_session_id);
      if (sender.identifier !== payload.from_identifier) badRequest('Identité d’expéditeur invalide', 403);
      await getTemporaryUser(payload.to_session_id);
      await touchTemporaryUser(sender);
    }
    const [item] = await insertRows('private_messages', {
      from_identifier: payload.from_identifier,
      to_identifier: payload.to_identifier,
      from_session_id: payload.from_session_id,
      to_session_id: payload.to_session_id,
      content: String(payload.content).trim(),
      photo_url: payload.photo_url || null,
      read: false,
      from_is_member: Boolean(payload.from_is_member),
      to_is_member: Boolean(payload.to_is_member),
      created_by_id: user?.id || null,
    });
    return { item };
  }

  if (action === 'markRead') {
    const [message] = await readRows('private_messages', { id: payload.id, limit: 1 });
    if (!message) badRequest('Message introuvable', 404);
    if (!isAdmin(user) && message.to_session_id !== payload.viewer_session_id) badRequest('Modification interdite', 403);
    if (!isAdmin(user)) await getTemporaryUser(payload.viewer_session_id);
    const [item] = await updateRow('private_messages', payload.id, { read: true });
    return { item };
  }

  if (action === 'delete') {
    if (!isAdmin(user)) {
      const [message] = await readRows('private_messages', { id: payload.id, limit: 1 });
      if (!message || ![message.from_session_id, message.to_session_id].includes(payload.viewer_session_id)) badRequest('Suppression interdite', 403);
      await getTemporaryUser(payload.viewer_session_id);
    }
    return deleteRow('private_messages', payload.id);
  }

  badRequest('Opération de message privé non prise en charge');
}
