const tls = require('tls');

function normalizeHost(input) {
  if (!input) return '';
  let host = String(input).trim().toLowerCase();
  host = host.replace(/^https?:\/\//, '');
  host = host.replace(/\/.*$/, '');
  host = host.replace(/:\d+$/, '');
  return host;
}

function checkSSL(domain, { timeout = 10000, port = 443 } = {}) {
  return new Promise((resolve, reject) => {
    const host = normalizeHost(domain);
    if (!host) {
      reject(new Error('Invalid host'));
      return;
    }

    const options = {
      host,
      port,
      servername: host,
      rejectUnauthorized: false,
    };

    let settled = false;
    const finish = (fn, val) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch (_) {}
      fn(val);
    };

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate();
      if (!cert || Object.keys(cert).length === 0) {
        finish(reject, new Error('No certificate returned'));
        return;
      }

      finish(resolve, {
        host,
        subject: cert.subject && cert.subject.CN ? cert.subject.CN : null,
        issuer: cert.issuer && cert.issuer.O ? cert.issuer.O : null,
        valid_from: cert.valid_from ? new Date(cert.valid_from).toISOString() : null,
        valid_to: cert.valid_to ? new Date(cert.valid_to).toISOString() : null,
      });
    });

    socket.setTimeout(timeout, () => {
      finish(reject, new Error(`SSL check timeout after ${timeout}ms`));
    });

    socket.on('error', (err) => {
      finish(reject, err);
    });
  });
}

module.exports = { checkSSL, normalizeHost };
