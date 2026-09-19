import { supabaseRequest } from './supabase.js';

const extensionFor = (contentType) => ({
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
  'model/gltf-binary': 'glb',
}[contentType] || 'bin');

export async function storeExternalMedia(sourceUrl, prefix = 'media') {
  const mediaResponse = await fetch(sourceUrl);
  if (!mediaResponse.ok) throw new Error(`Téléchargement du média impossible (${mediaResponse.status})`);
  const contentType = mediaResponse.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  const buffer = Buffer.from(await mediaResponse.arrayBuffer());
  return storeMediaBuffer(buffer, contentType, prefix);
}

export async function storeMediaBuffer(buffer, contentType, prefix = 'media') {
  const objectName = `generated/${prefix}-${crypto.randomUUID()}.${extensionFor(contentType)}`;
  await supabaseRequest(`/storage/v1/object/site-media/${objectName}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
    body: buffer,
  });
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/site-media/${objectName}`;
}
