import React, { useState, useEffect } from 'react';
import { ImagePlus } from 'lucide-react';
import { appClient } from '@/api/appClient';

/**
 * Profile banner — priority: admin custom banner > active sponsor banner > placeholder.
 * Used on both own and public profile views.
 */
export default function ProfileBanner({ profile, sponsor: sponsorProp }) {
  const [sponsor, setSponsor] = useState(sponsorProp || null);

  useEffect(() => {
    if (sponsorProp) { setSponsor(sponsorProp); return; }
    const email = profile?.user_email;
    if (!email) return;
    appClient.entities.ProfileSponsor.filter({ member_email: email, is_active: true })
      .then(sponsors => {
        if (sponsors.length > 0) {
          const random = sponsors[Math.floor(Math.random() * sponsors.length)];
          setSponsor(random);
        }
      })
      .catch(() => {});
  }, [profile?.user_email, sponsorProp]);

  const bannerUrl = profile?.custom_banner_url || sponsor?.image_url;
  const bannerLink = profile?.custom_banner_url ? profile?.custom_banner_link : sponsor?.link;

  return (
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
  );
}