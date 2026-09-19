import React, { useState, useMemo } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function AdminContent() {
  const [editingContent, setEditingContent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderedIds, setOrderedIds] = useState([]);
  const queryClient = useQueryClient();

  const { data: contents = [] } = useQuery({
    queryKey: ['editableContents'],
    queryFn: async () => (await appClient.functions.invoke('manageEditableContent', { action: 'list' })).data.items,
  });

  const createContentMutation = useMutation({
    mutationFn: async (data) => (await appClient.functions.invoke('manageEditableContent', { action: 'save', ...data })).data.item,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editableContents'] });
      setEditingContent(null);
      setDialogOpen(false);
    }
  });

  const updateContentMutation = useMutation({
    mutationFn: async ({ id, data }) => (await appClient.functions.invoke('manageEditableContent', { action: 'save', id, ...data })).data.item,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editableContents'] });
      setEditingContent(null);
      setDialogOpen(false);
    }
  });

  const deleteContentMutation = useMutation({
    mutationFn: async (id) => appClient.functions.invoke('manageEditableContent', { action: 'delete', id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['editableContents'] })
  });

  const openDialog = (content) => {
    setEditingContent(content);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setEditingContent(null);
    setDialogOpen(false);
  };

  const handleSaveContent = () => {
    if (editingContent.id) {
      updateContentMutation.mutate({ id: editingContent.id, data: editingContent });
    } else {
      createContentMutation.mutate(editingContent);
    }
  };

  // Build ordered list from DB contents, maintaining manual reorder
  const sortedContents = useMemo(() => {
    if (orderedIds.length === 0) return contents;
    const map = Object.fromEntries(contents.map(c => [c.id, c]));
    const ordered = orderedIds.map(id => map[id]).filter(Boolean);
    const rest = contents.filter(c => !orderedIds.includes(c.id));
    return [...ordered, ...rest];
  }, [contents, orderedIds]);

  const moveItem = (id, dir) => {
    setOrderedIds(prev => {
      const list = prev.length ? [...prev] : sortedContents.map(c => c.id);
      const idx = list.indexOf(id);
      if (idx < 0) {
        // initialize from current sorted order then swap
        const fresh = sortedContents.map(c => c.id);
        const i = fresh.indexOf(id);
        const ni = i + dir;
        if (ni < 0 || ni >= fresh.length) return list;
        [fresh[i], fresh[ni]] = [fresh[ni], fresh[i]];
        return fresh;
      }
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= list.length) return list;
      [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
      return list;
    });
  };

  const removeContent = (content) => {
    if (!window.confirm('Delete this content block?')) return;
    deleteContentMutation.mutate(content.id);
    setOrderedIds(prev => prev.filter(id => id !== content.id));
  };

  return (
    <div>
      <h2 className="text-white text-lg font-light mb-6">Editorial Content</h2>

      {/* All Content Blocks (ordered) */}
      <div className="space-y-3 mb-8">
        {sortedContents.map((content, idx) => (
          <div
            key={content.id}
            className="bg-neutral-950 border border-white/10 rounded-sm p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <FileText size={20} className="text-white mt-1" />
                <div>
                  <h3 className="text-white font-light">{content.title}</h3>
                  <p className="text-white text-xs font-mono">{content.key}</p>
                  <span className="text-red-500/70 text-xs mt-1 inline-block">Configured</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => moveItem(content.id, -1)} disabled={idx === 0} className="h-7 w-7 text-white hover:text-white">
                  <ChevronUp size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => moveItem(content.id, 1)} disabled={idx === sortedContents.length - 1} className="h-7 w-7 text-white hover:text-white">
                  <ChevronDown size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openDialog(content)}
                  className="h-7 w-7 text-white hover:text-white"
                >
                  <Edit2 size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeContent(content)}
                  className="h-7 w-7 text-white hover:text-red-500"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add new custom block */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => openDialog({ key: '', title: '', content: '' })}
          className="border-white/20 text-white"
        >
          <Plus size={14} className="mr-2" />
          Add content block
        </Button>
      </div>

      {/* Edit Content Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader className="pb-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-light tracking-wide">
                {editingContent?.id ? 'Edit' : 'New'} Content
              </DialogTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={closeDialog}
                  className="border-white/20 text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveContent}
                  className="bg-white text-black hover:bg-white/90"
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogHeader>
          {editingContent && (
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              <Input
                value={editingContent.key}
                onChange={(e) => setEditingContent({ ...editingContent, key: e.target.value })}
                placeholder="Unique key (e.g. faq)"
                className="bg-neutral-900 border-white/10 text-white font-mono"
              />
              <Input
                value={editingContent.title}
                onChange={(e) => setEditingContent({ ...editingContent, title: e.target.value })}
                placeholder="Title"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <div className="flex-1">
                <label className="block text-white text-sm mb-2">
                  Content
                </label>
                <div className="rounded-sm overflow-hidden">
                  <ReactQuill
                    theme="snow"
                    value={editingContent.content || ''}
                    onChange={(val) => setEditingContent({ ...editingContent, content: val })}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ list: 'ordered' }, { list: 'bullet' }],
                        ['link', 'blockquote'],
                        ['clean'],
                      ],
                    }}
                    style={{ minHeight: '50vh' }}
                    className="bg-neutral-900 text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}