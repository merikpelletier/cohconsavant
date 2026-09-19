import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Link2, X, Send } from 'lucide-react';

export default function PostComposer({ user, editingPost, onDone }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [links, setLinks] = useState([{ url: '', text: '' }]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title || '');
      setDescription(editingPost.description || '');
      setImages(editingPost.images || []);
      setLinks(editingPost.links?.length ? editingPost.links : [{ url: '', text: '' }]);
    }
  }, [editingPost]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setImages([]);
    setLinks([{ url: '', text: '' }]);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files).slice(0, 4 - images.length);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const res = await appClient.integrations.Core.UploadFile({ file });
        uploaded.push(res.file_url);
      }
      setImages(prev => [...prev, ...uploaded].slice(0, 4));
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const updateLink = (idx, field, value) => {
    setLinks(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };
  const addLink = () => setLinks(prev => [...prev, { url: '', text: '' }]);
  const removeLink = (idx) => setLinks(prev => prev.filter((_, i) => i !== idx));

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      return await appClient.functions.invoke('manageMemberPost', {
        action: 'save',
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberPosts'] });
      queryClient.invalidateQueries({ queryKey: ['memberPostsByEmail'] });
      resetForm();
      onDone?.();
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) return;
    const cleanLinks = links.filter(l => l.url.trim());
    const payload = {
      member_email: user.email,
      member_name: user.full_name || user.email,
      title: title.trim(),
      description: description.trim(),
      images,
      links: cleanLinks,
    };
    if (editingPost) payload.id = editingPost.id;
    saveMutation.mutate(payload);
  };

  return (
    <div className="bg-gradient-to-br from-red-950/40 via-neutral-950 to-neutral-950 border-2 border-red-600/40 rounded-lg p-5 mb-5 shadow-[0_0_24px_rgba(239,68,68,0.15)]">
      <input
        type="text"
        placeholder="Titre de votre post..."
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full bg-transparent text-white text-base font-medium placeholder:text-white focus:outline-none mb-2"
      />
      <textarea
        placeholder="Partagez quelque chose avec la communauté..."
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={3}
        className="w-full bg-transparent text-white text-sm placeholder:text-white focus:outline-none resize-none mb-3"
      />

      {/* Images preview */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative aspect-square rounded overflow-hidden group">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(idx)}
                className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Links */}
      {links.map((link, idx) => (
        <div key={idx} className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Texte du lien"
            value={link.text}
            onChange={e => updateLink(idx, 'text', e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded text-white text-xs px-2 py-1.5 placeholder:text-white focus:outline-none focus:border-red-500/40"
          />
          <input
            type="url"
            placeholder="URL (vidéo, etc.)"
            value={link.url}
            onChange={e => updateLink(idx, 'url', e.target.value)}
            className="flex-[2] bg-white/5 border border-white/10 rounded text-white text-xs px-2 py-1.5 placeholder:text-white focus:outline-none focus:border-red-500/40"
          />
          {links.length > 1 && (
            <button onClick={() => removeLink(idx)} className="text-white hover:text-red-500 px-1">
              <X size={14} />
            </button>
          )}
        </div>
      ))}

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-3">
          <label className="cursor-pointer flex items-center gap-1.5 text-white hover:text-white text-xs transition-colors">
            <ImagePlus size={16} />
            <span>Photo</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading || images.length >= 4} />
          </label>
          <button onClick={addLink} className="flex items-center gap-1.5 text-white hover:text-white text-xs transition-colors">
            <Link2 size={16} />
            <span>Lien</span>
          </button>
          {uploading && <span className="text-white text-xs">Upload...</span>}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !description.trim() || saveMutation.isPending || uploading}
          className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send size={14} />
          {saveMutation.isPending ? 'Publication...' : 'Publier'}
        </button>
      </div>
    </div>
  );
}
