import React from 'react';
import { appClient } from '@/api/appClient';
import {
  Loader2, Send, Wand2, CheckCircle2, Info, Feather, MessageSquare,
  Paperclip, Box, X, ChevronUp, ChevronDown, Hand, Link2, ArrowLeftRight
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import Inline3DModel from '@/components/studio/Inline3DModel';
import GameCreationTool from '@/components/game/GameCreationTool';
import { useAuth } from '@/lib/AuthContext';

const RED = '#DC2626';
const DARK = '#1a1a1a';
const GRAY = '#666666';
const LIGHT_BG = '#ffffff';
const CARD_BG = '#f5f5f5';
const BORDER = '#e5e5e5';

function ElementCard({ element, label, color }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
      </div>
      <div className="flex items-center gap-2 rounded-lg p-1.5 border"
        style={{ background: CARD_BG, borderColor: BORDER }}>
        <div className="w-8 h-8 rounded-md bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
          {element.media_url ? (
            <img src={element.media_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Box size={14} className="text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-black text-xs font-bold uppercase tracking-wide truncate">{element.name}</p>
          <p className="text-gray-600 text-[10px] uppercase tracking-wider">{element.element_type}</p>
        </div>
        {element.is_connected && (
          <div className="flex items-center gap-1 px-1 py-0.5 rounded-full"
            style={{ background: 'rgba(220,38,38,0.08)' }}>
            <span className="w-1 h-1 rounded-full" style={{ background: RED }} />
            <span className="text-[9px] font-bold" style={{ color: RED }}>Linked</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GameMasterPanel({
  session,
  level,
  selectedElement,
  selectedElementB,
  aiRequest,
  interpretation,
  placementMode,
  levelSeed,
  allConnected,
  aConfirmed,
  bConfirmed,
  onConfirmA,
  onReleaseA,
  onConfirmB,
  onReleaseB,
  onAdvanceLevel,
  onInterpretationSubmitted,
  onCreationReady,
  onCreationPlaced,
  onClose,
  onBreakConnection
}) {
  const { user } = useAuth();
  const [interpretationText, setInterpretationText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [placingCreation, setPlacingCreation] = React.useState(false);
  const [creationData, setCreationData] = React.useState(null);
  const [error, setError] = React.useState('');
  const [showCreationTool, setShowCreationTool] = React.useState(false);
  const [showInterpretationInput, setShowInterpretationInput] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const handleSubmitInterpretation = async () => {
    if (!interpretationText.trim() || !selectedElement || !selectedElementB) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await appClient.functions.invoke('gameEvaluateInterpretation', {
        session_id: session.id,
        element_id: selectedElement.id,
        element_b_id: selectedElementB.id,
        text: interpretationText.trim()
      });
      onInterpretationSubmitted?.(res.data);
      setShowInterpretationInput(false);
    } catch (e) {
      setError(e.response?.data?.error || 'Evaluation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreationDone = (mediaUrl, mediaType) => {
    const data = {
      creation_type: mediaType === 'model' ? 'object' : mediaType,
      media_url: mediaUrl,
      model_url: mediaType === 'model' ? mediaUrl : null,
      description: ''
    };
    setCreationData(data);
    onCreationReady?.(data);
    setShowCreationTool(false);
  };

  const handlePlaceCreation = async (position) => {
    if (!creationData || !aiRequest || !selectedElement || !selectedElementB) return;
    setPlacingCreation(true);
    setError('');
    try {
      const res = await appClient.functions.invoke('gameEvaluateCreation', {
        session_id: session.id,
        ai_request_id: aiRequest.id,
        element_id: selectedElement.id,
        element_b_id: selectedElementB.id,
        creation_type: creationData.creation_type,
        media_url: creationData.media_url,
        model_url: creationData.model_url,
        description: creationData.description,
        position,
        rotation: 0
      });
      onCreationPlaced?.(res.data);
      setCreationData(null);
      setInterpretationText('');
    } catch (e) {
      setError(e.response?.data?.error || 'Evaluation failed');
    } finally {
      setPlacingCreation(false);
    }
  };

  React.useEffect(() => {
    const handler = (event) => {
      if (creationData && aiRequest && selectedElement && selectedElementB) {
        handlePlaceCreation(event.detail);
      }
    };
    window.addEventListener('game-place-creation', handler);
    return () => window.removeEventListener('game-place-creation', handler);
  }, [creationData, aiRequest, selectedElement, selectedElementB]);

  const handleCreateResponse = () => {
    if (creationData) return;
    if (aiRequest) {
      setShowCreationTool(true);
    } else if (!interpretation) {
      setShowInterpretationInput(true);
    }
  };

  // === EMPTY STATE: No element A selected ===
  if (!selectedElement) {
    return (
      <div className="relative w-full bg-white rounded-t-3xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="w-full flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-6 pb-7 pt-2 text-center">
          <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center">
            <Hand size={22} style={{ color: RED }} />
          </div>
          <h3 className="text-black text-lg font-bold uppercase tracking-widest mb-1.5">Select Element A</h3>
          <p className="text-gray-600 text-xs leading-relaxed px-4">
            Tap the first element you want to connect.
          </p>
        </div>
      </div>
    );
  }

  // === A selected, not confirmed — show info + Link/Release ===
  if (selectedElement && !aConfirmed) {
    return (
      <div className="relative w-full bg-white rounded-t-2xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="w-full flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">Element Info</span>
          {onClose && (
            <button onClick={onClose}>
              <X size={15} className="text-gray-600" />
            </button>
          )}
        </div>
        <div className="px-4 pb-3">
          <ElementCard element={selectedElement} label="Element A" color={RED} />
          {selectedElement.description && (
            <p className="text-gray-700 text-xs leading-snug mt-2 pl-0.5">{selectedElement.description}</p>
          )}
          {selectedElement.ai_narrative_hint && (
            <p className="text-gray-500 text-[11px] italic mt-1 pl-0.5">{selectedElement.ai_narrative_hint}</p>
          )}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onConfirmA}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm text-white"
            style={{ background: RED }}
          >
            <Link2 size={14} />
            Link
          </button>
          <button
            onClick={onReleaseA}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm border-2"
            style={{ color: RED, borderColor: RED }}
          >
            <X size={14} />
            Release
          </button>
        </div>
      </div>
    );
  }

  // === A confirmed, waiting for B ===
  if (aConfirmed && !selectedElementB) {
    return (
      <div className="relative w-full bg-white rounded-t-2xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="w-full flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">Linked Element A</span>
          {onClose && (
            <button onClick={onClose}>
              <X size={15} className="text-gray-600" />
            </button>
          )}
        </div>
        <div className="px-4 pb-4">
          <ElementCard element={selectedElement} label="Element A" color={RED} />
          <div className="mt-3 flex items-center gap-2 justify-center py-2 rounded-lg border border-dashed border-gray-300">
            <ArrowLeftRight size={16} className="text-gray-400" />
            <p className="text-gray-600 text-xs font-medium">Tap another element to link</p>
          </div>
        </div>
      </div>
    );
  }

  // === B selected, not confirmed — show info + Link/Release ===
  if (selectedElementB && !bConfirmed) {
    return (
      <div className="relative w-full bg-white rounded-t-2xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="w-full flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="px-4 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">Element Info</span>
          {onClose && (
            <button onClick={onClose}>
              <X size={15} className="text-gray-600" />
            </button>
          )}
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-start gap-1.5">
            <ElementCard element={selectedElement} label="Element A" color={RED} />
            <div className="flex flex-col items-center justify-center pt-5">
              <ArrowLeftRight size={16} style={{ color: RED }} />
            </div>
            <ElementCard element={selectedElementB} label="Element B" color={RED} />
          </div>
          {selectedElementB.description && (
            <p className="text-gray-700 text-xs leading-snug mt-2 pl-0.5">{selectedElementB.description}</p>
          )}
          {selectedElementB.ai_narrative_hint && (
            <p className="text-gray-500 text-[11px] italic mt-1 pl-0.5">{selectedElementB.ai_narrative_hint}</p>
          )}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onConfirmB}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm text-white"
            style={{ background: RED }}
          >
            <Link2 size={14} />
            Link
          </button>
          <button
            onClick={onReleaseB}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm border-2"
            style={{ color: RED, borderColor: RED }}
          >
            <X size={14} />
            Release
          </button>
        </div>
      </div>
    );
  }

  // === Both confirmed ===
  return (
    <div className="relative w-full bg-white rounded-t-2xl border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] max-h-[48vh] overflow-y-auto studio-tabs-scroll">
      {/* Handle */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex justify-center pt-2 pb-0.5 sticky top-0 bg-white z-10">
        <div className="flex flex-col items-center gap-0.5">
          <div className="w-8 h-0.5 rounded-full bg-gray-200" />
          {expanded ? <ChevronDown size={12} className="text-gray-300" /> : <ChevronUp size={12} className="text-gray-300" />}
        </div>
      </button>

      {/* Header */}
      <div className="px-4 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-600 font-bold uppercase tracking-widest">Connection</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(!expanded)}>
            <Info size={13} className="text-gray-600" />
          </button>
          {onClose && (
            <button onClick={onClose}>
              <X size={15} className="text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Element A ↔ B cards */}
      <div className="px-4 pb-2">
        <div className="flex items-start gap-1.5">
          <ElementCard element={selectedElement} label="Element A" color={RED} />
          <div className="flex flex-col items-center justify-center pt-5">
            <ArrowLeftRight size={16} style={{ color: RED }} />
          </div>
          <ElementCard element={selectedElementB} label="Element B" color={RED} />
        </div>
      </div>

      {/* === INTERPRETATION SECTION === */}
      <div className="px-4 pb-2">
        {interpretation ? (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <Feather size={13} style={{ color: RED }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>Interpretation</span>
            </div>
            <p className="text-black text-sm leading-snug pl-0.5">{interpretation.text}</p>
          </>
        ) : showInterpretationInput ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Feather size={13} style={{ color: RED }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>Interpretation</span>
            </div>
            <Textarea
              value={interpretationText}
              onChange={(e) => setInterpretationText(e.target.value)}
              placeholder="Why should A and B be connected?"
              rows={2}
              className="bg-white border-gray-200 text-black text-sm placeholder-gray-500 resize-none focus-visible:ring-0 rounded-lg"
            />
            <button
              onClick={handleSubmitInterpretation}
              disabled={!interpretationText.trim() || submitting}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-sm text-white disabled:opacity-40"
              style={{ background: RED }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
              Submit
            </button>
          </div>
        ) : (
          <button onClick={() => setShowInterpretationInput(true)}
            className="w-full text-left">
            <div className="flex items-center gap-1.5 mb-1">
              <Feather size={13} style={{ color: RED }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>Interpretation</span>
            </div>
            <p className="text-gray-600 text-xs leading-snug pl-0.5 italic">
              Why should these elements be connected?
            </p>
          </button>
        )}
      </div>

      {/* === AI REQUEST SECTION === */}
      <div className="px-4 pb-2">
        {aiRequest ? (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare size={13} style={{ color: DARK }} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-black">AI Request</span>
            </div>
            <div className="rounded-lg p-2 border" style={{ background: CARD_BG, borderColor: BORDER }}>
              <p className="text-black text-sm leading-snug font-medium">{aiRequest.request_text}</p>
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <MessageSquare size={13} style={{ color: DARK }} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-black">AI Request</span>
            </div>
            <p className="text-gray-600 text-xs leading-snug pl-0.5 italic">
              {interpretation
                ? 'Awaiting AI directive…'
                : 'Submit an interpretation to receive an AI request.'}
            </p>
          </div>
        )}
      </div>

      {/* Creation tool */}
      {aiRequest && !creationData && showCreationTool && (
        <div className="px-4 pb-2">
          <div className="rounded-lg p-2 border" style={{ background: CARD_BG, borderColor: BORDER }}>
            <GameCreationTool
              expectedType={aiRequest.expected_creation_type}
              onDone={handleCreationDone}
            />
          </div>
          <button
            onClick={() => setShowCreationTool(false)}
            className="w-full mt-1.5 py-1.5 rounded-lg text-gray-700 text-xs font-bold hover:text-black transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Creation ready */}
      {creationData && (
        <div className="px-4 pb-2">
          <div className="rounded-lg p-2 border flex items-center gap-2"
            style={{ background: CARD_BG, borderColor: 'rgba(34,197,94,0.3)' }}>
            <CheckCircle2 size={14} className="text-green-600" />
            <p className="text-black text-xs">Creation ready to place</p>
          </div>
          {placementMode && (
            <p className="text-center text-xs mt-1" style={{ color: RED }}>Tap the ground to place</p>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-2 space-y-1.5 border-t border-gray-100 pt-2">
          {interpretation?.ai_evaluation && (
            <div>
              <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">AI Evaluation</span>
              <p className="text-gray-700 text-xs leading-snug mt-0.5">{interpretation.ai_evaluation}</p>
            </div>
          )}
          {interpretation?.ai_score > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs">Score</span>
              <span className="text-black text-xs font-bold">{interpretation.ai_score}/100</span>
            </div>
          )}
          {level?.passage_value > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs">Passage Required</span>
              <span className="text-black text-xs font-bold">{level.passage_value}</span>
            </div>
          )}
          {session?.reserve_points > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs">Reserve</span>
              <span className="text-black text-xs font-bold">{session.reserve_points}</span>
            </div>
          )}
          {session?.credits_earned > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600 text-xs">Credits</span>
              <span className="text-black text-xs font-bold">{session.credits_earned}</span>
            </div>
          )}
          {levelSeed && (
            <div>
              <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Narrative Context</span>
              <p className="text-gray-700 text-xs leading-snug mt-0.5">{levelSeed}</p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-0.5 space-y-1.5">
        {allConnected && (
          <button
            onClick={onAdvanceLevel}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm text-white"
            style={{ background: RED }}
          >
            Validate Tableau
          </button>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={handleCreateResponse}
            disabled={submitting || !!creationData || !selectedElementB}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm text-white disabled:opacity-40"
            style={{ background: DARK }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            Create
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('game-place-creation', { detail: null }))}
            disabled={!creationData || placingCreation}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-sm text-white disabled:opacity-40"
            style={{ background: RED }}
          >
            {placingCreation ? <Loader2 size={14} className="animate-spin" /> : <Box size={14} />}
            Place
          </button>
        </div>
        <button
          onClick={() => {
            if (aiRequest) return;
            onBreakConnection?.();
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-full border text-[11px] font-bold transition-colors"
          style={!aiRequest ? { color: RED, borderColor: RED } : { color: GRAY, borderColor: BORDER, opacity: 0.4 }}
        >
          <Link2 size={12} />
          Break Connection
        </button>
      </div>

      {error && <p className="px-4 pb-2 text-xs" style={{ color: RED }}>{error}</p>}
    </div>
  );
}