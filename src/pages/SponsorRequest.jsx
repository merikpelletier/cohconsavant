import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { appClient } from '@/api/appClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, ChevronDown, AlertCircle, ExternalLink, ArrowLeft, ArrowRight, Image, MessageSquare, Sparkles, Crown, Rocket } from 'lucide-react';
import { addDays, addWeeks, addMonths, format } from 'date-fns';
import PromoMessageSection from '@/components/PromoMessageSection';
import { useAuth } from '@/lib/AuthContext';

// ─── helpers ───────────────────────────────────────────────────────────────
const isValidUrl = (val) => {
  try { new URL(val.startsWith('http') ? val : `https://${val}`); return true; } catch { return false; }
};

const computeEndDate = (start, durationStr) => {
  if (!durationStr) return null;
  const s = durationStr.toLowerCase();
  if (s.includes('week')) { const n = parseInt(s) || 1; return addWeeks(start, n); }
  if (s.includes('month')) { const n = parseInt(s) || 1; return addMonths(start, n); }
  if (s.includes('day')) { const n = parseInt(s) || 7; return addDays(start, n); }
  return addDays(start, 30);
};

const MAX_FILE_MB = 2;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const STEPS = ['profile', 'package', 'banner', 'contact', 'review'];
const STEP_LABELS = { profile: 'Profil', package: 'Forfait', banner: 'Bannière', contact: 'Contact', review: 'Révision' };

