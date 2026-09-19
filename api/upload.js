import { handleError, methodNotAllowed, sendJson } from './_lib/http.js';
import { getRequestUser, requireUser, supabaseRequest } from './_lib/supabase.js';

const safeName = (name) => String(name || 'fichier').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120);

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response);
  try {
    const user = requireUser(await getRequestUser(request));
    const { name, type, content, folder } = request.body || {};
    if (!content) { const error = new Error('Fichier manquant'); error.status = 400; throw error; }
    const bucket = String(type || '').startsWith('audio/') ? 'quiz-audio' : 'member-images';
    const prefix = safeName(folder || user.id);
    const objectName = `${prefix}/${crypto.randomUUID()}-${safeName(name)}`;
    await supabaseRequest(`/storage/v1/object/${bucket}/${objectName}`, {
      method: 'POST',
      headers: { 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'false' },
      body: Buffer.from(content, 'base64'),
    });
    const projectUrl = process.env.SUPABASE_URL;
    return sendJson(response, 200, { file_url: `${projectUrl}/storage/v1/object/public/${bucket}/${objectName}`, bucket, path: objectName });
  } catch (error) {
    return handleError(response, error);
  }
}
