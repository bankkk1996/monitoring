const express = require('express');
const db = require('../services/database');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM domains d WHERE d.category_id = c.id) AS domain_count
       FROM categories c ORDER BY c.name ASC`
    )
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, color } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  try {
    const info = db
      .prepare('INSERT INTO categories (name, color) VALUES (?, ?)')
      .run(name.trim(), color || '#3b82f6');
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { name, color } = req.body || {};
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  try {
    db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(
      name ? name.trim() : existing.name,
      color || existing.color,
      req.params.id
    );
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(row);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Category name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
