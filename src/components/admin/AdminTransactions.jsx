import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { CalendarDays, CheckCircle2, DollarSign, Landmark, ReceiptText, WalletCards, X } from 'lucide-react';

const money = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
const shortDate = new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
const currentMonth = new Date().toISOString().slice(0, 7);

const numeric = (value) => Number(value || 0);
const monthOf = (value) => value ? String(value).slice(0, 7) : '';
const safeDate = (value) => value
  ? shortDate.format(new Date(String(value).length === 10 ? `${value}T12:00:00` : value))
  : '—';

function buildEntries(data) {
  const orders = (data.orders || []).map((item) => ({
    id: `order-${item.id}`,
    category: 'Vente',
    date: item.payment_date || item.created_date,
    month: monthOf(item.payment_date || item.created_date),
    label: item.items?.map?.((product) => product.name).filter(Boolean).join(', ') || `Commande ${item.order_id}`,
    party: item.customer_name || item.customer_email || 'Client',
    reference: item.order_id,
    amount: numeric(item.total),
    tax: numeric(item.tps) + numeric(item.tvq),
    status: item.status || 'pending',
  }));
  const sponsors = (data.sponsorSales || []).map((item) => ({
    id: `sponsor-${item.id}`,
    category: 'Commandite',
    date: item.sale_date || item.created_date,
    month: item.payout_month || monthOf(item.sale_date || item.created_date),
    label: item.bracket_name || 'Vente de commandite',
    party: item.member_email || 'Membre',
    reference: item.bracket_id,
    amount: numeric(item.total_amount),
    tax: 0,
    status: 'completed',
  }));
  const earnings = (data.memberEarnings || []).map((item) => ({
    id: `earning-${item.id}`,
    category: 'Paiement membre',
    date: item.paid_at || item.created_date,
    month: item.payout_month || monthOf(item.created_date),
    label: `Versement ${item.payout_month || ''}`.trim(),
    party: item.member_email || 'Membre',
    reference: item.payout_month,
    amount: -numeric(item.member_total),
    tax: 0,
    status: item.status || 'pending',
  }));
  const tokens = (data.tokenTransactions || []).map((item) => ({
    id: `token-${item.id}`,
    category: 'Crédits',
    date: item.created_at || item.created_date,
    month: monthOf(item.created_at || item.created_date),
    label: ({ purchase: 'Achat de crédits', usage: 'Utilisation de crédits', refund: 'Remboursement de crédits', membership_grant: 'Crédits d’abonnement' })[item.transaction_type] || item.transaction_type,
    party: item.user_email || 'Membre',
    reference: item.payment_id || item.related_entity,
    tokens: numeric(item.token_amount),
    amount: null,
    tax: 0,
    status: 'completed',
  }));
  return [...orders, ...sponsors, ...earnings, ...tokens].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

export default function AdminTransactions() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState('Toutes');
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositForm, setDepositForm] = useState({ deposit_date: new Date().toISOString().slice(0, 10), reference: '', notes: '' });

  const { data = {}, isLoading, error } = useQuery({
    queryKey: ['adminFinancialLedger'],
    queryFn: async () => (await appClient.functions.invoke('getAdminFinancialLedger')).data,
  });
  const entries = useMemo(() => buildEntries(data), [data]);
  const months = useMemo(() => Array.from(new Set([currentMonth, ...entries.map((item) => item.month), ...(data.taxDeposits || []).map((item) => item.tax_month)].filter(Boolean))).sort().reverse(), [entries, data.taxDeposits]);
  const monthOrders = (data.orders || []).filter((item) => item.status === 'completed' && monthOf(item.payment_date || item.created_date) === month);
  const grossSales = monthOrders.reduce((sum, item) => sum + numeric(item.total), 0);
  const tps = monthOrders.reduce((sum, item) => sum + numeric(item.tps), 0);
  const tvq = monthOrders.reduce((sum, item) => sum + numeric(item.tvq), 0);
  const taxTotal = tps + tvq;
  const beforeTax = grossSales - taxTotal;
  const deposit = (data.taxDeposits || []).find((item) => item.tax_month === month);
  const visibleEntries = entries.filter((item) => item.month === month && (category === 'Toutes' || item.category === category));

  const saveDeposit = useMutation({
    mutationFn: async () => (await appClient.functions.invoke('saveTaxDeposit', {
      tax_month: month,
      tps_amount: tps,
      tvq_amount: tvq,
      ...depositForm,
    })).data.item,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminFinancialLedger'] });
      setShowDeposit(false);
    },
  });

  const openDeposit = () => {
    setDepositForm({
      deposit_date: deposit?.deposit_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      reference: deposit?.reference || '',
      notes: deposit?.notes || '',
    });
    setShowDeposit(true);
  };

  if (isLoading) return <p className="py-12 text-center text-white/60">Chargement des transactions…</p>;
  if (error) return <p className="py-12 text-center text-red-400">{error.message}</p>;

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-500">Registre financier</p>
          <h2 className="mt-1 text-2xl font-semibold">Transactions, ventes et paiements</h2>
          <p className="mt-1 text-sm text-white/50">Les taxes proviennent uniquement des montants TPS et TVQ enregistrés dans les commandes.</p>
        </div>
        <label className="text-xs uppercase tracking-wider text-white/60">
          Mois
          <select value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 block min-w-44 rounded border border-white/20 bg-neutral-900 px-3 py-2 text-sm text-white">
            {months.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Ventes encaissées', value: money.format(grossSales), icon: DollarSign },
          { label: 'TPS cumulée', value: money.format(tps), icon: ReceiptText },
          { label: 'TVQ cumulée', value: money.format(tvq), icon: ReceiptText },
          { label: 'Montant hors taxes', value: money.format(beforeTax), icon: WalletCards },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-white/10 bg-neutral-950 p-4">
            <Icon size={18} className="mb-3 text-red-500" />
            <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-lg border p-4 ${deposit ? 'border-green-500/30 bg-green-950/20' : 'border-red-500/30 bg-red-950/20'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {deposit ? <CheckCircle2 className="mt-0.5 text-green-400" /> : <Landmark className="mt-0.5 text-red-400" />}
            <div>
              <p className="font-semibold">Taxes à déposer : {money.format(taxTotal)}</p>
              <p className="text-sm text-white/55">
                {deposit ? `Dépôt enregistré le ${safeDate(deposit.deposit_date)}${deposit.reference ? ` · Réf. ${deposit.reference}` : ''}` : `Aucun dépôt enregistré pour ${month}.`}
              </p>
            </div>
          </div>
          <button onClick={openDeposit} className="rounded bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90">
            {deposit ? 'Modifier le dépôt' : 'Dépôt effectué'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['Toutes', 'Vente', 'Commandite', 'Paiement membre', 'Crédits'].map((value) => (
          <button key={value} onClick={() => setCategory(value)} className={`rounded-full border px-3 py-1.5 text-xs ${category === value ? 'border-white bg-white text-black' : 'border-white/20 text-white/70'}`}>{value}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-neutral-900 text-xs uppercase tracking-wider text-white/45">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Détail</th><th className="px-4 py-3">Membre / client</th><th className="px-4 py-3">Référence</th><th className="px-4 py-3 text-right">Taxes</th><th className="px-4 py-3 text-right">Montant</th><th className="px-4 py-3">Statut</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-neutral-950">
              {visibleEntries.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3 text-white/60">{safeDate(item.date)}</td>
                  <td className="px-4 py-3"><span className="rounded bg-white/10 px-2 py-1 text-xs">{item.category}</span></td>
                  <td className="max-w-64 truncate px-4 py-3">{item.label}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-white/60">{item.party}</td>
                  <td className="max-w-44 truncate px-4 py-3 text-white/45">{item.reference || '—'}</td>
                  <td className="px-4 py-3 text-right text-white/60">{item.tax ? money.format(item.tax) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${item.amount < 0 ? 'text-red-400' : ''}`}>{item.amount == null ? `${item.tokens > 0 ? '+' : ''}${item.tokens} crédits` : money.format(item.amount)}</td>
                  <td className="px-4 py-3 text-xs uppercase text-white/50">{item.status}</td>
                </tr>
              ))}
              {!visibleEntries.length && <tr><td colSpan="8" className="px-4 py-12 text-center text-white/40">Aucune transaction pour ce mois.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showDeposit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowDeposit(false)}>
          <div className="w-full max-w-lg rounded-xl border border-white/15 bg-neutral-950 p-5" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-red-500">{month}</p><h3 className="text-xl font-semibold">Dépôt des taxes</h3></div><button onClick={() => setShowDeposit(false)}><X /></button></div>
            <div className="mb-5 grid grid-cols-3 gap-2 text-sm"><div className="rounded bg-white/5 p-3"><p className="text-white/45">TPS</p><p>{money.format(tps)}</p></div><div className="rounded bg-white/5 p-3"><p className="text-white/45">TVQ</p><p>{money.format(tvq)}</p></div><div className="rounded bg-white/5 p-3"><p className="text-white/45">Total</p><p>{money.format(taxTotal)}</p></div></div>
            <div className="space-y-4">
              <label className="block text-xs uppercase tracking-wider text-white/55">Date du dépôt<input required type="date" value={depositForm.deposit_date} onChange={(event) => setDepositForm({ ...depositForm, deposit_date: event.target.value })} className="mt-1 w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white" /></label>
              <label className="block text-xs uppercase tracking-wider text-white/55">Numéro de référence<input value={depositForm.reference} onChange={(event) => setDepositForm({ ...depositForm, reference: event.target.value })} className="mt-1 w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white" placeholder="Optionnel" /></label>
              <label className="block text-xs uppercase tracking-wider text-white/55">Notes<textarea value={depositForm.notes} onChange={(event) => setDepositForm({ ...depositForm, notes: event.target.value })} className="mt-1 min-h-20 w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white" placeholder="Optionnel" /></label>
              {saveDeposit.error && <p className="text-sm text-red-400">{saveDeposit.error.message}</p>}
              <button disabled={!depositForm.deposit_date || saveDeposit.isPending} onClick={() => saveDeposit.mutate()} className="w-full rounded bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40">{saveDeposit.isPending ? 'Enregistrement…' : 'Enregistrer le dépôt effectué'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
