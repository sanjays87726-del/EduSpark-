import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { start, launch } from './serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const srv = await start();
const BASE = srv.url + 'ops-portal-7c91e4.html';
const FAKE = fs.readFileSync(path.join(HERE, 'fakefb.js'), 'utf8');
const SUPER = 'bhupeshkumar36882@gmail.com';
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };

async function newPage(browser, { viewport = { width: 1280, height: 900 }, seed = '' } = {}) {
  const ctx = await browser.newContext({ viewport }); const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const log = { gate: [], verify: [], agg: 0 };
  await page.route('**/*', async route => {
    const u = route.request().url();
    if (u.includes('firebase-app-compat')) return route.fulfill({ contentType: 'text/javascript', body: FAKE + '\n' + seed });
    if (u.includes('firebase-auth-compat') || u.includes('firebase-firestore-compat')) return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (u.startsWith(srv.url.slice(0, -1))) return route.continue();
    if (u.includes('workers.dev')) {
      const m = route.request().method(), url = new URL(u);
      if (m === 'GET') return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ version: 11, ADMIN_PASS: true, PASS_STAFF: true, sections: { users: true, academic: false, courses: false, questions: false, exams: false, results: false, finance: true, comms: false, media: false, support: false, system: true, reports: true } }) });
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const body = JSON.parse(route.request().postData() || '{}'); const h = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
      if (url.pathname === '/admin-gate') { log.gate.push(body); const exp = Date.now() + 3600e3;
        if (!body.section && body.password === 'MASTER') return route.fulfill({ headers: h, body: JSON.stringify({ gate: exp + '.aa', scope: 'master', exp }) });
        if (!body.section && body.password === 'STAFFPW') return route.fulfill({ headers: h, body: JSON.stringify({ gate: exp + '.bb', scope: 'staff', exp }) });
        if (body.section && (body.password === 'MASTER' || body.password === 'SEC-' + body.section)) return route.fulfill({ headers: h, body: JSON.stringify({ gate: exp + '.cc', scope: body.section, exp }) });
        return route.fulfill({ status: 401, headers: h, body: JSON.stringify({ error: 'गलत password' }) }); }
      if (url.pathname === '/admin-verify') { log.verify.push(body); return route.fulfill({ headers: h, body: JSON.stringify({ ok: true }) }); }
    }
    if (u.includes('runAggregationQuery')) { log.agg++; const b = JSON.parse(route.request().postData()); const coll = b.structuredAggregationQuery.structuredQuery.from[0].collectionId; return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ result: { aggregateFields: { n: { integerValue: coll === 'students' ? '42' : '7' } } } }]) }); }
    return route.abort();
  });
  return { page, errors, log, ctx };
}
const SEED = `
(function(){ const ts=window.__ts, D=window.__DB, now=Date.now();
 D['students/s1']={name:'Aman Verma',username:'aman',usernameLower:'aman',email:'aman@gmail.com',board:'CBSE-10',lastActive:ts(now-3600e3),createdAt:'2026-11-19T08:00:00.000Z',fcmToken:'tok1'};
 D['students/s2']={name:'=HYPERLINK("x")',username:'bobby',usernameLower:'bobby',email:'bob@gmail.com',board:'BSER-12',lastActive:ts(now-9*86400e3)};
 D['content/c1']={title:'Maths Ch1 Notes',board:'CBSE-10',subject:'math',type:'pdf',link:'https://x.test/a.pdf',date:'2026-11-18T10:00:00.000Z'};
 D['content/c2']={title:'Draft Video',board:'CBSE-10',subject:'sci',type:'video',link:'https://x.test/v',date:'2026-11-17T10:00:00.000Z',published:false};
 D['staff/teacher@gmail.com']={role:'teacher',active:true,name:'T Sir'};
 D['staff/off@gmail.com']={role:'editor',active:false};
 D['notificationState/lastRun']={at:ts(now-50*3600e3),istDate:'2026-11-18',results:[{slot:'morning',sent:0}]};
 D['_config/app']={appName:'',maintenance:{on:false,message:''},rev:2};
})();`;

const browser = await launch();

