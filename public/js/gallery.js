// Add photos to /public/images/gallery and list them here.
// Leave `src` empty to show a placeholder tile.
const GALLERY = [
  { src: '', caption: 'Tattoo removal – after 4 sessions', category: 'Tattoo removal' },
  { src: '', caption: 'Tattoo removal – fine-line lettering', category: 'Tattoo removal' },
  { src: '', caption: 'Microneedling – acne scarring', category: 'Skin' },
  { src: '', caption: 'Pigmentation – sun spots', category: 'Skin' },
  { src: '', caption: 'Carbon laser peel glow', category: 'Skin' },
  { src: '', caption: 'Laser hair removal – underarms', category: 'Hair removal' },
  { src: '', caption: 'Our treatment room', category: 'Studio' },
  { src: '', caption: 'Reception & retail', category: 'Studio' },
];

(() => {
  const grid = document.getElementById('gallery');
  const filters = document.getElementById('gallery-filters');
  const lightbox = document.getElementById('lightbox');
  const categories = ['All', ...new Set(GALLERY.map((g) => g.category))];
  let active = 'All';

  function render() {
    filters.innerHTML = categories
      .map((c) => `<button type="button" class="chip ${c === active ? 'active' : ''}" data-cat="${escapeHtml(c)}" aria-pressed="${c === active}">${escapeHtml(c)}</button>`)
      .join('');
    grid.innerHTML = GALLERY
      .filter((g) => active === 'All' || g.category === active)
      .map((g) => g.src
        ? `<button type="button" class="gallery-item" data-src="${escapeHtml(g.src)}" data-caption="${escapeHtml(g.caption)}">
             <img src="${escapeHtml(g.src)}" alt="${escapeHtml(g.caption)}" loading="lazy"><span class="caption">${escapeHtml(g.caption)}</span>
           </button>`
        : `<figure class="gallery-item" style="margin:0;cursor:default"><div class="placeholder">Photo coming soon</div><figcaption>${escapeHtml(g.caption)}</figcaption></figure>`)
      .join('');
  }

  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    active = chip.dataset.cat;
    render();
  });

  grid.addEventListener('click', (e) => {
    const item = e.target.closest('[data-src]');
    if (!item) return;
    const img = lightbox.querySelector('img');
    img.src = item.dataset.src;
    img.alt = item.dataset.caption;
    lightbox.classList.add('open');
    lightbox.querySelector('button').focus();
  });

  const close = () => lightbox.classList.remove('open');
  lightbox.addEventListener('click', (e) => { if (e.target !== lightbox.querySelector('img')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  render();
})();
