// Admin panel v2 ke "pure" helper + ops-portal-7c91e4.html / worker.js / firestore.rules / index.html ke beech ka mel (bina browser ke)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const admin = R('ops-portal-7c91e4.html'), worker = R('worker.js'), rules = R('firestore.rules'), app = R('index.html');
let n = 0; const t = (name, fn) => { try { fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };

const block = admin.slice(admin.indexOf('// <pure-helpers>'), admin.indexOf('// </pure-helpers>'));
assert.ok(block.length > 500, 'pure-helpers block not found in ops-portal-7c91e4.html');
const H = new Function(block + '\nreturn { ROLES, SEC_NAMES, TABS, SOON, MENU, canAccess, parseTarget, secOf, itemVisible, secLockState, buildCountBody, fsVal, istDayStart, csvCell, toCsv, validEmail, relTime, auditInfo, logCategory, verNum, SEC_BY_COLL };')();

t('roles: Super Admin sees every tab; teacher/editor/notifier only their own; unknown role nothing', () => {
  for (const tab of Object.keys(H.TABS)) assert.ok(H.canAccess('super', tab), tab);
  assert.ok(H.canAccess('teacher', 'doubts') && H.canAccess('teacher', 'add') && H.canAccess('teacher', 'courses'));
  assert.ok(!H.canAccess('teacher', 'students') && !H.canAccess('teacher', 'staff') && !H.canAccess('teacher', 'settings') && !H.canAccess('teacher', 'reports') && !H.canAccess('teacher', 'logs'));
  assert.ok(H.canAccess('editor', 'quiz') && !H.canAccess('editor', 'doubts') && !H.canAccess('editor', 'notify'));
  assert.ok(H.canAccess('notifier', 'notify') && !H.canAccess('notifier', 'add') && !H.canAccess('notifier', 'students'));
  assert.ok(!H.canAccess('', 'dash') && !H.canAccess('hacker', 'dash') && !H.canAccess('super', 'nope'));
  assert.ok(H.canAccess('notifier', 'dash') && H.canAccess('teacher', 'dash'));
});
t('menu: A..M groups, every item points to a real tab/soon page, placeholders only for Super Admin', () => {
  assert.strictEqual(H.MENU.map(g => g.k).join(''), 'ABCDEFGHIJKLM');
  for (const g of H.MENU) {
    assert.ok(g.sec === null || H.SEC_NAMES[g.sec], 'group sec ' + g.k);
    for (const [target] of g.items) { const p = H.parseTarget(target); if (p.tab === 'soon') assert.ok(H.SOON[p.arg], target); else assert.ok(H.TABS[p.tab], target); }
  }
  assert.ok(H.itemVisible('super', 'soon:results') && !H.itemVisible('teacher', 'soon:results'));
  assert.strictEqual(H.secOf('soon:finance'), 'finance'); assert.strictEqual(H.secOf('students:blocked'), 'users'); assert.strictEqual(H.secOf('dash'), null);
});
t('every tab has its panel in ops-portal-7c91e4.html; every section name matches the Worker secrets list', () => {
  for (const tab of Object.keys(H.TABS)) assert.ok(admin.includes('id="aTab_' + tab + '"'), 'panel aTab_' + tab);
  const ws = /const SECTIONS = \[([^\]]+)\]/.exec(worker)[1].match(/'([a-z]+)'/g).map(x => x.replace(/'/g, ''));
  assert.deepStrictEqual(Object.keys(H.SEC_NAMES).sort(), ws.slice().sort());
  for (const m of Object.values(H.TABS)) assert.ok(m.sec === null || ws.includes(m.sec));
  for (const s of Object.values(H.SOON)) assert.ok(ws.includes(s.sec));
});
t('section lock state: open / unlocked / locked, expired token, unknown status is fail-closed', () => {
  const now = 1000, ok = { u: (now + 5) + '.sig' }, old = { u: (now - 5) + '.sig' };
  assert.strictEqual(H.secLockState({ u: true }, {}, null, now), 'open');
  assert.strictEqual(H.secLockState({ u: false }, {}, 'u', now), 'open');
  assert.strictEqual(H.secLockState({ u: true }, ok, 'u', now), 'unlocked');
  assert.strictEqual(H.secLockState({ u: true }, old, 'u', now), 'locked');
  assert.strictEqual(H.secLockState({ u: true }, {}, 'u', now), 'locked');
  assert.strictEqual(H.secLockState(null, {}, 'u', now), 'locked');            // Worker se status na mile => locked
  assert.strictEqual(H.secLockState(null, ok, 'u', now), 'unlocked');
});
t('Firestore REST count body: single filter, composite AND, null/Date/number values', () => {
  const a = H.buildCountBody('students');
  assert.deepStrictEqual(a, { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'students' }] }, aggregations: [{ alias: 'n', count: {} }] } });
  const b = H.buildCountBody('students', [['fcmToken', '!=', null]]).structuredAggregationQuery.structuredQuery.where;
  assert.deepStrictEqual(b, { fieldFilter: { field: { fieldPath: 'fcmToken' }, op: 'NOT_EQUAL', value: { nullValue: null } } });
  const c = H.buildCountBody('students', [['createdAt', '>=', '2026-11-19T00:00:00.000Z'], ['createdAt', '<', 'x']]).structuredAggregationQuery.structuredQuery.where;
  assert.strictEqual(c.compositeFilter.op, 'AND'); assert.strictEqual(c.compositeFilter.filters.length, 2);
  assert.deepStrictEqual(H.fsVal(new Date('2026-01-01T00:00:00Z')), { timestampValue: '2026-01-01T00:00:00.000Z' });
  assert.deepStrictEqual(H.fsVal(5.9), { integerValue: '5' }); assert.deepStrictEqual(H.fsVal('x'), { stringValue: 'x' }); assert.deepStrictEqual(H.fsVal(true), { booleanValue: true });
});
t('IST day boundaries (UTC+5:30): "aaj" starts 18:30 UTC of the previous day', () => {
  const at = Date.UTC(2026, 10, 19, 20, 0, 0);            // 20 Nov 01:30 IST
  assert.strictEqual(H.istDayStart(0, at), '2026-11-19T18:30:00.000Z');
  assert.strictEqual(H.istDayStart(1, at), '2026-11-18T18:30:00.000Z');
  assert.strictEqual(H.istDayStart(-1, at), '2026-11-20T18:30:00.000Z');
  const noon = Date.UTC(2026, 10, 19, 10, 0, 0);          // 19 Nov 15:30 IST
  assert.strictEqual(H.istDayStart(0, noon), '2026-11-18T18:30:00.000Z');
  assert.strictEqual(H.istDayStart(0, Date.UTC(2026, 10, 19, 18, 29, 59)), '2026-11-18T18:30:00.000Z');   // 23:59:59 IST
  assert.strictEqual(H.istDayStart(0, Date.UTC(2026, 10, 19, 18, 30, 0)), '2026-11-19T18:30:00.000Z');    // 00:00:00 IST naya din
});
t('CSV: Excel formula injection neutralised, quotes/commas/newlines escaped, BOM for Hindi', () => {
  assert.strictEqual(H.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  for (const bad of ['+1', '-2', '@SUM(A1)', '=1+1']) assert.ok(H.csvCell(bad).startsWith("'") || H.csvCell(bad).startsWith('"\''), bad);
  assert.strictEqual(H.csvCell('a,b'), '"a,b"'); assert.strictEqual(H.csvCell('line1\nline2'), '"line1\nline2"'); assert.strictEqual(H.csvCell(null), ''); assert.strictEqual(H.csvCell(0), '0');
  const csv = H.toCsv([{ n: 'राम', b: 'CBSE-10' }, { n: '=cmd', b: 'x' }], [['n', 'name'], [r => r.b.toUpperCase(), 'board']]);
  assert.ok(csv.startsWith('\ufeffname,board\r\n')); assert.ok(csv.includes('राम,CBSE-10')); assert.ok(csv.includes("'=cmd,X"));
});
t('helpers: validEmail, relTime, logCategory, verNum, auditInfo (field names only, never values; adminLogs never logged)', () => {
  assert.ok(H.validEmail('a.b@gmail.com') && !H.validEmail('a@b') && !H.validEmail('x y@z.com') && !H.validEmail('') && !H.validEmail(null));
  assert.strictEqual(H.relTime(0, 5), 'कभी नहीं'); assert.strictEqual(H.relTime(1000, 1000), 'अभी'); assert.ok(H.relTime(0 + 1, 3 * 3600e3 + 1).includes('3 घंटे'));
  assert.strictEqual(H.logCategory('login'), 'login'); assert.strictEqual(H.logCategory('lock'), 'unlock'); assert.strictEqual(H.logCategory('set:students'), 'write');
  assert.ok(H.verNum('1.7.0') > H.verNum('1.6.9') && H.verNum('2') > H.verNum('1.99.99') && H.verNum('1.10.0') > H.verNum('1.9.0'));
  const a = H.auditInfo('set', 'blockedUsers/u1', [{ reason: 'SECRET TEXT', name: 'N' }]);
  assert.deepStrictEqual(a, { action: 'set:blockedUsers', section: 'users', target: 'blockedUsers/u1', detail: 'reason,name' });
  assert.strictEqual(H.auditInfo('delete', 'content/c1', []).detail, ''); assert.strictEqual(H.auditInfo('set', 'adminLogs/x', [{}]), null);
  assert.strictEqual(H.auditInfo('update', 'doubts/d', ['status']).detail, 'status');
});
t('adminLogs: fields the panel writes == fields the rules allow; rules bound `by` to the signed-in email', () => {
  const keys = /request\.resource\.data\.keys\(\)\.hasOnly\(\[([^\]]+)\]\)/.exec(rules.slice(rules.indexOf('match /adminLogs/')))[1].match(/'([a-z]+)'/g).map(x => x.replace(/'/g, ''));
  const rec = admin.slice(admin.indexOf('function logRecord'), admin.indexOf('function logActAsync'));
  for (const k of keys) assert.ok(new RegExp('\\b' + k + ':').test(rec), 'logRecord missing ' + k);
  assert.ok(rules.includes('request.resource.data.by == request.auth.token.email.lower()'));
  assert.ok(/allow update, delete: if false;/.test(rules.slice(rules.indexOf('match /adminLogs/'))));
});
t('rules: staff roles are narrow (content/quiz/pyq/doubts/queue only), staff & blockedUsers writable only by admin, doubts blocked for blocked users', () => {
  assert.ok(/match \/content\/\{doc\}\s*\{[^}]*isStaff\(\['editor','teacher'\]\)/.test(rules));
  assert.ok(/match \/notificationQueue\/\{doc\}\s*\{[^}]*isStaff\(\['notifier'\]\)/.test(rules));
  assert.ok(!/match \/offers\/[^\n]*isStaff/.test(rules) && !/match \/students\/[^]*?isStaff/.test(rules.slice(rules.indexOf('match /students/'), rules.indexOf('match /staff/'))), 'staff must not reach offers/students');
  assert.ok(/match \/staff\/\{email\}[^]*?allow list, write: if isAdmin\(\)/.test(rules));
  assert.ok(/match \/blockedUsers\/\{uid\}[^]*?allow list, write: if isAdmin\(\)/.test(rules) && /allow get: if request\.auth != null && request\.auth\.uid == uid/.test(rules));
  assert.ok(/allow create: if request\.auth != null\s*&& notBlocked\(\)/.test(rules));
  assert.ok(rules.includes("staffDoc().get('active', false) == true") && rules.includes('email_verified == true'));
  assert.ok(/match \/\{document=\*\*\} \{ allow read, write: if isAdmin\(\); \}/.test(rules));
  assert.ok(rules.includes("'fcmToken','createdAt'") && rules.includes("okStr(d, 'createdAt', 40)"));
});
t('Offers buttons carry the real offer id (old bug: data-id was the literal text `\'+esc(o.id)+\'`)', () => {
  assert.ok(!/data-id="\\'\+esc/.test(admin), 'escaped quote bug is back');
  assert.strictEqual((admin.match(/data-id="'\+esc\(o\.id\)\+'"/g) || []).length, 3);
});
t('student app: no dark-mode icon in top bar, login wall skipped when signed in, back buttons cannot loop to themselves, drafts hidden, remote config + block wired', () => {
  assert.ok(!/id="tbTheme"/.test(app) && /id="themeToggle"/.test(app));
  assert.ok(/function showLoginPage\(\)\{[^]*?if\(auth\.currentUser\) return;/.test(app));
  assert.ok(/if\(curActive && curActive\.id !== 'pageNotifications'\) notifReturnPageId = curActive\.id;/.test(app));
  assert.ok(/back\.id === 'pageNotifications' \|\| back\.id === 'pageProfile'\) back = document\.getElementById\('pageHome'\)/.test(app));
  assert.strictEqual((app.match(/\.filter\(_isPublished\)/g) || []).length, 3);
  assert.ok(/function startRemoteConfig\(\)/.test(app) && /startRemoteConfig\(\);\s*\}catch/.test(app) && /checkBlockedUser\(user\)/.test(app));
  assert.ok(/html\.es-authed #googleLoginBtn\{display:none !important;\}/.test(app));
  assert.ok(/data\.createdAt = profile\.createdAt/.test(app));
});
t('remote config reads only https URLs and writes text with textContent (no innerHTML from config)', () => {
  const rc = app.slice(app.indexOf('function _verNum'), app.indexOf('// PUSH NOTIFICATIONS'));
  assert.ok(rc.length > 1000 && !/innerHTML\s*=\s*(?!tb\._orig)/.test(rc.replace(/tb\.innerHTML = tb\._orig/g, '')), 'innerHTML assignment from config?');
  assert.ok(/_httpsUrl\(c\.logoUrl\)/.test(rc) && /_httpsUrl\(an\.link\)/.test(rc));
});

console.log(`\n${n} admin-v2 tests passed`);
