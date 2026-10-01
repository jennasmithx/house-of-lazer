(async () => {
  const orderId = new URLSearchParams(location.search).get('order');
  const icon = document.getElementById('status-icon');
  const text = document.getElementById('status-text');
  const detail = document.getElementById('status-detail');
  icon.innerHTML = ICONS.check;
  Cart.clear();

  if (!orderId) return;
  detail.textContent = `Order reference: ${orderId}`;

  // PayFast's notification can land a few seconds after the redirect, so poll briefly.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const order = await getJson(`/api/order-status?id=${encodeURIComponent(orderId)}`);
      const how = order.fulfilment === 'delivery'
        ? "We'll email you when it's on its way."
        : "We'll let you know when it's ready to collect.";
      if (order.status === 'demo') {
        text.textContent = "That was a test payment through PayFast's sandbox. On the live site, the customer gets an email confirmation and the order appears in their account.";
        return;
      }
      if (order.status === 'paid') {
        text.textContent = `Payment of ${money(order.total)} received. ${how}`;
        return;
      }
    } catch { /* keep default message */ }
    await new Promise((r) => setTimeout(r, 2500));
  }
  text.textContent = "Your order has been placed. We'll email you once your payment is confirmed.";
})();
