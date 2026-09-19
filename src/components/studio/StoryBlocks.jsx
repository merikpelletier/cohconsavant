import React, { useState, useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, Loader2, Sparkles, ArrowLeft, CheckCircle2, Play, Clock, Film, Search, Users, Trash2, Clapperboard, RotateCcw, Plus, Clapperboard as Clap, Volume2, Image as ImageIcon, ChevronLeft, ChevronRight, Send, List, FolderDown } from 'lucide-react';
import { toast } from 'sonner';
import StoryPlayer from './StoryPlayer';
import BlockTextEditor from './BlockTextEditor';
import ManualBlockModal from './ManualBlockModal';
import ManualSegmentModal from './ManualSegmentModal';
import VoicePreviewButton from './VoicePreviewButton';
import PublishStoryModal from './PublishStoryModal';
import StorySwitcher from './StorySwitcher';
import UserCharacterEditor from './UserCharacterEditor';
import SaveToVaultModal from './SaveToVaultModal';

export default function StoryBlocks({ user, onBack }) {
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);
  const qc = useQueryClient();
  const [view, setView] = useState('browse'); // browse → session
  const [themes, setThemes] = useState([]);
  const [allTopics, setAllTopics] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [loadingThemes, setLoadingThemes] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedHero, setSelectedHero] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [tokenCost, setTokenCost] = useState(10);
  const [balance, setBalance] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPlayer, setShowPlayer] = useState(false);
  const [playerBlocks, setPlayerBlocks] = useState([]);
  const [narratorVoice, setNarratorVoice] = useState('river');
  const [storyArc, setStoryArc] = useState(null); // { chapter_count, start, middle, reveal } — AI-proposed, user-editable
  const [proposingArc, setProposingArc] = useState(false);

  const VOICES = [
    { id: 'river', label: 'River', desc: 'Calm, neutral', gender: 'Female' },
    { id: 'honey', label: 'Honey', desc: 'Warm, soft', gender: 'Female' },
    { id: 'sunny', label: 'Sunny', desc: 'Bright, upbeat', gender: 'Female' },
    { id: 'storm', label: 'Storm', desc: 'Formal, authoritative', gender: 'Male' },
    { id: 'spark', label: 'Spark', desc: 'Energetic, quick', gender: 'Male' },
  ];

  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [regenProgress, setRegenProgress] = useState(0);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingOverride, setPendingOverride] = useState(null); // { hero_id, topic_id } — next-chapter pivot only, never mutates the session
  const [directorNote, setDirectorNote] = useState(''); // steering instruction for the next chapter only

  const handlePublished = (dossierId) => {
    setActiveSession(prev => ({ ...prev, is_published: true, published_dossier_id: dossierId }));
  };

  const handleSaveDirectorNote = async () => {
    if (!activeSession) return;
    try {
      await appClient.entities.StorySession.update(activeSession.id, { director_note: directorNote });
    } catch {}
  };

  const handleVoiceChange = async (voiceId) => {
    setNarratorVoice(voiceId);
    if (!activeSession) return;
    try {
      await appClient.entities.StorySession.update(activeSession.id, { narrator_voice: voiceId });
      setActiveSession({ ...activeSession, narrator_voice: voiceId });
    } catch {
      toast.error('Failed to save voice choice');
    }
  };

  const handleRegenerateAllNarration = async () => {
    const eligible = blocks.filter(b => (b.segment_instructions || []).some(s => s?.narration_text));
    if (regeneratingAll) return;
    if (eligible.length === 0) {
      toast.error('No narration text found in any block yet.');
      return;
    }
    setRegeneratingAll(true);
    setRegenProgress(0);
    try {
      for (let i = 0; i < eligible.length; i++) {
        const block = eligible[i];
        try {
          const res = await appClient.functions.invoke('regenerateNarration', {
            block_id: block.id,
            voice: narratorVoice,
          });
          if (res.data?.narration_audio_urls) {
            const updatedUrls = res.data.narration_audio_urls;
            setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, narration_audio_urls: updatedUrls } : b));
          }
        } catch (e) {
          console.log(`Failed to regenerate block ${block.id}:`, e);
        }
        setRegenProgress(i + 1);
      }
      toast.success('All narration regenerated!');
    } catch {
      toast.error('Failed to regenerate some narration');
    } finally {
      setRegeneratingAll(false);
    }
  };

  // ── Pack details state ──
  const [themeSessions, setThemeSessions] = useState([]);
  const [loadingThemeSessions, setLoadingThemeSessions] = useState(false);

  // ── Manual block modal state ──
  const [manualModal, setManualModal] = useState({ open: false, insertPosition: 'after', afterBlockId: null });

  // ── Manual segment modal state ──
  const [segmentModal, setSegmentModal] = useState({ open: false, insertPosition: 'after', segmentIndex: 0, blockId: null, segmentNumber: 1 });

  // Load ALL story setup data ONCE via backend function (bypasses RLS)
  useEffect(() => {
    appClient.functions.invoke('getStorySetup', {})
      .then(res => {
        if (res.data?.themes) setThemes(res.data.themes);
        if (res.data?.topics) setAllTopics(res.data.topics);
        if (res.data?.characters) setAllCharacters(res.data.characters);
        if (res.data?.sets) setAllSets(res.data.sets);
        if (res.data?.token_cost) setTokenCost(res.data.token_cost);
      })
      .catch(() => toast.error('Failed to load story data'))
      .finally(() => setLoadingThemes(false));
  }, []);

  useEffect(() => {
    appClient.functions.invoke('getUserBalance', {})
      .then(res => { if (res.data) setBalance(res.data.balance ?? 0); })
      .catch(() => setBalance(0));
    appClient.auth.me()
      .then(u => { if (u?.role === 'admin') setIsAdmin(true); })
      .catch(() => {});
  }, []);

  const loadBlocks = async (sessionId) => {
    setLoadingBlocks(true);
    try {
      const blocksData = await appClient.entities.StoryBlock.filter({ session_id: sessionId }, 'order', 50);
      setBlocks(blocksData);
    } catch {}
    setLoadingBlocks(false);
  };

  const handleGenerate = async (sessionArg) => {
    const session = sessionArg || activeSession;
    if (!session) return;
    // Save any unsaved director note before generating so the backend reads it
    if (directorNote !== (session.director_note || '')) {
      await appClient.entities.StorySession.update(session.id, { director_note: directorNote }).catch(() => {});
    }
    setGenerating(true);
    setGenProgress(null);
    try {
      // ── Phase 1: Kick off story planning (returns immediately) ──
      const res = await appClient.functions.invoke('generateStoryBlock', {
        session_id: session.id,
        is_storyline_switch: !!pendingOverride,
        override_hero_id: pendingOverride?.hero_id,
        override_topic_id: pendingOverride?.topic_id,
      });
      setPendingOverride(null);
      if (res.data?.error) {
        toast.error(res.data.error);
        return;
      }
      if (!res.data?.story_block) {
        toast.error('Failed to start story generation');
        return;
      }

      const blockId = res.data.story_block.id;
      setBlocks(prev => [...prev, res.data.story_block]);

      // ── Phase 2: Poll for plan completion (agent writes the narrative async) ──
      let planReady = false;
      let plannedBlock = res.data.story_block;
      let planPollErrors = 0;
      while (!planReady && isMountedRef.current) {
        setGenProgress({ phase: 'planning', message: 'The AI agent is writing your story…' });
        await new Promise(r => setTimeout(r, 8000));
        const planRes = await appClient.functions.invoke('checkStoryBlockPlan', { block_id: blockId });
        if (planRes.data?.error) {
          // Block was deleted — stop silently
          if (planRes.data.error.toLowerCase().includes('not found')) break;
          // Transient error — keep polling instead of orphaning the block
          planPollErrors++;
          if (planPollErrors >= 40) {
            toast.error('Story planning is taking too long — please try again.');
            break;
          }
          continue;
        }
        planPollErrors = 0;
        const planData = planRes.data;
        if (planData.story_block) {
          plannedBlock = planData.story_block;
          setBlocks(prev => prev.map(b => b.id === blockId ? planData.story_block : b));
        }
        if (planData.balance_after !== undefined) setBalance(planData.balance_after);
        if (planData.status === 'pending' || planData.status === 'generating' || planData.status === 'completed') {
          planReady = true;
        } else if (planData.status === 'failed') {
          toast.error('Story planning failed');
          break;
        }
      }

      if (!planReady) {
        setGenerating(false);
        setGenProgress(null);
        return;
      }

      const updated = await appClient.entities.StorySession.get(session.id);
      setActiveSession(updated);

      // ── Phase 3: STOP — story is written, awaiting user review & production ──
      // Re-fetch the full block to show the complete plan
      try {
        const finalBlock = await appClient.entities.StoryBlock.get(blockId);
        setBlocks(prev => prev.map(b => b.id === blockId ? finalBlock : b));
      } catch {}
      setDirectorNote('');
      toast.success('Story written! Review the text and produce when ready.');
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.message || e.message || '';
      if (msg.toLowerCase().includes('not found')) {
        // Block was deleted mid-generation — stop silently
      } else {
        toast.error(msg?.includes('Insufficient') ? 'Not enough tokens. Please buy more.' : (msg || 'Generation failed'));
      }
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  };

  // Retry a block that failed partway through — clears null placeholders & stale prediction IDs, then re-polls
  const handleRetryBlock = async (blockId) => {
    try {
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;

      // Clean up: keep video_segments array intact (it's positional), just clear stale prediction IDs
      const existingMedia = [...(block.video_segments || [])];
      const cleanedSegs = (block.segment_instructions || []).map(s => ({
        ...s,
        prediction_id: null,
        prediction_created_at: null,
      }));

      await appClient.entities.StoryBlock.update(blockId, {
        generation_status: 'generating',
        active_prediction_id: null,
        last_error: null,
        segment_instructions: cleanedSegs,
      });

      toast.success('Restarting chapter generation…');

      // Update local state and re-poll
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, segment_instructions: cleanedSegs, generation_status: 'generating' } : b));

      setGenerating(true);
      setGenProgress(null);

      const totalSegments = cleanedSegs.length;
      let isComplete = false;
      let lastCompleted = existingMedia.filter(Boolean).length;
      let pollInterval = 10000;

      while (!isComplete && isMountedRef.current) {
        setGenProgress({ phase: 'video', completed: lastCompleted, total: totalSegments, message: `Generating scene ${lastCompleted}/${totalSegments}…` });
        await new Promise(r => setTimeout(r, pollInterval));
        const videoRes = await appClient.functions.invoke('generateBlockVideos', { block_id: blockId });
        if (videoRes.data?.error) {
          if (videoRes.data.error.toLowerCase().includes('rate limit')) {
            pollInterval = 30000;
            continue;
          }
          if (videoRes.data.error.toLowerCase().includes('not found')) break;
          toast.error(videoRes.data.error);
          break;
        }
        const videoData = videoRes.data;
        lastCompleted = videoData.completed_segments ?? lastCompleted;
        pollInterval = videoData.cooldown_sec ? (videoData.cooldown_sec * 1000) : 10000;
        setGenProgress({ phase: 'video', completed: lastCompleted, total: videoData.total_segments || totalSegments, message: videoData.message || `Generating segment ${lastCompleted + 1}…` });
        if (videoData.video_segments) {
          setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, video_segments: videoData.video_segments, narration_audio_urls: videoData.narration_audio_urls || b.narration_audio_urls, sfx_audio_urls: videoData.sfx_audio_urls || b.sfx_audio_urls, ambient_music_url: videoData.ambient_music_url || b.ambient_music_url, generation_status: videoData.status } : b));
        }
        if (videoData.status === 'completed') {
          isComplete = true;
          try {
            const finalBlock = await appClient.entities.StoryBlock.get(blockId);
            setBlocks(prev => prev.map(b => b.id === blockId ? finalBlock : b));
          } catch {}
          toast.success('Chapter generation complete!');
        }
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.message || e.message || '';
      if (!msg.toLowerCase().includes('not found')) {
        toast.error(msg || 'Retry failed');
      }
    }
    setGenerating(false);
    setGenProgress(null);
  };

  // Redo a single segment image (character inconsistency fix)
  const handleRedoSegment = async (blockId, segmentIndex, note) => {
    try {
      const res = await appClient.functions.invoke('regenerateSegment', { block_id: blockId, segment_index: segmentIndex, redo_note: note || '' });
      if (res.data?.block) {
        setBlocks(prev => prev.map(b => b.id === blockId ? res.data.block : b));
      }
      // Now poll generateBlockVideos to regenerate just that segment
      handleProduceBlock(blockId);
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Redo failed';
      if (!msg.toLowerCase().includes('not found')) toast.error(msg);
    }
  };

  // Start video production for a reviewed/pending block (user-initiated)
  const handleProduceBlock = async (blockId) => {
    setGenerating(true);
    setGenProgress(null);
    try {
      const block = blocks.find(b => b.id === blockId);
      if (!block) return;
      const totalSegments = (block.segment_instructions || []).length;
      let isComplete = false;
      let lastCompleted = (block.video_segments || []).filter(Boolean).length;
      let pollInterval = 10000;

      while (!isComplete && isMountedRef.current) {
        setGenProgress({ phase: 'video', completed: lastCompleted, total: totalSegments, message: `Generating scene ${lastCompleted}/${totalSegments}…` });
        await new Promise(r => setTimeout(r, pollInterval));
        const videoRes = await appClient.functions.invoke('generateBlockVideos', { block_id: blockId });
        if (videoRes.data?.error) {
          if (videoRes.data.error.toLowerCase().includes('rate limit')) {
            pollInterval = 30000;
            continue;
          }
          if (videoRes.data.error.toLowerCase().includes('not found')) break;
          toast.error(videoRes.data.error);
          break;
        }
        const videoData = videoRes.data;
        lastCompleted = videoData.completed_segments ?? lastCompleted;
        pollInterval = videoData.cooldown_sec ? (videoData.cooldown_sec * 1000) : 10000;
        setGenProgress({ phase: 'video', completed: lastCompleted, total: videoData.total_segments || totalSegments, message: videoData.message || `Generating segment ${lastCompleted + 1}…` });
        if (videoData.video_segments) {
          setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, video_segments: videoData.video_segments, narration_audio_urls: videoData.narration_audio_urls || b.narration_audio_urls, sfx_audio_urls: videoData.sfx_audio_urls || b.sfx_audio_urls, ambient_music_url: videoData.ambient_music_url || b.ambient_music_url, generation_status: videoData.status } : b));
        }
        if (videoData.status === 'completed') {
          isComplete = true;
          try {
            const finalBlock = await appClient.entities.StoryBlock.get(blockId);
            setBlocks(prev => prev.map(b => b.id === blockId ? finalBlock : b));
          } catch {}
          toast.success('Chapter produced!');
        }
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.response?.data?.message || e.message || '';
      if (!msg.toLowerCase().includes('not found')) {
        toast.error(msg || 'Production failed');
      }
    }
    setGenerating(false);
    setGenProgress(null);
  };

  // Create a manual block with user-picked media, inserted before/after an existing block
  const handleCreateManualBlock = async (blockData) => {
    const { afterBlockId, insertPosition } = manualModal;
    const session = activeSession;
    if (!session) return;

    // Determine the order for the new block
    let newOrder = 0;
    if (afterBlockId) {
      const refBlock = blocks.find(b => b.id === afterBlockId);
      if (refBlock) {
        newOrder = insertPosition === 'before' ? refBlock.order : refBlock.order + 1;
      }
    } else {
      newOrder = blocks.length;
    }

    // Shift orders of blocks that come after the insertion point
    const blocksToShift = blocks.filter(b => b.order >= newOrder);
    for (const b of blocksToShift) {
      await appClient.entities.StoryBlock.update(b.id, { order: b.order + 1 }).catch(() => {});
    }

    // Create the new block
    const newBlock = await appClient.entities.StoryBlock.create({
      session_id: session.id,
      order: newOrder,
      block_title: blockData.block_title,
      narrative_summary: blockData.narrative_summary,
      segment_instructions: blockData.segment_instructions,
      selected_characters: blockData.selected_characters,
      selected_sets: blockData.selected_sets,
      choice_options: blockData.choice_options,
      generation_status: 'pending',
      video_segments: blockData.segment_instructions.map(s => s.manual_media_url),
    });

    setBlocks(prev => {
      const updated = [...prev, newBlock].sort((a, b) => (a.order || 0) - (b.order || 0));
      return updated;
    });
    toast.success('Manual chapter added');
  };

  // Insert a single segment into an existing block at a specific position
  const handleAddSegment = async (segmentData) => {
    const { blockId, segmentIndex, insertPosition } = segmentModal;
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const insertAt = insertPosition === 'before' ? segmentIndex : segmentIndex + 1;

    const newSegmentInstruction = {
      segment_number: insertAt + 1,
      segment_purpose: 'context',
      media_type: segmentData.media_type,
      estimated_duration: '10-15 seconds',
      shot_framing: 'medium shot',
      selected_set: '',
      characters_present: [],
      story_action: segmentData.source_label || 'Manual scene',
      prompt: segmentData.media_url,
      narration_text: segmentData.narration_text || '',
      sound_effect: '',
      dialogue: '',
      emotional_tone: '',
      continuity_notes: 'Manual segment',
      manual_media_url: segmentData.media_url,
    };

    const newInstructions = [...(block.segment_instructions || [])];
    newInstructions.splice(insertAt, 0, newSegmentInstruction);

    const newVideoSegments = [...(block.video_segments || [])];
    newVideoSegments.splice(insertAt, 0, segmentData.media_url);

    const newNarrationUrls = [...(block.narration_audio_urls || [])];
    newNarrationUrls.splice(insertAt, 0, '');

    const newSfxUrls = [...(block.sfx_audio_urls || [])];
    newSfxUrls.splice(insertAt, 0, '');

    // Renumber segments
    newInstructions.forEach((s, i) => { s.segment_number = i + 1; });

    const updated = await appClient.entities.StoryBlock.update(blockId, {
      segment_instructions: newInstructions,
      video_segments: newVideoSegments,
      narration_audio_urls: newNarrationUrls,
      sfx_audio_urls: newSfxUrls,
    });

    setBlocks(prev => prev.map(b => b.id === blockId ? updated : b));
    toast.success('Segment added');
  };

  const handleNewStory = () => {
    setActiveSession(null);
    setBlocks([]);
    setSelectedTheme(null);
    setSelectedHero(null);
    setSelectedTopic(null);
    setPendingOverride(null);
    setView('browse');
  };

  // Switch hero & storyline for the NEXT CHAPTER ONLY — never mutates the main
  // story's hero/topic, so the story title & identity stay with the original hero.
  const handleSwitchHeroStoryline = ({ hero_character_id, starting_topic_id }) => {
    if (!activeSession) return;
    setPendingOverride({ hero_id: hero_character_id, topic_id: starting_topic_id });
    toast.success('Next chapter will pivot to the new hero & storyline. Your main story stays the same.');
  };

  // Delete a stuck/empty block so the user can re-generate
  const handleDeleteBlock = async (blockId) => {
    if (!confirm('Delete this chapter? This cannot be undone.')) return;
    try {
      await appClient.entities.StoryBlock.delete(blockId);
      setBlocks(prev => prev.filter(b => b.id !== blockId));
      toast.success('Chapter deleted — click Continue Story to regenerate');
    } catch {
      toast.error('Failed to delete block');
    }
  };

  // Filtered themes (packs) for the browse view
  const filteredThemes = themes.filter(t => {
    if (!t.is_active) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = t.title?.toLowerCase() || '';
      const type = t.type?.toLowerCase() || '';
      if (!title.includes(q) && !type.includes(q)) return false;
    }
    return true;
  });

  // Load (or reload) the user's existing storylines for a pack
  const refreshThemeSessions = async (theme) => {
    if (!theme) return;
    setLoadingThemeSessions(true);
    setThemeSessions([]);
    try {
      if (!user?.email) {
        setThemeSessions([]);
        setLoadingThemeSessions(false);
        return;
      }
      const res = await appClient.functions.invoke('getUserStorySessions', { theme_id: theme.id });
      setThemeSessions(res.data?.sessions || []);
    } catch {
      toast.error('Failed to load your stories');
      setThemeSessions([]);
    }
    setLoadingThemeSessions(false);
  };

  // Open pack details — show characters + existing sessions
  const handleSelectTheme = async (theme) => {
    setSelectedTheme(theme);
    setView('packDetails');
    refreshThemeSessions(theme);
  };

  // Select a character → auto-pick a random starting point (user can change via dropdown)
  const handleSelectCharacter = (character) => {
    setSelectedHero(character);
    const themeTopics = allTopics.filter(tp => tp.theme_id === selectedTheme.id);
    const randomTopic = themeTopics.length > 0 ? themeTopics[Math.floor(Math.random() * themeTopics.length)] : null;
    setSelectedTopic(randomTopic);
    setView('topicSelection');
  };

  // After a user creates/edits their own character, merge it into allCharacters and return to the pack
  const handleCharacterSaved = (character) => {
    setAllCharacters(prev => {
      const exists = prev.find(c => c.id === character.id);
      return exists ? prev.map(c => c.id === character.id ? character : c) : [...prev, character];
    });
    setView('packDetails');
  };

  // After topic selection → ask the AI to design a story arc the user can edit
  const handleTopicChosen = async (topic) => {
    setSelectedTopic(topic);
    setStoryArc(null);
    setProposingArc(true);
    setView('arcDefinition');
    try {
      const res = await appClient.functions.invoke('proposeStoryArc', {
        theme_id: selectedTheme.id,
        hero_character_id: selectedHero.id,
        starting_topic_id: topic.id,
      });
      if (res.data?.error) {
        toast.error(res.data.error);
        setView('topicSelection');
      } else {
        setStoryArc(res.data);
      }
    } catch {
      toast.error('Failed to design story arc');
      setView('topicSelection');
    } finally {
      setProposingArc(false);
    }
  };

  // Start the story session with the (edited) arc blueprint, then generate chapter 1
  const handleStartStory = async () => {
    const theme = selectedTheme;
    const topic = selectedTopic;
    if (!theme || !selectedHero || !topic) return;
    try {
      const session = await appClient.entities.StorySession.create({
        user_email: user.email, theme_id: theme.id, hero_story_character_id: selectedHero.id,
        starting_topic_id: topic.id, story_memory: {}, block_count: 0, status: 'active',
        arc_chapter_count: storyArc?.chapter_count || 0,
        arc_start: storyArc?.start || '',
        arc_middle: storyArc?.middle || '',
        arc_reveal: storyArc?.reveal || '',
      });
      setActiveSession(session);
      setBlocks([]); // Clear old chapters so the new story starts at Chapter 1
      setNarratorVoice(session.narrator_voice || 'river');
      setView('session');
      await loadBlocks(session.id);
      setTimeout(() => handleGenerate(session), 500);
    } catch { toast.error('Failed to start story session'); }
  };

  // Delete a session, its blocks, and any published Dossier/pages linked to it
  // so the story is also removed from the Magazine selection (Dramas list).
  const handleDeleteSession = async (session) => {
    const heroName = allCharacters.find(c => c.id === session.hero_story_character_id)?.name || 'Untitled';
    if (!confirm(`Delete "${heroName}'s Story"? This also removes it from the Magazine and cannot be undone.`)) return;
    try {
      const blocksToDelete = await appClient.entities.StoryBlock.filter({ session_id: session.id }, 'order', 200);
      for (const b of blocksToDelete) {
        await appClient.entities.StoryBlock.delete(b.id).catch(() => {});
        await new Promise(r => setTimeout(r, 150));
      }
      // Remove published Dossier + its block_player pages linked to this session
      try {
        const linkedRes = await appClient.functions.invoke('getDossierPages', { block_player_episode_page_id: session.id });
        const linkedPages = linkedRes.data.pages;
        const dossierIds = [...new Set(linkedPages.map(p => p.dossier_id).filter(Boolean))];
        for (const p of linkedPages) {
          await appClient.functions.invoke('deleteDossierPage', { id: p.id }).catch(() => {});
        }
        for (const did of dossierIds) {
          await appClient.entities.Dossier.delete(did).catch(() => {});
        }
      } catch {}
      await appClient.entities.StorySession.delete(session.id);
      setThemeSessions(prev => prev.filter(s => s.id !== session.id));
      qc.invalidateQueries({ queryKey: ['dossiers', 'published'] });
      toast.success('Story deleted');
    } catch {
      toast.error('Failed to delete story');
    }
  };

  // Resume an existing session — fetch fresh data so publish flag reflects DB, not stale list cache
  const handleResumeSession = async (session) => {
    const hero = allCharacters.find(c => c.id === session.hero_story_character_id);
    setSelectedHero(hero || null);
    setSelectedTopic(null);
    setView('session');
    loadBlocks(session.id);
    try {
      const fresh = await appClient.entities.StorySession.get(session.id);
      setActiveSession(fresh);
      setNarratorVoice(fresh.narrator_voice || 'river');
      setDirectorNote(fresh.director_note || '');
    } catch {
      setActiveSession(session);
      setNarratorVoice(session.narrator_voice || 'river');
    }
  };

  // ── BROWSE VIEW (available stories) ──
  if (view === 'browse') {
    return (
      <div className="px-5 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={20} className="text-red-500" />
          </button>
          <div>
            <h2 className="text-black text-2xl font-bold">Stories</h2>
            <p className="text-black text-sm font-bold">Browse available stories or create your own</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stories by hero or theme…"
            className="w-full bg-black/5 rounded-2xl pl-12 pr-4 py-3 text-black placeholder-black/40 font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
          />
        </div>

        {/* Story Packs (themes) */}
        {loadingThemes ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-black" /></div>
        ) : filteredThemes.length === 0 ? (
          <div className="bg-black/5 rounded-3xl p-10 text-center mb-6">
            <BookOpen size={40} className="text-black mx-auto mb-4" />
            <p className="text-black font-bold text-lg">No story packs available</p>
            <p className="text-black text-sm mt-1">Create themes in admin to see them here</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen size={18} className="text-black" />
              <h3 className="text-black font-bold text-base">Available Story Packs</h3>
              <span className="text-black text-xs font-bold">({filteredThemes.length})</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {filteredThemes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme)}
                  className="bg-black rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform"
                >
                  <div className="aspect-[4/3] bg-red-500 relative">
                    {theme.cover_image ? (
                      <img src={theme.cover_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen size={28} className="text-black" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <Play size={14} className="text-black" fill="black" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-red-500 font-bold text-sm truncate">{theme.title}</p>
                    {theme.type && <p className="text-red-500 text-xs uppercase tracking-wide font-bold">{theme.type}</p>}
                    <p className="text-white text-xs mt-1 line-clamp-2">{theme.description}</p>
                    <p className="text-red-500 text-xs font-bold mt-2">{theme.credit_cost_per_block || 10} Ⓣ/chapter</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}


      </div>
    );
  }

  // ── PACK DETAILS VIEW (characters + existing sessions) ──
  if (view === 'packDetails' && selectedTheme) {
    const linkedCharIds = selectedTheme.story_character_ids || [];
    const linkedChars = allCharacters.filter(c => linkedCharIds.includes(c.id));
    // Only show user-created characters that aren't part of ANY pack — characters
    // linked to other themes must NOT leak in and mix packs together.
    const allLinkedIds = new Set(themes.flatMap(t => t.story_character_ids || []));
    const ownChars = user?.id ? allCharacters.filter(c => c.created_by_id === user.id && !allLinkedIds.has(c.id)) : [];
    const heroOptions = [...linkedChars, ...ownChars];

    return (
      <div className="px-5 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('browse')} className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={20} className="text-red-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-black text-xs uppercase tracking-wider font-bold">Story Pack</p>
            <h2 className="text-black text-xl font-bold truncate">{selectedTheme.title}</h2>
          </div>
          <div className="bg-black rounded-xl px-3 py-2 flex-shrink-0">
            <p className="text-red-500 text-xs font-bold">{balance ?? '...'} Ⓣ</p>
          </div>
        </div>

        {/* Theme banner */}
        <div className="bg-black rounded-3xl overflow-hidden mb-6">
          <div className="aspect-[16/9] bg-red-500 relative">
            {selectedTheme.cover_image ? (
              <img src={selectedTheme.cover_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen size={36} className="text-black" />
              </div>
            )}
          </div>
          <div className="p-4">
            {selectedTheme.type && <p className="text-red-500 text-xs uppercase tracking-wide mb-1 font-bold">{selectedTheme.type}</p>}
            <p className="text-white text-sm leading-relaxed">{selectedTheme.description}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-red-500 text-xs font-bold">{selectedTheme.credit_cost_per_block || 10} Ⓣ/chapter</span>
              <span className="text-white text-xs flex items-center gap-1 font-bold"><Users size={12} /> {linkedChars.length} characters</span>
            </div>
          </div>
        </div>

        {/* Your existing stories */}
        {loadingThemeSessions ? (
          <div className="flex justify-center py-8 mb-6"><Loader2 size={24} className="animate-spin text-black" /></div>
        ) : themeSessions.length > 0 ? (
          <div className="mb-6">
            <h3 className="text-black font-bold text-base mb-3">Your Stories</h3>
            <div className="space-y-3">
              {themeSessions.map(sess => {
                const hero = allCharacters.find(c => c.id === sess.hero_story_character_id);
                return (
                  <div
                    key={sess.id}
                    className="w-full bg-black rounded-2xl overflow-hidden"
                  >
                    <div className="flex items-center gap-3 p-3">
                      <button onClick={() => handleResumeSession(sess)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.98] transition-transform">
                        <div className="w-14 h-14 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {hero?.photos?.[0] ? (
                            <img src={hero.photos[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <BookOpen size={20} className="text-black" />
                          )
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-red-500 font-bold text-sm truncate">{hero?.name ? `${hero.name}'s Story` : 'Untitled'}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-white text-xs flex items-center gap-1 font-bold"><Film size={11} /> {sess.block_count || 0} chapters</span>
                            <span className="text-white text-xs flex items-center gap-1 font-bold"><Clock size={11} /> {new Date(sess.created_date).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteSession(sess)}
                        className="w-9 h-9 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                        title="Delete story"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                      <button
                        onClick={() => handleResumeSession(sess)}
                        className="w-9 h-9 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                        title="Resume story"
                      >
                        <Play size={14} className="text-black" fill="black" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Characters */}
        <div>
          <h3 className="text-black font-bold text-base mb-3">Choose Your Hero</h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Create your own character */}
            <button
              onClick={() => setView('characterEditor')}
              className="bg-black rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform border-2 border-dashed border-black/40"
            >
              <div className="aspect-[3/4] flex items-center justify-center">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <Plus size={22} className="text-black" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-red-500 font-bold text-sm">Create Your Character</p>
                <p className="text-white/70 text-xs mt-1">Portrait + reference sheet</p>
              </div>
            </button>
            {heroOptions.map(char => (
              <button
                key={char.id}
                onClick={() => handleSelectCharacter(char)}
                className="bg-black rounded-2xl overflow-hidden text-left active:scale-[0.97] transition-transform"
              >
                <div className="aspect-[3/4] bg-red-500 relative">
                  {char.photos?.[0] ? (
                    <img src={char.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users size={28} className="text-black" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center">
                    <Play size={12} className="text-black" fill="black" />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-red-500 font-bold text-sm truncate">{char.name}</p>
                  {char.character_type && <p className="text-red-500 text-xs uppercase tracking-wide font-bold">{char.character_type}</p>}
                  <p className="text-white text-xs mt-1 line-clamp-2">{char.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── TOPIC SELECTION VIEW ──
  if (view === 'topicSelection' && selectedTheme && selectedHero) {
    const themeTopics = allTopics.filter(tp => tp.theme_id === selectedTheme.id);

    return (
      <div className="px-5 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('packDetails')} className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={20} className="text-red-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-black text-xs uppercase tracking-wider font-bold">{selectedTheme.title}</p>
            <h2 className="text-black text-xl font-bold truncate">Your Starting Point</h2>
          </div>
        </div>

        {/* Selected hero banner */}
        <div className="bg-black rounded-3xl overflow-hidden mb-6 flex items-center gap-4 p-4">
          <div className="w-16 h-16 rounded-xl bg-red-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {selectedHero.photos?.[0] ? (
              <img src={selectedHero.photos[0]} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users size={24} className="text-black" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-red-500 font-bold text-sm">{selectedHero.name}</p>
            {selectedHero.character_type && <p className="text-red-500 text-xs uppercase tracking-wide font-bold">{selectedHero.character_type}</p>}
            <p className="text-white text-xs mt-1 line-clamp-2">{selectedHero.description}</p>
          </div>
        </div>

        {/* AI-picked starting point + dropdown */}
        {themeTopics.length === 0 ? (
          <div className="bg-black/5 rounded-3xl p-8 text-center">
            <Sparkles size={32} className="text-black mx-auto mb-3" />
            <p className="text-black font-bold text-sm">No starting topics for this pack</p>
            <p className="text-black text-xs mt-1">Create topics in admin</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-black rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-red-500" />
                <p className="text-red-500 text-xs uppercase tracking-wider font-bold">AI's Pick</p>
              </div>
              {selectedTopic ? (
                <>
                  <p className="text-red-500 font-bold text-base">{selectedTopic.title}</p>
                  <p className="text-white text-sm mt-1">{selectedTopic.description}</p>
                </>
              ) : (
                <p className="text-white text-sm">No topic selected</p>
              )}
            </div>

            <div>
              <p className="text-black text-xs uppercase tracking-wider font-bold mb-2">Don't like it? Choose another</p>
              <select
                value={selectedTopic?.id || ''}
                onChange={e => setSelectedTopic(themeTopics.find(tp => tp.id === e.target.value) || null)}
                className="w-full bg-black text-red-500 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none"
              >
                {themeTopics.map(tp => (
                  <option key={tp.id} value={tp.id}>{tp.title}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => selectedTopic && handleTopicChosen(selectedTopic)}
              disabled={!selectedTopic}
              className="w-full bg-black text-red-500 rounded-2xl py-4 font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Play size={16} fill="black" />
              Design Story Arc
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── STORY ARC DEFINITION VIEW ──
  if (view === 'arcDefinition' && selectedTheme && selectedHero && selectedTopic) {
    return (
      <div className="px-5 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView('topicSelection')} className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={20} className="text-red-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-black text-xs uppercase tracking-wider font-bold">Story Arc</p>
            <h2 className="text-black text-xl font-bold truncate">Design Your Story</h2>
          </div>
        </div>

        {/* Starting point reminder */}
        <div className="bg-black rounded-3xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-red-500" />
            <p className="text-red-500 text-xs uppercase tracking-wider font-bold">Starting Point</p>
          </div>
          <p className="text-red-500 font-bold text-sm">{selectedTopic.title}</p>
          <p className="text-white text-xs mt-1 line-clamp-3">{selectedTopic.description}</p>
        </div>

        {proposingArc || !storyArc ? (
          <div className="bg-black rounded-3xl p-8 flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-red-500" />
            <p className="text-white text-sm font-semibold">The AI is designing your story arc…</p>
            <p className="text-white/60 text-xs">Chapter count, beginning, middle, and reveal</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Chapter count */}
            <div className="bg-black rounded-3xl p-4">
              <p className="text-red-500 text-xs uppercase tracking-wider font-bold mb-2">Total Chapters</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStoryArc(a => ({ ...a, chapter_count: Math.max(1, (a.chapter_count || 1) - 1) }))}
                  className="w-10 h-10 bg-red-500 text-black rounded-xl font-bold text-xl active:scale-90 transition-transform"
                >−</button>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={storyArc.chapter_count || 1}
                  onChange={e => setStoryArc(a => ({ ...a, chapter_count: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) }))}
                  className="flex-1 bg-white/10 text-red-500 text-center text-2xl font-bold rounded-2xl py-2 focus:outline-none"
                />
                <button
                  onClick={() => setStoryArc(a => ({ ...a, chapter_count: Math.min(20, (a.chapter_count || 1) + 1) }))}
                  className="w-10 h-10 bg-red-500 text-black rounded-xl font-bold text-xl active:scale-90 transition-transform"
                >+</button>
              </div>
              <p className="text-white/60 text-xs mt-2 font-semibold">The AI uses this to pace the story toward the reveal — a guide, not a hard limit.</p>
            </div>

            {/* Start */}
            <div className="bg-black rounded-3xl p-4">
              <p className="text-red-500 text-xs uppercase tracking-wider font-bold mb-2">Start — The Beginning</p>
              <textarea
                value={storyArc.start || ''}
                onChange={e => setStoryArc(a => ({ ...a, start: e.target.value }))}
                rows={3}
                className="w-full bg-white/10 text-white text-sm rounded-2xl p-3 focus:outline-none resize-none"
                placeholder="How the story begins — world, hero's situation, the inciting conflict."
              />
            </div>

            {/* Middle */}
            <div className="bg-black rounded-3xl p-4">
              <p className="text-red-500 text-xs uppercase tracking-wider font-bold mb-2">Middle — Rising Action</p>
              <textarea
                value={storyArc.middle || ''}
                onChange={e => setStoryArc(a => ({ ...a, middle: e.target.value }))}
                rows={3}
                className="w-full bg-white/10 text-white text-sm rounded-2xl p-3 focus:outline-none resize-none"
                placeholder="Complications, twists, escalating stakes, key confrontations."
              />
            </div>

            {/* Reveal */}
            <div className="bg-black rounded-3xl p-4">
              <p className="text-red-500 text-xs uppercase tracking-wider font-bold mb-2">Reveal / Conclusion</p>
              <textarea
                value={storyArc.reveal || ''}
                onChange={e => setStoryArc(a => ({ ...a, reveal: e.target.value }))}
                rows={3}
                className="w-full bg-white/10 text-white text-sm rounded-2xl p-3 focus:outline-none resize-none"
                placeholder="The climax and payoff the whole story builds toward."
              />
            </div>

            <button
              onClick={handleStartStory}
              className="w-full bg-black text-red-500 rounded-2xl py-4 font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <Play size={16} fill="black" />
              Start Story
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── CHARACTER EDITOR VIEW (user creates their own hero) ──
  if (view === 'characterEditor' && selectedTheme) {
    return (
      <UserCharacterEditor
        theme={selectedTheme}
        characters={allCharacters}
        sets={allSets}
        onBack={() => setView('packDetails')}
        onSaved={handleCharacterSaved}
      />
    );
  }

  // ── SESSION VIEW (story player) ──
  if (view === 'session' && activeSession) {
    return (
      <div className="px-5 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleNewStory} className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
            <ArrowLeft size={20} className="text-red-500" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-black text-xs uppercase tracking-wider font-bold">{selectedTheme?.title}</p>
            <h2 className="text-black text-xl font-bold truncate">{selectedHero?.name || 'Hero'}'s Story</h2>
          </div>
          <div className="bg-black rounded-xl px-3 py-2 flex-shrink-0">
            <p className="text-red-500 text-xs font-bold">{balance ?? '...'} Ⓣ</p>
          </div>
        </div>

        {/* Switch hero & storyline for the next chapter — pull-down at the very top */}
        {activeSession && (
          <StorySwitcher
            theme={selectedTheme}
            characters={allCharacters}
            topics={allTopics}
            currentHeroId={pendingOverride?.hero_id || activeSession.hero_story_character_id}
            currentTopicId={pendingOverride?.topic_id || activeSession.starting_topic_id}
            onSwitch={handleSwitchHeroStoryline}
            userId={user?.id}
          />
        )}

        {/* AI-selected setup info */}
        {selectedTopic && (
          <div className="bg-black/5 rounded-2xl p-3 mb-4">
            <p className="text-black text-xs uppercase tracking-wider font-bold mb-1">Starting Point</p>
            <p className="text-black text-sm font-semibold">{selectedTopic.title}</p>
            <p className="text-black text-xs mt-1 line-clamp-2 font-bold">{selectedTopic.description}</p>
          </div>
        )}

        {/* Narrator voice picker */}
        <div className="bg-black/5 rounded-2xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Film size={14} className="text-black" />
            <p className="text-black text-xs uppercase tracking-wider font-bold">Narrator Voice</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {VOICES.map(v => (
              <div
                key={v.id}
                className={`px-2.5 py-2 rounded-xl transition-colors flex flex-col items-center gap-1 ${narratorVoice === v.id ? 'bg-black' : 'bg-white'}`}
              >
                <button
                  onClick={() => handleVoiceChange(v.id)}
                  className="text-center w-full"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <p className={`text-sm font-bold ${narratorVoice === v.id ? 'text-red-500' : 'text-black'}`}>{v.label}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${narratorVoice === v.id ? 'bg-red-500 text-black' : 'bg-black text-white'}`}>{v.gender}</span>
                  </div>
                  <p className={`text-[10px] font-semibold ${narratorVoice === v.id ? 'text-red-500/80' : 'text-black/70'}`}>{v.desc}</p>
                </button>
                <VoicePreviewButton voiceId={v.id} />
              </div>
            ))}
          </div>
          {blocks.length > 0 && (
            <button
              onClick={handleRegenerateAllNarration}
              disabled={regeneratingAll}
              className="mt-3 w-full py-4 bg-black text-red-500 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-lg"
            >
              {regeneratingAll ? (
                <><Loader2 size={18} className="animate-spin" /> Regenerating… ({regenProgress}/{blocks.filter(b => (b.segment_instructions || []).some(s => s?.narration_text)).length})</>
              ) : (
                <><Volume2 size={18} /> Regenerate All Narration</>
              )}
            </button>
          )}
        </div>

        {/* Loading blocks */}
        {loadingBlocks && (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-black" /></div>
        )}

        {/* Play Full Story (continuous playback) */}
        {!loadingBlocks && blocks.length > 0 && (() => {
          const totalSegments = blocks.reduce((sum, b) => sum + (b.video_segments || []).length, 0);
          if (totalSegments === 0) return null;
          return (
            <button
              onClick={() => { setPlayerBlocks(blocks); setShowPlayer(true); }}
              className="w-full mb-4 py-4 bg-black text-red-500 font-bold rounded-3xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform"
            >
              <Clapperboard size={22} />
              Play Full Story
              <span className="text-red-500 text-sm font-bold">({totalSegments} scenes)</span>
            </button>
          );
        })()}

        {/* Publish Story to Magazine */}
        {!loadingBlocks && blocks.length > 0 && (() => {
          const totalSegments = blocks.reduce((sum, b) => sum + (b.video_segments || []).filter(Boolean).length, 0);
          if (totalSegments === 0) return null;
          const isPublished = activeSession?.is_published;
          return (
            <button
              onClick={() => setShowPublishModal(true)}
              className={`w-full mb-4 py-4 font-bold rounded-3xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-transform ${isPublished ? 'bg-red-500 text-white' : 'bg-black text-red-500'}`}
            >
              {isPublished ? (
                <><CheckCircle2 size={20} /> Re-publish Story</>
              ) : (
                <><Send size={20} /> Publish Story</>
              )}
            </button>
          );
        })()}

        {/* Story Blocks */}
        {!loadingBlocks && blocks.length > 0 && (
          <div className="space-y-6">
            {blocks.map((block, i) => (
              <StoryBlockCard
                key={block.id}
                block={block}
                index={i}
                onRetry={handleRetryBlock}
                onProduce={handleProduceBlock}
                onBlockUpdated={(updated) => setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))}
                onAddBefore={() => setManualModal({ open: true, insertPosition: 'before', afterBlockId: block.id })}
                onAddAfter={() => setManualModal({ open: true, insertPosition: 'after', afterBlockId: block.id })}
                onPlayBlock={() => { setPlayerBlocks([block]); setShowPlayer(true); }}
                onAddSegmentBefore={(segIdx) => setSegmentModal({ open: true, insertPosition: 'before', segmentIndex: segIdx, blockId: block.id, segmentNumber: segIdx + 1 })}
                onAddSegmentAfter={(segIdx) => setSegmentModal({ open: true, insertPosition: 'after', segmentIndex: segIdx, blockId: block.id, segmentNumber: segIdx + 1 })}
                onDeleteBlock={() => handleDeleteBlock(block.id)}
                onRedoSegment={handleRedoSegment}
                generating={generating}
                paused={showPlayer}
                userEmail={user?.email}
                storyTitle={selectedHero?.name ? `${selectedHero.name}'s Story` : 'Story'}
              />
            ))}
          </div>
        )}

        {/* Director's Note — steer the next chapter */}
        {!loadingBlocks && (
          <div className="mb-4">
            <div className="bg-black/5 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clap size={14} className="text-black" />
                <p className="text-black text-xs uppercase tracking-wider font-bold">Director's Note</p>
              </div>
              <textarea
                value={directorNote}
                onChange={(e) => setDirectorNote(e.target.value)}
                onBlur={handleSaveDirectorNote}
                placeholder="Steer the next chapter… e.g. 'Septimus must convince Livia to go back to her shop and wait.'"
                rows={2}
                className="w-full bg-white rounded-2xl p-3 text-black text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20 resize-none placeholder-black/40"
              />
              <p className="text-black/50 text-[11px] mt-1 font-bold">Applied to the next generated chapter only, then cleared automatically.</p>
            </div>
          </div>
        )}

        {/* Generate Next Block */}
        {!loadingBlocks && (
          <div className="mt-6">
            {generating ? (
              <div className="bg-black rounded-3xl p-8 flex flex-col items-center gap-4">
                <Loader2 size={32} className="animate-spin text-red-500" />
                <p className="text-white/80 text-sm font-semibold">
                  {genProgress?.phase === 'planning' ? 'Writing your story…' : 'Producing your story'}
                </p>
                {genProgress?.phase === 'video' ? (
                  <>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(genProgress.completed / genProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-white text-xs">{genProgress.message || `Generating scene ${genProgress.completed}/${genProgress.total}…`}</p>
                  </>
                ) : (
                  <p className="text-white text-xs">{genProgress?.message || 'The AI agent is writing the narrative — this may take a few minutes'}</p>
                )}
              </div>
            ) : (
              <button
                onClick={() => handleGenerate()}
                disabled={!isAdmin && balance !== null && balance < tokenCost}
                className="w-full py-5 bg-black text-red-500 font-bold rounded-3xl disabled:opacity-40 flex items-center justify-center gap-3 text-lg shadow-xl"
              >
                <Sparkles size={22} />
                {blocks.length === 0 ? 'Begin Story' : 'Continue Story'}
                <span className="text-red-500 text-sm font-bold ml-2">({tokenCost} Ⓣ)</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={() => { setSelectedHero(null); setSelectedTopic(null); refreshThemeSessions(selectedTheme); setView('packDetails'); }}
                className="py-3 bg-black/10 text-black font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border-2 border-black/20"
              >
                <Plus size={18} />
                New Story
              </button>
              <button
                onClick={() => { refreshThemeSessions(selectedTheme); setView('packDetails'); }}
                className="py-3 bg-black/10 text-black font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border-2 border-black/20"
              >
                <List size={18} />
                My Stories
              </button>
            </div>
          </div>
        )}

        {/* Continuous Story Player */}
        {showPlayer && (
          <StoryPlayer
            blocks={playerBlocks}
            hero={selectedHero}
            theme={selectedTheme}
            onClose={() => setShowPlayer(false)}
          />
        )}

        {/* Manual Block Modal */}
        <ManualBlockModal
          open={manualModal.open}
          onClose={() => setManualModal({ open: false, insertPosition: 'after', afterBlockId: null })}
          theme={selectedTheme}
          characters={allCharacters}
          sets={allSets}
          onCreated={handleCreateManualBlock}
          insertPosition={manualModal.insertPosition}
          existingCount={blocks.length}
        />

        {/* Manual Segment Modal */}
        <ManualSegmentModal
          open={segmentModal.open}
          onClose={() => setSegmentModal({ open: false, insertPosition: 'after', segmentIndex: 0, blockId: null, segmentNumber: 1 })}
          theme={selectedTheme}
          characters={allCharacters}
          sets={allSets}
          onCreated={handleAddSegment}
          insertPosition={segmentModal.insertPosition}
          segmentNumber={segmentModal.segmentNumber}
        />

        {/* Publish Story Modal */}
        <PublishStoryModal
          open={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          session={activeSession}
          blocks={blocks}
          hero={selectedHero}
          theme={selectedTheme}
          user={user}
          onPublished={handlePublished}
        />
      </div>
    );
  }

  return null;
}

// ── Story Block Card ──
function StoryBlockCard({ block, index, onRetry, onProduce, onBlockUpdated, onAddBefore, onAddAfter, onPlayBlock, onAddSegmentBefore, onAddSegmentAfter, onDeleteBlock, onRedoSegment, generating, paused, userEmail, storyTitle }) {
  const [playingSegment, setPlayingSegment] = useState(0);
  const [redoOpen, setRedoOpen] = useState(false);
  const [redoNote, setRedoNote] = useState('');
  const [saveVaultUrl, setSaveVaultUrl] = useState(null);
  const [saveVaultType, setSaveVaultType] = useState('image');
  const timelineRef = useRef(null);
  const segments = block.video_segments || [];
  const instructions = block.segment_instructions || [];
  const narrationUrls = block.narration_audio_urls || [];
  const segCount = Math.max(segments.length, instructions.length);
  const currentInstruction = instructions[playingSegment] || {};
  const mediaType = currentInstruction.media_type || 'image';
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const hasContent = (block.narrative_summary || '').trim() || instructions.length > 0;

  // Pause all media when the full-screen player is open
  useEffect(() => {
    if (paused) {
      if (videoRef.current) videoRef.current.pause();
      if (audioRef.current) audioRef.current.pause();
    }
  }, [paused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black rounded-3xl overflow-hidden"
    >
      {/* Block header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-black font-black text-sm">{index + 1}</span>
        </div>
        <p className="text-white text-sm uppercase tracking-wider font-bold">Chapter {index + 1}</p>
        {block.generation_status === 'completed' && segments.filter(Boolean).length > 0 && (
          <>
            {(() => {
              const hasMissingAudio = (block.segment_instructions || []).some((s, i) =>
                (block.video_segments || [])[i] && s?.narration_text && !(block.narration_audio_urls || [])[i]
              );
              return hasMissingAudio ? (
                <button
                  onClick={() => onProduce(block.id)}
                  className="ml-auto flex items-center gap-1.5 bg-red-500 text-black px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                >
                  <Volume2 size={12} />
                  Fix Audio
                </button>
              ) : null;
            })()}
            <button
              onClick={onPlayBlock}
              className="ml-auto flex items-center gap-1.5 bg-red-500 text-black px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
            >
              <Play size={12} fill="black" />
              Play Chapter
            </button>
          </>
        )}

        {block.generation_status === 'completed' && segments.filter(Boolean).length === 0 && hasContent && <CheckCircle2 size={14} className="text-red-500 ml-auto" />}
        {block.generation_status === 'pending' && !generating && (
          <button
            onClick={() => onProduce(block.id)}
            className="ml-auto flex items-center gap-1.5 bg-red-500 text-black px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
          >
            <Clapperboard size={12} />
            Produce
          </button>
        )}

        {block.generation_status !== 'completed' && block.generation_status !== 'pending' && !generating && hasContent && (
          <button
            onClick={() => onRetry(block.id)}
            className="ml-auto flex items-center gap-1.5 bg-red-500 text-black px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
          >
            <RotateCcw size={12} />
            Retry
          </button>
        )}
        {block.generation_status !== 'completed' && generating && (
          <Loader2 size={14} className="text-red-500 ml-auto animate-spin" />
        )}
        <button
          onClick={onDeleteBlock}
          className="ml-auto flex items-center justify-center w-8 h-8 bg-red-500/20 text-red-400 rounded-lg active:scale-90 transition-transform"
          title="Delete chapter"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Block text review & editor */}
      <div className="px-5 pb-3">
        <BlockTextEditor
          block={block}
          index={index}
          onProduce={onProduce}
          onRetry={onRetry}
          generating={generating}
          onBlockUpdated={onBlockUpdated}
          onAddSegmentBefore={onAddSegmentBefore}
          onAddSegmentAfter={onAddSegmentAfter}
          episodeTitle={storyTitle ? `${storyTitle} — Chapter ${index + 1}` : (block.block_title || `Chapter ${index + 1}`)}
          userEmail={userEmail}
        />
      </div>

      {/* Media segments — show whenever there are instructions OR video URLs */}
      {(segments.length > 0 || instructions.length > 0) && (
        <div className="px-5 pb-3">
          <div className="bg-white/5 rounded-2xl overflow-hidden relative">
            {segments[playingSegment] ? (
              mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={segments[playingSegment]}
                  controls
                  muted
                  className="w-full aspect-video object-cover bg-black"
                  onEnded={() => setPlayingSegment(prev => prev < segCount - 1 ? prev + 1 : prev)}
                />
              ) : (
                <img
                  src={segments[playingSegment]}
                  alt=""
                  className="w-full aspect-video object-cover bg-black"
                />
              )
            ) : (
              <div className="w-full aspect-video flex flex-col items-center justify-center bg-black gap-3">
                {currentInstruction.manual_media_url ? (
                  <>
                    {currentInstruction.media_type === 'video' ? (
                      <video
                        ref={videoRef}
                        src={currentInstruction.manual_media_url}
                        controls
                        muted
                        className="w-full aspect-video object-cover bg-black"
                        onEnded={() => setPlayingSegment(prev => prev < segCount - 1 ? prev + 1 : prev)}
                      />
                    ) : (
                      <img
                        src={currentInstruction.manual_media_url}
                        alt=""
                        className="w-full aspect-video object-cover bg-black"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <Loader2 size={32} className="animate-spin text-red-500" />
                    <p className="text-white text-xs font-bold">Generating segment {playingSegment + 1}…</p>
                  </>
                )}
              </div>
            )}
            {/* Redo this segment image with director's note */}
            {segments[playingSegment] && !generating && (
              <div className="absolute bottom-2 right-2 z-10">
                {redoOpen ? (
                  <div className="flex items-center gap-1.5 bg-black/90 rounded-lg p-1.5">
                    <input
                      autoFocus
                      value={redoNote}
                      onChange={(e) => setRedoNote(e.target.value)}
                      placeholder="What's wrong? e.g. wrong face, bad lighting"
                      className="bg-white/10 text-white text-xs rounded px-2 py-1.5 w-44 placeholder-white/40 focus:outline-none"
                    />
                    <button
                      onClick={() => { onRedoSegment(block.id, playingSegment, redoNote); setRedoOpen(false); setRedoNote(''); }}
                      className="flex items-center gap-1 bg-red-500 text-black px-2.5 py-1.5 rounded text-xs font-bold active:scale-95"
                    >
                      <RotateCcw size={12} /> Go
                    </button>
                    <button
                      onClick={() => { setRedoOpen(false); setRedoNote(''); }}
                      className="bg-white/10 text-white px-2 py-1.5 rounded text-xs font-bold active:scale-95"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const segUrl = segments[playingSegment];
                        if (segUrl) {
                          setSaveVaultUrl(segUrl);
                          setSaveVaultType((instructions[playingSegment]?.media_type) || 'image');
                        }
                      }}
                      className="flex items-center gap-1.5 bg-black/80 text-red-500 px-3 py-2 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                      title="Save this image to your vault"
                    >
                      <FolderDown size={12} />
                      Vault
                    </button>
                    <button
                      onClick={() => setRedoOpen(true)}
                      className="flex items-center gap-1.5 bg-black/80 text-red-500 px-3 py-2 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                    >
                      <RotateCcw size={12} />
                      Redo
                    </button>
                  </div>
                )}
              </div>
            )}
            {/* Narration audio player */}
            {narrationUrls[playingSegment] && (
              <audio
                ref={audioRef}
                src={narrationUrls[playingSegment]}
                onEnded={() => setPlayingSegment(prev => prev < segCount - 1 ? prev + 1 : prev)}
              />
            )}
          </div>
          {(() => {
            if (segCount <= 1) return null;
            const scrollLeft = () => timelineRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
            const scrollRight = () => timelineRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
            return (
              <div className="flex items-center gap-1 mt-2">
                <button
                  onClick={scrollLeft}
                  className="flex-shrink-0 w-7 h-7 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <div
                  ref={timelineRef}
                  className="flex gap-1.5 overflow-x-auto pb-1 flex-1"
                  style={{ scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}
                >
                  {Array.from({ length: segCount }).map((_, i) => {
                    const inst = instructions[i] || {};
                    const mt = inst.media_type || 'image';
                    const segUrl = segments[i];
                    const hasManual = inst.manual_media_url;
                    const isPending = !segUrl && !hasManual;
                    const isActive = playingSegment === i;
                    return (
                      <button
                        key={i}
                        onClick={() => !isPending && setPlayingSegment(i)}
                        className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${isActive ? 'bg-red-500 text-black' : isPending ? 'bg-white/5 text-white' : 'bg-white/10 text-white/80'}`}
                        style={{ scrollSnapAlign: 'start' }}
                      >
                        {isPending ? (
                          <Loader2 size={14} className={isActive ? 'text-black' : 'text-red-500 animate-spin'} />
                        ) : mt === 'video' ? (
                          <Film size={14} className={isActive ? 'text-black' : 'text-red-500'} />
                        ) : (
                          <ImageIcon size={14} className={isActive ? 'text-black' : 'text-red-500'} />
                        )}
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={scrollRight}
                  className="flex-shrink-0 w-7 h-7 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* AI-selected choice (informational only) */}
      {block.choice_options?.length > 0 && (
        <div className="px-5 pb-5 pt-2">
          <p className="text-white text-sm uppercase tracking-wider font-bold mb-3">AI's Choice</p>
          <div className="space-y-2">
            {block.choice_options.map(choice => {
              const selected = block.selected_choice === choice.id;
              if (!selected) return null;
              return (
                <div key={choice.id} className="w-full p-4 rounded-2xl border-2 border-red-500 bg-red-500/20">
                  <p className="text-red-500 font-bold text-sm">{choice.label}</p>
                  <p className="text-white/80 text-sm mt-1">{choice.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Save to Vault modal */}
      {saveVaultUrl && (
        <SaveToVaultModal
          userEmail={userEmail}
          imageUrl={saveVaultUrl}
          mediaType={saveVaultType}
          onClose={() => setSaveVaultUrl(null)}
          onSaved={() => { setSaveVaultUrl(null); }}
        />
      )}
    </motion.div>
  );
}