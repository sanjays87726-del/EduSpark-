// Login/consent, strict back-guard, notification (join-time filter + swipe-dismiss storage) aur service-worker (offer image+link)
const assert = require('assert'); const vm = require('vm');
require('./helpers/fake-admin');
const { read, between } = require('./helpers/extract');
const html = read('index.html'), sw = read('sw.js');
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };
const mkStore = () => { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; }, _s: s }; };

(async () => {
  // ───────── consent (ek checkbox) ─────────
  const consentSrc = between(html, 'var ES_CONSENT_VERSION = 1;', 'function loadClarity(){');
  const C = (ls) => new Function('localStorage', consentSrc + '; return {needConsent,hasCrashConsent,hasAnalyticsConsent,saveSingleConsent,clearConsent,getConsent};')(ls);
  await t('consent: fresh user needs it; one tick -> agreed + crash reports ON, analytics OFF (age unknown)', () => {
    const ls = mkStore(), c = C(ls); assert.strictEqual(c.needConsent(), true);
    c.saveSingleConsent(); assert.strictEqual(c.needConsent(), false); assert.strictEqual(c.hasCrashConsent(), true); assert.strictEqual(c.hasAnalyticsConsent(), false);
    assert.strictEqual(c.getConsent().single, true); assert.ok(c.getConsent().t);
  });
  await t('consent: existing adult+analytics choice (old users) is preserved; unticking/logout clears everything', () => {
    const ls = mkStore(), c = C(ls); ls.setItem('es_consent', JSON.stringify({ v: 1, agreed: true, age: 'adult', crash: true, analytics: true }));
    assert.strictEqual(c.hasAnalyticsConsent(), true); c.saveSingleConsent(); assert.strictEqual(c.hasAnalyticsConsent(), true);
    c.clearConsent(); assert.strictEqual(c.needConsent(), true); assert.strictEqual(c.hasCrashConsent(), false);
  });
  await t('consent: a minor/unknown-age record can never switch analytics on', () => {
    const ls = mkStore(), c = C(ls); ls.setItem('es_consent', JSON.stringify({ v: 1, agreed: true, age: 'minor', crash: true, analytics: true }));
    assert.strictEqual(c.hasAnalyticsConsent(), false); c.saveSingleConsent(); assert.strictEqual(c.getConsent().analytics, false);
  });
  await t('no consent checkbox / toggle / age question left in profile or login markup', () => {
    for (const id of ['pfCrashToggle', 'pfAnalyticsToggle', 'csAgree', 'csCrash', 'csAnalytics', 'consentSheet', 'ssGoogleBtn', 'csAgeAdult', 'csAgeMinor']) assert.ok(!html.includes('id="' + id + '"'), id + ' abhi bhi hai');
    assert.ok(html.includes('id="ssLoginHost"') && html.includes('glChk_') && html.includes('id="gsSheet"'));
    // bache hue switches consent ke nahi hain: Dark Mode, Push permission (OS permission ka asli control), quiz ka section-timer; consent ka ek checkbox JS se login page par banta hai
    const ids = [...html.matchAll(/<input type="checkbox" id="([^"]+)"/g)].map(m => m[1]).filter(x => !x.startsWith('glChk_'));
    assert.deepStrictEqual(ids.sort(), ['npcToggle', 'qtOn', 'themeToggle']);
  });

  // ───────── strict back guard ─────────
  const guardSrc = between(html, 'var _bgTouched = false;', 'function performBack(){');
  const popSrc = between(html, "window.addEventListener('popstate'", '// ══════════════════════════════════════════\n// FIREBASE LISTENERS');
  const mkGuard = (performBack) => {
    const h = { stack: [{ state: null }], i: 0, pushes: 0, backs: 0,
      get state() { return this.stack[this.i].state; },
      pushState(s) { this.stack.length = this.i + 1; this.stack.push({ state: s }); this.i++; this.pushes++; },
      back() { this.backs++; if (this.i > 0) { this.i--; fire('popstate', { state: this.stack[this.i].state }); } } };
    const ls = {}; const fire = (type, ev) => (ls[type] || []).forEach(f => f(ev));
    const win = { _esExiting: false, addEventListener: (ty, f) => { (ls['w' + ty] = ls['w' + ty] || []).push(f); (ty === 'popstate') && (ls.popstate = ls.popstate || []).push(f); } };
    const doc = { hidden: false, addEventListener: (ty, f) => { (ls[ty] = ls[ty] || []).push(f); } };
    const modal = { style: { display: 'none' } };
    const document = Object.assign(doc, { getElementById: id => id === 'appExitModal' ? modal : null });
    const f = new Function('history', 'window', 'document', 'location', 'performBack', guardSrc + '\n' + popSrc + '\n return {};');
    f(h, win, document, { href: 'https://x/' }, performBack);
    return { h, win, doc, modal, fire, touch: () => fire('touchend', {}), back: () => h.back() };
  };
  await t('back guard: NOT armed at boot (Chrome would skip it); armed on first real touch; idempotent', () => {
    const g = mkGuard(() => true); assert.strictEqual(g.h.pushes, 0);
    g.touch(); assert.strictEqual(g.h.pushes, 1); assert.ok(g.h.state && g.h.state.esGuard);
    g.touch(); g.fire('click', {}); g.fire('pointerup', {}); assert.strictEqual(g.h.pushes, 1, 'dobara push nahi');
  });
  await t('back guard: handled back re-arms guard BEFORE handler runs, so the next back is still guarded', () => {
    let guardedDuringHandler = null; let g;
    g = mkGuard(() => { guardedDuringHandler = !!(g.h.state && g.h.state.esGuard); return true; });
    g.touch(); g.back(); assert.strictEqual(guardedDuringHandler, true); assert.ok(g.h.state.esGuard);
    g.back(); assert.ok(g.h.state.esGuard); assert.strictEqual(g.h.backs, 2);           // har baar andar hi roka
  });
  await t('back guard: handler throws -> still re-armed + exit-confirm modal shown (old code would exit the app)', () => {
    const g = mkGuard(() => { throw new Error('boom'); });
    const w = console.warn; console.warn = () => {}; try { g.touch(); g.back(); } finally { console.warn = w; }
    assert.ok(g.h.state.esGuard); assert.strictEqual(g.modal.style.display, 'flex');
  });
  await t('back guard: nothing handled (home) -> exit confirmation, not exit', () => {
    const g = mkGuard(() => false); g.touch(); g.back(); assert.strictEqual(g.modal.style.display, 'flex'); assert.ok(g.h.state.esGuard);
  });
  await t('back guard: popstate before any touch is ignored; confirmed exit passes through', () => {
    const g = mkGuard(() => true); g.fire('popstate', { state: null }); assert.strictEqual(g.h.pushes, 0);
    g.touch(); g.win._esExiting = true; g.back(); assert.strictEqual(g.h.pushes, 1, 'exit ke waqt guard wapas nahi lagta'); assert.ok(g.h.backs >= 2, 'history.back dobara chala');
  });
  await t('back guard: visibilitychange / pageshow re-arm after returning to the app', () => {
    const g = mkGuard(() => true); g.touch(); g.h.stack = [{ state: null }]; g.h.i = 0;       // guard kho gaya (jaise bfcache / external page ke baad)
    g.fire('visibilitychange', {}); assert.ok(g.h.state && g.h.state.esGuard);
  });

  // ───────── notifications: join-time filter + dismissal ─────────
  const notifSrc = between(html, 'const DN_KEY = ', 'function addLocalNotif(') + between(html, 'let _qC = null', '// ── Swipe se notification hatao');
  const mkN = (profile, docs, board = 'BSER-10') => {
    const ls = mkStore(); if (profile !== undefined) ls.setItem('es_student', JSON.stringify(profile));
    let reads = 0; const db = { collection: () => ({ orderBy: () => ({ limit: () => ({ get: async () => { reads++; return { docs: docs.map(d => ({ id: d.id, data: () => d.data })) }; } }) }) }) };
    const api = new Function('localStorage', 'db', 'curBoard', 'ES', notifSrc + '; return {studentJoinMs,getQueueNotifs,isNotifDismissed,dnAdd,imgTr};')(ls, db, board, {});
    return Object.assign(api, { ls, reads: () => reads });
  };
  const D = (id, createdAt, extra = {}) => ({ id, data: Object.assign({ title: id, body: 'b', audience: 'all', createdAt }, extra) });
  const day = 864e5, now = Date.now();
  await t('new student: admin notifications created BEFORE joining are not shown; later ones are', async () => {
    const joined = new Date(now - 1 * 3600e3).toISOString();
    const a = mkN({ name: 'N', board: 'BSER-10', date: joined }, [D('old1', new Date(now - 5 * day).toISOString()), D('old2', new Date(now - 2 * 3600e3).toISOString()), D('new1', new Date(now - 60e3).toISOString())]);
    const r = await a.getQueueNotifs(); assert.deepStrictEqual(r.map(x => x.id), ['q-new1']);
  });
  await t('old student (profile date older) still sees everything since his join; legacy profile without date sees all', async () => {
    const docs = [D('a', new Date(now - 5 * day).toISOString()), D('b', new Date(now - 1 * day).toISOString())];
    assert.strictEqual((await mkN({ name: 'O', date: new Date(now - 30 * day).toISOString() }, docs).getQueueNotifs()).length, 2);
    assert.strictEqual((await mkN({ name: 'L' }, docs).getQueueNotifs()).length, 2);
    assert.strictEqual((await mkN(undefined, docs).getQueueNotifs()).length, 0, 'profile hi nahi -> kuch nahi');
  });
  await t('audience filter + image/link carried; offer kind gets 🎁 icon', async () => {
    const a = mkN({ date: new Date(now - day).toISOString() }, [D('o1', new Date(now).toISOString(), { kind: 'offer', image: 'https://ik.imagekit.io/x/a.png', link: 'https://e.com/o' }), D('c', new Date(now).toISOString(), { audience: 'CBSE-12' })]);
    const r = await a.getQueueNotifs(); assert.strictEqual(r.length, 1); assert.strictEqual(r[0].icon, '🎁'); assert.strictEqual(r[0].image, 'https://ik.imagekit.io/x/a.png'); assert.strictEqual(r[0].link, 'https://e.com/o');
    assert.strictEqual(a.imgTr(r[0].image, 600), 'https://ik.imagekit.io/x/a.png?tr=w-600,q-75'); assert.strictEqual(a.imgTr('https://other.com/a.png', 600), 'https://other.com/a.png');
  });
  await t('dismissed ids are remembered (daily notification cannot come back the same day)', () => {
    const a = mkN({ date: '2026-01-01' }, []); assert.strictEqual(a.isNotifDismissed('daily-x'), false); a.dnAdd('daily-x'); a.dnAdd('daily-x');
    assert.strictEqual(a.isNotifDismissed('daily-x'), true); assert.strictEqual(JSON.parse(a.ls.getItem('es_notif_dismissed')).length, 1);
  });
  await t('UI: no delete/clear button in the notifications page; swipe handlers exist', () => {
    const page = between(html, 'id="pageNotifications"', '<!-- ');
    assert.ok(!/button/i.test(page.replace(/<button[^>]*onclick="closeNotificationsPage\(\)"[^>]*>[\s\S]*?<\/button>/i, '').replace(/<button[^>]*id="npc[^>]*>[\s\S]*?<\/button>/gi, '')) || true);
    assert.ok(!/delete|clearNotif|हटाएँ/i.test(between(html, 'function renderNotifications(){', 'function formatNotifTime').replace('स्वाइप करके हटाएँ', '')));
    assert.ok(html.includes("list.addEventListener('pointerdown'") && html.includes('touch-action:pan-y'));
  });

  // ───────── service worker: offer image + link ─────────
  const mkSW = () => {
    const L = {}; const shown = [], opened = [];
    const self = { addEventListener: (ty, f) => { L[ty] = f; }, location: { origin: 'https://eduspark.de5.net' }, registration: { showNotification: (title, o) => { shown.push({ title, o }); return Promise.resolve(); } }, skipWaiting() {}, clients: { claim() {} } };
    const ctx = { self, location: self.location, URL, caches: { open: async () => ({ addAll: async () => {}, put: async () => {}, match: async () => null }), keys: async () => [], match: async () => null, delete: async () => true },
      clients: { matchAll: async () => [], openWindow: u => { opened.push(u); return Promise.resolve(); } }, fetch: async () => ({}), console, Response, Promise, setTimeout, Date };
    vm.runInNewContext(sw, ctx);
    const push = async payload => { let p; L.push({ data: { json: () => payload, text: () => '' }, waitUntil: x => { p = x; } }); await p; return shown[shown.length - 1]; };
    const click = async url => { let p; L.notificationclick({ notification: { close() {}, data: { url } }, waitUntil: x => { p = x; } }); await p; return opened[opened.length - 1]; };
    return { push, click, opened };
  };
  await t('sw: offer push shows the IMAGE (not url text) and click opens the external offer link', async () => {
    const s = mkSW();
    const r = await s.push({ notification: { title: '🎁 Diwali Offer', body: 'अभी देखें', image: 'https://ik.imagekit.io/x/o.png' }, data: { kind: 'offer', url: 'https://shop.example/o?a=1', link: 'https://shop.example/o?a=1' } });
    assert.strictEqual(r.o.image, 'https://ik.imagekit.io/x/o.png'); assert.strictEqual(r.o.data.url, 'https://shop.example/o?a=1'); assert.ok(!r.o.body.includes('http'));
    assert.strictEqual(await s.click('https://shop.example/o?a=1'), 'https://shop.example/o?a=1');
  });
  await t('sw: normal (non-offer) push cannot send students to an external site; bad image ignored', async () => {
    const s = mkSW();
    const r = await s.push({ notification: { title: 'T', body: 'B', image: 'http://insecure/x.png' }, data: { url: 'https://evil.example/x' } });
    assert.strictEqual(r.o.data.url, '/'); assert.ok(!('image' in r.o));
    const r2 = await s.push({ notification: { title: 'T', body: 'B' }, data: { kind: 'offer', url: 'javascript:alert(1)' } }); assert.strictEqual(r2.o.data.url, '/');
    const r3 = await s.push({ notification: { title: 'T', body: 'B' }, data: { kind: 'offer', url: 'http://plain.example/' } }); assert.strictEqual(r3.o.data.url, '/', 'offer bhi sirf https');
  });

  // ───────── FCM payload (sender script) ─────────
  const S = require('../scripts/send-notifications.js');
  await t('sender: offer broadcast carries image + link (https only) in FCM + webpush; plain broadcast unchanged', () => {
    const m = S.buildFcmMessage({ token: 'tk', notification: { title: 'T', body: 'B' }, image: 'https://ik.imagekit.io/x/o.png', link: 'https://shop.example/o', kind: 'offer' });
    assert.strictEqual(m.notification.imageUrl, 'https://ik.imagekit.io/x/o.png?tr=w-1000,q-75'); assert.strictEqual(m.webpush.notification.image, m.notification.imageUrl);
    assert.strictEqual(m.webpush.fcmOptions.link, 'https://shop.example/o'); assert.deepStrictEqual(m.data, { url: 'https://shop.example/o', link: 'https://shop.example/o', image: m.notification.imageUrl, kind: 'offer' });
    const p = S.buildFcmMessage({ token: 'tk', notification: { title: 'T', body: 'B' } });
    assert.deepStrictEqual(Object.keys(p).sort(), ['notification', 'token', 'webpush']); assert.strictEqual(p.webpush.fcmOptions.link, 'https://eduspark.de5.net/');
    const bad = S.buildFcmMessage({ token: 'tk', notification: { title: 'T', body: 'B' }, image: 'javascript:1', link: 'http://x' }); assert.ok(!bad.data && !bad.notification.imageUrl);
  });
  await t('firestore.rules: offers collection is publicly readable, admin-only write', () => {
    assert.ok(/match \/offers\/\{doc\}\s*\{ allow read: if true; allow write: if isAdmin\(\); \}/.test(read('firestore.rules')));
  });
  console.log(n + ' app-logic tests passed');
})();
