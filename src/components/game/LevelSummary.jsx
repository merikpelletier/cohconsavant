import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Trophy, Star, ArrowRight, TrendingUp, TrendingDown, AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Level summary overlay — shown when all elements are connected and validated.
 * Shows: final score, passage value, reserve carryover, best/weakest connections.
 * Allows advancing to next level or modifying connections.
 */
export default function LevelSummary({ session, level, connections, elements, summaryData, onAdvance, onModify, onClose }) {
  const [bestConn, setBestConn] = useState(null);
  const [weakestConn, setWeakestConn] = useState(null);

  // Fetch all interpretations for connection detail
  const interpretationIds = connections.map(c => c.interpretation_id).filter(Boolean);

  // Find best and weakest connections by points_change
  useEffect(() => {
    if (connections.length === 0) return;
    const sorted = [...connections].sort((a, b) => (b.points_change || 0) - (a.points_change || 0));
    setBestConn(sorted[0]);
    setWeakestConn(sorted[sorted.length - 1]);
  }, [connections]);

  const merit = summaryData?.current_merit ?? session?.merit_points ?? 0;
  const passageValue = level?.passage_value || 0;
  const passed = summaryData?.passed ?? (merit >= passageValue);
  const deficit = summaryData?.deficit || 0;
  const reserve = summaryData?.reserve ?? (passed ? merit - passageValue : 0);

  const elemName = (id) => elements.find(e => e.id === id)?.name || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className={`px-6 py-5 rounded-t-2xl ${passed ? 'bg-green-600' : 'bg-red-600'}`}>
          <div className="flex items-center gap-3">
            {passed ? <Trophy size={24} className="text-white" /> : <AlertTriangle size={24} className="text-white" />}
            <div>
              <h2 className="text-lg font-bold text-white">
                {passed ? `Level ${session?.current_level} Complete!` : 'Not Enough to Pass'}
              </h2>
              <p className="text-white/80 text-xs">
                {passed ? 'You can advance to the next tableau' : 'Modify connections to improve your score'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Score summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <Star size={16} className="text-yellow-500 mx-auto mb-1" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Final Score</p>
              <p className="text-xl font-bold text-gray-800">{merit.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <Trophy size={16} className="text-orange-500 mx-auto mb-1" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Passage</p>
              <p className="text-xl font-bold text-gray-800">{passageValue.toLocaleString()}</p>
            </div>
          </div>

          {/* Reserve / Deficit */}
          {passed ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Reserve Carried Over</span>
                <span className="text-sm font-bold text-green-700">{reserve.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Passage cost deducted. Remaining points become your reserve for the next level.</p>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">Deficit</span>
                <span className="text-sm font-bold text-red-700">{deficit.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">You need {deficit.toLocaleString()} more points to pass. Modify your weakest connections to improve.</p>
            </div>
          )}

          {/* Best and weakest connections */}
          {connections.length > 0 && (
            <div className="space-y-2">
              {bestConn && (
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={12} className="text-green-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Best Connection</span>
                  </div>
                  <p className="text-xs text-gray-700">{elemName(bestConn.element_a_id)} ↔ {elemName(bestConn.element_b_id)}</p>
                  <p className="text-[10px] text-green-600 font-bold">+{bestConn.points_change || 0} points</p>
                </div>
              )}
              {weakestConn && bestConn?.id !== weakestConn?.id && (
                <div className="bg-red-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown size={12} className="text-red-600" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">Weakest Connection</span>
                  </div>
                  <p className="text-xs text-gray-700">{elemName(weakestConn.element_a_id)} ↔ {elemName(weakestConn.element_b_id)}</p>
                  <p className="text-[10px] text-red-600 font-bold">{weakestConn.points_change || 0} points</p>
                </div>
              )}
            </div>
          )}

          {/* Connected elements count */}
          <div className="text-center text-xs text-gray-500">
            {elements.length} elements connected across {connections.length} connections
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-2">
          {passed ? (
            <button
              onClick={onAdvance}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm"
            >
              {session?.current_level >= 4 ? 'Finish' : 'Next Level'} <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={onModify}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-sm"
            >
              <RotateCcw size={14} /> Modify Connections
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold text-sm"
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  );
}