import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, X, ChevronRight } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminPersonalityQuiz() {
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const queryClient = useQueryClient();

  const { data: themes = [] } = useQuery({
    queryKey: ['adminQuizThemes'],
    queryFn: async () => (await appClient.functions.invoke('manageQuizTheme', { action: 'list' })).data.items,
  });

  const personalityThemes = themes.filter((t) => t.quiz_type === 'personality');

  useEffect(() => {
    if (!selectedThemeId && personalityThemes.length > 0) {
      setSelectedThemeId(personalityThemes[0].id);
    }
  }, [personalityThemes, selectedThemeId]);

  const selectedTheme = personalityThemes.find((t) => t.id === selectedThemeId);

  if (personalityThemes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-white text-sm mb-2">Aucun thème de type « Personnalité » pour le moment.</p>
        <p className="text-white text-xs">Créez un thème dans l'onglet Thèmes en sélectionnant le type « Personnalité ».</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
        {personalityThemes.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedThemeId(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap text-sm ${
              selectedThemeId === t.id ? 'bg-white text-black' : 'bg-neutral-900 text-white border border-white/10'
            }`}
          >
            {t.cover_image && <img src={t.cover_image} alt="" className="w-5 h-5 rounded object-cover" />}
            {t.name}
          </button>
        ))}
      </div>

      {selectedTheme && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuestionsSection themeId={selectedTheme.id} />
          <ResultsSection themeId={selectedTheme.id} />
        </div>
      )}
    </div>
  );
}

function QuestionsSection({ themeId }) {
  const [editing, setEditing] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['adminPersonalityQuestions', themeId],
    queryFn: async () => (await appClient.functions.invoke('managePersonalityQuestion', { action: 'listAllByTheme', theme_id: themeId })).data.items,
  });

  const knownTraits = React.useMemo(() => {
    const set = new Set();
    questions.forEach((q) => {
      Object.keys(q.option_a_traits || {}).forEach((k) => k.trim() && set.add(k.trim()));
      Object.keys(q.option_b_traits || {}).forEach((k) => k.trim() && set.add(k.trim()));
    });
    return Array.from(set).sort();
  }, [questions]);

  const saveMutation = useMutation({
    mutationFn: async (data) => (await appClient.functions.invoke('managePersonalityQuestion', { action: 'save', ...data })).data.item,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPersonalityQuestions', themeId] });
      queryClient.invalidateQueries({ queryKey: ['personalityQuestions', themeId] });
      setIsOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => appClient.functions.invoke('managePersonalityQuestion', { action: 'delete', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPersonalityQuestions', themeId] });
      queryClient.invalidateQueries({ queryKey: ['personalityQuestions', themeId] });
    },
  });

  const openDialog = (q = null) => {
    setEditing(q || { theme_id: themeId, question: '', option_a_text: '', option_a_traits: {}, option_b_text: '', option_b_traits: {}, order: 0, is_active: true });
    setIsOpen(true);
  };

  return (
    <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-light text-lg">Questions</h3>
        <Button size="sm" onClick={() => openDialog()} className="bg-white text-black hover:bg-white/90">
          <Plus size={16} className="mr-1" /> Question
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-white border-t-red-600 rounded-full animate-spin" /></div>
      ) : questions.length === 0 ? (
        <p className="text-white text-xs text-center py-6">Aucune question.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <div key={q.id} className="bg-black/40 border border-white/5 rounded-md p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium mb-1">{q.question}</p>
                  <p className="text-white text-xs">
                    <span className="text-red-400">A:</span> {q.option_a_text} <span className="text-white/40">·</span> <span className="text-blue-400">B:</span> {q.option_b_text}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openDialog(q)} className="border-white/10 text-white h-7 w-7 p-0">
                    <Pencil size={12} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(q.id)} className="border-red-500/30 text-red-500 h-7 w-7 p-0">
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PersonalityQuestionDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        question={editing}
        onSave={(data) => saveMutation.mutate(data)}
        isSaving={saveMutation.isPending}
        knownTraits={knownTraits}
      />
    </div>
  );
}

function ResultsSection({ themeId }) {
  const [editing, setEditing] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['adminPersonalityResults', themeId],
    queryFn: async () => (await appClient.functions.invoke('managePersonalityResult', { action: 'listByTheme', theme_id: themeId })).data.items,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => (await appClient.functions.invoke('managePersonalityResult', { action: 'save', ...data })).data.item,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPersonalityResults', themeId] });
      queryClient.invalidateQueries({ queryKey: ['personalityResults', themeId] });
      setIsOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => appClient.functions.invoke('managePersonalityResult', { action: 'delete', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPersonalityResults', themeId] });
      queryClient.invalidateQueries({ queryKey: ['personalityResults', themeId] });
    },
  });

  const openDialog = (r = null) => {
    setEditing(r || { theme_id: themeId, trait_key: '', title: '', description: '', cover_image: '', order: 0 });
    setIsOpen(true);
  };

  return (
    <div className="bg-neutral-900/50 border border-white/10 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-light text-lg">Résultats</h3>
        <Button size="sm" onClick={() => openDialog()} className="bg-white text-black hover:bg-white/90">
          <Plus size={16} className="mr-1" /> Résultat
        </Button>
      </div>
      <p className="text-white/50 text-xs mb-3 -mt-2">Chaque résultat correspond à un trait. Le trait avec le score le plus élevé détermine le résultat affiché.</p>

      {isLoading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-white border-t-red-600 rounded-full animate-spin" /></div>
      ) : results.length === 0 ? (
        <p className="text-white text-xs text-center py-6">Aucun résultat.</p>
      ) : (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.id} className="bg-black/40 border border-white/5 rounded-md p-3 flex gap-3">
              {r.cover_image && <img src={r.cover_image} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{r.title}</p>
                <p className="text-red-400 text-xs">Trait: {r.trait_key}</p>
                {r.description && <p className="text-white text-xs mt-1 line-clamp-2">{r.description}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => openDialog(r)} className="border-white/10 text-white h-7 w-7 p-0">
                  <Pencil size={12} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(r.id)} className="border-red-500/30 text-red-500 h-7 w-7 p-0">
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PersonalityResultDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        result={editing}
        onSave={(data) => saveMutation.mutate(data)}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}

function TraitsEditor({ value, onChange, knownTraits = [] }) {
  const [pairs, setPairs] = useState(() =>
    Object.entries(value || {}).map(([key, points]) => ({ key, points: parseInt(points) || 0 }))
  );

  // Resync from the parent only when the set of committed keys actually changes
  // (e.g. switching questions). This preserves in-progress empty/draft rows
  // while the user is typing.
  useEffect(() => {
    const valueKeys = Object.keys(value || {}).sort().join(',');
    const pairsKeys = pairs.filter((p) => p.key.trim()).map((p) => p.key.trim()).sort().join(',');
    if (valueKeys !== pairsKeys) {
      setPairs(Object.entries(value || {}).map(([key, points]) => ({ key, points: parseInt(points) || 0 })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (newPairs) => {
    setPairs(newPairs);
    const obj = {};
    newPairs.forEach(({ key, points }) => {
      if (key && key.trim()) obj[key.trim()] = parseInt(points) || 0;
    });
    onChange(obj);
  };

  const presentKeys = new Set(pairs.map((p) => p.key.trim()).filter(Boolean));
  const availableTraits = (knownTraits || []).filter((t) => !presentKeys.has(t));

  return (
    <div className="space-y-2">
      {availableTraits.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {availableTraits.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => commit([...pairs, { key: t, points: 1 }])}
              className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/15 text-white hover:bg-white/10 hover:border-white/30 transition-colors"
            >
              + {t}
            </button>
          ))}
        </div>
      )}
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex gap-2">
          <Input
            value={pair.key}
            onChange={(e) => commit(pairs.map((p, i) => (i === idx ? { ...p, key: e.target.value } : p)))}
            placeholder="nom du trait"
            className="bg-black border-white/10 text-white text-xs h-8"
          />
          <Input
            type="number"
            value={pair.points}
            onChange={(e) => commit(pairs.map((p, i) => (i === idx ? { ...p, points: e.target.value } : p)))}
            placeholder="pts"
            className="bg-black border-white/10 text-white text-xs h-8 w-20"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => commit(pairs.filter((_, i) => i !== idx))} className="border-red-500/30 text-red-500 h-8 w-8 p-0">
            <X size={12} />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => commit([...pairs, { key: '', points: 1 }])} className="border-white/10 text-white text-xs h-7">
        <Plus size={12} className="mr-1" /> Ajouter un trait
      </Button>
    </div>
  );
}

function PersonalityQuestionDialog({ isOpen, onClose, question, onSave, isSaving, knownTraits = [] }) {
  const [formData, setFormData] = useState(question || {});

  useEffect(() => { setFormData(question || {}); }, [question]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = { ...formData };
    // Remove empty trait keys
    const cleanA = {}; Object.entries(clean.option_a_traits || {}).forEach(([k, v]) => { if (k.trim()) cleanA[k.trim()] = parseInt(v) || 0; });
    const cleanB = {}; Object.entries(clean.option_b_traits || {}).forEach(([k, v]) => { if (k.trim()) cleanB[k.trim()] = parseInt(v) || 0; });
    clean.option_a_traits = cleanA;
    clean.option_b_traits = cleanB;
    onSave(clean);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{question?.id ? 'Modifier la question' : 'Nouvelle question'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-white">Question</Label>
            <Textarea
              value={formData.question || ''}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="bg-black border-white/10 text-white mt-2"
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-red-950/20 border border-red-500/20 rounded-lg p-3 space-y-3">
              <p className="text-red-400 text-xs font-semibold uppercase tracking-wide">Option A</p>
              <div>
                <Label className="text-white text-xs">Texte</Label>
                <Input
                  value={formData.option_a_text || ''}
                  onChange={(e) => setFormData({ ...formData, option_a_text: e.target.value })}
                  className="bg-black border-white/10 text-white mt-1 text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-white text-xs mb-1 block">Traits & points</Label>
                <TraitsEditor
                  value={formData.option_a_traits || {}}
                  onChange={(v) => setFormData({ ...formData, option_a_traits: v })}
                  knownTraits={knownTraits}
                />
              </div>
            </div>

            <div className="bg-blue-950/20 border border-blue-500/20 rounded-lg p-3 space-y-3">
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-wide">Option B</p>
              <div>
                <Label className="text-white text-xs">Texte</Label>
                <Input
                  value={formData.option_b_text || ''}
                  onChange={(e) => setFormData({ ...formData, option_b_text: e.target.value })}
                  className="bg-black border-white/10 text-white mt-1 text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-white text-xs mb-1 block">Traits & points</Label>
                <TraitsEditor
                  value={formData.option_b_traits || {}}
                  onChange={(v) => setFormData({ ...formData, option_b_traits: v })}
                  knownTraits={knownTraits}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white">Ordre</Label>
              <Input
                type="number"
                value={formData.order || 0}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                className="bg-black border-white/10 text-white mt-2"
              />
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active !== false}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  className="data-[state=checked]:bg-red-700"
                />
                <Label className="text-white">Active</Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-white">Annuler</Button>
            <Button type="submit" disabled={isSaving} className="bg-white text-black hover:bg-white/90">
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PersonalityResultDialog({ isOpen, onClose, result, onSave, isSaving }) {
  const [formData, setFormData] = useState(result || {});
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setFormData(result || {}); }, [result]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setFormData((d) => ({ ...d, cover_image: file_url }));
    } finally { setUploading(false); }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...formData, trait_key: (formData.trait_key || '').trim() });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{result?.id ? 'Modifier le résultat' : 'Nouveau résultat'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-white">Trait (clé)</Label>
            <Input
              value={formData.trait_key || ''}
              onChange={(e) => setFormData({ ...formData, trait_key: e.target.value })}
              className="bg-black border-white/10 text-white mt-2"
              placeholder="ex: romantique"
              required
            />
            <p className="text-white/40 text-xs mt-1">Doit correspondre aux traits définis dans les questions.</p>
          </div>
          <div>
            <Label className="text-white">Titre</Label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="bg-black border-white/10 text-white mt-2"
              placeholder="ex: Le romantique"
              required
            />
          </div>
          <div>
            <Label className="text-white">Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-black border-white/10 text-white mt-2"
              rows={3}
            />
          </div>
          <div>
            <Label className="text-white mb-2 block">Image de couverture</Label>
            {formData.cover_image ? (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10">
                <img src={formData.cover_image} alt="cover" className="w-full h-full object-cover" />
                <button type="button" onClick={() => setFormData({ ...formData, cover_image: '' })} className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-white/40">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
                {uploading ? <div className="w-6 h-6 border-2 border-white border-t-red-600 rounded-full animate-spin" /> : <><Upload size={20} className="text-white mb-1" /><span className="text-white text-xs">Téléverser</span></>}
              </label>
            )}
          </div>
          <div>
            <Label className="text-white">Ordre</Label>
            <Input type="number" value={formData.order || 0} onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })} className="bg-black border-white/10 text-white mt-2" />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-white">Annuler</Button>
            <Button type="submit" disabled={isSaving} className="bg-white text-black hover:bg-white/90">{isSaving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}