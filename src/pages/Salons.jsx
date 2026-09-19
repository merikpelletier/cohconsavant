import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatRoom from '@/components/ChatRoom';
import IdentifierModal from '@/components/IdentifierModal';
import ProfileEditor from '@/components/ProfileEditor';
import PrivateConversations from '@/components/PrivateConversations';
import PrivateChat from '@/components/PrivateChat';
import { Settings, Heart, MessageCircle, User as UserIcon, FileText } from 'lucide-react';

export default function Salons() {
  const [activeSalon, setActiveSalon] = useState('contact');
  const [showIdentifierModal, setShowIdentifierModal] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [privateChatWith, setPrivateChatWith] = useState(null);
  const [sessionData, setSessionData] = useState(() => {
    // Utiliser un identifiant unique par appareil pour éviter les conflits
    const deviceId = localStorage.getItem('cochon_device_id') || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('cochon_device_id', deviceId);
    
    const stored = sessionStorage.getItem(`cochon_session_${deviceId}`);
    return stored ? JSON.parse(stored) : null;
  });

  const queryClient = useQueryClient();

  const { data: salonStatuses = [] } = useQuery({
    queryKey: ['salonStatuses'],
    queryFn: () => appClient.entities.SalonStatus.list(),
  });

  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  const { data: userMembership } = useQuery({
    queryKey: ['userMembership'],
    queryFn: async () => {
      const isAuth = await appClient.auth.isAuthenticated();
      if (!isAuth) return null;
      const user = await appClient.auth.me();
      setIsRegistered(true);
      setRegisteredUser(user);
      const deviceId = localStorage.getItem('cochon_device_id');
      // Check if member already has an anonymous session
      const stored = sessionStorage.getItem(`cochon_session_${deviceId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.isMember && parsed.userId) {
          setSessionData(parsed);
          const membership = await appClient.entities.Membership.filter({ 
            user_email: user.email,
            status: 'approved'
          });
          return membership?.[0] || null;
        }
      }
      // Create anonymous TemporaryUser for member (same as guests, but flagged as member)
      const activeUsers = await appClient.entities.TemporaryUser.filter({ is_active: true });
      const usedNumbers = activeUsers.map(u => u.identifier_number);
      let nextNumber = 1;
      while (usedNumbers.includes(nextNumber)) {
        nextNumber++;
      }
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const identifier = `Invité ${String(nextNumber).padStart(3, '0')}`;
      const tempUser = await appClient.entities.TemporaryUser.create({
        identifier,
        identifier_number: nextNumber,
        session_id: sessionId,
        is_active: true,
        is_member: true,
        last_activity: new Date().toISOString()
      });
      const memberSession = {
        identifier,
        sessionId,
        userId: tempUser.id,
        isMember: true,
      };
      setSessionData(memberSession);
      sessionStorage.setItem(`cochon_session_${deviceId}`, JSON.stringify(memberSession));
      const membership = await appClient.entities.Membership.filter({ 
        user_email: user.email,
        status: 'approved'
      });
      return membership?.[0] || null;
    },
  });

  const { data: salonLabels = [] } = useQuery({
    queryKey: ['salonLabels'],
    queryFn: async () => { const res = await appClient.functions.invoke('manageSalonLabel', { action: 'list' }); return res.data.items; },
    refetchInterval: 2000,
  });

  const SALON_DEFAULTS = {
    cochon: '🐷 Salon Cochon',
    contact: '💬 Salon Contact',
    commercial: '🛍️ Salon Commercial',
  };

  const getSalonLabel = (salonId) => {
    return salonLabels.find(l => l?.salon_id === salonId)?.name || SALON_DEFAULTS[salonId] || '';
  };

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', sessionData?.sessionId],
    queryFn: () => sessionData?.userId 
      ? appClient.entities.TemporaryUser.filter({ id: sessionData.userId })
      : Promise.resolve([]),
    enabled: !!sessionData?.userId,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadMessages', sessionData?.sessionId],
    queryFn: async () => {
      if (!sessionData?.sessionId) return 0;
      const res = await appClient.functions.invoke('managePrivateMessage', { action: 'filter', viewer_session_id: sessionData.sessionId, filters: { to_session_id: sessionData.sessionId, read: false } });
      return res.data.items.length;
    },
    refetchInterval: 3000,
    enabled: !!sessionData?.sessionId
  });

  const createIdentifierMutation = useMutation({
    mutationFn: async () => {
      // Only for guests — registered members use their member identity
      const activeUsers = await appClient.entities.TemporaryUser.filter({ is_active: true });
      const usedNumbers = activeUsers.map(u => u.identifier_number);
      let nextNumber = 1;
      while (usedNumbers.includes(nextNumber)) {
        nextNumber++;
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const identifier = `Invité ${String(nextNumber).padStart(3, '0')}`;

      const user = await appClient.entities.TemporaryUser.create({
        identifier,
        identifier_number: nextNumber,
        session_id: sessionId,
        is_active: true,
        last_activity: new Date().toISOString()
      });

      return { identifier, sessionId, userId: user.id };
    },
    onSuccess: (data) => {
      const deviceId = localStorage.getItem('cochon_device_id');
      setSessionData(data);
      sessionStorage.setItem(`cochon_session_${deviceId}`, JSON.stringify(data));
      setShowIdentifierModal(false);
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: (profileData) => 
      appClient.entities.TemporaryUser.update(sessionData.userId, profileData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    }
  });

  const { data: rulesContent } = useQuery({
    queryKey: ['rulesContent'],
    queryFn: async () => (await appClient.functions.invoke('manageEditableContent', { action: 'list' })).data.items,
  });

  const getSalonStatus = (salon) => {
    return salonStatuses.find(s => s?.salon === salon) || { is_open: true };
  };

  const getRulesText = () => {
    return rulesContent?.find(c => c?.key === 'rules')?.content || '';
  };

  const handleRequestIdentifier = () => {
    setShowIdentifierModal(true);
  };

  const handleConfirmIdentifier = () => {
    createIdentifierMutation.mutate();
  };



  // Désactiver après 30 minutes d'inactivité
  useEffect(() => {
    const cleanupInactive = async () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const allUsers = await appClient.entities.TemporaryUser.list();
      
      allUsers.forEach(user => {
        if (user.last_activity < thirtyMinutesAgo && user.is_active) {
          appClient.entities.TemporaryUser.update(user.id, { is_active: false });
        }
      });
    };

    // Vérifier toutes les 5 minutes
    const interval = setInterval(cleanupInactive, 5 * 60 * 1000);
    cleanupInactive(); // Vérification initiale

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionData?.userId) {
        appClient.entities.TemporaryUser.update(sessionData.userId, { is_active: false });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionData]);

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-white text-xl font-extralight tracking-widest">SALONS</h1>
        
        {sessionData && (
          <div className="flex items-center gap-3">
            <span className="text-white text-sm">{sessionData.identifier}</span>
            {!sessionData.isMember && (
              <button
                onClick={() => setShowProfileEditor(true)}
                className="p-2 text-white hover:text-white transition-colors"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Salon Tabs */}
      <Tabs value={activeSalon} onValueChange={setActiveSalon} className="h-[calc(100vh-11rem)] flex flex-col">
        <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 overflow-x-auto flex-nowrap text-white">
          <TabsTrigger
            value="messages"
            className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white relative whitespace-nowrap flex items-center gap-2"
          >
            <Heart size={24} className="text-white" strokeWidth={2} />
            <span className="hidden sm:inline">PRIVÉ</span>
            {unreadCount > 0 && activeSalon !== 'messages' && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap flex items-center gap-2"
          >
            <MessageCircle size={24} className="text-white" strokeWidth={2} />
            <span className="hidden sm:inline">{getSalonLabel('contact')}</span>
          </TabsTrigger>
          {isRegistered && (
            <TabsTrigger
              value="cochon"
              className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap flex items-center gap-2"
            >
              <UserIcon size={24} className="text-white" strokeWidth={2} />
              <span className="hidden sm:inline">{getSalonLabel('cochon')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="commercial"
            className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap flex items-center gap-2"
          >
            <FileText size={24} className="text-white" strokeWidth={2} />
            <span className="hidden sm:inline">{getSalonLabel('commercial')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="flex-1 mt-0 overflow-hidden">
          {!sessionData ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              {isRegistered ? (
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <p className="text-white text-sm mb-4">
                    Obtenez un identifiant pour voir vos messages privés
                  </p>
                  <button
                    onClick={handleRequestIdentifier}
                    className="bg-white text-black hover:bg-white/90 font-light tracking-wider px-4 py-2 rounded-md transition-colors"
                  >
                    OBTENIR UN IDENTIFIANT
                  </button>
                </>
              )}
            </div>
          ) : (
            <PrivateConversations 
              currentUser={{
                identifier: sessionData.identifier,
                session_id: sessionData.sessionId,
                is_member: !!sessionData.isMember
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="contact" className="flex-1 mt-0 overflow-hidden">
          <ChatRoom
            salon="contact"
            salonName={getSalonLabel('contact')}
            salonStatus={getSalonStatus('contact')}
            userIdentifier={sessionData?.identifier}
            sessionId={sessionData?.sessionId}
            onRequestIdentifier={handleRequestIdentifier}
            onOpenPrivateChat={setPrivateChatWith}
          />
        </TabsContent>

        {isRegistered && (
          <TabsContent value="cochon" className="flex-1 mt-0 overflow-hidden">
            <ChatRoom
              salon="cochon"
              salonName={getSalonLabel('cochon')}
              salonStatus={getSalonStatus('cochon')}
              userIdentifier={sessionData?.identifier}
              sessionId={sessionData?.sessionId}
              onRequestIdentifier={handleRequestIdentifier}
              onOpenPrivateChat={setPrivateChatWith}
            />
          </TabsContent>
        )}

        <TabsContent value="commercial" className="flex-1 mt-0 overflow-hidden">
          <ChatRoom
            salon="commercial"
            salonName={getSalonLabel('commercial')}
            salonStatus={getSalonStatus('commercial')}
            userIdentifier={sessionData?.identifier}
            sessionId={sessionData?.sessionId}
            onRequestIdentifier={handleRequestIdentifier}
            onOpenPrivateChat={setPrivateChatWith}
          />
        </TabsContent>
        </Tabs>

        {/* Private Chat */}
        {privateChatWith && sessionData && (
        <PrivateChat
          isOpen={!!privateChatWith}
          onClose={() => setPrivateChatWith(null)}
          otherUser={privateChatWith}
          currentUser={{
            identifier: sessionData.identifier,
            session_id: sessionData.sessionId,
            is_member: !!sessionData.isMember
          }}
        />
        )}

      {/* Identifier Modal */}
      <IdentifierModal
        isOpen={showIdentifierModal}
        onClose={() => setShowIdentifierModal(false)}
        onConfirm={handleConfirmIdentifier}
        rules={getRulesText()}
      />

      {/* Profile Editor */}
      <ProfileEditor
        isOpen={showProfileEditor}
        onClose={() => setShowProfileEditor(false)}
        profile={userProfile?.[0]}
        onSave={(data) => updateProfileMutation.mutate(data)}
      />
    </div>
  );
}
