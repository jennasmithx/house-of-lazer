(async () => {
  const grid = document.getElementById('product-grid');
  const filters = document.getElementById('filters');
  let products;
  try {
    products = await getJson('/api/products');
  } catch {
    grid.innerHTML = '<div class="alert alert--error">Products could not be loaded. Please refresh the page.</div>';
    return;
  }

  const categories = ['All', ...new Set(products.map((p) => p.category))];
  let active = 'All';

  function render() {
    filters.innerHTML = categories
      .map((c) => `<button type="button" class="chip ${c === active ? 'active' : ''}" data-cat="${escapeHtml(c)}" aria-pressed="${c === active}">${escapeHtml(c)}</button>`)
      .join('');
    const shown = active === 'All' ? products : products.filter((p) => p.category === active);
    grid.innerHTML = shown.map(productCard).join('');
  }

  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    active = chip.dataset.cat;
    render();
  });

  render();
})();
