import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Play, X, Menu, MoreVertical, ChevronUp } from 'lucide-react';
import GameCanvas from '@/components/game/GameCanvas';
import ProgressionPanel from '@/components/game/ProgressionPanel';
import GameMasterPanel from '@/components/game/GameMasterPanel';
import ConnectionDetail from '@/components/game/ConnectionDetail';
import LevelSummary from '@/components/game/LevelSummary';
import { Button } from '@/components/ui/button';

const CYAN = '#00F0FF';

export default function GamePlayer() {
  const { user } = useAuth();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [selectedElementBId, setSelectedElementBId] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [pendingCreation, setPendingCreation] = useState(null);
  const [currentInterpretation, setCurrentInterpretation] = useState(null);
  const [currentAiRequest, setCurrentAiRequest] = useState(null);
  const [levelElements, setLevelElements] = useState([]);
  const [levelSeed, setLevelSeed] = useState('');
  const [envConfig, setEnvConfig] = useState(null);
  const [themeTextures, setThemeTextures] = useState(null);
  const [currentLevel, setCurrentLevel] = useState(null);
  const [startingLevel, setStartingLevel] = useState(false);
  const [gameOver, setGameOver] = useState(null);
  const [levelSummary, setLevelSummary] = useState(null);
  const [panelHidden, setPanelHidden] = useState(false);
  const [aConfirmed, setAConfirmed] = useState(false);
  const [bConfirmed, setBConfirmed] = useState(false);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['gameSession', sessionId],
    queryFn: async () => {
      const res = await appClient.entities.GameSession.get(sessionId);
      return res;
    },
    enabled: !!sessionId && !!user,
  });

  const { data: theme } = useQuery({
    queryKey: ['gameTheme', session?.theme_id],
    queryFn: async () => (await appClient.functions.invoke('manageGameTheme', { action: 'get', id: session.theme_id })).data.item,
    enabled: !!session?.theme_id,
  });

  const startLevel = useCallback(async () => {
    if (!session || startingLevel) return;
    setStartingLevel(true);
    try {
      const res = await appClient.functions.invoke('gameStartLevel', { session_id: session.id });
      const data = res.data;
      setCurrentLevel(data.level);
      setLevelElements(data.elements);
      setLevelSeed(data.seed || '');
      setEnvConfig(data.level?.environment_config || null);
      setThemeTextures(data.theme_textures || null);
      queryClient.invalidateQueries({ queryKey: ['gameTheme', session.theme_id] });
      setSelectedElementId(null);
      setSelectedElementBId(null);
      setAConfirmed(false);
      setBConfirmed(false);
      setCurrentInterpretation(null);
      setCurrentAiRequest(null);
    } catch (e) {
      console.error('Failed to start level:', e);
    } finally {
      setStartingLevel(false);
    }
  }, [session, startingLevel]);

  useEffect(() => {
    if (session && !currentLevel && !startingLevel) {
      startLevel();
    }
  }, [session, currentLevel, startingLevel, startLevel]);

  const { data: connections = [] } = useQuery({
    queryKey: ['gameConnections', session?.id, currentLevel?.id],
    queryFn: async () => {
      if (!currentLevel) return [];
      const res = await appClient.entities.GameConnection.filter({ session_id: session.id, level_id: currentLevel.id });
      return res;
    },
    enabled: !!session && !!currentLevel,
  });

  useEffect(() => {
    if (connections.length > 0) {
      setLevelElements(prev => prev.map(el => {
        const isConnected = connections.some(c => c.element_a_id === el.id || c.element_b_id === el.id);
        return { ...el, is_connected: isConnected };
      }));
    }
  }, [connections]);

  const selectedElement = levelElements.find(e => e.id === selectedElementId);
  const selectedElementB = levelElements.find(e => e.id === selectedElementBId);

  const handleSelectElement = (elementId) => {
    if (placementMode) return;
    setPanelHidden(false);
    if (aConfirmed && bConfirmed) return;

    if (!aConfirmed) {
      if (selectedElementId === elementId) {
        setSelectedElementId(null);
      } else {
        setSelectedElementId(elementId);
      }
      setAConfirmed(false);
      setSelectedElementBId(null);
      setBConfirmed(false);
      setCurrentInterpretation(null);
      setCurrentAiRequest(null);
    } else {
      if (selectedElementBId === elementId) {
        setSelectedElementBId(null);
      } else {
        setSelectedElementBId(elementId);
      }
      setBConfirmed(false);
      setCurrentInterpretation(null);
      setCurrentAiRequest(null);
    }
  };

  const handleInterpretationSubmitted = (data) => {
    setCurrentInterpretation(data.interpretation);
    setCurrentAiRequest(data.ai_request);
  };

  const handleCreationReady = (data) => {
    setPendingCreation(data);
    setPlacementMode(!!data);
  };

  const handlePlaceCreation = (position) => {
    if (!pendingCreation) return;
    window.dispatchEvent(new CustomEvent('game-place-creation', { detail: position }));
    setPlacementMode(false);
  };

  const handleCreationPlaced = (data) => {
    setPendingCreation(null);
    setPlacementMode(false);
    setCurrentInterpretation(null);
    setCurrentAiRequest(null);
    setSelectedElementId(null);
    setSelectedElementBId(null);
    setAConfirmed(false);
    setBConfirmed(false);

    if (data.game_lost) {
      setGameOver({ lost: true, message: 'The coherence of the tableau has collapsed...' });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['gameConnections', session.id, currentLevel.id] });
    queryClient.invalidateQueries({ queryKey: ['gameSession', sessionId] });

    if (data.connection) {
      appClient.entities.GameElement.filter({ session_id: session.id, level_id: currentLevel.id }).then(els => {
        setLevelElements(els);
      });
    }
  };

  const handleSelectConnection = (connectionId) => {
    const conn = connections.find(c => c.id === connectionId);
    if (conn) setSelectedConnection(conn);
  };

  const handleAdvanceLevel = async () => {
    try {
      const res = await appClient.functions.invoke('gameCompleteLevel', { session_id: session.id });
      const data = res.data;
      if (data.error) { console.error(data.error); return; }
      if (data.game_completed) {
        setGameOver({ won: true, message: data.message });
        return;
      }
      setLevelSummary(data);
    } catch (e) {
      console.error('Failed to complete level:', e);
    }
  };

  const handleSummaryAdvance = () => {
    setLevelSummary(null);
    queryClient.invalidateQueries({ queryKey: ['gameSession', sessionId] });
    setCurrentLevel(null);
    setLevelElements([]);
    setSelectedElementId(null);
    setSelectedElementBId(null);
    setAConfirmed(false);
    setBConfirmed(false);
    setPanelHidden(false);
  };

  const handleSummaryModify = () => {
    setLevelSummary(null);
  };

  const handleModifyConnection = (connection) => {
    setSelectedConnection(null);
    setSelectedElementId(connection.element_a_id);
    setSelectedElementBId(connection.element_b_id);
    setAConfirmed(true);
    setBConfirmed(true);
    setCurrentInterpretation(null);
    setCurrentAiRequest(null);
  };

  if (sessionLoading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 size={28} className="animate-spin" style={{ color: CYAN }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a] text-zinc-400">
        <p>Session not found</p>
      </div>
    );
  }

  if (gameOver) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-8">
        {gameOver.won ? (
          <>
            <Play size={48} className="text-green-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Game Won!</h1>
          </>
        ) : gameOver.lost ? (
          <h1 className="text-2xl font-bold mb-2 text-red-500">Game Lost</h1>
        ) : null}
        <p className="text-zinc-500 text-sm text-center mb-6">{gameOver.message}</p>
        <Button onClick={() => navigate('/GameThemes')} className="bg-red-600 hover:bg-red-700">
          Back to themes
        </Button>
      </div>
    );
  }

  const allConnected = levelElements.length > 0 && levelElements.filter(e => e.source_type !== 'player_creation').every(e => e.is_connected);

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]">
      {/* === 3D Stage — full screen === */}
      <div className="absolute inset-0">
        {startingLevel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]">
            <Loader2 size={28} className="animate-spin" style={{ color: CYAN }} />
            <p className="text-zinc-500 text-base mt-3">Preparing the tableau...</p>
          </div>
        ) : (
          <GameCanvas
            elements={levelElements}
            connections={connections}
            selectedElementId={selectedElementId}
            selectedElementBId={selectedElementBId}
            onSelectElement={handleSelectElement}
            placementMode={placementMode}
            onPlaceCreation={handlePlaceCreation}
            creationModelUrl={pendingCreation?.model_url}
            onSelectConnection={handleSelectConnection}
            session={session}
            theme={theme}
            environmentConfig={envConfig}
            floorTextureUrl={themeTextures?.floor_texture_url || theme?.floor_texture_url}
            floorNormalUrl={themeTextures?.floor_normal_url || theme?.floor_normal_url}
            wallTextureUrl={themeTextures?.wall_texture_url || theme?.wall_texture_url}
            wallNormalUrl={themeTextures?.wall_normal_url || theme?.wall_normal_url}
          />
        )}
      </div>

      {/* === Header — solid white === */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button onClick={() => navigate('/GameThemes')}>
            <Menu size={24} className="text-black" />
          </button>
          <img
            src="/cochon-savant-icon.png"
            alt="Le Cochon Savant"
            className="h-12 w-auto object-contain"
          />
          <MoreVertical size={24} className="text-black" />
        </div>
        <ProgressionPanel
          session={session}
          level={currentLevel}
          elements={levelElements}
          onAdvanceLevel={handleAdvanceLevel}
          variant="bar"
        />
      </div>

      {/* === Reopen panel button when hidden === */}
      {!startingLevel && panelHidden && (
        <button
          onClick={() => setPanelHidden(false)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-5 py-2.5 rounded-full bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100"
        >
          <ChevronUp size={16} className="text-black" />
          <span className="text-black text-xs font-bold uppercase tracking-widest">Connection</span>
        </button>
      )}

      {/* === Bottom Sheet — overlay === */}
      {!startingLevel && !panelHidden && (
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <GameMasterPanel
            session={session}
            level={currentLevel}
            selectedElement={selectedElement}
            selectedElementB={selectedElementB}
            aiRequest={currentAiRequest}
            interpretation={currentInterpretation}
            placementMode={placementMode}
            levelSeed={levelSeed}
            allConnected={allConnected}
            aConfirmed={aConfirmed}
            bConfirmed={bConfirmed}
            onConfirmA={() => selectedElementId && setAConfirmed(true)}
            onReleaseA={() => {
              setSelectedElementId(null);
              setAConfirmed(false);
              setCurrentInterpretation(null);
              setCurrentAiRequest(null);
            }}
            onConfirmB={() => selectedElementBId && setBConfirmed(true)}
            onReleaseB={() => {
              setSelectedElementBId(null);
              setBConfirmed(false);
              setCurrentInterpretation(null);
              setCurrentAiRequest(null);
            }}
            onAdvanceLevel={handleAdvanceLevel}
            onInterpretationSubmitted={handleInterpretationSubmitted}
            onCreationReady={handleCreationReady}
            onCreationPlaced={handleCreationPlaced}
            onClose={() => setPanelHidden(true)}
            onBreakConnection={() => {
              setSelectedElementId(null);
              setSelectedElementBId(null);
              setAConfirmed(false);
              setBConfirmed(false);
              setCurrentInterpretation(null);
              setCurrentAiRequest(null);
              setPanelHidden(true);
            }}
          />
        </div>
      )}

      {/* Connection detail overlay */}
      {selectedConnection && (
        <ConnectionDetail
          connection={selectedConnection}
          elements={levelElements}
          onModify={handleModifyConnection}
          onClose={() => setSelectedConnection(null)}
        />
      )}

      {/* Level summary overlay */}
      {levelSummary && (
        <LevelSummary
          session={session}
          level={currentLevel}
          connections={connections}
          elements={levelElements}
          summaryData={levelSummary}
          onAdvance={handleSummaryAdvance}
          onModify={handleSummaryModify}
          onClose={() => setLevelSummary(null)}
        />
      )}
    </div>
  );
}
