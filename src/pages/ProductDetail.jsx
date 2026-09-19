import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/lib/AuthContext';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { ArrowLeft, ShoppingCart, Check, Coins, AlertCircle, Loader2, Truck, ShieldCheck } from 'lucide-react';

export default function ProductDetail() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');

  const [added, setAdded] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const navigate = useNavigate();
  const { user } = useAuth();
  const { balance, refresh } = useTokenBalance(user?.email);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await appClient.functions.invoke('getProduct', { id: productId });
      return res.data.product || res.data.item;
    },
    enabled: !!productId,
  });

  useEffect(() => {
    setCurrentImage(0);
    setSelectedOptions({});
  }, [productId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const addToCart = () => {
    const cart = JSON.parse(sessionStorage.getItem('cochon_cart') || '[]');
    const optKey = JSON.stringify(selectedOptions);
    const existing = cart.find(item => item.id === product.id && JSON.stringify(item.selectedOptions || {}) === optKey);

    let newCart;
    if (existing) {
      newCart = cart.map(item =>
        item.id === product.id && JSON.stringify(item.selectedOptions || {}) === optKey
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, { ...product, quantity: 1, selectedOptions }];
    }

    sessionStorage.setItem('cochon_cart', JSON.stringify(newCart));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const allOptionsSelected = !product?.product_options || product.product_options.length === 0 || product.product_options.every(opt => selectedOptions[opt.name]);

  const buyWithTokens = async () => {
    if (!user) {
      appClient.auth.redirectToLogin(window.location.href);
      return;
    }
    setPurchasing(true);
    setPurchaseError(null);
    try {
      await appClient.functions.invoke('purchaseShopProduct', { product_id: product.id });
      refresh();
      if (product.is_digital) {
        navigate(createPageUrl('MyDownloads'));
      } else {
        navigate(createPageUrl('Cart'));
      }
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Échec de l\'achat';
      setPurchaseError(msg);
    } finally {
      setPurchasing(false);
    }
  };

  const tokenPrice = product?.token_price || 0;
  const hasTokenPrice = tokenPrice > 0;

  if (!product) {
    return (
      <div className="min-h-screen bg-black pb-20 pt-8">
        <div className="px-6">
          <Link
            to={createPageUrl('Boutique')}
            className="inline-flex items-center gap-2 text-white hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm tracking-wide">Retour</span>
          </Link>
          <p className="text-white text-center mt-20">Produit non trouvé</p>
        </div>
      </div>
    );
  }

  const productImages = [product.image_url, ...(Array.isArray(product.images) ? product.images : [])]
    .filter((url, index, items) => url && !/^https?:\/\/(www\.)?example\.com\//i.test(url) && items.indexOf(url) === index);

  return (
    <div className="min-h-screen bg-black pb-20 pt-8">
      <div className="px-6">
        {/* Back Button */}
        <Link
          to={createPageUrl('Boutique')}
          className="inline-flex items-center gap-2 text-white hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm tracking-wide">Retour</span>
        </Link>

        {/* Product Images */}
        {productImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="aspect-[4/3] rounded-sm overflow-hidden mb-2">
              <img
                src={productImages[currentImage] || productImages[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
            {productImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImage(idx)}
                    className={`w-16 h-16 rounded-sm overflow-hidden flex-shrink-0 ${currentImage === idx ? 'ring-2 ring-white' : 'ring-1 ring-white/20'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Product Options */}
        {product.product_options && product.product_options.length > 0 && (
          <div className="mb-8 space-y-4">
            {product.product_options.map(opt => {
              const hasStockTracking = product.stock && Object.keys(product.stock).length > 0;

              return (
                <div key={opt.name}>
                  <div className="text-white text-sm mb-2 uppercase tracking-wider">{opt.name}</div>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map(val => {
                      const stockCount = hasStockTracking ? (product.stock[val] ?? 0) : null;
                      const outOfStock = stockCount !== null && stockCount === 0;

                      return (
                        <button
                          key={val}
                          onClick={() => !outOfStock && setSelectedOptions({ ...selectedOptions, [opt.name]: val })}
                          disabled={outOfStock}
                          className={`px-4 py-2 rounded-sm text-sm transition-colors ${
                            outOfStock
                              ? 'bg-neutral-900 border border-white/10 text-white/25 cursor-not-allowed line-through'
                              : selectedOptions[opt.name] === val
                              ? 'bg-white text-black'
                              : 'bg-neutral-900 border border-white/20 text-white'
                          }`}
                        >
                          {val}
                          {stockCount !== null && stockCount > 0 && (
                            <span className={`ml-1.5 text-xs ${selectedOptions[opt.name] === val ? 'text-black/50' : 'text-white/40'}`}>
                              · {stockCount}
                            </span>
                          )}
                          {outOfStock && (
                            <span className="ml-1.5 text-xs text-red-500/50">Rupture</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Product Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-white text-3xl font-extralight tracking-widest mb-4">
            {product.name}
          </h1>
          <div className="w-12 h-0.5 bg-red-600 mb-8" />

          {product.description && (
            <p className="text-white font-light leading-relaxed mb-8">
              {product.description}
            </p>
          )}

          {/* Token Purchase */}
          {hasTokenPrice && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-white text-3xl font-light flex items-center">
                  <Coins size={22} className="mr-2 text-red-500" />
                  {tokenPrice} tokens
                </span>
              </div>
              <p className="text-white/50 text-xs mb-6">
                Achat immédiat avec vos tokens
              </p>

              {user && (
                <p className="text-white/60 text-sm mb-4">
                  Solde : {balance ?? '…'} tokens
                </p>
              )}

              <Button
                onClick={buyWithTokens}
                disabled={purchasing || (balance != null && balance < tokenPrice)}
                className="w-full bg-red-600 text-white hover:bg-red-500 font-light tracking-widest h-12"
              >
                {purchasing ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Traitement…
                  </>
                ) : (
                  <>
                    <Coins size={18} className="mr-2" />
                    Acheter avec {tokenPrice} tokens
                  </>
                )}
              </Button>

              {balance != null && balance < tokenPrice && (
                <Link to={createPageUrl('Studio')} className="block mt-3">
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white hover:text-black">
                    Obtenir plus de tokens
                  </Button>
                </Link>
              )}

              {purchaseError && (
                <div className="mt-4 flex items-start gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{purchaseError}</span>
                </div>
              )}
            </>
          )}

          {/* Divider */}
          {hasTokenPrice && product.price && (
            <div className="my-8 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-xs">OU</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
          )}

          {/* Money Purchase */}
          {product.price && (
            <>
              <div className="flex items-center justify-between mb-8">
                <span className="text-white text-3xl font-light">
                  {product.price}
                </span>
              </div>

              <Button
                onClick={addToCart}
                className="w-full bg-white text-black hover:bg-white/90 font-light tracking-widest h-12"
                disabled={added || !allOptionsSelected}
              >
                {added ? (
                  <>
                    <Check size={18} className="mr-2" />
                    Ajouté au panier
                  </>
                ) : !allOptionsSelected ? (
                  'Sélectionnez toutes les options'
                ) : (
                  <>
                    <ShoppingCart size={18} className="mr-2" />
                    Ajouter au panier
                  </>
                )}
              </Button>

              <Link to={createPageUrl('Cart')}>
                <Button
                  variant="outline"
                  className="w-full mt-4 border-white/20 text-white hover:bg-white hover:text-black"
                >
                  Voir le panier
                </Button>
              </Link>
            </>
          )}
        </motion.div>

        {/* Shipping & Policy */}
        {(product.shipping || product.policy) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 space-y-6"
          >
            {product.shipping && (
              <div>
                <h2 className="text-white text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Truck size={16} className="text-red-500" />
                  Livraison
                </h2>
                <p className="text-white/70 text-sm font-light leading-relaxed whitespace-pre-line">
                  {product.shipping}
                </p>
              </div>
            )}
            {product.policy && (
              <div>
                <h2 className="text-white text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-red-500" />
                  Politique
                </h2>
                <p className="text-white/70 text-sm font-light leading-relaxed whitespace-pre-line">
                  {product.policy}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
