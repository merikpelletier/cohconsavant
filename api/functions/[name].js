import { runCrud } from '../_lib/crud.js';
import { handleError, methodNotAllowed, sendJson } from '../_lib/http.js';
import { MANAGER_TABLES, PUBLIC_READ_TABLES } from '../_lib/registry.js';
import { deleteRow, getRequestUser, insertRows, readRows, requireAdmin, requireUser, updateRow } from '../_lib/supabase.js';
import { generateMonthlyQuiz } from '../_lib/monthlyQuiz.js';
import { generateFakeMemberPosts } from '../_lib/fakeMembers.js';
import { syncSupplierStock } from '../_lib/supplierStock.js';
import { getUserBalance, importProducts, purchaseShopProduct } from '../_lib/shop.js';
import { replicateGenerate } from '../_lib/replicateGenerate.js';
import { generateCharacterSheet, generateVideo, mixAudioVideo } from '../_lib/replicateTools.js';
import { createAuthorizeNetCheckout, purchaseTokens } from '../_lib/authorizeNet.js';
import { getMemberDossiers, getMemberMessages, getStorySetup, getUserStorySessions, proxyImage, sendMemberContact } from '../_lib/community.js';
import { getR2DownloadLink, purchaseDossierDigital } from '../_lib/downloads.js';
import { gameCompleteLevel, gameEvaluateCreation, gameEvaluateInterpretation, gameGuidedVisit, gameStartLevel } from '../_lib/game.js';
import { proposeStoryArc, publishEpisode, publishStorySession, regenerateSegment, sendContactMessage } from '../_lib/story.js';
import { generateImage, generateSpeech, invokeLLM, sendEmail, transcribeAudio } from '../_lib/coreIntegrations.js';
import { regenerateNarration } from '../_lib/storyNarration.js';
import { checkStoryBlockPlan, generateStoryBlock } from '../_lib/storyPlanning.js';
import { generateBlockVideos } from '../_lib/storyMedia.js';
import { manageChat, managePrivateChat } from '../_lib/chat.js';
import { createDigitalUpload } from '../_lib/digitalStorage.js';
import { createAIQuote, executeWithAIQuote, QUOTED_FUNCTIONS, DEFERRED_FUNCTIONS } from '../_lib/aiQuotes.js';
import { applyAdminCodeProposal, getAdminCoderStatus, listAdminCodeProposals, proposeAdminCodeChange } from '../_lib/adminCoder.js';

const MEMBER_MANAGERS = new Set([
  'manageCampaign', 'manageChatMessage', 'manageMagazinePage', 'manageMemberPost',
  'manageMemberProfile', 'managePostComment', 'managePostLike', 'managePrivateMessage',
]);

const WRITE_ACTIONS = new Set(['save', 'create', 'update', 'delete', 'bulkCreate']);

async function canReadDossierPages(user) {
  if (user?.app_metadata?.role === 'admin') return true;
  if (!user?.email) return false;
  const memberships = await readRows('memberships', {
    filters: { user_email: user.email, status: 'approved' },
    limit: 1,
  });
  return memberships.length > 0;
}

async function requireDossierPageAccess(user) {
  if (await canReadDossierPages(user)) return;
  const error = new Error('Contenu réservé aux membres');
  error.status = user ? 403 : 401;
  throw error;
}

