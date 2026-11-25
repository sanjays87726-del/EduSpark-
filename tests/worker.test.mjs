import assert from 'assert';
import fs from 'fs'; import os from 'os'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'es-worker-')), 'worker.mjs');
fs.copyFileSync(path.join(root, 'worker.js'), tmp);                 // worker.js ESM hai par package CJS — isliye .mjs copy
fs.copyFileSync(path.join(root, 'telegram.js'), path.join(path.dirname(tmp), 'telegram.js')); // worker.js ka relative ESM import resolve ho
const worker = (await import(pathToFileURL(tmp).href)).default;
const { subtle } = globalThis.crypto;
const b64u = b => Buffer.from(b).toString('base64url');
const PROJECT = 'eduspark-41703', ORIGIN = 'https://eduspark.live';

const kp1 = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']);
const kp2 = await subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign','verify']);
const jwk = async (kp, kid) => ({ ...(await subtle.exportKey('jwk', kp.publicKey)), kid, alg: 'RS256', use: 'sig' });
const OLD = { keys: [await jwk(kp1, 'k1')] }, NEW = { keys: [await jwk(kp1, 'k1'), await jwk(kp2, 'k2')] };
async function token({ kp = kp1, kid = 'k1', uid = 'u1', aud = PROJECT, exp, tamper, claims = {} } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ aud, iss: 'https://securetoken.google.com/' + PROJECT, sub: uid, iat: now - 5, exp: exp ?? now + 3600, ...claims }));
  const sig = Buffer.from(await subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(h + '.' + p)));
  if (tamper) sig[0] ^= 0xff;
  return h + '.' + p + '.' + sig.toString('base64url');
}

let geminiDelay = 0, jwksCalls = 0, jwksFresh = 0, jwksServe = OLD, geminiMode = 'ok', geminiAnswer = 'जवाब';
globalThis.fetch = async (url, opts = {}) => {
  if (String(url).includes('googleapis.com/service_accounts')) { jwksCalls++; if (opts.cf && opts.cf.cacheTtl === 0) { jwksFresh++; jwksServe = NEW; } return { ok: true, json: async () => jwksServe }; }
  if (String(url).includes('generativelanguage')) {
    assert.strictEqual(opts.headers['x-goog-api-key'], 'secret');                          // key header me, URL me nahi
    assert.ok(!String(url).includes('secret'));
    if (geminiDelay) await new Promise(r => setTimeout(r, geminiDelay));
    if (geminiMode === 'fail') return { ok: false, status: 500, text: async () => 'boom' };
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: geminiAnswer }] } }] }) };
  }
  throw new Error('unexpected fetch ' + url);
};
const kv = new Map(); const IK_KEY = 'private_test_key_123', ADMIN_PASS = 'test_panel_pass_123', SUPER_ADMIN_PASS = 'test_super_admin_pass_456'; const env = { GEMINI_KEY: 'secret', DAILY_LIMIT: '5', IMAGEKIT_PRIVATE_KEY: IK_KEY, ADMIN_PASS, SUPER_ADMIN_PASS, RATE: { get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } } };
const post = (body, { origin = ORIGIN, headers = {}, path = '/' } = {}) => worker.fetch(new Request('https://w.example' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), env);
const Q = 'Newton ka pehla niyam kya hai?';
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };

