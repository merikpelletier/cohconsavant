import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, Package, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

export default function MyDownloads() {
  const { user, isLoadingAuth } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});

  // All products — to detect which orders contain digital downloads
  const { data: products = [] } = useQuery({
    queryKey: ['allProducts'],
    queryFn: () => appClient.entities.Product.list(),
  });
  const productMap = {};
  for (const p of products) productMap[p.id] = p;

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['myOrders', user?.email],
    queryFn: async () => {
      const results = await appClient.entities.Order.filter({
        customer_email: user.email,
        status: 'completed',
      });
      return results;
    },
    enabled: !!user?.email,
  });

  if (!isLoadingAuth && !user) {
    appClient.auth.redirectToLogin(window.location.href);
  }

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const ordersWithDigital = orders
    .map((order) => {
      const digitalItems = (order.items || []).filter(
        (i) => productMap[i.id]?.is_digital && productMap[i.id]?.r2_object_key
      );
      // Dossier digital products (R2-secured or legacy direct URL)
      const directItems = (order.items || []).filter(
        (i) => i.options?.is_digital
      );
      return { order, digitalItems, directItems };
    })
    .filter((o) => o.digitalItems.length > 0 || o.directItems.length > 0);

  const handleDownload = async (order) => {
    setBusy((s) => ({ ...s, [order.id]: true }));
    setErrors((s) => ({ ...s, [order.id]: null }));
    try {
      const res = await appClient.functions.invoke('getR2DownloadLink', { orderId: order.id });
      const downloads = res.data?.downloads || [];
      downloads.forEach((d, i) => {
        setTimeout(() => window.open(d.download_url, '_blank'), i * 900);
      });
      queryClient.invalidateQueries({ queryKey: ['myOrders', user?.email] });
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Download failed';
      setErrors((s) => ({ ...s, [order.id]: msg }));
    } finally {
      setBusy((s) => ({ ...s, [order.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-black pb-24 pt-8">
      {/* Header */}
      <div className="px-6 mb-8">
        <h1 className="text-white text-3xl font-extralight tracking-widest">MY DOWNLOADS</h1>
        <div className="w-12 h-0.5 bg-red-600 mt-4" />
        <p className="text-white text-sm mt-4">
          Your digital purchases. Each download link is single-use and expires shortly after it's issued.
        </p>
      </div>

      {ordersLoading ? (
        <div className="px-6 flex items-center justify-center py-16">
          <Loader2 className="text-white/40 animate-spin" size={28} />
        </div>
      ) : ordersWithDigital.length === 0 ? (
        <div className="px-6 flex flex-col items-center justify-center py-16 text-center">
          <Package size={48} className="text-white/30 mb-4" />
          <h2 className="text-white text-xl font-light tracking-wide mb-2">No downloads yet</h2>
          <p className="text-white/50 text-sm">
            Your completed digital purchases will appear here.
          </p>
          <Link to={createPageUrl('Boutique')} className="mt-6">
            <Button variant="outline" className="border-white/20 text-white font-light tracking-wide">
              Browse the shop
            </Button>
          </Link>
        </div>
      ) : (
        <div className="px-6 space-y-4">
          {ordersWithDigital.map(({ order, digitalItems, directItems }, idx) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-neutral-950 border border-white/10 rounded-sm p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-light text-sm truncate">
                    {[...digitalItems, ...directItems].map((i) => i.name).join(', ')}
                  </h3>
                  <p className="text-white/40 text-xs mt-1">
                    Order #{order.order_id} · ${(order.total ?? 0).toFixed(2)}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {order.payment_date
                      ? new Date(order.payment_date).toLocaleDateString('en-CA')
                      : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {directItems.length > 0 ? (
                    order.download_consumed ? (
                      <span className="text-white/40 text-xs text-right max-w-[180px]">
                        Download link issued — single-use, expires ~10 min after purchase.
                      </span>
                    ) : directItems.some((i) => i.options?.download_url) ? (
                      directItems.filter((i) => i.options?.download_url).map((i, di) => (
                        <a
                          key={di}
                          href={i.options.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button className="bg-red-600 text-white hover:bg-red-500 font-light tracking-wide">
                            <Download size={16} className="mr-2" />
                            Download
                          </Button>
                        </a>
                      ))
                    ) : null
                  ) : order.download_consumed ? (
                    <span className="text-white/40 text-xs text-right max-w-[160px]">
                      Download link already used. Contact support if you need it reset.
                    </span>
                  ) : (
                    <Button
                      onClick={() => handleDownload(order)}
                      disabled={!!busy[order.id]}
                      className="bg-red-600 text-white hover:bg-red-500 font-light tracking-wide"
                    >
                      {busy[order.id] ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Preparing…
                        </>
                      ) : (
                        <>
                          <Download size={16} className="mr-2" />
                          Download
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              {errors[order.id] && (
                <div className="mt-3 flex items-start gap-2 text-red-400 text-xs">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>{errors[order.id]}</span>
                </div>
              )}
              {!order.download_consumed && (
                <p className="text-white/30 text-[11px] mt-3">
                  A secure link will open in a new tab. It works once and expires in ~10 minutes.
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <div className="px-6 mt-8">
        <Link to={createPageUrl('Cart')}>
          <Button variant="ghost" className="text-white/60 hover:text-white font-light tracking-wide">
            Back to cart
          </Button>
        </Link>
      </div>
    </div>
  );
}