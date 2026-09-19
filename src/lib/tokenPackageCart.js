export function addTokenPackageToCart(pkg) {
  let cart = [];
  try { cart = JSON.parse(sessionStorage.getItem('cochon_cart') || '[]'); } catch { cart = []; }

  const existingIndex = cart.findIndex((item) => item.id === pkg.id && item.kind === 'token_package');
  if (existingIndex >= 0) {
    cart[existingIndex] = { ...cart[existingIndex], quantity: cart[existingIndex].quantity + 1 };
  } else {
    const baseTokens = Number(pkg.token_amount || 0);
    const bonusTokens = Math.round(baseTokens * Number(pkg.bonus_percentage || 0) / 100);
    cart.push({
      id: pkg.id,
      kind: 'token_package',
      name: pkg.name,
      price: `$${Number(pkg.price).toFixed(2)}`,
      quantity: 1,
      options: { Jetons: baseTokens + bonusTokens },
    });
  }

  sessionStorage.setItem('cochon_cart', JSON.stringify(cart));
  window.location.href = '/Cart';
}
