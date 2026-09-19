import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, Play, Flame, Clock, Volume2, VolumeX } from 'lucide-react';

export default function TopBanner({ dossiers }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('popular');
  const heroVideoRef = useRef(null);
  const [heroMuted, setHeroMuted] = useState(true);

  const toggleHeroMute = () => {
    const v = heroVideoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    v.volume = 1;
    if (!next) { v.play().catch(() => {}); }
    setHeroMuted(next);
  };

  // Pick a promo video — prefer an admin-flagged hero dossier (with a video),
  // otherwise fall back to the first dossier that has a cover video.
  const promoDossier = useMemo(
    () =>
      dossiers.find(d => d.is_hero && (d.cover_video_landscape || d.cover_video)) ||
      dossiers.find(d => d.cover_video_landscape || d.cover_video) ||
      dossiers[0],
    [dossiers]
  );
  const promoVideo = promoDossier?.cover_video_landscape || promoDossier?.cover_video;
  const promoImage = promoDossier?.cover_image_landscape || promoDossier?.cover_image;

  // Sort for tabs
  const popularDossiers = useMemo(
    () => [...dossiers].sort((a, b) => (b.order || 0) - (a.order || 0)).slice(0, 4),
    [dossiers]
  );
  const recentDossiers = useMemo(
    () => [...dossiers].sort((a, b) => new Date(b.approved_at || 0) - new Date(a.approved_at || 0)).slice(0, 4),
    [dossiers]
  );

  const tabList = tab === 'popular' ? popularDossiers : recentDossiers;

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return tabList;
    const q = search.toLowerCase();
    return dossiers.filter(d =>
      (d.title || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q) ||
      (d.subtitle || '').toLowerCase().includes(q)
    ).slice(0, 4);
  }, [search, tabList, dossiers]);

  return (
    <div className="flex w-full h-[40vh] lg:h-[55vh] min-h-[320px] lg:min-h-[360px]">
      {/* === LEFT: Promo video (9:16 portrait on desktop) === */}
      <div className="relative w-1/2 lg:w-2/5 overflow-hidden bg-black flex items-center justify-center">
        <div className="relative h-full aspect-[9/16] max-w-full">
        {promoVideo ? (
          <video
            ref={heroVideoRef}
            src={promoVideo}
            autoPlay
            muted
            loop
            playsInline
            poster={promoImage}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : promoImage ? (
          <img src={promoImage} alt={promoDossier?.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play size={40} className="text-white/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60 pointer-events-none" />
        {/* Unmute toggle */}
        {promoVideo && (
          <button
            onClick={toggleHeroMute}
            className="absolute top-3 right-3 z-20 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
            aria-label={heroMuted ? 'Activer le son' : 'Couper le son'}
          >
            {heroMuted ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
          </button>
        )}
        {promoDossier && (
          <Link
            to={`${createPageUrl('Magazine')}?dossier=${promoDossier.id}`}
            className="absolute bottom-4 left-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded font-bold text-sm hover:bg-black/80 transition"
          >
            <Play size={16} fill="white" />
            <span className="truncate">{promoDossier.title}</span>
          </Link>
        )}
        </div>
      </div>

      {/* === RIGHT: Black search + menu panel === */}
      <div className="w-1/2 lg:w-3/5 bg-black flex flex-col p-4 lg:p-6 gap-3 lg:gap-4 border-l border-white/10">
        {/* Search bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher du contenu..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 lg:pl-10 pr-3 py-2 lg:py-3 text-white text-sm lg:text-base placeholder-white/40 focus:outline-none focus:border-red-600/50 transition"
          />
        </div>

        {/* Menu tabs — stacked on mobile, row on larger */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setTab('popular')}
            className={`flex items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2.5 rounded text-xs lg:text-sm font-bold transition ${
              tab === 'popular' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            <Flame size={13} />
            Populaire
          </button>
          <button
            onClick={() => setTab('recent')}
            className={`flex items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2.5 rounded text-xs lg:text-sm font-bold transition ${
              tab === 'recent' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            <Clock size={13} />
            Récent
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto space-y-2 lg:space-y-3 pr-1">
          {filtered.length === 0 ? (
            <p className="text-white/40 text-xs lg:text-sm text-center py-6 lg:py-8">Aucun résultat</p>
          ) : (
            filtered.map(d => (
              <Link
                key={d.id}
                to={`${createPageUrl('Magazine')}?dossier=${d.id}`}
                className="flex items-center gap-2 lg:gap-3 group/search bg-white/5 hover:bg-white/10 rounded-lg p-1.5 lg:p-2.5 transition"
              >
                <div className="w-10 h-10 lg:w-14 lg:h-14 rounded overflow-hidden bg-white/10 flex-shrink-0">
                  {d.cover_image && <img src={d.cover_image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs lg:text-sm font-bold truncate">{d.title}</p>
                  {d.category && <p className="text-white/40 text-[10px] lg:text-xs">{d.category}</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}