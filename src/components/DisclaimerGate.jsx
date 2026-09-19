import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';

const STORAGE_KEY = 'cochon_disclaimer_accepted';

export default function DisclaimerGate() {
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      // Registered members never see the disclaimer
      try {
        const isAuth = await appClient.auth.isAuthenticated();
        if (isAuth) {
          setChecking(false);
          return;
        }
      } catch {
        // ignore — treat as guest
      }
      // Guests: show only if not previously accepted
      if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
      setChecking(false);
    };
    check();
  }, []);

  const handleEnter = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
  };

  const handleQuit = () => {
    window.location.href = 'https://www.google.com';
  };

  if (checking || !show) return null;

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center overflow-y-auto">
      <div className="w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-6 my-auto">
        <div className="text-center mb-5">
          <h1 className="text-white text-2xl sm:text-3xl font-black tracking-wide uppercase leading-tight">
            Avertissement
          </h1>
          <p className="text-red-600 text-sm font-bold tracking-widest uppercase mt-2">
            Contenu érotique réservé aux adultes
          </p>
        </div>

        <div className="space-y-3 text-white/90 text-sm sm:text-base leading-relaxed font-light">
          <p>
            <span className="font-bold text-white">Le Cochon Savant</span> est un espace destiné exclusivement à un public adulte.
          </p>
          <p>
            Le site explore la culture, les relations, le corps, les fantasmes et la sexualité des hommes gais adultes dans une approche éditoriale, artistique, culturelle et érotique.
          </p>
          <p>
            Certains contenus peuvent présenter de la nudité, des situations suggestives, des thèmes liés à la sexualité, un langage mature ou des représentations érotiques destinées à un public adulte.
          </p>
          <p>
            Le contenu du Cochon Savant n'a pas pour vocation d'être pornographique, mais certains sujets ou visuels peuvent néanmoins être considérés comme sensibles ou inappropriés pour les personnes mineures.
          </p>

          <div className="border-t border-white/15 pt-4">
            <p className="font-bold text-white mb-2">En poursuivant, vous confirmez :</p>
            <ul className="space-y-1.5 pl-1">
              <li className="flex gap-2"><span className="text-red-600">—</span><span>avoir 18 ans ou plus ;</span></li>
              <li className="flex gap-2"><span className="text-red-600">—</span><span>avoir atteint l'âge légal requis pour consulter ce type de contenu dans votre lieu de résidence ;</span></li>
              <li className="flex gap-2"><span className="text-red-600">—</span><span>comprendre la nature adulte et érotique du contenu ;</span></li>
              <li className="flex gap-2"><span className="text-red-600">—</span><span>choisir volontairement d'y accéder.</span></li>
            </ul>
          </div>

          <p className="text-red-600 font-bold text-center pt-2">
            L'accès aux personnes mineures est interdit.
          </p>
        </div>

        <div className="sticky bottom-0 mt-5 flex flex-col sm:flex-row gap-3 bg-black pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            onClick={handleEnter}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold tracking-wide uppercase text-sm py-3 px-4 rounded-md transition-colors"
          >
            J'ai 18 ans ou plus — Entrer
          </button>
          <button
            onClick={handleQuit}
            className="flex-1 border border-white/30 hover:border-white/60 text-white font-bold tracking-wide uppercase text-sm py-3 px-4 rounded-md transition-colors"
          >
            Quitter le site
          </button>
        </div>
      </div>
    </div>
  );
}
