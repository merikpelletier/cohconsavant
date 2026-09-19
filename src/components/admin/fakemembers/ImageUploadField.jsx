import React, { useRef, useState } from 'react';
import { appClient } from '@/api/appClient';
import { Upload, X, Loader2 } from 'lucide-react';

const INP = "w-full bg-neutral-900 border border-white/20 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-white/40";

export default function ImageUploadField({ label, value, onChange, folder = 'fakemembers' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await appClient.functions.invoke('uploadMemberImage', { file, folder });
      const url = res.data?.url;
      if (url) {
        onChange(url);
      } else {
        setError(res.data?.error || "Échec du téléversement");
      }
    } catch (err) {
      setError(err.message || "Échec du téléversement");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      {label && <label className="block text-white/50 text-xs mb-1 tracking-wide">{label}</label>}
      <div className="flex gap-2 items-start">
        {value && (
          <div className="relative flex-shrink-0">
            <img src={value} alt="" className="w-14 h-14 object-cover rounded-sm border border-white/20" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="URL ou téléverser un fichier"
            className={INP}
          />
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Téléversement...' : 'Téléverser une image'}
          </button>
        </div>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}