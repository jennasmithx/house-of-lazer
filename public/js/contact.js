(async () => {
  document.getElementById('contact-details').innerHTML = `
    <li><span class="icon-badge">${ICONS.pin}</span><span><strong>Studio</strong>${escapeHtml(SITE.address)}</span></li>
    <li><span class="icon-badge">${ICONS.phone}</span><span><strong>Phone / WhatsApp</strong><a href="tel:${SITE.phone.replace(/\s/g, '')}">${SITE.phone}</a></span></li>
    <li><span class="icon-badge">${ICONS.mail}</span><span><strong>Email</strong><a href="mailto:${SITE.email}">${SITE.email}</a></span></li>`;

  const form = document.getElementById('contact-form');
  const alertEl = document.getElementById('contact-alert');
  const select = document.getElementById('c-service');

  try {
    const services = await getJson('/api/services');
    select.insertAdjacentHTML('beforeend', services.map((s) => `<option value="${escapeHtml(s.name)}" data-id="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join(''));
    const wanted = new URLSearchParams(location.search).get('service');
    const match = [...select.options].find((o) => o.dataset.id === wanted);
    if (match) match.selected = true;
  } catch { /* keep "General enquiry" only */ }

  function show(type, text) {
    alertEl.className = `alert alert--${type}`;
    alertEl.textContent = text;
    alertEl.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      form.reset();
      show('success', "Thanks! Your message has been sent. We'll be in touch soon.");
    } catch (err) {
      show('error', err.message);
    } finally {
      btn.disabled = false;
    }
  });
})();
