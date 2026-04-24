const express = require('express');
const cors = require('cors');
const config = require('./config');
require('./services/database'); // ensure migrations run

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: config.env, time: new Date().toISOString() });
});

app.use('/api/domains', require('./routes/domains'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/users', require('./routes/users'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/dashboard', require('./routes/dashboard'));

// 404 for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Generic error handler
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const { start: startCron } = require('./cron/monitor');

app.listen(config.port, () => {
  console.log(`[server] listening on http://localhost:${config.port}`);
  startCron();
});
