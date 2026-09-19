import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { Loader2, Upload, Sparkles, Download, X, FileBox } from 'lucide-react';
import Model3DViewer from '@/components/studio/Model3DViewer';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

// Studio tool: generate a 3D .glb model from text or an image via
// Microsoft TRELLIS (handled by the replicateGenerate backend function).
export default function Inline3DModel({ userEmail, onDone }) {
  const [mode, setMode] = useState('text'); // 'text' | 'image'
  const [prompt, setPrompt] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [enablePbr, setEnablePbr] = useState(true);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const handleGenerate = async () => {
    if (mode === 'text' && !prompt.trim()) { setError('Enter a prompt describing the 3D object.'); return; }
    if (mode === 'image' && !photoUrl) { setError('Upload an image first.'); return; }
    setStatus('generating'); setError('');
    try {
      const payload = {
        method: 'generate_3d',
        enable_pbr: enablePbr,
      };
      if (mode === 'text') payload.prompt = prompt.trim();
      else payload.photo_url = photoUrl;
      const res = await appClient.functions.invoke('replicateGenerate', payload);
      if (res.data?.file_url) {
        setResultUrl(res.data.file_url);
        setStatus('idle');
      } else if (res.data?.error) {
        setError(res.data.error.includes('Insufficient tokens') ? 'Not enough tokens. Buy more to use this tool.' : res.data.error);
        setStatus('idle');
      } else {
        setError('Generation failed. Try again.');
        setStatus('idle');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error;
      setError(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Buy more to use this tool.' : (msg || 'Generation failed.'));
      setStatus('idle');
    }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-12">
      <Loader2 size={28} className="text-red-500 animate-spin" />
      <p className="text-white text-sm">Generating 3D model with TRELLIS… (3–5 min)</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-white/10 rounded-xl p-1">
        <button onClick={() => setMode('text')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'text' ? 'bg-red-700 text-white' : 'text-white hover:bg-white/10'}`}>
          Text to 3D
        </button>
        <button onClick={() => setMode('image')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${mode === 'image' ? 'bg-red-700 text-white' : 'text-white hover:bg-white/10'}`}>
          Image to 3D
        </button>
      </div>

      {mode === 'text' ? (
        <div>
          <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Describe the 3D object</p>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. an ornate golden chair shaped like an avocado, photorealistic 3D render"
            rows={3}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-red-500 resize-none" />
        </div>
      ) : (
        <div>
          <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Upload an image</p>
          {!photoUrl ? (
            <label className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-red-500 rounded-2xl cursor-pointer hover:border-red-500">
              <Upload size={24} className="text-red-500" />
              <span className="text-white text-sm text-center px-4">Upload image (single object, simple background)</span>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const f = e.target.files[0]; if (!f) return;
                try {
                  const { file_url } = await appClient.integrations.Core.UploadFile({ file: f });
                  setPhotoUrl(file_url);
                } catch {
                  setError('Upload failed. Try again.');
                }
              }} />
            </label>
          ) : (
            <div className="relative w-24 h-24 rounded-xl overflow-hidden">
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setPhotoUrl(null)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white">
                <X size={10} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Options */}
      <div className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
        <div>
          <p className="text-white text-sm font-bold">PBR Materials</p>
          <p className="text-white/40 text-xs">Normal maps for realistic surface detail</p>
        </div>
        <button onClick={() => setEnablePbr(v => !v)}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${enablePbr ? 'bg-red-700 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {enablePbr ? 'On' : 'Off'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button onClick={handleGenerate}
        className="w-full py-4 bg-red-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
        <Sparkles size={18} /> Generate 3D Model →
      </button>

      {/* Result */}
      {resultUrl && !showSaveModal && (
        <div className="space-y-3">
          <p className="text-white text-xs font-bold uppercase tracking-wider">Result</p>
          <div className="rounded-2xl overflow-hidden bg-black border border-white/10">
            <Model3DViewer url={resultUrl} />
          </div>
          <div className="flex gap-2">
            <a href={resultUrl} target="_blank" rel="noopener noreferrer" download
              className="flex-1 py-3 bg-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors">
              <Download size={16} /> Download .glb
            </a>
            <button onClick={() => setShowSaveModal(true)}
              className="flex-1 py-3 bg-red-500 text-black font-bold rounded-2xl flex items-center justify-center gap-2">
              <FileBox size={16} /> Save to Vault
            </button>
          </div>
        </div>
      )}

      {showSaveModal && resultUrl && (
        <SaveToVaultModal
          userEmail={userEmail}
          imageUrl={resultUrl}
          mediaType="model"
          onSaved={(saved) => {
            setShowSaveModal(false);
            const url = resultUrl;
            setResultUrl(null);
            onDone?.(url, 'model', saved.id);
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}