import React, { useState, useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Bookmark, Check, Sparkles, Camera, Folder, ChevronDown, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import VaultDrawer from '@/components/VaultDrawer';

const PHOTO_SLOTS = [
  { key: 'front',    label: 'Corps de face',    placeholder: '/media/placeholders/silhouette-corps-face-v2.png' },
  { key: 'back',     label: 'Corps de dos',     placeholder: '/media/placeholders/silhouette-corps-dos-v2.png' },
  { key: 'side',     label: 'Corps de profil',  placeholder: '/media/placeholders/silhouette-corps-profil-v2.png' },
  { key: 'portrait', label: 'Portrait de face', placeholder: '/media/placeholders/silhouette-portrait-face-v2.png' },
  { key: 'profile',  label: 'Visage de profil', placeholder: '/media/placeholders/silhouette-visage-profil-v2.png' },
];

export default function CharacterSheetEditor({ sheet, userEmail, onClose }) {
  const qc = useQueryClient();

  const [name, setName] = useState(sheet?.character_name || '');
  const [selectedCostume, setSelectedCostume] = useState(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});

  const { data: vaultFolders = [] } = useQuery({
    queryKey: ['vaultFoldersForSheet', userEmail],
    queryFn: () => appClient.entities.VaultFolder.filter({ user_email: userEmail }, 'order'),
    enabled: !!userEmail,
  });

  const { data: vaultAssets = [], refetch: refetchVault } = useQuery({
    queryKey: ['vaultAssetsForSheet', userEmail],
    queryFn: () => appClient.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date'),
    enabled: !!userEmail,
  });

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const [photos, setPhotos] = useState(() => {
    const raw = sheet?.character_photos;
    if (!raw || raw.length === 0) return {};
    try { return JSON.parse(raw[0]); } catch { return {}; }
  });
  const [uploading, setUploading] = useState(null);
  const [cameraSlot, setCameraSlot] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedSheet, setGeneratedSheet] = useState(sheet?.voice_sample_url || null);
  const [tokenCost, setTokenCost] = useState(10);
  const [aspectRatio, setAspectRatio] = useState('4:3');
  const [referenceLayout, setReferenceLayout] = useState(null);
  const [accessories, setAccessories] = useState('');
  const RATIOS = ['4:3', '3:4', '16:9', '9:16', '1:1'];

  const photoCount = Object.keys(photos).length;
  const canGenerate = photoCount > 0;

  // Fetch token cost on mount
  React.useEffect(() => {
    appClient.functions.invoke('manageToolPricing', { action: 'list' })
      .then(r => r.data.items.filter(p => p.tool_id === 'character_sheet' && p.is_active))
      .then(pricing => {
        if (pricing[0]) setTokenCost(pricing[0].token_cost);
      })
      .catch(() => {});
  }, []);

  const uploadPhoto = async (file, slotKey) => {
    if (!file) return;
    setUploading(slotKey);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setPhotos(p => ({ ...p, [slotKey]: file_url }));
    } finally {
      setUploading(null);
    }
  };

  const handleUpload = (e, slotKey) => uploadPhoto(e.target.files[0], slotKey);

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setCameraStream(null);
    setCameraSlot(null);
    setCameraError('');
  };

  const openCamera = async (slotKey) => {
    setCameraSlot(slotKey);
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('La caméra n’est pas disponible dans ce navigateur.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraStream(stream);
    } catch {
      setCameraError('L’accès à la caméra a été refusé ou la caméra est indisponible.');
    }
  };

  const capturePhoto = async () => {
    const video = cameraVideoRef.current;
    if (!video || !cameraSlot || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const slotKey = cameraSlot;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    stopCamera();
    await uploadPhoto(new File([blob], `photo-${slotKey}.jpg`, { type: 'image/jpeg' }), slotKey);
  };

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const removePhoto = (slotKey) => setPhotos(p => { const n = { ...p }; delete n[slotKey]; return n; });

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const imageUrls = PHOTO_SLOTS.map(s => photos[s.key]).filter(Boolean);
      const res = await appClient.functions.invoke('generateCharacterSheet', { image_urls: imageUrls, costume_url: selectedCostume, aspect_ratio: aspectRatio, reference_layout_url: referenceLayout, accessories });
      if (res.data?.file_url) {
        setGeneratedSheet(res.data.file_url);
      } else if (res.data?.error) {
        alert(res.data.error === 'Insufficient token balance' 
          ? `Jetons insuffisants. Cette génération coûte ${res.data.cost} jetons (solde : ${res.data.balance}).` 
          : res.data.error);
      }
    } catch (e) {
      console.error('Generation error:', e);
      alert('La génération a échoué. Veuillez réessayer.');
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const data = {
      user_email: userEmail,
      character_name: name,
      character_photos: [JSON.stringify(photos)],
      voice_sample_url: generatedSheet || '',
    };
    if (sheet?.id) {
      await appClient.entities.CharacterSheet.update(sheet.id, data);
    } else {
      await appClient.entities.CharacterSheet.create(data);
    }
    qc.invalidateQueries({ queryKey: ['characterSheet', userEmail] });
    setSaving(false);
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-zinc-950 text-white flex flex-col overflow-hidden"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-wide">Nouvel acteur</h2>
          <button onClick={onClose} aria-label="Fermer" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-32">
        <div className="w-full max-w-6xl mx-auto space-y-8">

        {/* Nom */}
        <div>
          <label className="block text-white text-sm font-medium mb-2">Nom du personnage</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex. : Noir, Vesper, L’Oracle…"
            className="w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-4 text-white text-base placeholder-white/25 focus:outline-none focus:border-white/40"
          />
        </div>

        {/* ── ÉTAPE 1 : Photos ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${photoCount > 0 ? 'bg-red-500 text-white' : 'bg-red-600 text-white'}`}>
              {photoCount > 0 ? <Check size={16} /> : '1'}
            </div>
            <div>
              <p className="text-white font-semibold text-base">Photos de référence</p>
              <p className="text-white/80 text-sm">{photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? 's ajoutées' : ' ajoutée'}` : 'Au moins une photo du corps entier sur fond neutre'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {PHOTO_SLOTS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <p className="text-white/80 text-sm font-medium mb-2">{label}</p>
                {photos[key] ? (
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
                    <img src={photos[key]} alt={label} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(key)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors"
                    >
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="aspect-[3/4] max-h-[260px] rounded-2xl border border-dashed border-white/25 overflow-hidden flex flex-col bg-white/[0.04]">
                    <div className="flex-1 relative min-h-0 bg-black overflow-hidden">
                      <img
                        src={placeholder}
                        alt={`Silhouette de référence : ${label}`}
                        className="absolute inset-0 w-full h-full object-contain opacity-75"
                      />
                      <div className="absolute inset-0 flex items-end justify-center pb-3 bg-gradient-to-t from-black/70 via-transparent to-transparent">
                        <span className="px-3 py-1 rounded-full bg-black/60 text-center text-[11px] text-white/85">Ajouter une photo</span>
                      </div>
                    </div>
                    {/* Buttons */}
                    <div className="flex border-t border-white/20 flex-shrink-0">
                      <label className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 cursor-pointer hover:bg-white/10 transition-colors">
                        {uploading === key ? (
                          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Upload size={18} className="text-white/80" />
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, key)} />
                      </label>
                      <div className="w-px bg-white/20" />
                      <button
                        type="button"
                        onClick={() => openCamera(key)}
                        aria-label={`Prendre une photo : ${label}`}
                        className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 cursor-pointer hover:bg-white/10 transition-colors"
                      >
                        <Camera size={18} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── ÉTAPE 2 : Costume ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${selectedCostume ? 'bg-red-500 text-white' : 'bg-red-600 text-white'}`}>
              {selectedCostume ? <Check size={16} /> : '2'}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-base">Costume <span className="text-white/35 font-normal text-sm">(facultatif)</span></p>
              <p className="text-white/80 text-sm">{selectedCostume ? 'Costume sélectionné ✓' : 'Choisissez un costume enregistré dans votre coffre'}</p>
            </div>
            {selectedCostume && (
              <img src={selectedCostume} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-red-500" />
            )}
          </div>

          {vaultAssets.length === 0 ? (
            <button
              onClick={() => setVaultOpen(true)}
              className="w-full py-4 bg-white/5 border border-dashed border-white/20 rounded-2xl text-white text-sm flex items-center justify-center gap-3 hover:bg-white/8 transition-colors"
            >
              <Bookmark size={18} className="text-red-500" />
              Ouvrir mon coffre
            </button>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {/* Unfiled */}
              {vaultAssets.filter(a => !a.folder_id).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-white text-xs uppercase tracking-wider">
                    <Folder size={14} />
                    Sans dossier
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => setSelectedCostume(null)}
                      className={`aspect-square rounded-xl border-2 flex items-center justify-center text-xs font-medium transition-all ${!selectedCostume ? 'border-red-500 bg-red-500/15 text-red-500' : 'border-white/15 text-white hover:border-white/30'}`}
                    >
                      Aucun
                    </button>
                    {vaultAssets.filter(a => !a.folder_id).map(asset => (
                      <div
                        key={asset.id}
                        onClick={() => setSelectedCostume(selectedCostume === asset.url ? null : asset.url)}
                        className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectedCostume === asset.url ? 'border-red-500' : 'border-transparent hover:border-white/30'}`}
                      >
                        {asset.media_type === 'video'
                          ? <video src={asset.url} className="w-full h-full object-cover" muted playsInline />
                          : <img src={asset.url} alt="" className="w-full h-full object-cover" />
                        }
                        {selectedCostume === asset.url && (
                          <div className="absolute inset-0 bg-red-500/25 flex items-center justify-center">
                            <Check size={14} className="text-red-500" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Folders */}
              {vaultFolders.map((folder) => {
                const folderAssets = vaultAssets.filter(a => a.folder_id === folder.id);
                const isExpanded = expandedFolders[folder.id] ?? false;
                const folderColors = {
                  red: 'bg-red-500/20 border-red-500/40',
                  orange: 'bg-red-500/20 border-red-500/40',
                  yellow: 'bg-red-500/20 border-red-500/40',
                  green: 'bg-red-500/20 border-red-500/40',
                  blue: 'bg-red-500/20 border-red-500/40',
                  purple: 'bg-red-500/20 border-red-500/40',
                  pink: 'bg-red-500/20 border-red-500/40',
                };

                return (
                  <div key={folder.id} className="space-y-2">
                    <div
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border ${folderColors[folder.color]} cursor-pointer`}
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown size={14} className={`text-white transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
                        <Folder size={14} className="text-white" />
                        <span className="text-white text-sm font-bold">{folder.name}</span>
                        <span className="text-white text-xs font-semibold">({folderAssets.length})</span>
                      </div>
                    </div>

                    {isExpanded && folderAssets.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 pl-2">
                        {folderAssets.map(asset => (
                          <div
                            key={asset.id}
                            onClick={() => setSelectedCostume(selectedCostume === asset.url ? null : asset.url)}
                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectedCostume === asset.url ? 'border-red-500' : 'border-transparent hover:border-white/30'}`}
                          >
                            {asset.media_type === 'video'
                              ? <video src={asset.url} className="w-full h-full object-cover" muted playsInline />
                              : <img src={asset.url} alt="" className="w-full h-full object-cover" />
                            }
                            {selectedCostume === asset.url && (
                              <div className="absolute inset-0 bg-red-500/25 flex items-center justify-center">
                                <Check size={14} className="text-red-500" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => setVaultOpen(true)}
                className="w-full py-3 text-white text-sm flex items-center justify-center gap-2 hover:text-white/80 transition-colors"
              >
                <Bookmark size={14} />
                Gérer mon coffre
              </button>
            </div>
          )}
        </div>

        {/* ── ÉTAPE 2b : Layout Reference + Accessories ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${referenceLayout ? 'bg-red-500 text-white' : 'bg-white/15 text-white'}`}>
              {referenceLayout ? <Check size={16} /> : '+'}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-base">Modèle de disposition <span className="text-white/35 font-normal text-sm">(facultatif)</span></p>
              <p className="text-white/80 text-sm">Ajoutez une fiche de référence pour reprendre sa disposition</p>
            </div>
            {referenceLayout && (
              <img src={referenceLayout} alt="" className="w-12 h-12 rounded-xl object-cover border-2 border-red-500" />
            )}
          </div>

          {referenceLayout ? (
            <div className="relative aspect-[16/9] rounded-2xl overflow-hidden">
              <img src={referenceLayout} alt="Modèle de disposition" className="w-full h-full object-contain bg-white/5" />
              <button
                onClick={() => setReferenceLayout(null)}
                className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <label className="block w-full py-4 bg-white/5 border border-dashed border-white/20 rounded-2xl text-white text-sm flex flex-col items-center justify-center gap-2 hover:bg-white/8 transition-colors cursor-pointer">
              <Upload size={18} className="text-red-500" />
              Ajouter un modèle de disposition
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files[0]; if (!file) return;
                setUploading('layout');
                const { file_url } = await appClient.integrations.Core.UploadFile({ file });
                setReferenceLayout(file_url);
                setUploading(null);
              }} />
            </label>
          )}

          <div className="mt-4">
            <label className="block text-white text-sm font-medium mb-2">Accessoires <span className="text-white/35 font-normal text-xs">(facultatif)</span></label>
            <input
              value={accessories}
              onChange={e => setAccessories(e.target.value)}
              placeholder="Ex. : boucles d’oreilles argentées, bottes noires, ceinture de cuir"
              className="w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-3 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/40"
            />
          </div>
        </div>

        {/* ── ÉTAPE 3 : Générer ── */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${generatedSheet ? 'bg-red-500 text-white' : 'bg-red-600 text-white'}`}>
              {generatedSheet ? <Check size={16} /> : '3'}
            </div>
            <div>
              <p className="text-white font-semibold text-base">Générer la fiche du personnage</p>
              <p className="text-white/80 text-sm">
                {canGenerate
                  ? `${photoCount} photo${photoCount > 1 ? 's' : ''}${selectedCostume ? ' + costume' : ''} prête${photoCount > 1 ? 's' : ''}`
                  : 'Ajoutez d’abord au moins une photo'}
              </p>
            </div>
          </div>

          {/* Aspect ratio selector */}
          <div className="mb-4">
            <p className="text-white text-xs uppercase tracking-wider mb-2">Format de sortie</p>
            <div className="flex gap-2 flex-wrap">
              {RATIOS.map(r => (
                <button key={r} onClick={() => setAspectRatio(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${aspectRatio === r ? 'bg-red-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {generatedSheet && (
            <div className="mb-4 rounded-2xl overflow-hidden">
              <img src={generatedSheet} alt="Fiche du personnage générée" className="w-full object-contain" />
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!canGenerate || generating}
            className="w-full py-5 rounded-2xl text-base font-bold tracking-wide transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed bg-red-500 hover:bg-red-400 text-black"
          >
            {generating ? (
              <>
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Génération… (environ 1 min)
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {generatedSheet ? 'Régénérer' : 'Générer ma fiche de personnage'}
                <span className="ml-2 px-3 py-1 bg-black/20 rounded-full text-xs font-black flex items-center gap-1">
                  <Coins size={10} /> {tokenCost} Ⓣ
                </span>
              </>
            )}
          </button>
        </div>

        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-4 bg-zinc-950 border-t border-white/10">
        <div className="w-full max-w-6xl mx-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-base font-semibold rounded-2xl transition-colors"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer la fiche du personnage'}
          </button>
        </div>
      </div>

      <VaultDrawer
        open={vaultOpen}
        onClose={() => { setVaultOpen(false); refetchVault(); }}
      />

      {cameraSlot && (
        <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-950 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="font-semibold">Prendre une photo</h3>
              <button type="button" onClick={stopCamera} aria-label="Fermer la caméra" className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            <div className="bg-black aspect-[4/3] flex items-center justify-center">
              {cameraError ? (
                <p className="max-w-md px-6 text-center text-red-400">{cameraError}</p>
              ) : cameraStream ? (
                <video ref={cameraVideoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
              ) : (
                <p className="text-white/60">Ouverture de la caméra…</p>
              )}
            </div>

            <div className="p-4 flex justify-center">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraStream || !!cameraError}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold flex items-center gap-2"
              >
                <Camera size={18} />
                Prendre la photo
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
