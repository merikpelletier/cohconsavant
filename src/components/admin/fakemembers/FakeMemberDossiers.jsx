import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { toast } from 'sonner';

const INP = "w-full bg-neutral-900 border border-white/20 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-white/40";

export default function FakeMemberDossiers({ member }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['allDossiersAdminFake'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getAdminDossiers', {});
      return res.data?.dossiers || [];
    },
  });

  const filtered = dossiers.filter(d => !activeSearch.trim() || d.title?.toLowerCase().includes(activeSearch.toLowerCase()));

  const doSearch = () => setActiveSearch(search);

  const assign = async (d) => {
    await appClient.functions.invoke('saveDossier', {
      id: d.id,
      submitted_by_email: member.user_email,
      submitted_by_name: member.display_name,
      author_name: member.display_name,
    });
    queryClient.invalidateQueries({ queryKey: ['allDossiersAdminFake'] });
    toast.success(`Dossier « ${d.title} » assigné à ${member.display_name}`);
  };

  const unassign = async (d) => {
    await appClient.functions.invoke('saveDossier', {
      id: d.id,
      submitted_by_email: null,
      submitted_by_name: null,
      author_name: null,
    });
    queryClient.invalidateQueries({ queryKey: ['allDossiersAdminFake'] });
    toast.info(`Dossier « ${d.title} » retiré de ${member.display_name}`);
  };

  return (
    <div>
      <p className="text-white/50 text-xs mb-2">
        Assignez des dossiers magazine à {member.display_name}. Ils apparaîtront sur son profil et comme ses publications.
      </p>
      <div className="flex gap-2 mb-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
          placeholder="Rechercher un dossier..."
          className={INP}
        />
        <button
          onClick={doSearch}
          className="flex items-center gap-1.5 bg-white text-black text-sm font-medium px-4 py-2 rounded-sm hover:bg-white/90 whitespace-nowrap"
        >
          <Search size={14} /> Rechercher
        </button>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading && (
          <p className="text-white/40 text-sm text-center py-8">Chargement des dossiers...</p>
        )}
        {!isLoading && filtered.length === 0 && (
          <p className="text-white/40 text-sm text-center py-8">
            {dossiers.length === 0
              ? 'Aucun dossier magazine n\'existe encore. Créez des dossiers dans la section Dossiers pour pouvoir les assigner.'
              : `Aucun dossier trouvé pour « ${search} ».`}
          </p>
        )}
        {!isLoading && filtered.length > 0 && (
          <p className="text-white/30 text-xs mb-1">{filtered.length} dossier{filtered.length > 1 ? 's' : ''} {search.trim() && 'trouvé' + (filtered.length > 1 ? 's' : '')}</p>
        )}
        {filtered.map(d => {
          const assigned = d.submitted_by_email === member.user_email;
          return (
            <div key={d.id} className="border border-white/10 rounded-sm p-3 flex items-center gap-3">
              {d.cover_image ? (
                <img src={d.cover_image} className="w-8 h-12 object-cover" />
              ) : (
                <div className="w-8 h-12 bg-neutral-800" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{d.title}</p>
                <p className="text-white/40 text-xs">{d.status} · {d.category || '—'}</p>
              </div>
              {assigned ? (
                <button onClick={() => unassign(d)} className="flex items-center gap-1 text-xs text-red-500 border border-red-500/40 px-2 py-1 rounded-sm">
                  <Check size={12} /> Assigné
                </button>
              ) : (
                <button onClick={() => assign(d)} className="text-xs text-white/70 border border-white/20 px-2 py-1 rounded-sm hover:bg-white/10">
                  Assigner
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}