console.log('— A) Super Admin: gate → Google → dashboard → locked section → students → block → logs');
{
  const { page, errors, log } = await newPage(browser, { seed: SEED });
  page.on('dialog', d => d.accept());
  await page.goto(BASE); await page.waitForSelector('#gate', { state: 'visible' });
  ok(await page.isVisible('#gatePass'), 'gate shows password box first');
  await page.fill('#gatePass', 'WRONG'); await page.click('#gateUnlockBtn'); await page.waitForTimeout(150);
  ok(await page.isVisible('#gatePass'), 'wrong password keeps gate closed');
  await page.fill('#gatePass', 'MASTER'); await page.click('#gateUnlockBtn'); await page.waitForTimeout(200);
  ok(await page.isVisible('#gateGoogleBtn'), 'after master password → Google button');
  await page.evaluate(e => window.__signIn(e), SUPER); await page.waitForSelector('#adminApp', { state: 'visible' });
  await page.waitForSelector('#dashCards .cd');
  ok((await page.locator('#sideNav .ngk').allTextContents()).join('') === 'ABCDEFGHIJKLM', 'menu has groups A..M in order');
  ok((await page.textContent('#tbRole')) === 'Super Admin', 'role chip = Super Admin');
  ok((await page.textContent('#dashCards')).includes('42'), 'dashboard shows aggregated student count (42)');
  ok(log.verify.length >= 1, 'entry token verified with Worker');
  // locked section → modal
  await page.click('#sideNav .ni[data-go="students"]'); await page.waitForSelector('#v2Modal.open');
  ok((await page.textContent('#v2ModalBody')).includes('User Management'), 'Users section asks for its password');
  await page.fill('#secPw', 'nope'); await page.click('#secGo'); await page.waitForTimeout(150);
  ok((await page.textContent('#secErr')).includes('गलत'), 'wrong section password → error shown, still locked');
  await page.fill('#secPw', 'SEC-users'); await page.click('#secGo'); await page.waitForSelector('#stList .srow');
  ok((await page.locator('#stList .srow').count()) === 2, 'students list renders (2 rows)');
  ok(await page.isVisible('#aTab_students'), 'students panel visible after unlock');
  // open student, block
  await page.click('#stList .srow >> nth=0'); await page.waitForSelector('#v2Modal.open');
  await page.fill('#stReason', 'spam'); await page.click('[data-v2="stBlock"]'); await page.waitForTimeout(200);
  const db = await page.evaluate(() => window.__DB);
  ok(db['blockedUsers/' + Object.keys(db).filter(k => k.startsWith('students/'))[0].split('/')[1]] !== undefined || Object.keys(db).some(k => k.startsWith('blockedUsers/')), 'blockedUsers doc written');
  const logs = Object.keys(db).filter(k => k.startsWith('adminLogs/')).map(k => db[k]);
  ok(logs.some(l => l.action === 'login'), 'activity log: login recorded');
  ok(logs.some(l => l.action === 'unlock' && l.section === 'users'), 'activity log: section unlock recorded');
  ok(logs.some(l => l.action === 'set:blockedUsers' && l.section === 'users'), 'activity log: block write auto-recorded by audit wrapper');
  ok(logs.every(l => l.by === SUPER && !JSON.stringify(l).includes('spam')), 'logs carry only field names (no student data / reason text)');
  // unblock via blocked filter
  await page.click('[data-v2="mClose"]').catch(() => {});
  await page.screenshot({ path: path.join(HERE, 'out-admin-students.png') });
  // settings: announcement save → _config/app
  await page.click('#sideNav .ni[data-go="settings"]'); await page.waitForSelector('#v2Modal.open'); await page.fill('#secPw', 'SEC-system'); await page.click('#secGo'); await page.waitForSelector('#aTab_settings', { state: 'visible' });
  await page.check('#cfgAnnOn'); await page.fill('#cfgAnnText', 'Test announcement'); await page.click('[data-v2="cfgSave"]'); await page.waitForTimeout(300);
  const cfg = await page.evaluate(() => window.__DB['_config/app']);
  ok(cfg.announcement && cfg.announcement.on === true && cfg.announcement.text === 'Test announcement' && cfg.rev === 3, 'settings saved to _config/app (rev bumped)');
  // minVersion higher than live is refused
  await page.fill('#cfgMinVer', '9.0.0'); await page.click('[data-v2="cfgSave"]'); await page.waitForTimeout(400);
  const cfg2 = await page.evaluate(() => window.__DB['_config/app']);
  ok(cfg2.rev === 3 && !cfg2.minVersion, 'minVersion above live app version is refused');
  // notification health
  await page.click('#sideNav .ni[data-go="notifyhealth"]'); await page.waitForSelector('#nhBody .hint'); await page.waitForTimeout(300);
  ok((await page.textContent('#nhBody')).includes('GitHub Actions'), 'notification health page renders diagnosis');
  // courses publish toggle
  await page.click('#sideNav .ni[data-go="courses"]'); await page.waitForSelector('#coList .mgmt-item');
  ok((await page.locator('#coList .mgmt-item').count()) === 2, 'courses list shows live + draft');
  await page.click('[data-v2="togglePub"][data-id="c2"]'); await page.waitForTimeout(200);
  ok((await page.evaluate(() => window.__DB['content/c2'].published)) === true, 'publish toggle writes published:true');
  // reports csv: injection-safe
  await page.click('#sideNav .ni[data-go="reports"]'); await page.waitForSelector('#modal-nonexistent', { timeout: 200 }).catch(() => {});
  if (await page.isVisible('#v2Modal.open')) { await page.fill('#secPw', 'SEC-reports'); await page.click('#secGo'); }
  await page.waitForSelector('#aTab_reports', { state: 'visible' });
  await page.click('[data-v2="rp:content"]'); await page.waitForSelector('#rpOut table');
  ok((await page.locator('#rpOut tr').count()) === 3, 'content report table rendered (header + 2 rows)');
  // lock now → relock
  await page.click('.tb-btn'); await page.waitForTimeout(200);
  ok(await page.isVisible('#aTab_dash'), 'lock-now returns to dashboard when current section becomes locked');
  await page.screenshot({ path: path.join(HERE, 'out-admin-dash.png') });
  ok(errors.length === 0, 'no JS errors in super-admin flow' + (errors.length ? ' → ' + errors.join(' | ') : ''));
}

