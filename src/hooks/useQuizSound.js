import { useState, useEffect, useRef, useCallback } from 'react';

// Sons de quiz : fichiers audio réels hébergés sur Supabase Storage.
const AUDIO_BASE = "https://zbfjexzxkvufcqvtsafu.supabase.co/storage/v1/object/public/quiz-audio/quiz";
const CORRECT_URL = `${AUDIO_BASE}/bonne_reponse.mp3`;
const WRONG_URL = `${AUDIO_BASE}/mauvaise_reponse.mp3`;
const LOOP_URL = `${AUDIO_BASE}/loop_quiz.mp3`;

export function useQuizSound() {
  const [muted, setMuted] = useState(false);
  const ctxRef = useRef(null);
  const musicRef = useRef(null);
  const sfxCorrectRef = useRef(null);
  const sfxWrongRef = useRef(null);

  const getCtx = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  // Précharge les fichiers SFX
  useEffect(() => {
    if (typeof window === 'undefined') return;
    sfxCorrectRef.current = new Audio(CORRECT_URL);
    sfxCorrectRef.current.preload = "auto";
    sfxWrongRef.current = new Audio(WRONG_URL);
    sfxWrongRef.current.preload = "auto";
  }, []);

  const playCorrect = useCallback(() => {
    if (muted) return;
    getCtx();
    const a = sfxCorrectRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [muted, getCtx]);

  const playWrong = useCallback(() => {
    if (muted) return;
    getCtx();
    const a = sfxWrongRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [muted, getCtx]);

  const playClick = useCallback(() => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.start(t);
    osc.stop(t + 0.07);
  }, [muted, getCtx]);

  const startMusic = useCallback(() => {
    if (muted) return;
    const ctx = getCtx();
    if (!ctx || musicRef.current) return;
    const audio = new Audio(LOOP_URL);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.5;
    audio.play().catch(() => {});
    musicRef.current = { audio };
  }, [muted, getCtx]);

  const stopMusic = useCallback(() => {
    if (!musicRef.current) return;
    const { audio } = musicRef.current;
    try { audio.pause(); } catch {}
    try { audio.src = ""; } catch {}
    musicRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (next) stopMusic();
      return next;
    });
  }, [stopMusic]);

  useEffect(() => () => {
    stopMusic();
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
  }, [stopMusic]);

  return { muted, toggleMute, playCorrect, playWrong, playClick, startMusic, stopMusic };
}