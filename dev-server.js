// Local development server that mimics Vercel: serves public/ with clean URLs
// and mounts each api/*.js file at /api/<name>. Vercel itself doesn't use this.

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

try { process.loadEnvFile(); } catch { /* no .env file */ }

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Vercel parses JSON bodies; form bodies (PayFast ITN) are left as a stream.
app.use('/api', express.json({ limit: '50kb' }));

for (const file of fs.readdirSync(path.join(__dirname, 'api'))) {
  if (!file.endsWith('.js') || file.startsWith('_')) continue;
  const handler = require(`./api/${file}`);
  app.all(`/api/${file.slice(0, -3)}`, async (req, res, next) => {
    try { await handler(req, res); } catch (err) { next(err); }
  });
}

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`House of Lazer dev server: http://localhost:${PORT}`));
}

module.exports = app;
