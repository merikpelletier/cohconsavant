import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2 } from 'lucide-react';
import FakeMemberForm from './fakemembers/FakeMemberForm';
import FakeMemberPosts from './fakemembers/FakeMemberPosts';
import FakeMemberDossiers from './fakemembers/FakeMemberDossiers';
import FakeMemberMessages from './fakemembers/FakeMemberMessages';

const TABS = [
  { key: 'profile', label: 'Profil' },
  { key: 'posts', label: 'Publications' },
  { key: 'dossiers', label: 'Dossiers' },
  { key: 'messages', label: 'Messages' },
];

export default function AdminFakeMembers() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('profile');

  const { data: fakeMembers = [], isLoading } = useQuery({
    queryKey: ['fakeMembers'],
    queryFn: async () => (await appClient.functions.invoke('manageMemberProfile', { action: 'filter', filters: { is_fake: true } })).data.items,
    staleTime: 30 * 1000,
  });

  const selected = fakeMembers.find(m => m.id === selectedId);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fakeMembers'] });
    queryClient.invalidateQueries({ queryKey: ['memberProfiles'] });
  };

  const handleDelete = async (m) => {
    if (!confirm(`Supprimer le faux membre « ${m.display_name} » ? Ses posts et dossiers assignés ne seront pas supprimés.`)) return;
    await appClient.functions.invoke('manageMemberProfile', { action: 'delete', id: m.id });
    refresh();
    if (selectedId === m.id) setSelectedId(null);
  };

  return (
    <div className="text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-light tracking-widest">FAUX MEMBRES</h2>
          <p className="text-white/40 text-xs mt-1">Membres fictifs pour habiller la plateforme</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 bg-white text-black px-3 py-2 text-xs tracking-wide rounded-sm hover:bg-white/90"
        >
          <UserPlus size={14} /> Nouveau
        </button>
      </div>

      {creating && (
        <div className="mb-6 border border-white/20 rounded-sm p-4">
          <FakeMemberForm member={null} onSaved={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : fakeMembers.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-10">Aucun faux membre. Cliquez sur « Nouveau ».</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {fakeMembers.map(m => (
            <div
              key={m.id}
              onClick={() => { setSelectedId(m.id); setTab('profile'); }}
              className={`border rounded-sm p-3 flex items-center gap-3 cursor-pointer ${selectedId === m.id ? 'border-white bg-white/5' : 'border-white/20 hover:border-white/40'}`}
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white">{m.display_name?.charAt(0) || '?'}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-light truncate">{m.display_name || m.user_email}</p>
                <p className="text-white/40 text-xs truncate">{m.title || m.user_email}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDelete(m); }} className="text-red-500/70 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="border border-white/20 rounded-sm">
          <div className="flex border-b border-white/10 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-xs tracking-wide whitespace-nowrap ${tab === t.key ? 'bg-white text-black' : 'text-white hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="p-4">
            {tab === 'profile' && <FakeMemberForm key={selected.id} member={selected} onSaved={refresh} onCancel={() => {}} />}
            {tab === 'posts' && <FakeMemberPosts member={selected} />}
            {tab === 'dossiers' && <FakeMemberDossiers member={selected} />}
            {tab === 'messages' && <FakeMemberMessages member={selected} allFakes={fakeMembers} />}
          </div>
        </div>
      )}
    </div>
  );
}