export function openAuthorizeNetHostedPayment({ url, token }) {
  if (!url || !token) throw new Error('Réponse de paiement incomplète');

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.target = '_self';

  const tokenInput = document.createElement('input');
  tokenInput.type = 'hidden';
  tokenInput.name = 'token';
  tokenInput.value = token;
  form.appendChild(tokenInput);

  document.body.appendChild(form);
  form.submit();
}
