(async () => {
  const root = document.getElementById('cart-root');
  let products, config;
  try {
    [products, config] = await Promise.all([getJson('/api/products'), getJson('/api/shop-config')]);
  } catch {
    root.innerHTML = '<div class="alert alert--error">Sorry, the shop could not be loaded. Please refresh the page.</div>';
    return;
  }
  document.getElementById('sandbox-banner').hidden = !config.sandbox;

  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  const form = { fulfilment: 'collect' };

  // Drop anything that is no longer in the catalogue.
  Cart.items().filter((i) => !byId[i.id]).forEach((i) => Cart.remove(i.id));

  function totals() {
    const lines = Cart.items().map((i) => ({ ...byId[i.id], qty: i.qty }));
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const delivery = form.fulfilment === 'delivery' ? config.deliveryFee : 0;
    return { lines, subtotal, delivery, total: subtotal + delivery };
  }

  function render() {
    const { lines } = totals();
    if (lines.length === 0) {
      root.innerHTML = `
        <div class="empty">
          <h2>Your cart is empty</h2>
          <p class="muted">Browse our aftercare and skincare essentials.</p>
          <a class="btn btn--primary" href="/shop">Go to shop</a>
        </div>`;
      return;
    }

    root.innerHTML = `
      <div class="cart-layout">
        <div>
          <div class="cart-lines" id="cart-lines"></div>
          <p class="mt-lg"><a href="/shop">&larr; Continue shopping</a></p>
        </div>
        <form class="summary form" id="checkout-form" novalidate>
          <h2>Checkout</h2>

          <h3>How would you like to receive your order?</h3>
          <div class="choice-group">
            <label class="choice"><input type="radio" name="fulfilment" value="collect" ${form.fulfilment === 'collect' ? 'checked' : ''}>
              <span><strong>Collect in store</strong><small>Free · ready in 1–2 working days</small></span></label>
            <label class="choice"><input type="radio" name="fulfilment" value="delivery" ${form.fulfilment === 'delivery' ? 'checked' : ''}>
              <span><strong>Delivery</strong><small>${money(config.deliveryFee)} · 2–5 working days</small></span></label>
          </div>

          <h3>Your details</h3>
          <div class="form-row">
            <div><label for="firstName">First name</label><input id="firstName" name="firstName" autocomplete="given-name" required></div>
            <div><label for="lastName">Last name</label><input id="lastName" name="lastName" autocomplete="family-name" required></div>
          </div>
          <div><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required></div>
          <div><label for="phone">Mobile number</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="e.g. 0821234567"></div>

          <div id="address-fields" ${form.fulfilment === 'delivery' ? '' : 'hidden'}>
            <h3>Delivery address</h3>
            <div class="form" style="gap:14px">
              <div><label for="street">Street address</label><input id="street" name="street" autocomplete="street-address"></div>
              <div class="form-row">
                <div><label for="suburb">Suburb</label><input id="suburb" name="suburb" autocomplete="address-level3"></div>
                <div><label for="city">City</label><input id="city" name="city" autocomplete="address-level2"></div>
              </div>
              <div><label for="postalCode">Postal code</label><input id="postalCode" name="postalCode" autocomplete="postal-code" inputmode="numeric"></div>
            </div>
          </div>

          <div id="summary-totals"></div>
          <div class="alert alert--error" id="checkout-error" hidden></div>
          <button class="btn btn--primary btn--block" type="submit" id="pay-btn">Pay securely with PayFast</button>
          <div class="secure-note">${ICONS.lock} You'll be redirected to PayFast to complete payment.</div>
        </form>
      </div>`;

    renderLines();
    renderTotals();
    bindForm();
  }

  function renderLines() {
    const { lines } = totals();
    document.getElementById('cart-lines').innerHTML = lines.map((l) => `
      <div class="cart-line">
        <div class="cart-thumb">${productMedia(l)}</div>
        <div>
          <h3>${escapeHtml(l.name)}</h3>
          <div class="unit">${money(l.price)} · ${escapeHtml(l.size)}</div>
        </div>
        <div class="cart-line-right">
          <strong>${money(l.price * l.qty)}</strong>
          <div class="qty">
            <button type="button" data-dec="${l.id}" aria-label="Decrease quantity">&minus;</button>
            <span>${l.qty}</span>
            <button type="button" data-inc="${l.id}" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="link-btn" data-remove="${l.id}">Remove</button>
        </div>
      </div>`).join('');
  }

  function renderTotals() {
    const t = totals();
    document.getElementById('summary-totals').innerHTML = `
      <div class="summary-row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div class="summary-row"><span>${form.fulfilment === 'delivery' ? 'Delivery' : 'Collection'}</span><span>${t.delivery ? money(t.delivery) : 'Free'}</span></div>
      <div class="summary-row total"><span>Total</span><span>${money(t.total)}</span></div>`;
  }

  root.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const item = (id) => Cart.items().find((i) => i.id === id);
    if (t.dataset.inc) Cart.setQty(t.dataset.inc, item(t.dataset.inc).qty + 1);
    else if (t.dataset.dec) Cart.setQty(t.dataset.dec, item(t.dataset.dec).qty - 1);
    else if (t.dataset.remove) Cart.remove(t.dataset.remove);
    else return;
    if (Cart.count() === 0) return render();
    renderLines();
    renderTotals();
  });

  function bindForm() {
    const el = document.getElementById('checkout-form');
    el.addEventListener('change', (e) => {
      if (e.target.name !== 'fulfilment') return;
      form.fulfilment = e.target.value;
      document.getElementById('address-fields').hidden = form.fulfilment !== 'delivery';
      renderTotals();
    });
    el.addEventListener('submit', checkout);
  }

  async function checkout(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const errorEl = document.getElementById('checkout-error');
    const btn = document.getElementById('pay-btn');
    errorEl.hidden = true;

    const payload = {
      items: Cart.items(),
      fulfilment: form.fulfilment,
      customer: {
        firstName: f.get('firstName'),
        lastName: f.get('lastName'),
        email: f.get('email'),
        phone: f.get('phone'),
      },
      address: form.fulfilment === 'delivery' ? {
        street: f.get('street'),
        suburb: f.get('suburb'),
        city: f.get('city'),
        postalCode: f.get('postalCode'),
      } : undefined,
    };

    btn.disabled = true;
    btn.textContent = 'Redirecting to PayFast…';
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed. Please try again.');

      // PayFast expects a normal form POST, in the exact field order signed by the server.
      const pf = document.createElement('form');
      pf.method = 'POST';
      pf.action = data.action;
      for (const [name, value] of data.fields) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        pf.appendChild(input);
      }
      document.body.appendChild(pf);
      pf.submit();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Pay securely with PayFast';
    }
  }

  render();
})();
