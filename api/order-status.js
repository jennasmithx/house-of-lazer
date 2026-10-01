// Public order status for the success page. Order IDs are random and the
// response contains no personal details.
const { getAdmin, isConfigured } = require('../lib/supabase');

module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^HL-[0-9A-F]{10}$/.test(id)) return res.status(404).json({ error: 'Order not found' });
  if (!isConfigured()) return res.status(200).json({ id, status: 'demo' });
  const { data: order } = await getAdmin().from('orders').select('id, status, total, fulfilment').eq('id', id).maybeSingle();
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ...order, total: Number(order.total) });
};
