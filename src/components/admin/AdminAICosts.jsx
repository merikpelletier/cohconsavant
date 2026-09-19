import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Coins, DollarSign, Gauge, Save } from 'lucide-react';
import { appClient } from '@/api/appClient';
import AIQuoteRates from './AIQuoteRates';

const usd = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 });
const cad = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 4 });
const monthNow = new Date().toISOString().slice(0, 7);
const n = (value) => Number(value || 0);
const AI_SERVICES = [
  { id: 'fake_member_chat', label: 'Envoyer un message à un membre IA', models: ['deepseek-ai/deepseek-v3'], billable: true },
  { id: 'production_assistant', label: 'Assistant de production', models: ['meta/meta-llama-3-70b-instruct'], billable: false },
  { id: 'admin_llm', label: 'Demandes IA administratives', models: ['meta/meta-llama-3-70b-instruct'], billable: false },
  { id: 'admin_coder', label: 'Assistant de développement administratif', models: ['anthropic/claude-sonnet-4.6'], billable: false },
  { id: 'ai_image', label: 'Génération d’image', models: ['google/nano-banana-2'], billable: true },
  { id: 'character_sheet', label: 'Dress Actor / fiche personnage', models: ['google/nano-banana-2'], billable: true },
  { id: 'headshot', label: 'Portrait', models: ['google/nano-banana-2'], billable: true },
  { id: 'compose_scene', label: 'Composition de scène', models: ['google/nano-banana-2'], billable: true },
  { id: 'character_photo', label: 'Photo de personnage', models: ['google/nano-banana-2'], billable: true },
  { id: 'reference_sheet_swap', label: 'Remplacement sur fiche', models: ['google/nano-banana-2'], billable: true },
  { id: 'ai_video', label: 'Vidéo IA', models: ['google/nano-banana-2', 'kwaivgi/kling-v2.6'], billable: true },
  { id: 'animate_image', label: 'Animation d’image', models: ['kwaivgi/kling-v2.6'], billable: true },
  { id: 'animate_with_reference', label: 'Animation avec référence', models: ['kwaivgi/kling-v2.6-motion-control'], billable: true },
  { id: 'text_to_video', label: 'Texte vers vidéo', models: ['kwaivgi/kling-v2.6'], billable: true },
  { id: 'body_and_voice', label: 'Corps et voix', models: ['kwaivgi/kling-v3-omni-video'], billable: true },
  { id: 'lip_sync', label: 'Synchronisation labiale', models: ['kwaivgi/kling-lip-sync'], billable: true },
  { id: 'faceswitch', label: 'Face Switch', models: ['Version Replicate Face Swap', 'Version Replicate GFPGAN'], billable: true },
  { id: 'generate_3d', label: 'Génération 3D', models: ['google/nano-banana-2', 'firtoz/trellis'], billable: true },
  { id: 'dubbing', label: 'Dubbing Studio', models: ['Version Replicate audio/vidéo'], billable: true },
  { id: 'transcription', label: 'Transcription', models: ['openai/whisper'], billable: true },
  { id: 'tts', label: 'Synthèse vocale', models: ['elevenlabs/v2-multilingual'], billable: true },
  { id: 'story_block', label: 'Planification Story Blocks', models: ['meta/meta-llama-3-70b-instruct'], billable: true },
  { id: 'story_arc', label: 'Proposition d’arc narratif', models: ['meta/meta-llama-3-70b-instruct'], billable: false },
  { id: 'story_media', label: 'Images et vidéos Story Blocks', models: ['google/nano-banana-2', 'kwaivgi/kling-v2.6'], billable: false },
  { id: 'story_narration', label: 'Narration Story Blocks', models: ['elevenlabs/v2-multilingual'], billable: false },
  { id: 'fake_member_posts', label: 'Publications automatiques des membres IA', models: ['meta/meta-llama-3-70b-instruct', 'bytedance/seedream-4.5'], billable: false },
  { id: 'monthly_quiz', label: 'Création du quiz mensuel', models: ['meta/meta-llama-3-70b-instruct', 'bytedance/seedream-4.5'], billable: false },
  { id: 'game_master', label: 'Maître de jeu IA', models: ['meta/meta-llama-3-70b-instruct'], billable: false },
  { id: 'game_texture', label: 'Textures du jeu', models: ['bytedance/seedream-4.5'], billable: false },
];

