import React, { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Save, Package, Box, BrickWall as Wall, RotateCcw, RotateCw, Plus, X, Upload, Image as ImageIcon, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import GalleryEditorCanvas from '@/components/game/GalleryEditorCanvas';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function GalleryEditor() {
  const { themeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [focusAssetId, setFocusAssetId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: '', asset_type: 'decor', model_url: '', media_url: '', texture_files: [] });
  const [uploading, setUploading] = useState(false);
  const [addMode, setAddMode] = useState('image'); // 'image' | 'model'
  const trayScrollRef = useRef(null);

  const { data: theme, isLoading: themeLoading } = useQuery({
    queryKey: ['gameTheme', themeId],
    queryFn: async () => (await appClient.functions.invoke('manageGameTheme', { action: 'get', id: themeId })).data.item,
    enabled: !!themeId,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['gameThemeAssets', themeId],
    queryFn: async () => (await appClient.functions.invoke('manageGameThemeAsset', { action: 'listByTheme', theme_id: themeId })).data.items,
    enabled: !!themeId,
  });

  // Merge pending changes into assets for the canvas
  const assetsWithChanges = assets.map(a => {
    const change = pendingChanges[a.id];
    if (change) {
      return {
        ...a,
        default_position: change.position,
        default_surface: change.surface,
        default_rotation: change.rotation ?? a.default_rotation ?? 0,
        default_scale: change.scale ?? a.default_scale ?? 1,
      };
    }
    return a;
  });

  const handlePositionChange = useCallback((assetId, position, surface) => {
    setPendingChanges(prev => ({
      ...prev,
      [assetId]: { ...prev[assetId], position, surface },
    }));
  }, []);

  const handleScale = (direction) => {
    if (!selectedAssetId) return;
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;
    const current = pendingChanges[selectedAssetId];
    const currentScale = current?.scale ?? asset.default_scale ?? 1;
    const newScale = Math.max(0.2, Math.min(5, +(currentScale + direction * 0.15).toFixed(2)));
    setPendingChanges(prev => ({
      ...prev,
      [selectedAssetId]: {
        position: current?.position || asset.default_position || { x: 0, y: 0, z: 0 },
        surface: current?.surface || asset.default_surface || 'floor',
        rotation: current?.rotation ?? asset.default_rotation ?? 0,
        scale: newScale,
      },
    }));
  };

  const handleSelectAsset = useCallback((assetId) => {
    setSelectedAssetId(assetId);
  }, []);

  const handleTrayClick = useCallback((assetId) => {
    setSelectedAssetId(assetId);
    setFocusAssetId(assetId);
    // Reset after a tick so re-clicking the same element re-triggers the focus
    setTimeout(() => setFocusAssetId(null), 100);
  }, []);

  const handleRotate = (direction) => {
    if (!selectedAssetId) return;
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;
    const current = pendingChanges[selectedAssetId];
    const currentRotation = current?.rotation ?? asset.default_rotation ?? 0;
    const newRotation = currentRotation + direction * 15;
    setPendingChanges(prev => ({
      ...prev,
      [selectedAssetId]: {
        position: current?.position || asset.default_position || { x: 0, y: 0, z: 0 },
        surface: current?.surface || asset.default_surface || 'floor',
        rotation: newRotation,
      },
    }));
  };

  const handleToggleSurface = () => {
    if (!selectedAssetId) return;
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset) return;
    const current = pendingChanges[selectedAssetId];
    const currentSurface = current?.surface || asset.default_surface || 'floor';
    const newSurface = currentSurface === 'floor' ? 'wall' : 'floor';
    const currentPos = current?.position || asset.default_position || { x: 0, y: 0, z: 0 };
    const newPos = newSurface === 'wall' ? { ...currentPos, y: 1.5 } : { ...currentPos, y: 0 };
    setPendingChanges(prev => ({
      ...prev,
      [selectedAssetId]: {
        position: newPos,
        surface: newSurface,
        rotation: current?.rotation ?? asset.default_rotation ?? 0,
      },
    }));
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      if (addMode === 'image') {
        setNewAsset(prev => ({ ...prev, media_url: file_url }));
      } else {
        setNewAsset(prev => ({ ...prev, model_url: file_url }));
      }
      toast.success('File uploaded');
    } catch (e) {
      toast.error('Upload failed: ' + (e?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const handleUploadTextures = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map(async (file) => {
          const { file_url } = await appClient.integrations.Core.UploadFile({ file });
          return { filename: file.name, url: file_url };
        })
      );
      setNewAsset(prev => ({ ...prev, texture_files: [...(prev.texture_files || []), ...uploaded] }));
      toast.success(`${uploaded.length} texture file(s) uploaded`);
    } catch (e) {
      toast.error('Upload failed: ' + (e?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const removeTextureFile = (idx) => {
    setNewAsset(prev => ({ ...prev, texture_files: prev.texture_files.filter((_, i) => i !== idx) }));
  };

  const handleAddAsset = async () => {
    if (addMode === 'image') {
      if (!newAsset.name || !newAsset.media_url) return;
    } else {
      if (!newAsset.name || !newAsset.model_url) return;
    }
    try {
      const idx = assets.length;
      const cols = Math.ceil(Math.sqrt(Math.max(idx + 1, 4)));
      const spacing = 2.4;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const px = col * spacing - (cols - 1) * spacing / 2;
      const pz = row * spacing - (Math.ceil((idx + 1) / cols) - 1) * spacing / 2;
      const isImage = addMode === 'image';
      const modelExt = newAsset.model_url ? newAsset.model_url.split('?')[0].split('.').pop().toLowerCase() : '';
      const hasTextures = !isImage && newAsset.texture_files && newAsset.texture_files.length > 0;
      await appClient.functions.invoke('manageGameThemeAsset', {
        action: 'save',
        theme_id: themeId,
        name: newAsset.name,
        asset_type: newAsset.asset_type,
        model_url: isImage ? undefined : newAsset.model_url,
        media_url: isImage ? newAsset.media_url : (newAsset.media_url || undefined),
        texture_files: (hasTextures && (modelExt === 'obj' || modelExt === 'fbx')) ? newAsset.texture_files : undefined,
        default_surface: isImage ? 'wall' : 'floor',
        default_position: isImage ? { x: px, y: 1.5, z: pz } : { x: px, y: 0, z: pz },
        default_rotation: 0,
      });
      queryClient.invalidateQueries({ queryKey: ['gameThemeAssets', themeId] });
      setShowAddModal(false);
      setNewAsset({ name: '', asset_type: 'decor', model_url: '', media_url: '', texture_files: [] });
      toast.success('Element added');
    } catch (e) {
      toast.error('Failed: ' + (e?.message || ''));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(pendingChanges);
      await Promise.all(updates.map(([assetId, data]) =>
        appClient.functions.invoke('manageGameThemeAsset', { action: 'save', id: assetId,
          default_position: data.position,
          default_surface: data.surface,
          default_rotation: data.rotation,
          default_scale: data.scale,
        })
      ));
      toast.success(`${updates.length} element(s) saved`);
      setPendingChanges({});
      queryClient.invalidateQueries({ queryKey: ['gameThemeAssets', themeId] });
    } catch (e) {
      toast.error('Save failed: ' + (e?.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (themeLoading || assetsLoading || !theme) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 size={28} className="animate-spin" style={{ color: '#00F0FF' }} />
      </div>
    );
  }

  const envConfig = theme.levels_config ? null : null;

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]">
      {/* 3D Canvas */}
      <div className="absolute inset-0">
        <GalleryEditorCanvas
          assets={assetsWithChanges}
          theme={theme}
          environmentConfig={null}
          onPositionChange={handlePositionChange}
          onSelectAsset={handleSelectAsset}
          selectedAssetId={selectedAssetId}
          focusAssetId={focusAssetId}
        />
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-3 pt-3 pb-2 gap-2">
          <button
            onClick={() => navigate('/Admin?tab=game-themes')}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-black text-xs font-bold"
          >
            <ArrowLeft size={16} /> Exit
          </button>
          <div className="text-center flex-1 min-w-0">
            <p className="text-black text-xs font-bold uppercase tracking-widest truncate">Gallery Editor</p>
            <p className="text-gray-500 text-[10px] truncate">{theme.title}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(pendingChanges).length === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white text-xs font-bold"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {Object.keys(pendingChanges).length > 0 ? `Save (${Object.keys(pendingChanges).length})` : 'Save'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/10">
        <p className="text-white/80 text-xs text-center">
          Tap an element and drag to move it
        </p>
      </div>

      {/* Asset tray */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Package size={14} className="text-black" />
            <p className="text-black text-xs font-bold uppercase tracking-widest">
              Elements ({assets.length})
            </p>
            <span className="text-gray-400 text-xs ml-auto">
              {Object.keys(pendingChanges).length} modified
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-bold"
            >
              <Plus size={16} strokeWidth={3} /> Add
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => trayScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
              className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-black z-10"
            >
              <ChevronLeft size={16} />
            </button>
            <div
              ref={trayScrollRef}
              className="flex gap-2 overflow-x-auto pb-2 flex-1"
              style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
              onWheel={(e) => { if (e.deltaY !== 0) { e.currentTarget.scrollLeft += e.deltaY; } }}
            >
              {assets.map(asset => {
                const isModified = !!pendingChanges[asset.id];
                const surface = pendingChanges[asset.id]?.surface || asset.default_surface || 'floor';
                return (
                  <div
                    key={asset.id}
                    onClick={() => handleTrayClick(asset.id)}
                    className={`flex-shrink-0 w-20 rounded-lg border-2 overflow-hidden cursor-pointer transition-colors ${
                      selectedAssetId === asset.id ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-400' : isModified ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="w-20 h-20 bg-gray-100">
                      {asset.media_url ? (
                        <img src={asset.media_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Box size={20} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-1">
                      <p className="text-black text-[10px] font-bold truncate">{asset.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {surface === 'wall' ? (
                          <Wall size={8} className="text-purple-500" />
                        ) : null}
                        <span className="text-gray-400 text-[8px] uppercase">{surface}</span>
                        {isModified && (
                          <span className="text-cyan-500 text-[8px]">•</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {assets.length === 0 && (
                <p className="text-gray-400 text-xs py-4 px-2">No elements in this theme</p>
              )}
            </div>
            <button
              onClick={() => trayScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
              className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-black z-10"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Selected element controls */}
      {selectedAssetId && (() => {
        const asset = assets.find(a => a.id === selectedAssetId);
        if (!asset) return null;
        const change = pendingChanges[selectedAssetId];
        const surface = change?.surface || asset.default_surface || 'floor';
        const rotation = change?.rotation ?? asset.default_rotation ?? 0;
        const scale = change?.scale ?? asset.default_scale ?? 1;
        return (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/80 backdrop-blur-md border border-cyan-400/30">
            <p className="text-white text-xs font-bold mr-1 max-w-[80px] truncate">{asset.name}</p>
            <button onClick={() => handleRotate(-1)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
              <RotateCcw size={16} />
            </button>
            <span className="text-white/60 text-[10px] w-8 text-center">{rotation}°</span>
            <button onClick={() => handleRotate(1)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
              <RotateCw size={16} />
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button onClick={() => handleScale(-1)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
              <ZoomOut size={16} />
            </button>
            <span className="text-white/60 text-[10px] w-10 text-center">{scale}x</span>
            <button onClick={() => handleScale(1)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
              <ZoomIn size={16} />
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button onClick={handleToggleSurface} className={`px-3 h-9 rounded-full text-xs font-bold flex items-center gap-1 ${surface === 'wall' ? 'bg-purple-500/30 text-purple-300 border border-purple-400/40' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'}`}>
              <Wall size={12} /> {surface === 'wall' ? 'Wall' : 'Floor'}
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button onClick={() => setSelectedAssetId(null)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60">
              <X size={16} />
            </button>
          </div>
        );
      })()}

      {/* Add element modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowAddModal(false)}>
          <div className="bg-[#1a1a1a] rounded-2xl p-5 w-[90%] max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-bold">Add Element</p>
              <button onClick={() => setShowAddModal(false)}><X size={18} className="text-white/60" /></button>
            </div>
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddMode('image')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${addMode === 'image' ? 'bg-purple-500/30 text-purple-200 border-purple-400/50' : 'bg-black/40 text-white/50 border-white/10'}`}
                >
                  <ImageIcon size={14} /> Image (Wall)
                </button>
                <button
                  onClick={() => setAddMode('model')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${addMode === 'model' ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50' : 'bg-black/40 text-white/50 border-white/10'}`}
                >
                  <Box size={14} /> 3D Model
                </button>
              </div>

              <div>
                <label className="text-white/60 text-xs mb-1 block">Name</label>
                <input value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} className="w-full bg-black/40 text-white text-sm rounded-lg px-3 py-2 border border-white/10" placeholder={addMode === 'image' ? 'e.g. Pirate Poster' : 'e.g. Antique Statue'} />
              </div>

              {addMode === 'image' ? (
                <div>
                  <label className="text-white/60 text-xs mb-1 block">Wall Image</label>
                  {newAsset.media_url ? (
                    <div className="relative w-full h-28 rounded-lg overflow-hidden border border-white/10">
                      <img src={newAsset.media_url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setNewAsset({ ...newAsset, media_url: '' })} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed border-white/20 cursor-pointer hover:border-purple-400/50 transition-colors">
                      {uploading ? <Loader2 size={20} className="animate-spin text-white/60" /> : <Upload size={20} className="text-white/40" />}
                      <span className="text-white/40 text-xs mt-1">Upload Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => { handleUpload(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-white/60 text-xs mb-1 block">3D Model (GLB/GLTF/FBX/OBJ)</label>
                  {newAsset.model_url ? (
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-300 text-xs truncate flex-1">{newAsset.model_url.split('/').pop()}</span>
                      <button onClick={() => setNewAsset({ ...newAsset, model_url: '' })} className="w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed border-white/20 cursor-pointer hover:border-cyan-400/50 transition-colors">
                      {uploading ? <Loader2 size={20} className="animate-spin text-white/60" /> : <Upload size={20} className="text-white/40" />}
                      <span className="text-white/40 text-xs mt-1">Upload 3D Model</span>
                      <input type="file" accept=".glb,.gltf,.fbx,.obj,model/gltf-binary" className="hidden" onChange={e => { handleUpload(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                  )}
                  {/* Texture / MTL files for OBJ & FBX */}
                  {newAsset.model_url && (() => {
                    const ext = newAsset.model_url.split('?')[0].split('.').pop().toLowerCase();
                    if (ext !== 'obj' && ext !== 'fbx') return null;
                    return (
                      <div className="mt-2">
                        <label className="text-white/60 text-xs mb-1 block">Texture / MTL files (for {ext.toUpperCase()})</label>
                        {(newAsset.texture_files || []).length > 0 && (
                          <div className="space-y-1 mb-2">
                            {newAsset.texture_files.map((tf, i) => (
                              <div key={i} className="flex items-center gap-2 bg-black/40 rounded-lg px-2 py-1">
                                <span className="text-white/70 text-xs truncate flex-1">{tf.filename}</span>
                                <button onClick={() => removeTextureFile(i)} className="w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white/60">
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <label className="flex flex-col items-center justify-center w-full h-16 rounded-lg border border-dashed border-white/15 cursor-pointer hover:border-cyan-400/40 transition-colors">
                          {uploading ? <Loader2 size={16} className="animate-spin text-white/60" /> : <Upload size={16} className="text-white/30" />}
                          <span className="text-white/30 text-xs mt-0.5">Add .mtl + texture images</span>
                          <input type="file" accept=".mtl,.jpg,.jpeg,.png,.webp,.tga,.bmp,.gif" multiple className="hidden" onChange={e => { handleUploadTextures(e.target.files); e.target.value = ''; }} />
                        </label>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="text-white/60 text-xs mb-1 block">Type</label>
                <select value={newAsset.asset_type} onChange={e => setNewAsset({ ...newAsset, asset_type: e.target.value })} className="w-full bg-black/40 text-white text-sm rounded-lg px-3 py-2 border border-white/10">
                  <option value="decor">Decor</option>
                  <option value="object">Object</option>
                  <option value="character">Character</option>
                  <option value="prop">Prop</option>
                  <option value="furniture">Furniture</option>
                  <option value="structure">Structure</option>
                </select>
              </div>

              <button
                onClick={handleAddAsset}
                disabled={!newAsset.name || (addMode === 'image' ? !newAsset.media_url : !newAsset.model_url)}
                className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white text-sm font-bold"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}