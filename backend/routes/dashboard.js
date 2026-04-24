const express = require('express');
const db = require('../services/database');

const router = express.Router();

function daysUntil(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  return Math.ceil((then - Date.now()) / (24 * 60 * 60 * 1000));
}

function statusOf(days) {
  if (days === null || days === undefined) return 'unknown';
  if (days < 7) return 'critical';
  if (days < 30) return 'warning';
  return 'ok';
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT d.id, d.domain, d.name, d.admin_user_id, d.note, d.created_at,
              c.name AS category_name, c.color AS category_color,
              u.name AS admin_name, u.email AS admin_email,
              CASE WHEN u.line_token IS NOT NULL AND u.line_token <> '' THEN 1 ELSE 0 END AS admin_has_line,
              s.ssl_expiry, s.domain_expiry, s.ssl_error, s.domain_error, s.last_checked
       FROM domains d
       LEFT JOIN categories c ON c.id = d.category_id
       LEFT JOIN users u ON u.id = d.admin_user_id
       LEFT JOIN status_cache s ON s.domain_id = d.id
       ORDER BY d.domain ASC`
    )
    .all();

  const list = rows.map((r) => {
    const sslDays = daysUntil(r.ssl_expiry);
    const domainDays = daysUntil(r.domain_expiry);
    const sslStatus = statusOf(sslDays);
    const domainStatus = statusOf(domainDays);
    const worst = [sslStatus, domainStatus].includes('critical')
      ? 'critical'
      : [sslStatus, domainStatus].includes('warning')
      ? 'warning'
      : [sslStatus, domainStatus].includes('unknown')
      ? 'unknown'
      : 'ok';
    return {
      ...r,
      ssl_days_left: sslDays,
      domain_days_left: domainDays,
      ssl_status: sslStatus,
      domain_status: domainStatus,
      status: worst,
    };
  });

  const summary = {
    total: list.length,
    ok: list.filter((x) => x.status === 'ok').length,
    warning: list.filter((x) => x.status === 'warning').length,
    critical: list.filter((x) => x.status === 'critical').length,
    unknown: list.filter((x) => x.status === 'unknown').length,
    expiring_30: list.filter((x) => {
      const min = Math.min(
        x.ssl_days_left === null ? Infinity : x.ssl_days_left,
        x.domain_days_left === null ? Infinity : x.domain_days_left
      );
      return min !== Infinity && min < 30;
    }).length,
    critical_7: list.filter((x) => {
      const min = Math.min(
        x.ssl_days_left === null ? Infinity : x.ssl_days_left,
        x.domain_days_left === null ? Infinity : x.domain_days_left
      );
      return min !== Infinity && min < 7;
    }).length,
  };

  const expiring = list
    .filter((x) => x.status === 'critical' || x.status === 'warning')
    .sort((a, b) => {
      const aMin = Math.min(
        a.ssl_days_left === null ? Infinity : a.ssl_days_left,
        a.domain_days_left === null ? Infinity : a.domain_days_left
      );
      const bMin = Math.min(
        b.ssl_days_left === null ? Infinity : b.ssl_days_left,
        b.domain_days_left === null ? Infinity : b.domain_days_left
      );
      return aMin - bMin;
    });

  res.json({ summary, domains: list, expiring });
});

module.exports = router;
