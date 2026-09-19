import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const INP = "w-full bg-neutral-900 border border-white/20 text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-white/40";
const SALONS = [{ v: 'cochon', l: 'Cochon' }, { v: 'contact', l: 'Contact' }, { v: 'commercial', l: 'Commercial' }];

export default function FakeMemberMessages({ member, allFakes }) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState('post');

  const tabs = [
    { k: 'post', l: 'Commentaires posts' },
    { k: 'chat', l: 'Chat public' },
    { k: 'pm', l: 'Messages privés' },
  ];

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(s => (
          <button key={s.k} onClick={() => setSection(s.k)} className={`px-3 py-1.5 text-xs rounded-sm ${section === s.k ? 'bg-white text-black' : 'text-white border border-white/20'}`}>
            {s.l}
          </button>
        ))}
      </div>
      {section === 'post' && <PostComments member={member} qc={queryClient} />}
      {section === 'chat' && <ChatMessages member={member} qc={queryClient} />}
      {section === 'pm' && <PrivateMessages member={member} allFakes={allFakes} qc={queryClient} />}
    </div>
  );
}

function PostComments({ member, qc }) {
  const [postId, setPostId] = useState('');
  const [text, setText] = useState('');

  const { data: posts = [] } = useQuery({
    queryKey: ['allPostsFake'],
    queryFn: async () => (await appClient.functions.invoke('manageMemberPost', { action: 'list' })).data.items,
  });
  const { data: myComments = [] } = useQuery({
    queryKey: ['fakePostComments', member.user_email],
    queryFn: async () => (await appClient.functions.invoke('managePostComment', { action: 'filter', filters: { author_email: member.user_email } })).data.items,
  });

  const send = async () => {
    if (!postId || !text.trim()) { alert('Choisissez un post et écrivez un commentaire'); return; }
    await appClient.functions.invoke('managePostComment', { action: 'save', post_id: postId, author_email: member.user_email, author_name: member.display_name, content: text });
    setText('');
    qc.invalidateQueries({ queryKey: ['fakePostComments', member.user_email] });
  };

  return (
    <div className="space-y-3">
      <select value={postId} onChange={e => setPostId(e.target.value)} className={INP}>
        <option value="">— Choisir un post —</option>
        {posts.map(p => <option key={p.id} value={p.id}>{p.title} ({p.member_name})</option>)}
      </select>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Commentaire..." className={INP} />
      <button onClick={send} className="bg-white text-black px-4 py-1.5 text-xs rounded-sm">Publier le commentaire</button>
      <div className="pt-2">
        <p className="text-white/40 text-xs mb-1">Commentaires de {member.display_name} :</p>
        {myComments.length === 0 ? <p className="text-white/30 text-xs">Aucun.</p> : myComments.map(c => (
          <div key={c.id} className="text-xs text-white/70 border-b border-white/5 py-1">{c.content}</div>
        ))}
      </div>
    </div>
  );
}

function ChatMessages({ member, qc }) {
  const [salon, setSalon] = useState('cochon');
  const [text, setText] = useState('');
  const sessionId = `fake_${member.id}`;

  const { data: myMsgs = [] } = useQuery({
    queryKey: ['fakeChat', member.user_email, salon],
    queryFn: async () => (await appClient.functions.invoke('manageChatMessage', { action: 'filter', filters: { salon, session_id: sessionId }, sort: 'created_date', limit: 200 })).data.items,
  });

  const send = async () => {
    if (!text.trim()) return;
    await appClient.functions.invoke('manageChatMessage', { action: 'save', salon, sender_identifier: member.display_name, content: text, session_id: sessionId, is_admin: false });
    setText('');
    qc.invalidateQueries({ queryKey: ['fakeChat', member.user_email, salon] });
  };

  return (
    <div className="space-y-3">
      <select value={salon} onChange={e => setSalon(e.target.value)} className={INP}>
        {SALONS.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
      </select>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Message public..." className={INP} />
      <button onClick={send} className="bg-white text-black px-4 py-1.5 text-xs rounded-sm">Envoyer dans le salon</button>
      <p className="text-white/40 text-xs">Note : les messages publics sont éphémères (24h).</p>
      <div className="pt-1">
        {myMsgs.map(m => <div key={m.id} className="text-xs text-white/70 border-b border-white/5 py-1">{m.content}</div>)}
      </div>
    </div>
  );
}

function PrivateMessages({ member, allFakes, qc }) {
  const others = allFakes.filter(m => m.id !== member.id);
  const [toId, setToId] = useState(others[0]?.id || '');
  const [text, setText] = useState('');
  const sessionId = `fake_${member.id}`;

  const { data: conv = [] } = useQuery({
    queryKey: ['fakePM', member.user_email],
    queryFn: async () => {
      const sent = (await appClient.functions.invoke('managePrivateMessage', { action: 'filter', filters: { from_session_id: sessionId } })).data.items;
      const received = (await appClient.functions.invoke('managePrivateMessage', { action: 'filter', filters: { to_session_id: sessionId } })).data.items;
      return [...sent, ...received];
    },
  });

  const send = async () => {
    const to = allFakes.find(m => m.id === toId);
    if (!to || !text.trim()) { alert('Choisissez un destinataire et écrivez un message'); return; }
    await appClient.functions.invoke('managePrivateMessage', {
      action: 'save',
      from_identifier: member.display_name,
      to_identifier: to.display_name,
      from_session_id: sessionId,
      to_session_id: `fake_${to.id}`,
      content: text,
      from_is_member: true,
      to_is_member: true,
    });
    setText('');
    qc.invalidateQueries({ queryKey: ['fakePM', member.user_email] });
  };

  return (
    <div className="space-y-3">
      <select value={toId} onChange={e => setToId(e.target.value)} className={INP}>
        <option value="">— Destinataire —</option>
        {others.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
      </select>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Message privé..." className={INP} />
      <button onClick={send} className="bg-white text-black px-4 py-1.5 text-xs rounded-sm">Envoyer</button>
      <div className="pt-1">
        {conv.map(m => (
          <div key={m.id} className="text-xs text-white/70 border-b border-white/5 py-1">
            <span className="text-white/40">{m.from_identifier === member.display_name ? '→ ' + m.to_identifier : '← ' + m.from_identifier}: </span>
            {m.content}
          </div>
        ))}
      </div>
    </div>
  );
}