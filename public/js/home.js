(async () => {
  try {
    const [services, products] = await Promise.all([getJson('/api/services'), getJson('/api/products')]);
    document.getElementById('home-services').innerHTML = services.slice(0, 3).map((s) => serviceCard(s)).join('');
    document.getElementById('home-products').innerHTML = products.filter((p) => p.category !== 'Gift vouchers').slice(0, 4).map(productCard).join('');
  } catch {
    // Sections simply stay empty if the API is unavailable.
  }
})();
