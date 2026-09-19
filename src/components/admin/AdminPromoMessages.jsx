import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Check, X, Send, Eye } from 'lucide-react';
import { format } from 'date-fns';

const SALON_LABELS = { cochon: '🐷 Cochon', contact: '💬 Contact', commercial: '🛍️ Info' };
const STATUS_COLORS = {
  pending: 'text-red-500 bg-red-500/10',
  approved: 'text-red-500 bg-red-500/10',
  rejected: 'text-red-400 bg-red-400/10',
  sent: 'text-red-500 bg-red-500/10',
};

export default function AdminPromoMessages() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('requests'); // 'requests' | 'packages'
  const [expandedId, setExpandedId] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});

  // ── packages ──
  const [addingPkg, setAddingPkg] = useState(false);
  const [pkgForm, setPkgForm] = useState({ name: '', price: '', description: '' });

  const { data: packages = [] } = useQuery({
    queryKey: ['promo-packages'],
    queryFn: async () => { const res = await appClient.functions.invoke('managePromoMessagePackage', { action: 'list' }); return res.data.items; },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['promo-requests'],
    queryFn: () => appClient.entities.PromoMessageRequest.list('-submitted_at'),
  });

  const createPkgMutation = useMutation({
    mutationFn: async (d) => { const res = await appClient.functions.invoke('managePromoMessagePackage', { action: 'save', ...d }); return res.data.item; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promo-packages'] }); setAddingPkg(false); setPkgForm({ name: '', price: '', description: '' }); },
  });

  const deletePkgMutation = useMutation({
    mutationFn: (id) => appClient.functions.invoke('managePromoMessagePackage', { action: 'delete', id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-packages'] }),
  });

  const togglePkgMutation = useMutation({
    mutationFn: async ({ id, is_active }) => { const res = await appClient.functions.invoke('managePromoMessagePackage', { action: 'save', id, is_active }); return res.data.item; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-packages'] }),
  });

  const updateRequestMutation = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.PromoMessageRequest.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['promo-requests'] }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (req) => {
      let content = `📢 ${req.message}`;
      if (req.link) content += `\n🔗 ${req.link_text || 'Learn more'}: ${req.link}`;
      await appClient.functions.invoke('manageChatMessage', {
        action: 'save',
        salon: req.salon,
        sender_identifier: req.sponsor_name,
        session_id: 'promo',
        content,
        is_admin: true,
      });
      await appClient.entities.PromoMessageRequest.update(req.id, { status: 'sent' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promo-requests'] });
      qc.invalidateQueries({ queryKey: ['chatMessages'] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        {[['requests', 'Requests'], ['packages', 'Packages']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${tab === key ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── PACKAGES TAB ── */}
      {tab === 'packages' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setAddingPkg(!addingPkg)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
            >
              <Plus size={15} /> Add Package
            </button>
          </div>

          {addingPkg && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <input
                placeholder="Package name (e.g. Basic Message)"
                value={pkgForm.name}
                onChange={e => setPkgForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
              />
              <input
                type="number"
                placeholder="Price ($)"
                value={pkgForm.price}
                onChange={e => setPkgForm(f => ({ ...f, price: e.target.value }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
              />
              <input
                placeholder="Description (optional)"
                value={pkgForm.description}
                onChange={e => setPkgForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => createPkgMutation.mutate({ ...pkgForm, price: parseFloat(pkgForm.price), is_active: true })}
                  disabled={!pkgForm.name || !pkgForm.price}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-white/90 disabled:opacity-40"
                >
                  <Check size={14} /> Save
                </button>
                <button onClick={() => setAddingPkg(false)} className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20">
                  <X size={14} /> Cancel
                </button>
              </div>
            </div>
          )}

          {packages.length === 0 && <p className="text-white text-sm text-center py-8">No packages yet.</p>}
          {packages.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex-1">
                <p className="text-white font-medium text-sm">{p.name}</p>
                {p.description && <p className="text-white text-xs mt-0.5">{p.description}</p>}
              </div>
              <span className="text-white font-bold">${p.price}</span>
              <button
                onClick={() => togglePkgMutation.mutate({ id: p.id, is_active: !p.is_active })}
                className={`px-2.5 py-1 text-xs rounded-full font-medium ${p.is_active ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white'}`}
              >
                {p.is_active ? 'Active' : 'Inactive'}
              </button>
              <button onClick={() => deletePkgMutation.mutate(p.id)} className="text-red-400/60 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 && <p className="text-white text-sm text-center py-8">No requests yet.</p>}
          {requests.map(req => (
            <div key={req.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium">{req.sponsor_name}</span>
                    <span className="text-white text-xs">{SALON_LABELS[req.salon]}</span>
                  </div>
                  <p className="text-white text-xs truncate">{req.message}</p>
                  <p className="text-white text-xs mt-0.5">
                    {req.package_name} · ${req.package_price} · {req.submitted_at ? format(new Date(req.submitted_at), 'MMM d, yyyy') : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[req.status] || 'text-white bg-white/5'}`}>
                    {req.status}
                  </span>
                  <button
                    onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    className="text-white hover:text-white"
                  >
                    <Eye size={15} />
                  </button>
                </div>
              </div>

              {expandedId === req.id && (
                <div className="border-t border-white/10 p-4 space-y-3">
                  <div className="space-y-1.5 text-xs text-white">
                    <p><span className="text-white">Email:</span> {req.sponsor_email}</p>
                    <p><span className="text-white">Salon:</span> {SALON_LABELS[req.salon]}</p>
                    {req.send_date && <p><span className="text-white">Requested send date:</span> {format(new Date(req.send_date), 'MMM d, yyyy HH:mm')}</p>}
                    <div className="bg-white/5 rounded-lg p-3 mt-2">
                      <p className="text-white text-sm">{req.message}</p>
                      {req.link && (
                        <a href={req.link} target="_blank" rel="noreferrer" className="text-red-500 text-xs mt-1 block hover:underline">
                          {req.link_text || req.link}
                        </a>
                      )}
                    </div>
                  </div>

                  <textarea
                    placeholder="Admin notes..."
                    value={adminNotes[req.id] ?? (req.admin_notes || '')}
                    onChange={e => setAdminNotes(n => ({ ...n, [req.id]: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20 focus:outline-none focus:border-white/20 resize-none"
                  />

                  <div className="flex gap-2 flex-wrap">
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => updateRequestMutation.mutate({ id: req.id, data: { status: 'approved', admin_notes: adminNotes[req.id] ?? req.admin_notes } })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-500 text-xs rounded-lg hover:bg-red-500/30"
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => updateRequestMutation.mutate({ id: req.id, data: { status: 'rejected', admin_notes: adminNotes[req.id] ?? req.admin_notes } })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30"
                        >
                          <X size={12} /> Reject
                        </button>
                      </>
                    )}
                    {(req.status === 'approved') && (
                      <button
                        onClick={() => sendMessageMutation.mutate(req)}
                        disabled={sendMessageMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-500 text-xs rounded-lg hover:bg-red-500/30 disabled:opacity-40"
                      >
                        <Send size={12} /> Send Now
                      </button>
                    )}
                    <button
                      onClick={() => updateRequestMutation.mutate({ id: req.id, data: { admin_notes: adminNotes[req.id] ?? req.admin_notes } })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg hover:bg-white/20"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}