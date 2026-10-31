// Login overlay: crawlers (no touch/scroll) must see the real app; installed app and real visitors still get the login screen.
const assert = require('assert');
const { read, between } = require('./helpers/extract');
const html = read('index.html');
const src = between(html, '// Login screen kab khule:', '// Login page (pehli baar');
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };
function env({ standalone = false, skipTs = null } = {}) {
  const ls = {}; if (skipTs) ls.es_login_skip_ts = String(skipTs);
  const listeners = {}; const timers = []; let shown = 0, hidden = 0;
  const win = { navigator: {}, matchMedia: q => ({ matches: standalone && /standalone/.test(q) }),
    addEventListener: (e, f) => { (listeners[e] = listeners[e] || []).push(f); }, removeEventListener: (e, f) => { listeners[e] = (listeners[e] || []).filter(x => x !== f); } };
  const el = { style: { display: 'flex' } };
  const api = new Function('window', 'matchMedia', 'document', 'localStorage', 'setTimeout', 'showLoginPage', 'closeGoogleSheet',
    src + '; return {autoShowLogin, skipLoginPage};')(win, win.matchMedia, { referrer: '', getElementById: () => el }, { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
    (f, ms) => { timers.push([f, ms]); }, () => { shown++; }, () => {});
  return { api, listeners, timers, ls, el, get shown() { return shown; } };
}
(async () => {
  await t('crawler (no interaction): login overlay never opens', async () => {
    const e = env(); e.api.autoShowLogin(); e.api.autoShowLogin();
    assert.strictEqual(e.shown, 0); assert.strictEqual(e.timers.length, 0);
  });
  await t('installed app / TWA: opens immediately, once', async () => {
    const e = env({ standalone: true }); e.api.autoShowLogin(); e.api.autoShowLogin();
    assert.strictEqual(e.shown, 1);
  });
  await t('browser visitor: first touch/scroll opens it (after short delay), once', async () => {
    const e = env(); e.api.autoShowLogin();
    e.listeners.pointerdown[0](); e.listeners.pointerdown.length && null;
    e.timers.forEach(([f]) => f()); assert.strictEqual(e.shown, 1);
    e.api.autoShowLogin(); assert.strictEqual(e.shown, 1);
  });
  await t('"Skip for now": hides overlay and stays quiet for 3 days, then asks again', async () => {
    const e = env(); e.api.skipLoginPage();
    assert.strictEqual(e.el.style.display, 'none'); assert.ok(e.ls.es_login_skip_ts);
    const quiet = env({ standalone: true, skipTs: Date.now() - 3600e3 }); quiet.api.autoShowLogin(); assert.strictEqual(quiet.shown, 0);
    const later = env({ standalone: true, skipTs: Date.now() - 4 * 86400e3 }); later.api.autoShowLogin(); assert.strictEqual(later.shown, 1);
  });
  await t('boot code no longer calls showLoginPage() directly on first visit', async () => {
    assert.ok(!/setTimeout\(\(\)=>\{ showLoginPage\(\); \},500\)/.test(html));
    assert.ok(!/if\(!profile\)\{\s*showLoginPage\(\);/.test(html));
  });
  console.log(n + ' login-wall tests passed');
})();
