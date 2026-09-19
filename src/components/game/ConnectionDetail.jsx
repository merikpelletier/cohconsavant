import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { X, Link2, MessageSquare, Wand2, Package, TrendingUp, TrendingDown, AlertTriangle, Edit3 } from 'lucide-react';

/**
 * Overlay shown when a red rope (connection) is clicked.
 * Shows: connected elements, interpretation, AI demand, creation, points.
 * Offers "Modify this connection" with a warning.
 */
export default function ConnectionDetail({ connection, elements, onModify, onClose }) {
  const [confirmModify, setConfirmModify] = useState(false);

  const elemA = elements.find(e => e.id === connection.element_a_id);
  const elemB = elements.find(e => e.id === connection.element_b_id);

  // Fetch interpretation
  const { data: interpretation } = useQuery({
    queryKey: ['gameInterpretation', connection.interpretation_id],
    queryFn: () => appClient.entities.GameInterpretation.get(connection.interpretation_id),
    enabled: !!connection.interpretation_id,
  });

  // Fetch creation
  const { data: creation } = useQuery({
    queryKey: ['gameCreation', connection.creation_id],
    queryFn: () => appClient.entities.GameCreation.get(connection.creation_id),
    enabled: !!connection.creation_id,
  });

  // Fetch AI request
  const { data: aiRequest } = useQuery({
    queryKey: ['gameAiRequest', connection.interpretation_id],
    queryFn: async () => {
      const reqs = await appClient.entities.GameAIRequest.filter({ interpretation_id: connection.interpretation_id });
      return reqs[0] || null;
    },
    enabled: !!connection.interpretation_id,
  });

  const points = connection.points_change || 0;
  const credits = connection.credits_change || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-red-600" />
            <span className="font-bold text-sm text-gray-800">Connection #{connection.order}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Connected elements */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Connected Elements</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-gray-800 truncate">{elemA?.name || '—'}</p>
                <p className="text-[9px] text-gray-400">{elemA?.element_type}</p>
              </div>
              <div className="w-6 h-0.5 bg-red-600" />
              <div className="flex-1 bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-gray-800 truncate">{elemB?.name || '—'}</p>
                <p className="text-[9px] text-gray-400">{elemB?.element_type}</p>
              </div>
            </div>
          </div>

          {/* Interpretation */}
          {interpretation && (
            <div className="bg-blue-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare size={12} className="text-blue-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Player Interpretation</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{interpretation.text}</p>
              {interpretation.ai_evaluation && (
                <p className="text-[10px] text-gray-500 mt-2 italic">AI: {interpretation.ai_evaluation}</p>
              )}
            </div>
          )}

          {/* AI Demand */}
          {aiRequest && (
            <div className="bg-amber-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Wand2 size={12} className="text-amber-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">AI Demand</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{aiRequest.request_text}</p>
            </div>
          )}

          {/* Creation */}
          {creation && (
            <div className="bg-green-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Package size={12} className="text-green-600" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700">Creation Used</span>
                <span className="text-[9px] text-gray-400 ml-auto">{creation.creation_type}</span>
              </div>
              {creation.media_url && (
                <img src={creation.media_url} alt="creation" className="w-full h-24 object-cover rounded-lg mb-2" />
              )}
              {creation.description && (
                <p className="text-xs text-gray-700">{creation.description}</p>
              )}
              {creation.ai_evaluation && (
                <p className="text-[10px] text-gray-500 mt-2 italic">AI: {creation.ai_evaluation}</p>
              )}
            </div>
          )}

          {/* Points */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Points</span>
            <div className="flex items-center gap-2">
              {points >= 0 ? (
                <TrendingUp size={14} className="text-green-600" />
              ) : (
                <TrendingDown size={14} className="text-red-600" />
              )}
              <span className={`text-sm font-bold ${points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {points >= 0 ? '+' : ''}{points}
              </span>
              {credits > 0 && (
                <span className="text-[10px] text-amber-600 font-bold">+{credits} cr</span>
              )}
            </div>
          </div>

          {/* AI evaluation summary */}
          {connection.ai_evaluation && (
            <div className="bg-red-50 rounded-xl p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-700">AI Evaluation</span>
              <p className="text-xs text-gray-700 mt-1 leading-relaxed">{connection.ai_evaluation}</p>
            </div>
          )}
        </div>

        {/* Modify button */}
        {onModify && (
          <div className="p-4 border-t border-gray-200 sticky bottom-0 bg-white">
            {confirmModify ? (
              <div className="space-y-2">
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
                  <AlertTriangle size={12} className="text-red-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-red-700">Modifying this connection can increase your score, reduce your score, or cause the loss of the game.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onModify(connection)}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold"
                  >
                    Confirm Modify
                  </button>
                  <button
                    onClick={() => setConfirmModify(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-xs font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmModify(true)}
                className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2 rounded-lg text-xs font-bold hover:bg-gray-50"
              >
                <Edit3 size={12} /> Modify this connection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}