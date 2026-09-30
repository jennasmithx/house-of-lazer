const crypto = require('node:crypto');
const { getAdmin } = require('../lib/supabase');
const { allow, clean, isEmail } = require('../lib/http');
const { sendContactEmail } = require('../lib/email');

module.exports = async (req, res) => {
  if (!allow(req, res, 'POST')) return;
  const { name, email, phone, service, message } = req.body || {};
  const msg = {
    id: crypto.randomUUID(),
    name: clean(name, 100),
    email: clean(email, 100),
    phone: clean(phone, 20) || null,
    service: clean(service, 100) || null,
    message: clean(message, 2000),
  };
  if (!msg.name || !isEmail(msg.email) || !msg.message) {
    return res.status(400).json({ error: 'Please enter your name, a valid email and a message.' });
  }

  const { error } = await getAdmin().from('messages').insert(msg);
  if (error) {
    console.error('Message insert failed:', error);
    return res.status(500).json({ error: 'Your message could not be sent. Please try again or call us.' });
  }
  try {
    await sendContactEmail(msg);
  } catch (err) {
    console.error('Contact email failed:', err);
  }
  res.status(200).json({ ok: true });
};