// ─── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ currentStep, skipProfile }) {
  const steps = skipProfile ? STEPS.filter(s => s !== 'profile') : STEPS;
  const idx = steps.indexOf(currentStep);
  return (
    <div className="flex items-center justify-center gap-1 mb-10">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${i < idx ? 'bg-red-500 text-white' : i === idx ? 'bg-red-500 text-white ring-4 ring-red-500/30 scale-110' : 'bg-zinc-900 border-2 border-zinc-700 text-zinc-500'}`}>
              {i < idx ? <CheckCircle size={16} /> : i + 1}
            </div>
            <span className={`text-[11px] mt-2 tracking-wide font-medium ${i === idx ? 'text-red-400 font-bold' : i < idx ? 'text-zinc-300' : 'text-zinc-600'}`}>{STEP_LABELS[s]}</span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-2 mb-7 transition-colors duration-300 ${i < idx ? 'bg-red-500' : 'bg-zinc-800'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function SponsorRequest() {
  const { user, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedEmail = searchParams.get('member') || '';

  const [sponsorType, setSponsorType] = useState('');
  const [step, setStep] = useState(preselectedEmail ? 'package' : 'profile');
  const [profiles, setProfiles] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const topRef = useRef(null);

  const [form, setForm] = useState({
    member_email: preselectedEmail,
    bracket_id: '',
    sponsor_name: '',
    sponsor_email: '',
    image_url: '',
    link: '',
    terms_accepted: false,
  });

  useEffect(() => {
    if (isLoadingAuth) return;
    if (user?.role !== 'admin') {
      setLoadingData(false);
      return;
    }
    Promise.all([
      appClient.functions.invoke('manageMemberProfile', { action: 'list', sort: 'display_name' }).then(r => r.data.items),
      appClient.functions.invoke('manageSponsorBracket', { action: 'list' }).then(r => r.data.items.filter(b => b.is_active)),
    ]).then(([p, b]) => { setProfiles(p); setBrackets(b); setLoadingData(false); });
  }, [isLoadingAuth, user?.role]);

  const selectedBracket = brackets.find(b => b.id === form.bracket_id);
  const selectedProfile = profiles.find(p => p.user_email === form.member_email);

  const goTo = (s) => { setStep(s); topRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageError('Seuls les fichiers JPG, PNG, WebP ou GIF sont acceptés.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setImageError(`Le fichier doit faire moins de ${MAX_FILE_MB} Mo.`);
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
    } finally {
      setUploading(false);
    }
  };

  const validateLink = (val) => {
    if (!val) { setLinkError('Le lien de destination est requis.'); return false; }
    if (!isValidUrl(val)) { setLinkError('Veuillez entrer une URL valide (ex. https://example.com)'); return false; }
    setLinkError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!form.terms_accepted) return;
    setSubmitting(true);
    try {
      const price = selectedBracket?.price || 0;
      const record = await appClient.entities.ProfileSponsor.create({
        member_email: form.member_email,
        bracket_id: form.bracket_id,
        bracket_name: selectedBracket?.name || '',
        bracket_price: price,
        bracket_duration: selectedBracket?.duration || '',
        platform_share: parseFloat((price * 0.30).toFixed(2)),
        member_share: parseFloat((price * 0.70).toFixed(2)),
        sponsor_name: form.sponsor_name,
        sponsor_email: form.sponsor_email,
        image_url: form.image_url,
        link: form.link.startsWith('http') ? form.link : `https://${form.link}`,
        is_active: false,
        status: 'pending',
        terms_accepted: true,
        submitted_at: new Date().toISOString(),
      });
      setSubmitted(record);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoadingAuth || loadingData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role !== 'admin') {
    const placements = [
      { icon: '▦', title: 'Une section', text: 'Associez votre marque à une section de la plateforme.' },
      { icon: '▤', title: 'Un contenu officiel', text: 'Soutenez une production ou un contenu officiel.' },
      { icon: '★', title: 'Le contenu d’un membre', text: 'Appuyez directement une création publiée par un membre.' },
      { icon: '●', title: 'Le profil d’un membre', text: 'Présentez votre marque directement dans le profil choisi.' },
    ];

    return (
      <div className="min-h-screen bg-black px-4 pb-24 pt-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-red-500/40 bg-gradient-to-br from-red-950 via-black to-black p-6 shadow-[0_0_40px_rgba(220,38,38,0.18)] sm:p-10"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-red-600/20 blur-3xl" />
          <div className="relative text-center">
            <div className="flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-red-400">
                <Crown size={14} /> Espace commanditaire
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">
                <Sparkles size={14} /> Bientôt disponible
              </span>
            </div>

            <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-5xl">Devenez commanditaire</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300 sm:text-base">
              Soutenez les créations et choisissez précisément où votre marque apparaîtra sur la plateforme.
            </p>

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              {placements.map((placement) => (
                <div key={placement.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-lg font-black text-red-500">
                    {placement.icon}
                  </div>
                  <h2 className="text-lg font-black text-white">{placement.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{placement.text}</p>
                </div>
              ))}
            </div>

            <p className="mt-7 text-sm font-bold text-red-300">
              Les demandes de commandite ouvriront prochainement.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4 pb-20">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 text-center shadow-2xl max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold tracking-wide text-white mb-3">Demande envoyée</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Votre demande de commandite est <span className="text-red-400 font-semibold">en attente de révision</span>.<br />
            Nous vous contacterons à <span className="text-white font-semibold">{form.sponsor_email}</span> une fois approuvée.
          </p>
          <div className="bg-black border border-zinc-800 rounded-2xl p-5 text-left space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Profil</span><span className="text-white font-medium">{selectedProfile?.display_name || form.member_email}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Forfait</span><span className="text-white font-medium">{selectedBracket?.name} — {selectedBracket?.duration}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Montant</span><span className="text-red-400 font-bold text-lg">${selectedBracket?.price}</span></div>
            <div className="flex justify-between pt-3 border-t border-zinc-800"><span className="text-zinc-500">Statut</span><span className="text-red-400 font-semibold">En attente de révision</span></div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24 px-4 pt-10" ref={topRef}>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
            <Crown size={14} className="text-red-500" />
            <span className="text-red-400 text-xs font-semibold tracking-widest uppercase">Espace Commanditaire</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">Devenir Commanditaire</h1>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">Choisissez comment vous souhaitez rejoindre notre communauté et mettre votre marque en lumière.</p>
        </div>

        {/* Sponsor type selector */}
        {!sponsorType && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <button
              onClick={() => setSponsorType('banner')}
              className="w-full group flex items-start gap-5 bg-zinc-900 hover:bg-zinc-800/80 rounded-3xl p-6 border-2 border-zinc-800 hover:border-red-500/50 transition-all text-left"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <Image size={26} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-lg text-white mb-1">Bannière de profil</p>
                <p className="text-zinc-400 text-sm leading-relaxed">Placez votre image bannière sur la page de profil d'un membre pour une durée choisie.</p>
              </div>
            </button>
            <button
              onClick={() => setSponsorType('message')}
              className="w-full group flex items-start gap-5 bg-zinc-900 hover:bg-zinc-800/80 rounded-3xl p-6 border-2 border-zinc-800 hover:border-red-500/50 transition-all text-left"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                <MessageSquare size={26} className="text-red-500" />
              </div>
              <div>
                <p className="font-bold text-lg text-white mb-1">Message promotionnel</p>
                <p className="text-zinc-400 text-sm leading-relaxed">Envoyez un message promotionnel planifié directement dans l'un de nos salons de discussion.</p>
              </div>
            </button>
          </motion.div>
        )}

        {sponsorType && (
          <button
            onClick={() => setSponsorType('')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Changer de type
          </button>
        )}

        {sponsorType === 'message' && <PromoMessageSection />}

        {sponsorType === 'banner' && <>
        <StepBar currentStep={step} skipProfile={!!preselectedEmail} />

        <AnimatePresence mode="wait">

          {/* STEP 1: Profile */}
          {step === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
                <h2 className="text-xs font-bold tracking-widest text-red-400 uppercase">Choisir un profil à commanditer</h2>
                <div className="relative">
                  <select
                    value={form.member_email}
                    onChange={e => setForm(f => ({ ...f, member_email: e.target.value }))}
                    className="w-full px-4 py-4 bg-black border border-zinc-700 rounded-2xl text-sm text-white appearance-none focus:outline-none focus:border-red-500 pr-10 transition-colors"
                  >
                    <option value="" className="text-zinc-500">Sélectionner un profil de membre...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.user_email}>
                        {p.display_name || p.user_email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                </div>
                {selectedProfile && (
                  <div className="flex items-center gap-4 p-4 bg-black border border-zinc-800 rounded-2xl">
                    {selectedProfile.avatar_url ? (
                      <img src={selectedProfile.avatar_url} className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-red-500/30" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        <Image size={20} className="text-zinc-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-white">{selectedProfile.display_name}</p>
                      {selectedProfile.title && <p className="text-xs text-zinc-500 mt-0.5">{selectedProfile.title}</p>}
                    </div>
                  </div>
                )}
              </div>
              <NavButtons onNext={() => goTo('package')} nextDisabled={!form.member_email} hideBack />
            </motion.div>
          )}

          {/* STEP 2: Package */}
          {step === 'package' && (
            <motion.div key="package" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4">
                <h2 className="text-xs font-bold tracking-widest text-red-400 uppercase mb-2">Choisir un forfait de commandite</h2>
                {brackets.length === 0 && <p className="text-zinc-500 text-sm py-8 text-center">Aucun forfait disponible pour le moment.</p>}
                {brackets.map(b => {
                  const selected = form.bracket_id === b.id;
                  const startDate = new Date();
                  const endDate = computeEndDate(startDate, b.duration);
                  return (
                    <button
                      key={b.id}
                      onClick={() => setForm(f => ({ ...f, bracket_id: b.id }))}
                      className={`w-full text-left px-5 py-5 rounded-2xl border-2 transition-all ${selected ? 'border-red-500 bg-red-500/10' : 'border-zinc-800 bg-black hover:border-zinc-600 hover:bg-zinc-900'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className={`font-bold text-lg ${selected ? 'text-white' : 'text-white'}`}>{b.name}</p>
                          <p className={`text-xs mt-1 font-medium ${selected ? 'text-red-400' : 'text-zinc-500'}`}>{b.duration}</p>
                        </div>
                        <span className={`text-3xl font-bold ${selected ? 'text-red-400' : 'text-white'}`}>${b.price}</span>
                      </div>
                      {endDate && (
                        <div className={`text-xs mt-2 pt-3 border-t font-medium ${selected ? 'border-red-500/20 text-red-300' : 'border-zinc-800 text-zinc-500'}`}>
                          Actif : {format(startDate, 'MMM d')} → {format(endDate, 'MMM d, yyyy')}
                        </div>
                      )}
                      <div className={`mt-2 flex gap-3 text-xs ${selected ? 'text-red-300' : 'text-zinc-500'}`}>
                        <span>Plateforme : ${(b.price * 0.30).toFixed(2)} (30%)</span>
                        <span>·</span>
                        <span>Membre : ${(b.price * 0.70).toFixed(2)} (70%)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <NavButtons onBack={() => goTo('profile')} onNext={() => goTo('banner')} nextDisabled={!form.bracket_id} />
            </motion.div>
          )}

          {/* STEP 3: Banner */}
          {step === 'banner' && (
            <motion.div key="banner" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
                <div>
                  <h2 className="text-xs font-bold tracking-widest text-red-400 uppercase mb-1">Téléverser votre bannière</h2>
                  <p className="text-xs text-zinc-500">JPG, PNG, WebP ou GIF · Max {MAX_FILE_MB}MB · Recommandé : 1200×200px</p>
                </div>

                {form.image_url ? (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-400 font-medium">Aperçu (tel qu'il apparaît sur le profil) :</p>
                    <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden p-3">
                      <img src={form.image_url} alt="Banner preview" className="w-full h-24 object-contain rounded-lg" />
                    </div>
                    <button onClick={() => { setForm(f => ({ ...f, image_url: '' })); setImageError(''); }} className="text-xs text-red-400 hover:text-red-300 underline transition-colors">Supprimer & téléverser une autre image</button>
                  </div>
                ) : (
                  <>
                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${imageError ? 'border-red-500/50 bg-red-500/5' : 'border-zinc-700 hover:border-red-500/50 hover:bg-zinc-800/50 bg-black'}`}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="hidden" />
                      {uploading ? (
                        <div className="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
                      ) : (
                        <>
                          <Upload size={24} className="text-red-500 mb-3" />
                          <span className="text-sm text-white font-medium">Cliquez pour téléverser</span>
                          <span className="text-xs text-zinc-500 mt-1">JPG, PNG, WebP, GIF · Max {MAX_FILE_MB}MB</span>
                        </>
                      )}
                    </label>
                    {imageError && <p className="text-red-400 text-xs flex items-center gap-1.5"><AlertCircle size={12} /> {imageError}</p>}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-zinc-800" />
                      <span className="text-xs text-zinc-600">ou collez une URL</span>
                      <div className="flex-1 h-px bg-zinc-800" />
                    </div>
                    <input
                      type="text"
                      placeholder="https://example.com/banner.jpg"
                      value={form.image_url}
                      onChange={e => { setImageError(''); setForm(f => ({ ...f, image_url: e.target.value })); }}
                      className="w-full px-4 py-3 bg-black border border-zinc-700 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                    />
                  </>
                )}

                <div>
                  <label className="block text-xs tracking-widest text-red-400 mb-2 font-bold uppercase">Lien de destination *</label>
                  <input
                    type="text"
                    placeholder="https://yourwebsite.com"
                    value={form.link}
                    onChange={e => { setForm(f => ({ ...f, link: e.target.value })); if (linkError) validateLink(e.target.value); }}
                    onBlur={e => validateLink(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors ${linkError ? 'border-red-500/50 bg-red-500/5' : 'bg-black border-zinc-700'}`}
                  />
                  {linkError && <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1.5"><AlertCircle size={12} /> {linkError}</p>}
                  {form.link && !linkError && isValidUrl(form.link) && (
                    <a href={form.link.startsWith('http') ? form.link : `https://${form.link}`} target="_blank" rel="noreferrer" className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                      <ExternalLink size={10} /> Aperçu du lien
                    </a>
                  )}
                </div>
              </div>
              <NavButtons
                onBack={() => goTo('package')}
                onNext={() => {
                  if (!validateLink(form.link)) return;
                  if (!form.image_url) { setImageError('Veuillez téléverser ou coller une image bannière.'); return; }
                  goTo('contact');
                }}
                nextDisabled={!form.image_url || !!linkError || !form.link}
              />
            </motion.div>
          )}

          {/* STEP 4: Contact */}
          {step === 'contact' && (
            <motion.div key="contact" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
                <h2 className="text-xs font-bold tracking-widest text-red-400 uppercase">Vos informations de contact</h2>
                <input
                  type="text"
                  placeholder="Entreprise ou votre nom *"
                  value={form.sponsor_name}
                  onChange={e => setForm(f => ({ ...f, sponsor_name: e.target.value }))}
                  className="w-full px-4 py-3.5 bg-black border border-zinc-700 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
                <input
                  type="email"
                  placeholder="Adresse courriel *"
                  value={form.sponsor_email}
                  onChange={e => setForm(f => ({ ...f, sponsor_email: e.target.value }))}
                  className="w-full px-4 py-3.5 bg-black border border-zinc-700 rounded-2xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
              <NavButtons
                onBack={() => goTo('banner')}
                onNext={() => goTo('review')}
                nextDisabled={!form.sponsor_name || !form.sponsor_email || !form.sponsor_email.includes('@')}
              />
            </motion.div>
          )}

          {/* STEP 5: Review & Submit */}
          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-5">
                <h2 className="text-xs font-bold tracking-widest text-red-400 uppercase">Résumé de la commande</h2>

                <div className="flex items-center gap-4 p-4 bg-black border border-zinc-800 rounded-2xl">
                  {selectedProfile?.avatar_url ? (
                    <img src={selectedProfile.avatar_url} className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-red-500/30" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Image size={20} className="text-zinc-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-white">{selectedProfile?.display_name || form.member_email}</p>
                    {selectedProfile?.title && <p className="text-xs text-zinc-500 mt-0.5">{selectedProfile.title}</p>}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-zinc-400 mb-2">Aperçu de la bannière</p>
                  <div className="bg-black border border-zinc-800 rounded-2xl overflow-hidden p-3">
                    <img src={form.image_url} alt="Banner" className="w-full h-24 object-contain rounded-lg" />
                  </div>
                  <a href={form.link.startsWith('http') ? form.link : `https://${form.link}`} target="_blank" rel="noreferrer" className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                    <ExternalLink size={10} /> {form.link}
                  </a>
                </div>

                {selectedBracket && (() => {
                  const start = new Date();
                  const end = computeEndDate(start, selectedBracket.duration);
                  return (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-500">Forfait</span><span className="text-white font-medium">{selectedBracket.name}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Durée</span><span className="text-white font-medium">{selectedBracket.duration}</span></div>
                      {end && <div className="flex justify-between"><span className="text-zinc-500">Période active</span><span className="text-white font-medium">{format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}</span></div>}
                      <div className="flex justify-between text-xs pt-2 border-t border-zinc-800">
                        <span className="text-zinc-500">Frais de plateforme (30%)</span><span className="text-zinc-300">${(selectedBracket.price * 0.30).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500">Revenus du membre (70%)</span><span className="text-zinc-300">${(selectedBracket.price * 0.70).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg pt-3 border-t border-zinc-800">
                        <span className="text-white">Total</span><span className="text-red-400">${selectedBracket.price}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-black border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400">
                  <span className="font-medium text-zinc-300">De :</span> {form.sponsor_name} ({form.sponsor_email})
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <h2 className="text-xs font-bold tracking-widest text-red-400 uppercase mb-4">Statut de la soumission</h2>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-full bg-red-500 border-2 border-red-500/30 flex items-center justify-center text-xs font-bold text-white">1</div>
                    <div className="flex-1 w-px bg-zinc-800" />
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500">2</div>
                    <div className="flex-1 w-px bg-zinc-800" />
                    <div className="w-7 h-7 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-500">3</div>
                  </div>
                  <div className="flex-1 space-y-5 text-xs">
                    <div>
                      <p className="font-bold text-white mb-0.5">En attente de révision</p>
                      <p className="text-zinc-500">Votre demande est soumise et en attente d'approbation de l'administrateur.</p>
                    </div>
                    <div>
                      <p className="font-bold text-white mb-0.5">Approuvée</p>
                      <p className="text-zinc-500">L'administrateur approuve et met votre bannière en ligne.</p>
                    </div>
                    <div>
                      <p className="font-bold text-white mb-0.5">Active</p>
                      <p className="text-zinc-500">Votre bannière est affichée sur le profil sélectionné.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.terms_accepted}
                    onChange={e => setForm(f => ({ ...f, terms_accepted: e.target.checked }))}
                    className="mt-0.5 w-5 h-5 accent-red-500 cursor-pointer rounded"
                  />
                  <span className="text-xs text-zinc-400 leading-relaxed">
                    J'accepte que ma soumission de bannière soit soumise à une révision et à une approbation. Je confirme que le contenu de la bannière est légal, non trompeur, et j'accepte les conditions de commandite. Les frais de commandite ne sont pas remboursables une fois la bannière en ligne.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => goTo('contact')}
                  className="flex items-center gap-2 px-6 py-3.5 bg-zinc-900 text-zinc-300 text-sm rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
                >
                  <ArrowLeft size={15} /> Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.terms_accepted || submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm tracking-wide font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:from-red-400 hover:to-red-500 transition-all rounded-2xl shadow-lg shadow-red-500/20"
                >
                  {submitting ? 'Soumission...' : 'Envoyer la demande'}
                </button>
              </div>

              <p className="text-center text-xs text-zinc-600 pb-4">
                Le paiement sera organisé par notre équipe après approbation.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        </>}
      </div>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled, hideBack }) {
  return (
    <div className="flex gap-3">
      {!hideBack && (
        <button onClick={onBack} className="flex items-center gap-2 px-6 py-3.5 bg-zinc-900 text-zinc-300 text-sm rounded-2xl border border-zinc-800 hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={15} /> Retour
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm tracking-wide font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:from-red-400 hover:to-red-500 transition-all rounded-2xl shadow-lg shadow-red-500/20"
      >
        Continuer <ArrowRight size={15} />
      </button>
    </div>
  );
}
