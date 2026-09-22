import { insertRows, readRows, updateRow } from './supabase.js';
import { predictionOutput, startModelPrediction } from './replicate.js';

const MODEL = 'anthropic/claude-sonnet-4.6';
const REPO = process.env.GITHUB_REPOSITORY || 'merikpelletier/cohconsavant';
const DEFAULT_BRANCH = process.env.GITHUB_DEFAULT_BRANCH || 'main';
const allowedPath = (path, { allowPayments = false } = {}) =>
  /^(src|api|docs|public)\/[a-zA-Z0-9_./()[\]-]+\.(js|jsx|ts|tsx|css|json|md|html|svg)$/.test(path)
  && !/(\.env|secret|credential|package-lock)/i.test(path)
  && (allowPayments || !/authorizeNet/i.test(path));

const instructionAllowsPayments = (instruction) =>
  /authorize\.?net|paiement|payment|abonnement|subscription|checkout|billing/i.test(String(instruction || ''));

const explicitPathsFromInstruction = (instruction) =>
  [...String(instruction || '').matchAll(/(?:src|api|docs|public)\/[a-zA-Z0-9_./()[\]-]+\.(?:js|jsx|ts|tsx|css|json|md|html|svg)/g)]
    .map((match) => match[0]);

const instructionRequestsNewFile = (instruction) =>
  /\b(create|add|new|nouveau|nouvelle|cr[eé]er|ajouter)\b[^\n]{0,80}\b(file|fichier|component|composant|page|module)\b/i.test(String(instruction || ''));

const instructionRequestsDocs = (instruction) =>
  /\b(documentation|docs?|markdown|readme|\.md)\b/i.test(String(instruction || ''));

function configuration({ write = false } = {}) {
  const token = process.env.GITHUB_REPO_TOKEN || null;
  if (write && !token) {
    const error = new Error('GITHUB_REPO_TOKEN est requis uniquement pour créer une branche ou une demande de fusion GitHub.');
    error.status = 503;
    throw error;
  }
  return { token, repo: REPO };
}

