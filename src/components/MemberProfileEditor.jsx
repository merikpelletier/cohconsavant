import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function MemberProfileEditor({ profile, user, onClose }) {
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    title: profile?.title || '',
    links: profile?.links || [],
    avatar_url: profile?.avatar_url || '',
    images: profile?.images || [],
    custom_banner_url: profile?.custom_banner_url || '',
    custom_banner_link: profile?.custom_banner_link || '',
    age_range: profile?.age_range || '',
    sexual_role: profile?.sexual_role || '',
    body_type: profile?.body_type || '',
  });
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = profile?.id ? { ...data, id: profile.id } : { user_email: user.email, ...data };
      const res = await appClient.functions.invoke('manageMemberProfile', { action: 'save', ...payload });
      return res.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberProfile'] });
      onClose();
    },
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await appClient.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, avatar_url: result.file_url }));
    } catch (error) {
      alert('Error uploading avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (formData.images.length + files.length > 6) {
      alert('Maximum 6 images');
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map(file => appClient.integrations.Core.UploadFile({ file }).then(res => res.file_url))
      );
      setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
    } catch (error) {
      alert('Error uploading images');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-stretch sm:items-center justify-center overflow-hidden p-3 sm:p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-2xl h-[calc(100dvh-1.5rem)] sm:h-[90vh] min-h-0 flex flex-col overflow-hidden"
      >
        {/* Fixed Actions Footer - AT TOP */}
        <div className="border-b border-gray-200 bg-white p-3 flex gap-2 flex-shrink-0 rounded-t-2xl">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-black py-3 rounded hover:bg-gray-300 transition-colors font-light text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending}
            className="flex-1 bg-red-600 text-white py-3 rounded hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold text-sm"
          >
            {saveMutation.isPending ? 'Saving...' : 'SAVE'}
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-black text-lg font-semibold">Edit Profile</h2>
          <button onClick={onClose} className="text-white hover:text-black transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="flex-1 min-h-0 overflow-y-scroll overscroll-contain px-4 py-3 space-y-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Display Name */}
          <div>
            <label className="text-black font-semibold text-sm block mb-2">Display Name</label>
            <Input
              placeholder="Your display name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              className="bg-gray-50 border-2 border-gray-300 text-black placeholder:text-white text-base py-3"
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="text-black font-semibold text-sm block mb-3">Avatar</label>
            {formData.avatar_url && (
              <img src={formData.avatar_url} alt="avatar" className="w-20 h-20 rounded-full mb-3 object-cover border-2 border-gray-300" />
            )}
            <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
              <span className="text-black">{uploading ? 'Uploading...' : '+ Upload Avatar'}</span>
            </label>
          </div>

          {/* Title */}
          <div>
            <label className="text-black font-semibold text-sm block mb-2">Title/Role</label>
            <Input
              placeholder="e.g., Designer, Photographer"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="bg-gray-50 border-2 border-gray-300 text-black placeholder:text-white text-base py-3"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-black font-semibold text-sm block mb-2">Bio</label>
            <Textarea
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              className="bg-gray-50 border-2 border-gray-300 text-black placeholder:text-white text-base py-3"
              rows={4}
            />
          </div>

          {/* Markers */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-black font-semibold text-xs block mb-1">Tranche d'âge</label>
              <select
                value={formData.age_range}
                onChange={(e) => setFormData(prev => ({ ...prev, age_range: e.target.value }))}
                className="w-full bg-gray-50 border-2 border-gray-300 text-black text-sm py-2 px-2 rounded"
              >
                <option value="">—</option>
                <option value="18-29">18-29</option>
                <option value="30-45">30-45</option>
                <option value="46-65">46-65</option>
                <option value="66+">66 et plus</option>
              </select>
            </div>
            <div>
              <label className="text-black font-semibold text-xs block mb-1">Rôle</label>
              <select
                value={formData.sexual_role}
                onChange={(e) => setFormData(prev => ({ ...prev, sexual_role: e.target.value }))}
                className="w-full bg-gray-50 border-2 border-gray-300 text-black text-sm py-2 px-2 rounded"
              >
                <option value="">—</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="versatile">Versatile</option>
                <option value="side">Side</option>
              </select>
            </div>
            <div>
              <label className="text-black font-semibold text-xs block mb-1">Type</label>
              <select
                value={formData.body_type}
                onChange={(e) => setFormData(prev => ({ ...prev, body_type: e.target.value }))}
                className="w-full bg-gray-50 border-2 border-gray-300 text-black text-sm py-2 px-2 rounded"
              >
                <option value="">—</option>
                <option value="mince">Mince</option>
                <option value="opulent">Opulent</option>
                <option value="musclé">Musclé</option>
                <option value="efféminé">Efféminé</option>
                <option value="trans">Trans</option>
              </select>
            </div>
          </div>

          {/* Gallery Images */}
          <div>
            <label className="text-black font-semibold text-sm block mb-3">Gallery Images ({formData.images.length}/6)</label>
            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img src={img} alt={`img-${idx}`} className="w-full h-24 object-cover rounded border border-gray-300" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        images: prev.images.filter((_, i) => i !== idx)
                      }))}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded"
                    >
                      <Trash2 size={18} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formData.images.length < 6 && (
              <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImagesUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="text-black">{uploading ? 'Uploading...' : 'Add Images'}</span>
              </label>
            )}
          </div>

          {/* Custom Banner */}
          <div className="border-2 border-red-200 rounded-lg p-3 bg-red-50">
              <label className="text-red-700 font-semibold text-sm block mb-2">Bannière du profil</label>
              {formData.custom_banner_url && (
                <img src={formData.custom_banner_url} alt="Aperçu de la bannière" className="w-full h-24 object-cover rounded mb-2" />
              )}
              <label className="flex items-center justify-center border-2 border-dashed border-red-300 rounded-lg p-3 cursor-pointer hover:bg-red-100 transition-colors mb-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const result = await appClient.integrations.Core.UploadFile({ file });
                      setFormData(prev => ({ ...prev, custom_banner_url: result.file_url }));
                    } catch (error) {
                      alert('Impossible de téléverser la bannière.');
                    } finally {
                      setUploading(false);
                    }
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="text-red-600 text-sm">{uploading ? 'Téléversement...' : '+ Ajouter une bannière'}</span>
              </label>
              <Input
                placeholder="Ou coller l’adresse de l’image"
                value={formData.custom_banner_url}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_banner_url: e.target.value }))}
                className="bg-white border border-red-300 text-black text-sm mb-2"
              />
              <Input
                placeholder="Lien de la bannière (facultatif)"
                value={formData.custom_banner_link}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_banner_link: e.target.value }))}
                className="bg-white border border-red-300 text-black text-sm"
              />
              {formData.custom_banner_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, custom_banner_url: '', custom_banner_link: '' }))}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Retirer la bannière
                </button>
              )}
          </div>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-black font-semibold text-sm">Liens</label>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  links: [...prev.links, { url: '', label: '' }]
                }))}
                className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700"
              >
                <Plus size={14} />
                Ajouter un lien
              </button>
            </div>
            {formData.links.length === 0 && (
              <p className="mb-3 text-xs text-gray-500">Ajoutez un lien vers votre site ou vos réseaux sociaux.</p>
            )}
            <div className="space-y-2">
              {formData.links.map((link, idx) => (
                <div key={idx} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Nom du lien (ex. Instagram)"
                    value={link.label}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      links: prev.links.map((l, i) => i === idx ? { ...l, label: e.target.value } : l)
                    }))}
                    className="flex-1 bg-gray-50 border border-gray-300 text-black placeholder:text-gray-500 text-sm"
                  />
                  <Input
                    placeholder="URL (https://...)"
                    value={link.url}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      links: prev.links.map((l, i) => i === idx ? { ...l, url: e.target.value } : l)
                    }))}
                    className="flex-1 bg-gray-50 border border-gray-300 text-black placeholder:text-gray-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      links: prev.links.filter((_, i) => i !== idx)
                    }))}
                    className="text-red-600 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>
          </motion.div>
          </motion.div>
          );
          }
