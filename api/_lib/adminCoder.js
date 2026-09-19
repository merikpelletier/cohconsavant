import { insertRows, readRows, updateRow } from './supabase.js';
import { predictionOutput, startModelPrediction } from './replicate.js';

const MODEL = 'anthropic/claude-sonnet-4.6';
const REPO = process.env.GITHUB_REPOSITORY || 'merikpelletier/cohconsavant';
const DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';
const allowedPath = (path) => /^(src|api|docs|public)\/[a-zA-Z0-9_./()[\]-]+\.(js|jsx|ts|tsx|css|json|md|html|svg)$/.test(path)
  && !/(\.env|secret|credential|package-lock|authorizeNet)/i.test(path);

function configuration() {
  if (!process.env.GITHUB_REPO_TOKEN) {
    const error = new Error('Ajoutez GITHUB_REPO_TOKEN aux variables serveur Vercel pour permettre les propositions de code.'); error.status = 503; throw error;
  }
  return { token: process.env.GITHUB_REPO_TOKEN, repo: REPO };
}

async function github(path, options = {}) {
  const { token, repo } = configuration();
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(options.headers || {}) },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) { const error = new Error(data?.message || `GitHub ${response.status}`); error.status = response.status; throw error; }
  return data;
}

const textOutput = (output) => Array.isArray(output) ? output.join('') : String(output || '');
function parseJson(text) {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?/i, '').replace(/\`\`\`$/, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Claude n’a pas retourné une proposition structurée.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function repoContext(instruction) {
  const ref = await github(`/git/ref/heads/${encodeURIComponent(DEFAULT_BRANCH)}`);
  const commit = await github(`/git/commits/${ref.object.sha}`);
  const tree = await github(`/git/trees/${commit.tree.sha}?recursive=1`);
  const terms = instruction.toLowerCase().split(/[^a-z0-9à-ÿ]+/).filter((term) => term.length > 3);
  const paths = (tree.tree || []).filter((item) => item.type === 'blob' && item.size <= 60000 && allowedPath(item.path))
    .map((item) => ({ ...item, score: terms.reduce((sum, term) => sum + (item.path.toLowerCase().includes(term) ? 3 : 0), 0)
      + (/src\/pages\/Admin\.jsx|src\/App\.jsx|src\/pages\.config\.js/.test(item.path) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.size - b.size).slice(0, 12);
  const files = [];
  let total = 0;
  for (const item of paths) {
    const file = await github(`/contents/${item.path}?ref=${encodeURIComponent(DEFAULT_BRANCH)}`);
    const content = Buffer.from(file.content || '', 'base64').toString('utf8');
    if (total + content.length > 180000) continue;
    total += content.length; files.push({ path: item.path, sha: file.sha, content });
  }
  return { head: ref.object.sha, files };
}

export async function getAdminCoderStatus() {
  const configured = Boolean(process.env.GITHUB_REPO_TOKEN);
  if (!configured) return { configured, model: MODEL, repository: REPO, branch: DEFAULT_BRANCH };
  const repo = await github('');
  return { configured, model: MODEL, repository: repo.full_name, branch: repo.default_branch, private: repo.private };
}

export async function proposeAdminCodeChange(payload, user) {
  const instruction = String(payload.instruction || '').trim();
  if (instruction.length < 10 || instruction.length > 4000) { const error = new Error('Décrivez la modification en 10 à 4 000 caractères.'); error.status = 400; throw error; }
  const context = await repoContext(instruction);
  if (!context.files.length) throw new Error('Aucun fichier de code approprié trouvé dans le dépôt.');
  const prompt = `Demande administrateur: ${instruction}\n\nFichiers actuels:\n` + context.files.map((file) => `--- ${file.path}\n${file.content}`).join('\n');
  const system = `Tu es le développeur prudent du site Le Cochon Savant. Réponds uniquement en JSON valide: {"summary":"résumé français","warnings":["..."],"files":[{"path":"...","content":"contenu complet","reason":"..."}]}. Modifie au maximum 6 fichiers. Utilise seulement les chemins fournis ou crée un fichier sous src/components/admin. Ne touche jamais aux secrets, paiements, authentification, autorisations ou déploiement sauf demande explicite. Préserve tout le reste. Aucun markdown.`;
  const tracking = { user_id: user.id, user_email: user.email, tool_id: 'admin_coder', tokens_charged: 0 };
  const output = await predictionOutput(await startModelPrediction(MODEL, { prompt, system_prompt: system, max_tokens: 12000 }, tracking), tracking);
  const proposal = parseJson(textOutput(output));
  const originals = new Map(context.files.map((file) => [file.path, file]));
  const files = (proposal.files || []).filter((file) => {
    if (!allowedPath(file.path) || typeof file.content !== 'string' || file.content.length > 120000) return false;
    const original = originals.get(file.path);
    if (!original && !file.path.startsWith('src/components/admin/')) return false;
    return !original || file.content !== original.content;
  }).slice(0, 6).map((file) => ({ path: file.path, content: file.content, reason: String(file.reason || ''), original_sha: originals.get(file.path)?.sha || null, original_content: originals.get(file.path)?.content || '' }));
  if (!files.length) throw new Error('Claude n’a proposé aucun changement autorisé.');
  const [row] = await insertRows('admin_code_proposals', { created_by_id: user.id, created_by_email: user.email, instruction,
    model_key: MODEL, repository: REPO, base_branch: DEFAULT_BRANCH, base_commit_sha: context.head,
    summary: String(proposal.summary || 'Proposition de modification'), warnings: Array.isArray(proposal.warnings) ? proposal.warnings : [], files, status: 'proposed' });
  return { proposal: row };
}

export async function applyAdminCodeProposal(payload, user) {
  const [proposal] = await readRows('admin_code_proposals', { id: payload.id, limit: 1 });
  if (!proposal || proposal.status !== 'proposed') { const error = new Error('Proposition introuvable ou déjà utilisée.'); error.status = 409; throw error; }
  const branch = `claude/admin-${proposal.id.slice(0, 8)}`;
  await github('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: proposal.base_commit_sha }), headers: { 'Content-Type': 'application/json' } });
  for (const file of proposal.files) {
    await github(`/contents/${file.path}`, { method: 'PUT', body: JSON.stringify({ message: `Claude: ${proposal.summary}`, content: Buffer.from(file.content).toString('base64'), branch, ...(file.original_sha ? { sha: file.original_sha } : {}) }), headers: { 'Content-Type': 'application/json' } });
  }
  const pr = await github('/pulls', { method: 'POST', body: JSON.stringify({ title: proposal.summary, head: branch, base: proposal.base_branch, body: `Proposition créée depuis l’administration.\n\nDemande: ${proposal.instruction}`, draft: true }), headers: { 'Content-Type': 'application/json' } });
  const [updated] = await updateRow('admin_code_proposals', proposal.id, { status: 'submitted', branch_name: branch, pull_request_url: pr.html_url, pull_request_number: pr.number, submitted_at: new Date().toISOString(), submitted_by_id: user.id });
  return { proposal: updated };
}

export async function listAdminCodeProposals() {
  return { proposals: await readRows('admin_code_proposals', { sort: '-created_date', limit: 30 }) };
}
