import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Pencil } from 'lucide-react';

const INP = "w-full bg-neutral-900 border border-white/20 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-white/40";

export default function FakeMemberPosts({ member }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);

  const { data: posts = [] } = useQuery({
    queryKey: ['fakePosts', member.user_email],
    queryFn: async () => (await appClient.functions.invoke('manageMemberPost', { action: 'filter', filters: { member_email: member.user_email } })).data.items,
  });

  const openNew = () => { setForm({ title: '', description: '', images: [], links: [] }); setEditing('new'); };
  const openEdit = (p) => {
    setForm({ title: p.title, description: p.description, images: p.images || [], links: p.links || [] });
    setEditing(p);
  };

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) { alert('Titre et description requis'); return; }
    try {
      const payload = editing === 'new'
        ? { ...form, member_email: member.user_email, member_name: member.display_name }
        : { ...form, id: editing.id };
      await appClient.functions.invoke('manageMemberPost', { action: 'save', ...payload });
      setEditing(null); setForm(null);
      queryClient.invalidateQueries({ queryKey: ['fakePosts', member.user_email] });
    } catch (e) { alert(e.message); }
  };

  const del = async (p) => {
    if (confirm('Supprimer ce post ?')) {
      await appClient.functions.invoke('manageMemberPost', { action: 'delete', id: p.id });
      queryClient.invalidateQueries({ queryKey: ['fakePosts', member.user_email] });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm tracking-wide">Posts de {member.display_name}</h3>
        <button onClick={openNew} className="flex items-center gap-1 bg-white text-black px-3 py-1.5 text-xs rounded-sm"><Plus size={13} /> Nouveau post</button>
      </div>

      {editing && (
        <div className="border border-white/20 rounded-sm p-3 mb-4 space-y-3 bg-neutral-950">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre" className={INP} />
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} className={INP} />
          <div>
            <p className="text-white/50 text-xs mb-1">Images (URLs, max 4)</p>
            {form.images.map((img, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input value={img} onChange={e => setForm({ ...form, images: form.images.map((x, j) => j === i ? e.target.value : x) })} className={INP} />
                <button onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })} className="text-red-500"><X size={15} /></button>
              </div>
            ))}
            {form.images.length < 4 && (
              <button onClick={() => setForm({ ...form, images: [...form.images, ''] })} className="text-xs text-white/60 flex items-center gap-1"><Plus size={12} /> Ajouter</button>
            )}
          </div>
          <div>
            <p className="text-white/50 text-xs mb-1">Liens</p>
            {form.links.map((l, i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input value={l.text || ''} onChange={e => setForm({ ...form, links: form.links.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} placeholder="Texte" className={INP + ' w-1/3'} />
                <input value={l.url || ''} onChange={e => setForm({ ...form, links: form.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} placeholder="URL" className={INP} />
                <button onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })} className="text-red-500"><X size={15} /></button>
              </div>
            ))}
            <button onClick={() => setForm({ ...form, links: [...form.links, { text: '', url: '' }] })} className="text-xs text-white/60 flex items-center gap-1"><Plus size={12} /> Ajouter</button>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-white text-black px-4 py-1.5 text-xs rounded-sm">Enregistrer</button>
            <button onClick={() => { setEditing(null); setForm(null); }} className="text-white/60 px-4 py-1.5 text-xs">Annuler</button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <p className="text-white/40 text-xs">Aucun post.</p>
      ) : (
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.id} className="border border-white/10 rounded-sm p-3 flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-light truncate">{p.title}</p>
                <p className="text-white/40 text-xs truncate">{p.description}</p>
              </div>
              <div className="flex gap-2 ml-2">
                <button onClick={() => openEdit(p)} className="text-white/60 hover:text-white"><Pencil size={14} /></button>
                <button onClick={() => del(p)} className="text-red-500/70 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}