import React from 'react';

const RED = '#DC2626';

function NetworkGraph({ connected, total }) {
  const nodes = [];
  const cx = 20, cy = 20, r = 13;
  const count = Math.min(total, 6);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    nodes.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      isConn: i < connected,
    });
  }

  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      {nodes.map((n, i) => (
        <line key={`l-${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke={n.isConn ? RED : '#ccc'} strokeWidth="1.5" opacity={n.isConn ? 0.8 : 0.3} />
      ))}
      {nodes.map((n, i) => (
        <circle key={`n-${i}`} cx={n.x} cy={n.y} r="3"
          fill={n.isConn ? RED : '#bbb'} />
      ))}
      <circle cx={cx} cy={cy} r="4" fill={RED} opacity="0.9" />
    </svg>
  );
}

export default function ProgressionPanel({ session, level, elements, onAdvanceLevel, variant = 'bar' }) {
  const unconnected = elements.filter(e => !e.is_connected).length;
  const connected = elements.length - unconnected;
  const merit = session?.merit_points || 0;
  const currentLevel = session?.current_level || 1;

  if (variant === 'bar') {
    return (
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex flex-col items-center flex-1">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Level</span>
          <span className="text-3xl font-bold leading-none text-black">
            {currentLevel}
            <span className="text-gray-400 text-xl">/4</span>
          </span>
        </div>
        <div className="w-px h-12 bg-gray-200" />
        <div className="flex flex-col items-center flex-1">
          <span className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Score</span>
          <span className="text-3xl font-bold leading-none text-black">{merit.toLocaleString()}</span>
        </div>
        <div className="w-px h-12 bg-gray-200" />
        <div className="flex items-center gap-2 flex-1 justify-center">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Connected</span>
            <span className="text-3xl font-bold leading-none" style={{ color: RED }}>
              {connected}
              <span className="text-gray-400 text-xl">/{elements.length || 0}</span>
            </span>
          </div>
          <NetworkGraph connected={connected} total={elements.length || 0} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 font-bold uppercase tracking-widest">Level {currentLevel}/4</span>
        {onAdvanceLevel && (
          <button onClick={onAdvanceLevel} className="px-4 py-1.5 rounded-lg text-sm font-bold text-white"
            style={{ background: RED }}>
            Validate
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Merit</span>
          <p className="text-2xl font-bold text-black">{merit.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Connected</span>
          <p className="text-2xl font-bold" style={{ color: RED }}>{connected}/{elements.length || 0}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Reserve</span>
          <p className="text-2xl font-bold text-black">{session?.reserve_points || 0}</p>
        </div>
      </div>
    </div>
  );
}