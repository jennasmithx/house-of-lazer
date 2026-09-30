// Shared across every page: header/footer, cart storage, and small helpers.

const SITE = {
  name: 'House of Lazer',
  phone: '+27 00 000 0000',
  email: 'hello@houseoflazer.co.za',
  address: 'Your street address, Suburb, City',
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
};

const NAV = [
  ['/', 'Home'],
  ['/about', 'About'],
  ['/services', 'Services'],
  ['/shop', 'Shop'],
  ['/gallery', 'Gallery'],
  ['/contact', 'Contact'],
];

const ICONS = {
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  lock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const money = (n) => 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const initials = (name) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

// ---- Cart (browser storage; the server re-prices everything at checkout) ----
const Cart = (() => {
  const KEY = 'hol-cart';
  let memory = [];

  function read() {
    try {
      const items = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return memory;
    }
  }

  function save(items) {
    memory = items;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
    document.dispatchEvent(new CustomEvent('cart:change'));
  }

  return {
    items: read,
    count: () => read().reduce((n, i) => n + i.qty, 0),
    add(id, qty = 1) {
      const items = read();
      const line = items.find((i) => i.id === id);
      if (line) line.qty = Math.min(line.qty + qty, 20);
      else items.push({ id, qty });
      save(items);
    },
    setQty(id, qty) {
      const items = read()
        .map((i) => (i.id === id ? { ...i, qty: Math.min(qty, 20) } : i))
        .filter((i) => i.qty > 0);
      save(items);
    },
    remove(id) { save(read().filter((i) => i.id !== id)); },
    clear() { save([]); },
  };
})();

function toast(html) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = html;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---- Shared card templates ----
function productMedia(p) {
  return p.image
    ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">`
    : `<span class="placeholder" aria-hidden="true">${escapeHtml(initials(p.name))}</span>`;
}

function productCard(p) {
  return `
    <article class="product-card">
      <div class="product-media">${productMedia(p)}</div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(p.category)}</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="product-foot">
          <div><div class="price">${money(p.price)}</div><div class="size">${escapeHtml(p.size)}</div></div>
          <button class="btn btn--primary btn--sm" data-add="${escapeHtml(p.id)}">Add to cart</button>
        </div>
      </div>
    </article>`;
}

function serviceCard(s, { detailed = false } = {}) {
  return `
    <article class="card service-card" id="${escapeHtml(s.id)}">
      <div class="icon-badge">${ICONS.spark}</div>
      <h3>${escapeHtml(s.name)}</h3>
      <p>${escapeHtml(s.description)}</p>
      <div class="meta"><span>${escapeHtml(s.duration)}</span><span>From <strong>${money(s.from).replace('.00', '')}</strong></span></div>
      ${detailed ? `<div class="actions"><a class="btn btn--outline btn--sm" href="/contact?service=${encodeURIComponent(s.id)}">Book this treatment</a></div>` : ''}
    </article>`;
}

// Any "Add to cart" button on any page.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  Cart.add(btn.dataset.add, 1);
  toast(`Added to cart <a href="/cart">View cart</a>`);
});

function renderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  const here = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  el.className = 'site-header';
  el.innerHTML = `
    <nav class="container nav" aria-label="Main">
      <a class="logo" href="/">House of <span>Lazer</span></a>
      <ul class="nav-links" id="nav-links">
        ${NAV.map(([href, label]) => `<li><a href="${href}" class="${href === here ? 'active' : ''}">${label}</a></li>`).join('')}
      </ul>
      <div class="nav-actions">
        <a class="btn btn--primary btn--sm nav-book" href="/contact">Book now</a>
        <a class="icon-link account-link" href="/account" aria-label="${signedIn() ? 'My account' : 'Sign in'}" title="${signedIn() ? 'My account' : 'Sign in'}">${ICONS.user}${signedIn() ? '<span class="signed-in-dot"></span>' : ''}</a>
        <a class="icon-link cart-link" href="/cart" aria-label="Cart">${ICONS.bag}<span class="cart-count" hidden></span></a>
        <button class="menu-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav-links">${ICONS.menu}</button>
      </div>
    </nav>`;
  const toggle = el.querySelector('.menu-toggle');
  const links = el.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  updateCartCount();
}

// Supabase stores the session under sb-<project>-auth-token. Checking for it
// lets every page show signed-in state without loading the Supabase library.
function signedIn() {
  try {
    return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
  } catch {
    return false;
  }
}

function updateCartCount() {
  const badge = document.querySelector('.cart-count');
  if (!badge) return;
  const n = Cart.count();
  badge.textContent = n;
  badge.hidden = n === 0;
}

function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.className = 'site-footer';
  el.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a class="logo" href="/">House of <span>Lazer</span></a>
          <p>Advanced laser and skin treatments in a calm, welcoming space. Real results, honest advice.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>${NAV.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>
        </div>
        <div>
          <h4>Treatments</h4>
          <ul>
            <li><a href="/services#tattoo-removal">Tattoo removal</a></li>
            <li><a href="/services#microneedling">Microneedling</a></li>
            <li><a href="/services#laser-hair-removal">Laser hair removal</a></li>
            <li><a href="/services#pigmentation">Pigmentation</a></li>
          </ul>
        </div>
        <div>
          <h4>Visit us</h4>
          <ul>
            <li>${escapeHtml(SITE.address)}</li>
            <li><a href="tel:${SITE.phone.replace(/\s/g, '')}">${SITE.phone}</a></li>
            <li><a href="mailto:${SITE.email}">${SITE.email}</a></li>
            <li><a href="${SITE.instagram}" target="_blank" rel="noopener">Instagram</a> · <a href="${SITE.facebook}" target="_blank" rel="noopener">Facebook</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} House of Lazer. All rights reserved.</span>
        <span>Secure payments by PayFast</span>
      </div>
    </div>`;
}

document.addEventListener('cart:change', updateCartCount);
window.addEventListener('storage', updateCartCount);
renderHeader();
renderFooter();
