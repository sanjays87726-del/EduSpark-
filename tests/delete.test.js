const assert = require('assert'); const fs = require('fs');
require('./helpers/load-es.js');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
function grab(name) { const i = html.indexOf('async function ' + name + '('); assert.ok(i > 0); let d = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) { if (html[k] === '{') d++; if (html[k] === '}') { d--; if (d === 0) return html.slice(i, k + 1); } } }
const src = grab('deleteMyAccount');

function env({ nDoubts = 3, failAt = null, username = 'rahul' } = {}) {
  const log = []; const toasts = []; const store = { es_student: JSON.stringify({ name: 'R', username }) };
  const ls = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, clear: () => { for (const k in store) delete store[k]; log.push('ls.clear'); } };
  const docs = Array.from({ length: nDoubts }, (_, i) => ({ ref: { id: 'd' + i } }));
  const db = {
    collection: c => ({
      where: () => ({ get: async () => { log.push('q:' + c); return { docs }; } }),
      doc: id => ({ delete: async () => { if (failAt === c + '/' + id) { failAt = null; throw Object.assign(new Error('x'), { code: 'unavailable' }); } log.push('del:' + c + '/' + id); } })
    }),
    batch: () => { const ops = []; return { delete: r => ops.push(r.id), commit: async () => { log.push('batch:' + ops.join(',')); } }; }
  };
  const user = { uid: 'U1', reauthenticateWithPopup: async () => log.push('reauth'), delete: async () => { if (failAt === 'account') { failAt = null; throw Object.assign(new Error('recent'), { code: 'auth/requires-recent-login' }); } log.push('user.delete'); } };
  const w = {};
  const fn = new Function('confirm', 'prompt', 'document', 'auth', 'db', 'firebase', 'localStorage', 'showToast', 'getStudentDocId', 'DEVICE_ID', 'location', 'setTimeout', 'ES', 'window',
    src + '\nreturn deleteMyAccount;')(() => true, () => 'DELETE', { getElementById: () => ({}) }, { currentUser: user }, db,
    { auth: { GoogleAuthProvider: function () {} }, messaging: () => ({ deleteToken: async () => log.push('token') }) }, ls, m => toasts.push(m), () => 'U1', 'dev_x', { replace: () => {} }, () => {}, globalThis.ES, w);
  return { fn, log, toasts, w };
}
(async () => {
  let e = env({ nDoubts: 3 }); await e.fn();
  assert.deepStrictEqual(e.log, ['reauth', 'q:doubts', 'batch:d0,d1,d2', 'del:usernames/rahul', 'token', 'del:students/U1', 'del:students/dev_x', 'user.delete', 'ls.clear']);
  assert.ok(e.toasts[0].includes('delete हो गया'));

  e = env({ nDoubts: 1000 }); await e.fn();
  assert.strictEqual(e.log.filter(x => x.startsWith('batch:')).length, 3);                         // 1000 doubts -> 3 batches (N+1 nahi)

  e = env({ nDoubts: 0 }); await e.fn(); assert.ok(!e.log.some(x => x.startsWith('batch:')));      // koi doubt nahi -> koi batch nahi

  // 'student' step fail -> step ka naam toast me, localStorage clear NAHI hua, retry me pehle ke steps skip
  e = env({ failAt: 'students/U1' }); await e.fn();
  assert.ok(e.toasts[0].includes('@student'), e.toasts[0]); assert.ok(!e.log.includes('ls.clear') && !e.log.includes('user.delete'));
  assert.deepStrictEqual(e.w._delSaga.done, ['doubts', 'username', 'token']);
  const before = e.log.length; await e.fn();
  const second = e.log.slice(before);
  assert.deepStrictEqual(second, ['reauth', 'del:students/U1', 'del:students/dev_x', 'user.delete', 'ls.clear']);   // doubts/username/token dobara nahi

  // 'account' step fail (recent-login) -> label + retry sirf account
  e = env({ failAt: 'account' }); await e.fn(); assert.ok(e.toasts[0].includes('@account'));
  console.log('delete-account saga tests ✓');
})().catch(x => { console.error(x); process.exit(1); });
