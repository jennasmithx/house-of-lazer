// Customer accounts via Supabase Auth. Needs the supabase-js script and
// site.js loaded first. Only pages that use accounts load this file.

const Auth = (() => {
  let clientPromise;

  // Supabase settings come from the server so they live in one place (.env / Vercel).
  function client() {
    clientPromise ??= getJson('/api/shop-config').then((cfg) => {
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

  return { client, session, profile, signIn, signUp, signOut, sendPasswordReset, updatePassword, updateProfile, orders };
})();
