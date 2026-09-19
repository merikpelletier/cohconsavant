import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { appClient } from '@/api/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, ImageIcon, Package, ChevronDown, ChevronRight, Save, X, Upload, Box, Pencil, LayoutGrid } from 'lucide-react';

export default function AdminGameThemes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['adminGameThemes'],
    queryFn: async () => {
      return (await appClient.functions.invoke('manageGameTheme', { action: 'list' })).data.items;
    },
  });

  const { data: themeAssets = [] } = useQuery({
    queryKey: ['gameThemeAssets', selectedThemeId],
    queryFn: async () => {
      if (!selectedThemeId) return [];
      return (await appClient.functions.invoke('manageGameThemeAsset', { action: 'listByTheme', theme_id: selectedThemeId })).data.items;
    },
    enabled: !!selectedThemeId,
  });

  const selectedTheme = themes.find(t => t.id === selectedThemeId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="text-red-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Game Themes</h2>
        <Button onClick={() => setShowCreate(true)} size="sm" className="bg-red-700 hover:bg-red-600">
          <Plus size={14} /> New Theme
        </Button>
      </div>

      {showCreate && (
        <ThemeCreateForm onClose={() => setShowCreate(false)} onCreated={(id) => { setSelectedThemeId(id); setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['adminGameThemes'] }); }} />
      )}

      {/* Helper note when no theme is selected */}
      {!selectedThemeId && themes.length > 0 && (
        <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 text-center">
          <Box size={20} className="text-white/30 mx-auto mb-1" />
          <p className="text-white/40 text-xs">Select a theme above to add game elements (characters, objects, props, 3D models...)</p>
        </div>
      )}

      {/* Theme list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {themes.map(theme => (
          <div key={theme.id} className={`bg-zinc-900 rounded-xl p-3 border cursor-pointer transition-colors ${selectedThemeId === theme.id ? 'border-red-600' : 'border-white/5'}`} onClick={() => setSelectedThemeId(theme.id)}>
            <div className="flex items-center gap-3">
              {theme.poster_url ? (
                <img src={theme.poster_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <ImageIcon size={16} className="text-white/30" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{theme.title}</p>
                <p className="text-white/40 text-xs truncate">{theme.is_active ? 'Active' : 'Inactive'} • {theme.levels_config?.length || 0} levels</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {themes.length === 0 && (
        <div className="text-center py-8">
          <Package size={28} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">No themes created yet</p>
        </div>
      )}

      {/* Selected theme editor */}
      {selectedTheme && (
        <ThemeEditor key={`${selectedTheme.id}-${selectedTheme.updated_date}`} theme={selectedTheme} assets={themeAssets} autoOpenAssets onUpdated={() => { queryClient.invalidateQueries({ queryKey: ['adminGameThemes'] }); queryClient.invalidateQueries({ queryKey: ['gameThemeAssets', selectedThemeId] }); queryClient.invalidateQueries({ queryKey: ['gameTheme', selectedThemeId] }); }} onOpenGallery={() => navigate(`/GalleryEditor/${selectedTheme.id}`)} />
      )}
    </div>
  );
}

function FileUpload({ value, onChange, label, accept = "image/*" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await appClient.integrations.Core.UploadFile({ file });
      onChange(res.file_url);
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-white/40 text-[10px] font-bold uppercase">{label}</p>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          variant="outline"
          size="sm"
          className="border-white/10 text-white bg-white/5 hover:bg-white/10 text-xs"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Upload
        </Button>
        {value && (
          <a href={value} target="_blank" rel="noreferrer" className="text-white/40 text-xs underline truncate flex-1">
            {value.split('/').pop()}
          </a>
        )}
      </div>
      {value && isVideo(value) && (
        <video src={value} controls className="w-full h-24 rounded-lg object-cover bg-black" />
      )}
      {value && isAudio(value) && (
        <audio src={value} controls className="w-full" />
      )}
      {value && !isVideo(value) && !isAudio(value) && !is3DModel(value) && (
        <img src={value} alt="" className="w-full h-24 rounded-lg object-cover" />
      )}
    </div>
  );
}

function isVideo(url) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url || '');
}
function isAudio(url) {
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url || '');
}
function is3DModel(url) {
  return /\.(glb|gltf|fbx|obj|stl|dae)(\?|$)/i.test(url || '');
}

