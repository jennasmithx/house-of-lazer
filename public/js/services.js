(async () => {
  const list = document.getElementById('services-list');
  try {
    const services = await getJson('/api/services');
    list.innerHTML = services.map((s) => serviceCard(s, { detailed: true })).join('');
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  } catch {
    list.innerHTML = '<div class="alert alert--error">Treatments could not be loaded. Please refresh the page.</div>';
  }
})();
