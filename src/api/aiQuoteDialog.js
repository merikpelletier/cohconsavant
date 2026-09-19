// Native modal: focus trap, keyboard navigation and Escape handled by the browser.
export function confirmAIQuote(quote) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'background:#111;color:#fff;border:1px solid #555;border-radius:16px;padding:28px;max-width:440px;width:calc(100% - 32px);box-shadow:0 0 0 100vmax #000b';
    dialog.setAttribute('aria-label', 'Confirmer le prix de la génération');
    const title = document.createElement('h2');
    title.textContent = quote.label || 'Votre génération';
    title.style.cssText = 'font-size:20px;font-weight:700;margin-bottom:16px';
    const price = document.createElement('p');
    price.textContent = 'Prix final : ' + Number(quote.tokens).toLocaleString('fr-CA') + ' jetons';
    price.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:12px';
    const details = document.createElement('p');
    details.textContent = 'Conversion USD → CAD incluse dans le calcul. Ce prix reste fixe après confirmation. Aucun supplément ne sera prélevé.';
    const quantities = document.createElement('p');
    quantities.textContent = (quote.summary || []).map((item) => item.characters ? item.characters + ' caractères' : item.seconds ? item.seconds + ' secondes' : '').filter(Boolean).join(' · ');
    quantities.style.cssText = 'margin:12px 0;color:#ccc';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:12px;justify-content:flex-end;margin-top:24px';
    const cancel = document.createElement('button');
    cancel.textContent = 'Annuler';
    cancel.autofocus = true;
    cancel.style.cssText = 'padding:10px 16px;border:1px solid #777;border-radius:8px';
    const confirm = document.createElement('button');
    confirm.textContent = 'Confirmer et lancer';
    confirm.style.cssText = 'padding:10px 16px;background:#dc2626;border-radius:8px;color:white';
    let finished = false;
    const finish = (accepted) => {
      if (finished) return;
      finished = true;
      dialog.close();
      dialog.remove();
      previousFocus?.focus?.();
      resolve(accepted);
    };
    cancel.onclick = () => finish(false);
    confirm.onclick = () => finish(Date.now() < Date.parse(quote.expires_at));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });
    actions.append(cancel, confirm);
    dialog.append(title, price, details, quantities, actions);
    document.body.append(dialog);
    dialog.showModal();
  });
}
