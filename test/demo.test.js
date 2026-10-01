// With no Supabase settings the site runs as a demo: nothing is saved, but
// checkout still reaches the PayFast sandbox.
const test = require('node:test');
const assert = require('node:assert');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;
process.env.PAYFAST_SANDBOX = 'true';

const app = require('../dev-server');

let server, base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('shop config reports demo mode', async () => {
  const cfg = await (await fetch(`${base}/api/shop-config`)).json();
  assert.strictEqual(cfg.demo, true);
  assert.strictEqual(cfg.supabaseUrl, null);
});

test('checkout still builds a PayFast sandbox payment', async () => {
  const res = await post('/api/checkout', { items: [{ id: 'cooling-gel', qty: 2 }], customer: { firstName: 'A', lastName: 'B', email: 'a@b.co' }, fulfilment: 'collect' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.demo, true);
  assert.match(body.action, /sandbox\.payfast/);
  assert.strictEqual(Object.fromEntries(body.fields).amount, '318.00');

  const status = await (await fetch(`${base}/api/order-status?id=${body.orderId}`)).json();
  assert.strictEqual(status.status, 'demo');
});

test('contact form and payment notifications succeed without saving', async () => {
  const contact = await (await post('/api/contact', { name: 'A', email: 'a@b.co', message: 'Hi' })).json();
  assert.deepStrictEqual(contact, { ok: true, demo: true });
  const itn = await fetch(`${base}/api/payfast-notify`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'm_payment_id=HL-1' });
  assert.strictEqual(itn.status, 200);
});
