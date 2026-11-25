// sw.js: admin portal kabhi cache se nahi (stale ops-portal + naya Worker = "session expired/verify nahi hua"); baaki pages SWR rehte hain
const assert = require('assert'); const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const listeners = {}; const calls = { fetch: [], cacheOpen: 0 };
const cacheStore = new Map();
const fakeCache = { match: async () => ({ cached: true }), put: async () => {}, add: async () => {}, keys: async () => [], delete: async () => true };
const sandbox = {
  self: { addEventListener: (n, f) => { listeners[n] = f; }, skipWaiting() {}, clients: { claim: async () => {} }, location: { origin: 'https://eduspark.live' }, registration: {} },
  caches: { open: async () => { calls.cacheOpen++; return fakeCache; }, keys: async () => [], match: async () => undefined },
  location: { origin: 'https://eduspark.live' },
  fetch: async (req, init) => { calls.fetch.push({ url: String(req.url || req), init }); return { status: 200, clone() { return this; } }; },
  Response, URL, Promise, setTimeout, clients: {}
};
new Function(...Object.keys(sandbox), src)(...Object.values(sandbox));
const run = (url, mode) => { let out; listeners.fetch({ request: { method: 'GET', url, mode: mode || 'navigate' }, respondWith: p => { out = p; }, waitUntil() {} }); return out; };
(async () => {
  calls.fetch.length = 0; calls.cacheOpen = 0;
  const admin = run('https://eduspark.live/ops-portal-7c91e4.html'); assert.ok(admin, 'admin page must be handled by the SW');
  await admin; assert.strictEqual(calls.cacheOpen, 0, 'admin page must never touch the cache');
  assert.strictEqual(calls.fetch[0].init.cache, 'no-cache', 'admin page must revalidate with the network');
  const adm2 = run('https://eduspark.live/admin.html'); assert.ok(adm2); await adm2; assert.strictEqual(calls.cacheOpen, 0);
  const home = run('https://eduspark.live/index.html'); assert.ok(home); await home; assert.ok(calls.cacheOpen > 0, 'student app keeps stale-while-revalidate');
  assert.ok(/CACHE_NAME\s*=\s*"eduspark-v22\.4"/.test(src), 'CACHE_NAME bumped');
  console.log('sw-admin tests passed');
})().catch(e => { console.error(e); process.exit(1); });