async function github(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const { token, repo } = configuration({ write: method !== 'GET' && method !== 'HEAD' });
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers,
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
  const allowPayments = instructionAllowsPayments(instruction);
  const explicitPaths = new Set(explicitPathsFromInstruction(instruction));
  const candidates = (tree.tree || []).filter((item) => item.type === 'blob' && item.size <= 60000 && allowedPath(item.path, { allowPayments }));
  const explicitItems = candidates.filter((item) => explicitPaths.has(item.path));
  const rankedItems = candidates
    .filter((item) => !explicitPaths.has(item.path))
    .map((item) => ({ ...item, score: terms.reduce((sum, term) => sum + (item.path.toLowerCase().includes(term) ? 3 : 0), 0)
      + (/src\/pages\/Admin\.jsx|src\/App\.jsx|src\/pages\.config\.js/.test(item.path) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.size - b.size);
  const paths = [...explicitItems, ...rankedItems].slice(0, 12);
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
  const writeConfigured = Boolean(process.env.GITHUB_REPO_TOKEN);
  try {
    const repo = await github('');
    return {
      configured: true,
      proposal_ready: true,
      write_configured: writeConfigured,
      model: MODEL,
      repository: repo.full_name,
      branch: repo.default_branch,
      private: repo.private,
    };
  } catch {
    return {
      configured: false,
      proposal_ready: false,
      write_configured: writeConfigured,
      model: MODEL,
      repository: REPO,
      branch: DEFAULT_BRANCH,
    };
  }
}

export async function proposeAdminCodeChange(payload, user) {
  const instruction = String(payload.instruction || '').trim();
  if (instruction.length < 10 || instruction.length > 4000) { const error = new Error('Décrivez la modification en 10 à 4 000 caractères.'); error.status = 400; throw error; }
  const context = await repoContext(instruction);
  if (!context.files.length) throw new Error('Aucun fichier de code approprié trouvé dans le dépôt.');
  const prompt = `Demande administrateur: ${instruction}\n\nFichiers actuels:\n` + context.files.map((file) => `--- ${file.path}\n${file.content}`).join('\n');
  const system = `Tu es le développeur prudent du site Le Cochon Savant. Ta tâche est de proposer de VRAIES MODIFICATIONS DE CODE, pas un plan ni un document de proposition. Réponds uniquement en JSON valide avec ce format: {"summary":"résumé français","warnings":["..."],"files":[{"path":"...","reason":"...","replacements":[{"search":"texte exact existant","replace":"nouveau texte"}]}]}. Modifie au maximum 6 fichiers. Pour chaque fichier existant, renvoie uniquement de petites opérations de remplacement exactes; ne renvoie jamais le contenu complet du fichier. Chaque "search" doit correspondre exactement à un passage unique du fichier fourni. Utilise en priorité les chemins explicitement nommés par l'administrateur. N'invente jamais un fichier Proposal, Plan, README, documentation ou .md à la place des changements demandés. Ne crée un nouveau fichier que si l'administrateur demande explicitement de créer un nouveau fichier ou composant; dans ce cas seulement, sous src/components/admin, utilise {"path":"...","reason":"...","content":"contenu complet"}. Ne touche jamais aux secrets, paiements, authentification, autorisations ou déploiement sauf demande explicite. Préserve tout le reste. Aucun markdown.`;
  const tracking = { user_id: user.id, user_email: user.email, tool_id: 'admin_coder', tokens_charged: 0 };
  const output = await predictionOutput(await startModelPrediction(MODEL, { prompt, system_prompt: system, max_tokens: 12000 }, tracking), tracking);
  const proposal = parseJson(textOutput(output));
  const originals = new Map(context.files.map((file) => [file.path, file]));
  const allowPayments = instructionAllowsPayments(instruction);
  const explicitPaths = new Set(explicitPathsFromInstruction(instruction));
  const allowNewFile = instructionRequestsNewFile(instruction);
  const allowDocs = instructionRequestsDocs(instruction);
  const files = [];
  for (const file of (proposal.files || []).slice(0, 6)) {
    if (!allowedPath(file.path, { allowPayments })) continue;
    const original = originals.get(file.path);

    if (!original) {
      if (!allowNewFile) continue;
      if (!file.path.startsWith('src/components/admin/') || typeof file.content !== 'string' || file.content.length > 120000) continue;
      if (!allowDocs && /\.(md|txt)$/i.test(file.path)) continue;
      files.push({ path: file.path, content: file.content, reason: String(file.reason || ''), original_sha: null, original_content: '' });
      continue;
    }

    if (!Array.isArray(file.replacements) || !file.replacements.length) continue;
    let nextContent = original.content;
    let valid = true;

    for (const replacement of file.replacements) {
      const search = typeof replacement?.search === 'string' ? replacement.search : '';
      const replace = typeof replacement?.replace === 'string' ? replacement.replace : '';
      if (!search) { valid = false; break; }

      const first = nextContent.indexOf(search);
      if (first < 0 || nextContent.indexOf(search, first + search.length) >= 0) {
        valid = false;
        break;
      }
      nextContent = nextContent.slice(0, first) + replace + nextContent.slice(first + search.length);
    }

    if (!valid || nextContent === original.content || nextContent.length > 120000) continue;
    files.push({
      path: file.path,
      content: nextContent,
      reason: String(file.reason || ''),
      original_sha: original.sha,
      original_content: original.content,
    });
  }
  if (!files.length) {
    const error = new Error('Claude n’a proposé aucun changement de code applicable. Les remplacements doivent correspondre exactement au code actuel.');
    error.status = 422;
    throw error;
  }
  if (explicitPaths.size && !files.some((file) => explicitPaths.has(file.path))) {
    const error = new Error('Claude n’a modifié aucun des fichiers explicitement demandés.');
    error.status = 422;
    throw error;
  }
  if (!allowDocs && files.every((file) => /\.(md|txt)$/i.test(file.path))) {
    const error = new Error('La proposition ne contient que de la documentation au lieu de modifications de code.');
    error.status = 422;
    throw error;
  }
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
