// Customer accounts via Supabase Auth. Needs the supabase-js script and
// site.js loaded first. Only pages that use accounts load this file.

const Auth = (() => {
  let clientPromise;

  // Supabase settings come from the server so they live in one place (.env / Vercel).
  function client() {
    clientPromise ??= shopConfig().then((cfg) => {
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
      return window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }).catch(() => null);
    return clientPromise;
  }

  async function session() {
    const sb = await client();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session;
  }

  async function profile() {
    const sb = await client();
    const s = await session();
    if (!sb || !s) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    return { email: s.user.email, ...(data || {}) };
  }

  async function signIn(email, password) {
    const sb = await requireClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid login/i.test(error.message) ? 'Incorrect email or password.' : error.message);
  }

  // Returns true when the customer is signed straight in, false when Supabase
  // wants them to confirm their email first.
  async function signUp({ email, password, firstName, lastName, phone }) {
    const sb = await requireClient();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, phone },
        emailRedirectTo: `${location.origin}/account`,
      },
    });
    if (error) throw new Error(/already registered/i.test(error.message) ? 'An account with this email already exists. Try signing in instead.' : error.message);
    // Supabase hides existing accounts by returning a user with no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Try signing in instead.');
    }
    return Boolean(data.session);
  }

  async function signOut() {
    const sb = await client();
    if (sb) await sb.auth.signOut();
  }

  async function sendPasswordReset(email) {
    const sb = await requireClient();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
    if (error) throw new Error(error.message);
  }

  async function updatePassword(password) {
    const sb = await requireClient();
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }

  async function updateProfile(changes) {
    const sb = await requireClient();
    const s = await session();
    if (!s) throw new Error('Please sign in again.');
    const { error } = await sb.from('profiles').update(changes).eq('id', s.user.id);
    if (error) throw new Error('Your details could not be saved. Please try again.');
  }

  async function orders() {
    const sb = await requireClient();
    const { data, error } = await sb
      .from('orders')
      .select('id, created_at, status, total, fulfilment, order_items (name, qty, price)')
      .neq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Your orders could not be loaded.');
    return data;
  }

  async function requireClient() {
    const sb = await client();
    if (!sb) throw new Error('Accounts are not available right now. Please try again later.');
    return sb;
  }

  // Notifies `callback` whenever the customer signs in or out.
  async function onChange(callback) {
    const sb = await client();
    if (sb) sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(callback, 0);
    });
  }

  return { client, session, profile, signIn, signUp, signOut, sendPasswordReset, updatePassword, updateProfile, orders, onChange };
})();

// ---- Demo preview ----
// Until Supabase is connected, accounts are simulated in this browser tab so
// the sign-in, account and pre-filled checkout pages can still be shown.
const DemoAuth = (() => {
  const KEY = 'hol-demo-user';
  const listeners = [];
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; } };
  const write = (u) => {
    try { u ? sessionStorage.setItem(KEY, JSON.stringify(u)) : sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    listeners.forEach((cb) => setTimeout(cb, 0));
  };
  const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString();

  return {
    session: async () => { const u = read(); return u ? { user: { id: 'demo', email: u.email }, access_token: null } : null; },
    profile: async () => read(),
    async signIn(email, password) {
      if (!email || !password) throw new Error('Please enter your email and password.');
      write({ email, first_name: 'Thandi', last_name: 'Demo', phone: '0821234567', street: '12 Example Street', suburb: 'Gardens', city: 'Cape Town', postal_code: '8001' });
    },
    async signUp({ email, firstName, lastName, phone }) {
      write({ email, first_name: firstName, last_name: lastName, phone });
      return true;
    },
    async signOut() { write(null); },
    async sendPasswordReset() {},
    async updatePassword() {},
    async updateProfile(changes) { write({ ...read(), ...changes }); },
    async orders() {
      return [
        { id: 'HL-DEMO000002', created_at: daysAgo(3), status: 'ready', total: 578, fulfilment: 'collect', order_items: [{ name: 'Laser Aftercare Balm', qty: 1, price: 249 }, { name: 'Mineral SPF 50 Sunscreen', qty: 1, price: 329 }] },
        { id: 'HL-DEMO000001', created_at: daysAgo(40), status: 'shipped', total: 554, fulfilment: 'delivery', order_items: [{ name: 'Vitamin C Brightening Serum', qty: 1, price: 459 }] },
      ];
    },
    async onChange(cb) { listeners.push(cb); },
  };
})();

// Swap in the demo when Supabase isn't configured. Pages call these before
// doing anything else, so the choice is made once per page.
const authReady = Auth.client().then((sb) => {
  if (!sb) Object.assign(Auth, DemoAuth, { demo: true });
  return Auth;
});
