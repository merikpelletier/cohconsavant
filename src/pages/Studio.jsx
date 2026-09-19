import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useAuth } from '@/lib/AuthContext';
import { useAppContext } from '@/lib/AppContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Layers, Camera, ChevronRight, ChevronLeft, Film, Plus, X, Mic, Upload, Music, Type, Sparkles, BookOpen, Home, Clapperboard, Theater, Wrench, LayoutTemplate, Box } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CharacterSheetEditor from '@/components/CharacterSheetEditor';
import SetAssetEditor from '@/components/studio/SetAssetEditor';
import KitProductionRoom from '@/components/KitProductionRoom';
import VoiceRecorder from '@/components/studio/VoiceRecorder';
import AudioUploader from '@/components/studio/AudioUploader';
import DubbingStudio from '@/components/studio/DubbingStudio';
import TextToSpeech from '@/components/studio/TextToSpeech';
import VideoTools from '@/components/studio/VideoTools';
import LipSync from '@/components/studio/LipSync';
import AnimateImage from '@/components/studio/AnimateImage';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import AvailableProjectsPortal from '@/components/studio/AvailableProjectsPortal';
import SketchStudio from '@/components/studio/SketchStudio';
import KitAssetViewer from '@/components/KitAssetViewer';
import LabWorkspace from '@/components/studio/LabWorkspace';
import Inline3DModel from '@/components/studio/Inline3DModel';
import StoryBlocks from '@/components/studio/StoryBlocks';
import VaultSection from '@/components/VaultSection';
import Atelier from '@/components/atelier/Atelier';
import { Bookmark } from 'lucide-react';


// ── Sub-components ──────────────────────────────────────────────────────────

