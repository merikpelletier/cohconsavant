import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RotateCcw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useQuizSound } from '@/hooks/useQuizSound';

export default function PersonalityQuiz({ theme, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [traitScores, setTraitScores] = useState({});
  const [finished, setFinished] = useState(false);
  const { muted, toggleMute, playClick, startMusic, stopMusic } = useQuizSound();

  useEffect(() => {
    startMusic();
    return () => stopMusic();
  }, [startMusic, stopMusic]);

  useEffect(() => {
    if (finished) stopMusic();
  }, [finished, stopMusic]);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['personalityQuestions', theme.id],
    queryFn: async () => (await appClient.functions.invoke('managePersonalityQuestion', { action: 'listByTheme', theme_id: theme.id })).data.items,
  });

  const { data: results = [] } = useQuery({
    queryKey: ['personalityResults', theme.id],
    queryFn: async () => (await appClient.functions.invoke('managePersonalityResult', { action: 'listByTheme', theme_id: theme.id })).data.items,
  });

  const currentQuestion = questions[currentIndex];

  const handleChoose = (option) => {
    if (selectedOption) return;
    setSelectedOption(option);
    playClick();
    const traits = option === 'a' ? currentQuestion.option_a_traits : currentQuestion.option_b_traits;
    setTraitScores((prev) => {
      const next = { ...prev };
      Object.entries(traits || {}).forEach(([key, pts]) => {
        next[key] = (next[key] || 0) + (parseInt(pts) || 0);
      });
      return next;
    });
    setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= questions.length) {
        setFinished(true);
      } else {
        setCurrentIndex(nextIndex);
        setSelectedOption(null);
      }
    }, 600);
  };

  const restart = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setTraitScores({});
    setFinished(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white border-t-red-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 pb-20 text-center">
        <p className="text-white text-sm mb-6">Aucune question pour ce thème.</p>
        <Button onClick={onBack} variant="outline" className="border-white/10 text-white">Retour aux thèmes</Button>
      </div>
    );
  }

  if (finished) {
    const sortedTraits = Object.entries(traitScores).sort((a, b) => b[1] - a[1]);
    const winningTrait = sortedTraits[0]?.[0];
    const result = results.find((r) => r.trait_key === winningTrait) || results[0];

    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md w-full"
        >
          {result?.cover_image && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="aspect-square rounded-2xl overflow-hidden mb-6 border border-white/10"
            >
              <img src={result.cover_image} alt={result.title} className="w-full h-full object-cover" />
            </motion.div>
          )}
          <Sparkles className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-white text-3xl font-extralight tracking-wide mb-3">
            {result?.title || 'Résultat'}
          </h2>
          {result?.description && (
            <p className="text-white text-sm leading-relaxed mb-8 whitespace-pre-line">{result.description}</p>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={restart} className="bg-white text-black hover:bg-white/90 font-light tracking-widest px-6">
              <RotateCcw size={18} className="mr-2" /> REJOUER
            </Button>
            <Button onClick={onBack} variant="outline" className="border-white/10 text-white font-light tracking-widest px-6">
              AUTRES QUIZ
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6 pb-20">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-white text-sm hover:text-red-500 transition-colors">
            <ArrowLeft size={18} /> Thèmes
          </button>
          <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors" aria-label="Activer/couper le son">
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        <div className="flex justify-between items-center mb-8">
          <div className="text-white text-sm">
            Question {currentIndex + 1} sur {questions.length}
          </div>
          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-red-600"
              animate={{ width: `${((currentIndex) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
          >
            <h2 className="text-white text-2xl font-light mb-8 leading-relaxed text-center">
              {currentQuestion.question}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.button
                onClick={() => handleChoose('a')}
                disabled={selectedOption !== null}
                whileHover={!selectedOption ? { scale: 1.03 } : {}}
                whileTap={!selectedOption ? { scale: 0.97 } : {}}
                className={`p-6 border-2 rounded-xl text-center transition-all min-h-[140px] flex flex-col items-center justify-center ${
                  selectedOption === 'a'
                    ? 'bg-red-600 border-red-500 text-white'
                    : selectedOption === 'b'
                    ? 'bg-neutral-900 border-white/5 text-white/30'
                    : 'bg-neutral-900 border-white/10 text-white hover:border-red-500/50'
                }`}
              >
                <span className="text-red-500 text-xs font-bold uppercase tracking-widest mb-2">A</span>
                <span className="text-white text-lg font-light leading-snug">{currentQuestion.option_a_text}</span>
              </motion.button>

              <motion.button
                onClick={() => handleChoose('b')}
                disabled={selectedOption !== null}
                whileHover={!selectedOption ? { scale: 1.03 } : {}}
                whileTap={!selectedOption ? { scale: 0.97 } : {}}
                className={`p-6 border-2 rounded-xl text-center transition-all min-h-[140px] flex flex-col items-center justify-center ${
                  selectedOption === 'b'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : selectedOption === 'a'
                    ? 'bg-neutral-900 border-white/5 text-white/30'
                    : 'bg-neutral-900 border-white/10 text-white hover:border-blue-500/50'
                }`}
              >
                <span className="text-blue-500 text-xs font-bold uppercase tracking-widest mb-2">B</span>
                <span className="text-white text-lg font-light leading-snug">{currentQuestion.option_b_text}</span>
              </motion.button>
            </div>

            <p className="text-center text-white/40 text-xs mt-6">Ceci ou cela — il n'y a pas de bonne ou mauvaise réponse</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}