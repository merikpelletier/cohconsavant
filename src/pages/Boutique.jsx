import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingCart, Coins, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Boutique() {
  const [selectedSubSections, setSelectedSubSections] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const GENERAL_LIMIT = 8;
  const [cart, setCart] = useState(() => {
    const stored = sessionStorage.getItem('cochon_cart');
    return stored ? JSON.parse(stored) : [];
  });

  const { data: shopData, isLoading, error, refetch } = useQuery({
    queryKey: ['shopData'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getShopData', {});
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const products = shopData?.products || [];
  const allSections = shopData?.sections || [];
  const settings = shopData?.settings;

  const parentSections = allSections.filter(s => !s.parent_section_id);
  const subSectionsByParent = {};
  allSections.filter(s => s.parent_section_id).forEach(s => {
    if (!subSectionsByParent[s.parent_section_id]) subSectionsByParent[s.parent_section_id] = [];
    subSectionsByParent[s.parent_section_id].push(s);
  });

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || (!shopData && !isLoading)) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <p className="text-white text-lg font-medium mb-2">Boutique indisponible</p>
        <p className="text-white/50 text-sm mb-6 text-center">Une erreur temporaire est survenue. Réessayez.</p>
        <Button
          onClick={() => refetch()}
          className="bg-red-600 hover:bg-red-700 text-white rounded-full px-8"
        >
          Réessayer
        </Button>
      </div>
    );
  }

  // Group products by section
  const sectionMap = {};
  const uncategorized = [];
  products.forEach(product => {
    if (product.section_id && allSections.find(s => s.id === product.section_id)) {
      if (!sectionMap[product.section_id]) sectionMap[product.section_id] = [];
      sectionMap[product.section_id].push(product);
    } else {
      uncategorized.push(product);
    }
  });

  const orderedSections = parentSections;

  const renderProductCard = (product, idx, sectionIdx) => (
    <Link
      key={product.id}
      to={`${createPageUrl('ProductDetail')}?id=${product.id}`}
      className="block group"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, delay: idx * 0.08 }}
        className="relative bg-gradient-to-b from-neutral-900/80 to-neutral-950 border border-white/[0.06] rounded-2xl overflow-hidden hover:border-red-600/40 transition-all duration-300 cursor-pointer hover:shadow-[0_0_30px_-5px_rgba(220,38,38,0.15)]"
      >
        {/* Image */}
        <div className="relative aspect-[4/5] overflow-hidden bg-neutral-900">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={32} className="text-white/15" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
          {/* Price badge top-right */}
          {product.price && (
            <div className="absolute top-3 right-3 backdrop-blur-md bg-black/40 border border-white/10 rounded-full px-3 py-1">
              <span className="text-white text-sm font-medium">{product.price}</span>
            </div>
          )}
          {/* Token badge */}
          {product.token_price > 0 && (
            <div className="absolute top-3 left-3 backdrop-blur-md bg-red-600/80 border border-red-400/30 rounded-full px-2.5 py-1 flex items-center gap-1">
              <Coins size={11} className="text-white" />
              <span className="text-white text-xs font-medium">{product.token_price}</span>
            </div>
          )}
          {/* Name overlay bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white text-base font-medium tracking-wide mb-1 line-clamp-1">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-white/60 text-xs font-light line-clamp-1">
                {product.description}
              </p>
            )}
          </div>
          {/* Arrow indicator on hover */}
          <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-2">
            <ArrowRight size={14} className="text-white" />
          </div>
        </div>
      </motion.div>
    </Link>
  );

  const renderPlaceholderCard = (key) => (
    <div key={key} className="bg-neutral-950/40 border border-dashed border-white/[0.08] rounded-2xl overflow-hidden">
      <div className="aspect-[4/5] flex items-center justify-center bg-gradient-to-b from-neutral-900/50 to-neutral-950">
        <ImageIcon size={28} className="text-white/10" />
      </div>
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 bg-white/[0.06] rounded" />
        <div className="h-3 w-full bg-white/[0.03] rounded" />
        <div className="h-3 w-1/2 bg-white/[0.03] rounded" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black pb-24 pt-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-6 mb-8"
      >
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-white text-4xl font-bold tracking-tight">BOUTIQUE</h1>
            <div className="flex items-center gap-2 mt-3">
              <div className="w-16 h-[2px] bg-gradient-to-r from-red-600 to-transparent" />
              <p className="text-white/50 text-sm font-light">Achetez en argent ou en tokens</p>
            </div>
          </div>
          <Link to={createPageUrl('Cart')}>
            <Button
              variant="outline"
              className="border-white/15 text-white hover:bg-white hover:text-black relative rounded-full w-12 h-12 p-0"
            >
              <ShoppingCart size={18} />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {cartItemsCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Hero Banner */}
      {(settings?.hero_video || settings?.hero_image || settings?.hero_text) ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="px-6 mb-10"
        >
          {settings.hero_text && (
            <div className="mb-4">
              <p className="text-white text-2xl md:text-4xl font-bold tracking-tight max-w-lg">{settings.hero_text}</p>
            </div>
          )}
          {settings.hero_link ? (
            <a href={settings.hero_link} target="_blank" rel="noopener noreferrer" className="block relative rounded-2xl overflow-hidden group">
              {settings.hero_video ? (
                <video src={settings.hero_video} autoPlay loop muted playsInline className="w-full aspect-[16/5] object-cover" />
              ) : (
                <img src={settings.hero_image} alt="" className="w-full aspect-[16/5] object-cover transition-transform duration-700 group-hover:scale-105" />
              )}
            </a>
          ) : (
            <div className="relative rounded-2xl overflow-hidden">
              {settings.hero_video ? (
                <video src={settings.hero_video} autoPlay loop muted playsInline className="w-full aspect-[16/5] object-cover" />
              ) : (
                <img src={settings.hero_image} alt="" className="w-full aspect-[16/5] object-cover" />
              )}
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="px-6 mb-10"
        >
          <div className="relative rounded-2xl aspect-[16/5] overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-950 to-black flex flex-col items-center justify-center border border-white/[0.06]">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(220,38,38,0.15), transparent 60%)' }} />
            <ImageIcon size={36} className="text-white/20 mb-3 relative z-10" />
            <p className="text-white/40 text-sm font-light relative z-10">Bannière principale · image ou vidéo</p>
            <p className="text-white/25 text-xs mt-1 relative z-10">1170 × 320 px recommandé</p>
          </div>
        </motion.div>
      )}

      {/* Sections */}
      {orderedSections.map((section, sectionIdx) => (
        <motion.div
          key={section.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.4 }}
          className="mb-16"
        >
          {/* Section header */}
          <div className="px-6 mb-5 flex items-center gap-4">
            <span className="text-white/20 text-3xl font-bold tabular-nums">{String(sectionIdx + 1).padStart(2, '0')}</span>
            <div>
              <h2 className="text-white text-2xl font-bold tracking-tight">{section.name}</h2>
              <div className="w-10 h-[2px] bg-red-600 mt-2" />
            </div>
          </div>

          {/* Section promo text (above banner) */}
          {section.promo_text && (section.banner_video || section.banner_image) && (
            <div className="px-6 mb-4">
              <p className="text-white text-lg md:text-2xl font-bold tracking-tight">{section.promo_text}</p>
            </div>
          )}
          {/* Section banner */}
          {(section.banner_video || section.banner_image) && (
            <div className="px-6 mb-6 relative rounded-2xl overflow-hidden group">
              {section.banner_video ? (
                <video src={section.banner_video} autoPlay loop muted playsInline className="w-full aspect-[16/5] object-cover" />
              ) : (
                <img src={section.banner_image} alt={section.name} className="w-full aspect-[16/5] object-cover transition-transform duration-700 group-hover:scale-105" />
              )}
            </div>
          )}
          {/* Promo text only (no banner image/video) */}
          {section.promo_text && !section.banner_video && !section.banner_image && (
            <div className="px-6 mb-6">
              <p className="text-white text-lg md:text-2xl font-bold tracking-tight">{section.promo_text}</p>
            </div>
          )}
          {section.promo_image && !section.banner_video && !section.banner_image && (
            <div className="px-6 mb-6">
              <img src={section.promo_image} alt={section.name} className="w-full aspect-[16/5] object-cover rounded-2xl" />
            </div>
          )}
          {!section.banner_video && !section.banner_image && !section.promo_text && !section.promo_image && (
            <div className="px-6 mb-6">
              <div className="relative rounded-2xl aspect-[16/5] overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-950 flex flex-col items-center justify-center border border-white/[0.06]">
                <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0.1), transparent 60%)' }} />
                <ImageIcon size={20} className="text-white/15 mb-1 relative z-10" />
                <p className="text-white/30 text-xs font-light relative z-10">Bannière de section · image ou vidéo</p>
              </div>
            </div>
          )}

          {/* Sub-section menu */}
          {subSectionsByParent[section.id] && subSectionsByParent[section.id].length > 0 && (
            <div className="px-6 mb-6 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedSubSections({ ...selectedSubSections, [section.id]: null })}
                className={`px-5 py-2 text-sm whitespace-nowrap rounded-full border transition-all duration-300 ${
                  !selectedSubSections[section.id]
                    ? 'bg-white text-black border-white shadow-[0_0_15px_-3px_rgba(255,255,255,0.3)]'
                    : 'border-white/15 text-white/50 hover:text-white hover:border-white/30 bg-white/[0.03]'
                }`}
              >
                Général
              </button>
              {subSectionsByParent[section.id].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubSections({ ...selectedSubSections, [section.id]: sub.id })}
                  className={`px-5 py-2 text-sm whitespace-nowrap rounded-full border transition-all duration-300 ${
                    selectedSubSections[section.id] === sub.id
                      ? 'bg-white text-black border-white shadow-[0_0_15px_-3px_rgba(255,255,255,0.3)]'
                      : 'border-white/15 text-white/50 hover:text-white hover:border-white/30 bg-white/[0.03]'
                  }`}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}

          {/* Product grid */}
          {(() => {
            const sectionHasSubs = subSectionsByParent[section.id] && subSectionsByParent[section.id].length > 0;
            const selectedSubId = sectionHasSubs ? selectedSubSections[section.id] : null;
            const sectionProducts = sectionHasSubs
              ? (selectedSubId
                ? (sectionMap[selectedSubId] || [])
                : subSectionsByParent[section.id].flatMap(sub => sectionMap[sub.id] || []))
              : (sectionMap[section.id] || []);

            const sectionKey = selectedSubId || section.id;
            const isExpanded = expandedSections[sectionKey];
            const visibleProducts = !isExpanded
              ? sectionProducts.slice(0, GENERAL_LIMIT)
              : sectionProducts;
            const hasMore = sectionProducts.length > GENERAL_LIMIT && !isExpanded;

            return (
              <div>
                <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
                  {visibleProducts.length > 0 ? (
                    visibleProducts.map((product, idx) => renderProductCard(product, idx, sectionIdx))
                  ) : (
                    [1, 2, 3, 4].map((i) => renderPlaceholderCard(`ph-${section.id}-${i}`))
                  )}
                </div>
                {hasMore && (
                  <div className="px-6 mt-6 flex justify-center">
                    <button
                      onClick={() => setExpandedSections({ ...expandedSections, [sectionKey]: true })}
                      className="px-6 py-2.5 text-sm text-white/70 border border-white/15 rounded-full hover:text-white hover:border-white/40 hover:bg-white/[0.03] transition-all"
                    >
                      Voir tout ({sectionProducts.length})
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </motion.div>
      ))}

      {/* Uncategorized products */}
      {uncategorized.length > 0 && (
        <div className="mb-16">
          {orderedSections.length > 0 && (
            <div className="px-6 mb-5 flex items-center gap-4">
              <span className="text-white/20 text-3xl font-bold tabular-nums">{String(orderedSections.length + 1).padStart(2, '0')}</span>
              <div>
                <h2 className="text-white text-2xl font-bold tracking-tight">Autres</h2>
                <div className="w-10 h-[2px] bg-red-600 mt-2" />
              </div>
            </div>
          )}
          <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {(expandedSections['uncategorized']
              ? uncategorized
              : uncategorized.slice(0, GENERAL_LIMIT)
            ).map((product, idx) => renderProductCard(product, idx, orderedSections.length))}
          </div>
          {!expandedSections['uncategorized'] && uncategorized.length > GENERAL_LIMIT && (
            <div className="px-6 mt-6 flex justify-center">
              <button
                onClick={() => setExpandedSections({ ...expandedSections, uncategorized: true })}
                className="px-6 py-2.5 text-sm text-white/70 border border-white/15 rounded-full hover:text-white hover:border-white/40 hover:bg-white/[0.03] transition-all"
              >
                Voir tout ({uncategorized.length})
              </button>
            </div>
          )}
        </div>
      )}

      {orderedSections.length === 0 && uncategorized.length === 0 && (
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="px-6 mb-5 flex items-center gap-4">
              <span className="text-white/20 text-3xl font-bold tabular-nums">01</span>
              <div>
                <h2 className="text-white text-2xl font-bold tracking-tight">Section exemple</h2>
                <div className="w-10 h-[2px] bg-red-600 mt-2" />
              </div>
            </div>
            <div className="px-6 mb-6">
              <div className="relative rounded-2xl aspect-[16/5] overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-950 flex flex-col items-center justify-center border border-white/[0.06]">
                <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0.1), transparent 60%)' }} />
                <ImageIcon size={20} className="text-white/15 mb-1 relative z-10" />
                <p className="text-white/30 text-xs font-light relative z-10">Bannière de section · image ou vidéo</p>
              </div>
            </div>
            <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {[1, 2, 3, 4].map((i) => renderPlaceholderCard(`ph1-${i}`))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="px-6 mb-5 flex items-center gap-4">
              <span className="text-white/20 text-3xl font-bold tabular-nums">02</span>
              <div>
                <h2 className="text-white text-2xl font-bold tracking-tight">Autre section</h2>
                <div className="w-10 h-[2px] bg-red-600 mt-2" />
              </div>
            </div>
            <div className="px-6 mb-6">
              <div className="relative rounded-2xl aspect-[16/5] overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-950 flex flex-col items-center justify-center border border-white/[0.06]">
                <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0.1), transparent 60%)' }} />
                <ImageIcon size={20} className="text-white/15 mb-1 relative z-10" />
                <p className="text-white/30 text-xs font-light relative z-10">Bannière de section · image ou vidéo</p>
              </div>
            </div>
            <div className="px-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
              {[1, 2, 3, 4].map((i) => renderPlaceholderCard(`ph2-${i}`))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}