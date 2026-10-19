// ══════════════════════════════════════════════════════════════
// EduSpark Watchdog — alerts (har 3 ghante, .github/workflows/watchdog.yml)
//   site up • sw.js • AI Worker bindings • DNS • TLS certificate expiry • dead-letter broadcasts • atke "sending" • backup freshness
// Fail hone par: workflow laal (GitHub email) + optional Telegram / Discord / Slack webhook.
// Env: SITE_URL, WORKER_URL, ALERT_WEBHOOK_URL (+ALERT_WEBHOOK_STYLE discord|slack|generic, ALERT_WEBHOOK_SECRET),
//      TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, FIREBASE_SERVICE_ACCOUNT (queue check), GITHUB_REPOSITORY + GITHUB_TOKEN (backup check)
// ══════════════════════════════════════════════════════════════
const webhook = require('./lib/webhook.js');

const DAY = 86400e3;
const defaults = {
  siteUrl: 'https://eduspark.de5.net/',
  workerUrl: 'https://bold-dust-6f37.sanjays87726.workers.dev/',
  tlsWarnDays: 14, tlsErrorDays: 3, slowMs: 3000, backupMaxDays: 10, stuckMs: 30 * 60e3
};

// Har check alag try/catch me: ek check crash kare to baaki chalte rahein
async function runChecks(deps, cfgIn = {}) {
  const cfg = { ...defaults, ...cfgIn };
  const out = [];
  const add = (name, ok, detail, severity = 'error') => out.push({ name, ok, detail, severity: ok ? 'ok' : severity });
  const guard = async (name, fn) => { try { await fn(); } catch (e) { add(name, false, 'check crash: ' + String((e && e.message) || e)); } };
  const host = new URL(cfg.siteUrl).hostname;
  const now = (deps.now || Date.now)();

  await guard('site', async () => {
    const t0 = Date.now(); const r = await deps.fetch(cfg.siteUrl); const ms = Date.now() - t0; const body = r.ok ? await r.text() : '';
    if (!r.ok) return add('site', false, `HTTP ${r.status}`);
    if (!body.includes('EduSpark')) return add('site', false, 'page me "EduSpark" nahi mila');
    if (ms > cfg.slowMs) return add('site', false, `slow: ${ms}ms`, 'warn');
    add('site', true, `HTTP 200, ${ms}ms`);
  });
  await guard('service-worker', async () => {
    const r = await deps.fetch(new URL('sw.js', cfg.siteUrl).href); const b = r.ok ? await r.text() : '';
    const m = b.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/);
    if (!r.ok || !m) return add('service-worker', false, r.ok ? 'CACHE_NAME nahi mila' : `HTTP ${r.status}`);
    add('service-worker', true, m[1]);
  });
  await guard('ai-worker', async () => {
    const r = await deps.fetch(cfg.workerUrl); const j = r.ok ? await r.json() : {};
    if (!r.ok) return add('ai-worker', false, `HTTP ${r.status}`);
    if (!j.RATE || !j.GEMINI_KEY) return add('ai-worker', false, `binding missing (RATE=${!!j.RATE}, GEMINI_KEY=${!!j.GEMINI_KEY})`);
    add('ai-worker', true, `v${j.version}, limit ${j.DAILY_LIMIT}/din`);
  });
  await guard('dns', async () => {
    const ips = await deps.resolve4(host);
    if (!ips || !ips.length) return add('dns', false, `${host} resolve nahi hua`);
    add('dns', true, ips.join(', '));
  });
  await guard('tls', async () => {
    const days = await deps.tlsDaysLeft(host);
    if (days == null) return add('tls', false, 'certificate nahi padha ja saka', 'warn');
    if (days < cfg.tlsErrorDays) return add('tls', false, `certificate ${days} din me expire`);
    if (days < cfg.tlsWarnDays) return add('tls', false, `certificate ${days} din me expire`, 'warn');
    add('tls', true, `${days} din bache`);
  });
  if (deps.db) {
    await guard('dead-letter', async () => {
      const snap = await deps.db.collection('notificationQueue').where('status', '==', 'dead').get();
      if (snap.empty) return add('dead-letter', true, '0 dead broadcast');
      add('dead-letter', false, `${snap.size} dead: ` + snap.docs.slice(0, 3).map(d => `"${d.data().title}" (${d.data().lastError || '?'})`).join('; '));
    });
    await guard('stuck-sending', async () => {
      const snap = await deps.db.collection('notificationQueue').where('status', '==', 'sending').get();
      const stuck = snap.docs.filter(d => (d.data().leaseUntil || 0) < now - cfg.stuckMs);
      if (stuck.length) return add('stuck-sending', false, `${stuck.length} broadcast 'sending' me atke`, 'warn');
      add('stuck-sending', true, 'none');
    });
  } else add('queue', true, 'skip (FIREBASE_SERVICE_ACCOUNT nahi)');
  if (deps.github) {
    await guard('backup', async () => {
      const r = await deps.fetch(`https://api.github.com/repos/${deps.github.repo}/actions/workflows/backup.yml/runs?status=success&per_page=1`,
        { headers: { Authorization: `Bearer ${deps.github.token}`, Accept: 'application/vnd.github+json' } });
      if (!r.ok) return add('backup', false, `GitHub API HTTP ${r.status}`, 'warn');
      const run = ((await r.json()).workflow_runs || [])[0];
      if (!run) return add('backup', false, 'koi safal backup run nahi mila', 'warn');
      const age = Math.floor((now - Date.parse(run.created_at)) / DAY);
      if (age > cfg.backupMaxDays) return add('backup', false, `aakhri safal backup ${age} din purana`, 'warn');
      add('backup', true, `${age} din purana`);
    });
  } else add('backup', true, 'skip (GITHUB_TOKEN nahi)');
  return out;
}

