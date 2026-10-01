// Photos shown on the gallery page. These are demo stock photos; swap in
// House of Lazer's own (e.g. /images/gallery/...) before launch.
// Leave `src` empty to show a placeholder tile.
const GALLERY = [
  { src: '/images/site/studio.jpg', caption: 'Our treatment room', category: 'Studio' },
  { src: '/images/services/laser-hair-removal.jpg', caption: 'Laser hair removal', category: 'Laser' },
  { src: '/images/services/tattoo-removal.jpg', caption: 'Laser tattoo removal', category: 'Laser' },
  { src: '/images/services/microneedling.jpg', caption: 'Microneedling', category: 'Skin' },
  { src: '/images/services/mesotherapy.jpg', caption: 'Mesotherapy', category: 'Skin' },
  { src: '/images/services/chemical-peel.jpg', caption: 'Chemical peel', category: 'Skin' },
  { src: '/images/site/treatment-room.jpg', caption: 'Relax and unwind', category: 'Studio' },
  { src: '/images/services/iv-drip.jpg', caption: 'IV vitamin drips', category: 'Wellness' },
  { src: '/images/site/serum-ritual.jpg', caption: 'Your aftercare routine', category: 'Skin' },
  { src: '/images/site/spa-portrait.jpg', caption: 'Time for you', category: 'Wellness' },
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
