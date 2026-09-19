import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import TriviaQuiz from '@/components/quiz/TriviaQuiz';
import PersonalityQuiz from '@/components/quiz/PersonalityQuiz';

export default function Quiz() {
  const [selectedTheme, setSelectedTheme] = useState(null);

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['quizThemesActive'],
    queryFn: async () => (await appClient.functions.invoke('manageQuizTheme', { action: 'listActive' })).data.items,
  });

  if (selectedTheme) {
    return selectedTheme.quiz_type === 'personality'
      ? <PersonalityQuiz theme={selectedTheme} onBack={() => setSelectedTheme(null)} />
      : <TriviaQuiz theme={selectedTheme} onBack={() => setSelectedTheme(null)} />;
  }

  return (
    <div className="min-h-screen bg-black p-6 pb-20">
      <div className="max-w-2xl mx-auto pt-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-white text-4xl font-extralight tracking-widest mb-2 text-center"
        >
          QUIZ
        </motion.h1>
        <p className="text-white text-sm mb-10 text-center">Choisissez un thème</p>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-white border-t-red-600 rounded-full animate-spin" />
          </div>
        ) : themes.length === 0 ? (
          <p className="text-white text-sm text-center py-16">Aucun thème disponible pour le moment.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {themes.map((theme, idx) => (
              <motion.button
                key={theme.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedTheme(theme)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 group"
              >
                {theme.cover_image ? (
                  <img src={theme.cover_image} alt={theme.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-red-950/40" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded mb-2 ${theme.quiz_type === 'personality' ? 'bg-red-600 text-white' : 'bg-white text-black'}`}>
                    {theme.quiz_type === 'personality' ? 'CECI OU CELA' : 'TRIVIA'}
                  </span>
                  <h3 className="text-white text-lg font-light leading-tight">{theme.name}</h3>
                  {theme.description && <p className="text-white/60 text-xs mt-1 line-clamp-2">{theme.description}</p>}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}