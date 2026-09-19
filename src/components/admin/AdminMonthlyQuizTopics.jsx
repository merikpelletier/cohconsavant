import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Sparkles, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function AdminMonthlyQuizTopics() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('trivia');
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [genError, setGenError] = useState(null);
  const [schemaReady, setSchemaReady] = useState(null);
  const [schemaError, setSchemaError] = useState(null);

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['monthlyQuizTopics'],
    queryFn: async () => (await appClient.functions.invoke('manageMonthlyQuizTopic', { action: 'list' })).data.items,
    retry: 2,
  });

  const addMutation = useMutation({
    mutationFn: async (data) => (await appClient.functions.invoke('manageMonthlyQuizTopic', { action: 'save', ...data })).data.item,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyQuizTopics'] });
      setNewLabel('');
      toast({ title: "Sujet ajouté", description: "Le sujet a été enregistré." });
    },
    onError: (error) => {
      const msg = error?.response?.data?.error || error?.message || "Erreur inconnue";
      toast({ variant: "destructive", title: "Ajout impossible", description: msg });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => appClient.functions.invoke('manageMonthlyQuizTopic', { action: 'delete', id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monthlyQuizTopics'] }),
  });

  const initSchema = async () => {
    setSchemaError(null);
    setSchemaReady(null);
    try {
      const res = await appClient.functions.invoke('initMonthlyQuizSchema');
      if (res.data?.error) {
        setSchemaError(res.data.error);
      } else {
        setSchemaReady(true);
        queryClient.invalidateQueries({ queryKey: ['monthlyQuizTopics'] });
      }
    } catch (e) {
      setSchemaError(e.message || 'Erreur');
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    addMutation.mutate({ label: newLabel.trim(), quiz_type: newType, used: false });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenResult(null);
    setGenError(null);
    try {
      const res = await appClient.functions.invoke('generateMonthlyQuiz');
      if (res.data?.error) {
        setGenError(res.data.error);
      } else {
        setGenResult(res.data);
        queryClient.invalidateQueries({ queryKey: ['monthlyQuizTopics'] });
        queryClient.invalidateQueries({ queryKey: ['adminQuizThemes'] });
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Erreur';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const unusedCount = topics.filter(t => !t.used).length;

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-white/10 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-light text-white mb-1">Génération automatique mensuelle</h2>
            <p className="text-white text-sm leading-relaxed">
              Un nouveau quiz est généré automatiquement le 1<sup>er</sup> de chaque mois à 9h (Toronto),
              à partir du prochain sujet inutilisé de cette liste. L'IA Replicate crée 10 questions
              + une image de couverture, sur la culture gay. Quand tous les sujets sont utilisés,
              le cycle recommence.
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating || topics.length === 0}
            className="bg-white text-black hover:bg-white/90 whitespace-nowrap"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin mr-2" />
                Génération…
              </>
            ) : (
              <>
                <Sparkles size={16} className="mr-2" />
                Générer maintenant
              </>
            )}
          </Button>
        </div>

        {genResult && (
          <div className="mt-4 flex items-start gap-2 bg-green-950/40 border border-green-700/40 rounded-md p-3">
            <CheckCircle2 size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-white">
              <p className="font-medium">Quiz créé : {genResult.theme_name}</p>
              <p className="text-white">{genResult.quiz_type} · {genResult.questions} questions · sujet « {genResult.topic_label} »</p>
              {genResult.cover_image && (
                <img src={genResult.cover_image} alt="couverture" className="mt-2 rounded max-h-32 object-cover" />
              )}
            </div>
          </div>
        )}
        {genError && (
          <div className="mt-4 flex items-start gap-2 bg-red-950/40 border border-red-700/40 rounded-md p-3">
            <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-white">{genError}</p>
          </div>
        )}
      </div>

      {schemaError && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-700/40 rounded-md p-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-white">
            <p>La table des sujets n'existe pas encore. Initialisez-la une fois :</p>
            <Button onClick={initSchema} size="sm" className="mt-2 bg-white text-black hover:bg-white/90">
              <Database size={14} className="mr-2" /> Initialiser la table
            </Button>
            <p className="text-white text-xs mt-1">{schemaError}</p>
          </div>
        </div>
      )}
      {schemaReady && (
        <div className="flex items-center gap-2 bg-green-950/40 border border-green-700/40 rounded-md p-3">
          <CheckCircle2 size={18} className="text-green-500" />
          <p className="text-sm text-white">Table initialisée. Ajoutez vos sujets ci-dessous.</p>
        </div>
      )}

      <form onSubmit={handleAdd} className="bg-neutral-900 border border-white/10 rounded-lg p-4">
        <h3 className="text-white font-light mb-3">Ajouter un sujet</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Sujet du quiz (ex: Cinéma gay des années 90)"
            className="bg-black border-white/10 text-white flex-1"
            required
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="bg-black border-white/10 text-white rounded-md px-3 py-2 text-sm sm:w-40"
          >
            <option value="trivia">Trivia</option>
            <option value="personality">Personnalité</option>
          </select>
          <Button type="submit" disabled={addMutation.isPending} className="bg-white text-black hover:bg-white/90">
            <Plus size={16} className="mr-2" />
            Ajouter
          </Button>
        </div>
      </form>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-light">Sujets ({topics.length})</h3>
          <span className="text-white text-sm">{unusedCount} non utilisés</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : topics.length === 0 ? (
          <p className="text-white text-sm py-8 text-center">Aucun sujet. Ajoutez-en ci-dessus pour démarrer.</p>
        ) : (
          <div className="space-y-2">
            {topics.map((t, i) => (
              <div
                key={t.id}
                className="bg-neutral-900 border border-white/10 rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-white text-xs w-6 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{t.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white">
                        {t.quiz_type === 'personality' ? 'Personnalité' : 'Trivia'}
                      </span>
                      {t.used ? (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Utilisé
                        </span>
                      ) : (
                        <span className="text-xs text-white">À faire</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteMutation.mutate(t.id)}
                  className="border-red-500/30 text-red-500 hover:bg-red-500/10 flex-shrink-0"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}