console.log('— B) Staff (teacher): staff password, limited menu, no student/staff pages');
{
  const { page, errors } = await newPage(browser, { seed: SEED });
  await page.goto(BASE); await page.waitForSelector('#gatePass');
  await page.fill('#gatePass', 'STAFFPW'); await page.click('#gateUnlockBtn'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__signIn('teacher@gmail.com')); await page.waitForSelector('#adminApp', { state: 'visible' });
  await page.waitForTimeout(300);
  ok((await page.textContent('#tbRole')) === 'Teacher', 'role chip = Teacher');
  const items = await page.locator('#sideNav .ni').allTextContents();
  ok(items.some(t => t.includes('Student Doubts')) && items.some(t => t.includes('All Courses')), 'teacher sees doubts + courses');
  ok(!items.some(t => t.includes('All Students')) && !items.some(t => t.includes('Staff')) && !items.some(t => t.includes('Settings')) && !items.some(t => t.includes('Soon')), 'teacher does NOT see students/staff/settings/placeholder pages');
  await page.evaluate(() => window.go('students')); await page.waitForTimeout(200);
  ok(!(await page.isVisible('#aTab_students')), 'direct go("students") is refused for teacher');
  ok(errors.length === 0, 'no JS errors in staff flow' + (errors.length ? ' → ' + errors.join(' | ') : ''));
}
console.log('— C) Inactive staff and strangers are denied; master password with staff account is rejected');
{
  const { page } = await newPage(browser, { seed: SEED });
  await page.goto(BASE); await page.waitForSelector('#gatePass'); await page.fill('#gatePass', 'MASTER'); await page.click('#gateUnlockBtn'); await page.waitForTimeout(200);
  await page.evaluate(() => window.__signIn('off@gmail.com')); await page.waitForTimeout(400);
  ok(!(await page.isVisible('#adminApp')), 'inactive staff cannot enter');
  await page.evaluate(() => window.__signIn('stranger@gmail.com')); await page.waitForTimeout(300);
  ok(!(await page.isVisible('#adminApp')), 'unknown google account cannot enter');
  await page.evaluate(() => window.__signIn('teacher@gmail.com')); await page.waitForTimeout(500);
  ok(!(await page.isVisible('#adminApp')), 'staff account with MASTER-scope token is bounced back to gate (needs staff password)');
}
console.log('— D) Mobile: drawer menu');
{
  const { page, errors } = await newPage(browser, { viewport: { width: 390, height: 800 }, seed: SEED });
  await page.goto(BASE); await page.waitForSelector('#gatePass'); await page.fill('#gatePass', 'MASTER'); await page.click('#gateUnlockBtn'); await page.waitForTimeout(200);
  await page.evaluate(e => window.__signIn(e), SUPER); await page.waitForSelector('#dashCards .cd');
  ok(!(await page.locator('#sideNav').evaluate(el => el.classList.contains('open'))), 'drawer closed by default on phone');
  await page.click('.menu-btn'); await page.waitForTimeout(350);
  ok(await page.locator('#sideNav').evaluate(el => el.classList.contains('open')), 'drawer opens with ☰');
  await page.screenshot({ path: path.join(HERE, 'out-admin-mobile.png') });
  await page.click('#sideNav .ni[data-go="add"]'); await page.waitForTimeout(300);
  ok(await page.isVisible('#aTab_add') && !(await page.locator('#sideNav').evaluate(el => el.classList.contains('open'))), 'choosing an item shows the old Add tab and closes the drawer');
  ok(errors.length === 0, 'no JS errors on mobile' + (errors.length ? ' → ' + errors.join(' | ') : ''));
}
await browser.close(); srv.close();
console.log(failed ? '\n' + failed + ' SMOKE CHECK(S) FAILED' : '\nall admin smoke checks passed');
process.exit(failed ? 1 : 0);