async function runNamedFunction(name, payload, user, request) {
  if (name === 'getAdminCoderStatus') { requireAdmin(user); return getAdminCoderStatus(); }
  if (name === 'listAdminCodeProposals') { requireAdmin(user); return listAdminCodeProposals(); }
  if (name === 'proposeAdminCodeChange') { requireAdmin(user); return proposeAdminCodeChange(payload, user); }
  if (name === 'applyAdminCodeProposal') { requireAdmin(user); return applyAdminCodeProposal(payload, user); }
  if (name === 'initMonthlyQuizSchema') {
    requireAdmin(user);
    return { success: true, message: 'Le schéma du quiz est déjà présent dans Supabase.' };
  }
  if (name === 'generateMonthlyQuiz') {
    requireAdmin(user);
    return generateMonthlyQuiz(user);
  }
  if (name === 'generateFakeMemberPosts') {
    requireAdmin(user);
    return generateFakeMemberPosts(user);
  }
  if (name === 'importProducts') {
    requireAdmin(user);
    return importProducts(payload, user);
  }
  if (name === 'syncSupplierStock') {
    requireAdmin(user);
    return syncSupplierStock();
  }
  if (name === 'getUserBalance') {
    requireUser(user);
    return getUserBalance(user);
  }
  if (name === 'purchaseShopProduct') {
    requireUser(user);
    return purchaseShopProduct(payload, user, false);
  }
  if (name === 'purchaseDigitalProduct') {
    requireUser(user);
    return purchaseShopProduct(payload, user, true);
  }
  if (name === 'replicateGenerate') {
    requireUser(user);
    return replicateGenerate(payload, user);
  }
  if (name === 'generateCharacterSheet') {
    requireUser(user);
    return generateCharacterSheet(payload, user);
  }
  if (name === 'generateVideo') {
    requireUser(user);
    return generateVideo(payload, user);
  }
  if (name === 'mixAudioVideo') {
    requireUser(user);
    return mixAudioVideo(payload, user);
  }
  if (name === 'createAuthorizeNetCheckout') {
    requireUser(user);
    return createAuthorizeNetCheckout(payload, user, request.headers.origin || 'https://le-cochon-savant.vercel.app');
  }
  if (name === 'purchaseTokens') {
    requireUser(user);
    return purchaseTokens(payload, user, request.headers.origin || 'https://le-cochon-savant.vercel.app');
  }
  if (name === 'getMemberDossiers') return getMemberDossiers(payload.memberEmail);
  if (name === 'getMemberMessages') {
    requireUser(user);
    return getMemberMessages(payload.memberEmail);
  }
  if (name === 'getStorySetup') {
    requireUser(user);
    return getStorySetup(user);
  }
  if (name === 'getUserStorySessions') {
    requireUser(user);
    return getUserStorySessions(payload.theme_id, user);
  }
  if (name === 'sendMemberContact') {
    requireUser(user);
    return sendMemberContact(payload, user);
  }
  if (name === 'proxyImage') {
    requireUser(user);
    return proxyImage(payload.url);
  }
  if (name === 'purchaseDossierDigital') {
    requireUser(user);
    return purchaseDossierDigital(payload, user);
  }
  if (name === 'getR2DownloadLink') {
    requireUser(user);
    return getR2DownloadLink(payload, user);
  }
  if (name === 'createDigitalUpload') {
    requireAdmin(user);
    if (!payload.name) { const error = new Error('Nom de fichier requis'); error.status = 400; throw error; }
    return createDigitalUpload(payload);
  }
  if (name === 'gameStartLevel') { requireUser(user); return gameStartLevel(payload, user); }
  if (name === 'gameCompleteLevel') { requireUser(user); return gameCompleteLevel(payload, user); }
  if (name === 'gameEvaluateInterpretation') { requireUser(user); return gameEvaluateInterpretation(payload, user); }
  if (name === 'gameGuidedVisit') { requireUser(user); return gameGuidedVisit(payload, user); }
  if (name === 'gameEvaluateCreation') { requireUser(user); return gameEvaluateCreation(payload, user); }
  if (name === 'proposeStoryArc') { requireUser(user); return proposeStoryArc(payload, user); }
  if (name === 'regenerateSegment') { requireUser(user); return regenerateSegment(payload, user); }
  if (name === 'sendContactMessage' || name === 'sendContactEmail') return sendContactMessage(payload);
  if (name === 'publishEpisode') { requireUser(user); return publishEpisode(payload, user); }
  if (name === 'publishStorySession') { requireUser(user); return publishStorySession(payload, user); }
  if (name === 'generateImage') { requireUser(user); return generateImage(payload, user); }
  if (name === 'generateSpeech') { requireUser(user); return generateSpeech(payload, user); }
  if (name === 'invokeLLM') { requireAdmin(user); return invokeLLM(payload, user); }
  if (name === 'transcribeAudio') { requireUser(user); return transcribeAudio(payload, user); }
  if (name === 'sendEmail') { requireUser(user); return sendEmail(payload); }
  if (name === 'regenerateNarration') { requireUser(user); return regenerateNarration(payload, user); }
  if (name === 'generateStoryBlock') { requireUser(user); return generateStoryBlock(payload, user); }
  if (name === 'checkStoryBlockPlan') { requireUser(user); return checkStoryBlockPlan(payload, user); }
  if (name === 'generateBlockVideos') { requireUser(user); return generateBlockVideos(payload, user); }
  if (name === 'getPublishedDossiers') {
    const [dossiers, categories, classes] = await Promise.all([
      readRows('dossiers', { filters: { status: 'published' }, sort: '-order' }),
      readRows('dossier_categories', { sort: 'name' }),
      readRows('dossier_classes', { sort: 'order' }),
    ]);
    return { dossiers, categories, classes };
  }
  if (name === 'getAdminDossiers') {
    requireAdmin(user);
    const [dossiers, categories, classes] = await Promise.all([
      readRows('dossiers', { sort: 'order' }),
      readRows('dossier_categories', { sort: 'order' }),
      readRows('dossier_classes', { sort: 'order' }),
    ]);
    return { dossiers, categories, classes };
  }
  if (name === 'getAdminFinancialLedger') {
    requireAdmin(user);
    const [orders, tokenTransactions, sponsorSales, memberEarnings, taxDeposits] = await Promise.all([
      readRows('orders', { sort: '-payment_date', limit: 500 }),
      readRows('token_transactions', { sort: '-created_at', limit: 500 }),
      readRows('sponsor_sales', { sort: '-sale_date', limit: 500 }),
      readRows('member_earnings', { sort: '-payout_month', limit: 500 }),
      readRows('tax_deposits', { sort: '-tax_month', limit: 120 }),
    ]);
    return { orders, tokenTransactions, sponsorSales, memberEarnings, taxDeposits };
  }
  if (name === 'saveTaxDeposit') {
    requireAdmin(user);
    const taxMonth = String(payload.tax_month || '').trim();
    const depositDate = String(payload.deposit_date || '').trim();
    const tpsAmount = Number(payload.tps_amount || 0);
    const tvqAmount = Number(payload.tvq_amount || 0);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(taxMonth)) {
      const error = new Error('Mois fiscal invalide'); error.status = 400; throw error;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(depositDate)) {
      const error = new Error('Date du dépôt requise'); error.status = 400; throw error;
    }
    if (![tpsAmount, tvqAmount].every(Number.isFinite) || tpsAmount < 0 || tvqAmount < 0) {
      const error = new Error('Montants de taxes invalides'); error.status = 400; throw error;
    }
    const data = {
      tax_month: taxMonth,
      deposit_date: depositDate,
      tps_amount: Number(tpsAmount.toFixed(2)),
      tvq_amount: Number(tvqAmount.toFixed(2)),
      reference: String(payload.reference || '').trim() || null,
      notes: String(payload.notes || '').trim() || null,
      deposited_by: user.id,
    };
    const [existing] = await readRows('tax_deposits', { filters: { tax_month: taxMonth }, limit: 1 });
    const [item] = existing
      ? await updateRow('tax_deposits', existing.id, data)
      : await insertRows('tax_deposits', data);
    return { item };
  }
  if (name === 'getAdminAICosts') {
    requireAdmin(user);
    const [storedEvents, rates, settings, toolPricings, quotes] = await Promise.all([
      readRows('ai_usage_events', { sort: '-created_date', limit: 500 }),
      readRows('ai_model_cost_rates', { sort: 'model_key', limit: 100 }),
      readRows('ai_cost_settings', { filters: { setting_key: 'default' }, limit: 1 }),
      readRows('tool_pricings', { sort: 'tool_name', limit: 200 }),
      readRows('ai_quotes', { sort: '-created_date', limit: 500 }),
    ]);
    const ratesByModel = new Map(rates.filter((rate) => rate.is_active).map((rate) => [rate.model_key, rate]));
    const events = storedEvents.map((event) => {
      if (event.estimated_cost_usd != null || event.operation_id) return event;
      const rate = ratesByModel.get(event.model_key);
      if (!rate) return event;
      let estimate;
      if (rate.billing_type === 'per_second' && event.predict_time_seconds != null) estimate = Number(event.predict_time_seconds) * Number(rate.unit_price_usd);
      else if (['per_1k_input_tokens', 'per_1k_characters'].includes(rate.billing_type) && event.input_units != null) estimate = Number(event.input_units) * Number(rate.unit_price_usd) / 1000;
      else if (rate.billing_type === 'per_1k_output_tokens' && event.output_units != null) estimate = Number(event.output_units) * Number(rate.unit_price_usd) / 1000;
      else if (rate.billing_type === 'per_1k_tokens' && event.input_units != null && event.output_units != null && rate.output_unit_price_usd != null) estimate = (Number(event.input_units) * Number(rate.unit_price_usd) + Number(event.output_units) * Number(rate.output_unit_price_usd)) / 1000;
      else if (rate.billing_type === 'per_prediction') estimate = Number(rate.unit_price_usd);
      else return event;
      return { ...event, billing_type: rate.billing_type, unit_price_usd: rate.unit_price_usd, output_unit_price_usd: rate.output_unit_price_usd, estimated_cost_usd: Number(estimate.toFixed(6)) };
    });
    return { events, rates, settings: settings[0] || null, toolPricings, quotes, truncated: storedEvents.length === 500 || quotes.length === 500 };
  }
  if (name === 'saveAIModelRate') {
    requireAdmin(user);
    const modelKey = String(payload.model_key || '').trim();
    const billingType = payload.billing_type;
    const unitPrice = Number(payload.unit_price_usd);
    if (!modelKey || !['per_second', 'per_prediction', 'per_1k_input_tokens', 'per_1k_output_tokens', 'per_1k_characters', 'per_output_second', 'per_1k_tokens'].includes(billingType) || !Number.isFinite(unitPrice) || unitPrice < 0) {
      const error = new Error('Tarification du modèle invalide'); error.status = 400; throw error;
    }
    const runtime = payload.max_runtime_seconds == null || payload.max_runtime_seconds === '' ? null : Number(payload.max_runtime_seconds);
    const outputPrice = payload.output_unit_price_usd == null || payload.output_unit_price_usd === '' ? null : Number(payload.output_unit_price_usd);
    if ((runtime != null && (!Number.isInteger(runtime) || runtime < 5 || runtime > 240)) || (outputPrice != null && (!Number.isFinite(outputPrice) || outputPrice < 0))) {
      const error = new Error('Limite de calcul ou tarif de sortie invalide'); error.status = 400; throw error;
    }
    if (payload.quote_enabled && (unitPrice <= 0 || (billingType === 'per_second' && runtime == null) || (billingType === 'per_1k_tokens' && outputPrice == null) || ['per_1k_input_tokens', 'per_1k_output_tokens'].includes(billingType))) {
      const error = new Error('Complétez les tarifs et limites avant d’activer les devis.'); error.status = 400; throw error;
    }
    const data = { model_key: modelKey, billing_type: billingType, unit_price_usd: unitPrice, is_active: true, notes: String(payload.notes || '').trim() || null, updated_by: user.id,
      quote_enabled: payload.quote_enabled === true, max_runtime_seconds: runtime, output_unit_price_usd: outputPrice };
    const [existing] = await readRows('ai_model_cost_rates', { filters: { model_key: modelKey }, limit: 1 });
    const [item] = existing ? await updateRow('ai_model_cost_rates', existing.id, data) : await insertRows('ai_model_cost_rates', data);
    return { item };
  }
  if (name === 'saveAICostSettings') {
    requireAdmin(user);
    const tokenValue = payload.token_value_cad === '' || payload.token_value_cad == null ? null : Number(payload.token_value_cad);
    const exchangeRate = payload.usd_to_cad_rate === '' || payload.usd_to_cad_rate == null ? null : Number(payload.usd_to_cad_rate);
    if ((tokenValue != null && (!Number.isFinite(tokenValue) || tokenValue <= 0)) || (exchangeRate != null && (!Number.isFinite(exchangeRate) || exchangeRate <= 0))) {
      const error = new Error('Paramètres financiers invalides'); error.status = 400; throw error;
    }
    const [existing] = await readRows('ai_cost_settings', { filters: { setting_key: 'default' }, limit: 1 });
    const data = { token_value_cad: tokenValue, usd_to_cad_rate: exchangeRate, warning_margin_percent: Number(payload.warning_margin_percent || 20), blocking_enabled: false, updated_by: user.id };
    const [item] = existing ? await updateRow('ai_cost_settings', existing.id, data) : await insertRows('ai_cost_settings', { setting_key: 'default', ...data });
    return { item };
  }
  if (name === 'getDossierPages') {
    await requireDossierPageAccess(user);
    const dossierId = payload.dossier_id || payload.dossierId;
    const filters = dossierId ? { dossier_id: dossierId } : {};
    if (payload.page_type) filters.page_type = payload.page_type;
    if (payload.block_player_episode_page_id) filters.block_player_episode_page_id = payload.block_player_episode_page_id;
    const options = { filters, sort: 'order' };
    if (payload.id) options.id = payload.id;
    return { pages: await readRows('dossier_pages', options) };
  }
  if (name === 'getDossierPage') {
    await requireDossierPageAccess(user);
    return { item: (await readRows('dossier_pages', { id: payload.id, limit: 1 }))[0] || null };
  }
  if (name === 'getProduct') {
    const item = (await readRows('products', { id: payload.id, limit: 1 }))[0] || null;
    return { item, product: item };
  }
  if (name === 'getShopData') {
    const [sections, products, settings] = await Promise.all([
      readRows('shop_sections', { filters: { is_active: true }, sort: 'order' }),
      readRows('products', { filters: { is_active: true }, sort: 'order' }),
      readRows('shop_settings', { limit: 1 }),
    ]);
    return { sections, products, settings: settings[0] || null };
  }
  if (name === 'saveDossier') {
    requireAdmin(user);
    const data = { ...payload }; delete data.id;
    const [item] = payload.id ? await updateRow('dossiers', payload.id, data) : await insertRows('dossiers', { ...data, created_by_id: user.id });
    return { item };
  }
  if (name === 'saveDossierPage') {
    requireAdmin(user);
    const data = { ...payload }; delete data.id;
    const [item] = payload.id ? await updateRow('dossier_pages', payload.id, data) : await insertRows('dossier_pages', { ...data, created_by_id: user.id });
    return { item };
  }
  if (name === 'saveDossierCategory') {
    requireAdmin(user);
    const data = { ...payload }; delete data.id;
    const [item] = payload.id ? await updateRow('dossier_categories', payload.id, data) : await insertRows('dossier_categories', { ...data, created_by_id: user.id });
    return { item };
  }
  if (name === 'saveDossierClass') {
    requireAdmin(user);
    const data = { ...payload }; delete data.id;
    const [item] = payload.id ? await updateRow('dossier_classes', payload.id, data) : await insertRows('dossier_classes', { ...data, created_by_id: user.id });
    return { item };
  }
  const deleteTables = {
    deleteDossier: 'dossiers', deleteDossierPage: 'dossier_pages',
    deleteDossierCategory: 'dossier_categories', deleteDossierClass: 'dossier_classes',
  };
  if (deleteTables[name]) { requireAdmin(user); return deleteRow(deleteTables[name], payload.id); }
  if (name === 'addDossierComment') {
    requireUser(user);
    const [item] = await insertRows('dossier_comments', { ...payload, user_email: user.email, created_by_id: user.id });
    return { item };
  }
  if (name === 'getDossierComments') return { items: await readRows('dossier_comments', { filters: { dossier_id: payload.dossier_id || payload.dossierId }, sort: 'created_date' }) };
  if (name === 'addDossierRating') {
    requireUser(user);
    const [item] = await insertRows('dossier_ratings', { ...payload, user_email: user.email, created_by_id: user.id });
    return { item };
  }
  if (name === 'getDossierRating') {
    requireUser(user);
    return { item: (await readRows('dossier_ratings', { filters: { dossier_id: payload.dossier_id || payload.dossierId, user_email: user.email }, limit: 1 }))[0] || null };
  }
  const error = new Error(`Fonction non encore transférée: ${name}`);
  error.status = 501;
  throw error;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response);
  try {
    const name = Array.isArray(request.query.name) ? request.query.name[0] : request.query.name;
    const payload = request.body || {};
    const user = await getRequestUser(request);
    if (name === 'getAIQuote') {
      requireUser(user);
      return sendJson(response, 200, await createAIQuote(payload.function_name, payload.input || {}, user));
    }
    if (QUOTED_FUNCTIONS.has(name) || DEFERRED_FUNCTIONS.has(name)) {
      requireUser(user);
      const result = await executeWithAIQuote(name, payload, user, () => runNamedFunction(name, payload, user, request));
      return sendJson(response, 200, result);
    }
    if (name === 'manageChatMessage') return sendJson(response, 200, await manageChat(payload, user));
    if (name === 'managePrivateMessage') return sendJson(response, 200, await managePrivateChat(payload, user));
    const table = MANAGER_TABLES[name];
    let result;
    if (table) {
      const action = payload.action || 'list';
      if (WRITE_ACTIONS.has(action)) {
        if (MEMBER_MANAGERS.has(name)) requireUser(user); else requireAdmin(user);
      } else if (!PUBLIC_READ_TABLES.has(table)) requireUser(user);
      result = await runCrud(table, payload, user);
    } else result = await runNamedFunction(name, payload, user, request);
    return sendJson(response, 200, result);
  } catch (error) {
    return handleError(response, error);
  }
}