function ThemeCreateForm({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [rules, setRules] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const theme = (await appClient.functions.invoke('manageGameTheme', {
        action: 'save',
        title: title.trim(),
        description: description.trim(),
        poster_url: posterUrl || null,
        rules_for_ai: rules.trim(),
        levels_config: [
          { level_number: 1, min_elements: 4, max_elements: 6, passage_value: 500, loss_threshold: 0 },
          { level_number: 2, min_elements: 6, max_elements: 8, passage_value: 1000, loss_threshold: 0 },
          { level_number: 3, min_elements: 8, max_elements: 10, passage_value: 1500, loss_threshold: 0 },
          { level_number: 4, min_elements: 10, max_elements: 12, passage_value: 2000, loss_threshold: 0 },
        ],
        is_active: true,
      })).data.item;
      onCreated(theme.id);
    } catch (e) {
      console.error('Failed to create theme:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-red-900/40 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">New Theme</h3>
        <button onClick={onClose}><X size={16} className="text-white/40" /></button>
      </div>
      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Theme title" className="bg-white/5 border-white/10 text-white" />
      <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="General description" rows={2} className="bg-white/5 border-white/10 text-white resize-none" />
      <FileUpload value={posterUrl} onChange={setPosterUrl} label="Poster image" accept="image/*" />
      <Textarea value={rules} onChange={e => setRules(e.target.value)} placeholder="Rules for the AI Game Master" rows={3} className="bg-white/5 border-white/10 text-white resize-none" />
      <Button onClick={handleSave} disabled={saving || !title.trim()} size="sm" className="bg-red-700 hover:bg-red-600 w-full">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Create
      </Button>
    </div>
  );
}

function ThemeEditor({ theme, assets, onUpdated, autoOpenAssets, onOpenGallery }) {
  const [expanded, setExpanded] = useState(true);
  const [showAssetForm, setShowAssetForm] = useState(autoOpenAssets || false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [title, setTitle] = useState(theme.title);
  const [description, setDescription] = useState(theme.description || '');
  const [rules, setRules] = useState(theme.rules_for_ai || '');
  const [posterUrl, setPosterUrl] = useState(theme.poster_url || '');
  const [floorTextureUrl, setFloorTextureUrl] = useState(theme.floor_texture_url || '');
  const [wallTextureUrl, setWallTextureUrl] = useState(theme.wall_texture_url || '');
  const [isActive, setIsActive] = useState(theme.is_active);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await appClient.functions.invoke('manageGameTheme', { action: 'save', id: theme.id,
        title, description, rules_for_ai: rules, poster_url: posterUrl, is_active: isActive,
        floor_texture_url: floorTextureUrl || null,
        wall_texture_url: wallTextureUrl || null,
        levels_config: theme.levels_config,
      });
      toast.success('Theme saved successfully');
      onUpdated();
    } catch (e) {
      console.error('Failed to save theme:', e);
      toast.error('Failed to save: ' + (e?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (assetId) => {
    await appClient.functions.invoke('manageGameThemeAsset', { action: 'delete', id: assetId });
    onUpdated();
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/5 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center justify-between">
        <span className="text-white font-bold text-sm">Edit: {theme.title}</span>
        {expanded ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
      </button>

      {expanded && (
        <div className="p-3 pt-0 space-y-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-white/5 border-white/10 text-white" />
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="bg-white/5 border-white/10 text-white resize-none" />
          <FileUpload value={posterUrl} onChange={setPosterUrl} label="Poster image" accept="image/*" />
          <div className="grid grid-cols-2 gap-2">
            <FileUpload value={floorTextureUrl} onChange={setFloorTextureUrl} label="Floor texture" accept="image/*" />
            <FileUpload value={wallTextureUrl} onChange={setWallTextureUrl} label="Wall texture" accept="image/*" />
          </div>
          <Textarea value={rules} onChange={e => setRules(e.target.value)} rows={3} placeholder="AI Game Master rules" className="bg-white/5 border-white/10 text-white resize-none" />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            <span className="text-white text-xs">Active</span>
          </label>

          {/* Levels config */}
          <div className="bg-black/30 rounded-lg p-2">
            <p className="text-white/40 text-[10px] font-bold uppercase mb-1">Level Configuration</p>
            {(theme.levels_config || []).map((lc, i) => (
              <div key={i} className="text-white/60 text-xs">
                Lvl. {lc.level_number}: {lc.min_elements}-{lc.max_elements} elements, passage: {lc.passage_value} pts
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving} size="sm" className="bg-red-700 hover:bg-red-600 w-full">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
          </Button>

          <Button onClick={onOpenGallery} size="sm" variant="outline" className="w-full text-white border-white/20 bg-white/5 hover:bg-white/10">
            <LayoutGrid size={14} /> Aménager la galerie
          </Button>

          {/* Assets section — Elements */}
          <div className="border-t border-white/5 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white font-bold text-sm flex items-center gap-1">
                <Box size={14} /> Theme Elements ({assets.length})
              </p>
              <Button onClick={() => setShowAssetForm(!showAssetForm)} size="sm" variant="outline" className="text-white border-white/20">
                <Plus size={12} /> Add Element
              </Button>
            </div>

            {showAssetForm && !editingAsset && (
              <AssetForm themeId={theme.id} onClose={() => setShowAssetForm(false)} onSaved={() => { setShowAssetForm(false); onUpdated(); }} />
            )}

            {editingAsset && (
              <AssetForm themeId={theme.id} asset={editingAsset} onClose={() => setEditingAsset(null)} onSaved={() => { setEditingAsset(null); onUpdated(); }} />
            )}

            <div className="space-y-1">
              {assets.map(asset => (
                <div key={asset.id} className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                  {asset.media_url ? (
                    <img src={asset.media_url} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                      <Package size={12} className="text-white/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">{asset.name}</p>
                    <p className="text-white/40 text-[10px]">{asset.asset_type}</p>
                  </div>
                  <button onClick={() => setEditingAsset(asset)} className="text-white/40 hover:text-white">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => handleDeleteAsset(asset.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {assets.length === 0 && (
                <p className="text-white/30 text-xs text-center py-2">No elements yet — add characters, objects, props, decor...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetForm({ themeId, asset, onClose, onSaved }) {
  const isEdit = !!asset;
  const [name, setName] = useState(asset?.name || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [assetType, setAssetType] = useState(asset?.asset_type || 'character');
  const [mediaUrl, setMediaUrl] = useState(asset?.media_url || '');
  const [modelUrl, setModelUrl] = useState(asset?.model_url || '');
  const [textureFiles, setTextureFiles] = useState(asset?.texture_files || []);
  const [tags, setTags] = useState((asset?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const modelExt = modelUrl ? modelUrl.split('?')[0].split('.').pop().toLowerCase() : '';
  const needsTextures = modelExt === 'obj' || modelExt === 'fbx';

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
      setTextureFiles(prev => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} file(s) uploaded`);
    } catch (e) {
      toast.error('Upload failed: ' + (e?.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const removeTextureFile = (idx) => {
    setTextureFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        asset_type: assetType,
        media_url: mediaUrl || null,
        model_url: modelUrl || null,
        texture_files: (needsTextures && textureFiles.length > 0) ? textureFiles : (isEdit ? undefined : null),
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      if (isEdit) {
        await appClient.functions.invoke('manageGameThemeAsset', { action: 'save', id: asset.id, ...payload });
      } else {
        await appClient.functions.invoke('manageGameThemeAsset', { action: 'save', theme_id: themeId, ...payload });
      }
      onSaved();
    } catch (e) {
      console.error('Failed to save asset:', e);
    } finally {
      setSaving(false);
    }
  };

  const assetTypes = ['character', 'object', 'prop', 'furniture', 'structure', 'nature', 'decor', 'environment_3d', 'video', 'audio'];

  return (
    <div className="bg-black/30 rounded-lg p-3 space-y-2 border border-white/5">
      <Input value={name} onChange={e => setName(e.target.value)} placeholder="Element name" className="bg-white/5 border-white/10 text-white text-xs h-8" />
      <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" rows={2} className="bg-white/5 border-white/10 text-white text-xs resize-none" />
      <select value={assetType} onChange={e => setAssetType(e.target.value)} className="w-full bg-zinc-900 border border-white/10 text-white text-xs rounded-md h-8 px-2">
        {assetTypes.map(t => <option key={t} value={t} className="bg-zinc-900 text-white">{t}</option>)}
      </select>
      {(assetType === 'video') && (
        <FileUpload value={mediaUrl} onChange={setMediaUrl} label="Video file" accept="video/*" />
      )}
      {(assetType === 'audio') && (
        <FileUpload value={mediaUrl} onChange={setMediaUrl} label="Audio file" accept="audio/*" />
      )}
      {['character', 'object', 'prop', 'furniture', 'structure', 'nature', 'decor', 'environment_3d'].includes(assetType) && (
        <>
          <FileUpload value={mediaUrl} onChange={setMediaUrl} label="Preview image" accept="image/*" />
          <FileUpload value={modelUrl} onChange={setModelUrl} label="3D model (GLB/GLTF/FBX/OBJ)" accept=".glb,.gltf,.fbx,.obj,model/gltf-binary" />
          {needsTextures && (
            <div>
              <p className="text-white/60 text-xs mb-1">Texture / MTL files (for {modelExt.toUpperCase()})</p>
              {textureFiles.length > 0 && (
                <div className="space-y-1 mb-2">
                  {textureFiles.map((tf, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-1">
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
          )}
        </>
      )}
      <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma-separated)" className="bg-white/5 border-white/10 text-white text-xs h-8" />
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !name.trim()} size="sm" className="bg-red-700 hover:bg-red-600 flex-1 text-xs">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} {isEdit ? 'Save' : 'Add'}
        </Button>
        <Button onClick={onClose} size="sm" variant="outline" className="text-white border-white/20 text-xs">
          <X size={12} />
        </Button>
      </div>
    </div>
  );
}