import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2, X, Folder, Plus, ChevronDown, ChevronRight, Pencil, FileText, Download } from 'lucide-react';
import ScriptEditor from '@/components/studio/ScriptEditor';
import AssetInspector from '@/components/studio/AssetInspector';
import { Info, Star } from 'lucide-react';

const folderColors = {
  red: 'bg-red-500/20 border-red-500/40 text-red-400',
  orange: 'bg-red-500/20 border-red-500/40 text-red-500',
  yellow: 'bg-red-500/20 border-red-500/40 text-red-500',
  green: 'bg-red-500/20 border-red-500/40 text-red-500',
  blue: 'bg-red-500/20 border-red-500/40 text-red-500',
  purple: 'bg-red-500/20 border-red-500/40 text-red-500',
  pink: 'bg-red-500/20 border-red-500/40 text-red-500',
};

export default function VaultSection({ userEmail, onUsePrompt }) {
  const queryClient = useQueryClient();
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('blue');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [allCollapsed, setAllCollapsed] = useState(true);
  const [editingName, setEditingName] = useState(null); // asset id being renamed
  const [nameDraft, setNameDraft] = useState('');
  const [scriptAsset, setScriptAsset] = useState(null); // script being edited
  const [inspectorAsset, setInspectorAsset] = useState(null); // asset being curated

  const saveName = async (asset) => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== asset.name) {
      await appClient.entities.VaultAsset.update(asset.id, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
    }
    setEditingName(null);
  };

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['vaultFolders', userEmail],
    queryFn: () => appClient.entities.VaultFolder.filter({ user_email: userEmail }, 'order'),
    enabled: !!userEmail,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['vaultAssets', userEmail],
    queryFn: () => appClient.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date'),
    enabled: !!userEmail,
  });

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await appClient.entities.VaultFolder.create({
      user_email: userEmail,
      name: newFolderName.trim(),
      color: newFolderColor,
      order: folders.length,
    });
    setNewFolderName('');
    setNewFolderColor('blue');
    setShowNewFolder(false);
    queryClient.invalidateQueries({ queryKey: ['vaultFolders', userEmail] });
  };

  const deleteFolder = async (folderId) => {
    const folderAssets = assets.filter(a => a.folder_id === folderId);
    for (const asset of folderAssets) {
      await appClient.entities.VaultAsset.update(asset.id, { folder_id: null });
    }
    await appClient.entities.VaultFolder.delete(folderId);
    queryClient.invalidateQueries({ queryKey: ['vaultFolders', userEmail], queryKey: ['vaultAssets', userEmail] });
  };

  const deleteAsset = async (id) => {
    await appClient.entities.VaultAsset.delete(id);
    queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
  };

  const moveAssetToFolder = async (assetId, folderId) => {
    const target = folderId === 'unfiled' ? null : folderId;
    await appClient.entities.VaultAsset.update(assetId, { folder_id: target });
    queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  if (foldersLoading || assetsLoading) return null;

  const unfiledAssets = assets.filter(a => !a.folder_id);

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
            <Bookmark size={20} className="text-black" fill="currentColor" />
          </div>
          <div>
            <p className="text-white text-xl font-bold uppercase tracking-wider">My Vault</p>
            {assets.length > 0 && <span className="text-white text-sm font-medium">{assets.length} assets</span>}
          </div>
        </div>
        <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-400 rounded-2xl text-black text-sm font-bold transition-colors shadow-lg">
          <Plus size={16} className="font-bold" />
          New Folder
        </button>
      </div>

      {showNewFolder && (
        <div className="flex gap-3 items-center bg-white/5 p-5 rounded-2xl border border-white/10">
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name..." className="flex-1 bg-black/80 border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20" autoFocus />
          <select value={newFolderColor} onChange={(e) => setNewFolderColor(e.target.value)} className="bg-black/80 border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-semibold focus:outline-none focus:border-red-500">
            <option value="red">Red</option>
            <option value="orange">Orange</option>
            <option value="yellow">Yellow</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="purple">Purple</option>
            <option value="pink">Pink</option>
          </select>
          <button onClick={createFolder} className="px-5 py-3 bg-red-700 hover:bg-red-500 rounded-xl text-white text-sm font-bold transition-colors shadow-lg">Create</button>
          <button onClick={() => setShowNewFolder(false)} className="p-2 text-white hover:text-white transition-colors"><X size={18} /></button>
        </div>
      )}

      {/* Unfiled Assets */}
      {unfiledAssets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-white text-base font-bold uppercase tracking-wider">
            <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center">
              <Folder size={16} className="text-black" />
            </div>
            Unfiled <span className="text-white">({unfiledAssets.length})</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {unfiledAssets.map((asset) => (
              <div key={asset.id} className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10" style={{ aspectRatio: '3/4' }}>
                <div className="absolute top-3 left-3 flex gap-2">
                  <select value="" onChange={(e) => { if (e.target.value) moveAssetToFolder(asset.id, e.target.value); }} className="bg-black/90 text-white text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 border border-white/30">
                    <option value="" className="text-white">Move to...</option>
                    {folders.map(f => <option key={f.id} value={f.id} className="text-white bg-black">{f.name}</option>)}
                  </select>
                </div>
                {asset.media_type === 'script' ? (
                  <button onClick={() => setScriptAsset(asset)} className="w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-900 cursor-pointer">
                    <FileText size={32} className="text-red-500" />
                    <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider px-2 text-center leading-tight">{asset.name || 'Script'}</span>
                  </button>
                ) : asset.media_type === 'video' ? (
                  <video src={asset.url} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxUrl(asset.url)} />
                ) : (
                  <img src={asset.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxUrl(asset.url)} />
                )}
                {asset.media_type === 'video' && (
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-black/70 rounded-full flex items-center justify-center pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                )}
                {asset.asset_category && (
                  <span className="absolute bottom-3 left-3 text-xs px-3 py-2 bg-black/90 text-red-500 font-bold rounded-lg capitalize border border-red-500/30 shadow-lg">
                    {asset.asset_category}
                  </span>
                )}
                <span className="absolute bottom-3 right-3 left-1/2 -translate-x-1/2 ml-8 max-w-[55%] truncate text-xs px-3 py-2 bg-black/80 text-white font-semibold rounded-lg shadow-lg pointer-events-none">
                  {asset.name || 'Untitled'}
                </span>
                <button onClick={() => { setEditingName(asset.id); setNameDraft(asset.name || ''); }} className="absolute top-3 right-12 w-8 h-8 bg-black/70 hover:bg-black rounded-full flex items-center justify-center transition-colors shadow-lg">
                  <Pencil size={14} className="text-white" />
                </button>
                <button onClick={() => deleteAsset(asset.id)} className="absolute top-3 right-3 w-8 h-8 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors shadow-lg">
                  <Trash2 size={14} className="text-white" />
                </button>
                {editingName === asset.id && (
                  <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveName(asset); if (e.key === 'Escape') setEditingName(null); }}
                      placeholder="Name this file…"
                      className="w-full bg-white/10 border border-red-500 rounded-xl px-4 py-3 text-white text-sm font-semibold placeholder-white/30 focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => saveName(asset)} className="absolute bottom-4 right-4 bg-red-500 text-black text-xs font-bold px-4 py-2 rounded-lg">Save</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Folders */}
      {folders.map((folder) => {
        const folderAssets = assets.filter(a => a.folder_id === folder.id);
        const isExpanded = expandedFolders[folder.id] ?? !allCollapsed;

        return (
          <div key={folder.id} className="space-y-2">
            <div className={`flex items-center justify-between px-5 py-4 rounded-2xl border ${folderColors[folder.color]} cursor-pointer shadow-lg`} onClick={() => toggleFolder(folder.id)}>
            <div className="flex items-center gap-3">
              <ChevronDown size={18} className={`text-white transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
              <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                <Folder size={18} className="text-white" />
              </div>
              <span className="text-white text-base font-bold">{folder.name}</span>
              <span className="text-white text-sm font-semibold">({folderAssets.length})</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }} className="p-2 hover:bg-black/20 rounded-xl transition-colors">
              <Trash2 size={16} className="text-white" />
            </button>
          </div>

          {isExpanded && (
            <div className="grid grid-cols-3 gap-3 pl-2">
              {folderAssets.map((asset) => (
                <div key={asset.id} className="relative rounded-2xl overflow-hidden bg-white/5 border border-white/10" style={{ aspectRatio: '3/4' }}>
                  <div className="absolute top-3 left-3 flex gap-2">
                    <select value="" onChange={(e) => { if (e.target.value) moveAssetToFolder(asset.id, e.target.value); }} className="bg-black/90 text-white text-xs font-bold rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 border border-white/30">
                      <option value="" className="text-white">Move to...</option>
                      <option value="unfiled" className="text-white bg-black">Unfiled</option>
                      {folders.filter(f => f.id !== folder.id).map(f => <option key={f.id} value={f.id} className="text-white bg-black">{f.name}</option>)}
                    </select>
                  </div>
                  {asset.media_type === 'script' ? (
                    <button onClick={() => setScriptAsset(asset)} className="w-full h-full flex flex-col items-center justify-center gap-2 bg-neutral-900 cursor-pointer">
                      <FileText size={32} className="text-red-500" />
                      <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider px-2 text-center leading-tight">{asset.name || 'Script'}</span>
                    </button>
                  ) : asset.media_type === 'video' ? (
                    <video src={asset.url} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxUrl(asset.url)} />
                  ) : (
                    <img src={asset.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxUrl(asset.url)} />
                  )}
                  {asset.media_type === 'video' && (
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-black/70 rounded-full flex items-center justify-center pointer-events-none">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  )}
                  {asset.asset_category && (
                    <span className="absolute bottom-3 left-3 text-xs px-3 py-2 bg-black/90 text-red-500 font-bold rounded-lg capitalize border border-red-500/30 shadow-lg">
                      {asset.asset_category}
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 left-1/2 -translate-x-1/2 ml-8 max-w-[55%] truncate text-xs px-3 py-2 bg-black/80 text-white font-semibold rounded-lg shadow-lg pointer-events-none">
                    {asset.name || 'Untitled'}
                  </span>
                  <button onClick={() => setInspectorAsset(asset)} className="absolute top-3 right-24 w-8 h-8 bg-black/70 hover:bg-red-500 hover:text-black rounded-full flex items-center justify-center transition-colors shadow-lg text-white">
                    <Info size={14} />
                  </button>
                  <button onClick={() => { setEditingName(asset.id); setNameDraft(asset.name || ''); }} className="absolute top-3 right-12 w-8 h-8 bg-black/70 hover:bg-black rounded-full flex items-center justify-center transition-colors shadow-lg">
                    <Pencil size={14} className="text-white" />
                  </button>
                  <button onClick={() => deleteAsset(asset.id)} className="absolute top-3 right-3 w-8 h-8 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors shadow-lg">
                    <Trash2 size={14} className="text-white" />
                  </button>
                  {asset.is_magazine_ready && (
                    <span className="absolute bottom-3 right-3 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg" title="Magazine ready">
                      <Star size={13} className="text-black" fill="currentColor" />
                    </span>
                  )}
                  {editingName === asset.id && (
                    <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-4 z-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveName(asset); if (e.key === 'Escape') setEditingName(null); }}
                        placeholder="Name this file…"
                        className="w-full bg-white/10 border border-red-500 rounded-xl px-4 py-3 text-white text-sm font-semibold placeholder-white/30 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => saveName(asset)} className="absolute bottom-4 right-4 bg-red-500 text-black text-xs font-bold px-4 py-2 rounded-lg">Save</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        );
      })}

      {assets.length === 0 && folders.length === 0 && (
        <div className="py-12 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Bookmark size={28} className="text-white" />
          </div>
          <p className="text-white text-base font-medium">No saved assets yet</p>
          <p className="text-white text-sm mt-2 leading-relaxed max-w-xs mx-auto">Browse production kits and tap the bookmark icon on any asset to save it here</p>
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-8 right-4 text-white hover:text-white z-10"><X size={24} /></button>
          {lightboxUrl.match(/\.(mp4|webm|mov|m4v)(\?|$)/i) ? (
            <video src={lightboxUrl} controls autoPlay className="max-w-full max-h-full rounded-xl" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          )}
        </div>
      )}

      {scriptAsset && (
        <ScriptEditor
          asset={scriptAsset}
          userEmail={userEmail}
          onClose={() => setScriptAsset(null)}
          onUsePrompt={onUsePrompt}
        />
      )}

      {inspectorAsset && (
        <AssetInspector
          asset={inspectorAsset}
          userEmail={userEmail}
          folders={folders}
          onClose={() => setInspectorAsset(null)}
        />
      )}
    </div>
  );
}