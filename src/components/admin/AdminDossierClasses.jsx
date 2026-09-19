import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Check, X, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function AdminDossierClasses() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [ordered, setOrdered] = useState([]);

  const { data: adminContent } = useQuery({
    queryKey: ['adminDossiers'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getAdminDossiers', {});
      return res.data;
    },
  });
  const classes = adminContent?.classes || [];

  useEffect(() => {
    setOrdered(classes);
  }, [classes]);

  const createMutation = useMutation({
    mutationFn: (name) => appClient.functions.invoke('saveDossierClass', { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminDossiers'] }); setNewName(''); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }) => appClient.functions.invoke('saveDossierClass', { id, name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['adminDossiers'] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => appClient.functions.invoke('deleteDossierClass', { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminDossiers'] }),
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(ordered);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setOrdered(reordered);
    await Promise.all(reordered.map((cls, idx) =>
      appClient.functions.invoke('saveDossierClass', { id: cls.id, name: cls.name, order: idx })
    ));
    qc.invalidateQueries({ queryKey: ['adminDossiers'] });
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const startEdit = (cls) => {
    setEditingId(cls.id);
    setEditingName(cls.name);
  };

  const confirmEdit = () => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id: editingId, name: trimmed });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-white text-sm font-medium tracking-wide">Classes de Dossiers</h3>
      <p className="text-white/50 text-xs">Les classes déterminent les sections principales de la page d'accueil. L'ordre du glisser-déposer contrôle l'affichage.</p>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Nouvelle classe..."
          className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || createMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-40 transition-colors"
        >
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* List */}
      {ordered.length === 0 && (
        <p className="text-white text-sm text-center py-6">Aucune classe pour l'instant.</p>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="classes">
          {(provided) => (
            <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
              {ordered.map((cls, index) => (
                <Draggable key={cls.id} draggableId={cls.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg ${snapshot.isDragging ? 'opacity-80 border-white/30' : ''}`}
                    >
                      <div {...provided.dragHandleProps} className="text-white/20 hover:text-white cursor-grab active:cursor-grabbing mr-1">
                        <GripVertical size={14} />
                      </div>
                      {editingId === cls.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-white/40"
                          />
                          <button onClick={confirmEdit} disabled={updateMutation.isPending} className="text-red-500 hover:text-red-400 transition-colors">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-white hover:text-white transition-colors">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-white text-sm">{cls.name}</span>
                          <button onClick={() => startEdit(cls)} className="text-white hover:text-white transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteMutation.mutate(cls.id)} className="text-white hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}