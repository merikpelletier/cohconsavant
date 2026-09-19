import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQueryClient } from '@tanstack/react-query';
import { X, Plus, Bookmark, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import ImageCropModal from '@/components/studio/ImageCropModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { toast } from 'sonner';

export default function SetAssetEditor({ asset, userEmail, onClose }) {
  const qc = useQueryClient();
  const [name, setName] = useState(asset?.name || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [tags, setTags] = useState(asset?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState(asset?.images || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [cropSource, setCropSource] = useState(null); // url to crop
  const [vaultSaveUrl, setVaultSaveUrl] = useState(null); // url pending save-to-vault

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || images.length >= 8) return;
    setUploading(true);
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setImages(prev => [...prev, file_url]);
    setUploading(false);
    setVaultSaveUrl(file_url);
  };

  const handleVaultSelect = (url) => {
    setVaultPickerOpen(false);
    setCropSource(url);
  };

  const handleCropConfirm = async (blob) => {
    setUploading(true);
    setCropSource(null);
    const { file_url } = await appClient.integrations.Core.UploadFile({ file: blob });
    setImages(prev => [...prev, file_url]);
    setUploading(false);
    toast.success('Image added to set', { icon: <Check size={16} /> });
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const addTag = (e) => {
    e.preventDefault();
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    setSaving(true);
    const data = { user_email: userEmail, name, description, tags, images };
    if (asset?.id) {
      await appClient.entities.SetAsset.update(asset.id, data);
    } else {
      await appClient.entities.SetAsset.create(data);
    }
    qc.invalidateQueries({ queryKey: ['setAssets', userEmail] });
    setSaving(false);
    toast.success(asset?.id ? 'Set updated' : 'Set created');
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col bg-black text-white overflow-y-auto"
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="flex flex-col bg-black text-white min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-[calc(52px+env(safe-area-inset-top)+12px)] pb-3 border-b border-white/10 sticky top-0 bg-black z-10">
          <h2 className="text-white text-lg font-light tracking-widest">
            {asset?.id ? 'Edit Set' : 'New Set'}
          </h2>
          <button onClick={onClose} className="p-2 text-white hover:text-white/80"><X size={20} /></button>
        </div>

        <div className="flex-1 px-5 py-6 space-y-5 pb-24">

          {/* Name */}
          <div>
            <label className="text-white text-xs uppercase tracking-widest mb-1.5 block">Set Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Gothic Manor, Tropical Beach..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-white text-xs uppercase tracking-widest mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Atmosphere, style, lighting, era..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-white text-xs uppercase tracking-widest mb-1.5 block">Tags</label>
            <form onSubmit={addTag} className="flex gap-2 mb-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30"
              />
              <button
                type="submit"
                disabled={!tagInput.trim()}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm rounded-xl transition-colors"
              >
                Add
              </button>
            </form>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 text-red-500 rounded-full text-xs font-medium">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-300">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white text-xs uppercase tracking-widest">
                Sets ({images.length}/8)
              </label>
              {images.length < 8 && (
                <button
                  onClick={() => setVaultPickerOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 rounded-xl text-xs text-black font-bold transition-colors"
                >
                  <Bookmark size={14} />
                  From Vault
                </button>
              )}
            </div>
            <p className="text-white/50 text-xs mb-4 leading-relaxed">Add up to 8 set/location images. Upload directly or pick from your Vault to crop to any ratio. These images define the atmosphere and style of your set.</p>
            <div className="grid grid-cols-3 gap-2 auto-rows-[minmax(0,auto)]">
              {images.map((url, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden bg-white/5">
                  <img src={url} alt="" className="w-full h-auto object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors"
                  >
                    <X size={10} className="text-white" />
                  </button>
                  <button
                    onClick={() => setVaultSaveUrl(url)}
                    title="Save this image to Vault"
                    className="absolute bottom-1 left-1 h-6 px-2 bg-red-500 text-black rounded-full flex items-center justify-center hover:bg-red-400 transition-colors"
                  >
                    <Bookmark size={11} />
                  </button>
                </div>
              ))}
              {images.length < 8 && (
                <label className="aspect-square rounded-xl border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center cursor-pointer transition-colors">
                  {uploading
                    ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Plus size={20} className="text-white" />
                  }
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 py-6 bg-black border-t border-white/10 z-10">
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold tracking-widest rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : 'Save Set'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {vaultPickerOpen && (
          <VaultPickerModal
            userEmail={userEmail}
            onSelect={handleVaultSelect}
            onClose={() => setVaultPickerOpen(false)}
          />
        )}
        {cropSource && (
          <ImageCropModal
            imageUrl={cropSource}
            onConfirm={handleCropConfirm}
            onClose={() => setCropSource(null)}
          />
        )}
        {vaultSaveUrl && (
          <SaveToVaultModal
            userEmail={userEmail}
            imageUrl={vaultSaveUrl}
            mediaType="image"
            onSaved={() => { setVaultSaveUrl(null); qc.invalidateQueries({ queryKey: ['vaultAssets', userEmail] }); }}
            onClose={() => setVaultSaveUrl(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}