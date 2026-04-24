require('dotenv').config();
const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  env: process.env.NODE_ENV || 'development',
  dbPath: path.resolve(
    __dirname,
    '..',
    process.env.DB_PATH || './data/monitor.db'
  ),
  monitorCron: process.env.MONITOR_CRON || '0 */12 * * *',
  runOnStartup: String(process.env.RUN_ON_STARTUP || 'true') === 'true',
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Monitor <no-reply@example.com>',
  },
  lineNotifyUrl:
    process.env.LINE_NOTIFY_URL || 'https://notify-api.line.me/api/notify',
};

config.smtp.enabled = Boolean(
  config.smtp.host && config.smtp.user && config.smtp.pass
);

module.exports = config;