function StudioCard({ icon: Icon, title, subtitle, color, onClick, badge }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full text-left bg-black rounded-3xl p-6 relative overflow-hidden flex items-center gap-5 active:opacity-90 transition-opacity"
    >
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={28} className="text-black" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold tracking-wide text-base">{title}</p>
        <p className="text-red-500 text-sm mt-1 font-medium">{subtitle}</p>
      </div>
      {badge > 0 && (
        <span className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <ChevronRight size={20} className="text-red-500 flex-shrink-0" />
    </motion.button>
  );
}

function ActorPolaroid({ sheet, onEdit }) {
  const photos = (() => { try { return JSON.parse(sheet.character_photos?.[0] || '{}'); } catch { return {}; } })();
  const photo = photos.portrait || photos.front || Object.values(photos)[0];
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={onEdit} className="bg-black rounded-3xl overflow-hidden cursor-pointer">
      <div className="aspect-[3/4] bg-white/5">
        {photo ? (
          <img src={photo} alt={sheet.character_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users size={40} className="text-white/20" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-white text-sm font-semibold truncate">{sheet.character_name || 'Unnamed'}</p>
        {sheet.character_traits?.length > 0 && (
          <p className="text-red-500 text-xs mt-1 truncate">{sheet.character_traits.slice(0, 2).join(' · ')}</p>
        )}
      </div>
    </motion.div>
  );
}

function SetCard({ asset, onEdit }) {
  const img = asset.images?.[0];
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={onEdit} className="bg-black rounded-3xl overflow-hidden cursor-pointer">
      <div className="aspect-square bg-white/5">
        {img ? (
          <img src={img} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers size={36} className="text-white/20" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-white text-sm font-semibold truncate">{asset.name || 'Unnamed'}</p>
        {asset.tags?.length > 0 && (
          <p className="text-red-500 text-xs mt-1 truncate">{asset.tags.slice(0, 2).join(' · ')}</p>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, label, sub, onAction, actionLabel }) {
  return (
    <div className="bg-red-400/40 rounded-3xl p-10 text-center border-2 border-black/10 shadow-lg">
      <div className="w-20 h-20 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Icon size={40} className="text-black" />
      </div>
      <p className="text-black text-lg font-bold mb-2">{label}</p>
      <p className="text-black text-sm font-bold mb-6">{sub}</p>
      {onAction && (
        <button onClick={onAction} className="text-black text-sm font-bold underline underline-offset-4 hover:opacity-70 transition-opacity">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function Studio() {
  const { user, isLoadingAuth } = useAuth();
  const hasStudioAccess = user?.role === 'admin';
  const { setAppContext } = useAppContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('home');
  const [libraryTab, setLibraryTab] = useState('kits');
  const [editingActor, setEditingActor] = useState(null);  // null=closed, false=new, obj=edit
  const [editingSet, setEditingSet] = useState(null);      // null=closed, false=new, obj=edit
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showAudioUploader, setShowAudioUploader] = useState(false);
  const [showDubbingStudio, setShowDubbingStudio] = useState(false);
  const [showTextToSpeech, setShowTextToSpeech] = useState(false);
  const [showVideoTools, setShowVideoTools] = useState(false);
  const [videoInitialMode, setVideoInitialMode] = useState(null);
  const [producedMedia, setProducedMedia] = useState(null); // { url, type }
  
  // Production mode from URL params
  const [productionMode, setProductionMode] = useState(null);
  const [targetDossier, setTargetDossier] = useState(null);
  const [targetKitPage, setTargetKitPage] = useState(null);
  const [targetBlock, setTargetBlock] = useState(null);
  const [targetEpisodeId, setTargetEpisodeId] = useState(null);
  const [referenceMedia, setReferenceMedia] = useState([]);
  const [recommendedTools, setRecommendedTools] = useState([]);
  const [hasAutoOpenedTool, setHasAutoOpenedTool] = useState(false);
  const [productionContext, setProductionContext] = useState(null);
  const [kitPage, setKitPage] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [productionMethod, setProductionMethod] = useState(null);
  const [blockDetails, setBlockDetails] = useState(null);
  const [isInProductionContext, setIsInProductionContext] = useState(false);
  const [activeKitPage, setActiveKitPage] = useState(null);
  const [activeDossier, setActiveDossier] = useState(null);
  const [showFreeTimeline, setShowFreeTimeline] = useState(false);
  const [showLipSync, setShowLipSync] = useState(false);
  const [showAnimateImage, setShowAnimateImage] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showAtelier, setShowAtelier] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState(null); // motion prompt preloaded from a script

  const { data: characterSheets = [] } = useQuery({
    queryKey: ['characterSheets', user?.email],
    queryFn: () => appClient.entities.CharacterSheet.filter({ user_email: user.email }),
    enabled: !!user?.email && hasStudioAccess,
  });

  const { data: setAssets = [] } = useQuery({
    queryKey: ['setAssets', user?.email],
    queryFn: () => appClient.entities.SetAsset.filter({ user_email: user.email }),
    enabled: !!user?.email && hasStudioAccess,
  });

  const { data: vaultAssets = [] } = useQuery({
    queryKey: ['vaultAssets', user?.email],
    queryFn: () => appClient.entities.VaultAsset.filter({ user_email: user.email }),
    enabled: !!user?.email && hasStudioAccess,
  });

  const { data: communityKits = [] } = useQuery({
    queryKey: ['communityProductionKits'],
    queryFn: async () => {
      const all = await appClient.entities.Dossier.filter({ status: 'published' }, '-created_date', 50);
      const results = await Promise.all(
        all.map(async (d) => {
          const pagesRes = await appClient.functions.invoke('getDossierPages', { dossier_id: d.id }).catch(() => ({ data: { pages: [] } }));
          const pages = pagesRes.data?.pages || [];
          const kitPage = pages.find(p => p.page_type === 'production_kit');
          return kitPage ? { ...d, kitPage } : null;
        })
      );
      return results.filter(Boolean);
    },
    enabled: hasStudioAccess,
  });

  const actorCount = characterSheets.length;
  const setCount = setAssets.length;
  const totalCount = actorCount + setCount;

  // Count projects in production (published dossiers)
  const { data: publishedDossiers = [] } = useQuery({
    queryKey: ['publishedDossiers'],
    queryFn: () => appClient.entities.Dossier.filter({ status: 'published' }),
    enabled: hasStudioAccess,
  });
  const projectsInProductionCount = publishedDossiers.length;

  // Handle production mode - show simple tool interface
  useEffect(() => {
    const mode = searchParams.get('mode');
    const dossierId = searchParams.get('dossier_id');
    const kitPageId = searchParams.get('kit_page_id');
    const blockId = searchParams.get('block_id');
    const episodeId = searchParams.get('episode_id');
    const productionMethod = searchParams.get('production_method');
    const refMediaParam = searchParams.get('reference_media');
    const toolsParam = searchParams.get('recommended_tools');
    
    if (mode === 'production' && dossierId) {
      setIsInProductionContext(true);
      setProductionMode({ blockId, episodeId, dossierId });
      
      const loadProductionData = async () => {
        try {
          const [page, dossier] = await Promise.all([
            kitPageId ? appClient.functions.invoke('getDossierPage', { id: kitPageId }).then(r => r.data.page).catch(() => null) : Promise.resolve(null),
            appClient.entities.Dossier.get(dossierId).catch(() => null),
          ]);
          
          if (kitPageId && page) {
            setKitPage(page);
          }
          setDossier(dossier);
          
          // Load reference media from kit AND from the specific block's reference_media field
          let refMedia = page ? [
            ...(page.kit_characters?.flatMap(c => c.media || []) || []),
            ...(page.kit_sets?.flatMap(s => s.media || []) || []),
            ...(page.kit_costumes?.flatMap(c => c.media || []) || []),
          ].slice(0, 6) : [];
          
          // Fetch EpisodeProduction to get block-specific reference_media
          if (blockId) {
            console.log('🔍 Looking for block reference_media:', { blockId, dossierId, kitPageId });
            // Try both dossier_id and episode_page_id
            let epProds = await appClient.functions.invoke('manageEpisodeProduction', { action: 'list' }).then(r => r.data.items.filter(e => e.dossier_id === dossierId)).catch(() => []);
            console.log('📦 EpisodeProduction by dossier_id:', epProds.length);
            if (epProds.length === 0 && kitPageId) {
              epProds = await appClient.functions.invoke('manageEpisodeProduction', { action: 'list' }).then(r => r.data.items.filter(e => e.episode_page_id === kitPageId)).catch(() => []);
              console.log('📦 EpisodeProduction by episode_page_id:', epProds.length);
            }
            if (epProds.length > 0) {
              console.log('🎬 First EpisodeProduction timeline blocks:', epProds[0].timeline?.map(b => ({ id: b.id, title: b.title, ref_count: b.reference_media?.length || 0 })));
              const block = epProds[0].timeline?.find(b => b.id === blockId);
              console.log('🎯 Found block:', block?.id, 'reference_media:', block?.reference_media);
              if (block?.reference_media?.length > 0) {
                // Filter to only images (exclude videos) for reference thumbnails
                const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
                const imageMedia = block.reference_media.filter(url => {
                  const lower = url.toLowerCase();
                  return !lower.includes('video') && !lower.includes('mp4') && !lower.includes('webm') && !lower.includes('ogg') && !lower.includes('mov');
                });
                console.log('🖼️ Image reference media:', imageMedia.length, 'of', block.reference_media.length);
                refMedia = [...imageMedia, ...refMedia];
                refMedia = refMedia.filter((url, i, arr) => arr.indexOf(url) === i).slice(0, 10);
                console.log('✅ Loaded reference media:', refMedia.length, 'items');
              } else {
                console.log('⚠️ Block has no reference_media - YOU NEED TO UPLOAD IN ADMIN AND CLICK SAVE');
              }
            } else {
              console.log('⚠️ No EpisodeProduction found - YOU NEED TO SAVE PRODUCTION IN ADMIN FIRST');
            }
          }
          
          setReferenceMedia(refMedia);
          
          // Parse reference media param
          if (refMediaParam) {
            try { setReferenceMedia(JSON.parse(refMediaParam)); } catch {}
          }
          // Parse recommended tools
          if (toolsParam) {
            setRecommendedTools(toolsParam.split(',').filter(Boolean));
          }
          
          // Load production method and block details
          const prodMethod = searchParams.get('production_method');
          if (prodMethod) {
            setProductionMethod(prodMethod);
            // Load block details from session storage
            const stored = sessionStorage.getItem('studio_block_details');
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                setBlockDetails(parsed);
              } catch {}
            }
          }
        } catch (err) {
          console.error('Error loading production data:', err);
        }
      };
      
      loadProductionData();
    }
  }, [searchParams, hasAutoOpenedTool]);

  const closeProductionMode = () => {
    setProductionContext(null);
    setKitPage(null);
    setDossier(null);
    setIsInProductionContext(false);
    setProductionMethod(null);
    setBlockDetails(null);
    setProductionMode(null);
    navigate('/Studio', { replace: true });
  };

  // Broadcast Studio section context
  useEffect(() => {
    const sectionLabels = { home: 'Home overview', '3d': '3D Model Studio', lab: 'Stages (community projects)', tools: 'AI Tools workspace', stories: 'Story Blocks' };
    const openTools = [];
    if (showVoiceRecorder) openTools.push('Voice Recorder');
    if (showAudioUploader) openTools.push('Audio Uploader');
    if (showDubbingStudio) openTools.push('Dubbing Studio');
    if (showTextToSpeech) openTools.push('Text to Speech');
    if (showVideoTools) openTools.push('Video Tools');
    if (showLipSync) openTools.push('Lip Sync');
    if (showAnimateImage) openTools.push('Animate Image');
    setAppContext({
      page: 'My Studio',
      section: sectionLabels[activeTab] || activeTab,
      detail: openTools.length > 0 ? `Tool open: ${openTools.join(', ')}` : (editingActor !== null ? 'Actor editor open' : editingSet !== null ? 'Set editor open' : null),
    });
  }, [activeTab, showVoiceRecorder, showAudioUploader, showDubbingStudio, showTextToSpeech, showVideoTools, showLipSync, showAnimateImage, editingActor, editingSet]);

  const tabs = [
    { key: 'home', label: 'Accueil', icon: Home },
    { key: 'tools', label: 'Outils', icon: Wrench },
  ];
  const visibleTabs = tabs.filter(tab => tab.key !== 'stories' || user?.role === 'admin');

  const handleJoinProject = (dossier, kitPage) => {
    // If it's an episode or join_cast page, open KitProductionRoom
    if (kitPage?.page_type === 'episode' || kitPage?.page_type === 'join_cast') {
      setDossier(dossier);
      setKitPage(kitPage);
      setProductionMode({ dossierId: dossier.id });
      return;
    }
    // Otherwise open KitAssetViewer (production_kit pages)
    setActiveDossier(dossier);
    setActiveKitPage(kitPage);
  };

  if (isLoadingAuth) {
    return <div className="min-h-screen bg-black" />;
  }

  if (!hasStudioAccess) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-5 pb-20">
        <div className="w-full max-w-xl text-center border border-white/15 rounded-3xl px-6 py-12 bg-zinc-950">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-600 flex items-center justify-center">
            <Sparkles size={30} />
          </div>
          <p className="text-red-500 text-xs font-bold uppercase tracking-[0.3em] mb-3">Studio</p>
          <h1 className="text-3xl sm:text-4xl font-bold">Bientôt disponible</h1>
          <p className="mt-4 text-white/65">Les outils de création sont actuellement en préparation.</p>
        </div>
      </div>
    );
  }

  // Render production mode - open KitProductionRoom with timeline (from URL params OR handleJoinProject)
  if (productionMode && kitPage) {
    return (
      <KitProductionRoom
        kitPage={kitPage}
        dossier={dossier}
        onClose={closeProductionMode}
        initialBlockId={productionMode.blockId}
        initialBlockType={null}
        producedMedia={producedMedia}
        onMediaProduced={setProducedMedia}
        referenceMedia={referenceMedia}
        productionMethodFromUrl={productionMethod}
        blockDetailsFromStorage={blockDetails}
      />
    );
  }

  // Overlay KitAssetViewer when user clicks a production kit (no timeline/episodes)
  if (activeKitPage && activeDossier) {
    return (
      <KitAssetViewer
        kitPage={activeKitPage}
        dossier={activeDossier}
        onClose={() => { setActiveKitPage(null); setActiveDossier(null); }}
      />
    );
  }

  // Free timeline — blank KitProductionRoom with no project context
  if (showFreeTimeline) {
    const blankKit = { id: 'free_timeline', title: 'Chronologie libre', kit_characters: [], kit_sets: [], kit_costumes: [] };
    return (
      <KitProductionRoom
        kitPage={blankKit}
        dossier={null}
        onClose={() => setShowFreeTimeline(false)}
        producedMedia={producedMedia}
        onMediaProduced={setProducedMedia}
        referenceMedia={[]}
      />
    );
  }

  // Vault view
  if (showVault) {
    return (
      <div className="min-h-screen bg-white pb-20">
        <div className="px-5 pt-12 pb-6">
          <button onClick={() => setShowVault(false)} className="flex items-center gap-2 text-black text-sm font-bold">
            <ChevronLeft size={20} />
            Retour au Studio
          </button>
        </div>
        <div className="px-5">
          <VaultSection
            userEmail={user?.email}
            onUsePrompt={(text) => {
              setPendingPrompt(text);
              setShowVault(false);
              setShowAnimateImage(true);
            }}
          />
        </div>
      </div>
    );
  }

  // Atelier view
  if (showAtelier) {
    return <Atelier user={user} onClose={() => setShowAtelier(false)} />;
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onRecordingComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'audio' });
            setShowVoiceRecorder(false);
          }}
          onClose={() => setShowVoiceRecorder(false)}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Audio Uploader Modal */}
      {showAudioUploader && (
        <AudioUploader
          onUploadComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'audio' });
            setShowAudioUploader(false);
          }}
          onClose={() => setShowAudioUploader(false)}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
        />
      )}

      {/* Dubbing Studio Modal */}
      {showDubbingStudio && (
        <DubbingStudio
          onComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'audio' });
            setShowDubbingStudio(false);
          }}
          onClose={() => setShowDubbingStudio(false)}
          block={isInProductionContext ? blockDetails?.block : null}
          productionMethod={isInProductionContext ? productionMethod : null}
          character={isInProductionContext ? blockDetails?.character : null}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Text to Speech Modal */}
      {showTextToSpeech && (
        <TextToSpeech
          onComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'audio' });
            setShowTextToSpeech(false);
          }}
          onClose={() => setShowTextToSpeech(false)}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Animate Image Modal */}
      {showAnimateImage && (
        <AnimateImage
          initialPrompt={pendingPrompt}
          onComplete={(url, type) => {
            setProducedMedia({ url, type });
            setShowAnimateImage(false);
            setPendingPrompt(null);
          }}
          onClose={() => { setShowAnimateImage(false); setPendingPrompt(null); }}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Lip Sync Modal */}
      {showLipSync && (
        <LipSync
          onComplete={(url, type) => {
            setProducedMedia({ url, type });
            setShowLipSync(false);
          }}
          onClose={() => setShowLipSync(false)}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Video Tools Modal */}
      {showVideoTools && (
        <VideoTools
          onComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'video' });
            setShowVideoTools(false);
          }}
          onClose={() => { setShowVideoTools(false); setVideoInitialMode(null); }}
          recommendedTools={recommendedTools}
          referenceMedia={referenceMedia}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
          initialMode={videoInitialMode}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}



      {/* Header */}
      <div className="px-5 pt-12 pb-6 relative">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-black text-xs tracking-[0.25em] uppercase font-bold mb-2">
            {user?.full_name || 'CREATOR'}
          </p>
          <h1 className="text-black text-5xl font-bold tracking-tight">Mon Studio</h1>
        </motion.div>

        {activeTab !== 'home' && (
          <div className="grid gap-1.5 mt-8" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
            {visibleTabs.map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center justify-center px-1 py-2.5 rounded-xl transition-all text-center ${
                    activeTab === tab.key
                      ? 'bg-black text-red-500 shadow-lg'
                      : 'bg-black/10 text-black hover:bg-black/20'
                  }`}
                >
                  <TabIcon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── HOME TAB ── */}
      {activeTab === 'home' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 space-y-3">
          {/* Stats */}
          <div className="bg-black rounded-3xl p-6 flex items-center justify-around shadow-xl">
            <div className="text-center">
              <p className="text-red-500 text-4xl font-bold">{actorCount}</p>
              <p className="text-white text-sm font-bold mt-1">Acteurs</p>
            </div>
            <div className="w-px h-12 bg-white/15" />
            <div className="text-center">
              <p className="text-red-500 text-4xl font-bold">{setCount}</p>
              <p className="text-white text-sm font-bold mt-1">Décors</p>
            </div>
            <div className="w-px h-12 bg-white/15" />
            <div className="text-center">
              <p className="text-red-500 text-4xl font-bold">{vaultAssets.length}</p>
              <p className="text-white text-sm font-bold mt-1">Ressources</p>
            </div>
          </div>

          <p className="text-black text-sm font-bold tracking-widest uppercase pt-6">Navigation</p>

          <StudioCard
            icon={Home}
            title="Mes Projets"
            subtitle="Dossiers en production"
            color="bg-red-500"
            badge={projectsInProductionCount}
            onClick={() => navigate('/MyProjects')}
          />
          <StudioCard
            icon={Wrench}
            title="Outils"
            subtitle="Outils de production IA"
            color="bg-red-100"
            badge={0}
            onClick={() => setActiveTab('tools')}
          />
          <StudioCard
            icon={Bookmark}
            title="Ma Réserve"
            subtitle="Ressources et références sauvegardées"
            color="bg-red-400"
            badge={vaultAssets.length}
            onClick={() => setShowVault(true)}
          />
          <StudioCard
            icon={LayoutTemplate}
            title="Atelier"
            subtitle="Composer des pages de magazine"
            color="bg-red-300"
            badge={0}
            onClick={() => setShowAtelier(true)}
          />
        </motion.div>
      )}

      {/* ── STAGES TAB ── */}
      {activeTab === 'lab' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5">
          <SketchStudio user={user} />
        </motion.div>
      )}

      {/* ── TOOLS TAB ── */}
      {activeTab === 'tools' && (
        <LabWorkspace
          user={user}
          onOpenActor={() => setEditingActor(false)}
          onOpenSet={() => setEditingSet(false)}
          onOpenVoiceRecorder={() => setShowVoiceRecorder(true)}
          onOpenAudioUploader={() => setShowAudioUploader(true)}
          onOpenDubbing={() => setShowDubbingStudio(true)}
          onOpenTTS={() => setShowTextToSpeech(true)}
          onOpenVideo={(mode) => { setVideoInitialMode(mode || null); setShowVideoTools(true); }}
          onOpenLipSync={() => setShowLipSync(true)}
          onOpenAnimateImage={() => setShowAnimateImage(true)}
          onJoinProject={handleJoinProject}
          onOpenFreeTimeline={() => setShowFreeTimeline(true)}
          hideProjects={true}
        />
      )}

      {/* ── STORIES TAB ── */}
      {activeTab === 'stories' && (
        <StoryBlocks user={user} onBack={() => setActiveTab('home')} />
      )}

      {/* ── Editors ── */}
      <AnimatePresence>
        {editingActor !== null && (
          <CharacterSheetEditor
            key="actor-editor"
            sheet={editingActor || null}
            userEmail={user?.email}
            onClose={() => setEditingActor(null)}
          />
        )}
        {editingSet !== null && (
          <SetAssetEditor
            key="set-editor"
            asset={editingSet || null}
            userEmail={user?.email}
            onClose={() => setEditingSet(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
