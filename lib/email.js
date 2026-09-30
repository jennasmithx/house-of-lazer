// Sends mail through Resend's REST API, as PetPaw Haven does. Resend needs a
// verified sending domain; until RESEND_API_KEY is set, emails are skipped.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = (n) => `R${Number(n).toFixed(2)}`;

async function sendEmail({ to, subject, text, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email skipped: RESEND_API_KEY not set] ${subject} -> ${to}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'House of Lazer <orders@houseoflazer.co.za>',
      to,
      subject,
      text,
      html,
      reply_to: replyTo,
    }),
  });
  if (!res.ok) throw new Error(`Resend send failed (${res.status}): ${await res.text()}`);
}

function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#faf7f3;font-family:Arial,sans-serif;color:#1d1a1f">
<div style="max-width:600px;margin:30px auto;background:#fff;border:1px solid #e4dcd3;border-radius:12px;overflow:hidden">
  <div style="padding:24px 30px;background:#1d1a1f;color:#faf7f3">
    <div style="font-family:Georgia,serif;font-size:24px">House of <span style="color:#d49a82">Lazer</span></div>
    <div style="font-size:13px;color:#cfc6cc;margin-top:4px">${esc(title)}</div>
  </div>
  <div style="padding:30px;font-size:15px;line-height:1.6">${body}</div>
</div></body></html>`;
}

function itemsTable(order, items) {
  const rows = items.map((i) => `<tr>
      <td style="padding:10px 6px;border-bottom:1px solid #eee">${esc(i.name)}</td>
      <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${rand(i.price * i.qty)}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr style="background:#f1ebe4"><th style="padding:10px 6px;text-align:left">Item</th><th style="padding:10px 6px">Qty</th><th style="padding:10px 6px;text-align:right">Price</th></tr>
    ${rows}
    <tr><td colspan="2" style="padding:10px 6px">${order.fulfilment === 'delivery' ? 'Delivery' : 'Collection'}</td><td style="padding:10px 6px;text-align:right">${order.delivery_fee ? rand(order.delivery_fee) : 'Free'}</td></tr>
    <tr><td colspan="2" style="padding:12px 6px;font-weight:bold">Total</td><td style="padding:12px 6px;text-align:right;font-weight:bold">${rand(order.total)}</td></tr>
  </table>`;
}

function addressBlock(order) {
  if (order.fulfilment !== 'delivery') return '<p><strong>Collect in store.</strong> We\'ll let you know when your order is ready.</p>';
  return `<p><strong>Delivering to:</strong><br>${esc(order.street)}<br>${order.suburb ? esc(order.suburb) + '<br>' : ''}${esc(order.city)}, ${esc(order.postal_code)}</p>`;
}

async function sendOrderPaidEmails(order, items) {
  const lines = items.map((i) => `- ${i.name} x${i.qty}: ${rand(i.price * i.qty)}`).join('\n');
  const where = order.fulfilment === 'delivery'
    ? `Delivering to: ${order.street}, ${order.suburb ? order.suburb + ', ' : ''}${order.city}, ${order.postal_code}`
    : 'Collect in store';

  await sendEmail({
    to: order.email,
    subject: `Order confirmed: ${order.id}`,
    text: `Hi ${order.first_name},\n\nThank you for your order! Your payment of ${rand(order.total)} has been received.\n\nOrder: ${order.id}\n${lines}\nTotal: ${rand(order.total)}\n\n${where}\n\nHouse of Lazer`,
    html: layout('Order confirmation', `
      <h2 style="font-family:Georgia,serif;margin-top:0">Thank you, ${esc(order.first_name)}!</h2>
      <p>Your payment of <strong>${rand(order.total)}</strong> has been received.</p>
      <p style="color:#7b7380;font-size:13px">Order number: <strong>${esc(order.id)}</strong></p>
      ${itemsTable(order, items)}
      ${addressBlock(order)}`),
  });

  if (process.env.STORE_EMAIL) {
    await sendEmail({
      to: process.env.STORE_EMAIL,
      replyTo: order.email,
      subject: `New paid order ${order.id}: ${rand(order.total)} (${order.fulfilment})`,
      text: `${order.first_name} ${order.last_name} paid ${rand(order.total)}.\n\n${lines}\n\n${where}\n\nEmail: ${order.email}\nPhone: ${order.phone || '-'}`,
      html: layout('New paid order', `
        <p><strong>${esc(order.first_name)} ${esc(order.last_name)}</strong><br>${esc(order.email)}<br>${esc(order.phone || '')}</p>
        ${itemsTable(order, items)}
        ${addressBlock(order)}
        <p style="color:#7b7380;font-size:13px">Order ${esc(order.id)}</p>`),
    });
  }
}

async function sendContactEmail(msg) {
  if (!process.env.STORE_EMAIL) return;
  await sendEmail({
    to: process.env.STORE_EMAIL,
    replyTo: msg.email,
    subject: `New enquiry from ${msg.name}${msg.service ? `: ${msg.service}` : ''}`,
    text: `${msg.name} (${msg.email}${msg.phone ? `, ${msg.phone}` : ''})\nTreatment: ${msg.service || 'General enquiry'}\n\n${msg.message}`,
    html: layout('New enquiry', `
      <p><strong>${esc(msg.name)}</strong><br>${esc(msg.email)}<br>${esc(msg.phone || '')}</p>
      <p><strong>Treatment:</strong> ${esc(msg.service || 'General enquiry')}</p>
      <p style="white-space:pre-wrap">${esc(msg.message)}</p>`),
  });
}

module.exports = { sendEmail, sendOrderPaidEmails, sendContactEmail };
