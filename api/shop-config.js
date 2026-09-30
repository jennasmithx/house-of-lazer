const { deliveryFee } = require('../lib/shop');
const payfast = require('../lib/payfast');

// Public settings the browser needs. The Supabase anon (publishable) key is
// designed to be public; row-level security protects the data.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
  res.status(200).json({
    deliveryFee: deliveryFee(),
    sandbox: payfast.config().sandbox,
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
};
