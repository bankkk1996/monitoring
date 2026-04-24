const express = require('express');
const db = require('../services/database');

const router = express.Router();

const BASE_SELECT = `
  SELECT a.*, d.domain AS domain_name, d.name AS website_name, u.name AS user_name
  FROM alerts a
  JOIN domains d ON d.id = a.domain_id
  JOIN users u ON u.id = a.user_id
`;

function normalize(a) {
  if (!a) return a;
  return { ...a, repeat_daily: a.repeat_daily === 1 || a.repeat_daily === true };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`${BASE_SELECT} ORDER BY d.domain, a.type, a.days_before DESC`).all();
  res.json(rows.map(normalize));
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${BASE_SELECT} WHERE a.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(normalize(row));
});

router.post('/', (req, res) => {
  const { domain_id, user_id, type, days_before, repeat_daily } = req.body || {};
  if (!domain_id || !user_id || !type || days_before === undefined) {
    return res.status(400).json({ error: 'domain_id, user_id, type, days_before required' });
  }
  if (!['ssl', 'domain'].includes(type)) {
    return res.status(400).json({ error: 'type must be ssl or domain' });
  }
  try {
    const info = db
      .prepare(
        'INSERT INTO alerts (domain_id, user_id, type, days_before, repeat_daily) VALUES (?, ?, ?, ?, ?)'
      )
      .run(domain_id, user_id, type, parseInt(days_before, 10), repeat_daily ? 1 : 0);
    const row = db.prepare(`${BASE_SELECT} WHERE a.id = ?`).get(info.lastInsertRowid);
    res.status(201).json(normalize(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { domain_id, user_id, type, days_before, repeat_daily } = req.body || {};
  db.prepare(
    'UPDATE alerts SET domain_id = ?, user_id = ?, type = ?, days_before = ?, repeat_daily = ? WHERE id = ?'
  ).run(
    domain_id !== undefined ? domain_id : existing.domain_id,
    user_id !== undefined ? user_id : existing.user_id,
    type !== undefined ? type : existing.type,
    days_before !== undefined ? parseInt(days_before, 10) : existing.days_before,
    repeat_daily === undefined ? existing.repeat_daily : repeat_daily ? 1 : 0,
    req.params.id
  );
  const row = db.prepare(`${BASE_SELECT} WHERE a.id = ?`).get(req.params.id);
  res.json(normalize(row));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
