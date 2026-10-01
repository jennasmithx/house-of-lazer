const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.PAYFAST_PASSPHRASE = 'test-passphrase';
process.env.PAYFAST_MERCHANT_ID = '10000100';
delete process.env.RESEND_API_KEY;

const { createFakeSupabase } = require('./fake-supabase');
const supabase = require('../lib/supabase');
const payfast = require('../lib/payfast');
const app = require('../dev-server');

const db = createFakeSupabase({ users: { 'good-token': { id: 'user-1', email: 'member@example.com' } } });
supabase.setAdmin(db);

let server, base;
const realFetch = global.fetch;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  // Stub PayFast's validate endpoint; everything else goes to the real fetch.
  global.fetch = (url, opts) => (String(url).includes('/eng/query/validate')
    ? Promise.resolve(new Response('VALID'))
    : realFetch(url, opts));
});
test.after(() => {
  global.fetch = realFetch;
  server.close();
});

const post = (url, body, headers = {}) => realFetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const customer = { firstName: 'Test', lastName: "O'Brien", email: 'test@example.com', phone: '0821234567' };

function itnBody(fields) {
  const raw = Object.entries(fields).map(([k, v]) => `${k}=${payfast.encode(v)}`).join('&');
  const sig = crypto.createHash('md5').update(`${raw}&passphrase=${payfast.encode(process.env.PAYFAST_PASSPHRASE)}`).digest('hex');
  return `${raw}&signature=${sig}`;
}
const notify = (body) => realFetch(`${base}/api/payfast-notify`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });

test('checkout prices from the catalogue, adds delivery and stores the order', async () => {
  const res = await post('/api/checkout', {
    items: [{ id: 'aftercare-balm', qty: 2, price: 1 }],
    customer,
    fulfilment: 'delivery',
    address: { street: '1 Main Rd', city: 'Cape Town', postalCode: '8001' },
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  const fields = Object.fromEntries(body.fields);
  assert.strictEqual(fields.amount, (249 * 2 + 95).toFixed(2));
  assert.strictEqual(fields.m_payment_id, body.orderId);
  assert.match(fields.notify_url, /\/api\/payfast-notify$/);
  assert.ok(fields.signature);

  const order = db.tables.orders.find((o) => o.id === body.orderId);
  assert.strictEqual(order.status, 'pending');
  assert.strictEqual(order.user_id, null);
  assert.strictEqual(order.city, 'Cape Town');
  assert.deepStrictEqual(db.tables.order_items.filter((i) => i.order_id === body.orderId).map((i) => [i.product_id, i.qty, i.price]), [['aftercare-balm', 2, 249]]);
});

test('signed-in checkout links the order to the customer', async () => {
  const body = await (await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 1 }], customer, fulfilment: 'collect' }, { Authorization: 'Bearer good-token' })).json();
  assert.strictEqual(db.tables.orders.find((o) => o.id === body.orderId).user_id, 'user-1');
  assert.strictEqual(Object.fromEntries(body.fields).amount, '159.00');

  const guest = await (await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 1 }], customer, fulfilment: 'collect' }, { Authorization: 'Bearer forged' })).json();
  assert.strictEqual(db.tables.orders.find((o) => o.id === guest.orderId).user_id, null);
});

test('rejects bad checkout input', async () => {
  assert.strictEqual((await post('/api/checkout', { items: [], customer, fulfilment: 'collect' })).status, 400);
  assert.strictEqual((await post('/api/checkout', { items: [{ id: 'nope', qty: 1 }], customer, fulfilment: 'collect' })).status, 400);
  assert.strictEqual((await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 0 }], customer, fulfilment: 'collect' })).status, 400);
  assert.strictEqual((await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 1 }], customer, fulfilment: 'delivery' })).status, 400);
  assert.strictEqual((await realFetch(`${base}/api/checkout`)).status, 405);
});

