import React, { useState, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { Volume2, Loader2, Square } from 'lucide-react';

const SAMPLE_TEXT = "In a world of shadows and light, the story begins.";

export default function VoicePreviewButton({ voiceId }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const handlePreview = async () => {
    // If already playing, stop
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      const res = await appClient.integrations.Core.GenerateSpeech({
        text: SAMPLE_TEXT,
        voice: voiceId,
      });
      if (res?.url) {
        if (!audioRef.current) {
          audioRef.current = new Audio(res.url);
          audioRef.current.onended = () => setPlaying(false);
        } else {
          audioRef.current.src = res.url;
        }
        audioRef.current.play();
        setPlaying(true);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handlePreview(); }}
      className="w-6 h-6 rounded-full flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors flex-shrink-0"
      title="Preview voice"
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin text-current" />
      ) : playing ? (
        <Square size={9} className="text-current fill-current" />
      ) : (
        <Volume2 size={11} className="text-current" />
      )}
    </button>
  );
}