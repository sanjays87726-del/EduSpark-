const assert = require('assert');
const ES = require('./helpers/load-es.js'), I = ES._internals;
let pass = 0;
async function t(name, fn) {
  // har test se pehle state reset
  I.aiBreaker.state = 'closed'; I.aiBreaker.fails = 0; I.aiBreaker.probing = false; I.aiBreaker.cooldownMs = 30000;
  I.aiBucket.tokens = I.aiBucket.cap; I.aiBucket.t = Date.now();
  try { await fn(); pass++; console.log('✓', name); }
  catch (e) { console.log('✗', name, '\n  ', e && e.stack || e); process.exitCode = 1; }
}
const resp = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const FAST = { baseMs: 5 };
const rejects = async (p, code) => { try { await p; } catch (e) { assert.strictEqual(e.code, code, 'got code ' + e.code + ' / ' + e.message); return e; } assert.fail('should have rejected with ' + code); };

(async () => {
  await t('percentile nearest-rank', () => {
    const a = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.strictEqual(ES.pct(a, 50), 50); assert.strictEqual(ES.pct(a, 95), 95); assert.strictEqual(ES.pct(a, 99), 99);
    assert.strictEqual(ES.pct([7], 99), 7); assert.strictEqual(ES.pct([], 95), null);
  });

  await t('success returns data and records metric', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(200, { answer: 'ok' }); };
    const d = await ES.aiRequest('u', { q: 1 }, FAST);
    assert.strictEqual(d.answer, 'ok'); assert.strictEqual(calls, 1);
    const r = ES.report().ai; assert.ok(r.total >= 1 && r.ok >= 1);
  });

  await t('network error once then 200 -> retried and succeeds', async () => {
    let calls = 0; globalThis.fetch = async () => { if (++calls === 1) throw new TypeError('Failed to fetch'); return resp(200, { answer: 'x' }); };
    const d = await ES.aiRequest('u', {}, FAST);
    assert.strictEqual(d.answer, 'x'); assert.strictEqual(calls, 2); assert.strictEqual(I.aiBreaker.fails, 0);
  });

  await t('502 (Gemini fail) NOT retried, worker message kept, counts as breaker failure', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(502, { error: 'AI अभी busy है' }); };
    const e = await rejects(ES.aiRequest('u', {}, FAST), 'http_502');
    assert.strictEqual(e.message, 'AI अभी busy है'); assert.strictEqual(calls, 1); assert.strictEqual(I.aiBreaker.fails, 1);
  });

  await t('503 (worker KV quota) NOT retried, message kept, breaker untouched', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(503, { error: 'आज का AI quota पूरा हो गया' }); };
    const e = await rejects(ES.aiRequest('u', {}, FAST), 'http_503');
    assert.strictEqual(e.message, 'आज का AI quota पूरा हो गया'); assert.strictEqual(calls, 1);
    assert.strictEqual(I.aiBreaker.fails, 0); assert.strictEqual(I.aiBreaker.state, 'closed');
  });

  await t('network error retried 2x then fails once on breaker', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; throw new TypeError('Failed to fetch'); };
    await rejects(ES.aiRequest('u', {}, FAST), 'network');
    assert.strictEqual(calls, 3); assert.strictEqual(I.aiBreaker.fails, 1);
  });

  await t('429 passes through, does NOT trip breaker, not retried', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(429, { error: 'daily limit' }); };
    const e = await rejects(ES.aiRequest('u', {}, FAST), 'http_429');
    assert.strictEqual(e.message, 'daily limit'); assert.strictEqual(calls, 1);
    assert.strictEqual(I.aiBreaker.fails, 0); assert.strictEqual(I.aiBreaker.state, 'closed');
  });

  await t('500 counts one failure, not retried', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(500, { error: 'boom' }); };
    const e = await rejects(ES.aiRequest('u', {}, FAST), 'http_500');
    assert.strictEqual(e.message, 'boom'); assert.strictEqual(calls, 1); assert.strictEqual(I.aiBreaker.fails, 1);
  });

  await t('3 failures open breaker; 4th call fails fast without fetch', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(500, {}); };
    for (let i = 0; i < 3; i++) await rejects(ES.aiRequest('u', {}, FAST), 'http_500');
    assert.strictEqual(I.aiBreaker.state, 'open');
    const before = calls; await rejects(ES.aiRequest('u', {}, FAST), 'circuit_open'); assert.strictEqual(calls, before);
  });

  await t('half-open: one probe only, success closes', async () => {
    globalThis.fetch = async () => resp(500, {});
    for (let i = 0; i < 3; i++) await rejects(ES.aiRequest('u', {}, FAST), 'http_500');
    I.aiBreaker.cooldownMs = 20; await new Promise(r => setTimeout(r, 40));
    let release; const gate = new Promise(r => release = r);
    globalThis.fetch = async () => { await gate; return resp(200, { answer: 'back' }); };
    const probe = ES.aiRequest('u', {}, FAST);
    await new Promise(r => setTimeout(r, 5));
    await rejects(ES.aiRequest('u', {}, FAST), 'circuit_open');   // 2nd concurrent request blocked
    release(); const d = await probe;
    assert.strictEqual(d.answer, 'back'); assert.strictEqual(I.aiBreaker.state, 'closed');
  });

  await t('half-open probe failing re-opens breaker', async () => {
    globalThis.fetch = async () => resp(500, {});
    for (let i = 0; i < 3; i++) await rejects(ES.aiRequest('u', {}, FAST), 'http_500');
    I.aiBreaker.cooldownMs = 20; await new Promise(r => setTimeout(r, 40));
    await rejects(ES.aiRequest('u', {}, FAST), 'http_500');
    assert.strictEqual(I.aiBreaker.state, 'open');
  });

  await t('4xx during half-open probe closes breaker (server is alive)', async () => {
    globalThis.fetch = async () => resp(500, {});
    for (let i = 0; i < 3; i++) await rejects(ES.aiRequest('u', {}, FAST), 'http_500');
    I.aiBreaker.cooldownMs = 20; await new Promise(r => setTimeout(r, 40));
    globalThis.fetch = async () => resp(429, { error: 'limit' });
    await rejects(ES.aiRequest('u', {}, FAST), 'http_429');
    assert.strictEqual(I.aiBreaker.state, 'closed'); assert.strictEqual(I.aiBreaker.probing, false);
  });

  await t('timeout aborts (incl. body read) and is a breaker failure, no retry', async () => {
    let calls = 0;
    globalThis.fetch = (u, o) => { calls++; return new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))); };
    await rejects(ES.aiRequest('u', {}, { timeoutMs: 30, baseMs: 5 }), 'timeout');
    assert.strictEqual(calls, 1); assert.strictEqual(I.aiBreaker.fails, 1);
  });

  await t('abort during body read -> timeout (not silent empty data)', async () => {
    globalThis.fetch = (u, o) => Promise.resolve({ status: 200, ok: true, json: () => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
    await rejects(ES.aiRequest('u', {}, { timeoutMs: 30, baseMs: 5 }), 'timeout');
  });

  await t('rate limit: 5 burst allowed, 6th rejected without fetch and without breaker side-effect', async () => {
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(200, { answer: 'a' }); };
    for (let i = 0; i < 5; i++) await ES.aiRequest('u', {}, FAST);
    const e = await rejects(ES.aiRequest('u', {}, FAST), 'rate_limited');
    assert.strictEqual(calls, 5); assert.ok(/सेकंड/.test(e.message)); assert.strictEqual(I.aiBreaker.state, 'closed');
  });

  await t('rate limit rejection in half-open releases the probe', async () => {
    I.aiBreaker.state = 'half'; I.aiBreaker.probing = false; I.aiBucket.tokens = 0; I.aiBucket.t = Date.now();
    await rejects(ES.aiRequest('u', {}, FAST), 'rate_limited');
    assert.strictEqual(I.aiBreaker.probing, false);
  });

  await t('feature flag off -> ai_disabled; only explicit false disables', async () => {
    let cb; ES.startFlags({ collection: () => ({ doc: () => ({ onSnapshot: f => { cb = f; } }) }) });
    cb({ exists: true, data: () => ({ ai: false, updated: 'x' }) });
    assert.strictEqual(ES.flag('ai'), false); assert.strictEqual(ES.flag('doubts'), true); assert.strictEqual(ES.flag('unknown'), true);
    await rejects(ES.aiRequest('u', {}, FAST), 'ai_disabled');
    cb({ exists: false, data: () => undefined }); assert.strictEqual(ES.flag('ai'), true);
  });

  await t('idempotency: in-flight dup, post-success dup, retry after failure', async () => {
    let n = 0, release; const gate = new Promise(r => release = r);
    const p = ES.once('k1', async () => { n++; await gate; return 'done'; });
    await rejects(ES.once('k1', async () => { n++; }), 'duplicate');
    release(); assert.strictEqual(await p, 'done');
    await rejects(ES.once('k1', async () => { n++; }), 'duplicate'); assert.strictEqual(n, 1);
    await ES.once('k2', async () => { throw new Error('x'); }).catch(() => {});
    assert.strictEqual(await ES.once('k2', async () => 'again'), 'again');           // failure ke baad dobara allowed
    assert.strictEqual(await ES.once('k3', async () => 'v', 10), 'v'); await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(await ES.once('k3', async () => 'v2', 10), 'v2');             // ttl khatam hone ke baad allowed
  });

  await t('idempotency: sync throw is captured as rejection and key reusable', async () => {
    await ES.once('k4', () => { throw ES.coded('rate_limited', 'wait'); }).catch(e => assert.strictEqual(e.code, 'rate_limited'));
    assert.strictEqual(await ES.once('k4', async () => 'ok'), 'ok');
  });

  await t('hash is stable and differs', () => {
    assert.strictEqual(ES.hash('a|b'), ES.hash('a|b')); assert.notStrictEqual(ES.hash('a|b'), ES.hash('a|c'));
  });

  await t('timed(): records ok/fail + latency; SLO/error budget math', async () => {
    for (let i = 0; i < 199; i++) await ES.timed('unit', async () => 1);
    await ES.timed('unit', async () => { throw new Error('x'); }).catch(() => {});
    I.SLO.unit = 0.99;
    const r = ES.report().unit;
    assert.strictEqual(r.total, 200); assert.strictEqual(r.fail, 1);
    assert.ok(Math.abs(r.sli - 0.995) < 1e-9); assert.strictEqual(r.sloMet, true);
    assert.ok(Math.abs(r.errorBudgetLeft - 0.5) < 1e-9);            // allowed = 2 failures, used 1
    assert.ok(r.p99 !== null && r.p95 !== null && r.throughputPerMin > 0);
  });

  await t('errMsg mapping + health/debug shape', () => {
    assert.ok(/पहुँच नहीं पाया/.test(ES.errMsg(ES.coded('network', 'x'))));
    assert.ok(/पहुँच नहीं पाया/.test(ES.errMsg(new TypeError('Failed to fetch'))));
    assert.ok(/ज़्यादा समय/.test(ES.errMsg(ES.coded('timeout'))));
    assert.strictEqual(ES.errMsg(new Error('daily limit')), 'daily limit');
    const h = ES.health(); assert.ok(h.live === true && 'ready' in h && 'aiBreaker' in h);
    const d = ES.debug(); assert.ok(d.health && d.metrics && Array.isArray(d.logs));
  });

  await t('chunk / capObject', () => {
    assert.deepStrictEqual(ES.chunk([1,2,3,4,5], 2), [[1,2],[3,4],[5]]); assert.deepStrictEqual(ES.chunk([], 3), []);
    assert.strictEqual(ES.chunk(Array.from({length: 1001}, (_, i) => i), 400).length, 3);
    const o = {}; for (let i = 0; i < 10; i++) o['k' + i] = i; ES.capObject(o, 4);
    assert.deepStrictEqual(Object.keys(o), ['k6','k7','k8','k9']);
  });
  await t('saga: order, stops at failing step, resume skips done steps', async () => {
    const ran = []; let fail = true;
    const steps = [ { name: 'a', run: async () => ran.push('a') }, { name: 'b', run: async () => { ran.push('b'); if (fail) throw new Error('boom'); } }, { name: 'c', run: async () => ran.push('c') } ];
    const saved = []; const st = { done: [] };
    let r = await ES.saga(steps, st, s => saved.push(s.done.slice()));
    assert.strictEqual(r.ok, false); assert.strictEqual(r.step, 'b'); assert.strictEqual(r.error.message, 'boom');
    assert.deepStrictEqual(ran, ['a','b']); assert.deepStrictEqual(saved, [['a']]);
    fail = false; r = await ES.saga(steps, st);
    assert.strictEqual(r.ok, true); assert.deepStrictEqual(ran, ['a','b','b','c']);       // 'a' dobara nahi chala
    assert.deepStrictEqual(st.done, ['a','b','c']);
  });
  await t('rollout (canary): true/false/number%, stable per id, ~distribution, flag() stays kill-switch', async () => {
    let cb; ES.startFlags({ collection: () => ({ doc: () => ({ onSnapshot: f => { cb = f; } }) }) });
    cb({ exists: true, data: () => ({ allOn: true, off: false, tenPct: 10, zero: 0, full: 100, str: 'yes' }) });
    assert.strictEqual(ES.rollout('allOn', 'x'), true); assert.strictEqual(ES.rollout('off', 'x'), false);
    assert.strictEqual(ES.rollout('missing', 'x'), false); assert.strictEqual(ES.rollout('str', 'x'), false);
    assert.strictEqual(ES.rollout('zero', 'x'), false); assert.strictEqual(ES.rollout('full', 'x'), true);
    assert.strictEqual(ES.rollout('tenPct', 'dev_abc'), ES.rollout('tenPct', 'dev_abc'));                                // sthir
    let on = 0; for (let i = 0; i < 5000; i++) if (ES.rollout('tenPct', 'dev_' + i)) on++;
    assert.ok(on > 350 && on < 650, 'about 10% expected, got ' + on / 50 + '%');
    for (let i = 0; i < 300; i++) { const b = ES.bucket('u' + i, 'f'); assert.ok(Number.isInteger(b) && b >= 0 && b < 100); }
    assert.ok(ES.rollout('tenPct', 'a') === (ES.bucket('a', 'tenPct') < 10));
    cb({ exists: false, data: () => undefined });
  });
  await t('chaos: ai-fail / ai-502 / ai-429 / ai-slow behave like real faults; off restores normal', async () => {
    const store = {}; globalThis.sessionStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
    let calls = 0; globalThis.fetch = async () => { calls++; return resp(200, { answer: 'real' }); };
    assert.throws(() => ES.chaos.set('nope'), /modes/);
    ES.chaos.set('ai-fail'); await rejects(ES.aiRequest('u', {}, FAST), 'network'); assert.strictEqual(calls, 0); assert.strictEqual(I.aiBreaker.fails, 1);
    I.aiBreaker.fails = 0; ES.chaos.set('ai-502'); const e = await rejects(ES.aiRequest('u', {}, FAST), 'http_502'); assert.strictEqual(e.message, 'chaos: AI अभी busy है'); assert.strictEqual(I.aiBreaker.fails, 1);
    I.aiBreaker.fails = 0; ES.chaos.set('ai-429'); await rejects(ES.aiRequest('u', {}, FAST), 'http_429'); assert.strictEqual(I.aiBreaker.fails, 0);
    ES.chaos.set('ai-slow'); await rejects(ES.aiRequest('u', {}, { timeoutMs: 30, baseMs: 5 }), 'timeout');
    assert.strictEqual(ES.health().chaos, 'ai-slow'); assert.strictEqual(calls, 0);
    ES.chaos.set(''); assert.strictEqual(ES.health().chaos, null);
    I.aiBreaker.fails = 0; I.aiBreaker.state = 'closed'; assert.strictEqual((await ES.aiRequest('u', {}, FAST)).answer, 'real'); assert.strictEqual(calls, 1);
    delete globalThis.sessionStorage;
  });
  await t('countReads: counts only server docChanges, not cache; surfaces in debug()', () => {
    ES.countReads('c', { metadata: { fromCache: false }, docChanges: () => [1, 2, 3] });
    ES.countReads('c', { metadata: { fromCache: true }, docChanges: () => [1, 2, 3, 4] });
    ES.countReads('c', { metadata: { fromCache: false }, docChanges: () => [1] });
    ES.countReads('c', null); ES.countReads('bad', { docChanges: () => { throw new Error('x'); } });
    const r = ES.debug().firestoreReads; assert.deepStrictEqual(r.c, { snapshots: 4, docs: 4, cachedSnapshots: 1 });
    assert.strictEqual(ES.debug().health.version, ES.version); assert.ok(/^\d+\.\d+\.\d+$/.test(ES.version));
  });
  await t('bus (pub/sub): on/once/off/emit, unsubscribe, error isolation; breaker + flags events', async () => {
    const got = []; const off = ES.bus.on('x', v => got.push(['a', v]));
    ES.bus.on('x', () => { throw new Error('boom'); }); ES.bus.on('x', v => got.push(['c', v]));
    assert.strictEqual(ES.bus.emit('x', 1), 3); assert.deepStrictEqual(got, [['a', 1], ['c', 1]]);       // beech wala crash hua, baaki chale
    off(); ES.bus.emit('x', 2); assert.deepStrictEqual(got.map(g => g[0]), ['a', 'c', 'c']);
    let n = 0; ES.bus.once('y', () => n++); ES.bus.emit('y'); ES.bus.emit('y'); assert.strictEqual(n, 1);
    assert.strictEqual(ES.bus.emit('nobody'), 0);
    const ev = []; const o1 = ES.bus.on('breaker:open', e => ev.push(e.name));
    globalThis.fetch = async () => resp(500, {}); for (let i = 0; i < 3; i++) await rejects(ES.aiRequest('u', {}, FAST), 'http_500');
    assert.deepStrictEqual(ev, ['ai']); o1();
    let flagsSeen = null; ES.bus.once('flags', f => { flagsSeen = f; });
    let cb; ES.startFlags({ collection: () => ({ doc: () => ({ onSnapshot: f => { cb = f; } }) }) }); cb({ exists: true, data: () => ({ ai: false }) });
    assert.strictEqual(flagsSeen.ai, false); cb({ exists: false, data: () => undefined });
  });
  await t('clock skew: measures vs server Date header; emits only beyond threshold; never throws', async () => {
    const ev = []; const off = ES.bus.on('clock:skew', e => ev.push(e.ms));
    const mk = delta => async () => ({ headers: { get: k => (k === 'Date' ? new Date(Date.now() + delta).toUTCString() : null) } });
    globalThis.fetch = mk(0); let s = await ES.checkClockSkew({ url: '/x' }); assert.ok(Math.abs(s) < 2500, 'skew ' + s); assert.strictEqual(ev.length, 0);
    globalThis.fetch = mk(-3600e3); s = await ES.checkClockSkew({ url: '/x' }); assert.ok(s > 3590e3 && s < 3610e3, 'phone ek ghanta aage'); assert.strictEqual(ev.length, 1);
    globalThis.fetch = mk(+2 * 3600e3); s = await ES.checkClockSkew({ url: '/x' }); assert.ok(s < -7190e3 && s > -7210e3); assert.strictEqual(ev.length, 2);
    globalThis.fetch = mk(-5 * 60e3); await ES.checkClockSkew({ url: '/x' }); assert.strictEqual(ev.length, 2);           // 5 min < 10 min threshold
    await ES.checkClockSkew({ url: '/x', thresholdMs: 60e3 }); assert.strictEqual(ev.length, 3);
    globalThis.fetch = async () => ({ headers: { get: () => null } }); assert.strictEqual(await ES.checkClockSkew({ url: '/x' }), null);
    globalThis.fetch = async () => ({ headers: { get: () => 'not a date' } }); assert.strictEqual(await ES.checkClockSkew({ url: '/x' }), null);
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); }; assert.strictEqual(await ES.checkClockSkew({ url: '/x' }), null);
    off();
  });
  await t('sanitize: XSS payloads neutralised', () => {
    const bad = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>', '<iframe src="javascript:alert(1)"></iframe>',
      '<b onclick="alert(1)">x</b>', '<a href="javascript:alert(1)">x</a>', '"><script>alert(1)</script>', '<sub onmouseover=alert(1)>x</sub>', '<B ONCLICK=1>x</B>'];
    for (const b of bad) {
      const o = ES.sanitize(b);
      assert.ok(!/<(?!\/?(b|i|u|em|strong|sub|sup|code|small|br)>)/i.test(o), 'raw tag left: ' + o);
      assert.ok(!/<[a-z\/][^>]*\s(on\w+|src|href)\s*=/i.test(o), 'attr left: ' + o);
    }
  });
  await t('sanitize: allowed tags, entities, plain math kept; tags balanced', () => {
    assert.strictEqual(ES.sanitize('H<sub>2</sub>O'), 'H<sub>2</sub>O');
    assert.strictEqual(ES.sanitize('x<sup>2</sup> + y<SUP>2</SUP>'), 'x<sup>2</sup> + y<sup>2</sup>');
    assert.strictEqual(ES.sanitize('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
    assert.strictEqual(ES.sanitize('5 &times; 3 = 15, 30&deg;, &#176; &amp;'), '5 &times; 3 = 15, 30&deg;, &#176; &amp;');
    assert.strictEqual(ES.sanitize('line1<br>line2<br/>'), 'line1<br>line2<br>');
    assert.strictEqual(ES.sanitize('<b>unclosed <i>text'), '<b>unclosed <i>text</i></b>');
    assert.strictEqual(ES.sanitize('<b><i>x</b></i>'), '<b><i>x</i></b>');
    assert.strictEqual(ES.sanitize('stray </b> closer'), 'stray  closer');
    assert.strictEqual(ES.sanitize(null), ''); assert.strictEqual(ES.sanitize(42), '42');
    const once = ES.sanitize('<b>a</b> &lt; <script>'); assert.strictEqual(ES.sanitize(once), once);   // idempotent
  });
  await t('escAttr + safeUrl', () => {
    assert.strictEqual(ES.escAttr('a"b\'c<d>&'), 'a&quot;b&#39;c&lt;d&gt;&amp;');
    assert.strictEqual(ES.safeUrl('https://drive.google.com/file/d/1/view?usp=sharing'), 'https://drive.google.com/file/d/1/view?usp=sharing');
    assert.strictEqual(ES.safeUrl('http://example.com/a b'), 'http://example.com/a%20b');
    for (const u of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:x', 'file:///etc/passwd', '']) assert.strictEqual(ES.safeUrl(u), '', u);
    assert.strictEqual(ES.safeUrl("https://x.com/a');alert(1);//"), "https://x.com/a');alert(1);//");   // quote URL me rehta hai — isliye attribute me escAttr zaroori
    assert.ok(!ES.escAttr(ES.safeUrl("https://x.com/a\"onmouseover=\"alert(1)")).includes('"'));
  });

  console.log(`\n${pass} tests passed` + (process.exitCode ? ' — FAILURES above' : ''));
})();
