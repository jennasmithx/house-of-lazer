// Forgot-password and reset-password pages.
(() => {
  function show(el, type, text) {
    el.className = `alert alert--${type}`;
    el.textContent = text;
    el.hidden = false;
  }

  const forgot = document.getElementById('forgot-form');
  forgot?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('forgot-alert');
    const email = String(new FormData(forgot).get('email')).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show(alertEl, 'error', 'Please enter a valid email address.');
    const btn = forgot.querySelector('button');
    btn.disabled = true;
    try {
      await Auth.sendPasswordReset(email);
      // Same message whether or not the account exists, so emails can't be probed.
      show(alertEl, 'success', `If an account exists for ${email}, a reset link is on its way. Check your inbox and spam folder.`);
    } catch (err) {
      show(alertEl, 'error', err.message);
    } finally {
      btn.disabled = false;
    }
  });

  const reset = document.getElementById('reset-form');
  if (reset) {
    const alertEl = document.getElementById('reset-alert');
    const btn = reset.querySelector('button');

    // The email link signs the customer in with a short-lived recovery
    // session; supabase-js reads it from the URL before getSession() resolves.
    (async () => {
      if (!(await Auth.session())) {
        reset.innerHTML = `
          <h2>Link expired</h2>
          <p class="muted">This reset link is invalid or has expired. Please request a new one.</p>
          <a class="btn btn--primary btn--block" href="/forgot-password">Request a new link</a>`;
      }
    })();

    reset.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(reset);
      const password = String(f.get('password'));
      if (password.length < 8) return show(alertEl, 'error', 'Your password must be at least 8 characters.');
      if (password !== String(f.get('confirm'))) return show(alertEl, 'error', "The passwords don't match.");
      btn.disabled = true;
      try {
        await Auth.updatePassword(password);
        reset.innerHTML = `
          <h2>Password updated</h2>
          <p class="muted">Your new password is set and you're signed in.</p>
          <a class="btn btn--primary btn--block" href="/account">Go to my account</a>`;
        renderHeader();
      } catch (err) {
        show(alertEl, 'error', err.message);
        btn.disabled = false;
      }
    });
  }
})();
