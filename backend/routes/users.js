const express = require('express');
const db = require('../services/database');
const { sendLine, sendEmail } = require('../services/notifier');
const config = require('../config');

const router = express.Router();

function normalizeUser(u) {
  if (!u) return u;
  return { ...u, active: u.active === 1 || u.active === true };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY name ASC').all();
  res.json(rows.map(normalizeUser));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(normalizeUser(row));
});

router.post('/', (req, res) => {
  const { name, line_token, email, active } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const info = db
      .prepare(
        'INSERT INTO users (name, line_token, email, active) VALUES (?, ?, ?, ?)'
      )
      .run(name.trim(), line_token || null, email || null, active === false ? 0 : 1);
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(normalizeUser(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { name, line_token, email, active } = req.body || {};
  db.prepare(
    'UPDATE users SET name = ?, line_token = ?, email = ?, active = ? WHERE id = ?'
  ).run(
    name !== undefined ? name : existing.name,
    line_token !== undefined ? line_token : existing.line_token,
    email !== undefined ? email : existing.email,
    active === undefined ? existing.active : active ? 1 : 0,
    req.params.id
  );
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(normalizeUser(row));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Test notification channels for a user
router.post('/:id/test', async (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const results = { line: null, email: null };
  const msg = `\n[Test] Monitor notification for ${row.name}`;
  if (row.line_token) {
    try { await sendLine(row.line_token, msg); results.line = 'sent'; }
    catch (err) { results.line = `error: ${err.message}`; }
  } else {
    results.line = 'skipped';
  }
  if (row.email && config.smtp.enabled) {
    try { await sendEmail(row.email, '[Monitor] Test', msg); results.email = 'sent'; }
    catch (err) { results.email = `error: ${err.message}`; }
  } else {
    results.email = 'skipped';
  }
  res.json(results);
});

module.exports = router;
