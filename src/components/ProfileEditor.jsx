import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Upload, Trash2 } from 'lucide-react';
import { appClient } from '@/api/appClient';

export default function ProfileEditor({ isOpen, onClose, profile, onSave }) {
  const [formData, setFormData] = useState({
    description: profile?.description || '',
    location: profile?.location || '',
    photos: profile?.photos || [],
    external_links: profile?.external_links || []
  });
  const [uploading, setUploading] = useState(false);
  const [newLink, setNewLink] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || formData.photos.length >= 5) return;

    setUploading(true);
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, file_url]
    }));
    setUploading(false);
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const addLink = () => {
    if (newLink && formData.external_links.length < 3) {
      setFormData(prev => ({
        ...prev,
        external_links: [...prev.external_links, newLink]
      }));
      setNewLink('');
    }
  };

  const removeLink = (index) => {
    setFormData(prev => ({
      ...prev,
      external_links: prev.external_links.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const handleDeleteProfile = async () => {
    try {
      // Delete user's messages (ignore errors if already deleted)
      try {
        const chatRes = await appClient.functions.invoke('manageChatMessage', { action: 'filter', filters: { session_id: profile.session_id }, limit: 5000 });
        await Promise.all((chatRes.data.items || []).map(m => appClient.functions.invoke('manageChatMessage', { action: 'delete', id: m.id, viewer_session_id: profile.session_id })));
      } catch (e) {}
      
      try {
        const sentRes = await appClient.functions.invoke('managePrivateMessage', { action: 'filter', viewer_session_id: profile.session_id, filters: { from_session_id: profile.session_id }, limit: 5000 });
        await Promise.all((sentRes.data.items || []).map(m => appClient.functions.invoke('managePrivateMessage', { action: 'delete', id: m.id, viewer_session_id: profile.session_id })));
      } catch (e) {}
      
      try {
        const rcvRes = await appClient.functions.invoke('managePrivateMessage', { action: 'filter', viewer_session_id: profile.session_id, filters: { to_session_id: profile.session_id }, limit: 5000 });
        await Promise.all((rcvRes.data.items || []).map(m => appClient.functions.invoke('managePrivateMessage', { action: 'delete', id: m.id, viewer_session_id: profile.session_id })));
      } catch (e) {}
      
      // Delete user profile (ignore if not found)
      try {
        await appClient.entities.TemporaryUser.filter({ id: profile.id }).delete();
      } catch (e) {}
      
      // Clear local storage
      const deviceId = localStorage.getItem('cochon_device_id');
      if (deviceId) {
        sessionStorage.removeItem(`cochon_session_${deviceId}`);
      }
      
      // Reload page to force re-registration
      window.location.reload();
    } catch (error) {
      console.error('Error deleting profile:', error);
      // Still reload to reset session
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-neutral-950 border border-white/10 rounded-sm max-w-md w-full max-h-[85vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-extralight tracking-widest">
                  PROFIL TEMPORAIRE
                </h2>
                <button onClick={onClose} className="text-white hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <p className="text-white text-xs mb-6">
                Ce profil sera supprimé à la fin de votre session.
              </p>

              <div className="space-y-6">
                {/* Description */}
                <div>
                  <label className="text-white text-sm block mb-2">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Quelques mots à votre sujet…"
                    maxLength={200}
                    className="bg-neutral-900 border-white/10 text-white placeholder:text-white resize-none"
                    rows={3}
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="text-white text-sm block mb-2">Localisation</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Ville ou région…"
                    className="bg-neutral-900 border-white/10 text-white placeholder:text-white"
                  />
                </div>

                {/* Photos */}
                <div>
                  <label className="text-white text-sm block mb-2">
                    Photos ({formData.photos.length}/5)
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {formData.photos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square">
                        <img
                          src={photo}
                          alt=""
                          className="w-full h-full object-cover rounded-sm"
                        />
                        <button
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-white hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {formData.photos.length < 5 && (
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                      <div className="w-full border border-white/20 text-white hover:text-white hover:bg-white/5 transition-colors rounded-md px-4 py-2 flex items-center justify-center">
                        <Upload size={16} className="mr-2" />
                        {uploading ? 'Chargement…' : 'Ajouter ou prendre une photo'}
                      </div>
                    </label>
                  )}
                </div>

                {/* Links */}
                <div>
                  <label className="text-white text-sm block mb-2">
                   Liens externes ({formData.external_links.length}/3)
                  </label>
                  <div className="space-y-2 mb-2">
                    {formData.external_links.map((link, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="flex-1 text-white text-sm truncate">{link}</span>
                        <button
                          onClick={() => removeLink(idx)}
                          className="text-white hover:text-white"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {formData.external_links.length < 3 && (
                    <div className="flex gap-2">
                      <Input
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        placeholder="https://..."
                        className="flex-1 bg-neutral-900 border-white/10 text-white placeholder:text-white"
                      />
                      <Button
                       onClick={addLink}
                       disabled={!newLink}
                       variant="outline"
                       className="border-white/20 text-white"
                      >
                       Ajouter
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 mt-8">
                <Button
                  onClick={handleSave}
                  className="w-full bg-white text-black hover:bg-white/90 font-light tracking-widest"
                >
                  ENREGISTRER
                </Button>

                {!showDeleteConfirm ? (
                  <Button
                    onClick={() => setShowDeleteConfirm(true)}
                    variant="outline"
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-light tracking-widest"
                  >
                    SUPPRIMER MES DONNÉES ET QUITTER
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-red-400 text-xs text-center">
                      Êtes-vous certain? Cette action est irréversible.
                    </p>
                    <div className="flex gap-2">
                       <Button
                        onClick={() => setShowDeleteConfirm(false)}
                        variant="outline"
                        className="flex-1 border-white/20 text-white"
                      >
                        Annuler
                      </Button>
                       <Button
                        onClick={handleDeleteProfile}
                        className="flex-1 bg-red-600 text-white hover:bg-red-700"
                      >
                        Confirmer
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
