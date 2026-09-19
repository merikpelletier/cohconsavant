import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, ExternalLink, Coins, ChevronDown, ChevronRight, Package, CheckSquare, Square, Boxes } from 'lucide-react';

// Compute total stock from stock object { "S": 10, "M": 15, ... }
function getTotalStock(stock) {
  if (!stock || typeof stock !== 'object') return 0;
  return Object.values(stock).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

// Format stock display: "50" or "50 (S:10 M:15 L:20 XL:5)"
function formatStock(stock) {
  if (!stock || typeof stock !== 'object' || Object.keys(stock).length === 0) return null;
  const total = getTotalStock(stock);
  const breakdown = Object.entries(stock)
    .filter(([k, v]) => k && v !== null && v !== undefined)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  return { total, breakdown };
}

export default function AdminProductList({ products, sections, onEdit, onDelete, onAdd }) {
  const [expanded, setExpanded] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Build groups: section_id -> products. Products without section go to "__none__".
  const groups = {};
  products.forEach((p) => {
    const key = p.section_id || '__none__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  });

  // Order groups by section order, then name; __none__ last
  const sectionList = sections
    .filter((s) => !s.parent_section_id)
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

  const subList = sections.filter((s) => s.parent_section_id);

  const orderedKeys = [];
  sectionList.forEach((s) => {
    if (groups[s.id]) orderedKeys.push({ key: s.id, label: s.name, count: groups[s.id].length });
  });
  subList.forEach((s) => {
    if (groups[s.id]) orderedKeys.push({ key: s.id, label: `↳ ${s.name}`, count: groups[s.id].length });
  });
  if (groups['__none__']) orderedKeys.push({ key: '__none__', label: 'Sans section', count: groups['__none__'].length });

  // Auto-expand first group on mount if nothing expanded
  React.useEffect(() => {
    if (orderedKeys.length > 0 && Object.keys(expanded).length === 0) {
      setExpanded({ [orderedKeys[0].key]: true });
    }
  }, [products.length]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectGroup = (key) => {
    const items = groups[key] || [];
    const allSelected = items.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach((p) => next.delete(p.id));
      } else {
        items.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Supprimer ${selectedIds.size} produit(s) ?`)) return;
    setBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await onDelete(id);
      }
      clearSelection();
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-red-600/90 backdrop-blur px-4 py-2 rounded-sm">
          <span className="text-white text-sm font-light">{selectedIds.size} sélectionné(s)</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-white hover:bg-white/10">
              Annuler
            </Button>
            <Button size="sm" onClick={handleBulkDelete} disabled={bulkDeleting} className="bg-white text-red-600 hover:bg-white/90">
              {bulkDeleting ? 'Suppression...' : (
                <>
                  <Trash2 size={14} className="mr-1" />
                  Supprimer ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {orderedKeys.map(({ key, label, count }) => {
        const isOpen = expanded[key];
        const items = groups[key];
        const sectionObj = sections.find((s) => s.id === key);
        const parentId = sectionObj?.parent_section_id;
        const allGroupSelected = items.length > 0 && items.every((p) => selectedIds.has(p.id));
        const someGroupSelected = items.some((p) => selectedIds.has(p.id));
        return (
          <div key={key} className="border border-white/10 rounded-sm overflow-hidden">
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900 hover:bg-neutral-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={16} className="text-white/60" /> : <ChevronRight size={16} className="text-white/60" />}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectGroup(key);
                  }}
                  className="text-white/60 hover:text-white"
                  title="Tout sélectionner dans ce groupe"
                >
                  {allGroupSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </span>
                <span className="text-white font-light">{label}</span>
                <span className="text-white/40 text-xs bg-neutral-800 px-2 py-0.5 rounded">{count}</span>
                {someGroupSelected && !allGroupSelected && (
                  <span className="text-white/50 text-xs">{items.filter((p) => selectedIds.has(p.id)).length} sélectionnés</span>
                )}
              </div>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd(key === '__none__' ? '' : key);
                }}
                className="text-white/60 hover:text-white p-1"
                title="Ajouter un produit dans ce groupe"
              >
                <Plus size={16} />
              </span>
            </button>
            {isOpen && (
              <div className="bg-black space-y-px">
                {items.map((product) => {
                  const subName = sections.find((s) => s.id === product.section_id)?.name;
                  const isSelected = selectedIds.has(product.id);
                  return (
                    <div
                      key={product.id}
                      className={`flex items-start gap-2 px-4 py-3 transition-colors ${isSelected ? 'bg-red-500/10' : 'bg-neutral-950 hover:bg-neutral-900'} ${!product.is_active && 'opacity-50'}`}
                    >
                      <span
                        onClick={() => toggleSelect(product.id)}
                        className="text-white/60 hover:text-white cursor-pointer mt-1 flex-shrink-0"
                      >
                        {isSelected ? <CheckSquare size={16} className="text-red-500" /> : <Square size={16} />}
                      </span>
                      <div className="flex-1 flex items-start justify-between">
                        <div className="flex gap-4">
                          {product.image_url && (
                            <img src={product.image_url} alt="" className="w-20 h-14 object-cover rounded-sm flex-shrink-0" />
                          )}
                          <div>
                            <h3 className="text-white font-light">{product.name}</h3>
                            {product.description && (
                              <p className="text-white/50 text-sm line-clamp-1">{product.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {product.price && <span className="text-white text-sm">{product.price}</span>}
                              {product.token_price > 0 && (
                                <span className="flex items-center gap-1 text-red-500 text-xs px-2 py-0.5 bg-red-500/10 rounded">
                                  <Coins size={12} />
                                  {product.token_price} tokens
                                </span>
                              )}
                              {subName && key !== '__none__' && parentId && (
                                <span className="text-white/60 text-xs px-2 py-0.5 bg-neutral-800 rounded">{subName}</span>
                              )}
                              {product.category && product.category !== 'product' && (
                                <span className="text-white/70 text-xs px-2 py-0.5 bg-neutral-700 rounded">{product.category}</span>
                              )}
                              {product.is_digital && (
                                <span className="text-black text-xs px-2 py-0.5 bg-red-500 rounded font-bold tracking-wide">DIGITAL</span>
                              )}
                              {(() => {
                                const stockInfo = formatStock(product.stock);
                                if (!stockInfo) return (
                                  <span className="flex items-center gap-1 text-white/30 text-xs px-2 py-0.5 bg-neutral-800/50 rounded">
                                    <Boxes size={11} />
                                    Stock: —
                                  </span>
                                );
                                const outOfStock = stockInfo.total === 0;
                                const lowStock = stockInfo.total > 0 && stockInfo.total <= 5;
                                return (
                                  <span
                                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${outOfStock ? 'bg-red-500/20 text-red-400' : lowStock ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400'}`}
                                    title={stockInfo.breakdown}
                                  >
                                    <Boxes size={11} />
                                    {stockInfo.total} en stock
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.external_link && (
                            <a href={product.external_link} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="text-white hover:text-white">
                                <ExternalLink size={16} />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => onEdit(product)} className="text-white hover:text-white">
                            <Edit2 size={16} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(product.id)} className="text-white hover:text-red-500">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {orderedKeys.length === 0 && (
        <div className="text-center py-12 text-white/40">
          <Package size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Aucun produit. Cliquez sur « Nouveau produit » pour en créer un.</p>
        </div>
      )}
    </div>
  );
}