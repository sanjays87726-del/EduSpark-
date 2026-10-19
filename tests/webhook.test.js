const assert = require('assert'); const W = require('../scripts/lib/webhook.js');
(async () => {
  const body = JSON.stringify({ id: 'evt1', n: 1 }), secret = 's3cret', now = Date.now(), ts = String(Math.floor(now / 1000));
  const sig = W.sign(secret, body, ts);
  // verify
  assert.ok(W.verify(secret, body, ts, sig, { now }));
  assert.ok(!W.verify('wrong', body, ts, sig, { now }), 'galat secret');
  assert.ok(!W.verify(secret, body + ' ', ts, sig, { now }), 'body badla');
  assert.ok(!W.verify(secret, body, String(+ts + 1), sig, { now }), 'timestamp badla');
  assert.ok(!W.verify(secret, body, ts, sig.slice(0, -2) + '00', { now }), 'sig badla');
  assert.ok(!W.verify(secret, body, ts, 'zz-not-hex', { now }) && !W.verify(secret, body, ts, '', { now }) && !W.verify('', body, ts, sig, { now }) && !W.verify(secret, body, '', sig, { now }));
  assert.ok(!W.verify(secret, body, 'abc', sig, { now }), 'timestamp number nahi');
  const old = String(+ts - 301), oldSig = W.sign(secret, body, old);
  assert.ok(!W.verify(secret, body, old, oldSig, { now }), 'replay: 5 min se purana');
  assert.ok(W.verify(secret, body, old, oldSig, { now, toleranceSec: 600 }));
  const future = String(+ts + 400); assert.ok(!W.verify(secret, body, future, W.sign(secret, body, future), { now }), 'bahut aage ka timestamp');
  // deduper
  let t = 1000; const dd = W.createDeduper(100, () => t);
  assert.ok(dd.firstTime('a')); assert.ok(!dd.firstTime('a')); assert.ok(dd.firstTime('b')); t = 1200; assert.ok(dd.firstTime('a'), 'ttl ke baad dobara allowed');
  // send
  const mk = (...statuses) => { const calls = []; let i = 0; const f = async (url, o) => { calls.push({ url, o }); const s = statuses[Math.min(i++, statuses.length - 1)]; if (s === 'net') throw new TypeError('Failed to fetch'); return { status: s }; }; return { f, calls }; };
  let m = mk(200); let r = await W.send('https://x/h', { a: 1 }, { secret, fetchImpl: m.f, baseMs: 1 });
  assert.deepStrictEqual([r.ok, r.status, r.attempts], [true, 200, 1]);
  const h = m.calls[0].o.headers; assert.ok(W.verify(secret, m.calls[0].o.body, h['X-EduSpark-Timestamp'], h['X-EduSpark-Signature']), 'receiver verify kar sake');
  assert.strictEqual(m.calls[0].o.body, '{"a":1}');
  m = mk(500, 'net', 429, 200); r = await W.send('u', {}, { fetchImpl: m.f, baseMs: 1, retries: 3 }); assert.deepStrictEqual([r.ok, r.attempts], [true, 4]);      // 5xx, network, 429 retry
  m = mk(404); r = await W.send('u', {}, { fetchImpl: m.f, baseMs: 1 }); assert.deepStrictEqual([r.ok, r.status, r.attempts], [false, 404, 1]);                  // 4xx retry nahi
  m = mk(503); r = await W.send('u', {}, { fetchImpl: m.f, baseMs: 1, retries: 2 }); assert.deepStrictEqual([r.ok, r.attempts, r.status], [false, 3, 503]);
  m = mk('net'); r = await W.send('u', {}, { fetchImpl: m.f, baseMs: 1, retries: 1 }); assert.ok(!r.ok && r.attempts === 2 && /Failed to fetch/.test(r.error));
  m = mk(200); await W.send('u', {}, { fetchImpl: m.f }); assert.ok(!('X-EduSpark-Signature' in m.calls[0].o.headers), 'secret nahi to signature nahi');
  // timeout
  const slow = async (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  r = await W.send('u', {}, { fetchImpl: slow, timeoutMs: 20, baseMs: 1, retries: 1 }); assert.ok(!r.ok && r.attempts === 2 && /abort/.test(r.error));
  console.log('webhook tests ✓');
})().catch(e => { console.error(e); process.exit(1); });
