import { checkAuthorizeNetConnection } from '../_lib/authorizeNet.js';
import { checkDreamloveConnection } from '../_lib/supplierStock.js';
import { checkReplicateConnection } from '../_lib/replicate.js';

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  if (process.env.VERCEL_ENV !== 'preview') return response.status(404).json({ error: 'Not found' });

  const checks = {
    replicate: () => checkReplicateConnection(),
    dreamlove: () => checkDreamloveConnection(),
    authorizeNet: () => checkAuthorizeNetConnection(),
  };
  const results = {};
  for (const [name, check] of Object.entries(checks)) {
    try { results[name] = await check(); }
    catch (error) { results[name] = { ok: false, status: error.status || 500, code: error.code || null }; }
  }
  return response.status(200).json({ ok: Object.values(results).every((item) => item.ok), results });
}
