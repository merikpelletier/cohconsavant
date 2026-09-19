import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminQuizThemes() {
  const [editingTheme, setEditingTheme] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['adminQuizThemes'],
    queryFn: async () => (await appClient.functions.invoke('manageQuizTheme', { action: 'list' })).data.items,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => (await appClient.functions.invoke('manageQuizTheme', { action: 'save', ...data })).data.item,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuizThemes'] });
      queryClient.invalidateQueries({ queryKey: ['quizThemesActive'] });
      setIsDialogOpen(false);
      setEditingTheme(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => appClient.functions.invoke('manageQuizTheme', { action: 'delete', id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminQuizThemes'] });
      queryClient.invalidateQueries({ queryKey: ['quizThemesActive'] });
    },
  });

  const openDialog = (theme = null) => {
    setEditingTheme(theme || { name: '', quiz_type: 'trivia', cover_image: '', description: '', order: 0, is_active: true });
    setIsDialogOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-light text-white">Thèmes de Quiz</h2>
        <Button onClick={() => openDialog()} className="bg-white text-black hover:bg-white/90">
          <Plus size={18} className="mr-2" />
          Nouveau Thème
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-white border-t-red-600 rounded-full animate-spin" />
        </div>
      ) : themes.length === 0 ? (
        <p className="text-white text-sm py-8 text-center">Aucun thème pour le moment.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {themes.map((t) => (
            <div key={t.id} className="bg-neutral-900 border border-white/10 rounded-lg overflow-hidden">
              <div className="aspect-video bg-black relative">
                {t.cover_image ? (
                  <img src={t.cover_image} alt={t.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs">Pas de couverture</div>
                )}
                {!t.is_active && (
                  <span className="absolute top-2 left-2 bg-black text-white text-[10px] px-2 py-0.5 rounded">Inactif</span>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-white font-light text-sm mb-1 truncate">{t.name}</h3>
                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded mb-1 ${t.quiz_type === 'personality' ? 'bg-red-600/30 text-red-400' : 'bg-white/10 text-white/70'}`}>
                  {t.quiz_type === 'personality' ? 'Personnalité' : 'Trivia'}
                </span>
                {t.description && <p className="text-white text-xs mb-2 line-clamp-2">{t.description}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openDialog(t)} className="border-white/10 text-white hover:bg-white/10 flex-1">
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(t.id)} className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ThemeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        theme={editingTheme}
        onSave={(data) => saveMutation.mutate(data)}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}

function ThemeDialog({ isOpen, onClose, theme, onSave, isSaving }) {
  const [formData, setFormData] = useState(theme || {});
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    setFormData(theme || {});
  }, [theme]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });
      setFormData((d) => ({ ...d, cover_image: file_url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{theme?.id ? 'Modifier le thème' : 'Nouveau thème'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-white">Nom du thème</Label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-black border-white/10 text-white mt-2"
              required
            />
          </div>

          <div>
            <Label className="text-white">Type de quiz</Label>
            <select
              value={formData.quiz_type || 'trivia'}
              onChange={(e) => setFormData({ ...formData, quiz_type: e.target.value })}
              className="bg-black border-white/10 text-white mt-2 w-full rounded-md px-3 py-2 text-sm"
            >
              <option value="trivia">Trivia (bonnes/mauvaises réponses)</option>
              <option value="personality">Personnalité (ceci ou cela, score par traits)</option>
            </select>
          </div>

          <div>
            <Label className="text-white mb-2 block">Couverture</Label>
            {formData.cover_image ? (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10">
                <img src={formData.cover_image} alt="cover" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, cover_image: '' })}
                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-video border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-white/40 transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-red-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload size={20} className="text-white mb-1" />
                    <span className="text-white text-xs">Téléverser une image</span>
                  </>
                )}
              </label>
            )}
          </div>

          <div>
            <Label className="text-white">Description</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-black border-white/10 text-white mt-2"
              rows={2}
            />
          </div>

          <div>
            <Label className="text-white">Ordre d'affichage</Label>
            <Input
              type="number"
              value={formData.order || 0}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
              className="bg-black border-white/10 text-white mt-2"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.is_active !== false}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              className="data-[state=checked]:bg-red-700"
            />
            <Label className="text-white">Thème actif</Label>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="border-white/10 text-white">
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-white text-black hover:bg-white/90">
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}