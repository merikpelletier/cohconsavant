import { supabaseRequest } from './supabase.js';

const bucketName = () => process.env.SUPABASE_DIGITAL_BUCKET || 'digital-downloads';

const safeName = (name) => String(name || 'fichier')
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(-140) || 'fichier';

const encodeObjectKey = (key) => String(key || '')
  .split('/')
  .filter(Boolean)
  .map(encodeURIComponent)
  .join('/');

async function ensureDigitalBucket() {
  const bucket = bucketName();
  try {
    await supabaseRequest(`/storage/v1/bucket/${encodeURIComponent(bucket)}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    await supabaseRequest('/storage/v1/bucket', {
      method: 'POST',
      body: JSON.stringify({ id: bucket, name: bucket, public: false }),
    });
  }
  return bucket;
}

export async function createDigitalUpload({ name, folder = 'products' } = {}) {
  const bucket = await ensureDigitalBucket();
  const objectKey = `${safeName(folder)}/${crypto.randomUUID()}-${safeName(name)}`;
  const data = await supabaseRequest(`/storage/v1/object/upload/sign/${encodeURIComponent(bucket)}/${encodeObjectKey(objectKey)}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const uploadUrl = data.url.startsWith('http')
    ? data.url
    : `${process.env.SUPABASE_URL}/storage/v1${data.url.startsWith('/') ? '' : '/'}${data.url}`;
  return { object_key: objectKey, upload_url: uploadUrl };
}

export async function createDigitalDownload(objectKey, downloadName, expiresIn = 600) {
  const bucket = bucketName();
  const data = await supabaseRequest(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodeObjectKey(objectKey)}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn }),
  });
  const signedPath = data.signedURL || data.signedUrl;
  if (!signedPath) throw new Error('Supabase n’a retourné aucun lien de téléchargement');
  const absoluteUrl = signedPath.startsWith('http')
    ? signedPath
    : `${process.env.SUPABASE_URL}/storage/v1${signedPath.startsWith('/') ? '' : '/'}${signedPath}`;
  const url = new URL(absoluteUrl);
  url.searchParams.set('download', safeName(downloadName || objectKey.split('/').pop()));
  return url.toString();
}
