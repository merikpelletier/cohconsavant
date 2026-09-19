import React, { useState, useRef, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Coins } from 'lucide-react';
import { motion } from 'framer-motion';

import AIStartingPrice from './AIStartingPrice';

export default function FakeMemberChat({ memberName, persona }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const scrollRef = useRef(null);

  const { data: balanceData, refetch } = useQuery({
    queryKey: ['userTokenBalance'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getUserBalance', {});
      return res.data;
    },
  });

  const balance = balanceData?.balance ?? 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMutation = useMutation({
    mutationFn: async (messageText) => {
      const res = await appClient.functions.invoke('sendMemberContact', {
        memberName,
        persona,
        message: messageText,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content }))
      });
      return res.data;
    },
    onMutate: (messageText) => {
      setMessages(prev => [...prev, { role: 'user', content: messageText }]);
      setInput('');
      setIsTyping(true);
      setErrorMsg('');
    },
    onSuccess: (data) => {
      setIsTyping(false);
      if (data?.reply) {
        setMessages(prev => [...prev, { role: 'member', content: data.reply }]);
      }
      refetch();
    },
    onError: (err) => {
      setIsTyping(false);
      const data = err?.response?.data || err;
      if (data?.balance !== undefined && data?.required !== undefined) {
        setErrorMsg(`Solde insuffisant. Il faut ${data.required} tokens, vous en avez ${data.balance}.`);
      } else {
        setErrorMsg(data?.message || data?.error || 'Erreur lors de l\'envoi du message.');
      }
      refetch();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !sendMutation.isPending) {
      sendMutation.mutate(input.trim());
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-black rounded-lg p-4"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-black text-2xl font-semibold">Contact</h3>
        <div className="flex items-center gap-1.5 bg-black/5 px-3 py-1 rounded-full">
          <Coins size={14} className="text-amber-600" />
          <span className="text-black text-sm font-medium">{balance} tokens</span>
        </div>
      </div>
      <p className="text-black/60 text-sm mb-4">Conversation avec {memberName} · <AIStartingPrice toolId="fake_member_chat"/></p>

      <div ref={scrollRef} className="space-y-3 mb-4 max-h-80 overflow-y-auto">
        {messages.length === 0 && !errorMsg && (
          <p className="text-black/40 text-sm text-center py-8">
            Envoyez un message pour démarrer la conversation
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-red-600 text-white'
                : 'bg-black/10 text-black'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-black/10 px-4 py-3 rounded-2xl">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-black/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="text-red-600 text-sm mb-2 text-center">{errorMsg}</p>
      )}

      <form onSubmit={handleSubmit} className="flex w-full min-w-0 gap-2">
        <input
          type="text"
          placeholder="Votre message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-w-0 flex-1 bg-red-50 border-2 border-black/20 rounded-xl px-4 py-3 text-black placeholder:text-black/40 focus:outline-none focus:border-black"
          disabled={sendMutation.isPending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sendMutation.isPending}
          className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </motion.div>
  );
}
