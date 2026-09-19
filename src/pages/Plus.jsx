import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Shield, 
  BookOpen, 
  Mail, 
  ChevronRight,
  Check,
  Lock,
  ChevronDown,
  User
} from 'lucide-react';

export default function Plus() {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [expandedContent, setExpandedContent] = useState(null);

  const { data: contents = [] } = useQuery({
    queryKey: ['editable-contents'],
    queryFn: async () => (await appClient.functions.invoke('manageEditableContent', { action: 'list' })).data.items,
  });

  const { data: appLabels = [] } = useQuery({
    queryKey: ['appLabels'],
    queryFn: async () => { const res = await appClient.functions.invoke('manageAppLabel', { action: 'list' }); return res.data.items; },
  });

  const labelsMap = {};
  appLabels.forEach(l => { labelsMap[l.key] = l.value; });
  const L = (key, fallback) => labelsMap[key] ?? fallback;

  const submitContactMutation = useMutation({
    mutationFn: (data) => appClient.functions.invoke('sendContactMessage', data),
    onSuccess: () => {
      setSubmitted(true);
      setContactForm({ message: '' });
      setTimeout(() => {
        setShowContactForm(false);
        setSubmitted(false);
      }, 2000);
    }
  });

  const handleSubmitContact = () => {
    if (!contactForm.message.trim()) return;
    submitContactMutation.mutate(contactForm);
  };

  return (
    <div className="min-h-screen bg-black pb-20 pt-8">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-2xl mx-auto border border-white/10 rounded-sm p-6">
        {/* PLUS Section */}
        <div className="mb-10">
          <h1 className="text-white text-lg font-semibold tracking-widest uppercase">{L('plus_title', 'PLUS')}</h1>
          <div className="w-10 h-1 bg-red-600 mt-2 mb-6" />

          {/* Admin Login */}
          <Link
            to={createPageUrl('Admin')}
            className="flex items-center justify-between p-3.5 bg-neutral-950 rounded-sm group hover:bg-neutral-800 transition-colors mb-3"
          >
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-white" />
              <span className="text-white text-sm font-medium tracking-wide">{L('plus_admin_label', 'Admin')}</span>
            </div>
            <ChevronRight size={16} className="text-white" />
          </Link>

          {/* Content Accordion Items */}
          <div className="space-y-2.5">
            {contents.map((content) => (
              <div key={content.id}>
                <button
                  onClick={() => setExpandedContent(expandedContent === content.key ? null : content.key)}
                  className="w-full flex items-center justify-between p-3.5 bg-neutral-950 rounded-sm hover:bg-neutral-800 transition-colors"
                >
                  <span className="text-white text-sm font-medium tracking-wide text-left">{content.title}</span>
                  <ChevronDown
                    size={16}
                    className={`text-white transition-transform shrink-0 ml-2 ${expandedContent === content.key ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedContent === content.key && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-neutral-950 border-t border-white/10 rounded-b-sm p-4"
                  >
                    <div
                      className="text-white font-light leading-relaxed text-sm prose-content"
                      dangerouslySetInnerHTML={{ __html: content.content }}
                    />
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ÉCRIVEZ-NOUS Section */}
        <div>
          <h2 className="text-white text-lg font-semibold tracking-widest uppercase">{L('plus_contact_section', 'ÉCRIVEZ-NOUS')}</h2>
          <div className="w-10 h-1 bg-red-600 mt-2 mb-6" />

          {!showContactForm ? (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowContactForm(true)}
              className="w-full flex items-center justify-between p-3.5 bg-neutral-950 rounded-sm hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-white" />
                <span className="text-white text-sm font-medium tracking-wide">{L('plus_contact_button', 'Nous contacter')}</span>
              </div>
              <ChevronRight size={16} className="text-white" />
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-neutral-950 rounded-sm p-4"
            >
              {submitted ? (
                <div className="flex flex-col items-center py-8">
                  <Check size={40} className="text-red-500 mb-3" />
                  <p className="text-white font-light">Message envoyé</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Votre message..."
                    className="bg-neutral-800 border border-white/20 text-white placeholder:text-white/40 resize-none rounded-sm"
                    rows={4}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowContactForm(false)}
                      className="flex-1 bg-neutral-700 text-white hover:bg-neutral-600 py-2 rounded-sm transition-colors text-sm font-medium tracking-wide"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleSubmitContact}
                      disabled={!contactForm.message.trim() || submitContactMutation.isPending}
                      style={{ color: '#ffffff', backgroundColor: '#dc2626' }}
                      className="flex-1 py-2 rounded-sm transition-colors text-sm font-medium tracking-wide hover:brightness-110"
                    >
                      Envoyer
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Philosophy */}
      <div className="px-6 mt-12 w-full max-w-md md:max-w-lg lg:max-w-2xl mx-auto">
        <div className="border-t border-white/10 pt-6">
          <p className="text-white/50 text-xs leading-relaxed text-center font-light">
            {L('plus_footer', 'Le Cochon Savant est un espace temporaire, un espace adulte sans filtre, un projet éditorial vivant, sans mémoire, sans algorithme, sans compétition sociale.')}
          </p>
        </div>
      </div>
    </div>
  );
}
