import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Check if user has dismissed the prompt before
      const dismissed = localStorage.getItem('install_prompt_dismissed');
      if (!dismissed) {
        setTimeout(() => setShowPrompt(true), 2000); // Show after 2 seconds
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS Safari, check if standalone mode is not active
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isStandalone && !localStorage.getItem('install_prompt_dismissed')) {
      setTimeout(() => setShowPrompt(true), 2000);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // For iOS or if no prompt available, show instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        alert('Pour installer:\n1. Appuyez sur le bouton Partager\n2. Sélectionnez "Sur l\'écran d\'accueil"');
      }
      setShowPrompt(false);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('install_prompt_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-40 bg-neutral-950 border border-white/20 rounded-sm p-4 shadow-2xl"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white hover:text-white"
          >
            <X size={16} />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="bg-white/10 p-2 rounded-sm">
              <Download size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-light tracking-wide mb-1">
                Installer l'application
              </h3>
              <p className="text-white text-xs mb-3">
                Accédez rapidement depuis votre écran d'accueil
              </p>
              <Button
                onClick={handleInstall}
                className="w-full bg-white text-black hover:bg-white/90 font-light"
                size="sm"
              >
                Installer
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}