const express = require('express');
const multer = require('multer');
const db = require('../services/database');
const { normalizeHost } = require('../services/sslChecker');
const { runOnce } = require('../cron/monitor');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const BASE_SELECT = `
  SELECT d.id, d.domain, d.name, d.admin_user_id, d.category_id, d.note, d.created_at,
         c.name AS category_name, c.color AS category_color,
         u.name AS admin_name, u.email AS admin_email,
         CASE WHEN u.line_token IS NOT NULL AND u.line_token <> '' THEN 1 ELSE 0 END AS admin_has_line,
         u.active AS admin_active,
         s.ssl_expiry, s.domain_expiry, s.ssl_error, s.domain_error, s.last_checked
  FROM domains d
  LEFT JOIN categories c ON c.id = d.category_id
  LEFT JOIN users u ON u.id = d.admin_user_id
  LEFT JOIN status_cache s ON s.domain_id = d.id
`;

router.get('/', (req, res) => {
  const { search, category_id, admin_user_id } = req.query;
  const where = [];
  const params = [];
  if (search) {
    where.push('(d.domain LIKE ? OR d.name LIKE ? OR u.name LIKE ? OR d.note LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }
  if (category_id) {
    where.push('d.category_id = ?');
    params.push(category_id);
  }
  if (admin_user_id) {
    where.push('d.admin_user_id = ?');
    params.push(admin_user_id);
  }
  const sql = `${BASE_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.domain ASC`;
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${BASE_SELECT} WHERE d.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { domain, name, admin_user_id, category_id, note } = req.body || {};
  if (!domain || !String(domain).trim()) {
    return res.status(400).json({ error: 'domain is required' });
  }
  const host = normalizeHost(domain);
  try {
    const info = db
      .prepare(
        'INSERT INTO domains (domain, name, admin_user_id, category_id, note) VALUES (?, ?, ?, ?, ?)'
      )
      .run(host, name || null, admin_user_id || null, category_id || null, note || null);
    const row = db.prepare(`${BASE_SELECT} WHERE d.id = ?`).get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Domain already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM domains WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { domain, name, admin_user_id, category_id, note } = req.body || {};
  const host = domain ? normalizeHost(domain) : existing.domain;
  try {
    db.prepare(
      'UPDATE domains SET domain = ?, name = ?, admin_user_id = ?, category_id = ?, note = ? WHERE id = ?'
    ).run(
      host,
      name === undefined ? existing.name : name,
      admin_user_id === undefined ? existing.admin_user_id : (admin_user_id || null),
      category_id === undefined ? existing.category_id : category_id,
      note === undefined ? existing.note : note,
      req.params.id
    );
    const row = db.prepare(`${BASE_SELECT} WHERE d.id = ?`).get(req.params.id);
    res.json(row);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Domain already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM domains WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Trigger an immediate re-check (all domains, or one)
router.post('/check/run', async (req, res) => {
  try {
    const { id } = req.body || {};
    const result = await runOnce(id ? Number(id) : null);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Import CSV — columns (any order, header required):
//   domain (required), name, admin, category, note
// If no header row, falls back to legacy order: domain,category,note
router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  const text = req.file.buffer.toString('utf8').replace(/^﻿/, ''); // strip BOM
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return res.json({ inserted: 0, skipped: 0, errors: [] });

  const splitCsv = (line) =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));

  // Detect header & map columns
  const headerCells = splitCsv(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = headerCells.includes('domain');
  let idx = { domain: 0, name: -1, admin: -1, category: -1, note: -1 };
  let startIdx = 0;
  if (hasHeader) {
    startIdx = 1;
    idx = {
      domain: headerCells.indexOf('domain'),
      name: headerCells.indexOf('name'),
      admin: headerCells.indexOf('admin'),
      category: headerCells.indexOf('category'),
      note: headerCells.indexOf('note'),
    };
  } else {
    // Legacy positional: domain, category, note
    idx = { domain: 0, name: -1, admin: -1, category: 1, note: 2 };
  }

  const categories = db.prepare('SELECT id, name FROM categories').all();
  const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  const usersRows = db.prepare('SELECT id, name, email FROM users').all();
  const userByName = new Map(usersRows.map((u) => [u.name.toLowerCase(), u.id]));
  const userByEmail = new Map(
    usersRows.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id])
  );

  const insertCat = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  const insertDomain = db.prepare(
    'INSERT OR IGNORE INTO domains (domain, name, admin_user_id, category_id, note) VALUES (?, ?, ?, ?, ?)'
  );

  const pick = (cols, i) => (i >= 0 && i < cols.length ? cols[i] : '');

  let inserted = 0;
  let skipped = 0;
  const errors = [];
  const unmatchedAdmins = new Set();

  const tx = db.transaction(() => {
    for (let i = startIdx; i < lines.length; i++) {
      const cols = splitCsv(lines[i]);
      const domainRaw = pick(cols, idx.domain);
      if (!domainRaw) { skipped++; continue; }
      const host = normalizeHost(domainRaw);
      const siteName = pick(cols, idx.name) || null;
      const adminRaw = pick(cols, idx.admin);
      const categoryName = pick(cols, idx.category);
      const note = pick(cols, idx.note) || null;

      let adminUserId = null;
      if (adminRaw) {
        const k = adminRaw.toLowerCase();
        if (userByName.has(k)) adminUserId = userByName.get(k);
        else if (userByEmail.has(k)) adminUserId = userByEmail.get(k);
        else unmatchedAdmins.add(adminRaw);
      }

      let catId = null;
      if (categoryName) {
        const key = categoryName.toLowerCase();
        if (catMap.has(key)) {
          catId = catMap.get(key);
        } else {
          const info = insertCat.run(categoryName, '#3b82f6');
          catId = info.lastInsertRowid;
          catMap.set(key, catId);
        }
      }
      try {
        const info = insertDomain.run(host, siteName, adminUserId, catId, note);
        if (info.changes === 1) inserted++; else skipped++;
      } catch (err) {
        errors.push({ line: i + 1, error: err.message });
      }
    }
  });
  tx();

  res.json({
    inserted,
    skipped,
    errors,
    unmatched_admins: [...unmatchedAdmins],
  });
});

// Create default alert rules (SSL 30d+7d, Domain 30d+7d) for the domain's admin.
// Idempotent: existing matching rules are left alone.
router.post('/:id/setup-admin-alerts', (req, res) => {
  const row = db.prepare('SELECT id, admin_user_id FROM domains WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Domain not found' });
  if (!row.admin_user_id) return res.status(400).json({ error: 'Domain has no admin assigned' });

  const defaults = [
    { type: 'ssl',    days_before: 30, repeat_daily: 0 },
    { type: 'ssl',    days_before: 7,  repeat_daily: 1 },
    { type: 'domain', days_before: 30, repeat_daily: 0 },
    { type: 'domain', days_before: 7,  repeat_daily: 1 },
  ];

  const findStmt = db.prepare(
    'SELECT id FROM alerts WHERE domain_id = ? AND user_id = ? AND type = ? AND days_before = ?'
  );
  const insertStmt = db.prepare(
    'INSERT INTO alerts (domain_id, user_id, type, days_before, repeat_daily) VALUES (?, ?, ?, ?, ?)'
  );

  let created = 0;
  let skipped = 0;
  const tx = db.transaction(() => {
    for (const d of defaults) {
      const existing = findStmt.get(row.id, row.admin_user_id, d.type, d.days_before);
      if (existing) { skipped++; continue; }
      insertStmt.run(row.id, row.admin_user_id, d.type, d.days_before, d.repeat_daily);
      created++;
    }
  });
  tx();

  res.json({ created, skipped });
});

module.exports = router;
