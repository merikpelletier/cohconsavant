import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { openAuthorizeNetHostedPayment } from '@/lib/authorizeNetHostedPayment';

const MEMBERSHIP_TYPES = [
  {
    id: 'publisher',
    label: 'Éditeur',
    description: 'Soumettre des articles éditoriaux et des dossiers pour publication dans le magazine.',
    features: ['Soumettre des dossiers', 'Espace éditorial dédié', 'Crédits d\'auteur visibles'],
    color: 'bg-black text-white',
    accent: 'border-black',
  },
  {
    id: 'influencer',
    label: 'Influenceur',
    description: 'Profil public visible par la communauté, avec galerie photos et liens.',
    features: ['Profil public', 'Galerie personnalisée', 'Liens externes visibles'],
    color: 'bg-red-600 text-white',
    accent: 'border-red-600',
  },
  {
    id: 'brand',
    label: 'Marque',
    description: 'Publiez vos offres et produits dans la boutique.',
    features: ['Annonces de produits', 'Page de boutique dédiée', 'Promotions visibles'],
    color: 'bg-red-700 text-white',
    accent: 'border-red-700',
  },
];

const MEMBERSHIP_DESCRIPTIONS = {
  publisher: 'Soumettre des articles éditoriaux et des dossiers pour publication dans le magazine.',
  influencer: 'Profil public visible par la communauté, avec galerie photos et liens.',
  brand: 'Publiez vos offres et produits dans la boutique.',
};

