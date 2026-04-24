const whois = require('whois-json');
const { normalizeHost } = require('./sslChecker');

// rdap.org is IANA's bootstrap proxy — routes to the right registry over HTTPS (port 443).
// This works even when outbound port 43 (classic WHOIS) is blocked.
const RDAP_PROXY = 'https://rdap.org/domain/';

const EXPIRY_KEYS = [
  'registryExpiryDate',
  'registrarRegistrationExpirationDate',
  'expiresOn',
  'expirationDate',
  'expirationTime',
  'expiryDate',
  'expires',
  'paidTill',
  'paid-till',
  'validUntil',
];

function toRootDomain(host) {
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  const two = parts.slice(-2).join('.');
  const three = parts.slice(-3).join('.');
  const ccTwoPartTlds = new Set([
    'co.uk', 'co.jp', 'co.th', 'or.th', 'ac.th', 'in.th',
    'com.au', 'com.br', 'com.cn', 'com.sg', 'com.tw', 'com.hk',
    'co.in', 'co.nz', 'co.za', 'co.kr',
  ]);
  if (ccTwoPartTlds.has(two)) return three;
  return two;
}

function parseDate(value) {
  if (!value) return null;
  if (Array.isArray(value)) value = value[0];
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function extractExpiryFromWhois(result) {
  if (!result || typeof result !== 'object') return null;
  for (const key of EXPIRY_KEYS) {
    if (result[key]) {
      const iso = parseDate(result[key]);
      if (iso) return iso;
    }
  }
  for (const key of Object.keys(result)) {
    if (/expir|paid.?till|valid.?until/i.test(key)) {
      const iso = parseDate(result[key]);
      if (iso) return iso;
    }
  }
  return null;
}

async function tryRdap(root, timeout) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${RDAP_PROXY}${encodeURIComponent(root)}`, {
      headers: { Accept: 'application/rdap+json, application/json' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`RDAP HTTP ${res.status}`);
    }
    const data = await res.json();
    const events = Array.isArray(data.events) ? data.events : [];
    const expEvent =
      events.find((e) => e.eventAction === 'expiration') ||
      events.find((e) => e.eventAction === 'registrar expiration');
    const expiry = expEvent ? parseDate(expEvent.eventDate) : null;

    let registrar = null;
    const entities = Array.isArray(data.entities) ? data.entities : [];
    const reg = entities.find(
      (e) => Array.isArray(e.roles) && e.roles.includes('registrar')
    );
    if (reg && Array.isArray(reg.vcardArray) && reg.vcardArray.length > 1) {
      const props = reg.vcardArray[1];
      const fn = Array.isArray(props) ? props.find((x) => x[0] === 'fn') : null;
      if (fn) registrar = fn[3];
    }

    return { expiry, registrar, source: 'rdap' };
  } finally {
    clearTimeout(t);
  }
}

async function tryWhois(root, timeout) {
  const whoisPromise = whois(root, { follow: 2, timeout });
  const timeoutPromise = new Promise((_, rej) =>
    setTimeout(() => rej(new Error(`WHOIS timeout after ${timeout}ms`)), timeout + 2000)
  );
  const result = await Promise.race([whoisPromise, timeoutPromise]);
  return {
    expiry: extractExpiryFromWhois(result),
    registrar: result.registrar || result.sponsoringRegistrar || null,
    source: 'whois',
    raw: result,
  };
}

async function checkDomain(domain, { timeout = 15000 } = {}) {
  const host = normalizeHost(domain);
  const root = toRootDomain(host);

  let rdapErr = null;
  let whoisErr = null;

  // 1. RDAP over HTTPS — works for most gTLDs and many ccTLDs, firewall-friendly.
  try {
    const r = await tryRdap(root, timeout);
    if (r.expiry) return { host, root, ...r };
    rdapErr = new Error('RDAP returned no expiration field');
  } catch (err) {
    rdapErr = err;
  }

  // 2. Fall back to classic WHOIS (port 43). Needed for some ccTLDs (e.g. .th).
  try {
    const r = await tryWhois(root, timeout);
    if (r.expiry) return { host, root, ...r };
    whoisErr = new Error('WHOIS returned no expiration field');
  } catch (err) {
    whoisErr = err;
  }

  const msg =
    `Could not determine domain expiration for ${root}. ` +
    `RDAP: ${rdapErr ? rdapErr.message : 'n/a'}. ` +
    `WHOIS: ${whoisErr ? whoisErr.message : 'n/a'}.`;
  throw new Error(msg);
}

module.exports = { checkDomain, toRootDomain, extractExpiryFromWhois, tryRdap, tryWhois };
