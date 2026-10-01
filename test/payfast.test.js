const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const payfast = require('../lib/payfast');

process.env.PAYFAST_PASSPHRASE = 'test-passphrase';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

test('encode matches PHP urlencode', () => {
  assert.strictEqual(payfast.encode("a b!'()*~"), 'a+b%21%27%28%29%2A%7E');
  assert.strictEqual(payfast.encode('  trimmed  '), 'trimmed');
  assert.strictEqual(payfast.encode('x@y.com'), 'x%40y.com');
});

test('signature skips empty fields and appends passphrase', () => {
  const sig = payfast.signature([['merchant_id', '1'], ['name_first', ''], ['amount', '10.00'], ['item_name', 'A & B']], 'secret');
  assert.strictEqual(sig, md5('merchant_id=1&amount=10.00&item_name=A+%26+B&passphrase=secret'));
});

test('buildPayment emits fields in PayFast order with a valid signature', () => {
  const { fields, action } = payfast.buildPayment({ item_name: 'Order', amount: '100.00', m_payment_id: 'HL-1', return_url: 'http://x/ok' });
  assert.match(action, /sandbox\.payfast\.co\.za\/eng\/process$/);
  const keys = fields.map(([k]) => k);
  assert.deepStrictEqual(keys, ['merchant_id', 'merchant_key', 'return_url', 'm_payment_id', 'amount', 'item_name', 'signature']);
  const sig = fields.pop()[1];
  assert.strictEqual(sig, payfast.signature(fields, payfast.config().passphrase));
});

test('ITN signature verification', () => {
  const pairs = [['m_payment_id', 'HL-1'], ['pf_payment_id', '123'], ['payment_status', 'COMPLETE'], ['custom_str1', ''], ['amount_gross', '100.00']];
  const base = pairs.map(([k, v]) => `${k}=${payfast.encode(v)}`).join('&');
  const sig = md5(`${base}&passphrase=${payfast.config().passphrase}`);
  assert.ok(payfast.verifyItnSignature(`${base}&signature=${sig}`));
  assert.ok(!payfast.verifyItnSignature(`${base.replace('100.00', '1.00')}&signature=${sig}`));
  assert.ok(!payfast.verifyItnSignature(base));
});

test('without a passphrase, requests are unsigned', () => {
  const saved = process.env.PAYFAST_PASSPHRASE;
  process.env.PAYFAST_PASSPHRASE = '';
  try {
    const { fields } = payfast.buildPayment({ item_name: 'Order', amount: '1.00' });
    assert.ok(!fields.some(([k]) => k === 'signature'));
  } finally {
    process.env.PAYFAST_PASSPHRASE = saved;
  }
});
