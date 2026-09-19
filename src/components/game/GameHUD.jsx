import React from 'react';
import { Coins, Star, Trophy, Target, Layers, ArrowRight } from 'lucide-react';

// Heads-up display: points, level, reserve, credits, elements remaining.
export default function GameHUD({ session, level, elements, onAdvanceLevel }) {
  const unconnected = elements.filter(e => !e.is_connected).length;
  const connected = elements.length - unconnected;
  const passageValue = level?.passage_value || 0;
  const progress = passageValue > 0 ? Math.min(100, (session?.merit_points / passageValue) * 100) : 0;

  return (
    <div className="bg-black/90 border-b border-red-900/40 px-4 py-2 flex items-center justify-between gap-2 text-white">
      {/* Level indicator */}
      <div className="flex items-center gap-1.5">
        <Layers size={14} className="text-red-500" />
        <span className="text-xs font-bold">Lvl. {session?.current_level || 1}/4</span>
      </div>

      {/* Merit points */}
      <div className="flex items-center gap-1.5">
        <Star size={14} className="text-yellow-500" />
        <span className="text-xs font-bold">{session?.merit_points || 0}</span>
        <span className="text-white/40 text-[10px]">/ {passageValue}</span>
      </div>

      {/* Reserve */}
      <div className="flex items-center gap-1.5">
        <Trophy size={14} className="text-orange-500" />
        <span className="text-xs font-bold">{session?.reserve_points || 0}</span>
      </div>

      {/* Credits */}
      <div className="flex items-center gap-1.5">
        <Coins size={14} className="text-amber-400" />
        <span className="text-xs font-bold">{session?.credits_earned || 0}</span>
      </div>

      {/* Elements remaining */}
      <div className="flex items-center gap-1.5">
        <Target size={14} className="text-blue-400" />
        <span className="text-xs font-bold">{connected}/{elements.length}</span>
      </div>

      {/* Advance button when all connected */}
      {unconnected === 0 && elements.length > 0 && (
        <button
          onClick={onAdvanceLevel}
          className="flex items-center gap-1 bg-red-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-600 transition-colors"
        >
          Validate <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}