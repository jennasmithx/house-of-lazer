// POST { items: [{ id, qty }], customer, fulfilment: 'collect' | 'delivery', address }
// Creates a pending order and returns the PayFast form fields for the browser
// to post. If the request carries a Supabase access token, the order is
// linked to that customer's account.

const crypto = require('node:crypto');
const payfast = require('../lib/payfast');
const { priceCart } = require('../lib/shop');
const { getAdmin, getUser } = require('../lib/supabase');
const { allow, clean, isEmail, siteUrl } = require('../lib/http');

module.exports = async (req, res) => {
  if (!allow(req, res, 'POST')) return;
  const { items, customer = {}, fulfilment, address = {} } = req.body || {};

  let priced;
  try {
    priced = priceCart(items, fulfilment);
  } catch (err) {
    return res.status(400).json({ error: err.message });
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

  const addr = { street: null, suburb: null, city: null, postal_code: null };
  if (fulfilment === 'delivery') {
    addr.street = clean(address.street);
    addr.suburb = clean(address.suburb) || null;
    addr.city = clean(address.city);
    addr.postal_code = clean(address.postalCode, 10);
    if (!addr.street || !addr.city || !addr.postal_code) {
      return res.status(400).json({ error: 'Please enter your full delivery address.' });
    }
  }

  const user = await getUser(req);
  const orderId = `HL-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const db = getAdmin();

  const { error: orderError } = await db.from('orders').insert({
    id: orderId,
    user_id: user ? user.id : null,
    status: 'pending',
    first_name: firstName,
    last_name: lastName,
    email,
    phone: phone || null,
    fulfilment,
    ...addr,
    subtotal: priced.subtotal,
    delivery_fee: priced.deliveryFee,
    total: priced.total,
  });
  if (orderError) {
    console.error('Order insert failed:', orderError);
    return res.status(500).json({ error: 'Could not create your order. Please try again.' });
  }

  const { error: itemsError } = await db.from('order_items').insert(priced.lines.map((l) => ({ order_id: orderId, ...l })));
  if (itemsError) {
    console.error('Order items insert failed:', itemsError);
    await db.from('orders').delete().eq('id', orderId);
    return res.status(500).json({ error: 'Could not create your order. Please try again.' });
  }

  const base = siteUrl();
  const itemCount = priced.lines.reduce((n, l) => n + l.qty, 0);
  const payment = payfast.buildPayment({
    return_url: `${base}/checkout-success?order=${orderId}`,
    cancel_url: `${base}/checkout-cancel?order=${orderId}`,
    notify_url: `${base}/api/payfast-notify`,
    name_first: firstName,
    name_last: lastName,
    email_address: email,
    cell_number: /^0\d{9}$/.test(phone) ? phone : undefined,
    m_payment_id: orderId,
    amount: priced.total.toFixed(2),
    item_name: `House of Lazer order ${orderId}`,
    item_description: `${itemCount} item${itemCount === 1 ? '' : 's'} – ${fulfilment === 'delivery' ? 'delivery' : 'collect in store'}`,
  });

  res.status(200).json({ orderId, ...payment });
};
