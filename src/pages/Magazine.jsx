import React, { useState, useRef, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import DossierViewer from '@/components/DossierViewer';
import DossierCoverActions from '@/components/DossierCoverActions';
import { ChevronDown, ChevronUp, LayoutGrid, Volume2, VolumeX } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '@/lib/AppContext';

export default function Magazine() {
  const { setAppContext } = useAppContext();
  const [searchParams] = useSearchParams();
  const dossierId = searchParams.get('dossier');
  
  const [currentDossierIndex, setCurrentDossierIndex] = useState(0);
  const [viewingDossier, setViewingDossier] = useState(null);
  // True landscape: width significantly larger than height (ratio > 1.2), not just a wide tablet in portrait
  const [isLandscape, setIsLandscape] = useState(window.innerWidth / window.innerHeight > 1.2);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const hasInitialized = useRef(false);
  const coverVideoRef = useRef(null);
  const [coverMuted, setCoverMuted] = useState(true);

  const toggleCoverMute = (e) => {
    e.stopPropagation();
    const v = coverVideoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    v.volume = 1;
    if (!next) { v.play().catch(() => {}); }
    setCoverMuted(next);
  };

  const { data: dossiers = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['dossiers', 'published'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getPublishedDossiers', {});
      return res.data.dossiers || [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  useEffect(() => {
    if (dossiers.length > 0 && dossierId) {
      const index = dossiers.findIndex(d => d.id === dossierId);
      if (index !== -1) {
        setCurrentDossierIndex(index);
      }
    }
  }, [dossierId, dossiers.length]);

  const [membershipRequired, setMembershipRequired] = useState(false);

  const handleTouchStart = (e) => {
    if (e.target.closest('button, a, video, input, [role="button"]')) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current === 0) return;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchStartY.current - touchEndY.current;
    touchStartY.current = 0;
    touchEndY.current = 0;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentDossierIndex < dossiers.length - 1) {
        setCurrentDossierIndex(currentDossierIndex + 1);
      } else if (diff < 0 && currentDossierIndex > 0) {
        setCurrentDossierIndex(currentDossierIndex - 1);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (viewingDossier) return;
    if (e.key === 'ArrowDown' && currentDossierIndex < dossiers.length - 1) {
      setCurrentDossierIndex(currentDossierIndex + 1);
    } else if (e.key === 'ArrowUp' && currentDossierIndex > 0) {
      setCurrentDossierIndex(currentDossierIndex - 1);
    }
  };

  useEffect(() => {
    const handler = (e) => handleKeyDown(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentDossierIndex, viewingDossier, dossiers.length]);

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth / window.innerHeight > 1.2);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Broadcast Magazine context
  useEffect(() => {
    const current = dossiers[currentDossierIndex];
    setAppContext({
      page: 'Magazine',
      section: viewingDossier ? `Reading dossier: ${viewingDossier.title}` : `Browsing covers (${currentDossierIndex + 1}/${dossiers.length})`,
      detail: current && !viewingDossier ? `Current cover: ${current.title}${current.subtitle ? ' — ' + current.subtitle : ''}` : null,
    });
  }, [currentDossierIndex, viewingDossier, dossiers.length]);

  const openDossier = async (dossier) => {
    try {
      const res = await appClient.functions.invoke('getDossierPages', { dossier_id: dossier.id });
      const freshPages = res.data.pages;
      setViewingDossier({ ...dossier, pages: freshPages });
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        setMembershipRequired(true);
        return;
      }
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (dossiers.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center p-8">
        <h1 className="text-black text-3xl font-extralight tracking-widest mb-4">
          LE COCHON SAVANT
        </h1>
        {error ? (
          <>
            <p className="text-black text-sm mb-4">Impossible de charger le contenu.</p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="bg-red-600 text-white text-sm font-medium px-5 py-2 rounded hover:bg-red-500 transition-colors disabled:opacity-50"
            >
              {isFetching ? 'Chargement...' : 'Réessayer'}
            </button>
          </>
        ) : isLoading || isFetching ? (
          <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
        ) : (
          <p className="text-black text-sm">Bientôt disponible...</p>
        )}
      </div>
    );
  }

  const currentDossier = dossiers[currentDossierIndex];

  const activeCoverVideo = isLandscape
    ? (currentDossier?.cover_video_landscape || currentDossier?.cover_video)
    : currentDossier?.cover_video;
  const activeCoverImage = isLandscape
    ? (currentDossier?.cover_image_landscape || currentDossier?.cover_image)
    : currentDossier?.cover_image;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-white pb-16"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dossier Cover */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentDossier?.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="magazine-cover bg-black"
          style={{}}
          onClick={() => openDossier(currentDossier)}
        >
          {/* Cover Image/Video */}
          {activeCoverVideo ? (
            <video
              ref={coverVideoRef}
              src={activeCoverVideo}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : activeCoverImage ? (
            <img
              src={activeCoverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}



          {/* Program toggle — top left */}
          <Link
            to="/Index"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-[60px] left-4 z-20 w-9 h-9 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400 transition-colors"
          >
            <LayoutGrid size={16} className="text-black" />
          </Link>

          {/* Unmute toggle — top right (only when a cover video is playing) */}
          {activeCoverVideo && (
            <button
              onClick={toggleCoverMute}
              className="absolute top-[60px] right-4 z-20 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
              aria-label={coverMuted ? 'Activer le son' : 'Couper le son'}
            >
              {coverMuted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
            </button>
          )}

          {/* Content */}
          {!currentDossier?.hide_text_on_cover && (
            <div className="absolute top-[108px] left-0 right-0 px-6">
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-white text-4xl md:text-6xl font-black tracking-wide mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                {currentDossier?.title}
              </motion.h1>
              {currentDossier?.subtitle && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-white text-lg font-light"
                >
                  {currentDossier.subtitle}
                </motion.p>
              )}
              {currentDossier?.author_name && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-white text-sm mt-4 tracking-wide"
                >
                  Par {currentDossier.author_name}
                </motion.p>
              )}
            </div>
          )}

          {/* Tap to read indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={(e) => { e.stopPropagation(); openDossier(currentDossier); }}
              className="group flex items-center gap-3 bg-red-600 border border-red-600 rounded-full px-7 py-3.5 hover:bg-red-500 transition-all"
            >
              <span className="text-white text-sm font-light tracking-[0.2em] uppercase">Explorer</span>
              <span className="text-white group-hover:translate-x-1 transition-transform text-base">→</span>
            </motion.button>
          </div>

          {/* Cover Actions */}
          {!activeCoverVideo && (
            <div onClick={(e) => e.stopPropagation()}>
              <DossierCoverActions dossierId={currentDossier?.id} />
            </div>
          )}
          </motion.div>
          </AnimatePresence>

      {/* Navigation hints */}
      {currentDossierIndex > 0 && (
        <button
          onClick={() => setCurrentDossierIndex(currentDossierIndex - 1)}
          className="fixed left-1/2 -translate-x-1/2 text-white hover:text-white transition-colors z-10 drop-shadow-lg" style={{ top: 'calc(52px + env(safe-area-inset-top) + 16px)' }}
        >
          <ChevronUp size={28} />
        </button>
      )}
      {currentDossierIndex < dossiers.length - 1 && (
        <button
          onClick={() => setCurrentDossierIndex(currentDossierIndex + 1)}
          className="fixed bottom-20 left-4 text-white hover:text-white transition-colors z-10 drop-shadow-lg"
        >
          <ChevronDown size={28} />
        </button>
      )}

      {/* Dossier indicators */}
      <div className="fixed right-3 flex flex-col gap-1 z-10 overflow-hidden" style={{ top: 'calc(52px + env(safe-area-inset-top) + 100px)', maxHeight: 'calc(100vh - 52px - env(safe-area-inset-top) - 180px)' }}>
        {dossiers.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentDossierIndex(idx)}
            className={`w-1 rounded-full transition-all flex-shrink-0 ${
              idx === currentDossierIndex ? 'bg-red-600 h-4' : 'bg-white/60 h-1.5'
            }`}
          />
        ))}
      </div>

      {membershipRequired && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setMembershipRequired(false)}
        >
          <div
            className="w-full max-w-md bg-white text-black p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black mb-3">Contenu réservé aux membres</h2>
            <p className="text-sm text-black/70 mb-6">
              Un abonnement actif est requis pour consulter les pages de ce dossier.
            </p>
            <div className="flex gap-3">
              <Link
                to="/Membership"
                className="bg-red-600 text-white px-5 py-3 font-bold hover:bg-red-500 transition-colors"
                onClick={() => setMembershipRequired(false)}
              >
                Devenir membre
              </Link>
              <button
                onClick={() => setMembershipRequired(false)}
                className="border border-black/20 px-5 py-3 font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dossier Viewer */}
      {viewingDossier && viewingDossier.pages?.length > 0 && (
        <DossierViewer
          pages={viewingDossier.pages}
          dossier={viewingDossier}
          onClose={() => setViewingDossier(null)}
        />
      )}
    </div>
  );
}