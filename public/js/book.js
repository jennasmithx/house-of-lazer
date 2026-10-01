(async () => {
  const form = document.getElementById('booking-form');
  const alertEl = document.getElementById('booking-alert');
  const select = document.getElementById('b-service');
  const date = document.getElementById('b-date');

  // Earliest pickable day is today.
  const today = new Date();
  date.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  if (SITE.whatsapp) {
    document.getElementById('whatsapp-card').hidden = false;
    document.getElementById('whatsapp-link').href = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent("Hi House of Lazer, I'd like to book a treatment.")}`;
  }

  try {
    const services = await getJson('/api/services');
    select.insertAdjacentHTML('beforeend', services.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (from ${money(s.from).replace('.00', '')})</option>`).join(''));
    const wanted = new URLSearchParams(location.search).get('service');
    if (services.some((s) => s.id === wanted)) select.value = wanted;
  } catch { /* "Not sure yet" still works */ }

  function show(type, text) {
    alertEl.className = `alert alert--${type}`;
    alertEl.textContent = text;
    alertEl.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!String(data.name).trim()) return show('error', 'Please enter your name.');
    if (String(data.phone).replace(/\D/g, '').length < 9) return show('error', 'Please enter your cellphone number so we can reach you.');

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try {
      const res = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');

      const how = { whatsapp: 'on WhatsApp', call: 'with a call', email: 'by email' }[data.contactMethod] || '';
      form.innerHTML = `
        <div class="center" style="padding:20px 0">
          <div class="status-icon">${ICONS.check}</div>
          <h2>Request received</h2>
          <p class="muted">Thanks, ${escapeHtml(String(data.name).trim().split(' ')[0])}! We'll be in touch ${how} to confirm your appointment, usually within one working day.</p>
          ${body.demo ? '<div class="alert alert--info" style="margin-top:16px">Preview: on the live site, this request is emailed to you straight away.</div>' : ''}
          <a class="btn btn--outline" href="/services" style="margin-top:16px">Back to treatments</a>
        </div>`;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      show('error', err.message);
      btn.disabled = false;
      btn.textContent = 'Send booking request';
    }
  });
})();
