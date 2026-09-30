const crypto = require('node:crypto');

// Field order matters: PayFast builds the signature string from the fields in
// the order its documentation lists them, so we always emit them in this order.
const FIELD_ORDER = [
  'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
  'name_first', 'name_last', 'email_address', 'cell_number',
  'm_payment_id', 'amount', 'item_name', 'item_description',
  'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
  'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
  'email_confirmation', 'confirmation_address', 'payment_method',
];

function config() {
  const sandbox = process.env.PAYFAST_SANDBOX !== 'false';
  return {
    sandbox,
    merchantId: process.env.PAYFAST_MERCHANT_ID || '10000100',
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
    // Blank for PayFast's shared sandbox account (its passphrase isn't
    // public). Set it when using your own sandbox or live account.
    passphrase: process.env.PAYFAST_PASSPHRASE || '',
    host: sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za',
  };
}

// Matches PHP's urlencode(), which is what PayFast uses server-side:
// spaces become '+', and !'()*~ are percent-encoded.
function encode(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

// `entries` is an array of [key, value] pairs in the order they will be sent.
function signature(entries, passphrase) {
  let str = entries
    .filter(([key, value]) => key !== 'signature' && value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => `${key}=${encode(value)}`)
    .join('&');
  if (passphrase) str += `&passphrase=${encode(passphrase)}`;
  return crypto.createHash('md5').update(str).digest('hex');
}

// Builds the ordered, signed field list for the payment form.
function buildPayment(fields) {
  const cfg = config();
  const all = { merchant_id: cfg.merchantId, merchant_key: cfg.merchantKey, ...fields };
  const entries = FIELD_ORDER
    .filter((key) => all[key] !== undefined && all[key] !== null && String(all[key]).trim() !== '')
    .map((key) => [key, String(all[key]).trim()]);
  // Signing needs the account passphrase. PayFast accepts unsigned requests,
  // which is what we send for the shared sandbox account.
  if (cfg.passphrase) entries.push(['signature', signature(entries, cfg.passphrase)]);
  return {
    action: `https://${cfg.host}/eng/process`,
    fields: entries,
  };
}

// ITN: PayFast signs the exact body it posts, so hash the raw text (minus the
// signature) rather than decoding and re-encoding it. Same approach as
// PetPaw Haven's live integration.
// Without a passphrase we can't reproduce PayFast's signature, so we rely on
// validateWithPayfast() instead (sandbox only; live mode requires one).
function verifyItnSignature(rawBody) {
  const cfg = config();
  if (!cfg.passphrase) return true;
  const received = new URLSearchParams(rawBody).get('signature');
  if (!received) return false;
  const payload = rawBody
    .split('&')
    .filter((part) => !part.startsWith('signature='))
    .join('&')
    .trim();
  const expected = crypto.createHash('md5').update(`${payload}&passphrase=${encode(cfg.passphrase)}`).digest('hex');
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

// Asks PayFast to confirm the ITN data really came from them.
async function validateWithPayfast(rawBody) {
  const cfg = config();
  try {
    const res = await fetch(`https://${cfg.host}/eng/query/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: rawBody,
    });
    const text = (await res.text()).trim();
    if (text !== 'VALID') console.error('PayFast validate returned', res.status, JSON.stringify(text));
    return text === 'VALID';
  } catch (err) {
    console.error('PayFast validate request failed:', err);
    return false;
  }
}

module.exports = { buildPayment, verifyItnSignature, validateWithPayfast, signature, encode, config };