export default function Membership() {
  const { user, isLoadingAuth } = useAuth();
  const [step, setStep] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'submitted') return 'submitted';
    return 'choose';
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [showPreviewBtn, setShowPreviewBtn] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ bio: '', website: '' });
  const [loading, setLoading] = useState(false);
  const [existingMembership, setExistingMembership] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [membershipPricing, setMembershipPricing] = useState([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [tokenPackages, setTokenPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    setCheckingExisting(true);
    appClient.entities.Membership.filter({ user_email: user.email })
      .then(memberships => { if (memberships.length > 0) setExistingMembership(memberships[0]); })
      .catch(() => {})
      .finally(() => setCheckingExisting(false));
  }, [user]);

  useEffect(() => {
    appClient.functions.invoke('manageMembershipPricing', { action: 'list' })
      .then(r => r.data.items)
      .then(pricing => {
        const sorted = [...pricing].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setMembershipPricing(sorted);
      })
      .catch(() => {})
      .finally(() => setLoadingPricing(false));
    
    appClient.functions.invoke('manageTokenPackage', { action: 'list' })
      .then(r => r.data.items)
      .then(packages => {
        const sorted = [...packages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setTokenPackages(sorted);
      })
      .catch(() => {})
      .finally(() => setLoadingPackages(false));
  }, []);

  const handleSubmit = async () => {
    if (!selected || !user) return;
    setLoading(true);
    try {
      // Determine if the selected tier is paid by asking the server.
      // The server loads the real price from membership_pricings — we never trust a client price.
      let paymentResult;
      try {
        const res = await appClient.functions.invoke('purchaseMembership', { membership_type: selected });
        paymentResult = res.data;
      } catch (err) {
        // FREE_TIER means the price is $0 — fall through to plain application submission.
        if (!err?.message?.includes('FREE_TIER') && !(err?.data?.error?.includes('FREE_TIER'))) throw err;
        paymentResult = null;
      }

      if (paymentResult?.token) {
        // Paid tier: redirect to Authorize.Net hosted payment page.
        // The webhook (or return URL handler) will activate the membership after successful payment.
        openAuthorizeNetHostedPayment(paymentResult);
        // Do not set step here — the page will redirect away.
        return;
      }

      // Free tier ($0): submit plain membership application as before.
      await appClient.entities.Membership.create({
        user_email: user.email,
        user_name: user.full_name,
        membership_type: selected,
        status: 'pending',
        bio: form.bio,
        website: form.website,
      });
      setStep('submitted');
    } finally {
      setLoading(false);
    }
  };

  // === PREVIEW MODE - SHOW CONFIRMATION DIRECTLY ===
  if (previewMode && step === 'submitted') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-8 overflow-auto">
        <div className="max-w-md w-full text-center">
          <CheckCircle size={80} className="text-red-800 mx-auto mb-8" strokeWidth={1.5} />
          <h2 className="text-4xl font-bold text-black mb-4 tracking-tight">Candidature envoyée</h2>
          <p className="text-white text-lg mb-12 leading-relaxed">Merci pour votre candidature. Nous l'examinerons et vous répondrons par courriel dans un délai de 3 à 5 jours ouvrables.</p>

          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-4">Ce qui suit</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-800 mt-2 flex-shrink-0" />
                <p className="text-white text-sm">Notre équipe examine votre candidature</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-800 mt-2 flex-shrink-0" />
                <p className="text-white text-sm">Vous recevrez un courriel avec notre décision</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-800 mt-2 flex-shrink-0" />
                <p className="text-white text-sm">Une fois approuvée, vous aurez accès à tous les avantages de votre adhésion</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setPreviewMode(false);
              setStep('choose');
            }}
            className="mt-12 text-white hover:text-black text-sm font-medium transition-colors"
          >
            Quitter l'aperçu
          </button>
        </div>
      </motion.div>
    );
  }

  // === NOT LOGGED IN ===
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-8 pb-20">
        <h1 className="text-5xl font-black tracking-widest mb-4">COMPTE</h1>
        <p className="text-black text-lg font-bold mb-12">Connectez-vous ou créez un compte pour continuer</p>
        <div className="flex flex-col gap-5 w-full max-w-xs">
          <button
            onClick={() => appClient.auth.redirectToLogin(window.location.href)}
            className="w-full py-5 bg-black text-red-500 text-xl tracking-widest font-black rounded-2xl"
          >
            CONNEXION
          </button>
          <button
            onClick={() => appClient.auth.redirectToLogin(window.location.href)}
            className="w-full py-5 bg-white text-black text-xl tracking-widest font-black rounded-2xl border-4 border-black"
          >
            CRÉER UN COMPTE
          </button>
        </div>
      </div>
    );
  }

  // === LOADING (checking existing membership) ===
  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-black/30 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const statusConfig = {
    pending: { icon: Clock, label: 'En attente d\'approbation', color: 'text-red-800', bg: 'bg-red-300' },
    approved: { icon: CheckCircle, label: 'Adhésion active', color: 'text-red-900', bg: 'bg-red-300' },
    rejected: { icon: XCircle, label: 'Candidature rejetée', color: 'text-red-800', bg: 'bg-red-200' },
  };

  // === MEMBERSHIP FORM ===
  return (
    <div className="min-h-screen bg-white pb-24 px-4 pt-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setShowTokens(false)}
            className={`px-6 py-3 rounded-full font-black tracking-widest ${!showTokens ? 'bg-black text-white' : 'bg-white text-black border-2 border-black'}`}
          >
            ADHÉSIONS
          </button>
          <button
            onClick={() => setShowTokens(true)}
            className={`px-6 py-3 rounded-full font-black tracking-widest ${showTokens ? 'bg-black text-white' : 'bg-white text-black border-2 border-black'}`}
          >
            JETONS
          </button>
        </div>

        {/* Preview Toggle */}
        {showPreviewBtn && (
          <div className="text-center mb-6">
            {previewMode ? (
              <button
                onClick={() => {
                  setPreviewMode(false);
                  setStep('choose');
                }}
                className="text-xs bg-black text-white px-4 py-2 rounded-full hover:bg-black/80 font-bold"
              >
                Quitter le mode aperçu
              </button>
            ) : (
              <button
                onClick={() => {
                  setPreviewMode(true);
                  setStep('submitted');
                }}
                className="text-xs bg-white text-black px-4 py-2 rounded-full hover:bg-white/80 border-2 border-black font-bold"
              >
                Aperçu du message de confirmation
              </button>
            )}
          </div>
        )}

        {existingMembership && (() => {
          const cfg = statusConfig[existingMembership.status];
          const Icon = cfg.icon;
          const typeInfo = MEMBERSHIP_TYPES.find(t => t.id === existingMembership.membership_type);
          return (
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl mb-6 ${cfg.bg}`}>
              <Icon size={22} className={cfg.color} />
              <div>
                <p className={`text-base font-black ${cfg.color}`}>{cfg.label} — {typeInfo?.label}</p>
                <p className="text-sm font-bold text-black">Vous pouvez postuler pour une adhésion différente ci-dessous</p>
              </div>
            </div>
          );
        })()}

        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="text-base font-bold text-black">{user.email}</span>
          <button onClick={() => appClient.auth.logout(window.location.href)} className="text-base font-black text-white bg-red-600 px-4 py-2 rounded-lg">Déconnexion</button>
        </div>

        {showTokens ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {loadingPackages ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-black/30 border-t-black rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {tokenPackages.length > 0 ? (
                  tokenPackages.map((pkg) => (
                    <div key={pkg.id} className="w-full p-6 rounded-2xl border-4 border-black/20 bg-white/80">
                      <div className="flex items-start justify-between mb-3">
                        <span className="inline-block px-4 py-2 rounded-full text-base font-black tracking-widest bg-black text-white">{pkg.name}</span>
                        {pkg.bonus_percentage > 0 && (
                          <span className="inline-block px-3 py-1 rounded-full text-sm font-black bg-red-500 text-black">+{pkg.bonus_percentage}% BONUS</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl font-black text-black">${pkg.price}</span>
                        <span className="text-lg font-bold text-black">• {pkg.token_amount} jetons</span>
                        {pkg.bonus_percentage > 0 && (
                          <span className="text-sm font-bold text-red-800 bg-red-300 px-2 py-1 rounded">
                            +{Math.round(pkg.token_amount * (pkg.bonus_percentage / 100))} jetons bonus
                          </span>
                        )}
                        </div>
                        <p className="text-sm font-bold text-black">
                        Total : <span className="font-black">{pkg.token_amount + Math.round(pkg.token_amount * (pkg.bonus_percentage / 100))} jetons</span>
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-black font-bold">Aucun forfait de jetons disponible</div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {loadingPricing ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-black/30 border-t-black rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {membershipPricing.length > 0 ? (
                    membershipPricing.map((pricing) => {
                      const typeInfo = MEMBERSHIP_TYPES.find(t => t.id === pricing.membership_type.toLowerCase());
                      const displayLabel = typeInfo?.label || pricing.membership_type;
                      const description = MEMBERSHIP_DESCRIPTIONS[pricing.membership_type.toLowerCase()] || typeInfo?.description || '';
                      const features = typeInfo?.features || [];
                      return (
                        <button key={pricing.id} onClick={() => setSelected(pricing.membership_type.toLowerCase())}
                          className={`w-full text-left p-6 rounded-2xl border-4 transition-all ${selected === pricing.membership_type.toLowerCase() ? (typeInfo?.accent || 'border-black') + ' bg-white shadow-lg' : 'border-black/20 bg-white/60 hover:bg-white/80'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className={`inline-block px-4 py-2 rounded-full text-base font-black tracking-widest ${typeInfo?.color || 'bg-black text-white'}`}>{displayLabel}</span>
                            {selected === pricing.membership_type.toLowerCase() && <CheckCircle size={28} className="text-black flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl font-black text-black">${pricing.price_monthly}<span className="text-sm font-bold text-black">/mois</span></span>
                            {pricing.tokens_included > 0 && (
                              <span className="text-sm font-bold text-black bg-black/10 px-2 py-1 rounded">• {pricing.tokens_included} jetons inclus</span>
                            )}
                          </div>
                          <p className="text-base font-bold text-black mt-3 mb-3">{description}</p>
                          <ul className="space-y-2">
                            {features.map(f => (
                              <li key={f} className="text-base font-bold text-black flex items-center gap-2">
                                <span className="w-2 h-2 bg-black/50 rounded-full" />{f}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })
                  ) : (
                    MEMBERSHIP_TYPES.map((type) => (
                      <button key={type.id} onClick={() => setSelected(type.id)}
                        className={`w-full text-left p-6 rounded-2xl border-4 transition-all ${selected === type.id ? type.accent + ' bg-white shadow-lg' : 'border-black/20 bg-white/60 hover:bg-white/80'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className={`inline-block px-4 py-2 rounded-full text-base font-black tracking-widest ${type.color}`}>{type.label}</span>
                          {selected === type.id && <CheckCircle size={28} className="text-black flex-shrink-0" />}
                        </div>
                        <p className="text-base font-bold text-black mt-3 mb-3">{type.description}</p>
                        <ul className="space-y-2">
                          {type.features.map(f => (
                            <li key={f} className="text-base font-bold text-black flex items-center gap-2">
                              <span className="w-2 h-2 bg-black/50 rounded-full" />{f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))
                  )}
                </div>
                <button onClick={() => selected && setStep('form')} disabled={!selected}
                  className="w-full mt-10 py-5 bg-black text-white text-xl tracking-widest font-black disabled:opacity-40 rounded-xl">
                  CONTINUER
                </button>
              </>
            )}
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white/80 rounded-2xl p-6 mb-6">
              <button onClick={() => setStep('choose')} className="text-black font-black text-lg mb-6 block">← Retour</button>
              <div className="space-y-5">
                <div>
                  <label className="block text-base font-black tracking-widest text-black mb-2">À PROPOS DE VOUS *</label>
                  <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                    placeholder="Qui êtes-vous ? Pourquoi cette adhésion ?" rows={4}
                    className="w-full px-4 py-3 bg-white border-2 border-black/30 rounded-lg text-base font-bold focus:outline-none focus:border-black resize-none" />
                </div>
                <div>
                  <label className="block text-base font-black tracking-widest text-black mb-2">SITE WEB / LIEN SOCIAL</label>
                  <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-white border-2 border-black/30 rounded-lg text-base font-bold focus:outline-none focus:border-black" />
                </div>
              </div>
            </div>
            <button onClick={handleSubmit} disabled={!form.bio.trim() || loading}
              className="w-full py-5 bg-black text-white text-xl tracking-widest font-black disabled:opacity-30 hover:bg-black/80 transition-colors rounded-xl">
              {loading ? 'Envoi...' : 'ENVOYER LA CANDIDATURE'}
            </button>
          </motion.div>
        )}

        {step === 'submitted' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-8 overflow-auto">
            <div className="max-w-md w-full text-center">
              <CheckCircle size={80} className="text-red-800 mx-auto mb-8" strokeWidth={1.5} />
              <h2 className="text-4xl font-bold text-black mb-4 tracking-tight">Candidature envoyée</h2>
              <p className="text-white text-lg mb-12 leading-relaxed">Merci pour votre candidature. Nous l'examinerons et vous répondrons par courriel dans un délai de 3 à 5 jours ouvrables.</p>

              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-4">Ce qui suit</h3>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-800 mt-2 flex-shrink-0" />
                    <p className="text-white text-sm">Notre équipe examine votre candidature</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-800 mt-2 flex-shrink-0" />
                    <p className="text-white text-sm">Vous recevrez un courriel avec notre décision</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-800 mt-2 flex-shrink-0" />
                    <p className="text-white text-sm">Une fois approuvée, vous aurez accès à tous les avantages de votre adhésion</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => appClient.auth.logout(window.location.href)}
                className="mt-12 text-white hover:text-black text-sm font-medium transition-colors"
              >
                Retour à l'accueil
              </button>
            </div>

            {previewMode && (
              <div className="fixed bottom-4 right-4 p-4 bg-gray-100 border border-gray-300 rounded-lg max-w-xs">
                <p className="text-xs font-semibold text-black mb-1">🎨 Preview Mode</p>
                <p className="text-xs text-white">Edit this confirmation message in pages/Membership (step === 'submitted' section)</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}