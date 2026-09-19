import React from 'react';
import { User } from 'lucide-react';
import ProfileMarkers from '@/components/ProfileMarkers';

export default function ProfilePresentation({ profile, user }) {
  const displayName = profile?.display_name || user?.full_name || '?';

  return (
    <div className="py-2 relative">
      {profile?.is_fake ? (
        <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
          Membre IA
        </span>
      ) : (
        <span className="absolute top-0 right-0 bg-green-600 text-white text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full">
          Membre H
        </span>
      )}
      <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center overflow-hidden mb-3">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <User size={28} className="text-white/50" />
        )}
      </div>
      <h2 className="text-white text-3xl font-light tracking-tight mb-1">{displayName}</h2>
      {profile?.title && (
        <p className="text-red-500 text-xs font-bold tracking-widest uppercase mb-3">{profile.title}</p>
      )}
      <ProfileMarkers profile={profile} className="mb-3" />
      {profile?.bio && (
        <p className="text-white/80 text-sm leading-relaxed">{profile.bio}</p>
      )}
    </div>
  );
}