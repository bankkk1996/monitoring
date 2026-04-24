const cron = require('node-cron');
const db = require('../services/database');
const { checkSSL } = require('../services/sslChecker');
const { checkDomain } = require('../services/domainChecker');
const { sendAlert } = require('../services/notifier');
const config = require('../config');

function daysUntil(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / (24 * 60 * 60 * 1000));
}

function upsertStatus(domainId, patch) {
  const existing = db
    .prepare('SELECT domain_id FROM status_cache WHERE domain_id = ?')
    .get(domainId);
  const ts = new Date().toISOString();
  if (existing) {
    const keys = Object.keys(patch);
    const setSql = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(
      `UPDATE status_cache SET ${setSql}, last_checked = ? WHERE domain_id = ?`
    ).run(...keys.map((k) => patch[k]), ts, domainId);
  } else {
    const cols = ['domain_id', ...Object.keys(patch), 'last_checked'];
    const placeholders = cols.map(() => '?').join(', ');
    db.prepare(
      `INSERT INTO status_cache (${cols.join(', ')}) VALUES (${placeholders})`
    ).run(domainId, ...Object.keys(patch).map((k) => patch[k]), ts);
  }
}

async function checkOne(domain) {
  const patch = {
    ssl_expiry: null,
    domain_expiry: null,
    ssl_error: null,
    domain_error: null,
  };

  try {
    const ssl = await checkSSL(domain.domain);
    patch.ssl_expiry = ssl.valid_to;
  } catch (err) {
    patch.ssl_error = err.message;
  }

  try {
    const dom = await checkDomain(domain.domain);
    patch.domain_expiry = dom.expiry;
  } catch (err) {
    patch.domain_error = err.message;
  }

  upsertStatus(domain.id, patch);
  return patch;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db_ = new Date(b);
  return (
    da.getUTCFullYear() === db_.getUTCFullYear() &&
    da.getUTCMonth() === db_.getUTCMonth() &&
    da.getUTCDate() === db_.getUTCDate()
  );
}

async function processAlerts() {
  const rows = db
    .prepare(
      `SELECT a.*, d.domain AS domain_name, d.name AS website_name,
              u.id AS u_id, u.name AS u_name, u.line_token AS u_line, u.email AS u_email, u.active AS u_active,
              s.ssl_expiry, s.domain_expiry
       FROM alerts a
       JOIN domains d ON d.id = a.domain_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN status_cache s ON s.domain_id = a.domain_id`
    )
    .all();

  const now = new Date().toISOString();
  const updateLastSent = db.prepare('UPDATE alerts SET last_sent = ? WHERE id = ?');

  for (const a of rows) {
    if (!a.u_active) continue;
    const expiry = a.type === 'ssl' ? a.ssl_expiry : a.domain_expiry;
    const days = daysUntil(expiry);
    if (days === null) continue;
    if (days > a.days_before) continue;
    if (days < 0) continue; // already expired — don't spam after the fact

    // De-dupe: if last_sent exists and repeat_daily is off, skip. If on, ensure not already today.
    if (a.last_sent) {
      if (!a.repeat_daily) continue;
      if (isSameDay(a.last_sent, now)) continue;
    }

    try {
      await sendAlert({
        user: { line_token: a.u_line, email: a.u_email, name: a.u_name },
        domain: a.domain_name,
        websiteName: a.website_name,
        type: a.type,
        daysLeft: days,
        expiry,
      });
      updateLastSent.run(now, a.id);
    } catch (err) {
      console.error(`[alerts] failed for alert ${a.id}:`, err.message);
    }
  }
}

let running = false;

async function runOnce(domainId = null) {
  if (running) return { status: 'already_running' };
  running = true;
  const started = Date.now();
  try {
    const domains = domainId
      ? db.prepare('SELECT * FROM domains WHERE id = ?').all(domainId)
      : db.prepare('SELECT * FROM domains').all();
    const results = [];
    for (const d of domains) {
      const r = await checkOne(d);
      results.push({ id: d.id, domain: d.domain, ...r });
    }
    await processAlerts();
    return {
      status: 'ok',
      checked: results.length,
      duration_ms: Date.now() - started,
      results,
    };
  } finally {
    running = false;
  }
}

function start() {
  if (!cron.validate(config.monitorCron)) {
    console.error(`[cron] invalid schedule "${config.monitorCron}"`);
    return;
  }
  cron.schedule(config.monitorCron, () => {
    console.log(`[cron] running monitor job at ${new Date().toISOString()}`);
    runOnce().catch((err) => console.error('[cron] error:', err));
  });
  console.log(`[cron] scheduled with "${config.monitorCron}"`);

  if (config.runOnStartup) {
    setTimeout(() => {
      console.log('[cron] startup check...');
      runOnce().catch((err) => console.error('[cron] startup error:', err));
    }, 2000);
  }
}

module.exports = { start, runOnce, checkOne, processAlerts };
