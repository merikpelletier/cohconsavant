import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CampaignBanner from '@/components/CampaignBanner';

function DossierCard({ dossier, ratingsMap, commentsMap, campaignsMap }) {
  const campaign = campaignsMap?.[dossier.id];
  return (
    <Link
      to={`/Magazine?dossier=${dossier.id}`}
      className="flex-shrink-0 w-32 group relative"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 relative">
        {dossier.cover_image ? (
          <img
            src={dossier.cover_image}
            alt={dossier.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-900">
            <span className="text-white/60 text-xs text-center px-2">{dossier.title}</span>
          </div>
        )}
        {campaign && <CampaignBanner campaign={campaign} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-bold leading-tight line-clamp-2 mb-1">{dossier.title}</p>
          {dossier.category && (
            <p className="text-white/50 text-[10px] uppercase tracking-wide">{dossier.category}</p>
          )}
          <div className="flex gap-2 text-white/70 text-[10px] mt-0.5">
            {ratingsMap[dossier.id]?.count > 0 && (
              <span>⭐ {ratingsMap[dossier.id].avg.toFixed(1)}</span>
            )}
            {commentsMap[dossier.id] > 0 && (
              <span>💬 {commentsMap[dossier.id]}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DossierGallery({ dossiers, ratingsMap = {}, commentsMap = {}, label, campaignsMap = {} }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  if (!dossiers || dossiers.length === 0) return null;

  return (
    <div className="mb-2">
      {label && <h2 className="text-white text-sm font-bold mb-2 uppercase tracking-wide">{label}</h2>}
      <div className="relative group/row">
        {dossiers.length > 3 && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-7 flex items-center justify-center bg-gradient-to-r from-black/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft size={16} className="text-white" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dossiers.map(d => (
            <DossierCard
              key={d.id}
              dossier={d}
              ratingsMap={ratingsMap}
              commentsMap={commentsMap}
              campaignsMap={campaignsMap}
            />
          ))}
        </div>

        {dossiers.length > 3 && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-7 flex items-center justify-center bg-gradient-to-l from-black/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight size={16} className="text-white" />
          </button>
        )}
      </div>
    </div>
  );
}