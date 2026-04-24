const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
if (config.smtp.enabled) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
}

async function sendLine(token, message) {
  if (!token) throw new Error('No LINE token');
  const body = new URLSearchParams({ message }).toString();
  const res = await fetch(config.lineNotifyUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LINE Notify failed (${res.status}): ${text}`);
  }
  return true;
}

async function sendEmail(to, subject, text) {
  if (!transporter) throw new Error('SMTP not configured');
  if (!to) throw new Error('No email recipient');
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
  });
  return true;
}

async function sendAlert({ user, domain, websiteName, type, daysLeft, expiry }) {
  const typeLabel = type === 'ssl' ? 'SSL Certificate' : 'Domain Registration';
  const expiryStr = expiry ? new Date(expiry).toLocaleString() : 'unknown';
  const displayName = websiteName || domain;
  const subject = `[Monitor] ${displayName} — ${typeLabel} expires in ${daysLeft} day(s)`;

  const lines = ['', '[Expiration Alert]'];
  if (websiteName) {
    lines.push(`Website: ${websiteName}`);
    lines.push(`Domain:  ${domain}`);
  } else {
    lines.push(`Domain:  ${domain}`);
  }
  lines.push(`Type:    ${typeLabel}`);
  lines.push(`Days left: ${daysLeft}`);
  lines.push(`Expires: ${expiryStr}`);
  const message = lines.join('\n');

  const results = { line: null, email: null };

  if (user.line_token) {
    try {
      await sendLine(user.line_token, message);
      results.line = 'sent';
    } catch (err) {
      results.line = `error: ${err.message}`;
    }
  }

  if (user.email && config.smtp.enabled) {
    try {
      await sendEmail(user.email, subject, message);
      results.email = 'sent';
    } catch (err) {
      results.email = `error: ${err.message}`;
    }
  }

  return results;
}

module.exports = { sendLine, sendEmail, sendAlert };
