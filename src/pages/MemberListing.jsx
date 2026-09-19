import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import ProfileMarkers from '@/components/ProfileMarkers';

function MemberCard({ profile, index }) {
  const coverImage = profile.avatar_url || profile.images?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
    >
      <Link
        to={`/MemberDashboard?email=${encodeURIComponent(profile.user_email)}`}
        className="group relative block overflow-hidden rounded-xl bg-white/[0.03] border border-white/10 hover:border-red-500/40 transition-all duration-300"
      >
        {/* Cover */}
        <div className="aspect-[3/4] overflow-hidden relative">
          {coverImage ? (
            <img
              src={coverImage}
              alt={profile.display_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-600/10 via-black to-black flex items-center justify-center">
              <span className="text-white/20 text-6xl font-extralight">
                {profile.display_name?.charAt(0) || '?'}
              </span>
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

          {/* Member badge */}
          {profile.is_fake ? (
            <span className="absolute top-2 right-2 bg-red-600 text-white text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full z-10">
              IA
            </span>
          ) : (
            <span className="absolute top-2 right-2 bg-green-600 text-white text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full z-10">
              H
            </span>
          )}

          {/* Name on image */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-white font-light tracking-wide text-base leading-tight">
              {profile.display_name || profile.user_email}
            </p>
            {profile.title && (
              <p className="text-red-500 text-[10px] tracking-widest uppercase mt-0.5">
                {profile.title}
              </p>
            )}
            <ProfileMarkers profile={profile} size="xs" className="mt-1.5" />
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="p-3">
            <p className="text-white/40 text-xs line-clamp-2 leading-relaxed">
              {profile.bio}
            </p>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

export default function MemberListing() {
  const [search, setSearch] = useState('');

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['memberProfiles'],
    queryFn: async () => (await appClient.functions.invoke('manageMemberProfile', { action: 'list' })).data.items,
    staleTime: 2 * 60 * 1000,
  });

  const filtered = profiles.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-black pb-24 pt-10">
      {/* Header */}
      <div className="px-6 mb-8">
        <h1 className="text-white text-3xl font-extralight tracking-[0.2em]">MEMBRES</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="w-10 h-px bg-red-600" />
          <span className="text-white/30 text-xs tracking-widest">
            {profiles.length} MEMBRES
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-3 text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-red-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-6 grid grid-cols-2 gap-3">
          {filtered.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-10 col-span-2">Aucun membre trouvé</p>
          ) : (
            filtered.map((profile, i) => (
              <MemberCard key={profile.id} profile={profile} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  );
}