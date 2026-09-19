import React, { useState, useRef, useMemo } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// Fields the user can map columns to (price excluded per user instruction)
const MAPPABLE_FIELDS = [
  { key: 'name', label: 'Nom du produit', required: true, hints: ['name', 'nom', 'nombre', 'titre', 'title', 'producto', 'produit', 'articulo', 'artículo', 'denominacion', 'denominación'] },
  { key: 'description', label: 'Description', required: false, hints: ['description', 'descripcion', 'descripción', 'detalle', 'details', 'détails', 'ficha', 'caracteristicas', 'características', 'observaciones'] },
  { key: 'image_url', label: 'Image (URL)', required: false, hints: ['image', 'imagen', 'img', 'photo', 'foto', 'thumbnail', 'cover', 'imagen_producto', 'imagen producto', 'foto producto'] },
  { key: 'external_link', label: 'Lien externe', required: false, hints: ['external_link', 'url_producto', 'product_url', 'producto_url', 'pagina', 'web', 'enlace producto', 'url del producto'] },
  { key: 'shipping', label: 'Livraison', required: false, hints: ['shipping', 'envio', 'envío', 'delivery', 'livraison', 'transporte', 'gastos_envio', 'frais_livraison', 'expedition', 'expédition'] },
  { key: 'policy', label: 'Politique de retour', required: false, hints: ['policy', 'politique', 'devolucion', 'devolución', 'returns', 'retours', 'garantie', 'garantia', 'garantía', 'conditions'] },
  { key: 'token_price', label: 'Prix en tokens', required: false, hints: ['token_price', 'tokens', 'creditos', 'créditos', 'credits'] },
  { key: 'is_active', label: 'Actif', required: false, hints: ['is_active', 'active', 'actif', 'visible', 'activo', 'status', 'estado', 'mostrar', 'publicar'] },
  { key: 'category', label: 'Catégorie', required: false, hints: ['category', 'categorie', 'categoria', 'categoría', 'type', 'tipo', 'clase', 'familia'] },
  { key: 'section', label: 'Section (texte)', required: false, hints: ['section', 'seccion', 'sección', 'grupo', 'coleccion', 'colección', 'linea', 'línea', 'departamento'] },
  { key: 'product_options', label: 'Options (taille, couleur…)', required: false, hints: ['options', 'variantes', 'variant', 'variantes', 'tallas', 'taille', 'sizes', 'colores', 'color', 'couleur', 'colors', 'opzioni'] },
  { key: 'images', label: 'Galerie d\'images', required: false, hints: ['gallery', 'galerie', 'imagenes_extra', 'fotos_extra', 'additional_images', 'more_images', 'images_gallery', 'galeria', 'galería', 'fotos', 'images'] },
];

