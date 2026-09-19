import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import BottomNav from '@/components/BottomNav';
import InstallPrompt from '@/components/InstallPrompt';
import PersistentAIBar from '@/components/PersistentAIBar';
import DisclaimerGate from '@/components/DisclaimerGate';
import { useAppContext } from '@/lib/AppContext';

export default function Layout({ children, currentPageName }) {
  const { setAppContext } = useAppContext();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const isAuth = await appClient.auth.isAuthenticated();
        if (isAuth) {
          const user = await appClient.auth.me();
          if (user.role === 'admin') {
            setIsAdmin(true);
          }
        }
      } catch (error) {
        // Not authenticated, ignore
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAccess();
  }, []);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Track user activity globally
  useEffect(() => {
    const deviceId = localStorage.getItem('cochon_device_id');
    if (!deviceId) return;

    const storedSession = sessionStorage.getItem(`cochon_session_${deviceId}`);
    if (!storedSession) return;

    let sessionData;
    try {
      sessionData = JSON.parse(storedSession);
    } catch {
      sessionStorage.removeItem(`cochon_session_${deviceId}`);
      return;
    }
    if (!sessionData?.userId) return;

    const updateActivity = () => {
      appClient.entities.TemporaryUser.update(sessionData.userId, {
        last_activity: new Date().toISOString()
      }).catch(() => {});
    };

    // Update activity every 2 minutes
    const interval = setInterval(updateActivity, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Broadcast page name into app context
  useEffect(() => {
    const pageLabels = {
      Magazine: 'Magazine (dossier feed)',
      Studio: 'My Studio',
      MyProjects: 'My Projects',
      Index: 'Home / Index',
      Admin: 'Admin Dashboard',
      Membership: 'Membership',
      MemberDashboard: 'Member Dashboard',
      MemberListing: 'Member Listing',
    };
    setAppContext({ page: pageLabels[currentPageName] || currentPageName, section: null, detail: null });
  }, [currentPageName]);

  // Don't show landscape block on admin page or desktop
  const isAdminPage = currentPageName === 'Admin';
  const isGamePage = currentPageName === 'GamePlayer' || currentPageName === 'GameVisit' || currentPageName === 'GalleryEditor';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const showLandscapeBlock = isLandscape && !isAdminPage && !isGamePage && isMobile;



  // Hide nav and AI bar on admin page and full-screen game pages
  const showNav = !isAdminPage && !isGamePage;
  const showAIBar = false;

  return (
    <div className="min-h-screen bg-black">
      <DisclaimerGate />
      {showLandscapeBlock && (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center">
          <div className="text-white text-center px-8">
            <div className="text-6xl mb-6">📱</div>
            <p className="text-xl font-light tracking-wide">Portrait mode only</p>
            <p className="text-white/60 text-sm mt-2">Rotate your phone</p>
          </div>
        </div>
      )}
      <style>{`
        :root {
          --background: 0 0% 0%;
          --foreground: 0 0% 100%;
          --card: 0 0% 5%;
          --card-foreground: 0 0% 100%;
          --popover: 0 0% 5%;
          --popover-foreground: 0 0% 100%;
          --primary: 0 72% 51%;
          --primary-foreground: 0 0% 100%;
          --secondary: 0 0% 12%;
          --secondary-foreground: 0 0% 100%;
          --muted: 0 0% 12%;
          --muted-foreground: 0 0% 65%;
          --accent: 0 72% 51%;
          --accent-foreground: 0 0% 100%;
          --destructive: 0 62% 45%;
          --destructive-foreground: 0 0% 100%;
          --border: 0 0% 18%;
          --input: 0 0% 18%;
          --ring: 0 72% 51%;
        }
        
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
        
        *::-webkit-scrollbar {
          width: 6px;
        }
        
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        
        *::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 3px;
        }

        html {
          overflow-y: scroll;
          scrollbar-gutter: stable;
          scrollbar-width: auto;
          scrollbar-color: #dc2626 #171717;
        }

        html::-webkit-scrollbar {
          width: 12px;
        }

        html::-webkit-scrollbar-track {
          background: #171717;
        }

        html::-webkit-scrollbar-thumb {
          background: #dc2626;
          border: 2px solid #171717;
          border-radius: 999px;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          font-weight: 700;
        }
        
        ::selection {
          background: rgba(220, 38, 38, 0.3);
        }
      `}</style>
      
      {showAIBar && <PersistentAIBar agentName="production_assistant" />}

      <div style={{ paddingTop: showAIBar ? 'calc(52px + env(safe-area-inset-top))' : 0 }}>
        {children}
      </div>
      
      {showNav && (
        <>
          <BottomNav />
          <InstallPrompt />
        </>
      )}
    </div>
  );
}
