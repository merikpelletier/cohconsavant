import React from 'react';
import { Lightbulb, User, Music, Users } from 'lucide-react';

const CYAN = '#00d1ff';

export default function GameDock({
  onJoystickStart,
  onJoystickMove,
  onJoystickEnd,
  joyKnob,
  pressBtn,
  releaseBtn,
  progressFilled = 8,
  progressTotal = 12,
  session,
  theme,
  onAIToggle,
}) {
  const clampedKnob = (val) => Math.max(-14, Math.min(14, val * 0.23));

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      {/* Cyan top accent line */}
      <div className="h-[2px] w-full" style={{ background: CYAN }} />

      {/* Dock body — dark frosted glass */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0a0a0a]/80 backdrop-blur-md border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.5)]">
        {/* D-Pad */}
        <div className="grid grid-cols-3 gap-0.5 w-16 shrink-0">
          <span />
          <DockBtn label="↑" onDown={() => pressBtn('up')} onUp={releaseBtn} />
          <span />
          <DockBtn label="←" onDown={() => pressBtn('left')} onUp={releaseBtn} />
          <DockBtn label="↓" onDown={() => pressBtn('down')} onUp={releaseBtn} />
          <DockBtn label="→" onDown={() => pressBtn('right')} onUp={releaseBtn} />
        </div>

        <Sep />

        {/* Joystick */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div
            className="relative w-12 h-12 rounded-full bg-[#121212] border border-white/10 touch-none cursor-pointer"
            onPointerDown={onJoystickStart}
            onPointerMove={onJoystickMove}
            onPointerUp={onJoystickEnd}
            onPointerLeave={onJoystickEnd}
          >
            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
            <div className="absolute inset-0 rounded-full border-t-2 border-r-2" style={{ borderColor: `${CYAN}50` }} />
            <div
              className="absolute top-1/2 left-1/2 w-5 h-5 rounded-full bg-zinc-700 pointer-events-none shadow-sm"
              style={{
                transform: `translate(calc(-50% + ${clampedKnob(joyKnob.x)}px), calc(-50% + ${clampedKnob(joyKnob.y)}px))`,
              }}
            />
          </div>
          <span className="text-[7px] text-zinc-600 whitespace-nowrap">WASD / drag</span>
        </div>

        <Sep />

        {/* Progress bar */}
        <div className="flex gap-0.5 shrink-0">
          {Array.from({ length: progressTotal }).map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-1 rounded-full"
              style={{ background: i < progressFilled ? CYAN : '#1a1a1a' }}
            />
          ))}
        </div>

        <Sep />

        {/* Session info */}
        <div className="hidden md:flex flex-col gap-0.5 text-[8px] text-zinc-500 shrink-0">
          <div className="flex items-center gap-1">
            <User size={8} className="text-zinc-600" /> Theme: <b className="font-semibold text-zinc-300 truncate max-w-[100px]">{theme?.title || 'SCKRIPT'}</b>
          </div>
          <div className="flex items-center gap-1">
            <Music size={8} className="text-zinc-600" /> Level <b className="font-semibold text-zinc-300">{session?.current_level || 1}/4</b>
          </div>
          <div className="flex items-center gap-1">
            <Users size={8} className="text-zinc-600" /> Score <b className="font-semibold text-zinc-300">{session?.merit_points || 0}</b>
          </div>
          <span className="text-zinc-700 text-[7px]">click elements · drag to orbit</span>
        </div>

        <span className="md:hidden text-[7px] text-zinc-700 shrink-0">click · drag</span>

        {/* AI Assistant button */}
        <button
          onClick={onAIToggle}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#121212] border shrink-0 active:scale-95 transition-transform"
          style={{ borderColor: `${CYAN}30`, boxShadow: `0 0 12px ${CYAN}20` }}
        >
          <Lightbulb size={12} style={{ color: CYAN }} />
          <span className="text-[9px] font-bold text-zinc-300">AI ASST</span>
        </button>
      </div>
    </div>
  );
}

function DockBtn({ label, onDown, onUp }) {
  return (
    <button
      className="w-5 h-5 rounded flex items-center justify-center bg-[#1a1a1a] text-zinc-500 text-[10px] active:bg-cyan-400 active:text-white"
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      {label}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-8 bg-white/5 shrink-0" />;
}