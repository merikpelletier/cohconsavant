import React, { useState, useEffect, useRef } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Clock, X, Trophy, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useQuizSound } from '@/hooks/useQuizSound';

export default function TriviaQuiz({ theme, onBack }) {
  const [gameState, setGameState] = useState('start');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [shuffledAnswers, setShuffledAnswers] = useState([]);
  const [errors, setErrors] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const { muted, toggleMute, playCorrect, playWrong, startMusic, stopMusic } = useQuizSound();
  const errorsRef = useRef(0);
  const advanceRef = useRef(null);
  useEffect(() => { errorsRef.current = errors; }, [errors]);

  const clearAdvance = () => {
    if (advanceRef.current) { clearTimeout(advanceRef.current); advanceRef.current = null; }
  };
  useEffect(() => () => clearAdvance(), []);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['quizQuestions', theme?.id],
    queryFn: async () => (await appClient.functions.invoke('manageQuizQuestion', { action: 'listActiveByTheme', theme_id: theme.id })).data.items,
    enabled: !!theme?.id,
  });

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const startGame = () => {
    clearAdvance();
    const shuffled = shuffleArray(questions);
    setShuffledQuestions(shuffled);
    setCurrentQuestionIndex(0);
    setErrors(0);
    setScore(0);
    setGameState('playing');
    loadQuestion(shuffled[0]);
    startMusic();
  };

  useEffect(() => {
    if (gameState === 'finished') stopMusic();
  }, [gameState, stopMusic]);

  const loadQuestion = (question) => {
    if (!question) return;
    const allAnswers = [...question.correct_answers, ...question.wrong_answers];
    setShuffledAnswers(shuffleArray(allAnswers));
    setTimeLeft(question.time_limit || 30);
    setSelectedAnswer(null);
  };

  // Minuteur : pause pendant l'affichage du résultat (selectedAnswer non null)
  useEffect(() => {
    if (gameState !== 'playing' || selectedAnswer !== null || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [gameState, timeLeft, selectedAnswer]);

  // Timeout : temps écoulé sans réponse
  useEffect(() => {
    if (gameState !== 'playing' || selectedAnswer !== null || timeLeft !== 0) return;
    const newErrors = errorsRef.current + 1;
    setErrors(newErrors);
    playWrong();
    advanceRef.current = setTimeout(() => {
      if (newErrors >= 5) setGameState('finished');
      else nextQuestion();
    }, 1000);
  }, [gameState, timeLeft, selectedAnswer]);

  const handleAnswer = (answer) => {
    if (selectedAnswer) return;
    setSelectedAnswer(answer);
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    const isCorrect = currentQuestion.correct_answers.includes(answer);
    if (isCorrect) { setScore((prev) => prev + 1); playCorrect(); }
    else { setErrors((prev) => prev + 1); playWrong(); }
    const newErrors = isCorrect ? errorsRef.current : errorsRef.current + 1;
    advanceRef.current = setTimeout(() => {
      if (!isCorrect && newErrors >= 5) setGameState('finished');
      else nextQuestion();
    }, 1500);
  };

  const nextQuestion = () => {
    clearAdvance();
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex >= shuffledQuestions.length) { setGameState('finished'); }
    else { setCurrentQuestionIndex(nextIndex); loadQuestion(shuffledQuestions[nextIndex]); }
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
        <p className="text-white text-sm mb-6">Aucune question disponible pour ce thème.</p>
        <Button onClick={onBack} variant="outline" className="border-white/10 text-white">Retour aux thèmes</Button>
      </div>
    );
  }

  if (gameState === 'start') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
          <button onClick={onBack} className="flex items-center gap-2 text-white text-sm mb-8 hover:text-red-500 transition-colors mx-auto">
            <ArrowLeft size={18} /> Thèmes
          </button>
          {theme?.cover_image && (
            <div className="aspect-video rounded-xl overflow-hidden mb-6 border border-white/10">
              <img src={theme.cover_image} alt={theme.name} className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-white text-3xl font-extralight tracking-widest mb-3">{theme?.name || 'QUIZ'}</h1>
          <p className="text-white text-sm mb-8">
            Testez vos connaissances<br />Maximum 5 erreurs permises
          </p>
          <Button onClick={startGame} className="bg-white text-black hover:bg-white/90 font-light tracking-widest px-8 py-6 text-lg">
            DÉMARRER
          </Button>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'finished') {
    const percentage = Math.round((score / shuffledQuestions.length) * 100);
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 pb-20">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <Trophy className="w-16 h-16 text-white mx-auto mb-6" />
          <h2 className="text-white text-3xl font-extralight tracking-widest mb-4">TERMINÉ</h2>
          <div className="mb-8">
            <p className="text-white text-5xl font-light mb-2">{score}</p>
            <p className="text-white text-sm">sur {shuffledQuestions.length} questions</p>
            <p className="text-white text-lg mt-2">{percentage}%</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Button onClick={startGame} className="bg-white text-black hover:bg-white/90 font-light tracking-widest px-6">
              <RotateCcw size={18} className="mr-2" /> REJOUER
            </Button>
            <Button onClick={onBack} variant="outline" className="border-white/10 text-white font-light tracking-widest px-6">AUTRES QUIZ</Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-black p-6 pb-20">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="text-white text-sm">Question {currentQuestionIndex + 1} sur {shuffledQuestions.length}</div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <X key={i} size={20} className={i < errors ? 'text-red-600' : 'text-white/10'} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleMute} className="text-white/70 hover:text-white transition-colors" aria-label="Activer/couper le son">
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <Clock size={18} className="text-white" />
            <span className={`text-white font-light text-lg ${timeLeft <= 5 ? 'text-red-500' : ''}`}>{timeLeft}s</span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentQuestionIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 className="text-white text-2xl font-light mb-8 leading-relaxed">{currentQuestion.question}</h2>
            <div className="space-y-3">
              {shuffledAnswers.map((answer, index) => {
                const isSelected = selectedAnswer === answer;
                const isCorrect = currentQuestion.correct_answers.includes(answer);
                const showResult = selectedAnswer !== null;
                return (
                  <motion.button
                    key={index}
                    onClick={() => handleAnswer(answer)}
                    disabled={selectedAnswer !== null}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                      showResult && isSelected && isCorrect ? 'bg-green-600 border-green-400 text-white'
                      : showResult && isSelected && !isCorrect ? 'bg-red-600 border-red-400 text-white'
                      : isSelected ? 'bg-white/10 border-white text-white'
                      : 'bg-neutral-900 border-white/10 text-white/90 hover:bg-white/5'
                    } disabled:cursor-not-allowed`}
                    whileHover={!selectedAnswer ? { scale: 1.02 } : {}}
                    whileTap={!selectedAnswer ? { scale: 0.98 } : {}}
                  >
                    {answer}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 text-center">
          <span className="text-white text-sm">Score : </span>
          <span className="text-white font-light text-lg">{score}</span>
        </div>
      </div>
    </div>
  );
}