await t('GET status v15 includes Telegram configuration flags, no-store + nosniff', async () => {
  const r = await worker.fetch(new Request('https://w.example/'), env); const j = await r.json();
  assert.strictEqual(j.version, 16); assert.strictEqual(j.TELEGRAM_BOT_TOKEN, false); assert.strictEqual(j.TELEGRAM_WEBHOOK_SECRET, false); assert.strictEqual(j.TELEGRAM_CHAT_ID, false); assert.deepStrictEqual(j.apiVersions, ['v1']); assert.strictEqual(r.headers.get('X-API-Version'), '1'); assert.strictEqual(r.headers.get('Cache-Control'), 'no-store'); assert.strictEqual(r.headers.get('X-Content-Type-Options'), 'nosniff');
});
await t('OPTIONS preflight: allowed headers unchanged (Content-Type only) + Max-Age', async () => {
  const r = await worker.fetch(new Request('https://w.example/', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.strictEqual(r.status, 204); assert.strictEqual(r.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.strictEqual(r.headers.get('Access-Control-Allow-Origin'), ORIGIN); assert.strictEqual(r.headers.get('Access-Control-Max-Age'), '86400');
});
await t('POST from foreign origin -> 403', async () => { assert.strictEqual((await post({}, { origin: 'https://evil.com' })).status, 403); });
await t('oversized body -> 413 (header and real length)', async () => {
  assert.strictEqual((await post({ idToken: 'x'.repeat(40000) })).status, 413);
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
await t('valid token -> 200 with unlimited quota metadata and no KV counter write', async () => {
  const before = kv.size;
  const r = await post({ idToken: await token(), question: Q, board: 'CBSE-10' }); const j = await r.json();
  assert.strictEqual(r.status, 200); assert.strictEqual(j.answer, 'जवाब'); assert.strictEqual(j.left, null); assert.strictEqual(j.unlimited, true);
  assert.strictEqual(kv.size, before);
});
await t('AI answer cleanup repairs malformed water formula and strips LaTeX wrappers', async () => {
  geminiAnswer = 'जल (HWater) और कार्बन डाइऑक्साइड ($CO_2$); H_2O';
  const r = await post({ idToken: await token({ uid: 'chemistry-cleanup' }), question: 'Prakash sanshleshan ka sutra?' });
  const j = await r.json();
  assert.strictEqual(r.status, 200);
  assert.match(j.answer, /H₂O/);
  assert.match(j.answer, /CO₂/);
  assert.doesNotMatch(j.answer, /HWater|\\text|\$|_2/);
  geminiAnswer = 'जवाब';
});
await t('Gemini failure -> 502 + rid without consuming a daily counter', async () => {
  const before = kv.size;
  geminiMode = 'fail';
  const r = await post({ idToken: await token({ uid: 'u-fail' }), question: Q }); const j = await r.json();
  geminiMode = 'ok';
  assert.strictEqual(r.status, 502); assert.ok(/^[0-9a-f]{8}$/.test(j.rid), 'rid'); assert.strictEqual(kv.size, before);
});
await t('daily AI cap removed: repeated questions remain allowed beyond DAILY_LIMIT', async () => {
  env.DAILY_LIMIT = '1';
  const tok = await token({ uid: 'no-daily-cap' });
  for (let i = 0; i < 7; i++) {
    const r = await post({ idToken: tok, question: Q });
    assert.strictEqual(r.status, 200, 'request ' + (i + 1));
    const j = await r.json(); assert.strictEqual(j.unlimited, true);
  }
  env.DAILY_LIMIT = '5';
});
await t('AI endpoint no longer requires RATE KV binding', async () => {
  const saved = env.RATE; delete env.RATE;
  const r = await post({ idToken: await token({ uid: 'no-kv-ai' }), question: Q });
  env.RATE = saved;
  assert.strictEqual(r.status, 200);
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
await t('long student question up to 8,000 characters is accepted', async () => {
  const longQuestion = 'Explain this concept: ' + 'detail '.repeat(300);
  const r = await post({ idToken: await token({ uid: 'long-question' }), question: longQuestion });
  assert.strictEqual(r.status, 200);
});
await t('parallel requests from same uid: only 1 passes, others 429; lock released after', async () => {
  const tok = await token({ uid: 'par1' }); geminiDelay = 80;
  const rs = await Promise.all([1,2,3,4].map(() => post({ idToken: tok, question: Q }))); geminiDelay = 0;
  const codes = rs.map(r => r.status).sort();
  assert.deepStrictEqual(codes, [200, 429, 429, 429]);
  assert.strictEqual(kv.size, 0, 'unlimited AI requests must not write daily quota counters');
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
  const before = kv.size;
  for (const path of ['/v2/ask', '/imagekit-auth/x', '/v1/ask/extra']) { const r = await post({ idToken: tok, question: Q }, { path }); assert.strictEqual(r.status, 404, path); }
  assert.strictEqual(kv.size, before);                                                               // 404 par koi quota write nahi
});
await t('imagekit-auth: admin gets {token, expire, signature}; signature = HMAC-SHA1(privateKey, token+expire) hex', async () => {
  const { createHmac } = await import('crypto');
  const before = kv.size;
  const g = await post({ password: SUPER_ADMIN_PASS }, { path: '/admin-gate' }); assert.strictEqual(g.status, 200);
  const gate = (await g.json()).gate;                                                                 // sahi password -> 12 ghante ka signed gate token
  const noGate = await post({ idToken: await token({ uid: 'adm1', claims: { email: 'bhupeshkumar36882@gmail.com', email_verified: true } }) }, { path: '/imagekit-auth' });
  assert.strictEqual(noGate.status, 401);                                                             // admin email sahi par gate nahi -> 401
  const badGate = await post({ idToken: await token({ uid: 'adm1', claims: { email: 'bhupeshkumar36882@gmail.com', email_verified: true } }), gate: gate.slice(0, -1) + (gate.endsWith('0') ? '1' : '0') }, { path: '/imagekit-auth' });
  assert.strictEqual(badGate.status, 401);                                                            // tampered gate -> 401
  const r = await post({ idToken: await token({ uid: 'adm1', claims: { email: 'bhupeshkumar36882@gmail.com', email_verified: true } }), gate }, { path: '/imagekit-auth' });
  const j = await r.json(); assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(Object.keys(j).sort(), ['expire', 'signature', 'token']);
  assert.strictEqual(j.signature, createHmac('sha1', IK_KEY).update(j.token + j.expire).digest('hex'));
  const now = Math.floor(Date.now() / 1000); assert.ok(j.expire > now && j.expire <= now + 3600, 'expire < 1 ghanta');
  assert.strictEqual(kv.size, before);                                                                // KV quota kharch nahi
  assert.ok(!JSON.stringify(j).includes(IK_KEY));                                                     // private key kabhi response me nahi
  const j2 = await (await post({ idToken: await token({ uid: 'adm1', claims: { email: 'bhupeshkumar36882@gmail.com', email_verified: true } }), gate }, { path: '/imagekit-auth' })).json();
  assert.notStrictEqual(j2.token, j.token);                                                           // har baar naya token
});
await t('imagekit-auth: non-admin / unverified / no-email -> 403; bad token -> 401; no secret -> 500; bad origin -> 403', async () => {
  const ik = (body, o) => post(body, { path: '/imagekit-auth', ...o });
  const ADM = 'bhupeshkumar36882@gmail.com';
  assert.strictEqual((await ik({ idToken: await token({ uid: 's1', claims: { email: 'student@gmail.com', email_verified: true } }) })).status, 403);
  assert.strictEqual((await ik({ idToken: await token({ uid: 's2', claims: { email: ADM, email_verified: false } }) })).status, 403);
  assert.strictEqual((await ik({ idToken: await token({ uid: 's3' }) })).status, 403);
  assert.strictEqual((await ik({ idToken: await token({ uid: 's4', claims: { email: ADM, email_verified: true }, tamper: true }) })).status, 401);
  assert.strictEqual((await ik({})).status, 401);
  assert.strictEqual((await ik('not json')).status, 400);
  assert.strictEqual((await ik({ idToken: await token({ uid: 's5', claims: { email: ADM, email_verified: true } }) }, { origin: 'https://evil.example' })).status, 403);
  const saved = env.IMAGEKIT_PRIVATE_KEY; delete env.IMAGEKIT_PRIVATE_KEY;
  const r = await ik({ idToken: await token({ uid: 's6', claims: { email: ADM, email_verified: true } }) }); env.IMAGEKIT_PRIVATE_KEY = saved;
  assert.strictEqual(r.status, 500); assert.ok((await r.json()).error.includes('IMAGEKIT_PRIVATE_KEY'));
});
await t('contract: success response keys are exactly {answer, left, apiVersion}; errors always {error}', async () => {
  const ok = await (await post({ idToken: await token({ uid: 'ct1' }), question: Q })).json();
  assert.deepStrictEqual(Object.keys(ok).sort(), ['answer', 'apiVersion', 'left', 'unlimited']);
  for (const [body, code] of [[{ question: Q }, 401], [{ idToken: await token({ uid: 'ct2' }), question: 'hi' }, 400]]) {
    const r = await post(body); const j = await r.json(); assert.strictEqual(r.status, code); assert.deepStrictEqual(Object.keys(j), ['error']);
  }
});

// ── Admin v2: panel-entry, staff, har section ka alag password, token verify ──────────────
const gate = async (body, hdr = {}) => { const r = await post(body, { path: '/admin-gate', headers: hdr }); return { status: r.status, j: await r.json() }; };
const verify = async (g, scope) => (await (await post({ gate: g, scope }, { path: '/admin-verify' })).json()).ok;
const adminTok = async () => token({ uid: 'adm9', claims: { email: 'bhupeshkumar36882@gmail.com', email_verified: true } });
await t('admin v2: GET status lists which section/staff passwords are configured', async () => {
  env.PASS_FINANCE = 'fin_pw_000_x'; env.PASS_STAFF = 'staff_pw_789_x';
  const j = await (await worker.fetch(new Request('https://w.example/'), env)).json();
  assert.strictEqual(j.ADMIN_PASS, true); assert.strictEqual(j.SUPER_ADMIN_PASS, true); assert.strictEqual(j.PASS_STAFF, true); assert.strictEqual(j.sections.finance, true); assert.strictEqual(j.sections.users, false);
  assert.strictEqual(Object.keys(j.sections).length, 12);
  assert.ok(!JSON.stringify(j).includes('fin_pw_000_x') && !JSON.stringify(j).includes(SUPER_ADMIN_PASS));        // password kabhi status me nahi
});
await t('admin v2: ADMIN_PASS opens panel only; SUPER_ADMIN_PASS grants master', async () => { const panel = await gate({ password: ADMIN_PASS }); assert.strictEqual(panel.status, 200); assert.strictEqual(panel.j.scope, 'panel'); assert.strictEqual(await verify(panel.j.gate, 'panel'), true); assert.strictEqual(await verify(panel.j.gate, 'master'), false); const fresh = await gate({ password: SUPER_ADMIN_PASS }); assert.strictEqual(fresh.status, 200); assert.strictEqual(fresh.j.scope, 'master'); });
await t('admin v2: master entry -> scope master, works for image auth; panel/staff tokens cannot upload', async () => {
  const m = await gate({ password: SUPER_ADMIN_PASS }); assert.strictEqual(m.status, 200); assert.strictEqual(m.j.scope, 'master');
  const ok = await post({ idToken: await adminTok(), gate: m.j.gate }, { path: '/imagekit-auth' }); assert.strictEqual(ok.status, 200);
  const panel = await gate({ password: ADMIN_PASS }); assert.strictEqual(panel.j.scope, 'panel');
  const panelNo = await post({ idToken: await adminTok(), gate: panel.j.gate }, { path: '/imagekit-auth' }); assert.strictEqual(panelNo.status, 401);
  const st = await gate({ password: env.PASS_STAFF }); assert.strictEqual(st.status, 200); assert.strictEqual(st.j.scope, 'staff');
  const no = await post({ idToken: await adminTok(), gate: st.j.gate }, { path: '/imagekit-auth' }); assert.strictEqual(no.status, 401);
  assert.strictEqual(await verify(st.j.gate, 'staff'), true); assert.strictEqual(await verify(st.j.gate, 'master'), false);
});
await t('admin v2: section password opens only that section; master (Super Admin) opens every section; section password cannot enter the panel', async () => {
  const f = await gate({ password: env.PASS_FINANCE, section: 'finance' }); assert.strictEqual(f.status, 200); assert.strictEqual(f.j.scope, 'finance');
  assert.strictEqual(await verify(f.j.gate, 'finance'), true);
  assert.strictEqual(await verify(f.j.gate, 'users'), false); assert.strictEqual(await verify(f.j.gate, 'master'), false);   // token kisi aur scope par nahi chalta
  const m = await gate({ password: SUPER_ADMIN_PASS, section: 'finance' }); assert.strictEqual(m.status, 200); assert.strictEqual(m.j.scope, 'finance'); assert.strictEqual(await verify(m.j.gate, 'finance'), true);
  const bad = await gate({ password: env.PASS_FINANCE }); assert.strictEqual(bad.status, 401);                              // section password se panel nahi khulta
  const wrongSec = await gate({ password: env.PASS_FINANCE, section: 'users' }); assert.strictEqual(wrongSec.status, 401);
});
await t('admin v2: tampered/garbage token and unknown section/scope are rejected', async () => {
  const f = await gate({ password: env.PASS_FINANCE, section: 'finance' });
  const tam = f.j.gate.slice(0, -1) + (f.j.gate.endsWith('0') ? '1' : '0');
  assert.strictEqual(await verify(tam, 'finance'), false); assert.strictEqual(await verify('', 'finance'), false); assert.strictEqual(await verify('9999999999999.abc', 'finance'), false);
  assert.strictEqual((await gate({ password: 'x', section: 'hacking' })).status, 400);
  assert.strictEqual((await post({ gate: 'x', scope: 'root' }, { path: '/admin-verify' })).status, 400);
});
await t('admin v2: section with no password configured reports open; wrong passwords are rate-limited per section (5/day) without locking other sections', async () => {
  const open = await gate({ section: 'reports' }); assert.strictEqual(open.status, 200); assert.strictEqual(open.j.open, true);
  const ip = { 'CF-Connecting-IP': '9.9.9.9' };
  for (let i = 0; i < 5; i++) assert.strictEqual((await gate({ password: 'nope' + i, section: 'finance' }, ip)).status, 401);
  assert.strictEqual((await gate({ password: 'nope', section: 'finance' }, ip)).status, 429);
  assert.strictEqual((await gate({ password: env.PASS_FINANCE, section: 'finance' }, ip)).status, 429);                      // lock ke baad sahi password bhi nahi
  assert.strictEqual((await gate({ password: SUPER_ADMIN_PASS }, ip)).status, 200);                                                // entry gate ka counter alag
});
await t('admin v2: rotating ADMIN_PASS invalidates panel token; rotating SUPER_ADMIN_PASS invalidates master-issued section tokens', async () => {
  const f = await gate({ password: SUPER_ADMIN_PASS, section: 'finance' }); assert.strictEqual(await verify(f.j.gate, 'finance'), true);
  const oldMaster = env.SUPER_ADMIN_PASS; env.SUPER_ADMIN_PASS = 'rotated_new_master_pw'; assert.strictEqual(await verify(f.j.gate, 'finance'), false); env.SUPER_ADMIN_PASS = oldMaster;
  const p = await gate({ password: ADMIN_PASS }); assert.strictEqual(await verify(p.j.gate, 'panel'), true); const oldPanel = env.ADMIN_PASS; env.ADMIN_PASS = 'rotated_panel_pw'; assert.strictEqual(await verify(p.j.gate, 'panel'), false); env.ADMIN_PASS = oldPanel;
});
console.log(`\n${n} worker tests passed`);