function summarize(results) {
  const errors = results.filter(r => r.severity === 'error'), warnings = results.filter(r => r.severity === 'warn');
  const icon = r => (r.severity === 'ok' ? '✅' : r.severity === 'warn' ? '⚠️' : '🚨');
  const text = (errors.length ? `🚨 EduSpark ALERT: ${errors.length} error, ${warnings.length} warning\n` : warnings.length ? `⚠️ EduSpark: ${warnings.length} warning\n` : '✅ EduSpark: sab theek\n')
    + results.map(r => `${icon(r)} ${r.name}: ${r.detail}`).join('\n');
  return { errors, warnings, text };
}

// Sirf problem hone par bhejo. Channel fail ho to bhi script crash nahi karti (alert dene wala khud na gire)
async function notify(summary, { telegram, webhookUrl, webhookStyle = 'generic', webhookSecret, fetchImpl, baseMs = 500 } = {}) {
  const sent = [];
  if (!summary.errors.length && !summary.warnings.length) return sent;
  if (telegram && telegram.token && telegram.chatId) {
    const r = await webhook.send(`https://api.telegram.org/bot${telegram.token}/sendMessage`, { chat_id: telegram.chatId, text: summary.text.slice(0, 4000) }, { fetchImpl, baseMs });
    sent.push({ channel: 'telegram', ok: r.ok });
  }
  if (webhookUrl) {
    const payload = webhookStyle === 'discord' ? { content: summary.text.slice(0, 1900) } : webhookStyle === 'slack' ? { text: summary.text } : { text: summary.text, errors: summary.errors.length, warnings: summary.warnings.length };
    const r = await webhook.send(webhookUrl, payload, { secret: webhookSecret, fetchImpl, baseMs });
    sent.push({ channel: 'webhook', ok: r.ok });
  }
  return sent;
}

function realDeps() {
  const dns = require('dns').promises, tls = require('tls');
  const deps = {
    fetch: (u, o) => fetch(u, { signal: AbortSignal.timeout(15000), ...o }),
    resolve4: h => dns.resolve4(h),
    tlsDaysLeft: host => new Promise(resolve => {
      const s = tls.connect({ host, port: 443, servername: host, timeout: 10000 }, () => {
        const c = s.getPeerCertificate(); s.end();
        resolve(c && c.valid_to ? Math.floor((Date.parse(c.valid_to) - Date.now()) / DAY) : null);
      });
      s.on('error', () => resolve(null)); s.on('timeout', () => { s.destroy(); resolve(null); });
    })
  };
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    deps.db = admin.firestore();
  }
  if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_TOKEN) deps.github = { repo: process.env.GITHUB_REPOSITORY, token: process.env.GITHUB_TOKEN };
  return deps;
}

module.exports = { runChecks, summarize, notify, defaults };

if (require.main === module) {
  (async () => {
    const cfg = {}; if (process.env.SITE_URL) cfg.siteUrl = process.env.SITE_URL; if (process.env.WORKER_URL) cfg.workerUrl = process.env.WORKER_URL;
    const results = await runChecks(realDeps(), cfg);
    const summary = summarize(results);
    console.log(summary.text);
    const sent = await notify(summary, {
      telegram: { token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID },
      webhookUrl: process.env.ALERT_WEBHOOK_URL, webhookStyle: process.env.ALERT_WEBHOOK_STYLE, webhookSecret: process.env.ALERT_WEBHOOK_SECRET
    });
    sent.forEach(s => console.log(`📣 ${s.channel}: ${s.ok ? 'bheja' : 'FAIL'}`));
    process.exit(summary.errors.length ? 1 : 0);          // error par workflow laal => GitHub email
  })().catch(e => { console.error('❌ watchdog crash:', e); process.exit(1); });
}
