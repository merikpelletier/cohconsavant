import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Play, Info, ChevronDown } from 'lucide-react';
import TopBanner from '@/components/TopBanner';
import PostFeed from '@/components/posts/PostFeed';

function DossierCard({ dossier }) {
  const img = dossier.cover_image;
  const isStoryTemplate = dossier.class === 'Story' && !!dossier.cover_template_image;

  // ── Story-class template cover: designed background (series title baked in) +
  // story title overlaid at the top, chosen scene image centered in the frame ──
  if (isStoryTemplate) {
    return (
      <Link
        to={`${createPageUrl('Magazine')}?dossier=${dossier.id}`}
        className="group/card relative block"
      >
        <div className="aspect-[9/16] overflow-hidden rounded-md bg-black relative border border-white/15 shadow-md group-hover/card:border-2 group-hover/card:border-red-600 group-hover/card:shadow-xl group-hover/card:scale-105 transition-all duration-200">
          {/* Template background with series title baked in */}
          <img src={dossier.cover_template_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          {/* Centered chosen scene image inside the template frame */}
          {img && (
            <div className="absolute left-[8%] right-[8%] top-[9%] bottom-[27%] flex items-center justify-center overflow-hidden">
              <img src={img} alt={dossier.title} className="w-full h-full object-cover" />
            </div>
          )}
          {/* Story title — top, larger, centered, no outline */}
          {!dossier.hide_text_on_cover && (
            <div className="absolute top-0 left-0 right-0 px-2 pt-2 text-center">
              <p className="text-white text-xl font-black uppercase tracking-wide leading-tight line-clamp-2 drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
                {dossier.title}
              </p>
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`${createPageUrl('Magazine')}?dossier=${dossier.id}`}
      className="group/card relative block"
    >
      <div className="aspect-[9/16] overflow-hidden rounded-md bg-black relative border border-white/15 shadow-md group-hover/card:border-2 group-hover/card:border-red-600 group-hover/card:shadow-xl group-hover/card:scale-105 transition-all duration-200">
        {img ? (
          <img src={img} alt={dossier.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black p-3">
            <span className="text-white text-sm font-extrabold text-center uppercase tracking-wide leading-tight">{dossier.title}</span>
          </div>
        )}
        {/* Book-cover title — big, top, yellow outline (only when not hidden) */}
        {!dossier.hide_text_on_cover && (
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black via-black/90 to-transparent pb-14 pt-2.5 px-2.5">
            <p className="text-white text-xl font-black uppercase leading-none tracking-tight line-clamp-3 drop-shadow-[0_2px_6px_rgba(0,0,0,1)]"
               style={{ WebkitTextStroke: '1.5px #dc2626' }}>{dossier.title}</p>
          </div>
        )}
      </div>
    </Link>
  );
}

function CollapsibleCategory({ label, dossiers, accentClass, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-2 break-inside-avoid">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2"
      >
        <span className={`w-1 h-4 ${accentClass} rounded-full`} />
        <h3 className="text-white text-sm font-bold flex-1 text-left">{label}</h3>
        <span className="text-white/40 text-[10px] font-bold">{dossiers.length}</span>
        <ChevronDown
          size={16}
          className={`text-white/60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className={`grid gap-2 pb-2 ${
          dossiers.length <= 1 ? 'grid-cols-1' :
          dossiers.length === 2 ? 'grid-cols-2' :
          'grid-cols-2 sm:grid-cols-3'
        }`}>
          {dossiers.map(d => <DossierCard key={d.id} dossier={d} />)}
        </div>
      )}
    </div>
  );
}

function ClassSection({ classLabel, dossiers, categories }) {
  if (dossiers.length === 0) return null;
  const accentClass = 'bg-red-600';

  const categorized = categories
    .map(cat => ({
      label: cat.name,
      dossiers: dossiers.filter(d => d.category === cat.name),
    }))
    .filter(row => row.dossiers.length > 0);

  const knownCategoryNames = categories.map(c => c.name);
  const uncategorized = dossiers.filter(d => !d.category || !knownCategoryNames.includes(d.category));

  return (
    <div className="break-inside-avoid lg:break-inside-auto mb-6">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-white text-lg font-extrabold tracking-wide uppercase">{classLabel}</h2>
        <span className={`px-2 py-0.5 ${accentClass} text-white text-[10px] font-bold rounded-full`}>{dossiers.length}</span>
        <div className="flex-1 h-px bg-white/20" />
      </div>

      <div className="px-1">
        {categorized.map((row, i) => (
          <CollapsibleCategory
            key={row.label}
            label={row.label}
            dossiers={row.dossiers}
            accentClass={accentClass}
            defaultOpen={true}
          />
        ))}

        {uncategorized.length > 0 && (
          <CollapsibleCategory
            label="Autres"
            dossiers={uncategorized}
            accentClass={accentClass}
            defaultOpen={categorized.length === 0}
          />
        )}
      </div>
    </div>
  );
}

export default function Index() {
  const { data: content, isLoading } = useQuery({
    queryKey: ['publishedContent'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getPublishedDossiers', {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const dossiers = content?.dossiers || [];
  const categories = content?.categories || [];
  const classes = content?.classes || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const heroDossier = dossiers.find(d => d.is_hero && (d.cover_video_landscape || d.cover_video)) || dossiers[0];
  // The hero is shown in the banner — exclude it (and any other flagged hero) from the card grid
  const restDossiers = dossiers.filter(d => !d.is_hero);

  const classSections = classes.map(cls => ({
    classLabel: cls.name,
    dossiers: restDossiers.filter(d => d.class === cls.name),
  }));

  const noClass = restDossiers.filter(d => !d.class);
  const heroImage = heroDossier?.cover_image_landscape || heroDossier?.cover_image;

  const allSections = [
    ...classSections,
    ...(noClass.length > 0 ? [{ classLabel: 'Autres', dossiers: noClass }] : []),
  ];
  const renderSection = (section) => (
    <ClassSection
      key={section.classLabel}
      classLabel={section.classLabel}
      dossiers={section.dossiers}
      categories={categories}
    />
  );

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* === TOP BANNER — promo video (left) + search & menu (right) === */}
      <TopBanner dossiers={dossiers} />

      {/* === COMMUNITY POST FEED === */}
      <PostFeed />

      {/* === Desktop: section-based masonry with varied tile sizes === */}
      <div className="hidden pt-4 px-4 lg:block lg:columns-3 xl:columns-4 2xl:columns-5 gap-4">
        {allSections.map(section => renderSection(section))}

        {dossiers.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-white/50 text-sm">Aucun contenu disponible</p>
          </div>
        )}
      </div>

      {/* === Mobile / tablet: untouched masonry === */}
      <div className="pt-4 px-4 columns-1 sm:columns-2 gap-4 lg:hidden">
        {allSections.map(section => renderSection(section))}

        {dossiers.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-white/50 text-sm">Aucun contenu disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}