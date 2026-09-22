import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, ExternalLink, FileCode2, ShieldCheck } from 'lucide-react';
import { appClient } from '@/api/appClient';

const CODER_SURFACES = [
  { type: 'page', key: 'Dossiers', label: 'Dossiers', route: '/Admin', source_files: ['src/components/admin/AdminDossiers.jsx', 'src/components/DossierViewer.jsx', 'api/functions/[name].js'] },
  { type: 'page', key: 'Membership', label: 'Membership', route: '/Membership', source_files: ['src/pages/Membership.jsx', 'api/_lib/authorizeNet.js', 'api/functions/[name].js'] },
  { type: 'page', key: 'Magazine', label: 'Magazine', route: '/Magazine', source_files: ['src/pages/Magazine.jsx', 'src/components/DossierViewer.jsx', 'api/functions/[name].js'] },
  { type: 'page', key: 'Boutique', label: 'Boutique', route: '/Boutique', source_files: ['src/pages/Boutique.jsx', 'src/pages/ProductDetail.jsx', 'api/_lib/shop.js', 'api/functions/[name].js'] },
  { type: 'page', key: 'Studio', label: 'Studio', route: '/Studio', source_files: ['src/pages/Studio.jsx', 'api/functions/[name].js'] },
  { type: 'page', key: 'Index', label: 'Accueil', route: '/', source_files: ['src/pages/Index.jsx'] },
];

export default function AdminCoder() {
  const qc = useQueryClient();
  const [instruction, setInstruction] = useState('');
  const [selected, setSelected] = useState(null);
  const [surfaceKey, setSurfaceKey] = useState('Dossiers');
  const surface = CODER_SURFACES.find((item) => item.key === surfaceKey) || CODER_SURFACES[0];
  const status = useQuery({ queryKey: ['adminCoderStatus'], queryFn: async () => (await appClient.functions.invoke('getAdminCoderStatus')).data });
  const history = useQuery({ queryKey: ['adminCoderProposals'], queryFn: async () => (await appClient.functions.invoke('listAdminCodeProposals')).data.proposals });
  const propose = useMutation({ mutationFn: async () => (await appClient.functions.invoke('proposeAdminCodeChange', { instruction, surface })).data.proposal,
    onSuccess: (proposal) => { setSelected(proposal); qc.invalidateQueries({ queryKey: ['adminCoderProposals'] }); } });
  const apply = useMutation({ mutationFn: async (id) => (await appClient.functions.invoke('applyAdminCodeProposal', { id })).data.proposal,
    onSuccess: (proposal) => { setSelected(proposal); qc.invalidateQueries({ queryKey: ['adminCoderProposals'] }); } });
  const error = status.error || propose.error || apply.error;
  return <div className="space-y-5 text-white">
    <div className="rounded-xl border border-white/15 bg-neutral-950 p-5">
      <div className="flex items-center gap-3"><Bot className="text-red-500"/><div><h2 className="text-xl font-semibold">Assistant de développement</h2><p className="text-sm text-white/55">Claude Sonnet 4.6 via Replicate</p></div></div>
      <div className="mt-4 flex gap-2 text-sm text-white/65"><ShieldCheck size={18} className="text-green-400"/>Claude propose; tu vérifies; après confirmation, le changement est appliqué directement sur GitHub main et Vercel déploie automatiquement.</div>
      {status.data && <p className="mt-3 text-xs text-white/45">
        Dépôt : {status.data.repository} · branche : {status.data.branch} ·
        {status.data.proposal_ready ? ' lecture prête' : ' lecture à configurer'} ·
        {status.data.write_configured ? ' écriture GitHub prête' : ' écriture GitHub non configurée'}
      </p>}
    </div>
    <div className="rounded-xl border border-white/15 bg-neutral-950 p-5">
      <label className="font-medium">Section à modifier</label>
      <select value={surfaceKey} onChange={(e) => setSurfaceKey(e.target.value)}
        className="mt-2 w-full rounded-lg border border-white/20 bg-black p-3 text-white">
        {CODER_SURFACES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select>
      <p className="mt-2 text-xs text-white/45">Sources : {surface.source_files.join(' · ')}</p>
      <label htmlFor="coder-request" className="mt-4 block font-medium">Que veux-tu modifier?</label>
      <textarea id="coder-request" value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={6} maxLength={4000}
        placeholder="Ex. Dans la page d’accueil, change le titre… Le reste doit demeurer identique."
        className="mt-2 w-full rounded-lg border border-white/20 bg-black p-3 text-white placeholder:text-white/30"/>
      <button disabled={instruction.trim().length < 10 || propose.isPending}
        onClick={() => propose.mutate()} className="mt-3 rounded-lg bg-red-600 px-5 py-2.5 font-semibold disabled:opacity-35">
        {propose.isPending ? 'Claude analyse le site…' : 'Préparer une proposition'}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error.message}</p>}
    </div>
    {selected && <div className="rounded-xl border border-red-500/40 bg-neutral-950 p-5">
      <h3 className="text-lg font-semibold">{selected.summary}</h3>
      {(selected.warnings || []).map((warning) => <p key={warning} className="mt-2 text-sm text-amber-300">{warning}</p>)}
      <div className="mt-4 space-y-3">{(selected.files || []).map((file) => <details key={file.path} className="rounded border border-white/15 p-3"><summary className="cursor-pointer font-mono text-sm"><FileCode2 className="mr-2 inline" size={15}/>{file.path}</summary><p className="my-2 text-sm text-white/60">{file.reason}</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-black p-3 text-xs">{file.content}</pre></details>)}</div>
      {selected.status === 'proposed' && <>
        <button
          disabled={apply.isPending || status.data?.write_configured === false}
          onClick={() => apply.mutate(selected.id)}
          className="mt-4 rounded-lg bg-white px-5 py-2.5 font-semibold text-black disabled:opacity-40"
        >
          {apply.isPending ? 'Application sur GitHub…' : 'Confirmer et appliquer sur GitHub'}
        </button>
        {status.data?.write_configured === false && (
          <p className="mt-3 text-sm text-red-400">
            La proposition est prête, mais la connexion GitHub en écriture n’est pas configurée sur le serveur.
          </p>
        )}
        {apply.error && (
          <p role="alert" className="mt-3 text-sm text-red-400">{apply.error.message}</p>
        )}
      </>}
      {selected.pull_request_url && <a className="mt-4 flex items-center gap-2 text-red-400 underline" target="_blank" rel="noreferrer" href={selected.pull_request_url}>Voir le commit GitHub <ExternalLink size={15}/></a>}
    </div>}
    <div className="rounded-xl border border-white/15 bg-neutral-950 p-5"><h3 className="font-semibold">Historique</h3>
      <div className="mt-3 space-y-2">{(history.data || []).map((item) => <button key={item.id} onClick={() => setSelected(item)} className="block w-full rounded border border-white/10 p-3 text-left"><span>{item.summary}</span><span className="float-right text-xs uppercase text-white/40">{item.status}</span></button>)}</div>
    </div>
  </div>;
}
