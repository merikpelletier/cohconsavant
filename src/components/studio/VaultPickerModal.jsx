import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { X, Folder, ChevronDown } from 'lucide-react';

const folderColors = {
  red: 'bg-red-500/20 border-red-500/40 text-red-400',
  orange: 'bg-red-500/20 border-red-500/40 text-red-500',
  yellow: 'bg-red-500/20 border-red-500/40 text-red-500',
  green: 'bg-red-500/20 border-red-500/40 text-red-500',
  blue: 'bg-red-500/20 border-red-500/40 text-red-500',
  purple: 'bg-red-500/20 border-red-500/40 text-red-500',
  pink: 'bg-red-500/20 border-red-500/40 text-red-500',
};

export default function VaultPickerModal({ userEmail, onSelect, onClose }) {
  const [expandedFolders, setExpandedFolders] = useState({});

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['vaultFoldersForPicker', userEmail],
    queryFn: () => appClient.entities.VaultFolder.filter({ user_email: userEmail }, 'order'),
    enabled: !!userEmail,
  });

  const { data: vaultAssets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['vaultAssetsForPicker', userEmail],
    queryFn: () => appClient.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date'),
    enabled: !!userEmail,
  });

  const images = vaultAssets.filter(a => a.media_type === 'image');
  const unfiledImages = images.filter(a => !a.folder_id);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  if (foldersLoading || assetsLoading) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4 border-b border-white/10 flex-shrink-0">
        <h3 className="text-white text-sm font-medium tracking-widest uppercase">Pick from Vault</h3>
        <button onClick={onClose} className="p-2 text-white hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Unfiled Images */}
        {unfiledImages.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white text-xs uppercase tracking-wider">
              <Folder size={14} />
              Unfiled ({unfiledImages.length})
            </div>
            <div className="grid grid-cols-3 gap-2">
              {unfiledImages.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset.url)}
                  className="aspect-square rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-red-500 transition-all"
                >
                  <img src={asset.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Folders */}
        {folders.map((folder) => {
          const folderImages = images.filter(a => a.folder_id === folder.id);
          const isExpanded = expandedFolders[folder.id] ?? false;

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
                  <span className="text-white text-xs font-semibold">({folderImages.length})</span>
                </div>
              </div>

              {isExpanded && folderImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pl-2">
                  {folderImages.map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => onSelect(asset.url)}
                      className="aspect-square rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-red-500 transition-all"
                    >
                      <img src={asset.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {images.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white text-sm">No images in your Vault yet.</p>
            <p className="text-white/20 text-xs mt-1">Save images from dossiers first.</p>
          </div>
        )}
      </div>
    </div>
  );
}