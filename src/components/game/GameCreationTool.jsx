import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { Loader2, Image as ImageIcon, Mic, Video, Box, Upload, Check, RotateCcw } from 'lucide-react';
import Inline3DModel from '@/components/studio/Inline3DModel';

const RED = '#DC2626';
const DARK = '#1a1a1a';
const CARD_BG = '#f5f5f5';
const BORDER = '#e5e5e5';

// Maps expected_creation_type from the AI request to a tool category.
const TYPE_TO_TOOL = {
  image: 'image',
  audio: 'audio',
  video: 'video',
  object: '3d',
  character: '3d',
  character_variation: '3d',
  prop: '3d',
  clothing: '3d',
  decor: '3d',
};

function ToolButton({ icon: Icon, label, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-lg border transition-colors hover:bg-gray-50"
      style={{ borderColor: BORDER }}
    >
      <Icon size={20} style={{ color: color || DARK }} />
      <span className="text-[10px] font-bold uppercase tracking-wide text-black">{label}</span>
    </button>
  );
}

export default function GameCreationTool({ expectedType, onDone }) {
  const { user } = useAuth();
  const [tool, setTool] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // { url, mediaType }

  // Image state
  const [imgPrompt, setImgPrompt] = useState('');
  // Audio state
  const [audioText, setAudioText] = useState('');
  const [audioVoice, setAudioVoice] = useState('Rachel');
  const [audioEmotion, setAudioEmotion] = useState('none');

  const VOICES = [
    { id: 'Rachel', name: 'Rachel', gender: 'F', style: 'Warm' },
    { id: 'Drew', name: 'Drew', gender: 'M', style: 'Deep' },
    { id: 'Clyde', name: 'Clyde', gender: 'M', style: 'Calm' },
    { id: 'Paul', name: 'Paul', gender: 'M', style: 'Pro' },
    { id: 'Aria', name: 'Aria', gender: 'F', style: 'Dynamic' },
    { id: 'Domi', name: 'Domi', gender: 'F', style: 'Young' },
    { id: 'Dave', name: 'Dave', gender: 'M', style: 'Casual' },
    { id: 'Fin', name: 'Fin', gender: 'M', style: 'Soft' },
    { id: 'Bella', name: 'Bella', gender: 'F', style: 'Cheerful' },
    { id: 'Antoni', name: 'Antoni', gender: 'M', style: 'Rich' },
  ];

  const EMOTIONS = [
    { id: 'none', label: 'None', icon: '😐' },
    { id: 'excited', label: 'Excited', icon: '🤩' },
    { id: 'whispers', label: 'Whisper', icon: '🤫' },
    { id: 'sighs', label: 'Sighs', icon: '😮‍💨' },
    { id: 'laughs', label: 'Laughs', icon: '😂' },
    { id: 'sarcastic', label: 'Sarcastic', icon: '🙄' },
    { id: 'angry', label: 'Angry', icon: '😠' },
    { id: 'sad', label: 'Sad', icon: '😢' },
  ];
  // Video state
  const [vidPrompt, setVidPrompt] = useState('');

  useEffect(() => {
    setTool(TYPE_TO_TOOL[expectedType] || null);
    setPreview(null);
    setError('');
  }, [expectedType]);

  const generateImage = async () => {
    if (!imgPrompt.trim()) return;
    setGenerating(true); setError('');
    try {
      const res = await appClient.integrations.Core.GenerateImage({ prompt: imgPrompt.trim() });
      if (res.url) setPreview({ url: res.url, mediaType: 'image' });
      else setError('Image generation failed.');
    } catch (e) {
      setError(e.response?.data?.error || 'Image generation failed.');
    } finally { setGenerating(false); }
  };

  const generateAudio = async () => {
    if (!audioText.trim()) return;
    setGenerating(true); setError('');
    try {
      const emotionTag = EMOTIONS.find(e => e.id === audioEmotion)?.tag || '';
      const textWithEmotion = emotionTag ? `${emotionTag} ${audioText.trim()} ${emotionTag}` : audioText.trim();
      const response = await appClient.functions.invoke('generateSpeech', {
        text: textWithEmotion,
        voice: audioVoice,
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        speed: 1,
        language_code: 'en'
      });
      const url = response.data?.file_url || response.file_url;
      if (url) setPreview({ url, mediaType: 'audio' });
      else setError('Audio generation failed.');
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.message || 'Audio generation failed.');
    } finally { setGenerating(false); }
  };

  const generateVideo = async () => {
    if (!vidPrompt.trim()) return;
    setGenerating(true); setError('');
    try {
      const res = await appClient.integrations.Core.GenerateVideo({ prompt: vidPrompt.trim() });
      if (res.url) setPreview({ url: res.url, mediaType: 'video' });
      else setError('Video generation failed.');
    } catch (e) {
      setError(e.response?.data?.error || 'Video generation failed.');
    } finally { setGenerating(false); }
  };

  const handleUpload = async (e, mediaType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGenerating(true); setError('');
    try {
      const res = await appClient.integrations.Core.UploadFile({ file });
      if (res.file_url) setPreview({ url: res.file_url, mediaType });
      else setError('Upload failed.');
    } catch (e) {
      setError('Upload failed.');
    } finally { setGenerating(false); }
  };

  const confirmPreview = () => {
    if (preview) onDone(preview.url, preview.mediaType);
  };

  const discardPreview = () => {
    setPreview(null);
  };

  // === Preview step with playback ===
  if (preview) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-center" style={{ color: RED }}>
          Preview
        </p>
        {preview.mediaType === 'audio' && (
          <audio controls src={preview.url} className="w-full" />
        )}
        {preview.mediaType === 'image' && (
          <img src={preview.url} alt="preview" className="w-full rounded-lg border" style={{ borderColor: BORDER }} />
        )}
        {preview.mediaType === 'video' && (
          <video controls src={preview.url} className="w-full rounded-lg border" style={{ borderColor: BORDER }} />
        )}
        <div className="flex gap-1.5">
          <button
            onClick={confirmPreview}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-sm text-white"
            style={{ background: RED }}
          >
            <Check size={14} /> Use This
          </button>
          <button
            onClick={discardPreview}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-sm border"
            style={{ borderColor: BORDER, color: DARK }}
          >
            <RotateCcw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  // === 3D tool ===
  if (tool === '3d') {
    return (
      <div className="space-y-2">
        <Inline3DModel userEmail={user?.email} onDone={onDone} />
      </div>
    );
  }

  // === Image tool ===
  if (tool === 'image') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <ImageIcon size={13} style={{ color: RED }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>Image</span>
        </div>
        <textarea
          value={imgPrompt}
          onChange={(e) => setImgPrompt(e.target.value)}
          placeholder="Describe the image to generate…"
          rows={2}
          className="w-full bg-white border rounded-lg p-2 text-black text-sm placeholder-gray-500 resize-none focus-visible:ring-0"
          style={{ borderColor: BORDER }}
        />
        <button
          onClick={generateImage}
          disabled={!imgPrompt.trim() || generating}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-40"
          style={{ background: RED }}
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
          {generating ? 'Generating…' : 'Generate Image'}
        </button>
        <label className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold text-gray-700 cursor-pointer"
          style={{ borderColor: BORDER }}>
          <Upload size={12} /> Upload Image
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => handleUpload(e, 'image')} />
        </label>
      </div>
    );
  }

  // === Audio tool ===
  if (tool === 'audio') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Mic size={13} style={{ color: RED }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>Audio</span>
        </div>
        <textarea
          value={audioText}
          onChange={(e) => setAudioText(e.target.value)}
          placeholder="Enter text to convert to speech…"
          rows={2}
          className="w-full bg-white border rounded-lg p-2 text-black text-sm placeholder-gray-500 resize-none focus-visible:ring-0"
          style={{ borderColor: BORDER }}
        />
        <div className="flex gap-1 flex-wrap">
          {VOICES.map(v => (
            <button
              key={v.id}
              onClick={() => setAudioVoice(v.id)}
              className="px-2 py-1 rounded-md text-[10px] font-bold border transition-colors"
              style={
                audioVoice === v.id
                  ? { background: RED, color: '#fff', borderColor: RED }
                  : { background: '#fff', color: DARK, borderColor: BORDER }
              }
            >
              {v.name}
              <span className="block text-[8px] font-normal opacity-70">{v.gender} · {v.style}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {EMOTIONS.map(em => (
            <button
              key={em.id}
              onClick={() => setAudioEmotion(em.id)}
              className="px-1.5 py-1 rounded-md text-[9px] font-bold border transition-colors"
              style={
                audioEmotion === em.id
                  ? { background: RED, color: '#fff', borderColor: RED }
                  : { background: '#fff', color: DARK, borderColor: BORDER }
              }
            >
              {em.icon} {em.label}
            </button>
          ))}
        </div>
        <button
          onClick={generateAudio}
          disabled={!audioText.trim() || generating}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-40"
          style={{ background: RED }}
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
          {generating ? 'Generating…' : 'Generate Audio'}
        </button>
        <label className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold text-gray-700 cursor-pointer"
          style={{ borderColor: BORDER }}>
          <Upload size={12} /> Upload Audio
          <input type="file" accept="audio/*" className="hidden"
            onChange={(e) => handleUpload(e, 'audio')} />
        </label>
      </div>
    );
  }

  // === Video tool ===
  if (tool === 'video') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Video size={13} style={{ color: RED }} />
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>Video</span>
        </div>
        <textarea
          value={vidPrompt}
          onChange={(e) => setVidPrompt(e.target.value)}
          placeholder="Describe the video to generate…"
          rows={2}
          className="w-full bg-white border rounded-lg p-2 text-black text-sm placeholder-gray-500 resize-none focus-visible:ring-0"
          style={{ borderColor: BORDER }}
        />
        <button
          onClick={generateVideo}
          disabled={!vidPrompt.trim() || generating}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-40"
          style={{ background: RED }}
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
          {generating ? 'Generating…' : 'Generate Video'}
        </button>
        <label className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-bold text-gray-700 cursor-pointer"
          style={{ borderColor: BORDER }}>
          <Upload size={12} /> Upload Video
          <input type="file" accept="video/*" className="hidden"
            onChange={(e) => handleUpload(e, 'video')} />
        </label>
      </div>
    );
  }

  // === Picker (expectedType === 'any' or unknown) ===
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-600 text-center mb-2">
        Choose a creation tool
      </p>
      <div className="grid grid-cols-2 gap-2">
        <ToolButton icon={ImageIcon} label="Image" onClick={() => setTool('image')} color={RED} />
        <ToolButton icon={Mic} label="Audio" onClick={() => setTool('audio')} color={RED} />
        <ToolButton icon={Video} label="Video" onClick={() => setTool('video')} color={RED} />
        <ToolButton icon={Box} label="3D Object" onClick={() => setTool('3d')} color={DARK} />
      </div>
    </div>
  );
}