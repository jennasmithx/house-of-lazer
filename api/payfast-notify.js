// PayFast's Instant Transaction Notification. PayFast POSTs here
// server-to-server after a payment attempt; this is the only place an order
// is ever marked paid. Modelled on PetPaw Haven's live handler.

const payfast = require('../lib/payfast');
const { getAdmin, isConfigured } = require('../lib/supabase');
const { readRawBody } = require('../lib/http');
const { sendOrderPaidEmails } = require('../lib/email');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!isConfigured()) return res.status(200).send('demo mode: nothing to update');

  const raw = await readRawBody(req);
  const data = Object.fromEntries(new URLSearchParams(raw));
  const cfg = payfast.config();

  if (data.merchant_id !== cfg.merchantId) {
    console.error('[ITN] merchant ID mismatch');
    return res.status(400).send('merchant mismatch');
  }
  if (!payfast.verifyItnSignature(raw)) {
    console.error('[ITN] signature mismatch');
    return res.status(400).send('invalid signature');
  }
  if (!(await payfast.validateWithPayfast(raw))) {
    console.error('[ITN] PayFast did not validate the notification');
    return res.status(400).send('validation failed');
  }

  const db = getAdmin();
  const { data: order } = await db.from('orders').select('*').eq('id', data.m_payment_id).maybeSingle();
  if (!order) {
    console.error('[ITN] unknown order', data.m_payment_id);
    return res.status(404).send('order not found');
  }

  const paid = Number(data.amount_gross ?? data.amount);
  if (Math.abs(paid - Number(order.total)) > 0.01) {
    console.error('[ITN] amount mismatch', paid, order.total);
    await db.from('orders').update({ status: 'amount_mismatch' }).eq('id', order.id);
    return res.status(400).send('amount mismatch');
  }

  if (data.payment_status !== 'COMPLETE') {
    const status = data.payment_status === 'CANCELLED' ? 'cancelled' : 'failed';
    if (order.status === 'pending') await db.from('orders').update({ status }).eq('id', order.id);
    return res.status(200).send('not complete');
  }

  // Only the first COMPLETE notification flips the order and sends emails;
  // PayFast retries would otherwise send duplicates.
  const { data: updated } = await db
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payfast_payment_id: data.pf_payment_id })
    .eq('id', order.id)
    .neq('status', 'paid')
    .select();
  if (!updated || updated.length === 0) return res.status(200).send('already processed');

  try {
    const { data: items } = await db.from('order_items').select('*').eq('order_id', order.id);
    await sendOrderPaidEmails(updated[0], items || []);
  } catch (err) {
    console.error('[ITN] order email failed:', err);
  }

  console.log(`[ITN] order ${order.id} paid`);
  res.status(200).send('OK');
};
