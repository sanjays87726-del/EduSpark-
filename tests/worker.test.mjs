import assert from 'assert';
import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'es-worker-')), 'worker.mjs');
fs.copyFileSync(path.join(root, 'worker.js'), tmp);                 // worker.js ESM hai par package CJS — isliye .mjs copy
const worker = (await import(pathToFileURL(tmp).href)).default;
const { subtle } = globalThis.crypto;
const b64u = b => Buffer.from(b).toString('base64url');
const PROJECT = 'eduspark-41703', ORIGIN = 'https://eduspark.de5.net';

const kp1 = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']);
const kp2 = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']);
const jwk = async (kp, kid) => ({ ...(await subtle.exportKey('jwk', kp.publicKey)), kid, alg: 'RS256', use: 'sig' });
const OLD = { keys: [await jwk(kp1, 'k1')] }, NEW = { keys: [await jwk(kp1, 'k1'), await jwk(kp2, 'k2')] };
async function token({ kp = kp1, kid = 'k1', uid = 'u1', aud = PROJECT, exp, tamper } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ aud, iss: 'https://securetoken.google.com/' + PROJECT, sub: uid, iat: now - 5, exp: exp ?? now + 3600 }));
  const sig = Buffer.from(await subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p)));
  if (tamper) sig[0] ^= 0xff;
  return h + '.' + p + '.' + sig.toString('base64url');
}

let geminiDelay = 0, jwksCalls = 0, jwksFresh = 0, jwksServe = OLD, geminiMode = 'ok';
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).includes('googleapis.com/service_accounts')) { jwksCalls++; if (opts.cf && opts.cf.cacheTtl === 0) { jwksFresh++; jwksServe = NEW; } return { ok: true, json: async () => jwksServe }; }
  if (String(url).includes('generativelanguage')) {
    assert.strictEqual(opts.headers['x-goog-api-key'], 'secret');                          // key header me, URL me nahi
    assert.ok(!String(url).includes('secret'));
    if (geminiDelay) await new Promise(r => setTimeout(r, geminiDelay));
    if (geminiMode === 'fail') return { ok: false, status: 500, text: async () => 'boom' };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'जवाब' }] } }] }) };
  }
  throw new Error('unexpected fetch ' + url);
};
const kv = new Map(); const env = { GEMINI_KEY: 'secret', DAILY_LIMIT: '5', RATE: { get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } } };
const post = (body, { origin = ORIGIN, headers = {}, path = '/' } = {}) => worker.fetch(new Request('https://w.example' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);
const Q = 'Newton ka pehla niyam kya hai?';
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };

