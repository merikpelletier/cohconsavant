import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { Plus, X } from 'lucide-react';
import ImageUploadField from './ImageUploadField';

const INP = "w-full bg-neutral-900 border border-white/20 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-white/40";

export default function FakeMemberForm({ member, onSaved, onCancel }) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    display_name: member?.display_name || '',
    title: member?.title || '',
    bio: member?.bio || '',
    avatar_url: member?.avatar_url || '',
    custom_banner_url: member?.custom_banner_url || '',
    custom_banner_link: member?.custom_banner_link || '',
    images: member?.images || [],
    links: member?.links || [],
    ai_instructions: member?.ai_instructions || '',
    age_range: member?.age_range || '',
    sexual_role: member?.sexual_role || '',
    body_type: member?.body_type || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.display_name.trim()) { alert('Un nom est requis'); return; }
    setSaving(true);
    try {
      const email = isEdit ? member.user_email : `fake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@lecochonsavant.local`;
      const payload = isEdit ? { ...form, id: member.id } : { ...form, user_email: email, is_fake: true };
      await appClient.functions.invoke('manageMemberProfile', { action: 'save', ...payload });
      onSaved();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nom affiché *">
          <input value={form.display_name} onChange={e => set('display_name', e.target.value)} className={INP} />
        </Field>
        <Field label="Titre / rôle">
          <input value={form.title} onChange={e => set('title', e.target.value)} className={INP} />
        </Field>
      </div>
      <Field label="Bio">
        <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} className={INP} />
      </Field>
      <Field label="Instructions IA (personnalité du membre fictif)">
        <textarea value={form.ai_instructions} onChange={e => set('ai_instructions', e.target.value)} rows={4} className={INP} placeholder="Ex: Tu es extravertie, flirteuse et taquine. Tu adores parler de tes voyages. Tu es très à l'aise avec les sujets cochons et tu réponds sans tabou. Tu utilise toujours un ton sensuel et complice..." />
        <p className="text-white/30 text-[10px] mt-1">Ces instructions guident l'IA quand le membre répond aux messages. Définis le ton, la personnalité, les limites (ou l'absence de limites).</p>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Tranche d'âge">
          <select value={form.age_range} onChange={e => set('age_range', e.target.value)} className={INP}>
            <option value="">—</option>
            <option value="18-29">18-29</option>
            <option value="30-45">30-45</option>
            <option value="46-65">46-65</option>
            <option value="66+">66 et plus</option>
          </select>
        </Field>
        <Field label="Rôle sexuel">
          <select value={form.sexual_role} onChange={e => set('sexual_role', e.target.value)} className={INP}>
            <option value="">—</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
            <option value="versatile">Versatile</option>
            <option value="side">Side</option>
          </select>
        </Field>
        <Field label="Type de corps">
          <select value={form.body_type} onChange={e => set('body_type', e.target.value)} className={INP}>
            <option value="">—</option>
            <option value="mince">Mince</option>
            <option value="opulent">Opulent</option>
            <option value="musclé">Musclé</option>
            <option value="efféminé">Efféminé</option>
            <option value="trans">Trans</option>
          </select>
        </Field>
      </div>
      <ImageUploadField label="Avatar" value={form.avatar_url} onChange={url => set('avatar_url', url)} folder="avatars" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ImageUploadField label="Bannière personnalisée" value={form.custom_banner_url} onChange={url => set('custom_banner_url', url)} folder="banners" />
        <Field label="Lien bannière">
          <input value={form.custom_banner_link} onChange={e => set('custom_banner_link', e.target.value)} className={INP} />
        </Field>
      </div>

      <div>
        <label className="block text-white/50 text-xs mb-1 tracking-wide">Galerie images (max 6)</label>
        <div className="space-y-3">
          {form.images.map((img, i) => (
            <ImageUploadField key={i} value={img} onChange={url => set('images', form.images.map((x, j) => j === i ? url : x))} folder="gallery" />
          ))}
          {form.images.length < 6 && (
            <button onClick={() => set('images', [...form.images, ''])} className="flex items-center gap-1 text-xs text-white/60"><Plus size={14} /> Ajouter</button>
          )}
        </div>
      </div>

      <Field label="Liens (label + URL)">
        <div className="space-y-2">
          {form.links.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input placeholder="Label" value={l.label || ''} onChange={e => set('links', form.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className={INP + ' w-1/3'} />
              <input placeholder="URL" value={l.url || ''} onChange={e => set('links', form.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} className={INP} />
              <button onClick={() => set('links', form.links.filter((_, j) => j !== i))} className="text-red-500"><X size={16} /></button>
            </div>
          ))}
          <button onClick={() => set('links', [...form.links, { label: '', url: '' }])} className="flex items-center gap-1 text-xs text-white/60"><Plus size={14} /> Ajouter</button>
        </div>
      </Field>

      <div className="flex gap-2 pt-2">
        <button onClick={save} disabled={saving} className="bg-white text-black px-4 py-2 text-xs tracking-wide rounded-sm disabled:opacity-50">
          {saving ? '...' : (isEdit ? 'Enregistrer' : 'Créer')}
        </button>
        <button onClick={onCancel} className="text-white/60 px-4 py-2 text-xs">Annuler</button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-white/50 text-xs mb-1 tracking-wide">{label}</label>
      {children}
    </div>
  );
}