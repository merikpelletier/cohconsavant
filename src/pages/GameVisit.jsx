import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Sparkles, MessageCircle, Heart, Share2 } from 'lucide-react';
import GameCanvas from '@/components/game/GameCanvas';
import { Button } from '@/components/ui/button';

export default function GameVisit() {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [tour, setTour] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ['gameSession', sessionId],
    queryFn: async () => appClient.entities.GameSession.get(sessionId),
    enabled: !!sessionId && !!user,
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['gameLevels', sessionId],
    queryFn: async () => appClient.entities.GameLevel.filter({ session_id: sessionId }),
    enabled: !!sessionId && !!user,
  });

  const { data: elements = [] } = useQuery({
    queryKey: ['gameElements', sessionId],
    queryFn: async () => appClient.entities.GameElement.filter({ session_id: sessionId }),
    enabled: !!sessionId && !!user,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['gameConnectionsAll', sessionId],
    queryFn: async () => appClient.entities.GameConnection.filter({ session_id: sessionId }),
    enabled: !!sessionId && !!user,
  });

  const currentLevel = levels.find(l => l.status === 'in_progress') || levels[levels.length - 1];
  const levelElements = elements.filter(e => currentLevel && e.level_id === currentLevel.id);

  const handleGuidedTour = async () => {
    setGenerating(true);
    try {
      const res = await appClient.functions.invoke('gameGuidedVisit', { session_id: sessionId });
      setTour(res.data.tour);
    } catch (e) {
      console.error('Failed to generate tour:', e);
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 size={28} className="text-red-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        <p>Session not found</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black" style={{ paddingTop: 'calc(52px + env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="bg-black/90 border-b border-red-900/40 px-4 py-2 flex items-center justify-between">
        <button onClick={() => navigate('/GameThemes')} className="flex items-center gap-1 text-white/60 hover:text-white">
          <ArrowLeft size={16} />
          <span className="text-xs">Back</span>
        </button>
        <div className="text-center">
          <p className="text-white text-sm font-bold">{session.theme_title}</p>
          <p className="text-white/40 text-[10px]">by {session.player_name || session.player_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleGuidedTour} disabled={generating} size="sm" className="bg-red-700 hover:bg-red-600 text-xs">
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Guided Tour
          </Button>
        </div>
      </div>

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <GameCanvas
          elements={levelElements}
          connections={connections.filter(c => currentLevel && c.level_id === currentLevel.id)}
          selectedElementId={null}
          onSelectElement={() => {}}
          placementMode={false}
        />
      </div>

      {/* Tour panel */}
      {tour && (
        <div className="bg-zinc-950 border-t border-red-900/40 overflow-y-auto" style={{ maxHeight: '40vh' }}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-red-500" />
              <span className="text-white text-sm font-bold">AI Guided Tour</span>
            </div>
            <p className="text-white/80 text-xs leading-relaxed whitespace-pre-wrap">{tour}</p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="bg-black/90 border-t border-white/5 px-4 py-2 flex items-center justify-between text-white">
        <div className="flex items-center gap-3 text-xs">
          <span>Lvl. {session.current_level}/4</span>
          <span>{session.merit_points} pts</span>
          <span>{session.credits_earned} credits</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-white/60 text-xs">
            <Heart size={12} /> Like
            </button>
            <button className="flex items-center gap-1 text-white/60 text-xs">
             <MessageCircle size={12} /> Comment
            </button>
            <button className="flex items-center gap-1 text-white/60 text-xs">
             <Share2 size={12} /> Share
          </button>
        </div>
      </div>
    </div>
  );
}