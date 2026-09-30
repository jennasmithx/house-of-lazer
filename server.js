const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');

try { process.loadEnvFile(); } catch { /* no .env file; use defaults */ }

const payfast = require('./lib/payfast');
const store = require('./lib/store');
const products = require('./data/products.json');
const services = require('./data/services.json');

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE ?? 95);
const MAX_QTY = 20;

if (!payfast.config().sandbox && !payfast.config().passphrase) {
  throw new Error('PAYFAST_PASSPHRASE is required when PAYFAST_SANDBOX=false.');
}

const app = express();

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/api/products', (req, res) => res.json(products));
app.get('/api/services', (req, res) => res.json(services));
app.get('/api/shop-config', (req, res) => res.json({ deliveryFee: DELIVERY_FEE, sandbox: payfast.config().sandbox }));

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Creates a pending order from the cart and returns a signed PayFast form.
// Prices always come from the server-side catalogue, never from the browser.
app.post('/api/checkout', express.json({ limit: '20kb' }), (req, res) => {
  const { items, customer = {}, fulfilment, address = {} } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  const lines = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item?.id);
    const qty = Number(item?.qty);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return res.status(400).json({ error: 'Your cart contains an invalid item. Please refresh and try again.' });
    }
    lines.push({ id: product.id, name: product.name, price: product.price, qty });
  }

  const firstName = clean(customer.firstName, 100);
  const lastName = clean(customer.lastName, 100);
  const email = clean(customer.email, 100);
  const phone = clean(customer.phone, 20).replace(/[^\d+]/g, '');
  if (!firstName || !lastName || !isEmail(email)) {
    return res.status(400).json({ error: 'Please enter your name and a valid email address.' });
  }
  if (fulfilment !== 'collect' && fulfilment !== 'delivery') {
    return res.status(400).json({ error: 'Please choose collection or delivery.' });
  }

  let deliveryAddress = null;
  if (fulfilment === 'delivery') {
    deliveryAddress = {
      street: clean(address.street),
      suburb: clean(address.suburb),
      city: clean(address.city),
      postalCode: clean(address.postalCode, 10),
    };
    if (!deliveryAddress.street || !deliveryAddress.city || !deliveryAddress.postalCode) {
      return res.status(400).json({ error: 'Please enter your full delivery address.' });
    }
  }

  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const deliveryFee = fulfilment === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  const order = store.insert('orders', {
    id: `HL-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    customer: { firstName, lastName, email, phone },
    fulfilment,
    address: deliveryAddress,
    lines,
    subtotal,
    deliveryFee,
    total,
  });

  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const payment = payfast.buildPayment({
    return_url: `${BASE_URL}/checkout-success?order=${order.id}`,
    cancel_url: `${BASE_URL}/checkout-cancel?order=${order.id}`,
    notify_url: `${BASE_URL}/api/payfast/notify`,
    name_first: firstName,
    name_last: lastName,
    email_address: email,
    cell_number: /^0\d{9}$/.test(phone) ? phone : undefined,
    m_payment_id: order.id,
    amount: total.toFixed(2),
    item_name: `House of Lazer order ${order.id}`,
    item_description: `${itemCount} item${itemCount === 1 ? '' : 's'} – ${fulfilment === 'delivery' ? 'delivery' : 'collect in store'}`,
  });

  res.json({ orderId: order.id, ...payment });
});

// Public order status for the success page. Exposes no personal details.
app.get('/api/orders/:id/status', (req, res) => {
  const order = store.find('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ id: order.id, status: order.status, total: order.total, fulfilment: order.fulfilment });
});

// PayFast Instant Transaction Notification. PayFast POSTs here server-to-server
// once a payment completes; this is the only place an order is marked paid.
app.post('/api/payfast/notify', express.text({ type: 'application/x-www-form-urlencoded', limit: '20kb' }), async (req, res) => {
  res.sendStatus(200); // Acknowledge straight away, as PayFast requires.

  const raw = typeof req.body === 'string' ? req.body : '';
  const data = Object.fromEntries(new URLSearchParams(raw));
  const order = store.find('orders', data.m_payment_id);

  try {
    if (!payfast.verifyItnSignature(raw)) throw new Error('bad signature');
    if (!order) throw new Error(`unknown order ${data.m_payment_id}`);
    if (Math.abs(Number(data.amount_gross) - order.total) > 0.01) throw new Error('amount mismatch');
    if (!(await payfast.validateWithPayfast(raw))) throw new Error('PayFast did not validate the ITN');
  } catch (err) {
    console.warn(`[ITN] rejected: ${err.message}`);
    return;
  }

  const status = { COMPLETE: 'paid', CANCELLED: 'cancelled', FAILED: 'failed' }[data.payment_status] || 'pending';
  store.update('orders', order.id, { status, payfastPaymentId: data.pf_payment_id, paidAt: status === 'paid' ? new Date().toISOString() : undefined });
  console.log(`[ITN] order ${order.id} -> ${status}`);
});

app.post('/api/contact', express.json({ limit: '10kb' }), (req, res) => {
  const { name, email, phone, service, message } = req.body || {};
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name: clean(name, 100),
    email: clean(email, 100),
    phone: clean(phone, 20),
    service: clean(service, 100),
    message: clean(message, 2000),
  };
  if (!entry.name || !isEmail(entry.email) || !entry.message) {
    return res.status(400).json({ error: 'Please enter your name, a valid email and a message.' });
  }
  store.insert('messages', entry);
  res.json({ ok: true });
});

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`House of Lazer running at ${BASE_URL} (PayFast ${payfast.config().sandbox ? 'SANDBOX' : 'LIVE'})`);
  });
}

module.exports = app;
