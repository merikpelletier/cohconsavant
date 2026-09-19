import React from 'react';

const LABELS = {
  age_range: { '18-29': '18-29', '30-45': '30-45', '46-65': '46-65', '66+': '66+' },
  sexual_role: { top: 'Top', bottom: 'Bottom', versatile: 'Versatile', side: 'Side' },
  body_type: { mince: 'Mince', opulent: 'Opulent', musclé: 'Musclé', efféminé: 'Efféminé', trans: 'Trans' },
};

export default function ProfileMarkers({ profile, size = 'sm', className = '' }) {
  const markers = [];
  if (profile?.age_range) markers.push(LABELS.age_range[profile.age_range] || profile.age_range);
  if (profile?.sexual_role) markers.push(LABELS.sexual_role[profile.sexual_role] || profile.sexual_role);
  if (profile?.body_type) markers.push(LABELS.body_type[profile.body_type] || profile.body_type);

  if (markers.length === 0) return null;

  const sizeCls = size === 'xs'
    ? 'text-[9px] px-1.5 py-0.5'
    : 'text-[10px] px-2 py-0.5';

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {markers.map((m, i) => (
        <span
          key={i}
          className={`${sizeCls} uppercase tracking-widest border border-white/20 text-white/60 rounded-full`}
        >
          {m}
        </span>
      ))}
    </div>
  );
}