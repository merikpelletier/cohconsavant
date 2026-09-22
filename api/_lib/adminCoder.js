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
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_REPO_TOKEN || null;
  if (write && !token) {
    const error = new Error('GitHub write access is not configured for the coder.');
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
  const writeConfigured = Boolean(process.env.GITHUB_TOKEN || process.env.GITHUB_REPO_TOKEN);
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
  if (instruction.length < 10 || instruction.length > 4000) {
    const error = new Error('Décrivez la modification en 10 à 4 000 caractères.');
    error.status = 400;
    throw error;
  }

  const context = await repoContext(instruction);
  if (!context.files.length) {
    const error = new Error('Aucun fichier source approprié trouvé dans le dépôt.');
    error.status = 400;
    throw error;
  }

  const sourceFiles = context.files.map((file) => file.path);
  const prompt =
    `Current Le Cochon Savant GitHub source files:\n${context.files.map((file) => `--- ${file.path}\n${file.content}`).join('\n\n')}\n\n` +
    `Requested change:\n${instruction}\n\n` +
    'Return only JSON with this exact shape: {"title":"short title","summary":"what changes and why","warnings":[],"files":["only changed files from the supplied source files"],"patch":"concise human-readable review diff","file_changes":[{"path":"one exact supplied source path","replacements":[{"find":"exact existing source text occurring once","replace":"complete replacement text"}]}]}. Use file_changes for real source-code changes. Every find value must be copied exactly from the supplied current source and occur exactly once. Keep the change minimal. Never invent files, documentation, proposal files, services, secrets, deployment infrastructure, or unrelated product behavior.';

  const tracking = { user_id: user.id, user_email: user.email, tool_id: 'admin_coder', tokens_charged: 0 };
  const output = await predictionOutput(
    await startModelPrediction(MODEL, { prompt, max_tokens: 12000 }, tracking),
    tracking
  );
  const proposal = parseJson(textOutput(output));
  const originals = new Map(context.files.map((file) => [file.path, file]));
  const rawChanges = Array.isArray(proposal.file_changes) ? proposal.file_changes.slice(0, 6) : [];
  const files = [];

  for (const rawChange of rawChanges) {
    const path = String(rawChange?.path || '');
    const original = originals.get(path);
    if (!original || !sourceFiles.includes(path)) continue;
    const replacements = Array.isArray(rawChange?.replacements) ? rawChange.replacements.slice(0, 20) : [];
    if (!replacements.length) continue;

    let nextContent = original.content;
    const safeReplacements = [];
    let valid = true;

    for (const rawReplacement of replacements) {
      const find = typeof rawReplacement?.find === 'string' ? rawReplacement.find : '';
      const replace = typeof rawReplacement?.replace === 'string' ? rawReplacement.replace : '';
      if (!find || find.length > 30000 || replace.length > 30000) { valid = false; break; }
      const matches = nextContent.split(find).length - 1;
      if (matches !== 1) { valid = false; break; }
      nextContent = nextContent.replace(find, replace);
      safeReplacements.push({ find, replace });
    }

    if (!valid || nextContent === original.content || nextContent.length > 120000) continue;
    files.push({
      path,
      reason: String(rawChange?.reason || proposal.summary || ''),
      replacements: safeReplacements,
      content: nextContent,
      original_sha: original.sha,
      original_content: original.content,
    });
  }

  if (!files.length) {
    const error = new Error('Le coder n’a produit aucun changement de code applicable.');
    error.status = 422;
    throw error;
  }

  const [row] = await insertRows('admin_code_proposals', {
    created_by_id: user.id,
    created_by_email: user.email,
    instruction,
    model_key: MODEL,
    repository: REPO,
    base_branch: DEFAULT_BRANCH,
    base_commit_sha: context.head,
    summary: String(proposal.summary || proposal.title || 'Proposition de modification'),
    warnings: Array.isArray(proposal.warnings) ? proposal.warnings : [],
    files,
    status: 'proposed',
  });
  return { proposal: row };
}

async function createReviewedCommit(files, title) {
  const reference = await github(`/git/ref/heads/${encodeURIComponent(DEFAULT_BRANCH)}`);
  const parentSha = String(reference?.object?.sha || '');
  if (!parentSha) {
    const error = new Error('GitHub main branch is unavailable.');
    error.status = 502;
    throw error;
  }

  const parent = await github(`/git/commits/${parentSha}`);
  const baseTree = String(parent?.tree?.sha || '');
  if (!baseTree) {
    const error = new Error('GitHub source tree is unavailable.');
    error.status = 502;
    throw error;
  }

  const tree = [];
  for (const file of files) {
    const current = await github(`/contents/${file.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(parentSha)}`);
    const source = Buffer.from(current.content || '', 'base64').toString('utf8');
    let content = source;

    for (const replacement of Array.isArray(file.replacements) ? file.replacements : []) {
      const find = String(replacement?.find || '');
      const replace = String(replacement?.replace || '');
      const matches = find ? content.split(find).length - 1 : 0;
      if (matches !== 1) {
        const error = new Error(`Cannot safely apply ${file.path}: expected one exact match, found ${matches}.`);
        error.status = 409;
        throw error;
      }
      content = content.replace(find, replace);
    }

    if (content === source) {
      const error = new Error(`No source change produced for ${file.path}.`);
      error.status = 409;
      throw error;
    }

    const blob = await github('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content, encoding: 'utf-8' }),
      headers: { 'Content-Type': 'application/json' },
    });
    tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const nextTree = await github('/git/trees', {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTree, tree }),
    headers: { 'Content-Type': 'application/json' },
  });
  const commit = await github('/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message: `Admin coder: ${String(title || 'targeted change').slice(0, 160)}`,
      tree: nextTree.sha,
      parents: [parentSha],
    }),
    headers: { 'Content-Type': 'application/json' },
  });
  await github(`/git/refs/heads/${encodeURIComponent(DEFAULT_BRANCH)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
    headers: { 'Content-Type': 'application/json' },
  });

  return {
    commit_sha: commit.sha,
    commit_url: `https://github.com/${REPO}/commit/${commit.sha}`,
    branch: DEFAULT_BRANCH,
  };
}

export async function applyAdminCodeProposal(payload, user) {
  const [proposal] = await readRows('admin_code_proposals', { id: payload.id, limit: 1 });
  if (!proposal || proposal.status !== 'proposed') {
    const error = new Error('Proposition introuvable ou déjà utilisée.');
    error.status = 409;
    throw error;
  }

  const files = Array.isArray(proposal.files) ? proposal.files.filter((file) =>
    file?.path && Array.isArray(file?.replacements) && file.replacements.length
  ) : [];
  if (!files.length) {
    const error = new Error('Cette proposition ne contient aucun changement de code applicable.');
    error.status = 409;
    throw error;
  }

  const result = await createReviewedCommit(files, proposal.summary);
  const [updated] = await updateRow('admin_code_proposals', proposal.id, {
    status: 'applied',
    branch_name: DEFAULT_BRANCH,
    pull_request_url: result.commit_url,
    pull_request_number: null,
    submitted_at: new Date().toISOString(),
    submitted_by_id: user.id,
  });
  return { proposal: updated, github: result };
}

export async function listAdminCodeProposals() {
  return { proposals: await readRows('admin_code_proposals', { sort: '-created_date', limit: 30 }) };
}
