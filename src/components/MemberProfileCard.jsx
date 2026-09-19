import React, { useState, useEffect } from 'react';
import { Edit2, Handshake, Heart, User, ImagePlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { appClient } from '@/api/appClient';
import { Link } from 'react-router-dom';
import FanSubscribeButton from '@/components/FanSubscribeButton';
import ProfileMarkers from '@/components/ProfileMarkers';

export default function MemberProfileCard({ profile, user, isOwnProfile, onEdit }) {
  const [sponsor, setSponsor] = useState(null);
  const [sponsorLoaded, setSponsorLoaded] = useState(false);

  useEffect(() => {
    const email = profile?.user_email || user?.email;
    if (!email) return;
    appClient.entities.ProfileSponsor.filter({ member_email: email, is_active: true })
      .then(sponsors => {
        if (sponsors.length > 0) {
          const random = sponsors[Math.floor(Math.random() * sponsors.length)];
          setSponsor(random);
        }
        setSponsorLoaded(true);
      })
      .catch(() => setSponsorLoaded(true));
  }, [profile?.user_email, user?.email]);

  if (!user) return null;

  const displayName = profile?.display_name || user?.full_name || '?';
  const initial = displayName.charAt(0).toUpperCase();

  // Banner priority: admin custom banner > active sponsor banner
  const bannerUrl = profile?.custom_banner_url || sponsor?.image_url;
  const bannerLink = profile?.custom_banner_url ? profile?.custom_banner_link : sponsor?.link;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black"
    >
      {/* Banner — admin custom or sponsor, or placeholder for the member */}
      <div className="w-full">
        {bannerUrl ? (
          bannerLink ? (
            <a href={bannerLink} target="_blank" rel="noopener noreferrer" className="block w-full">
              <img src={bannerUrl} alt="Banner" className="w-full aspect-[1170/320] object-cover" />
            </a>
          ) : (
            <img src={bannerUrl} alt="Banner" className="w-full aspect-[1170/320] object-cover" />
          )
        ) : (
          <div className="w-full aspect-[1170/320] bg-neutral-900 border-y border-white/10 flex flex-col items-center justify-center text-center px-4">
            <ImagePlus size={22} className="text-white/30 mb-1.5" />
            <p className="text-white/40 text-xs font-medium">Emplacement bannière</p>
            <p className="text-white/25 text-[10px] mt-0.5">1170 × 320 px recommandé</p>
          </div>
        )}
      </div>

      {/* Member badge */}
      <div className="px-8 pt-6">
        <span className={`inline-block text-white text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full ${profile?.is_fake ? 'bg-red-600' : 'bg-green-600'}`}>
          {profile?.is_fake ? 'Membre IA' : 'Membre H'}
        </span>
      </div>

      {/* User Icon */}
      <div className="px-8 pt-8 pb-2">
        <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <User size={28} className="text-white/50" />
          )}
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="px-8 pt-4 pb-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h2 className="text-white text-4xl md:text-5xl font-light tracking-tight mb-2">{displayName}</h2>
            {profile?.title && (
              <p className="text-red-500 text-xs font-bold tracking-widest uppercase">{profile.title}</p>
            )}
            <ProfileMarkers profile={profile} className="mt-2" />
          </div>
          {isOwnProfile && (
            <button onClick={onEdit} className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors">
              <Edit2 size={17} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* Bio */}
      {profile?.bio && (
        <div className="px-8 pb-8">
          <p className="text-white text-base leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Gallery */}
      {profile?.images && profile.images.length > 0 && (
        <div className="px-8 pb-8">
          <p className="text-white text-xs font-bold uppercase tracking-widest mb-5">Gallery</p>
          <div className="grid grid-cols-3 gap-4">
            {profile.images.map((img, idx) => (
              <div key={idx} className="relative aspect-[3/4] group cursor-pointer overflow-hidden rounded-md">
                <img src={img} alt={`gallery-${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons (non-owner only) */}
      {!isOwnProfile && (
        <div className="px-8 pb-10">
          <div className="flex flex-wrap gap-2.5">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold rounded-full transition-colors">
              <Heart size={16} className="text-red-500" fill="#ef4444" />
              <span>Fan · 1</span>
            </button>
            <Link
              to={`/SponsorRequest?member=${encodeURIComponent(profile?.user_email || user?.email || '')}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold rounded-full transition-colors"
            >
              <Handshake size={16} />
              <span>Sponsor</span>
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}