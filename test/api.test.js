const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ordersFile = path.join(__dirname, '..', 'data', 'orders.json');
const backup = fs.existsSync(ordersFile) ? fs.readFileSync(ordersFile) : null;
const app = require('../server');

let server, base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
  server.close();
  if (backup) fs.writeFileSync(ordersFile, backup); else fs.rmSync(ordersFile, { force: true });
});

const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const customer = { firstName: 'Test', lastName: 'Buyer', email: 'test@example.com', phone: '0821234567' };

test('checkout prices from the catalogue and adds delivery', async () => {
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
  assert.strictEqual(fields.merchant_id, '10000100');

  const status = await (await fetch(`${base}/api/orders/${body.orderId}/status`)).json();
  assert.strictEqual(status.status, 'pending');
});

test('collection is free', async () => {
  const body = await (await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 1 }], customer, fulfilment: 'collect' })).json();
  assert.strictEqual(Object.fromEntries(body.fields).amount, '159.00');
});

test('rejects bad input', async () => {
  assert.strictEqual((await post('/api/checkout', { items: [], customer, fulfilment: 'collect' })).status, 400);
  assert.strictEqual((await post('/api/checkout', { items: [{ id: 'nope', qty: 1 }], customer, fulfilment: 'collect' })).status, 400);
  assert.strictEqual((await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 0 }], customer, fulfilment: 'collect' })).status, 400);
  assert.strictEqual((await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 1 }], customer, fulfilment: 'delivery' })).status, 400);
});

test('pages are served without .html', async () => {
  for (const page of ['/', '/about', '/services', '/shop', '/gallery', '/contact', '/cart']) {
    assert.strictEqual((await fetch(base + page)).status, 200, page);
  }
  assert.strictEqual((await fetch(base + '/missing')).status, 404);
});
