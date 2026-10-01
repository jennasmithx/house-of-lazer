// Booking requests. Customers pick a treatment and when suits them; the
// owner then contacts them to confirm a time. Nothing is booked automatically.

const crypto = require('node:crypto');
const { services } = require('../lib/shop');
const { getAdmin, isConfigured } = require('../lib/supabase');
const { allow, clean, isEmail } = require('../lib/http');
const { sendBookingEmail } = require('../lib/email');

const TIMES = ['morning', 'afternoon', 'any'];
const METHODS = ['whatsapp', 'call', 'email'];

module.exports = async (req, res) => {
  if (!allow(req, res, 'POST')) return;
  const b = req.body || {};

  const service = services.find((s) => s.id === b.service);
  const booking = {
    id: crypto.randomUUID(),
    service: service ? service.name : 'Not sure yet – please advise',
    name: clean(b.name, 100),
    phone: clean(b.phone, 20),
    email: clean(b.email, 100) || null,
    contact_method: METHODS.includes(b.contactMethod) ? b.contactMethod : 'whatsapp',
    preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(b.preferredDate || '') ? b.preferredDate : null,
    preferred_time: TIMES.includes(b.preferredTime) ? b.preferredTime : 'any',
    first_visit: b.firstVisit === 'yes' ? true : b.firstVisit === 'no' ? false : null,
    notes: clean(b.notes, 1000) || null,
  };

  if (!booking.name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!/^\+?[\d\s()-]{9,20}$/.test(booking.phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (booking.email && !isEmail(booking.email)) return res.status(400).json({ error: 'Please enter a valid email address, or leave it blank.' });
  if (booking.contact_method === 'email' && !booking.email) return res.status(400).json({ error: 'Please add your email address so we can reply by email.' });

  if (!isConfigured()) return res.status(200).json({ ok: true, demo: true });

  const { error } = await getAdmin().from('bookings').insert(booking);
  if (error) {
    console.error('Booking insert failed:', error);
    return res.status(500).json({ error: 'Your request could not be sent. Please try again or call us.' });
  }
  try {
    await sendBookingEmail(booking);
  } catch (err) {
    console.error('Booking email failed:', err);
  }
  res.status(200).json({ ok: true });
};
