const assert = require('assert');
require('./helpers/fake-admin');
const { makeDb } = require('./helpers/fakedb');
const WD = require('../scripts/watchdog.js');
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };
const NOW = Date.parse('2026-10-18T00:00:00Z'), DAY = 86400e3;
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body) });
function deps(over = {}) {
  const routes = { 'https://eduspark.de5.net/': res(200, '<title>EduSpark</title>'), 'https://eduspark.de5.net/sw.js': res(200, 'const CACHE_NAME = "eduspark-v19";'),
    'https://bold-dust-6f37.sanjays87726.workers.dev/': res(200, JSON.stringify({ version: 8, RATE: true, GEMINI_KEY: true, DAILY_LIMIT: 5 })), ...(over.routes || {}) };
  return { now: () => NOW, fetch: async (u) => { const r = routes[u]; if (r instanceof Error) throw r; if (!r) throw new Error('unexpected ' + u); return r; },
    resolve4: async () => ['185.199.108.153'], tlsDaysLeft: async () => 60, ...over };
}
const by = (r, name) => r.find(x => x.name === name);
const run = d => WD.runChecks(d);

(async () => {
  await t('all healthy -> no errors/warnings, text says sab theek', async () => {
    const r = await run(deps()); const s = WD.summarize(r);
    assert.strictEqual(s.errors.length, 0); assert.strictEqual(s.warnings.length, 0); assert.ok(s.text.startsWith('✅')); assert.ok(by(r, 'ai-worker').detail.includes('v8'));
  });
  await t('site: 500 / missing brand / network error each => error', async () => {
    let r = await run(deps({ routes: { 'https://eduspark.de5.net/': res(500, '') } })); assert.strictEqual(by(r, 'site').severity, 'error');
    r = await run(deps({ routes: { 'https://eduspark.de5.net/': res(200, 'GitHub Pages 404') } })); assert.ok(/EduSpark" nahi/.test(by(r, 'site').detail));
    r = await run(deps({ routes: { 'https://eduspark.de5.net/': new Error('ECONNRESET') } })); assert.ok(/check crash: ECONNRESET/.test(by(r, 'site').detail)); assert.strictEqual(by(r, 'dns').severity, 'ok');   // baaki checks chale
  });
  await t('service worker without CACHE_NAME / 404 => error', async () => {
    let r = await run(deps({ routes: { 'https://eduspark.de5.net/sw.js': res(404, 'nf') } })); assert.strictEqual(by(r, 'service-worker').severity, 'error');
    r = await run(deps({ routes: { 'https://eduspark.de5.net/sw.js': res(200, 'garbage') } })); assert.strictEqual(by(r, 'service-worker').severity, 'error');
  });
  await t('ai-worker: binding missing / HTTP error => error', async () => {
    let r = await run(deps({ routes: { 'https://bold-dust-6f37.sanjays87726.workers.dev/': res(200, JSON.stringify({ version: 8, RATE: true, GEMINI_KEY: false })) } }));
    assert.ok(/GEMINI_KEY=false/.test(by(r, 'ai-worker').detail)); assert.strictEqual(by(r, 'ai-worker').severity, 'error');
    r = await run(deps({ routes: { 'https://bold-dust-6f37.sanjays87726.workers.dev/': res(522, '') } })); assert.strictEqual(by(r, 'ai-worker').severity, 'error');
  });
  await t('dns: empty / throws => error', async () => {
    let r = await run(deps({ resolve4: async () => [] })); assert.strictEqual(by(r, 'dns').severity, 'error');
    r = await run(deps({ resolve4: async () => { throw new Error('ENOTFOUND'); } })); assert.ok(/ENOTFOUND/.test(by(r, 'dns').detail));
  });
  await t('tls: 60d ok, 10d warn, 2d error, unreadable warn', async () => {
    for (const [d, sev] of [[60, 'ok'], [14, 'ok'], [13, 'warn'], [3, 'warn'], [2, 'error'], [-1, 'error'], [null, 'warn']]) assert.strictEqual(by(await run(deps({ tlsDaysLeft: async () => d })), 'tls').severity, sev, 'days=' + d);
  });
  await t('queue: dead-letter => error with titles; stuck sending => warn; clean => ok', async () => {
    let db = makeDb({ notificationQueue: { a: { title: 'Dead one', status: 'dead', lastError: 'boom' }, b: { title: 'Fine', status: 'sent' }, c: { title: 'Stuck', status: 'sending', leaseUntil: NOW - 3600e3 }, d: { title: 'Active', status: 'sending', leaseUntil: NOW + 60e3 } } });
    let r = await run(deps({ db })); assert.strictEqual(by(r, 'dead-letter').severity, 'error'); assert.ok(/"Dead one" \(boom\)/.test(by(r, 'dead-letter').detail));
    assert.strictEqual(by(r, 'stuck-sending').severity, 'warn'); assert.ok(/1 broadcast/.test(by(r, 'stuck-sending').detail));
    db = makeDb({ notificationQueue: { b: { title: 'Fine', status: 'sent' } } }); r = await run(deps({ db }));
    assert.strictEqual(by(r, 'dead-letter').severity, 'ok'); assert.strictEqual(by(r, 'stuck-sending').severity, 'ok');
    assert.strictEqual(by(await run(deps()), 'queue').severity, 'ok');                                      // db nahi => skip
  });
  await t('backup freshness: fresh ok / 12 days warn / none warn / API error warn / no token skip', async () => {
    const api = 'https://api.github.com/repos/o/r/actions/workflows/backup.yml/runs?status=success&per_page=1';
    const gh = { repo: 'o/r', token: 'tok' };
    const runAt = d => res(200, JSON.stringify({ workflow_runs: [{ created_at: new Date(NOW - d * DAY).toISOString() }] }));
    assert.strictEqual(by(await run(deps({ github: gh, routes: { [api]: runAt(3) } })), 'backup').severity, 'ok');
    let r = await run(deps({ github: gh, routes: { [api]: runAt(12) } })); assert.strictEqual(by(r, 'backup').severity, 'warn'); assert.ok(/12 din/.test(by(r, 'backup').detail));
    assert.strictEqual(by(await run(deps({ github: gh, routes: { [api]: res(200, '{"workflow_runs":[]}') } })), 'backup').severity, 'warn');
    assert.strictEqual(by(await run(deps({ github: gh, routes: { [api]: res(403, '{}') } })), 'backup').severity, 'warn');
    assert.strictEqual(by(await run(deps()), 'backup').severity, 'ok');
    let hdr; const d = deps({ github: gh, routes: { [api]: runAt(1) } }); const f0 = d.fetch; d.fetch = async (u, o) => { if (u === api) hdr = o.headers; return f0(u, o); }; await run(d); assert.strictEqual(hdr.Authorization, 'Bearer tok');
  });
  await t('notify: silent when healthy; telegram + discord/slack/generic payloads; failing channel does not throw', async () => {
    const calls = []; const f = async (url, o) => { calls.push({ url, body: JSON.parse(o.body), h: o.headers }); return { status: 200 }; };
    const good = WD.summarize(await run(deps())); assert.deepStrictEqual(await WD.notify(good, { telegram: { token: 'T', chatId: '1' }, webhookUrl: 'https://h', fetchImpl: f }), []); assert.strictEqual(calls.length, 0);
    const bad = WD.summarize(await run(deps({ resolve4: async () => [] })));
    let sent = await WD.notify(bad, { telegram: { token: 'T', chatId: '42' }, webhookUrl: 'https://h', webhookStyle: 'discord', fetchImpl: f });
    assert.deepStrictEqual(sent, [{ channel: 'telegram', ok: true }, { channel: 'webhook', ok: true }]);
    assert.strictEqual(calls[0].url, 'https://api.telegram.org/botT/sendMessage'); assert.strictEqual(calls[0].body.chat_id, '42'); assert.ok(calls[0].body.text.includes('🚨'));
    assert.ok(calls[1].body.content.includes('dns') && !('text' in calls[1].body));
    calls.length = 0; await WD.notify(bad, { webhookUrl: 'https://h', webhookStyle: 'slack', fetchImpl: f }); assert.ok(calls[0].body.text && !('content' in calls[0].body));
    calls.length = 0; await WD.notify(bad, { webhookUrl: 'https://h', webhookSecret: 's', fetchImpl: f }); assert.strictEqual(calls[0].body.errors, 1); assert.ok(calls[0].h['X-EduSpark-Signature']);
    const down = async () => { throw new Error('net'); }; sent = await WD.notify(bad, { webhookUrl: 'https://h', fetchImpl: down, baseMs: 1 }); assert.deepStrictEqual(sent, [{ channel: 'webhook', ok: false }]);
    const warnOnly = WD.summarize(await run(deps({ tlsDaysLeft: async () => 10 }))); calls.length = 0; await WD.notify(warnOnly, { webhookUrl: 'https://h', fetchImpl: f }); assert.strictEqual(calls.length, 1);   // warning par bhi bhejo
  });
  console.log(`\n${n} watchdog tests passed`);
})();
