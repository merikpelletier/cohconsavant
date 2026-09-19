import React, { useState, useEffect } from 'react';
import { appClient } from '@/api/appClient';
import { X, Loader2 } from 'lucide-react';
import { addTokenPackageToCart } from '@/lib/tokenPackageCart';

export default function TokenPurchaseModal({ onClose, onPurchased }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState(null);

  useEffect(() => {
    appClient.functions.invoke('manageTokenPackage', { action: 'list' })
      .then((res) => {
        const activePackages = (res.data?.items || [])
          .filter((pkg) => pkg.is_active !== false)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setPackages(activePackages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = (pkg) => {
    setBuyingId(pkg.id);
    onPurchased?.();
    onClose?.();
    addTokenPackageToCart(pkg);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-red-500 rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-black text-xl font-black">Acheter des jetons</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20">
            <X size={16} className="text-black" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-black" /></div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleBuy(pkg)}
                disabled={!!buyingId}
                className="w-full p-4 bg-black text-red-500 rounded-2xl flex items-center justify-between hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="font-bold text-lg">{pkg.name}</p>
                  <p className="text-white text-sm">{pkg.token_amount} jetons {pkg.bonus_percentage > 0 ? `+ ${pkg.bonus_percentage} % de bonus` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">${pkg.price}</p>
                  <p className="text-white text-xs">CAD</p>
                </div>
              </button>
            ))}
            {packages.length === 0 && (
              <p className="text-black text-center py-4">Aucun pack de jetons disponible</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
