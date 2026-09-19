import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Music, Volume2, X, Loader2, Play, Pause, Combine, CheckCircle2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appClient } from '@/api/appClient';
import { toast } from 'sonner';
import VoiceRecorder from './VoiceRecorder';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

export default function DubbingStudio({ block, dossier, onClose, onComplete, productionMethod = null, character = null, episodePageId, blockId, user }) {
  // Only show production context if coming from a Dossier production
  const showContext = productionMethod && block;
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [instrumentalUrl, setInstrumentalUrl] = useState(block?.instrumental_track_url || null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isMixing, setIsMixing] = useState(false);
  const [mixedResult, setMixedResult] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const audioRef = useRef(null);

  const handleVoiceRecorded = (url) => {
    setVoiceUrl(url);
    setShowRecorder(false);
  };

  const handleInstrumentalUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const result = await appClient.integrations.Core.UploadFile({ file });
    setInstrumentalUrl(result.file_url);
  };

  const handleMix = async () => {
    if (!voiceUrl || !instrumentalUrl) return;
    
    setIsMixing(true);
    try {
      const response = await appClient.functions.invoke('mixAudioVideo', {
        audio_url: voiceUrl,
        background_music_url: instrumentalUrl,
        mix_type: 'dubbing'
      });
      
      if (response.data?.file_url) {
        setMixedResult(response.data.file_url);
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Failed to mix audio'));
    } finally {
      setIsMixing(false);
    }
  };

  const togglePlayback = () => {
    if (!mixedResult && !voiceUrl) return;
    
    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleUseAudio = () => {
    const audioUrl = mixedResult || voiceUrl;
    if (!audioUrl) return;
    if (!user?.email) { onComplete(audioUrl); return; }
    setShowSaveVault(true);
  };

  // After the user picks a folder & the audio is saved to the Vault,
  // also attach it to the scene's episode block (if launched from one).
  const handleVaultSaved = async () => {
    const audioUrl = mixedResult || voiceUrl;
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setIsSaving(true);
      try {
        const timelines = await appClient.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        let timeline = timelines[0];
        if (!timeline) {
          await appClient.entities.UserTimeline.create({
            episode_page_id: episodePageId,
            user_email: user.email,
            block_overrides: [{ block_id: blockId, user_media_url: audioUrl, status: 'uploaded', notes: 'audio' }],
          });
        } else {
          const existingOverrides = timeline.block_overrides || [];
          const otherBlocks = existingOverrides.filter(b => b.block_id !== blockId);
          const updatedOverrides = [...otherBlocks, { block_id: blockId, user_media_url: audioUrl, status: 'uploaded', notes: 'audio' }];
          await appClient.entities.UserTimeline.update(timeline.id, { block_overrides: updatedOverrides });
        }
        toast.success('Audio saved to your Vault & episode!');
      } catch (err) {
        console.error('Error attaching audio to episode:', err);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onComplete(audioUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-black border border-red-500/30 rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white text-xl font-bold">Dubbing Studio</h3>
            <p className="text-white/60 text-sm">Mix your voice with instrumental</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Production Context Info - Only show when in Dossier production mode */}
        {showContext && (
          <ProductionContextInfo
            productionMethod={productionMethod}
            block={block}
            character={character}
            referenceMedia={[]}
          />
        )}

        {/* Step 1: Voice */}
        <div className="mb-6">
          <p className="text-white font-semibold mb-3 flex items-center gap-2">
            <Mic size={16} className="text-red-500" />
            1. Your Voice
          </p>
          <div className="bg-white/5 rounded-2xl p-4">
            {!voiceUrl ? (
              <div className="text-center">
                <Button
                  onClick={() => setShowRecorder(true)}
                  className="bg-red-700 hover:bg-red-800 text-white font-bold py-3 px-6 rounded-xl"
                >
                  <Mic size={18} className="mr-2" />
                  Record Voice
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <Volume2 size={18} className="text-black" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Voice recorded</p>
                  <audio src={voiceUrl} className="hidden" ref={audioRef} />
                </div>
                <button
                  onClick={() => setVoiceUrl(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Instrumental */}
        <div className="mb-6">
          <p className="text-white font-semibold mb-3 flex items-center gap-2">
            <Music size={16} className="text-red-500" />
            2. Instrumental Track
          </p>
          <div className="bg-white/5 rounded-2xl p-4">
            {!instrumentalUrl ? (
              <div className="text-center">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleInstrumentalUpload}
                    className="hidden"
                  />
                  <div className="bg-white/10 hover:bg-white/20 rounded-xl py-3 px-6 transition-colors">
                    <Upload size={18} className="text-white inline mr-2" />
                    <span className="text-white font-medium">Upload Instrumental</span>
                  </div>
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                  <Music size={18} className="text-black" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">Instrumental loaded</p>
                </div>
                <button
                  onClick={() => setInstrumentalUrl(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mix Button */}
        {voiceUrl && instrumentalUrl && !mixedResult && (
          <Button
            onClick={handleMix}
            disabled={isMixing}
            className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-4 rounded-2xl mb-4"
          >
            {isMixing ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Mixing...
              </>
            ) : (
              <>
                <Combine size={20} className="mr-2" />
                Mix Voice + Instrumental
              </>
            )}
          </Button>
        )}

        {/* Result */}
        {mixedResult && (
          <div className="bg-white/5 rounded-2xl p-6 mb-4 text-center">
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Volume2 size={28} className="text-black" />
            </div>
            <p className="text-white font-semibold mb-2">Mix Complete!</p>
            <p className="text-white/60 text-sm mb-4">Your voice has been mixed with the instrumental track</p>
            <audio src={mixedResult} controls className="w-full" />
          </div>
        )}

        {/* Complete Button */}
        {(mixedResult || (voiceUrl && !instrumentalUrl)) && (
          <Button
            onClick={handleUseAudio}
            disabled={isSaving}
            className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-4 rounded-2xl disabled:opacity-50"
          >
            {isSaving ? <><Loader2 size={20} className="mr-2 animate-spin" /> Saving…</> : <><CheckCircle2 size={20} className="mr-2" /> {mixedResult ? 'Use Mixed Audio' : 'Use Voice Only'}</>}
          </Button>
        )}

        {/* Save-to-Vault folder picker */}
        {showSaveVault && (
          <SaveToVaultModal
            userEmail={user?.email}
            imageUrl={mixedResult || voiceUrl}
            mediaType="audio"
            onClose={() => setShowSaveVault(false)}
            onSaved={handleVaultSaved}
          />
        )}

        {/* Voice Recorder Modal */}
        {showRecorder && (
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecorded}
            onClose={() => setShowRecorder(false)}
          />
        )}
      </motion.div>
    </div>
  );
}