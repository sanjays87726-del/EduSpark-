import assert from 'assert';
import { dispatch } from '../cron-trigger/worker.js';
const sleep = async () => {};
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };
const env = { GH_REPO: 'me/eduspark', GH_TOKEN: 'tok', GH_REF: 'main' };
await t('204 -> ok, correct URL + auth + UA + ref', async () => {
  let seen; const r = await dispatch(env, async (u, o) => { seen = { u, o }; return { status: 204 }; }, sleep);
  assert.deepStrictEqual(r, { ok: true, attempt: 1 });
  assert.strictEqual(seen.u, 'https://api.github.com/repos/me/eduspark/actions/workflows/notifications.yml/dispatches');
  assert.strictEqual(seen.o.headers.Authorization, 'Bearer tok'); assert.ok(seen.o.headers['User-Agent']);
  assert.deepStrictEqual(JSON.parse(seen.o.body), { ref: 'main' });
});
await t('5xx / network error -> retries then succeeds', async () => {
  let c = 0; const r = await dispatch(env, async () => { c++; if (c === 1) throw new Error('net'); if (c === 2) return { status: 502 }; return { status: 204 }; }, sleep);
  assert.strictEqual(r.ok, true); assert.strictEqual(r.attempt, 3);
});
await t('401/404 -> no retry (token or repo wrong)', async () => {
  let c = 0; const r = await dispatch(env, async () => { c++; return { status: 401 }; }, sleep);
  assert.strictEqual(r.ok, false); assert.strictEqual(c, 1);
});
await t('always failing -> gives up after 4 attempts', async () => {
  let c = 0; const r = await dispatch(env, async () => { c++; return { status: 503 }; }, sleep);
  assert.strictEqual(r.ok, false); assert.strictEqual(c, 4);
});
await t('missing/placeholder config is reported, no request made', async () => {
  let c = 0; const f = async () => { c++; return { status: 204 }; };
  assert.strictEqual((await dispatch({ ...env, GH_REPO: 'REPLACE_OWNER/REPLACE_REPO' }, f, sleep)).ok, false);
  assert.strictEqual((await dispatch({ GH_REPO: 'a/b' }, f, sleep)).ok, false); assert.strictEqual(c, 0);
});
console.log(n + ' cron-trigger tests passed');