export default function AdminAICosts() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(monthNow);
  const [rateDrafts, setRateDrafts] = useState({});
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [tokenDrafts, setTokenDrafts] = useState({});
  const { data = {}, isLoading, error } = useQuery({ queryKey: ['adminAICosts'], queryFn: async () => (await appClient.functions.invoke('getAdminAICosts')).data });
  const settings = settingsDraft || data.settings || {};
  const events = (data.events || []).filter((event) => String(event.completed_at || event.created_date).slice(0, 7) === month);
  const months = useMemo(() => Array.from(new Set([monthNow, ...(data.events || []).map((event) => String(event.completed_at || event.created_date).slice(0, 7))])).sort().reverse(), [data.events]);
  const models = useMemo(() => Array.from(new Set([...(data.rates || []).map((rate) => rate.model_key), ...(data.events || []).map((event) => event.model_key).filter(Boolean), ...AI_SERVICES.flatMap((service) => service.models.filter((model) => /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(model)))])).sort(), [data.rates, data.events]);
  const totalCostUsd = events.reduce((sum, event) => sum + n(event.estimated_cost_usd), 0);
  const quotes = (data.quotes || []).filter((quote) => quote.status === 'succeeded' && String(quote.completed_at || quote.created_date).slice(0, 7) === month);
  const quotesById = new Map((data.quotes || []).map((quote) => [quote.id, quote]));
  const legacyTokens = events.filter((event) => !event.operation_id).reduce((sum, event) => sum + n(event.tokens_charged), 0);
  const totalTokens = legacyTokens + quotes.reduce((sum, quote) => sum + n(quote.charged_tokens), 0);
  const revenueCad = legacyTokens && settings.token_value_cad == null ? null : legacyTokens * n(settings.token_value_cad) + quotes.reduce((sum, quote) => sum + n(quote.charged_tokens) * n(quote.token_value_cad), 0);
  const costCad = events.some((event) => event.estimated_cost_usd == null || !(quotesById.get(event.operation_id)?.usd_to_cad_rate || settings.usd_to_cad_rate)) ? null : events.reduce((sum, event) => sum + n(event.estimated_cost_usd) * n(quotesById.get(event.operation_id)?.usd_to_cad_rate || settings.usd_to_cad_rate), 0);
  const marginCad = revenueCad == null || costCad == null ? null : revenueCad - costCad;
  const unpriced = events.filter((event) => event.estimated_cost_usd == null).length;

  const saveRate = useMutation({ mutationFn: (payload) => appClient.functions.invoke('saveAIModelRate', payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['adminAICosts'] }) });
  const saveSettings = useMutation({ mutationFn: () => appClient.functions.invoke('saveAICostSettings', settings), onSuccess: (result) => { setSettingsDraft(result.data.item); qc.invalidateQueries({ queryKey: ['adminAICosts'] }); } });
  const saveTool = useMutation({ mutationFn: (payload) => appClient.functions.invoke('manageToolPricing', { action: 'save', ...payload }), onSuccess: () => qc.invalidateQueries({ queryKey: ['adminAICosts'] }) });
  if (isLoading) return <p className="py-12 text-center text-white/50">Chargement des coûts IA…</p>;
  if (error) return <p className="py-12 text-center text-red-400">{error.message}</p>;

  return <div className="space-y-6 text-white">
    {(saveRate.error || saveSettings.error || saveTool.error) && <p role="alert" className="text-red-400">{(saveRate.error || saveSettings.error || saveTool.error).message}</p>}
    {data.truncated && <p className="text-amber-400">Vue limitée aux 500 dernières opérations : les totaux ne sont pas exhaustifs.</p>}
    <p className="text-sm text-white/50">Coût USD × taux USD/CAD ÷ 0,60 ÷ valeur nette du jeton, arrondi au jeton supérieur. Le taux est configuré manuellement; il ne se met pas à jour automatiquement. Les anciens appels sans devis utilisent le taux courant pour leur estimation.</p>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[0.25em] text-red-500">Devis et suivi des coûts</p><h2 className="mt-1 text-2xl font-semibold">Rentabilité des services IA</h2><p className="mt-1 text-sm text-white/50">Les membres confirment un devis avant la génération. Les coûts inconnus empêchent le lancement. Marge cible minimale : 40 % après conversion USD → CAD.</p></div><select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-white/20 bg-neutral-900 px-3 py-2 text-sm">{months.map((m) => <option key={m}>{m}</option>)}</select></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Coût Replicate estimé', usd.format(totalCostUsd), DollarSign],
      ['Tokens facturés', totalTokens.toLocaleString('fr-CA'), Coins],
      ['Marge estimée', marginCad == null ? 'À configurer' : cad.format(marginCad), Gauge],
      ['Appels sans tarif', String(unpriced), AlertTriangle],
    ].map(([label, value, Icon]) => <div key={label} className="rounded-lg border border-white/10 bg-neutral-950 p-4"><Icon size={18} className="mb-3 text-red-500"/><p className="text-xs uppercase tracking-wider text-white/45">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>)}</div>
    <div className="rounded-lg border border-white/10 bg-neutral-950 p-4"><h3 className="mb-4 font-semibold">Valeur financière des tokens</h3><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-white/55">Valeur nette prudente d’un jeton (CAD)<input type="number" step="0.000001" value={settings.token_value_cad ?? ''} onChange={(e) => setSettingsDraft({ ...settings, token_value_cad: e.target.value })} className="mt-1 w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-white"/></label><label className="text-xs text-white/55">Taux appliqué : 1 USD = … CAD<input type="number" step="0.0001" value={settings.usd_to_cad_rate ?? ''} onChange={(e) => setSettingsDraft({ ...settings, usd_to_cad_rate: e.target.value })} className="mt-1 w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-white"/></label><button onClick={() => saveSettings.mutate()} className="mt-5 flex h-10 items-center justify-center gap-2 rounded bg-white text-sm font-semibold text-black"><Save size={15}/> Enregistrer</button></div></div>
    <div className="rounded-lg border border-white/10 bg-neutral-950 p-4"><h3 className="mb-1 font-semibold">Inventaire complet des services IA</h3><p className="mb-4 text-sm text-white/45">Tous passent par Replicate. Un service facturé sans prix actif est bloqué pour les membres; les opérations internes restent suivies séparément.</p><div className="space-y-2">{AI_SERVICES.map((service) => { const pricing = (data.toolPricings || []).find((item) => item.tool_id === service.id); const draft = tokenDrafts[service.id] ?? pricing?.token_cost ?? ''; const ready = pricing?.is_active && n(pricing.token_cost) > 0; return <div key={service.id} className="grid gap-2 rounded border border-white/10 p-3 lg:grid-cols-[1fr_1.2fr_130px_110px]"><div><p className="text-sm font-medium">{service.label}</p><p className={`text-xs ${service.billable ? (ready ? 'text-green-400' : 'text-red-400') : 'text-blue-400'}`}>{service.billable ? (ready ? 'Prix de départ configuré — devis fournisseur requis' : 'Prix manquant ou service inactif') : 'Opération interne — coût suivi'}</p></div><p className="self-center text-xs text-white/45">{service.models.join(' · ')}</p>{service.billable ? <input type="number" min="0" step="1" value={draft} onChange={(e) => setTokenDrafts({ ...tokenDrafts, [service.id]: e.target.value })} placeholder="Tokens" className="rounded border border-white/15 bg-neutral-900 px-3 py-2 text-sm"/> : <span className="self-center text-center text-xs text-white/35">Non facturé</span>}{service.billable ? <button disabled={!ready && (draft === '' || n(draft) <= 0)} onClick={() => saveTool.mutate({ id: pricing?.id, tool_id: service.id, tool_name: service.label, token_cost: n(draft || pricing?.token_cost), category: pricing?.category || 'other', is_active: !ready })} className={`rounded px-3 py-2 text-sm disabled:opacity-30 ${ready ? 'bg-white/10' : 'bg-red-600'}`}>{ready ? 'Désactiver' : 'Activer'}</button> : <span/>}</div>; })}</div></div>
    <AIQuoteRates models={models} rates={data.rates || []} saveRate={saveRate}/>
    <div className="overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-neutral-900 text-xs uppercase text-white/45"><tr><th className="p-3">Date</th><th className="p-3">Outil</th><th className="p-3">Modèle</th><th className="p-3 text-right">Durée</th><th className="p-3 text-right">Tokens</th><th className="p-3 text-right">Coût USD</th><th className="p-3">Statut</th></tr></thead><tbody className="divide-y divide-white/5 bg-neutral-950">{events.map((event) => <tr key={event.id}><td className="p-3 text-white/55">{new Date(event.completed_at || event.created_date).toLocaleString('fr-CA')}</td><td className="p-3">{event.tool_id || 'Interne/admin'}</td><td className="p-3 text-white/60">{event.model_key || event.model_version || '—'}</td><td className="p-3 text-right">{n(event.predict_time_seconds).toFixed(2)} s</td><td className="p-3 text-right">{n(event.tokens_charged)}</td><td className="p-3 text-right">{event.estimated_cost_usd == null ? 'Tarif requis' : usd.format(n(event.estimated_cost_usd))}</td><td className="p-3 uppercase text-white/50">{event.status}</td></tr>)}{!events.length && <tr><td colSpan="7" className="p-10 text-center text-white/35">Aucune utilisation IA enregistrée pour ce mois.</td></tr>}</tbody></table></div>
  </div>;
}
