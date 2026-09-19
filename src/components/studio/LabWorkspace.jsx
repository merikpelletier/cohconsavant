import React, { useState, useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import AvailableProjectsPortal from '@/components/studio/AvailableProjectsPortal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import InlineHeadshot from '@/components/studio/InlineHeadshot';
import TokenPurchaseModal from '@/components/studio/TokenPurchaseModal';
import VaultDrawer from '@/components/VaultDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Film, Mic, Upload, Music, Type, Users, Layers, ChevronRight, X, Loader2, Shirt, Bookmark, CheckCircle2, Camera, Video, Square, ChevronDown, ChevronUp, Pencil, Plus, ListVideo, Sparkles, Box } from 'lucide-react';
import Inline3DModel from '@/components/studio/Inline3DModel';
import { toast } from 'sonner';

const TOOL_GROUPS = [
  {
    label: 'Acteur',
    color: 'bg-red-700',
    tools: [
      { id: 'headshot', label: 'Portrait', icon: Camera, desc: 'Générer un portrait professionnel à partir de votre photo' },
    ],
    library: [
      { id: 'new_actor', label: 'Nouvel Acteur', icon: Users, desc: 'Ajouter un acteur à votre bibliothèque' },
    ],
  },
  {
    label: 'Son & Voix',
    color: 'bg-red-700',
    tools: [
      { id: 'voice', label: 'Enregistrer Voix', icon: Mic, desc: 'Enregistrer votre voix dans le navigateur' },
      { id: 'tts', label: 'Synthèse Vocale', icon: Type, desc: 'Générer une voix IA à partir de texte' },
    ],
  },
  {
    label: 'Vidéo',
    color: 'bg-red-700',
    tools: [
      { id: 'animate', label: 'Animer Image', icon: Film, desc: 'Donner vie à une image fixe avec un mouvement IA' },
      { id: 'ai_video', label: 'Vidéo IA', icon: Camera, desc: 'Générer une vidéo à partir d\'une description textuelle' },
      { id: 'video_tools', label: 'Vidéo Référence', icon: Video, desc: 'Utiliser une image + une vidéo de référence pour générer une nouvelle vidéo' },
    ],
  },
];

// Flat list still needed for active tool lookup
const TOOLS = TOOL_GROUPS.flatMap(g => [...(g.tools || []), ...(g.library || [])].map(t => ({ ...t, color: g.color })));

// UI tool id → backend ToolPricing tool_id (where they differ)
const PRICING_ID_MAP = { dress_actor: 'character_sheet', compose: 'compose_scene', animate: 'animate_image', video_tools: 'ai_video' };

function uid() { return Math.random().toString(36).slice(2, 10); }
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ── Inline Dress Actor ────────────────────────────────────────────────────────
function InlineDressActor({ userEmail, onDone }) {
  const [characters, setCharacters] = useState([]);
  const [vaultFolders, setVaultFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderAssets, setFolderAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [costumeUrls, setCostumeUrls] = useState([]);
  const [costumeFolder, setCostumeFolder] = useState(null);
  const [costumeFolderAssets, setCostumeFolderAssets] = useState([]);
  const [loadingCostumeAssets, setLoadingCostumeAssets] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [promptMode, setPromptMode] = useState('preset'); // 'preset' | 'custom'
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [format, setFormat] = useState('4:3');
  const [resolvedRatio, setResolvedRatio] = useState(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const RATIOS = ['4:3', '3:4', '16:9', '9:16', '1:1'];

  const loadVault = () => {
    if (!userEmail) return;
    appClient.entities.VaultFolder.filter({ user_email: userEmail }, 'order', 50).then(setVaultFolders).catch(() => {});
  };

  useEffect(() => {
    if (!userEmail) return;
    appClient.entities.CharacterSheet.filter({ user_email: userEmail }).then(setCharacters).catch(() => {});
    loadVault();
  }, [userEmail]);

  const handleSelectFolder = async (folder) => {
    const fid = folder?.id || '__unfiled__';
    if (selectedFolder?.__id === fid) { setSelectedFolder(null); setFolderAssets([]); return; }
    setSelectedFolder({ ...folder, __id: fid });
    setLoadingAssets(true);
    const query = folder?.id ? { user_email: userEmail, folder_id: folder.id, media_type: 'image' } : { user_email: userEmail, folder_id: null, media_type: 'image' };
    const assets = await appClient.entities.VaultAsset.filter(query, '-created_date', 50).catch(() => []);
    setFolderAssets(assets);
    setLoadingAssets(false);
  };

  const handleSelectCostumeFolder = async (folder) => {
    const fid = folder?.id || '__unfiled__';
    if (costumeFolder?.__id === fid) { setCostumeFolder(null); setCostumeFolderAssets([]); return; }
    setCostumeFolder({ ...folder, __id: fid });
    setLoadingCostumeAssets(true);
    const query = folder?.id ? { user_email: userEmail, folder_id: folder.id, media_type: 'image' } : { user_email: userEmail, folder_id: null, media_type: 'image' };
    const assets = await appClient.entities.VaultAsset.filter(query, '-created_date', 50).catch(() => []);
    setCostumeFolderAssets(assets);
    setLoadingCostumeAssets(false);
  };

  const toggleCostumeUrl = (url) => {
    setCostumeUrls(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);
  };

  const handleGenerate = async () => {
    if (promptMode === 'custom' && !prompt.trim()) { setError('Write your own prompt, or switch to Preset.'); return; }
    setStatus('generating'); setError('');
    const charName = selectedChar?.character_name || selectedChar?.label || 'a character';
    const refImages = [];
    if (selectedChar?.url) refImages.push(selectedChar.url);
    else if (selectedChar?.character_photos?.[0]) {
      const raw = selectedChar.character_photos[0];
      try {
        const parsed = JSON.parse(raw);
        refImages.push(parsed.portrait || parsed.front || Object.values(parsed)[0]);
      } catch { refImages.push(raw); }
    }
    costumeUrls.forEach(u => refImages.push(u));
    const actorUrl = refImages[0];
    const costumeUrl = costumeUrls[0];
    try {
      const res = await appClient.functions.invoke('generateCharacterSheet', {
        image_urls: refImages,
        costume_url: costumeUrl,
        aspect_ratio: format,
        prompt_override: prompt.trim() || undefined,
        replace_preset: promptMode === 'custom' && !!prompt.trim(),
      });
      if (!res.data?.file_url) { setError(res.data?.error || 'Generation failed.'); setStatus('idle'); return; }
      setResultUrl(res.data.file_url);
      setResolvedRatio(res.data?.aspect_ratio || format);
      setShowSaveModal(true);
      setStatus('idle');
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error;
      setError(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more to use this tool.' : (msg || 'Generation failed. Please try again.'));
      setStatus('idle');
    }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Loader2 size={28} className="text-red-500 animate-spin" />
      <p className="text-black text-sm">Generating reference sheet… (2–4 min)</p>
    </div>
  );
  const folderColors = { red:'bg-red-500', orange:'bg-red-500', yellow:'bg-red-500', green:'bg-red-500', blue:'bg-red-500', purple:'bg-red-500', pink:'bg-red-500' };

  return (
    <div className="space-y-4">
      {/* Actor Reference — CharacterSheets first, then vault folders */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Actor Reference</p>

        {/* CharacterSheet actors */}
        {characters.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
            {characters.map(c => {
              const photo = c.character_photos?.[0];
              const sel = selectedChar?.id === c.id && !selectedChar?.url;
              return (
                <button key={`cs-${c.id}`} onClick={() => setSelectedChar(sel ? null : c)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${sel ? 'border-red-500 bg-red-500/20' : 'border-white/10 bg-white/5'}`}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10">
                    {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <Users size={20} className="m-auto mt-3 text-white" />}
                  </div>
                  <span className="text-white text-[10px] font-semibold w-16 text-center truncate">{c.character_name || 'Actor'}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Vault folders */}
        {vaultFolders.length === 0 && characters.length === 0 && (
          <button
            onClick={() => setVaultOpen(true)}
            className="w-full py-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-white text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
          >
            <Bookmark size={16} className="text-red-500" /> Open my Vault
          </button>
        )}
        {vaultFolders.length > 0 && (
          <div className="space-y-2 mt-2">
            <p className="text-white text-[10px] uppercase tracking-widest font-semibold">Vault Folders</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
              <button onClick={() => handleSelectFolder(null)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${selectedFolder?.__id === '__unfiled__' ? 'border-red-500 bg-red-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
                <Bookmark size={12} className="text-white flex-shrink-0" />
                Unfiled
              </button>
              {vaultFolders.map(f => {
                const isOpen = selectedFolder?.id === f.id;
                const dotColor = folderColors[f.color] || 'bg-red-500';
                return (
                  <button key={f.id} onClick={() => handleSelectFolder(f)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${isOpen ? 'border-red-500 bg-red-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                    {f.name}
                  </button>
                );
              })}
            </div>

            {/* Images inside selected folder */}
            {selectedFolder && (
              <div className="mt-2">
                {loadingAssets ? (
                  <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-white" /></div>
                ) : folderAssets.length === 0 ? (
                  <p className="text-white text-xs italic">No images in this folder</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                    {folderAssets.map(v => {
                      const sel = selectedChar?.id === v.id;
                      return (
                        <button key={v.id} onClick={() => setSelectedChar(sel ? null : { ...v, label: v.url.split('/').pop()?.split('_').slice(1).join(' ').replace(/\.[^.]+$/, '') || 'Actor' })}
                          className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${sel ? 'border-red-500 bg-red-500/20' : 'border-white/10 bg-white/5'}`}>
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10">
                            <img src={v.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          {sel && <CheckCircle2 size={12} className="text-red-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Show selected actor preview */}
        {selectedChar && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
              {selectedChar.url ? <img src={selectedChar.url} alt="" className="w-full h-full object-cover" /> : selectedChar.character_photos?.[0] ? <img src={selectedChar.character_photos[0]} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            <span className="text-red-400 text-xs font-semibold flex-1 truncate">{selectedChar.character_name || selectedChar.label || 'Selected'}</span>
            <button onClick={() => setSelectedChar(null)} className="text-white hover:text-white"><X size={12} /></button>
          </div>
        )}
      </div>

      {/* Costume reference — vault folders + multi-select + upload */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Costume Reference</p>

        {/* Vault folders for costume */}
        {vaultFolders.length > 0 && (
          <div className="space-y-2 mb-3">
            <p className="text-white text-[10px] uppercase tracking-widest font-semibold">Pick from Vault</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
              <button onClick={() => handleSelectCostumeFolder(null)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${costumeFolder?.__id === '__unfiled__' ? 'border-red-500 bg-red-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
                <Bookmark size={12} className="text-white flex-shrink-0" />
                Unfiled
              </button>
              {vaultFolders.map(f => {
                const isOpen = costumeFolder?.id === f.id;
                const dotColor = folderColors[f.color] || 'bg-red-500';
                return (
                  <button key={f.id} onClick={() => handleSelectCostumeFolder(f)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${isOpen ? 'border-red-500 bg-red-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
                    {f.name}
                  </button>
                );
              })}
            </div>

            {costumeFolder && (
              <div className="mt-1">
                {loadingCostumeAssets ? (
                  <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-white" /></div>
                ) : costumeFolderAssets.length === 0 ? (
                  <p className="text-white text-xs italic">No images in this folder</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                    {costumeFolderAssets.map(v => {
                      const sel = costumeUrls.includes(v.url);
                      return (
                        <button key={v.id} onClick={() => toggleCostumeUrl(v.url)}
                          className={`flex-shrink-0 relative p-1 rounded-xl border-2 transition-all ${sel ? 'border-red-500 bg-red-500/20' : 'border-white/10 bg-white/5'}`}>
                          <div className="w-14 h-14 rounded-lg overflow-hidden">
                            <img src={v.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          {sel && <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><CheckCircle2 size={10} className="text-white" /></div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Upload + selected previews */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="w-16 h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-red-500/40 rounded-xl cursor-pointer hover:border-red-500/70 transition-colors flex-shrink-0">
            <Shirt size={16} className="text-red-500" />
            <span className="text-red-500 text-[9px] font-bold text-center leading-tight">Upload</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
              const files = Array.from(e.target.files); if (!files.length) return;
              const urls = await Promise.all(files.map(f => appClient.integrations.Core.UploadFile({ file: f }).then(r => r.file_url)));
              setCostumeUrls(prev => [...prev, ...urls]);
            }} />
          </label>
          {costumeUrls.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setCostumeUrls(prev => prev.filter(u => u !== url))}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center text-white">
                <X size={8} />
              </button>
            </div>
          ))}
          {costumeUrls.length === 0 && <p className="text-white text-xs">No costume selected yet</p>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-white text-xs font-bold uppercase tracking-wider">Prompt</span>
          <div className="flex gap-1 bg-white/10 rounded-lg p-0.5">
            <button onClick={() => setPromptMode('preset')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${promptMode === 'preset' ? 'bg-red-700 text-white' : 'text-white hover:text-white'}`}>
              Preset
            </button>
            <button onClick={() => setPromptMode('custom')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${promptMode === 'custom' ? 'bg-red-700 text-white' : 'text-white hover:text-white'}`}>
              Custom
            </button>
          </div>
        </div>
        {promptMode === 'preset' ? (
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Add styling details… (optional, e.g. 'elegant evening look', 'streetwear vibe')" rows={2}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 resize-none" />
        ) : (
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Write your own full prompt… (replaces the built-in one)" rows={3}
            className="w-full bg-white/10 border border-red-500/40 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500/70 resize-none" />
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-white text-xs font-bold uppercase tracking-wider">Format</span>
        <div className="flex gap-1.5 flex-wrap">
          {RATIOS.map(r => (
            <button key={r} onClick={() => setFormat(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${format === r ? 'bg-red-700 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button onClick={handleGenerate} disabled={(!selectedChar && costumeUrls.length === 0) || (promptMode === 'custom' && !prompt.trim())}
        className="w-full py-4 bg-red-700 text-white font-bold rounded-2xl disabled:opacity-40 transition-opacity flex items-center justify-center gap-2">
        <Sparkles size={18} /> Dress Actor ({format}) →
      </button>

      {/* Result preview — shows after generation, before saving */}
      {resultUrl && !showSaveModal && (
        <div className="space-y-3">
          <p className="text-white text-xs font-bold uppercase tracking-wider">Result</p>
          <div className="rounded-2xl overflow-hidden bg-white/5 relative">
            <img src={resultUrl} alt="Character reference sheet" className="w-full max-h-[50vh] object-contain bg-black" />
            <span className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-red-500 text-xs font-bold rounded-full">
              Sent: {resolvedRatio || format}
            </span>
          </div>
          <button onClick={() => setShowSaveModal(true)}
            className="w-full py-3 bg-red-500 text-black font-bold rounded-2xl">
            Save to Vault →
          </button>
        </div>
      )}

      {showSaveModal && resultUrl && (
        <SaveToVaultModal
          userEmail={userEmail}
          imageUrl={resultUrl}
          mediaType="image"
          onSaved={(saved) => {
            setShowSaveModal(false);
            setResultUrl(null);
            onDone(resultUrl, 'image', saved.id);
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      <VaultDrawer
        open={vaultOpen}
        onClose={() => { setVaultOpen(false); loadVault(); }}
      />
    </div>
  );
}

// ── Inline Compose Scene ──────────────────────────────────────────────────────
function InlineCompose({ userEmail, onDone }) {
  const [vaultFolders, setVaultFolders] = useState([]);
  const [selectedCharFolder, setSelectedCharFolder] = useState(null);
  const [selectedSetFolder, setSelectedSetFolder] = useState(null);
  const [folderAssets, setFolderAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [tokenCost, setTokenCost] = useState(10);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resultUrl, setResultUrl] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    appClient.functions.invoke('manageToolPricing', { action: 'list' })
      .then(r => r.data.items.filter(p => p.tool_id === 'compose_scene' && p.is_active))
      .then(pricing => { if (pricing[0]) setTokenCost(pricing[0].token_cost); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    appClient.entities.VaultFolder.filter({ user_email: userEmail }, 'order', 50)
      .then(folders => setVaultFolders(folders))
      .catch(() => {});
  }, [userEmail]);

  const handleSelectCharFolder = async (folder) => {
    if (selectedCharFolder?.id === folder.id) { setSelectedCharFolder(null); setFolderAssets([]); return; }
    setSelectedCharFolder(folder);
    setLoadingAssets(true);
    const assets = await appClient.entities.VaultAsset.filter({ user_email: userEmail, folder_id: folder.id, media_type: 'image' }, '-created_date', 50).catch(() => []);
    console.log('Char folder assets:', assets.length, assets);
    setFolderAssets(assets);
    setLoadingAssets(false);
  };

  const handleSelectSetFolder = async (folder) => {
    if (selectedSetFolder?.id === folder.id) { setSelectedSetFolder(null); setFolderAssets([]); return; }
    setSelectedSetFolder(folder);
    setLoadingAssets(true);
    const assets = await appClient.entities.VaultAsset.filter({ user_email: userEmail, folder_id: folder.id, media_type: 'image' }, '-created_date', 50).catch(() => []);
    console.log('Set folder assets:', assets.length, assets);
    setFolderAssets(assets);
    setLoadingAssets(false);
  };

  const handleGenerate = async () => {
    if (!selectedSet && !uploadedPhoto) {
      setError('Please select a set or upload a photo first.');
      return;
    }
    if (!prompt.trim()) {
      setError('Please enter a prompt.');
      return;
    }
    setStatus('generating'); setError('');
    const charName = selectedChar?.label || selectedChar?.character_name || 'a person';
    const setName = selectedSet?.name || 'a cinematic set';
    const refImages = [];
    if (selectedChar?.character_photos?.[0]) refImages.push(selectedChar.character_photos[0]);
    if (selectedSet?.images?.[0]) refImages.push(selectedSet.images[0]);
    if (uploadedPhoto) refImages.unshift(uploadedPhoto);
    const genPrompt = selectedChar 
      ? `Cinematic production still: ${charName} in ${setName}. ${prompt} Professional film photography, dramatic lighting.`
      : `Cinematic production still: ${setName}. ${prompt} Professional film photography, dramatic lighting, atmospheric.`;
    try {
      const res = await appClient.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: genPrompt, reference_image_urls: refImages.slice(0, 3), aspect_ratio: aspectRatio });
      if (res.data?.file_url) { setResultUrl(res.data.file_url); setShowSaveModal(true); setStatus('idle'); }
      else if (res.data?.error) { setError(res.data.error.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : res.data.error); setStatus('idle'); }
      else { setError('Generation failed. Please try again.'); setStatus('idle'); }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error;
      setError(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'An error occurred. Please try again.'));
      setStatus('idle');
    }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Loader2 size={28} className="text-red-400 animate-spin" />
      <p className="text-black text-sm">Generating scene… (1–3 min)</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Debug info */}
      <div className="bg-white/5 rounded-lg p-3 text-xs text-white">
        <p>User: {userEmail || 'none'}</p>
        <p>Vault Folders: {vaultFolders.length}</p>
        <p>Selected: {selectedChar?.label || 'none'} | {selectedSet?.name || 'none'}</p>
      </div>

      {/* Vault folders for picking characters */}
      <div className="space-y-2">
        <p className="text-white text-xs font-bold uppercase tracking-wider">Pick Character from Vault</p>
        {vaultFolders.length === 0 ? (
          <p className="text-white text-xs italic">No vault folders yet</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
              {vaultFolders.map(f => {
                const folderColors = { red:'bg-red-500', orange:'bg-red-500', yellow:'bg-red-500', green:'bg-red-500', blue:'bg-red-500', purple:'bg-red-500', pink:'bg-red-500' };
                const isOpen = selectedCharFolder?.id === f.id;
                const dotColor = folderColors[f.color] || 'bg-red-500';
                return (
                  <button key={f.id} onClick={() => handleSelectCharFolder(f)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-semibold ${isOpen ? 'border-red-500 bg-red-500/20 text-white' : 'border-white/20 bg-white/10 text-white'}`}>
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    {f.name}
                  </button>
                );
              })}
            </div>

            {/* Assets in selected folder for characters */}
            {selectedCharFolder && (
              <div className="mt-2">
                {loadingAssets ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-white" /></div>
                ) : folderAssets.length === 0 ? (
                  <p className="text-white text-xs italic">No images in this folder</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                    {folderAssets.map(v => {
                      const sel = selectedChar?.id === v.id;
                      return (
                        <button key={v.id} onClick={() => setSelectedChar(sel ? null : { ...v, label: v.url.split('/').pop()?.split('_').slice(1).join(' ').replace(/\.[^.]+$/, '') || 'Actor', character_photos: [v.url] })}
                          className={`flex-shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${sel ? 'border-red-500 bg-red-500/20' : 'border-white/20 bg-white/10'}`}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10">
                            <img src={v.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="text-white text-[9px] font-semibold w-14 text-center truncate">👤 Actor</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Vault folders for sets */}
      {vaultFolders.length > 0 && (
        <div className="space-y-2">
          <p className="text-white text-xs font-bold uppercase tracking-wider">Pick Set from Vault Folders</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
            {vaultFolders.map(f => {
              const folderColors = { red:'bg-red-500', orange:'bg-red-500', yellow:'bg-red-500', green:'bg-red-500', blue:'bg-red-500', purple:'bg-red-500', pink:'bg-red-500' };
              const isOpen = selectedSetFolder?.id === f.id;
              const dotColor = folderColors[f.color] || 'bg-red-500';
              return (
                <button key={f.id} onClick={() => handleSelectSetFolder(f)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-semibold ${isOpen ? 'border-red-500 bg-red-500/20 text-white' : 'border-white/20 bg-white/10 text-white'}`}>
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  {f.name}
                </button>
              );
            })}
          </div>

          {/* Images inside selected folder for sets */}
          {selectedSetFolder && (
            <div className="mt-2">
              {loadingAssets ? (
                <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-white" /></div>
              ) : folderAssets.length === 0 ? (
                <p className="text-white text-xs italic">No images in this folder</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                  {folderAssets.map(v => {
                    const sel = selectedSet?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => setSelectedSet(sel ? null : { ...v, name: v.url.split('/').pop()?.split('_').slice(1).join(' ').replace(/\.[^.]+$/, '') || 'Set', images: [v.url] })}
                        className={`flex-shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${sel ? 'border-red-500 bg-red-500/20' : 'border-white/20 bg-white/10'}`}>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10">
                          <img src={v.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-white text-[9px] font-semibold w-14 text-center truncate">🎬 Set</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Aspect Ratio</p>
        <div className="flex gap-2">
          <button 
            onClick={() => setAspectRatio('16:9')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${aspectRatio === '16:9' ? 'bg-red-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            16:9
          </button>
          <button 
            onClick={() => setAspectRatio('4:3')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${aspectRatio === '4:3' ? 'bg-red-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            4:3
          </button>
          <button 
            onClick={() => setAspectRatio('9:16')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${aspectRatio === '9:16' ? 'bg-red-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            9:16
          </button>
        </div>
      </div>

      {/* Upload your own photo */}
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-3">Or Upload Photo</p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 px-4 py-3 bg-red-500 text-black rounded-xl cursor-pointer hover:bg-red-400 transition-colors font-semibold text-sm">
            <Upload size={16} className="text-black" />
            <span>Upload Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={async e => {
              const f = e.target.files[0]; if (!f) return;
              const { file_url } = await appClient.integrations.Core.UploadFile({ file: f });
              setUploadedPhoto(file_url);
            }} />
          </label>
          {uploadedPhoto && (
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden">
                <img src={uploadedPhoto} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-red-500 text-xs font-semibold">✓ Ready</span>
              <button onClick={() => setUploadedPhoto(null)} className="text-white hover:text-white"><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2">Prompt <span className="text-red-400">*</span></p>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Required: Describe mood, action, lighting…" rows={2}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500 resize-none" />
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <button onClick={handleGenerate} disabled={(!selectedSet && !uploadedPhoto) || !prompt.trim()}
        className="w-full py-4 bg-red-500 text-black font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-400 transition-colors flex items-center justify-center gap-2 text-base">
        <Wand2 size={18} /> Voir le prix → (à partir de {tokenCost} Ⓣ)
      </button>

      {/* Result preview — shows after generation, before saving */}
      {resultUrl && !showSaveModal && (
        <div className="space-y-3">
          <p className="text-white text-xs font-bold uppercase tracking-wider">Result</p>
          <div className="rounded-2xl overflow-hidden bg-white/5 relative">
            <img src={resultUrl} alt="Composed scene" className="w-full max-h-[50vh] object-contain bg-black" />
            <span className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-red-500 text-xs font-bold rounded-full">
              {aspectRatio}
            </span>
          </div>
          <button onClick={() => setShowSaveModal(true)}
            className="w-full py-3 bg-red-500 text-black font-bold rounded-2xl">
            Save to Vault →
          </button>
        </div>
      )}

      {showSaveModal && resultUrl && (
        <SaveToVaultModal
          userEmail={userEmail}
          imageUrl={resultUrl}
          mediaType="image"
          onSaved={(saved) => {
            setShowSaveModal(false);
            const url = resultUrl;
            setResultUrl(null);
            onDone(url, 'image', saved.id);
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

// ── Inline Voice Recorder ─────────────────────────────────────────────────────
function InlineVoiceRecorder({ onDone }) {
  const [recState, setRecState] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr; chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); setRecState('preview'); };
    mr.start(); setElapsed(0); setRecState('recording');
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };
  const stop = () => { clearInterval(timerRef.current); mediaRecorderRef.current?.stop(); };
  const submit = async () => {
    setRecState('uploading');
    const { file_url } = await appClient.integrations.Core.UploadFile({ file: new File([audioBlob], 'rec.webm', { type: 'audio/webm' }) });
    onDone(file_url, 'audio');
  };

  return (
    <div className="space-y-4">
      {recState === 'idle' && (
        <button onClick={start} className="w-full py-6 bg-black text-red-500 font-bold rounded-2xl flex items-center justify-center gap-3 text-lg">
          <Mic size={24} /> Start Recording
        </button>
      )}
      {recState === 'recording' && (
        <div className="flex items-center justify-between px-6 py-5 bg-black rounded-2xl">
          <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /><span className="text-red-500 font-mono text-xl">{fmt(elapsed)}</span></div>
          <button onClick={stop} className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"><Square size={20} className="text-white fill-white" /></button>
        </div>
      )}
      {recState === 'preview' && (
        <div className="space-y-3">
          <audio src={audioUrl} controls className="w-full" />
          <div className="flex gap-3">
            <button onClick={() => { setAudioBlob(null); setAudioUrl(null); setRecState('idle'); }} className="flex-1 py-3 border-2 border-black/20 rounded-2xl text-black font-semibold">Re-record</button>
            <button onClick={submit} className="flex-1 py-3 bg-black text-red-500 font-bold rounded-2xl">Use This →</button>
          </div>
        </div>
      )}
      {recState === 'uploading' && (
        <div className="flex items-center gap-3 py-6 justify-center"><Loader2 size={20} className="animate-spin text-black" /><span className="text-black">Uploading…</span></div>
      )}
    </div>
  );
}

// ── Token Balance Display ─────────────────────────────────────────────────────
function TokenBalance({ userEmail, onBuyTokens }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) { setLoading(false); return; }
    appClient.functions.invoke('getUserBalance', {})
      .then(res => {
        if (res.data) setBalance(res.data.balance);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userEmail]);

  if (loading) return <div className="text-black text-sm">Chargement…</div>;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-black/10 rounded-2xl">
      <div className="flex-1">
        <p className="text-black text-[10px] font-bold uppercase tracking-wider">Solde de jetons</p>
        <p className="text-black text-xl font-black">{balance ?? 0}</p>
      </div>
      <button onClick={onBuyTokens} className="px-4 py-2 bg-black text-red-500 text-xs font-bold rounded-xl hover:opacity-90">
        Acheter des jetons →
      </button>
    </div>
  );
}

// ── Main LabWorkspace ─────────────────────────────────────────────────────────
export default function LabWorkspace({ user, onOpenActor, onOpenSet, onOpenVoiceRecorder, onOpenAudioUploader, onOpenDubbing, onOpenTTS, onOpenVideo, onOpenLipSync, onOpenAnimateImage, onJoinProject, onOpenFreeTimeline, hideProjects = false }) {
  const [activeTool, setActiveTool] = useState(null);
  const [results, setResults] = useState([]); // { id, url, type, label }
  const [loadingResults, setLoadingResults] = useState(true);
  const [balance, setBalance] = useState(null);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [toolPricing, setToolPricing] = useState({});
  const [animateRatio, setAnimateRatio] = useState('16:9');
  const VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3'];

  // Load balance, workspace results, and tool pricing
  useEffect(() => {
    if (!user?.email) { setLoadingResults(false); return; }
    
    // Load balance
    appClient.functions.invoke('getUserBalance', {})
      .then(res => {
        if (res.data) setBalance(res.data.balance);
      })
      .catch(() => {});
    
    // Load tool pricing
    appClient.functions.invoke('manageToolPricing', { action: 'list' })
      .then(r => r.data.items.filter(p => p.is_active))
      .then(pricing => {
        const map = {};
        pricing.forEach(p => { map[p.tool_id] = p.token_cost; });
        setToolPricing(map);
      })
      .catch(() => {});
    
    // Load workspace results
    appClient.entities.VaultAsset.filter({ user_email: user.email, asset_category: 'reference' }, '-created_date', 50)
      .then(assets => {
        const mapped = assets
          .filter(a => a.url)
          .map(a => ({ id: a.id, url: a.url, type: a.media_type || 'image', label: 'Workspace' }));
        setResults(mapped);
      })
      .catch(() => {})
      .finally(() => setLoadingResults(false));
  }, [user?.email]);

  const handleResult = async (url, type, label, alreadySavedId) => {
    setActiveTool(null);
    // If already saved (e.g. via SaveToVaultModal), skip creating another VaultAsset
    if (alreadySavedId) {
      const newResult = { id: alreadySavedId, url, type, label: label || type };
      setResults(prev => [newResult, ...prev]);
      return;
    }
    toast.success('Created! Saving to your workspace…');
    const vaultMediaType = (type === 'video') ? 'video' : 'image';
    const saved = await appClient.entities.VaultAsset.create({
      user_email: user?.email || '',
      url,
      media_type: vaultMediaType,
      asset_category: 'reference',
    }).catch(() => null);
    const newResult = { id: saved?.id || uid(), url, type, label: label || type };
    setResults(prev => [newResult, ...prev]);
    toast.success('Saved to your workspace!');
  };

  // Tools that open modals in Studio (passed as callbacks)
  const handleToolClick = (toolId) => {
    if (toolId === 'voice') { onOpenVoiceRecorder(); return; }
    if (toolId === 'dubbing') { onOpenDubbing(); return; }
    if (toolId === 'tts') { onOpenTTS(); return; }
    if (toolId === 'video_tools') { onOpenVideo('video'); return; }
    if (toolId === 'lip_sync') { onOpenLipSync?.(); return; }
    if (toolId === 'ai_video') { onOpenVideo('text'); return; }
    if (toolId === 'animate') { onOpenAnimateImage?.(); return; }
    if (toolId === 'free_timeline') { onOpenFreeTimeline?.(); return; }
    if (toolId === activeTool) { setActiveTool(null); return; }
    setActiveTool(toolId);
    // Scroll to the tool panel after a short delay
    setTimeout(() => {
      const panel = document.getElementById('active-tool-panel');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const refreshBalance = () =>
    appClient.functions.invoke('getUserBalance', {})
      .then((res) => { if (res.data) setBalance(res.data.balance); })
      .catch(() => {});

  return (
    <div className="space-y-6">
      {/* Balance Header */}
      <div className="flex items-center justify-between bg-black rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-black font-black text-lg">Ⓣ</span>
          </div>
          <div>
            <p className="text-white text-xs font-bold uppercase tracking-wider">Solde de jetons</p>
            <p className="text-red-500 text-2xl font-black">{balance !== null ? balance : '...'}</p>
          </div>
        </div>
        <button
          onClick={() => setShowBuyTokens(true)}
          className="px-4 py-2 bg-red-500 text-black font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus size={16} /> Acheter des jetons
        </button>
      </div>

      {/* Available Projects */}
      {!hideProjects && <AvailableProjectsPortal onJoinProject={onJoinProject} />}

      {/* Active tool panel */}
      <AnimatePresence>
        {activeTool && (
          <motion.div
            key={activeTool}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-black rounded-3xl p-6 shadow-2xl border-2 border-red-500/30"
            id="active-tool-panel"
          >
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 ${TOOL_GROUPS.find(g => g.tools.some(t => t.id === activeTool))?.color || 'bg-red-700'} rounded-lg flex items-center justify-center`}>
                  {(() => {
                    const tool = TOOLS.find(t => t.id === activeTool);
                    const Icon = tool?.icon;
                    return Icon ? <Icon size={16} className="text-white" /> : null;
                  })()}
                </div>
                <p className="text-red-500 text-lg font-bold">{TOOLS.find(t => t.id === activeTool)?.label}</p>
              </div>
              <button onClick={() => setActiveTool(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
                <X size={16} />
              </button>
            </div>

            {activeTool === 'dress_actor' && (
              <InlineDressActor userEmail={user?.email} onDone={(url, type, savedId) => handleResult(url, type, 'Dressed Actor', savedId)} />
            )}
            {activeTool === 'headshot' && (
              <InlineHeadshot userEmail={user?.email} onDone={(url, type, savedId) => handleResult(url, type, 'Headshot', savedId)} />
            )}
            {activeTool === 'compose' && (
              <InlineCompose userEmail={user?.email} onDone={(url, type) => handleResult(url, type, 'Scene')} />
            )}
            {activeTool === 'animate' && (
              <div className="space-y-3">
                <p className="text-white text-sm">Upload an image to animate it into a video.</p>
                <div className="mb-3">
                  <p className="text-white text-[10px] uppercase tracking-widest font-semibold mb-1.5">Aspect Ratio</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {VIDEO_RATIOS.map(r => (
                      <button key={r} onClick={() => setAnimateRatio(r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${animateRatio === r ? 'bg-red-700 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-red-500 rounded-2xl cursor-pointer hover:border-red-500">
                  <Upload size={24} className="text-red-500" />
                  <span className="text-white text-sm">Upload image to animate</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                     const f = e.target.files[0]; if (!f) return;
                     try {
                       const { file_url } = await appClient.integrations.Core.UploadFile({ file: f });
                       const res = await appClient.functions.invoke('replicateGenerate', { method: 'animate_image', photo_url: file_url, aspect_ratio: animateRatio });
                       if (res.data?.file_url) handleResult(res.data.file_url, 'video', 'Animated');
                       else toast.error(res.data?.error || 'Animation failed');
                     } catch (err) {
                       const msg = err.response?.data?.message || err.response?.data?.error;
                       toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Animation failed'));
                     }
                   }} />
                </label>
              </div>
            )}
            {activeTool === 'lip_sync' && (
              <div className="space-y-3">
                <p className="text-white text-sm">Upload a video + audio to lip sync.</p>
                <p className="text-white text-xs">Use the full Video Tools for lip sync →</p>
                <button onClick={() => { setActiveTool(null); onOpenVideo(); }}
                  className="w-full py-3 bg-red-700 text-white font-semibold rounded-2xl">Open Video Tools →</button>
              </div>
            )}
            {activeTool === 'ai_video' && (
              <div className="space-y-3">
                <p className="text-white text-sm">Generate video from a text prompt.</p>
                <button onClick={() => { setActiveTool(null); onOpenVideo(); }}
                  className="w-full py-3 bg-red-700 text-white font-semibold rounded-2xl">Open Video Tools →</button>
              </div>
            )}
            {activeTool === 'generate_3d' && (
              <Inline3DModel userEmail={user?.email} onDone={(url, type, savedId) => handleResult(url, type, '3D Model', savedId)} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool groups */}
      <div className="space-y-5">
        {TOOL_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-black text-sm font-black uppercase tracking-widest mb-3 text-center">{group.label}</p>
            <div className="grid grid-cols-2 gap-3">
              {group.tools.map(tool => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                const cost = toolPricing[PRICING_ID_MAP[tool.id] || tool.id];
                return (
                  <motion.button key={tool.id} whileTap={{ scale: 0.97 }} onClick={() => handleToolClick(tool.id)}
                    className={`flex flex-col items-start gap-3 p-5 rounded-3xl shadow-lg transition-all ${isActive ? 'bg-black ring-2 ring-red-500' : 'bg-black hover:opacity-90'}`}>
                    <div className={`w-12 h-12 ${group.color} rounded-2xl flex items-center justify-center`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-white text-sm font-bold">{tool.label}</p>
                      <p className="text-white text-[11px] leading-tight mt-0.5">{tool.desc}</p>
                    </div>
                    {cost !== undefined && (
                      <span className="text-red-500 text-xs font-black bg-black/50 px-2 py-1 rounded-full">
                        À partir de {cost} Ⓣ
                      </span>
                    )}
                  </motion.button>
                );
              })}
              {group.library?.map(item => {
                const Icon = item.icon;
                const onClick = item.id === 'new_actor' ? onOpenActor : onOpenSet;
                return (
                  <motion.button key={item.id} whileTap={{ scale: 0.97 }} onClick={onClick}
                    className="flex flex-col items-start gap-3 p-5 bg-black rounded-3xl shadow-lg hover:opacity-90">
                    <div className={`w-12 h-12 ${group.color} rounded-2xl flex items-center justify-center`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-bold">{item.label}</p>
                      <p className="text-white text-[11px] leading-tight mt-0.5">{item.desc}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Results workspace */}
      {(loadingResults || results.length > 0) && (
        <div>
          <p className="text-black text-sm font-black uppercase tracking-widest mb-3 text-center">Your Workspace</p>
          {loadingResults ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-black" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map(r => (
                <div key={r.id} className="bg-black rounded-2xl overflow-hidden relative">
                  {r.type === 'video' ? (
                    <video src={r.url} controls className="w-full aspect-square object-cover" />
                  ) : r.type === 'audio' ? (
                    <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-white/5">
                      <Mic size={28} className="text-red-500" />
                      <audio src={r.url} controls className="w-full px-2" />
                    </div>
                  ) : r.type === 'model' ? (
                    <div className="aspect-square flex flex-col items-center justify-center gap-2 bg-white/5">
                      <Box size={28} className="text-red-500" />
                      <a href={r.url} target="_blank" rel="noopener noreferrer" download className="text-white text-xs font-bold underline">.glb</a>
                    </div>
                  ) : (
                    <img src={r.url} alt="" className="w-full aspect-square object-cover" />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 px-3 py-2 flex items-center justify-between">
                    <p className="text-white text-xs font-semibold">{r.label}</p>
                    <button
                      onClick={async () => {
                        setResults(prev => prev.filter(x => x.id !== r.id));
                        await appClient.entities.VaultAsset.delete(r.id).catch(() => {});
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white hover:text-white"
                    >
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buy Tokens Modal */}
      {showBuyTokens && <TokenPurchaseModal onClose={() => setShowBuyTokens(false)} onPurchased={refreshBalance} />}
    </div>
  );
}