// Pre-fill: find the best matching column for each field
// 1) Exact match (case-insensitive, trimmed, quotes stripped)
// 2) Fuzzy match: hint >= 4 chars and column name includes the hint as substring (one-directional)
function guessMapping(rawHeaders) {
  // Clean header names: trim whitespace, strip trailing quotes
  const headers = rawHeaders.map((h) => String(h).replace(/['"`]+$/g, '').trim());
  const mapping = {};
  const used = new Set();

  // Pass 1: exact matches
  for (const field of MAPPABLE_FIELDS) {
    for (const hint of field.hints) {
      const match = headers.find((h) => {
        const hl = h.toLowerCase().trim();
        return hl === hint.toLowerCase() && !used.has(h);
      });
      if (match) {
        mapping[field.key] = match;
        used.add(match);
        break;
      }
    }
  }

  // Pass 2: fuzzy matches (hint >= 4 chars, column name includes hint)
  for (const field of MAPPABLE_FIELDS) {
    if (mapping[field.key]) continue; // already matched
    for (const hint of field.hints) {
      if (hint.length < 4) continue;
      const cl = hint.toLowerCase();
      const match = headers.find((h) => {
        if (used.has(h)) return false;
        return h.toLowerCase().trim().includes(cl);
      });
      if (match) {
        mapping[field.key] = match;
        used.add(match);
        break;
      }
    }
  }

  return mapping;
}

// Extract products from raw rows using the user's column mapping
function extractProducts(rawRows, headers, fieldMapping) {
  return rawRows
    .map((row) => {
      const getValue = (fieldKey) => {
        const col = fieldMapping[fieldKey];
        if (!col) return '';
        return row[col] != null ? String(row[col]).trim() : '';
      };

      const name = getValue('name');
      if (!name) return null;

      const is_active_raw = getValue('is_active');
      const tokenPrice = getValue('token_price');

      // Parse options: support multiple columns (each column = one option) or single column with format
      let product_options = [];
      const optionCols = fieldMapping.product_options;
      const optColsArray = Array.isArray(optionCols) ? optionCols : (optionCols ? [optionCols] : []);
      for (const col of optColsArray) {
        if (!col) continue;
        const val = row[col] != null ? String(row[col]).trim() : '';
        if (!val) continue;
        // If column name itself looks like an option (Taille, Couleur, Size, etc.), use it as the option name
        const colLower = col.toLowerCase().trim();
        const isKnownOption = ['taille', 'size', 'talla', 'couleur', 'color', 'colore', 'color', 'colour'].includes(colLower);
        if (isKnownOption) {
          const vals = val.split(/[,;|]/).map(v => v.trim()).filter(Boolean);
          if (vals.length > 0) {
            product_options.push({ name: col.charAt(0).toUpperCase() + col.slice(1), values: vals });
          }
        } else {
          // Try to parse format "Name: val1,val2" or "S,M,L"
          if (val.includes(':') || val.includes('=')) {
            const [optName, optVals] = val.split(/[:=]/).map(s => s.trim());
            if (optName && optVals) {
              product_options.push({ name: optName, values: optVals.split(',').map(v => v.trim()).filter(Boolean) });
            }
          } else {
            const vals = val.split(/[,;|]/).map(v => v.trim()).filter(Boolean);
            if (vals.length > 0) {
              product_options.push({ name: 'Taille', values: vals });
            }
          }
        }
      }

      // Parse gallery images: support multiple columns (array) or single column (string)
      let images = [];
      let imagesRaw = [];
      const imageCols = fieldMapping.images;
      const colsArray = Array.isArray(imageCols) ? imageCols : (imageCols ? [imageCols] : []);
      for (const col of colsArray) {
        if (!col) continue;
        const val = row[col] != null ? String(row[col]).trim() : '';
        if (val) {
          imagesRaw.push(val);
          const urls = val.split(/[,;\n]/).map(u => u.trim()).filter(Boolean);
          images.push(...urls);
        }
      }

      return {
        name,
        description: getValue('description'),
        image_url: getValue('image_url'),
        external_link: getValue('external_link'),
        shipping: getValue('shipping'),
        policy: getValue('policy'),
        token_price: tokenPrice && !isNaN(Number(tokenPrice)) ? Number(tokenPrice) : 0,
        section: getValue('section'),
        category: getValue('category') || 'product',
        is_active: is_active_raw
          ? !['false', '0', 'no', 'inactivo', 'agotado'].includes(is_active_raw.toLowerCase())
          : true,
        product_options: product_options.length > 0 ? product_options : undefined,
        images: images.length > 0 ? images : undefined,
        images_raw: imagesRaw.length > 0 ? imagesRaw : undefined,
      };
    })
    .filter(Boolean);
}

export default function ProductImportModal({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [defaultSectionId, setDefaultSectionId] = useState('');
  const [result, setResult] = useState(null);

  const { data: sections = [] } = useQuery({
    queryKey: ['shopSections'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('manageShopSection', { action: 'list' });
      return res.data.items || [];
    },
    enabled: open,
  });

  // Extracted products based on current field mapping
  const extractedProducts = useMemo(() => {
    if (!rawRows.length || !headers.length) return [];
    return extractProducts(rawRows, headers, fieldMapping);
  }, [rawRows, headers, fieldMapping]);

  const handleFieldMappingChange = (fieldKey, columnName) => {
    setFieldMapping((prev) => {
      const next = { ...prev };
      if (columnName === '__none__') {
        delete next[fieldKey];
      } else {
        next[fieldKey] = columnName;
      }
      return next;
    });
  };

  // Toggle a column in a multi-select field (for images and product_options)
  const toggleMultiColumn = (fieldKey, columnName) => {
    setFieldMapping((prev) => {
      const next = { ...prev };
      const current = next[fieldKey];
      const arr = Array.isArray(current) ? [...current] : (current ? [current] : []);
      if (arr.includes(columnName)) {
        const filtered = arr.filter(c => c !== columnName);
        if (filtered.length === 0) {
          delete next[fieldKey];
        } else {
          next[fieldKey] = filtered;
        }
      } else {
        arr.push(columnName);
        next[fieldKey] = arr;
      }
      return next;
    });
  };

  const parseRows = (rows, rawHeaders) => {
    setHeaders(rawHeaders);
    setRawRows(rows);
    setFieldMapping(guessMapping(rawHeaders));
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setRawRows([]);
      setHeaders([]);
      setFieldMapping({});
      setResult(null);
    }
  };

  const handlePasteExtract = () => {
    if (!pastedData.trim()) return;
    setExtracting(true);
    setResult(null);
    try {
      const lines = pastedData.trim().split(/\r?\n/);
      const rows = lines.map((line) => line.split('\t'));
      const parsedHeaders = rows[0];
      const dataRows = rows.slice(1).map((row) => {
        const obj = {};
        parsedHeaders.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
      parseRows(dataRows, parsedHeaders);
    } catch (error) {
      setResult({ error: `Erreur lors du parsing: ${error.message}` });
    } finally {
      setExtracting(false);
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const rawHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
      parseRows(rows, rawHeaders);
    } catch (error) {
      setResult({ error: `Erreur lors de la lecture du fichier: ${error.message}` });
    } finally {
      setExtracting(false);
    }
  };

  const handleImport = async () => {
    if (extractedProducts.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await appClient.functions.invoke('importProducts', {
        products: extractedProducts,
        section_id: defaultSectionId || null,
      });
      setResult(res.data);
      if (res.data) {
        queryClient.invalidateQueries({ queryKey: ['shopProducts'] });
      }
    } catch (error) {
      setResult({ error: `Erreur lors de l'import: ${error.message}` });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPasteMode(false);
    setPastedData('');
    setRawRows([]);
    setHeaders([]);
    setFieldMapping({});
    setResult(null);
    setDefaultSectionId('');
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const hdrs = ['name', 'description', 'image_url', 'external_link', 'shipping', 'policy', 'section', 'category', 'is_active'];
    const csv = [hdrs.join(','), 'Exemple Produit,Description du produit,https://example.com/image.jpg,https://example.com/product,Livraison 3-5 jours,Retour 30 jours,Product,product,true'].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_produits.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasData = headers.length > 0 && rawRows.length > 0;
  const nameMapped = !!fieldMapping.name;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileSpreadsheet size={20} />
            Importer des produits (XLS / CSV)
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: File upload / Paste */}
        {!hasData && !result && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={!pasteMode ? 'default' : 'outline'} size="sm" onClick={() => { setPasteMode(false); }} className="flex-1">
                <FileSpreadsheet size={14} className="mr-2" /> Fichier XLS/CSV
              </Button>
              <Button variant={pasteMode ? 'default' : 'outline'} size="sm" onClick={() => { setPasteMode(true); setFile(null); }} className="flex-1">
                <FileSpreadsheet size={14} className="mr-2" /> Coller les données
              </Button>
            </div>

            {pasteMode ? (
              <div className="space-y-3">
                <p className="text-white/50 text-xs">Ouvre ton fichier Excel, sélectionne tout (Ctrl+A), copie (Ctrl+C), et colle ici (Ctrl+V). Les données doivent être séparées par des tabulations.</p>
                <textarea
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  placeholder="Colle tes données Excel ici..."
                  className="w-full h-48 bg-neutral-900 border border-white/10 rounded-lg p-3 text-white text-xs font-mono resize-y focus:outline-none focus:border-white/30"
                />
                <Button
                  onClick={handlePasteExtract}
                  disabled={!pastedData.trim() || extracting}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {extracting ? (
                    <><Loader2 size={16} className="mr-2 animate-spin" /> Extraction...</>
                  ) : (
                    <><FileSpreadsheet size={16} className="mr-2" /> Extraire les données</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="border-white/20 text-white">
                    <Download size={14} className="mr-2" />
                    Télécharger le modèle
                  </Button>
                </div>
                <label className="block cursor-pointer">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xls,.xlsx,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="border-2 border-dashed border-white/15 rounded-lg p-8 text-center hover:border-white/30 transition-colors">
                    {file ? (
                      <div className="flex flex-col items-center gap-2">
                        <FileSpreadsheet size={32} className="text-white/60" />
                        <span className="text-white text-sm">{file.name}</span>
                        <span className="text-white/40 text-xs">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={32} className="text-white/30" />
                        <span className="text-white/60 text-sm">Cliquez pour sélectionner un fichier .xls, .xlsx ou .csv</span>
                      </div>
                    )}
                  </div>
                </label>

                {file && (
                  <Button
                    onClick={handleExtract}
                    disabled={extracting}
                    className="w-full bg-white text-black hover:bg-white/90"
                  >
                    {extracting ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Extraction des données...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={16} className="mr-2" />
                        Extraire les données
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Manual column mapping + Preview */}
        {hasData && !result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">{rawRows.length} ligne(s) — {headers.length} colonne(s) détectée(s)</span>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setRawRows([]); setHeaders([]); setFieldMapping({}); }} className="text-white/60">
                Changer de fichier
              </Button>
            </div>

            {/* Manual column mapping */}
            <div className="border border-white/10 rounded-lg p-3 bg-neutral-900/50 space-y-2">
              <p className="text-white/60 text-xs font-medium">Associe chaque champ à une colonne de ton fichier :</p>
              <div className="grid grid-cols-1 gap-2">
                {MAPPABLE_FIELDS.map((field) => {
                  const selectedCol = fieldMapping[field.key] || '__none__';
                  const isMulti = field.key === 'images' || field.key === 'product_options';
                  const multiCols = Array.isArray(fieldMapping[field.key]) ? fieldMapping[field.key] : (fieldMapping[field.key] ? [fieldMapping[field.key]] : []);
                  return (
                    <div key={field.key} className="flex items-start gap-2">
                      <div className="w-40 flex-shrink-0 pt-1">
                        <span className={`text-xs ${field.required ? 'text-white font-medium' : 'text-white/60'}`}>
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </span>
                        {isMulti && <p className="text-white/30 text-[10px] mt-0.5">Coche plusieurs</p>}
                      </div>
                      {isMulti ? (
                        <div className="flex-1 flex flex-wrap gap-1.5 border border-white/10 rounded-md p-2 bg-neutral-900 min-h-[36px]">
                          {multiCols.length === 0 && <span className="text-white/30 text-xs py-1">— Aucune colonne sélectionnée —</span>}
                          {multiCols.map((c) => (
                            <span key={c} className="inline-flex items-center gap-1 bg-white/10 text-white text-xs px-2 py-1 rounded">
                              {c}
                              <button onClick={() => toggleMultiColumn(field.key, c)} className="text-white/50 hover:text-white">×</button>
                            </span>
                          ))}
                          <div className="relative">
                            <details className="group">
                              <summary className="cursor-pointer text-xs text-white/60 hover:text-white bg-neutral-800 px-2 py-1 rounded">+ Ajouter</summary>
                              <div className="absolute z-10 mt-1 bg-neutral-900 border border-white/10 rounded-md p-2 max-h-40 overflow-y-auto min-w-[160px] shadow-lg">
                                {headers.filter(h => !multiCols.includes(h)).map((h) => (
                                  <label key={h} className="flex items-center gap-2 text-xs text-white py-1 cursor-pointer hover:bg-white/5 px-1 rounded">
                                    <input type="checkbox" checked={false} onChange={() => toggleMultiColumn(field.key, h)} className="w-3 h-3 accent-white" />
                                    <span className="truncate">{h}</span>
                                  </label>
                                ))}
                              </div>
                            </details>
                          </div>
                        </div>
                      ) : (
                        <Select value={selectedCol} onValueChange={(val) => handleFieldMappingChange(field.key, val)}>
                          <SelectTrigger className="bg-neutral-900 border-white/10 text-white h-8 text-xs">
                            <SelectValue placeholder="— Aucune —" />
                          </SelectTrigger>
                          <SelectContent className="bg-neutral-900 border-white/10 max-h-60">
                            <SelectItem value="__none__" className="text-white/40 text-xs">— Aucune —</SelectItem>
                            {headers.map((h) => (
                              <SelectItem key={h} value={h} className="text-white text-xs">{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
              {!nameMapped && (
                <p className="text-amber-400/70 text-xs mt-1">
                  ⚠ Le champ "Nom du produit" doit être associé à une colonne pour que l'import fonctionne.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-white text-sm">Section par défaut (pour les nouveaux produits)</label>
              <Select value={defaultSectionId} onValueChange={setDefaultSectionId}>
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue placeholder="Sélectionner une section (optionnel)" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-white/10">
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-white">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-white/40 text-xs">Les produits existants (même nom) seront mis à jour. Les nouveaux produits seront créés dans cette section.</p>
            </div>

            {/* Preview table — updates in real-time */}
            <div className="border border-white/10 rounded-lg">
              <div className="p-2 bg-neutral-900 border-b border-white/10">
                <span className="text-white/60 text-xs">{extractedProducts.length} produit(s) prêt(s) à l'import</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-900 sticky top-0">
                    <tr className="text-white/50">
                      <th className="text-left p-2 font-normal">Nom</th>
                      <th className="text-left p-2 font-normal">Description</th>
                      <th className="text-left p-2 font-normal">Image</th>
                      <th className="text-left p-2 font-normal">Options</th>
                      <th className="text-left p-2 font-normal">Galerie</th>
                      <th className="text-left p-2 font-normal">Lien</th>
                      <th className="text-left p-2 font-normal">Livraison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedProducts.slice(0, 50).map((p, idx) => (
                      <tr key={idx} className="border-t border-white/5">
                        <td className="p-2 text-white truncate max-w-[180px]">{p.name}</td>
                        <td className="p-2 text-white/50 truncate max-w-[150px]">{p.description ? '✓' : '—'}</td>
                        <td className="p-2 text-white/50 truncate max-w-[120px]">{p.image_url || '—'}</td>
                        <td className="p-2 text-white/50">{p.product_options ? `${p.product_options.length} opt` : '—'}</td>
                        <td className="p-2 text-white/50 truncate max-w-[150px]">{p.images_raw ? p.images_raw.join(' | ').slice(0, 80) : '—'}</td>
                        <td className="p-2 text-white/50">{p.external_link ? '✓' : '—'}</td>
                        <td className="p-2 text-white/50">{p.shipping ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {extractedProducts.length === 0 && (
                  <div className="p-4 text-center text-white/40 text-xs">Associe au moins la colonne "Nom" pour voir les produits.</div>
                )}
                {extractedProducts.length > 50 && (
                  <div className="p-2 text-center text-white/40 text-xs">+ {extractedProducts.length - 50} autres produits...</div>
                )}
              </div>
            </div>

            <Button
              onClick={handleImport}
              disabled={importing || extractedProducts.length === 0 || !nameMapped}
              className="w-full bg-white text-black hover:bg-white/90"
            >
              {importing ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Importation en cours...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="mr-2" />
                  Importer {extractedProducts.length} produit(s)
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Result */}
        {result && (
          <div className="space-y-4">
            {result.error ? (
              <div className="flex items-start gap-3 p-4 bg-red-950/30 border border-red-500/30 rounded-lg">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 text-sm font-medium">Erreur</p>
                  <p className="text-red-300/70 text-xs mt-1">{result.error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-green-950/30 border border-green-500/30 rounded-lg">
                  <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-300 text-sm font-medium">Import terminé</p>
                    <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-green-300/80">✓ {result.created} créé(s)</span>
                      <span className="text-green-300/80">↻ {result.updated} mis à jour</span>
                      {result.errors?.length > 0 && (
                        <span className="text-red-300/80">⚠ {result.errors.length} erreur(s)</span>
                      )}
                    </div>
                  </div>
                </div>
                {result.errors?.length > 0 && (
                  <div className="max-h-32 overflow-y-auto p-3 bg-neutral-900 border border-white/10 rounded-lg">
                    {result.errors.map((err, idx) => (
                      <p key={idx} className="text-white/50 text-xs">• {err.error} — {err.row?.name || 'Ligne sans nom'}</p>
                    ))}
                  </div>
                )}
                <Button onClick={handleClose} className="w-full bg-white text-black hover:bg-white/90">
                  Fermer
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}