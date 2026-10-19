// ══════════════════════════════════════════════════════════════
// Webhooks: signed outbound (retry + backoff) aur inbound verification (HMAC, replay protection, dedupe)
//   Signature = HMAC-SHA256( secret, timestamp + "." + body )  — headers X-EduSpark-Timestamp / X-EduSpark-Signature
// ══════════════════════════════════════════════════════════════
const crypto = require('crypto');

function sign(secret, body, ts) {
  return crypto.createHmac('sha256', String(secret)).update(String(ts) + '.' + String(body)).digest('hex');
}

// Receiver side: sahi signature + taaza timestamp (replay attack se bachav) + constant-time compare
function verify(secret, body, ts, sig, { toleranceSec = 300, now = Date.now() } = {}) {
  if (!secret || !sig || !ts) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const a = Buffer.from(sign(secret, body, ts), 'hex');
  const b = Buffer.from(String(sig), 'hex');                  // galat hex => chhota buffer => length mismatch => false
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Receiver side idempotency: ek event ID dobara aaye (sender retry) to ek hi baar process ho
function createDeduper(ttlMs = 24 * 3600e3, now = () => Date.now()) {
  const seen = new Map();
  return {
    firstTime(id) {
      const t = now();
      for (const [k, v] of seen) if (t - v > ttlMs) seen.delete(k);
      if (seen.has(id)) return false;
      seen.set(id, t);
      return true;
    }
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Sender side: network error / 429 / 5xx par exponential backoff + jitter; 4xx (429 ko chhod kar) par turant ruk jao
async function send(url, payload, { secret, retries = 3, baseMs = 500, fetchImpl = globalThis.fetch, timeoutMs = 8000, headers = {}, now = Date.now, bodyOverride } = {}) {
  const body = bodyOverride != null ? bodyOverride : JSON.stringify(payload);
  let attempts = 0, lastStatus = 0, lastError = '';
  for (let i = 0; i <= retries; i++) {
    attempts++;
    const h = { 'Content-Type': 'application/json', ...headers };
    if (secret) { const ts = String(Math.floor(now() / 1000)); h['X-EduSpark-Timestamp'] = ts; h['X-EduSpark-Signature'] = sign(secret, body, ts); }
    try {
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
      let res; try { res = await fetchImpl(url, { method: 'POST', headers: h, body, signal: ctl.signal }); } finally { clearTimeout(timer); }
      lastStatus = res.status; lastError = '';
      if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status, attempts };
      if (res.status !== 429 && res.status < 500) return { ok: false, status: res.status, attempts };          // 4xx: retry bekaar
    } catch (e) { lastError = String((e && e.message) || e); }
    if (i < retries) { const exp = baseMs * Math.pow(2, i); await sleep(exp / 2 + Math.random() * exp / 2); }
  }
  return { ok: false, status: lastStatus, attempts, error: lastError };
}

module.exports = { sign, verify, createDeduper, send };
