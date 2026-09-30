(async () => {
  const root = document.getElementById('account-root');
  const title = document.getElementById('account-title');
  const lead = document.getElementById('account-lead');

  // Only allow same-site paths as a post-login destination.
  const nextParam = new URLSearchParams(location.search).get('next') || '';
  const next = /^\/(?!\/)/.test(nextParam) ? nextParam : null;

  const STATUS = {
    paid: 'Paid',
    ready: 'Ready for collection',
    shipped: 'Shipped',
    collected: 'Collected',
    cancelled: 'Cancelled',
    failed: 'Payment failed',
    amount_mismatch: 'Payment query',
  };

  const sb = await Auth.client();
  if (!sb) {
    root.innerHTML = '<div class="alert alert--info auth-card">Customer accounts are being set up. Please check back soon. You can still shop as a guest.</div>';
    return;
  }

  // Covers sign in/out here and in other tabs, and the redirect back from
  // the email confirmation link.
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(render, 0);
  });

  // Supabase also fires SIGNED_IN when the tab regains focus, so only
  // re-render when the signed-in state actually changes.
  let shown = null;
  async function render() {
    const session = await Auth.session();
    if (session && next) {
      location.replace(next);
      return;
    }
    const state = session ? 'in' : 'out';
    if (state === shown) return;
    shown = state;
    renderHeader();
    if (session) renderAccount();
    else renderSignedOut('signin');
  }

  function alertBox(id) {
    return `<div class="alert" id="${id}" hidden></div>`;
  }

  function show(id, type, text) {
    const el = document.getElementById(id);
    el.className = `alert alert--${type}`;
    el.textContent = text;
    el.hidden = false;
  }

  function busy(btn, on, label) {
    btn.disabled = on;
    if (label) btn.textContent = label;
  }

  // ---- Signed out: sign in / create account ----
  function renderSignedOut(tab) {
    title.textContent = tab === 'signin' ? 'Welcome back' : 'Create an account';
    lead.textContent = tab === 'signin'
      ? 'Sign in to see your orders and check out faster.'
      : 'Save your details for faster checkout and keep track of every order.';

    root.innerHTML = `
      <div class="card auth-card">
        <div class="tabs" role="tablist">
          <button type="button" role="tab" data-tab="signin" class="${tab === 'signin' ? 'active' : ''}" aria-selected="${tab === 'signin'}">Sign in</button>
          <button type="button" role="tab" data-tab="signup" class="${tab === 'signup' ? 'active' : ''}" aria-selected="${tab === 'signup'}">Create account</button>
        </div>
        ${tab === 'signin' ? `
          <form class="form" id="signin-form" novalidate>
            <div><label for="s-email">Email</label><input id="s-email" name="email" type="email" autocomplete="email" required></div>
            <div><label for="s-password">Password</label><input id="s-password" name="password" type="password" autocomplete="current-password" required></div>
            ${alertBox('signin-alert')}
            <button class="btn btn--primary btn--block" type="submit">Sign in</button>
            <div class="form-links"><a href="/forgot-password">Forgot password?</a><a href="/shop">Continue as guest</a></div>
          </form>` : `
          <form class="form" id="signup-form" novalidate>
            <div class="form-row">
              <div><label for="u-first">First name</label><input id="u-first" name="firstName" autocomplete="given-name" required></div>
              <div><label for="u-last">Last name</label><input id="u-last" name="lastName" autocomplete="family-name" required></div>
            </div>
            <div><label for="u-email">Email</label><input id="u-email" name="email" type="email" autocomplete="email" required></div>
            <div><label for="u-phone">Mobile number <span class="muted">(optional)</span></label><input id="u-phone" name="phone" type="tel" autocomplete="tel"></div>
            <div><label for="u-password">Password</label><input id="u-password" name="password" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters"></div>
            ${alertBox('signup-alert')}
            <button class="btn btn--primary btn--block" type="submit">Create account</button>
            <p class="muted" style="font-size:.82rem;margin:0">By creating an account you agree to us storing your details to process your orders.</p>
          </form>`}
      </div>`;

    root.querySelector('.tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (t) renderSignedOut(t.dataset.tab);
    });

    const signin = document.getElementById('signin-form');
    signin?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(signin);
      const btn = signin.querySelector('button[type="submit"]');
      busy(btn, true, 'Signing in…');
      try {
        await Auth.signIn(String(f.get('email')).trim(), String(f.get('password')));
        // onAuthStateChange re-renders.
      } catch (err) {
        show('signin-alert', 'error', err.message);
        busy(btn, false, 'Sign in');
      }
    });

    const signup = document.getElementById('signup-form');
    signup?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(signup);
      const data = {
        firstName: String(f.get('firstName')).trim(),
        lastName: String(f.get('lastName')).trim(),
        email: String(f.get('email')).trim(),
        phone: String(f.get('phone')).trim(),
        password: String(f.get('password')),
      };
      if (!data.firstName || !data.lastName) return show('signup-alert', 'error', 'Please enter your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return show('signup-alert', 'error', 'Please enter a valid email address.');
      if (data.password.length < 8) return show('signup-alert', 'error', 'Your password must be at least 8 characters.');

      const btn = signup.querySelector('button[type="submit"]');
      busy(btn, true, 'Creating account…');
      try {
        const signedIn = await Auth.signUp(data);
        if (!signedIn) {
          root.innerHTML = `
            <div class="card auth-card center">
              <div class="status-icon">${ICONS.mail}</div>
              <h2>Check your email</h2>
              <p class="muted">We've sent a confirmation link to <strong>${escapeHtml(data.email)}</strong>. Click it to activate your account, then sign in.</p>
            </div>`;
        }
      } catch (err) {
        show('signup-alert', 'error', err.message);
        busy(btn, false, 'Create account');
      }
    });
  }

  // ---- Signed in: orders + details ----
  async function renderAccount() {
    const p = await Auth.profile();
    title.textContent = p?.first_name ? `Hi, ${p.first_name}` : 'My account';
    lead.textContent = 'View your orders and keep your details up to date.';

    root.innerHTML = `
      <div class="account-layout">
        <div>
          <h2>My orders</h2>
          <div id="orders"><p class="muted">Loading your orders…</p></div>
        </div>
        <div>
          <form class="card form" id="profile-form" novalidate>
            <h3>My details</h3>
            <div class="form-row">
              <div><label for="p-first">First name</label><input id="p-first" name="first_name" autocomplete="given-name"></div>
              <div><label for="p-last">Last name</label><input id="p-last" name="last_name" autocomplete="family-name"></div>
            </div>
            <div><label for="p-email">Email</label><input id="p-email" type="email" disabled></div>
            <div><label for="p-phone">Mobile number</label><input id="p-phone" name="phone" type="tel" autocomplete="tel"></div>
            <h3 style="font-size:1.15rem;margin:8px 0 0">Delivery address</h3>
            <div><label for="p-street">Street address</label><input id="p-street" name="street" autocomplete="street-address"></div>
            <div class="form-row">
              <div><label for="p-suburb">Suburb</label><input id="p-suburb" name="suburb" autocomplete="address-level3"></div>
              <div><label for="p-city">City</label><input id="p-city" name="city" autocomplete="address-level2"></div>
            </div>
            <div><label for="p-postal">Postal code</label><input id="p-postal" name="postal_code" autocomplete="postal-code" inputmode="numeric"></div>
            ${alertBox('profile-alert')}
            <button class="btn btn--primary" type="submit">Save details</button>
          </form>
          <p class="mt-lg"><button type="button" class="btn btn--outline btn--block" id="sign-out">Sign out</button></p>
        </div>
      </div>`;

    const form = document.getElementById('profile-form');
    document.getElementById('p-email').value = p?.email || '';
    for (const key of ['first_name', 'last_name', 'phone', 'street', 'suburb', 'city', 'postal_code']) {
      form.elements[key].value = p?.[key] || '';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      busy(btn, true);
      const changes = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, String(v).trim() || null]));
      try {
        await Auth.updateProfile(changes);
        show('profile-alert', 'success', 'Your details have been saved.');
        if (changes.first_name) title.textContent = `Hi, ${changes.first_name}`;
      } catch (err) {
        show('profile-alert', 'error', err.message);
      } finally {
        busy(btn, false);
      }
    });

    document.getElementById('sign-out').addEventListener('click', () => Auth.signOut());

    loadOrders();
  }

  async function loadOrders() {
    const el = document.getElementById('orders');
    try {
      const orders = await Auth.orders();
      if (orders.length === 0) {
        el.innerHTML = `
          <div class="card center">
            <p class="muted">You haven't placed any orders yet.</p>
            <a class="btn btn--primary btn--sm" href="/shop">Visit the shop</a>
          </div>`;
        return;
      }
      el.innerHTML = orders.map((o) => `
        <article class="order-card">
          <div class="order-head">
            <div>
              <strong>${escapeHtml(o.id)}</strong>
              <div class="muted" style="font-size:.85rem">${new Date(o.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} · ${o.fulfilment === 'delivery' ? 'Delivery' : 'Collect in store'}</div>
            </div>
            <div style="text-align:right">
              <span class="badge badge--${escapeHtml(o.status)}">${escapeHtml(STATUS[o.status] || o.status)}</span>
              <div class="price" style="margin-top:6px">${money(o.total)}</div>
            </div>
          </div>
          <ul class="order-items">
            ${(o.order_items || []).map((i) => `<li><span>${escapeHtml(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></li>`).join('')}
          </ul>
        </article>`).join('');
    } catch (err) {
      el.innerHTML = `<div class="alert alert--error">${escapeHtml(err.message)}</div>`;
    }
  }

  render();
})();
