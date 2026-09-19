import React from 'react';
import { BookOpen, Megaphone, ShoppingBag, Sparkles, Users } from 'lucide-react';

const benefits = [
  { icon: BookOpen, label: 'Publier vos dossiers' },
  { icon: Users, label: 'Développer votre communauté' },
  { icon: ShoppingBag, label: 'Vendre contenus et articles' },
  { icon: Megaphone, label: 'Obtenir le soutien d’annonceurs' },
];

export default function DossierPublishingAnnouncement() {
  return (
    <section className="px-4 pt-4" aria-label="Publication de dossiers bientôt disponible">
      <div className="relative overflow-hidden rounded-2xl border border-red-500/50 bg-gradient-to-br from-red-950 via-black to-black p-5 shadow-[0_0_30px_rgba(220,38,38,0.18)] sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />

        <div className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">
              <Sparkles size={14} />
              Bientôt disponible
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-red-300">
              Publication de dossiers
            </span>
          </div>

          <h2 className="max-w-3xl text-2xl font-black leading-tight text-white sm:text-3xl">
            Publiez vos créations. Bâtissez votre communauté.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/75 sm:text-base">
            Chaque membre pourra publier ses dossiers, vendre du contenu et des articles, puis obtenir le soutien d’annonceurs — sans devoir atteindre un nombre minimum de fans ou d’abonnés.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-semibold text-white">
                <Icon size={17} className="shrink-0 text-red-500" />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs font-black uppercase tracking-wider text-red-400">
            Aucun minimum de fans ou d’abonnés requis
          </p>
        </div>
      </div>
    </section>
  );
}
