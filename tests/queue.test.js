const assert = require('assert');
require('./helpers/fake-admin');
const { makeDb } = require('./helpers/fakedb');
const S = require('../scripts/send-notifications.js');
const HOUR = 3600e3, MIN = 60e3;
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };
const students = (k = 3) => Object.fromEntries(Array.from({ length: k }, (_, i) => ['s' + i, { name: 'S' + i, board: i === 0 ? 'CBSE-10' : 'BSER-10', fcmToken: 'tok' + i }]));
let sends = 0, mode = 'ok';
global.__fcm = { sendEach: async msgs => {
  sends++;
  if (mode === 'throw') throw new Error('FCM down');
  if (mode === 'fail') return { successCount: 0, failureCount: msgs.length, responses: msgs.map(() => ({ success: false, error: { code: 'messaging/internal-error', message: 'x' } })) };
  if (mode === 'dead1') return { successCount: msgs.length - 1, failureCount: 1, responses: msgs.map((m, i) => i === 0 ? { success: false, error: { code: 'messaging/registration-token-not-registered', message: 'gone' } } : { success: true }) };
  return { successCount: msgs.length, failureCount: 0, responses: msgs.map(() => ({ success: true })) };
} };
const mk = (q, st = students()) => makeDb({ notificationQueue: { q1: { title: 'T', body: 'B', audience: 'all', status: 'pending', ...q } }, students: st });
const doc = db => db._cols.notificationQueue.get('q1');
const quiet = async fn => { const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; } };

(async () => {
  await t('happy path: pending -> sent, lease removed', async () => {
    sends = 0; mode = 'ok'; const db = mk({});
    assert.strictEqual(await quiet(() => S.processQueue(db)), false);
    const d = doc(db); assert.strictEqual(d.status, 'sent'); assert.strictEqual(d.sentCount, 3); assert.ok(!('leaseUntil' in d)); assert.strictEqual(sends, 1);
  });
  await t('audience filter + no-targets -> sent 0 with note', async () => {
    sends = 0; mode = 'ok'; const db = mk({ audience: 'REET' });
    await quiet(() => S.processQueue(db)); const d = doc(db); assert.strictEqual(d.status, 'sent'); assert.strictEqual(d.sentCount, 0); assert.strictEqual(d.note, 'koi token nahi'); assert.strictEqual(sends, 0);
  });
  await t('fail -> pending w/ attempts=1 + backoff 20min; not retried before due', async () => {
    sends = 0; mode = 'fail'; const db = mk({}); const t0 = Date.now();
    assert.strictEqual(await quiet(() => S.processQueue(db)), false);
    let d = doc(db); assert.strictEqual(d.status, 'pending'); assert.strictEqual(d.attempts, 1); assert.ok(d.nextAttemptAt >= t0 + 20 * MIN - 50 && d.nextAttemptAt <= Date.now() + 20 * MIN + 50); assert.ok(d.lastError); assert.ok(!('leaseUntil' in d));
    assert.strictEqual(sends, 1); await quiet(() => S.processQueue(db)); assert.strictEqual(sends, 1);               // abhi due nahi — dobara send nahi
  });
  await t('retry 2 (40 min) then dead on 3rd -> returns true (workflow red)', async () => {
    sends = 0; mode = 'fail'; const db = mk({});
    await quiet(() => S.processQueue(db));
    doc(db).nextAttemptAt = Date.now() - 1; await quiet(() => S.processQueue(db));
    let d = doc(db); assert.strictEqual(d.attempts, 2); assert.strictEqual(d.status, 'pending'); assert.ok(d.nextAttemptAt > Date.now() + 39 * MIN);
    doc(db).nextAttemptAt = Date.now() - 1; const red = await quiet(() => S.processQueue(db));
    d = doc(db); assert.strictEqual(d.status, 'dead'); assert.strictEqual(d.attempts, 3); assert.strictEqual(red, true); assert.strictEqual(sends, 3);
    await quiet(() => S.processQueue(db)); assert.strictEqual(sends, 3);                                              // dead dobara nahi chalta
  });
  await t('recovers: fail once then success -> sent', async () => {
    sends = 0; mode = 'fail'; const db = mk({}); await quiet(() => S.processQueue(db));
    mode = 'ok'; doc(db).nextAttemptAt = Date.now() - 1; await quiet(() => S.processQueue(db));
    assert.strictEqual(doc(db).status, 'sent'); assert.strictEqual(doc(db).sentCount, 3);
  });
  await t('FCM throws -> counted as failed attempt (no infinite crash loop)', async () => {
    sends = 0; mode = 'throw'; const db = mk({}); assert.strictEqual(await quiet(() => S.processQueue(db)), false);
    const d = doc(db); assert.strictEqual(d.status, 'pending'); assert.strictEqual(d.attempts, 1); assert.ok(d.lastError.includes('FCM down'));
  });
  await t('partial success counts as sent; dead token cleaned from student', async () => {
    sends = 0; mode = 'dead1'; const db = mk({});
    await quiet(() => S.processQueue(db)); assert.strictEqual(doc(db).status, 'sent'); assert.strictEqual(doc(db).sentCount, 2);
    const withTok = [...db._cols.students.values()].filter(s => 'fcmToken' in s).length; assert.strictEqual(withTok, 2);
  });
  await t('expired lease ("sending" crashed run) is reclaimed; live lease is skipped', async () => {
    sends = 0; mode = 'ok'; let db = mk({ status: 'sending', leaseUntil: Date.now() - 1000 });
    await quiet(() => S.processQueue(db)); assert.strictEqual(doc(db).status, 'sent'); assert.strictEqual(sends, 1);
    sends = 0; db = mk({ status: 'sending', leaseUntil: Date.now() + 5 * MIN });
    await quiet(() => S.processQueue(db)); assert.strictEqual(doc(db).status, 'sending'); assert.strictEqual(sends, 0);
  });
  await t('two concurrent runs: broadcast sent exactly once', async () => {
    sends = 0; mode = 'ok'; const db = mk({});
    const [a, b] = await quiet(() => Promise.all([S.processQueue(db), S.processQueue(db)]));
    assert.strictEqual(sends, 1); assert.strictEqual(doc(db).status, 'sent'); assert.strictEqual(a || b, false);
  });
  await t('legacy "failed" docs untouched; empty queue is fine', async () => {
    sends = 0; mode = 'ok'; const db = mk({ status: 'failed' }); assert.strictEqual(await quiet(() => S.processQueue(db)), false);
    assert.strictEqual(doc(db).status, 'failed'); assert.strictEqual(sends, 0);
  });
  console.log(`\n${n} queue tests passed`);
})();
