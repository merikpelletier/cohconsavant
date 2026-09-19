import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Upload, Clock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Soumettre() {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [todaySubmission, setTodaySubmission] = useState(null);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    author_name: '',
    duration_days: 7,
    cover_image: '',
    class: 'Videos',
  });

  useEffect(() => {
    const init = async () => {
      try {
        const isAuth = await appClient.auth.isAuthenticated();
        if (!isAuth) {
          appClient.auth.redirectToLogin(window.location.href);
          return;
        }
        const me = await appClient.auth.me();
        setUser(me);

        // Sckript is a store + tools platform — dossier publishing is admin-only
        if (me.role !== 'admin') {
          window.location.href = '/';
          return;
        }

        // Check approved membership
        const memberships = await appClient.entities.Membership.filter({
          user_email: me.email,
          status: 'approved',
        });
        if (memberships.length > 0) {
          setMembership(memberships[0]);
        } else {
          // Fallback: treat as publisher if no membership record (e.g. admin or profile member)
          setMembership({ membership_type: 'publisher' });
        }

        // Check if already submitted today (skip for admins)
        if (me.role !== 'admin') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const recent = await appClient.entities.Dossier.filter({ submitted_by_email: me.email });
          const todayOne = recent.find(d => {
            if (!d.submitted_at) return false;
            const sub = new Date(d.submitted_at);
            sub.setHours(0, 0, 0, 0);
            return sub.getTime() === today.getTime();
          });
          setTodaySubmission(todayOne || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, cover_image: file_url }));
    } finally {
      setUploading(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const publishUntil = new Date(now);
      publishUntil.setDate(publishUntil.getDate() + form.duration_days);

      return appClient.entities.Dossier.create({
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        author_name: form.author_name || user.full_name,
        cover_image: form.cover_image,
        class: form.class,
        status: 'pending_review',
        order: 999,
        submitted_by_email: user.email,
        submitted_by_name: user.full_name,
        membership_type: membership.membership_type,
        duration_days: form.duration_days,
        publish_until: publishUntil.toISOString(),
        submitted_at: now.toISOString(),
        requires_payment: membership.membership_type === 'brand',
        payment_confirmed: false,
      });
    },
    onSuccess: () => setSubmitted(true),
  });

  const isValid = form.title.trim() && form.cover_image;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={40} className="text-red-500 mb-4" />
        <h2 className="text-white text-xl font-light mb-2">Adhésion requise</h2>
        <p className="text-white text-sm mb-6">Vous avez besoin d'une adhésion approuvée pour soumettre du contenu.</p>
        <Link to="/Membership" className="px-6 py-3 bg-white text-black text-sm rounded-lg hover:bg-white/90">
          Postuler pour une adhésion
        </Link>
      </div>
    );
  }

  if (todaySubmission) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <Clock size={40} className="text-red-500 mb-4" />
        <h2 className="text-white text-xl font-light mb-2">Limite quotidienne atteinte</h2>
        <p className="text-white text-sm mb-2">Vous avez déjà soumis un dossier aujourd'hui.</p>
        <p className="text-white/20 text-xs">Revenez demain pour soumettre du nouveau contenu.</p>
        <div className="mt-6 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left max-w-sm w-full">
          <p className="text-white text-xs tracking-widest mb-1">SOUMISSION DU JOUR</p>
          <p className="text-white text-sm font-medium">{todaySubmission.title}</p>
          <p className="text-white text-xs mt-1 capitalize">{todaySubmission.status.replace('_', ' ')}</p>
        </div>
        <Link to="/" className="mt-6 text-white text-sm hover:text-white flex items-center gap-2">
          <ArrowLeft size={14} /> Retour
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <CheckCircle size={48} className="text-red-500 mb-4 mx-auto" />
        </motion.div>
        <h2 className="text-white text-xl font-light mb-2">Soumission envoyée !</h2>
        <p className="text-white text-sm mb-2">Votre dossier est en attente de révision.</p>
        {membership.membership_type === 'brand' && (
          <p className="text-red-500/70 text-xs mt-2">⚠️ Des frais s'appliquent pour les publications de marque. Un administrateur vous contactera.</p>
        )}
        <Link to="/" className="mt-8 text-white text-sm hover:text-white flex items-center gap-2">
          <ArrowLeft size={14} /> Retour à l'accueil
        </Link>
      </div>
    );
  }

  const membershipColors = {
    publisher: 'bg-black text-white border-white/20',
    influencer: 'bg-red-600/20 text-red-400 border-red-600/30',
    brand: 'bg-red-700/20 text-red-500 border-red-700/30',
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center gap-4">
        <Link to="/" className="text-white hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-white text-lg font-extralight tracking-widest">SOUMETTRE UN DOSSIER</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Membership badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${membershipColors[membership.membership_type]}`}>
          {membership.membership_type.toUpperCase()}
          {membership.membership_type === 'brand' && <span className="text-red-500/60">· Des frais s'appliquent</span>}
        </div>

        {/* Title */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">TITRE *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Titre du dossier"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">SOUS-TITRE</label>
          <input
            type="text"
            value={form.subtitle}
            onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
            placeholder="Optionnel"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Author name */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">NOM DE L'AUTEUR</label>
          <input
            type="text"
            value={form.author_name}
            onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
            placeholder={user?.full_name || 'Votre nom'}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">DESCRIPTION / PRÉSENTATION</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={4}
            placeholder="Décrivez votre contenu et votre intention artistique..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
          />
        </div>

        {/* Class */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">CLASSE</label>
          <select
            value={form.class}
            onChange={e => setForm(f => ({ ...f, class: e.target.value }))}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
          >
            <option value="Videos" className="bg-black">Videos</option>
            <option value="Story" className="bg-black">Story</option>
            <option value="Assets" className="bg-black">Assets</option>
            <option value="Kits" className="bg-black">Kits</option>
            <option value="Merchandise" className="bg-black">Merchandise</option>
          </select>
        </div>

        {/* Cover image */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">IMAGE DE COUVERTURE *</label>
          {form.cover_image ? (
            <div className="relative">
              <img src={form.cover_image} alt="" className="w-full h-48 object-cover rounded-xl" />
              <button
                onClick={() => setForm(f => ({ ...f, cover_image: '' }))}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/30 transition-colors">
              {uploading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={24} className="text-white/20 mb-2" />
                  <span className="text-white text-sm">Téléverser une image</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">
            DURÉE DE PUBLICATION — <span className="text-white">{form.duration_days} jour{form.duration_days > 1 ? 's' : ''}</span>
          </label>
          <input
            type="range"
            min={1}
            max={user?.role === 'admin' ? 365 : 30}
            value={form.duration_days}
            onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) }))}
            className="w-full accent-white"
          />
          <div className="flex justify-between text-white/20 text-xs mt-1">
            <span>1 jour</span>
            <span>{user?.role === 'admin' ? '365 jours max' : '30 jours max'}</span>
          </div>
        </div>

        {/* Brand warning */}
        {membership.membership_type === 'brand' && (
          <div className="flex gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-red-500 text-sm font-medium">Des frais s'appliquent</p>
              <p className="text-red-500/60 text-xs mt-1">En tant que Marque, des frais de publication s'appliquent. Un administrateur vous contactera après la révision pour confirmer le paiement avant la mise en ligne.</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={() => submitMutation.mutate()}
          disabled={!isValid || submitMutation.isPending}
          className="w-full py-4 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {submitMutation.isPending ? 'Soumission...' : 'Soumettre le dossier'}
        </button>

        <p className="text-white/20 text-xs text-center">
          {user?.role === 'admin' ? "Admin · Pas de limite quotidienne · Jusqu'à 365 jours · Approbation requise" : 'Max 1 soumission par jour · Max 30 jours de publication · Approbation requise'}
        </p>
      </div>
    </div>
  );
}