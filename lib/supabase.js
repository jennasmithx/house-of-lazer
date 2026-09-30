const { createClient } = require('@supabase/supabase-js');

// Server-side client using the service role key. It bypasses row-level
// security, so it must only ever be used inside api/ functions.
let admin;
function getAdmin() {
  if (!admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

// Returns the signed-in Supabase user for a request, or null for guests.
async function getUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await getAdmin().auth.getUser(token);
  return error ? null : data.user;
}

// Lets tests swap in a fake client.
function setAdmin(client) {
  admin = client;
}

module.exports = { getAdmin, getUser, setAdmin };
