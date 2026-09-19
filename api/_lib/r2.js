// AWS SigV4 presigned URL generator for Cloudflare R2 (S3-compatible)
// Uses Web Crypto API — no external dependencies

const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(message) {
  const data = encoder.encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(hash));
}

async function hmac(keyBytes, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const data = encoder.encode(message);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

async function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = await hmac(encoder.encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  return kSigning;
}

export async function createR2PresignedUrl(opts) {
  const { endpoint, bucket, accessKeyId, secretAccessKey, objectKey, expiresIn = 600 } = opts;
  const region = 'auto';
  const service = 's3';
  const host = endpoint.replace('https://', '');

  // URI-encode the object key, preserving slashes
  const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const credential = `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };

  const sortedKeys = Object.keys(params).sort();
  const canonicalQuery = sortedKeys
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const canonicalUri = `/${bucket}/${encodedKey}`;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const canonicalRequest = `GET\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(canonicalRequest)}`;

  const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmac(signingKey, stringToSign));

  return `${endpoint}/${bucket}/${encodedKey}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}