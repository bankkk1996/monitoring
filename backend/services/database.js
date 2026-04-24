const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const dir = path.dirname(config.dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#3b82f6'
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      name TEXT,
      admin_user_id INTEGER,
      category_id INTEGER,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      line_token TEXT,
      email TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ssl','domain')),
      days_before INTEGER NOT NULL,
      repeat_daily INTEGER NOT NULL DEFAULT 0,
      last_sent TEXT,
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_cache (
      domain_id INTEGER PRIMARY KEY,
      ssl_expiry TEXT,
      domain_expiry TEXT,
      ssl_error TEXT,
      domain_error TEXT,
      last_checked TEXT,
      FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_domain ON alerts(domain_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_domains_category ON domains(category_id);
  `);

  // In-place migrations for existing databases (SQLite has no "ADD COLUMN IF NOT EXISTS")
  const domainCols = db.prepare('PRAGMA table_info(domains)').all().map((c) => c.name);
  if (!domainCols.includes('name')) {
    db.exec('ALTER TABLE domains ADD COLUMN name TEXT');
  }
  if (!domainCols.includes('admin_user_id')) {
    // NB: FKs added via ALTER COLUMN are structural only — the constraint isn't enforced retroactively,
    // but new inserts/updates still honor it via PRAGMA foreign_keys=ON.
    db.exec('ALTER TABLE domains ADD COLUMN admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
  }
  // Drop the legacy free-text admin column if it lingers from a previous version.
  if (domainCols.includes('admin')) {
    try {
      db.exec('ALTER TABLE domains DROP COLUMN admin');
    } catch (err) {
      console.warn('[migrate] could not drop legacy admin column:', err.message);
    }
  }

  // Seed default category if empty
  const row = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (row.c === 0) {
    db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(
      'Default',
      '#3b82f6'
    );
  }
}

migrate();

module.exports = db;
