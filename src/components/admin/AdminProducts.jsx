import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Upload, ExternalLink, Coins, FolderPlus, X, ChevronRight, FileSpreadsheet, Boxes } from 'lucide-react';
import AdminProductList from './AdminProductList';
import ProductImportModal from './ProductImportModal';

export default function AdminProducts() {
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [paymentLink, setPaymentLink] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [heroVideo, setHeroVideo] = useState('');
  const [heroText, setHeroText] = useState('');
  const [heroLink, setHeroLink] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [digitalUploadBusy, setDigitalUploadBusy] = useState(false);
  const [digitalUploadError, setDigitalUploadError] = useState('');
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['shopProducts'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('manageProduct', { action: 'list' });
      return res.data.items || [];
    },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['shopSections'],
    queryFn: async () => {
      const res = await appClient.functions.invoke('manageShopSection', { action: 'list' });
      return res.data.items || [];
    },
  });

  const { data: shopSettings = [] } = useQuery({
    queryKey: ['shopSettings'],
    queryFn: async () => { const res = await appClient.functions.invoke('manageShopSettings', { action: 'list' }); return res.data.items; },
  });

  React.useEffect(() => {
    if (shopSettings.length > 0) {
      setPaymentLink(shopSettings[0].payment_link || '');
      setHeroImage(shopSettings[0].hero_image || '');
      setHeroVideo(shopSettings[0].hero_video || '');
      setHeroText(shopSettings[0].hero_text || '');
      setHeroLink(shopSettings[0].hero_link || '');
    }
  }, [shopSettings]);

  // Product mutations
  const createProductMutation = useMutation({
    mutationFn: async (data) => {
      const res = await appClient.functions.invoke('manageProduct', { action: 'create', ...data });
      return res.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopProducts'] });
      queryClient.invalidateQueries({ queryKey: ['shopData'] });
      setEditingProduct(null);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const res = await appClient.functions.invoke('manageProduct', { action: 'update', id, ...fields });
      return res.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopProducts'] });
      queryClient.invalidateQueries({ queryKey: ['shopData'] });
      setEditingProduct(null);
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id) => {
      await appClient.functions.invoke('manageProduct', { action: 'delete', id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopProducts'] })
  });

  // Section mutations
  const createSectionMutation = useMutation({
    mutationFn: async (data) => {
      const res = await appClient.functions.invoke('manageShopSection', { action: 'create', ...data });
      return res.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSections'] });
      queryClient.invalidateQueries({ queryKey: ['shopData'] });
      setEditingSection(null);
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, ...fields }) => {
      const res = await appClient.functions.invoke('manageShopSection', { action: 'update', id, ...fields });
      return res.data.item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSections'] });
      queryClient.invalidateQueries({ queryKey: ['shopData'] });
      setEditingSection(null);
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id) => {
      await appClient.functions.invoke('manageShopSection', { action: 'delete', id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopSections'] })
  });

  const savePaymentLinkMutation = useMutation({
    mutationFn: async (link) => {
      if (shopSettings.length > 0) {
        const res = await appClient.functions.invoke('manageShopSettings', { action: 'save', id: shopSettings[0].id, payment_link: link });
        return res.data.item;
      } else {
        const res = await appClient.functions.invoke('manageShopSettings', { action: 'save', payment_link: link });
        return res.data.item;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSettings'] });
    }
  });

  const saveHeroMutation = useMutation({
    mutationFn: async () => {
      const heroData = { hero_image: heroImage, hero_video: heroVideo, hero_text: heroText, hero_link: heroLink };
      if (shopSettings.length > 0) {
        const res = await appClient.functions.invoke('manageShopSettings', { action: 'save', id: shopSettings[0].id, ...heroData });
        return res.data.item;
      } else {
        const res = await appClient.functions.invoke('manageShopSettings', { action: 'save', ...heroData, payment_link: paymentLink });
        return res.data.item;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSettings'] });
      queryClient.invalidateQueries({ queryKey: ['shopData'] });
    }
  });

  const handleSaveProduct = () => {
    const { id, ...fields } = editingProduct;
    if (id) {
      updateProductMutation.mutate({ id, ...fields });
    } else {
      createProductMutation.mutate(fields);
    }
  };

  const handleSaveSection = () => {
    const { id, ...fields } = editingSection;
    if (fields.parent_section_id === '') fields.parent_section_id = null;
    if (id) {
      updateSectionMutation.mutate({ id, ...fields });
    } else {
      createSectionMutation.mutate(fields);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setEditingProduct({ ...editingProduct, image_url: file_url });
  };

  const handleAdditionalImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setEditingProduct({
      ...editingProduct,
      images: [...(editingProduct.images || []), file_url]
    });
  };

  const handleDigitalUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDigitalUploadBusy(true);
    setDigitalUploadError('');
    try {
      const { object_key } = await appClient.integrations.Core.UploadDigitalFile({ file, folder: 'products' });
      setEditingProduct((current) => ({ ...current, r2_object_key: object_key }));
    } catch (error) {
      setDigitalUploadError(error.message || 'Téléversement impossible');
    } finally {
      setDigitalUploadBusy(false);
      e.target.value = '';
    }
  };

  const handleHeroImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setHeroImage(file_url);
  };

  const handleHeroVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setHeroVideo(file_url);
  };

  const handleSectionImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setEditingSection({ ...editingSection, banner_image: file_url });
  };

  const handleSectionVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setEditingSection({ ...editingSection, banner_video: file_url });
  };

  const handleSectionPromoImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await appClient.integrations.Core.UploadFile({ file });
    setEditingSection({ ...editingSection, promo_image: file_url });
  };

  return (
    <div>
      {/* Payment Link Section */}
      <div className="mb-8 p-4 bg-neutral-950 border border-white/10 rounded-sm">
        <h3 className="text-white text-sm font-light mb-3">Lien de paiement du panier</h3>
        <div className="flex gap-2">
          <Input
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="https://your-payment-link.com"
            className="bg-neutral-900 border-white/10 text-white flex-1"
          />
          <Button
            onClick={() => savePaymentLinkMutation.mutate(paymentLink)}
            disabled={!paymentLink || savePaymentLinkMutation.isPending}
            className="bg-white text-black hover:bg-white/90"
          >
            Enregistrer
          </Button>
        </div>
      </div>

      {/* Hero Banner Section */}
      <div className="mb-8 p-4 bg-neutral-950 border border-white/10 rounded-sm">
        <h3 className="text-white text-sm font-light mb-4">Bannière principale du shop</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-white text-sm mb-1">Texte marketing</label>
            <Input
              value={heroText}
              onChange={(e) => setHeroText(e.target.value)}
              placeholder="Texte affiché sur la bannière"
              className="bg-neutral-900 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="block text-white text-sm mb-1">Lien de redirection (optionnel)</label>
            <Input
              value={heroLink}
              onChange={(e) => setHeroLink(e.target.value)}
              placeholder="https://..."
              className="bg-neutral-900 border-white/10 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white text-sm mb-2">Image de bannière</label>
              {heroImage && (
                <img src={heroImage} alt="" className="w-full h-24 object-cover rounded-sm mb-2" />
              )}
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" onChange={handleHeroImageUpload} className="hidden" />
                <Button type="button" variant="outline" className="w-full border-white/20 text-white pointer-events-none">
                  <Upload size={16} className="mr-2" />
                  Choisir une image
                </Button>
              </label>
            </div>
            <div>
              <label className="block text-white text-sm mb-2">Vidéo de bannière (prioritaire)</label>
              {heroVideo && (
                <video src={heroVideo} className="w-full h-24 object-cover rounded-sm mb-2" muted />
              )}
              <label className="block cursor-pointer">
                <input type="file" accept="video/*" onChange={handleHeroVideoUpload} className="hidden" />
                <Button type="button" variant="outline" className="w-full border-white/20 text-white pointer-events-none">
                  <Upload size={16} className="mr-2" />
                  Choisir une vidéo
                </Button>
              </label>
            </div>
          </div>
          <Button onClick={() => saveHeroMutation.mutate()} disabled={saveHeroMutation.isPending} className="w-full bg-white text-black hover:bg-white/90">
            Enregistrer la bannière
          </Button>
        </div>
      </div>

      {/* Sections Management */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-sm font-light flex items-center gap-2">
            <FolderPlus size={16} />
            Sections de la boutique
          </h3>
          <Button
            onClick={() => setEditingSection({ name: '', description: '', order: sections.length + 1, is_active: true, banner_image: '', banner_video: '', promo_text: '', promo_image: '', parent_section_id: '' })}
            className="bg-white text-black hover:bg-white/90"
          >
            <Plus size={16} className="mr-2" />
            Nouvelle section
          </Button>
        </div>

        <div className="space-y-2">
          {sections.filter(s => !s.parent_section_id).map((section) => (
            <React.Fragment key={section.id}>
              <div
                className={`bg-neutral-950 border border-white/10 rounded-sm p-3 flex items-center justify-between ${!section.is_active && 'opacity-50'}`}
              >
                <div>
                  <span className="text-white font-light">{section.name}</span>
                  {section.description && (
                    <span className="text-white/50 text-xs ml-3">{section.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingSection({ name: '', description: '', order: 0, is_active: true, banner_image: '', banner_video: '', promo_text: '', promo_image: '', parent_section_id: section.id })}
                    className="text-white hover:text-white"
                    title="Ajouter une sous-section"
                  >
                    <Plus size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingSection(section)}
                    className="text-white hover:text-white"
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSectionMutation.mutate(section.id)}
                    className="text-white hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {sections.filter(s => s.parent_section_id === section.id).map((sub) => (
                <div
                  key={sub.id}
                  className={`bg-neutral-900 border border-white/10 rounded-sm p-3 flex items-center justify-between ml-6 ${!sub.is_active && 'opacity-50'}`}
                >
                  <div className="flex items-center gap-2">
                    <ChevronRight size={14} className="text-white/40" />
                    <span className="text-white/70 text-sm font-light">{sub.name}</span>
                    {sub.description && (
                      <span className="text-white/40 text-xs ml-2">{sub.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingSection(sub)}
                      className="text-white hover:text-white"
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSectionMutation.mutate(sub.id)}
                      className="text-white hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
          {sections.filter(s => !s.parent_section_id).length === 0 && (
            <p className="text-white/50 text-xs">Aucune section. Créez-en une pour organiser vos produits.</p>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-lg font-light">Produits</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImport(true)}
            className="border-white/20 text-white hover:bg-white/5"
          >
            <FileSpreadsheet size={16} className="mr-2" />
            Importer XLS
          </Button>
          <Button
            onClick={() => setEditingProduct({
              name: '',
              sku: '',
              variant_skus: {},
              description: '',
              price: '',
              token_price: 0,
              category: 'product',
              section_id: '',
              is_active: true,
              is_digital: false,
              r2_object_key: '',
              drive_file_id: '',
              download_url: '',
              product_options: [],
              images: [],
              policy: '',
              shipping: '',
              stock: {},
              order: products.length + 1
            })}
            className="bg-white text-black hover:bg-white/90"
          >
            <Plus size={16} className="mr-2" />
            Nouveau produit
          </Button>
        </div>
      </div>

      {/* Product List (grouped by section) */}
      <AdminProductList
        products={products}
        sections={sections}
        onEdit={setEditingProduct}
        onDelete={(id) => deleteProductMutation.mutate(id)}
        onAdd={(sectionId) => setEditingProduct({
          name: '',
          description: '',
          price: '',
          token_price: 0,
          category: 'product',
          section_id: sectionId || '',
          is_active: true,
          is_digital: false,
          r2_object_key: '',
          drive_file_id: '',
          download_url: '',
          product_options: [],
          images: [],
          policy: '',
          shipping: '',
          order: products.length + 1
        })}
      />

      {/* Edit Section Dialog */}
      <Dialog open={!!editingSection} onOpenChange={() => setEditingSection(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">
              {editingSection?.id ? 'Modifier' : 'Nouvelle'} section
            </DialogTitle>
          </DialogHeader>
          {editingSection && (
            <div className="space-y-4 mt-4 pb-4">
              <Input
                value={editingSection.name}
                onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                placeholder="Nom de la section"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Textarea
                value={editingSection.description || ''}
                onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                placeholder="Description"
                className="bg-neutral-900 border-white/10 text-white"
                rows={2}
              />
              <div>
                <label className="block text-white text-sm mb-2">Texte promotionnel de la section</label>
                <Textarea
                  value={editingSection.promo_text || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, promo_text: e.target.value })}
                  placeholder="Texte promo affiché sur la bannière de section"
                  className="bg-neutral-900 border-white/10 text-white"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white text-sm mb-2">Image de bannière</label>
                  {editingSection.banner_image && (
                    <img src={editingSection.banner_image} alt="" className="w-full h-24 object-cover rounded-sm mb-2" />
                  )}
                  <label className="block cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleSectionImageUpload} className="hidden" />
                    <Button type="button" variant="outline" className="w-full border-white/20 text-white pointer-events-none">
                      <Upload size={16} className="mr-2" />
                      Image
                    </Button>
                  </label>
                </div>
                <div>
                  <label className="block text-white text-sm mb-2">Vidéo de bannière (prioritaire)</label>
                  {editingSection.banner_video && (
                    <video src={editingSection.banner_video} className="w-full h-24 object-cover rounded-sm mb-2" muted />
                  )}
                  <label className="block cursor-pointer">
                    <input type="file" accept="video/*" onChange={handleSectionVideoUpload} className="hidden" />
                    <Button type="button" variant="outline" className="w-full border-white/20 text-white pointer-events-none">
                      <Upload size={16} className="mr-2" />
                      Vidéo
                    </Button>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-white text-sm mb-2">Image promotionnelle (optionnelle)</label>
                {editingSection.promo_image && (
                  <img src={editingSection.promo_image} alt="" className="w-full h-24 object-cover rounded-sm mb-2" />
                )}
                <label className="block cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleSectionPromoImageUpload} className="hidden" />
                  <Button type="button" variant="outline" className="w-full border-white/20 text-white pointer-events-none">
                    <Upload size={16} className="mr-2" />
                    Image promo
                  </Button>
                </label>
              </div>
              <div>
                <label className="block text-white text-sm mb-2">Section parente (optionnel)</label>
                <Select
                  value={editingSection.parent_section_id || 'none'}
                  onValueChange={(value) => setEditingSection({ ...editingSection, parent_section_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                    <SelectValue placeholder="Aucune (section principale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune (section principale)</SelectItem>
                    {sections.filter(s => s.id !== editingSection.id && !s.parent_section_id).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                type="number"
                value={editingSection.order}
                onChange={(e) => setEditingSection({ ...editingSection, order: parseInt(e.target.value) || 0 })}
                placeholder="Ordre"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">Active</span>
                <Switch
                  checked={editingSection.is_active !== false}
                  onCheckedChange={(checked) => setEditingSection({ ...editingSection, is_active: checked })}
                />
              </div>
              <Button onClick={handleSaveSection} className="w-full bg-white text-black hover:bg-white/90">
                Enregistrer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">
              {editingProduct?.id ? 'Modifier' : 'Nouveau'} produit
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 mt-4 pb-4">
              <Input
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                placeholder="Nom"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <div>
                <label className="block text-white text-sm mb-1">SKU (fournisseur dreamlove.es)</label>
                <Input
                  value={editingProduct.sku || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  placeholder="ex: D-196690"
                  className="bg-neutral-900 border-white/10 text-white"
                />
                <p className="text-white/50 text-xs mt-1">Code SKU du fournisseur. Utilisé pour la synchronisation automatique du stock.</p>
              </div>
              <Textarea
                value={editingProduct.description || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                placeholder="Description"
                className="bg-neutral-900 border-white/10 text-white"
                rows={3}
              />
              <div>
                <label className="block text-white text-sm mb-1">Livraison</label>
                <Textarea
                  value={editingProduct.shipping || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, shipping: e.target.value })}
                  placeholder="Informations de livraison (délais, frais, zones couvertes...)"
                  className="bg-neutral-900 border-white/10 text-white"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-1">Politique (retour, échange, garantie)</label>
                <Textarea
                  value={editingProduct.policy || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, policy: e.target.value })}
                  placeholder="Politique de retour, d'échange et de garantie"
                  className="bg-neutral-900 border-white/10 text-white"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white text-sm mb-1">Prix (argent)</label>
                  <Input
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    placeholder="ex: 29.99 $"
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-white text-sm mb-1">Prix (tokens)</label>
                  <Input
                    type="number"
                    value={editingProduct.token_price || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, token_price: parseInt(e.target.value) || 0 })}
                    placeholder="0 = non disponible"
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                </div>
              </div>
              <Input
                value={editingProduct.external_link || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, external_link: e.target.value })}
                placeholder="Lien de paiement externe"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <div>
                <label className="block text-white text-sm mb-2">Image</label>
                {editingProduct.image_url && (
                  <img src={editingProduct.image_url} alt="" className="w-full max-h-64 object-contain rounded-sm mb-2 bg-neutral-900" />
                )}
                <Input
                  value={editingProduct.image_url || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })}
                  placeholder="URL de l'image (https://...)"
                  className="bg-neutral-900 border-white/10 text-white mb-2"
                />
                <label className="block cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <Button type="button" variant="outline" className="w-full border-white/20 text-white pointer-events-none">
                    <Upload size={16} className="mr-2" />
                    Choisir une image (ou coller l'URL ci-dessus)
                  </Button>
                </label>
              </div>

              {/* Multiple Images */}
              <div>
                <label className="block text-white text-sm mb-2">Images supplémentaires (galerie) — {editingProduct.images?.length || 0} image(s)</label>
                {editingProduct.images && editingProduct.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {editingProduct.images.map((img, idx) => (
                      <div key={idx} className="relative aspect-square bg-neutral-900 rounded-sm overflow-hidden group">
                        <img src={img} alt="" className="w-full h-full object-contain" />
                        <button
                          onClick={() => {
                            const newImages = editingProduct.images.filter((_, i) => i !== idx);
                            setEditingProduct({ ...editingProduct, images: newImages });
                          }}
                          className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs z-10"
                        >
                          <X size={14} />
                        </button>
                        <a href={img} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
                          <ExternalLink size={16} className="text-white" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                <Input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Coller une ou plusieurs URLs d'images (séparées par virgule)"
                  className="bg-neutral-900 border-white/10 text-white mb-2"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!newImageUrl.trim()) return;
                    const urls = newImageUrl.split(',').map(u => u.trim()).filter(u => u);
                    setEditingProduct({ ...editingProduct, images: [...(editingProduct.images || []), ...urls] });
                    setNewImageUrl('');
                  }}
                  className="w-full border-white/20 text-white mb-2"
                >
                  <Plus size={16} className="mr-2" />
                  Ajouter les URLs
                </Button>
                <label className="block cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleAdditionalImageUpload} className="hidden" />
                  <Button type="button" variant="outline" className="w-full border-white/20 text-white pointer-events-none">
                    <Upload size={16} className="mr-2" />
                    Ajouter une image (fichier)
                  </Button>
                </label>
              </div>

              {/* Category */}
              <div>
                <label className="block text-white text-sm mb-2">Catégorie</label>
                <Select
                  value={editingProduct.category || 'product'}
                  onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}
                >
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Produit</SelectItem>
                    <SelectItem value="access">Accès</SelectItem>
                    <SelectItem value="support">Soutien</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-white text-sm mb-2">Section</label>
                <Select
                  value={editingProduct.section_id || 'none'}
                  onValueChange={(value) => setEditingProduct({ ...editingProduct, section_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                    <SelectValue placeholder="Aucune section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune section</SelectItem>
                    {sections.filter(s => !s.parent_section_id).map(s => (
                      <React.Fragment key={s.id}>
                        <SelectItem value={s.id}>{s.name}</SelectItem>
                        {sections.filter(sub => sub.parent_section_id === s.id).map(sub => (
                          <SelectItem key={sub.id} value={sub.id}>↳ {sub.name}</SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">Actif</span>
                <Switch
                  checked={editingProduct.is_active !== false}
                  onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, is_active: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">Produit digital (téléchargeable)</span>
                <Switch
                  checked={editingProduct.is_digital === true}
                  onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, is_digital: checked })}
                />
              </div>
              {editingProduct.is_digital && (
                <div className="space-y-2">
                  <label className="block text-white text-sm">Fichier numérique privé</label>
                  <input id="product-digital-upload" type="file" onChange={handleDigitalUpload} className="hidden" />
                  <label htmlFor="product-digital-upload" className={`inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-black ${digitalUploadBusy ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:bg-white/90'}`}>
                    <Upload size={16} />
                    {digitalUploadBusy ? 'Envoi en cours…' : 'Choisir et envoyer le fichier'}
                  </label>
                  <Input
                    value={editingProduct.r2_object_key || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, r2_object_key: e.target.value })}
                    placeholder="Le chemin sécurisé apparaîtra ici"
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                  <p className="text-white/50 text-xs">
                    Le fichier reste privé dans Supabase. Un lien temporaire est créé seulement pour l’acheteur.
                  </p>
                  {digitalUploadError && <p className="text-red-400 text-xs">{digitalUploadError}</p>}
                  <label className="block text-white text-sm mt-3">Google Drive File ID (legacy)</label>
                  <Input
                    value={editingProduct.drive_file_id || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, drive_file_id: e.target.value })}
                    placeholder="ex: 1a2b3c4d5e6f..."
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                  <label className="block text-white text-sm mt-3">URL de téléchargement direct (legacy)</label>
                  <Input
                    value={editingProduct.download_url || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, download_url: e.target.value })}
                    placeholder="https://..."
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                </div>
              )}

              {/* Stock par variante */}
              <div>
                <label className="block text-white text-sm mb-2 flex items-center gap-2">
                  <Boxes size={16} />
                  Stock par variante
                </label>
                {(() => {
                  // Collect all variant values from product_options
                  const allValues = (editingProduct.product_options || []).flatMap(opt => opt.values || []);
                  const variantKeys = allValues.length > 0 ? allValues : ['_default'];
                  const stock = editingProduct.stock || {};

                  const updateStock = (key, value) => {
                    const newStock = { ...stock };
                    const num = parseInt(value) || 0;
                    if (num === 0 && key !== '_default') {
                      delete newStock[key];
                    } else if (key === '_default' && num === 0) {
                      delete newStock[key];
                    } else {
                      newStock[key] = num;
                    }
                    setEditingProduct({ ...editingProduct, stock: newStock });
                  };

                  const totalStock = Object.values(stock).reduce((sum, n) => sum + (Number(n) || 0), 0);

                  return (
                    <div className="p-3 bg-neutral-900 rounded border border-white/10">
                      {allValues.length === 0 ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            value={stock['_default'] || ''}
                            onChange={(e) => updateStock('_default', e.target.value)}
                            placeholder="0"
                            className="bg-neutral-800 border-white/10 text-white w-24"
                          />
                          <span className="text-white/60 text-sm">unités en stock (produit sans variantes)</span>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {variantKeys.map((key) => (
                              <div key={key} className="flex flex-col gap-1">
                                <label className="text-white/50 text-xs">{key}</label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={stock[key] || ''}
                                  onChange={(e) => updateStock(key, e.target.value)}
                                  placeholder="0"
                                  className="bg-neutral-800 border-white/10 text-white"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-white/60">Total: </span>
                            <span className={`font-bold ${totalStock === 0 ? 'text-red-400' : totalStock <= 5 ? 'text-orange-400' : 'text-green-400'}`}>
                              {totalStock} unités
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Product Options */}
              <div>
                <label className="block text-white text-sm mb-2">Options du produit (tailles, couleurs, etc.)</label>
                {(editingProduct.product_options || []).map((opt, optIdx) => (
                  <div key={optIdx} className="mb-3 p-3 bg-neutral-900 rounded border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Input
                        value={opt.name}
                        onChange={(e) => {
                          const newOpts = [...(editingProduct.product_options || [])];
                          newOpts[optIdx].name = e.target.value;
                          setEditingProduct({ ...editingProduct, product_options: newOpts });
                        }}
                        placeholder="Nom de l'option (ex: Taille)"
                        className="bg-neutral-800 border-white/10 text-white flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newOpts = (editingProduct.product_options || []).filter((_, i) => i !== optIdx);
                          setEditingProduct({ ...editingProduct, product_options: newOpts });
                        }}
                        className="text-white hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map((val, valIdx) => (
                        <div key={valIdx} className="flex items-center gap-1 bg-neutral-800 rounded px-2 py-1">
                          <input
                            value={val}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              const oldVal = opt.values[valIdx];
                              const newOpts = [...(editingProduct.product_options || [])];
                              newOpts[optIdx].values[valIdx] = newVal;
                              const newSkus = { ...(editingProduct.variant_skus || {}) };
                              const newStock = { ...(editingProduct.stock || {}) };
                              if (oldVal !== newVal) {
                                if (newSkus[oldVal] !== undefined) { newSkus[newVal] = newSkus[oldVal]; delete newSkus[oldVal]; }
                                if (newStock[oldVal] !== undefined) { newStock[newVal] = newStock[oldVal]; delete newStock[oldVal]; }
                              }
                              setEditingProduct({ ...editingProduct, product_options: newOpts, variant_skus: newSkus, stock: newStock });
                            }}
                            className="bg-transparent border-0 text-white text-sm w-16 outline-none"
                          />
                          <input
                            value={(editingProduct.variant_skus || {})[val] || ''}
                            onChange={(e) => {
                              const newSkus = { ...(editingProduct.variant_skus || {}) };
                              if (e.target.value.trim()) { newSkus[val] = e.target.value.trim(); } else { delete newSkus[val]; }
                              setEditingProduct({ ...editingProduct, variant_skus: newSkus });
                            }}
                            placeholder="SKU"
                            className="bg-transparent border-0 text-white/50 text-xs w-24 outline-none"
                          />
                          <button
                            onClick={() => {
                              const newOpts = [...(editingProduct.product_options || [])];
                              newOpts[optIdx].values = newOpts[optIdx].values.filter((_, i) => i !== valIdx);
                              const newSkus = { ...(editingProduct.variant_skus || {}) };
                              const newStock = { ...(editingProduct.stock || {}) };
                              delete newSkus[val];
                              delete newStock[val];
                              setEditingProduct({ ...editingProduct, product_options: newOpts, variant_skus: newSkus, stock: newStock });
                            }}
                            className="text-white/50 hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const newOpts = [...(editingProduct.product_options || [])];
                          newOpts[optIdx].values = [...newOpts[optIdx].values, ''];
                          setEditingProduct({ ...editingProduct, product_options: newOpts });
                        }}
                        className="text-white/50 hover:text-white text-sm px-2 py-1 flex items-center gap-1"
                      >
                        <Plus size={12} /> Valeur
                      </button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingProduct({
                      ...editingProduct,
                      product_options: [...(editingProduct.product_options || []), { name: '', values: [] }]
                    });
                  }}
                  className="w-full border-white/20 text-white"
                >
                  <Plus size={16} className="mr-2" />
                  Ajouter une option
                </Button>
                <p className="text-white/50 text-xs mt-1">SKU du fournisseur (dreamlove.es) à côté de chaque valeur — pour la synchro automatique du stock.</p>
              </div>

              <Input
                type="number"
                value={editingProduct.order}
                onChange={(e) => setEditingProduct({ ...editingProduct, order: parseInt(e.target.value) })}
                placeholder="Ordre"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Button
                onClick={handleSaveProduct}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                Enregistrer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ProductImportModal open={showImport} onOpenChange={setShowImport} />
    </div>
  );
}
