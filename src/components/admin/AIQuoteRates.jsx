import React, { useState } from 'react';

export default function AIQuoteRates({ models, rates, saveRate }) {
  const [drafts, setDrafts] = useState({});
  const field = 'mt-1 w-full rounded border border-white/20 bg-neutral-900 p-2 text-white';
  return <section className="rounded-lg border border-white/10 bg-neutral-950 p-4">
    <h3 className="font-semibold">Tarifs Replicate et devis</h3>
    <p className="my-3 text-sm text-white/60">Montants fournisseur en USD. Activez les devis seulement après vérification du tarif, des options et des limites. Un tarif unique doit couvrir toutes les options proposées par le service.</p>
    {models.map((model) => {
      const value = drafts[model] || rates.find((item) => item.model_key === model) || {};
      const change = (key, next) => setDrafts((old) => ({ ...old, [model]: { ...value, [key]: next } }));
      return <div key={model} className="my-3 rounded border border-white/15 p-3">
        <p className="mb-3 break-all font-medium">{model}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs">Unité de facturation<select className={field} value={value.billing_type || 'per_prediction'} onChange={(e) => change('billing_type', e.target.value)}>
            <option value="per_prediction">Par génération</option>
            <option value="per_1k_characters">Par 1 000 caractères</option>
            <option value="per_output_second">Par seconde de média généré</option>
            <option value="per_second">Par seconde de calcul</option>
            <option value="per_1k_tokens">Par 1 000 tokens IA (entrée + sortie)</option>
            <option value="per_1k_input_tokens">Ancien : entrée seulement (suivi)</option>
            <option value="per_1k_output_tokens">Ancien : sortie seulement (suivi)</option>
          </select></label>
          <label className="text-xs">Tarif USD (entrée pour le texte)<input className={field} type="number" min="0" step="0.000001" value={value.unit_price_usd ?? ''} onChange={(e) => change('unit_price_usd', e.target.value)}/></label>
          {value.billing_type === 'per_1k_tokens' && <label className="text-xs">Sortie : USD / 1 000 tokens IA<input className={field} type="number" min="0" step="0.000001" value={value.output_unit_price_usd ?? ''} onChange={(e) => change('output_unit_price_usd', e.target.value)}/></label>}
          {value.billing_type === 'per_second' && <label className="text-xs">Plafond de calcul (5–240 secondes)<input className={field} type="number" min="5" max="240" step="1" value={value.max_runtime_seconds ?? ''} onChange={(e) => change('max_runtime_seconds', e.target.value)}/></label>}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm"><input className="mr-2" type="checkbox" checked={value.quote_enabled === true} onChange={(e) => change('quote_enabled', e.target.checked)}/>Tarif vérifié — autoriser les devis</label>
          <button disabled={saveRate.isPending || value.unit_price_usd == null || value.unit_price_usd === ''} className="rounded bg-red-600 px-4 py-2 text-sm disabled:opacity-40" onClick={() => saveRate.mutate({ ...value, model_key: model, billing_type: value.billing_type || 'per_prediction' })}>Enregistrer ce tarif</button>
        </div>
      </div>;
    })}
  </section>;
}