await t('GET status v8, no-store + nosniff', async () => {
  const r = await worker.fetch(new Request('https://w.example/'), env); const j = await r.json();
  assert.strictEqual(j.version, 8); assert.deepStrictEqual(j.apiVersions, ['v1']); assert.strictEqual(r.headers.get('X-API-Version'), '1'); assert.strictEqual(r.headers.get('Cache-Control'), 'no-store'); assert.strictEqual(r.headers.get('X-Content-Type-Options'), 'nosniff');
});
await t('OPTIONS preflight: allowed headers unchanged (Content-Type only) + Max-Age', async () => {
  const r = await worker.fetch(new Request('https://w.example/', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.strictEqual(r.status, 204); assert.strictEqual(r.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), ORIGIN); assert.strictEqual(r.headers.get('Access-Control-Max-Age'), '86400');
});
await t('POST from foreign origin -> 403', async () => { assert.strictEqual((await post({}, { origin: 'https://evil.com' })).status, 403); });
await t('oversized body -> 413 (header and real length)', async () => {
  assert.strictEqual((await post({ idToken: 'x'.repeat(20000) })).status, 413);
  const r = await worker.fetch(new Request('https://w.example/', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Length': '99999' }, body: '{}' }), env);
  assert.strictEqual(r.status, 413);
});
await t('bad JSON / null / array -> 400', async () => {
  for (const b of ['{oops', 'null', '[]', '"s"']) assert.strictEqual((await post(b)).status, 400, b);
});
await t('missing / garbage / expired / wrong-aud / tampered token -> 401', async () => {
  for (const idToken of [undefined, 'a.b.c', await token({ exp: Math.floor(Date.now()/1000) - 10 }), await token({ aud: 'other' }), await token({ tamper: true })])
    assert.strictEqual((await post({ idToken, question: Q })).status, 401);
});
await t('valid token -> 200, KV counts, left=4', async () => {
  const r = await post({ idToken: await token(), question: Q, board: 'CBSE-10' }); const j = await r.json();
  assert.strictEqual(r.status, 200); assert.strictEqual(j.answer, 'जवाब'); assert.strictEqual(j.left, 4);
});
await t('Gemini failure -> 502 + rid, quota refunded', async () => {
  const before = [...kv.entries()].find(([k]) => k.startsWith('rl:u1:'))[1];
  geminiMode = 'fail';
  const r = await post({ idToken: await token(), question: Q }); const j = await r.json();
  geminiMode = 'ok';
  assert.strictEqual(r.status, 502); assert.ok(/^[0-9a-f]{8}$/.test(j.rid), 'rid'); assert.strictEqual([...kv.entries()].find(([k]) => k.startsWith('rl:u1:'))[1], before);
});
await t('limit: 5th ok, 6th -> 429 (no rid on 4xx)', async () => {
  for (let i = 0; i < 4; i++) assert.strictEqual((await post({ idToken: await token(), question: Q })).status, 200);
  const r = await post({ idToken: await token(), question: Q }); const j = await r.json();
  assert.strictEqual(r.status, 429); assert.ok(!('rid' in j));
});
await t('key rotation: unknown kid -> one fresh JWKS fetch -> 200', async () => {
  const before = jwksFresh;
  const r = await post({ idToken: await token({ kp: kp2, kid: 'k2', uid: 'u2' }), question: Q });
  assert.strictEqual(r.status, 200); assert.strictEqual(jwksFresh, before + 1);
});
await t('fake kid within 60s does NOT trigger another fresh fetch', async () => {
  const before = jwksFresh;
  const r = await post({ idToken: await token({ kid: 'nope', uid: 'u3' }), question: Q });
  assert.strictEqual(r.status, 401); assert.strictEqual(jwksFresh, before);
});
await t('short question -> 400', async () => { assert.strictEqual((await post({ idToken: await token({ uid: 'u4' }), question: 'hi' })).status, 400); });
await t('parallel requests from same uid: only 1 passes, others 429; lock released after', async () => {
  const tok = await token({ uid: 'par1' }); geminiDelay = 80;
  const rs = await Promise.all([1,2,3,4].map(() => post({ idToken: tok, question: Q }))); geminiDelay = 0;
  const codes = rs.map(r => r.status).sort();
  assert.deepStrictEqual(codes, [200, 429, 429, 429]);
  const used = parseInt([...kv.entries()].find(([k]) => k.startsWith('rl:par1:'))[1]); assert.strictEqual(used, 1);
  assert.strictEqual((await post({ idToken: tok, question: Q })).status, 200);       // lock chhoot gaya
});
await t('lock released even when Gemini throws / returns fail', async () => {
  geminiMode = 'fail'; const tok = await token({ uid: 'par2' });
  assert.strictEqual((await post({ idToken: tok, question: Q })).status, 502);
  geminiMode = 'ok'; assert.strictEqual((await post({ idToken: tok, question: Q })).status, 200);
});
await t('different uids run in parallel', async () => {
  const rs = await Promise.all(['p3','p4','p5'].map(async u => post({ idToken: await token({ uid: u }), question: Q })));
  assert.deepStrictEqual(rs.map(r => r.status), [200,200,200]);
});
await t('API versioning: / (legacy) and /v1/ask behave identically; apiVersion in body; other paths 404 before auth/quota', async () => {
  const tok = await token({ uid: 'ver1' });
  for (const path of ['/', '/v1/ask', '/v1/ask/']) {
    const r = await post({ idToken: tok, question: Q }, { path }); const j = await r.json();
    assert.strictEqual(r.status, 200, path); assert.strictEqual(j.apiVersion, 1); assert.strictEqual(j.answer, 'जवाब'); assert.strictEqual(r.headers.get('X-API-Version'), '1');
  }
  const used = () => parseInt([...kv.entries()].find(([k]) => k.startsWith('rl:ver1:'))[1]);
  const before = used();
  for (const path of ['/v2/ask', '/imagekit-auth', '/v1/ask/extra']) { const r = await post({ idToken: tok, question: Q }, { path }); assert.strictEqual(r.status, 404, path); }
  assert.strictEqual(used(), before);                                                                 // 404 par quota kharch nahi
});
await t('contract: success response keys are exactly {answer, left, apiVersion}; errors always {error}', async () => {
  const ok = await (await post({ idToken: await token({ uid: 'ct1' }), question: Q })).json();
  assert.deepStrictEqual(Object.keys(ok).sort(), ['answer', 'apiVersion', 'left']);
  for (const [body, code] of [[{ question: Q }, 401], [{ idToken: await token({ uid: 'ct2' }), question: 'hi' }, 400]]) {
    const r = await post(body); const j = await r.json(); assert.strictEqual(r.status, code); assert.deepStrictEqual(Object.keys(j), ['error']);
  }
});
console.log(`\n${n} worker tests passed`);