test('ITN marks the order paid exactly once', async () => {
  const { orderId } = await (await post('/api/checkout', { items: [{ id: 'spf50', qty: 1 }], customer, fulfilment: 'collect' })).json();
  const fields = { m_payment_id: orderId, pf_payment_id: '999', payment_status: 'COMPLETE', item_name: `House of Lazer order ${orderId}`, name_first: 'Test', name_last: "O'Brien", amount_gross: '329.00', merchant_id: '10000100' };

  assert.strictEqual((await notify(itnBody(fields))).status, 200);
  const order = db.tables.orders.find((o) => o.id === orderId);
  assert.strictEqual(order.status, 'paid');
  assert.strictEqual(order.payfast_payment_id, '999');

  const again = await notify(itnBody(fields));
  assert.strictEqual(await again.text(), 'already processed');

  const status = await (await realFetch(`${base}/api/order-status?id=${orderId}`)).json();
  assert.deepStrictEqual(status, { id: orderId, status: 'paid', total: 329, fulfilment: 'collect' });
});

test('ITN rejects tampered or wrong-amount notifications', async () => {
  const { orderId } = await (await post('/api/checkout', { items: [{ id: 'brightening-serum', qty: 1 }], customer, fulfilment: 'collect' })).json();
  const fields = { m_payment_id: orderId, payment_status: 'COMPLETE', amount_gross: '459.00', merchant_id: '10000100' };

  const tampered = itnBody(fields).replace('459.00', '1.00');
  assert.strictEqual((await notify(tampered)).status, 400);

  assert.strictEqual((await notify(itnBody({ ...fields, amount_gross: '1.00' }))).status, 400);
  assert.strictEqual(db.tables.orders.find((o) => o.id === orderId).status, 'amount_mismatch');

  assert.strictEqual((await notify(itnBody({ ...fields, merchant_id: '1' }))).status, 400);
});

test('contact form stores messages', async () => {
  assert.strictEqual((await post('/api/contact', { name: 'Ann', email: 'ann@example.com', message: 'Hi' })).status, 200);
  assert.strictEqual(db.tables.messages.at(-1).name, 'Ann');
  assert.strictEqual((await post('/api/contact', { name: 'Ann', email: 'bad', message: 'Hi' })).status, 400);
});

test('booking requests are validated and stored', async () => {
  const ok = await post('/api/booking', { service: 'microneedling', name: 'Nomsa', phone: '082 123 4567', contactMethod: 'whatsapp', preferredDate: '2026-10-20', preferredTime: 'morning', firstVisit: 'yes', notes: 'Acne scars' });
  assert.strictEqual(ok.status, 200);
  const saved = db.tables.bookings.at(-1);
  assert.strictEqual(saved.service, 'Microneedling');
  assert.strictEqual(saved.preferred_time, 'morning');
  assert.strictEqual(saved.first_visit, true);

  const unsure = await post('/api/booking', { service: 'made-up', name: 'Lee', phone: '0821234567', preferredTime: 'midnight' });
  assert.strictEqual(unsure.status, 200);
  assert.strictEqual(db.tables.bookings.at(-1).service, 'Not sure yet – please advise');
  assert.strictEqual(db.tables.bookings.at(-1).preferred_time, 'any');

  assert.strictEqual((await post('/api/booking', { name: '', phone: '0821234567' })).status, 400);
  assert.strictEqual((await post('/api/booking', { name: 'Lee', phone: '12' })).status, 400);
  assert.strictEqual((await post('/api/booking', { name: 'Lee', phone: '0821234567', contactMethod: 'email' })).status, 400);
});

test('pages are served without .html', async () => {
  for (const page of ['/', '/about', '/services', '/shop', '/gallery', '/contact', '/cart', '/account', '/forgot-password', '/reset-password', '/book']) {
    assert.strictEqual((await realFetch(base + page)).status, 200, page);
  }
  assert.strictEqual((await realFetch(base + '/missing')).status, 404);
});
