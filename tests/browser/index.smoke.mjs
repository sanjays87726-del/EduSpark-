import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { start, launch } from './serve.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const srv = await start();
const BASE = srv.url + 'index.html';
const FAKE = fs.readFileSync(path.join(HERE, 'fakefb.js'), 'utf8');
let failed = 0; const ok = (c, m) => { if (!c) { failed++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const browser = await launch();

async function open({ seed = '', preload = '', viewport = { width: 400, height: 820 } } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' }); const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(preload);
  // first-run popups (notification ask / board chooser) test ke raste me na aayein
  await page.addInitScript("document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('style');s.textContent='#notifAsk,#boardSel{display:none!important}';document.head.appendChild(s);});");
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.includes('firebase-app-compat')) return route.fulfill({ contentType: 'text/javascript', body: FAKE + '\n' + seed + '\nfirebase.messaging = function(){ return { getToken: async()=>"t", deleteToken: async()=>true, onMessage(){ } }; }; firebase.messaging.isSupported=()=>false;' });
    if (/firebase-(auth|firestore|messaging)-compat/.test(u)) return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (u.startsWith(srv.url.slice(0, -1))) return route.continue();
    return route.abort();
  });
  return { page, errors };
}
const profile = JSON.stringify({ name: 'Aman', username: 'aman', board: 'CBSE-10', date: '2026-11-01T00:00:00.000Z' });

console.log('— 1) Home top bar: dark-mode icon removed, Profile keeps its toggle');
{
  const { page, errors } = await open({ preload: `localStorage.setItem('es_student', '${profile}'); localStorage.setItem('es_onboarded','1');` });
  await page.goto(BASE); await page.waitForSelector('#splash', { state: 'hidden', timeout: 15000 }).catch(()=>{}); await page.waitForTimeout(300); await page.evaluate(()=>{ ['notifAsk','boardSel'].forEach(i=>{ const e=document.getElementById(i); if(e) e.classList.remove('show'); }); });
  ok((await page.locator('#tbTheme').count()) === 0, 'no #tbTheme in the Home top bar');
  ok((await page.locator('#themeToggle').count()) === 1, 'Profile still has the dark-mode switch');
  await page.evaluate(() => onThemeToggle(true)); ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', 'dark mode still works from Profile');
  ok(errors.length === 0, 'no JS errors at boot' + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));
}

console.log('— 2) Signed-in student: Home sign-in button + login wall hidden (even if something after it throws)');
{
  // pehle wala bug: auth callback ke andar koi call throw kare to button dikhta rehta tha — ek call jaan-bujhkar tod rahe hain
  const { page, errors } = await open({ preload: `localStorage.setItem('es_student', '${profile}');` });
  await page.goto(BASE); await page.waitForSelector('#splash', { state: 'hidden', timeout: 15000 }).catch(()=>{}); await page.waitForTimeout(300); await page.evaluate(()=>{ ['notifAsk','boardSel'].forEach(i=>{ const e=document.getElementById(i); if(e) e.classList.remove('show'); }); });
  ok(await page.isVisible('#googleLoginBtn'), 'signed-out: Home shows the Sign-in button');
  await page.evaluate(() => { window.renderNotifPermCard = function(){ throw new Error('boom'); }; window.listenDoubts = function(){ throw new Error('boom2'); }; window.__signIn('stu@gmail.com', 'uid1'); });
  await page.waitForTimeout(600);
  ok(!(await page.isVisible('#googleLoginBtn')), 'signed-in: Home Sign-in button hidden even though later calls throw');
  ok((await page.evaluate(() => document.documentElement.classList.contains('es-authed'))), 'es-authed class set');
  ok((await page.evaluate(() => localStorage.getItem('es_authed_hint'))) === '1', 'hint stored for next launch (no flash)');
  await page.evaluate(() => { showLoginPage(); });
  ok(!(await page.isVisible('#studentSetup')), 'showLoginPage() is a no-op for a signed-in student');
  // sign-out brings button back
  await page.evaluate(() => window.firebase.auth().signOut()); await page.waitForTimeout(400);
  ok(await page.isVisible('#googleLoginBtn') || (await page.evaluate(() => document.getElementById('googleLoginBtn').style.display)) !== 'none', 'after sign-out the button is back');
}
{
  // returning student: hint se pehle paint par hi chhupa
  const { page } = await open({ preload: `localStorage.setItem('es_student','${profile}'); localStorage.setItem('es_authed_hint','1');` });
  await page.goto(BASE); await page.waitForTimeout(80);
  ok(!(await page.isVisible('#googleLoginBtn')), 'with the hint, the button is not painted before auth restores');
}

console.log('— 3) Notification page: back button works (also after tapping the bell again on the page)');
{
  const { page } = await open({ preload: `localStorage.setItem('es_student','${profile}'); localStorage.setItem('es_onboarded','1');` });
  await page.goto(BASE); await page.waitForSelector('#splash', { state: 'hidden', timeout: 15000 }).catch(()=>{}); await page.waitForTimeout(300); await page.evaluate(()=>{ ['notifAsk','boardSel'].forEach(i=>{ const e=document.getElementById(i); if(e) e.classList.remove('show'); }); });
  const active = () => page.evaluate(() => (document.querySelector('.page.active') || {}).id);
  ok((await active()) === 'pageHome', 'starts on Home');
  await page.click('#tbBell'); ok((await active()) === 'pageNotifications', 'bell opens notifications');
  await page.click('#tbBell'); await page.click('#tbBell');          // bell dobara dabaane par pehle "wapas" khud par hi ban jaata tha
  ok((await active()) === 'pageNotifications', 'still on notifications after extra bell taps');
  await page.click('#pageNotifications .pf-back, #pageNotifications [onclick*="closeNotificationsPage"]');
  ok((await active()) === 'pageHome', 'back button returns to Home (was stuck before)');
  await page.evaluate(() => { openProfilePage(); openProfilePage(); }); ok((await active()) === 'pageProfile', 'profile opens'); await page.evaluate(() => closeProfilePage()); ok((await active()) === 'pageHome', 'profile back works after double-open');
}

console.log('— 4) Remote config: maintenance / force update / announcement / brand / block screen');
{
  const { page, errors } = await open({ preload: `localStorage.setItem('es_student','${profile}'); localStorage.setItem('es_onboarded','1');` });
  await page.goto(BASE); await page.waitForSelector('#splash', { state: 'hidden', timeout: 15000 }).catch(()=>{}); await page.waitForTimeout(300); await page.evaluate(()=>{ ['notifAsk','boardSel'].forEach(i=>{ const e=document.getElementById(i); if(e) e.classList.remove('show'); }); });
  const vis = id => page.evaluate(i => { const e = document.getElementById(i); return !!e && getComputedStyle(e).display !== 'none'; }, id);
  await page.evaluate(() => applyRemoteConfig({ maintenance: { on: true, message: 'Kaam chal raha hai' } }));
  ok(await vis('rcMaint') && (await page.textContent('#rcMaint')).includes('Kaam chal raha hai'), 'maintenance ON shows the full-screen message');
  await page.evaluate(() => applyRemoteConfig({ maintenance: { on: false } })); ok(!(await vis('rcMaint')), 'maintenance OFF hides it live');
  const ver = await page.evaluate(() => ES.version);
  await page.evaluate(() => applyRemoteConfig({ minVersion: '99.0.0', updateMessage: 'Update karo' })); ok(await vis('rcUpdate'), 'minVersion above app version → update screen');
  await page.evaluate(v => applyRemoteConfig({ minVersion: v }), ver); ok(!(await vis('rcUpdate')), 'minVersion == app version → no update screen (' + ver + ')');
  await page.evaluate(() => applyRemoteConfig({ announcement: { on: true, text: 'Naye tests aa gaye', id: 'a1', link: 'javascript:alert(1)' } }));
  ok(await vis('rcAnn') && (await page.textContent('#rcAnn')).includes('Naye tests aa gaye'), 'announcement bar shows');
  ok((await page.evaluate(() => { const t = document.getElementById('rcAnnTx'); return typeof t.onclick; })) === 'object', 'non-https announcement link is NOT clickable');
  await page.evaluate(() => document.querySelector('#rcAnn button').click()); ok(!(await vis('rcAnn')), 'dismiss hides the bar');
  await page.evaluate(() => applyRemoteConfig({ announcement: { on: true, text: 'Naye tests aa gaye', id: 'a1' } })); ok(!(await vis('rcAnn')), 'same announcement id stays dismissed');
  await page.evaluate(() => applyRemoteConfig({ announcement: { on: true, text: 'Doosra notice', id: 'a2' } })); ok(await vis('rcAnn'), 'new announcement id shows again');
  await page.evaluate(() => applyRemoteConfig({ appName: '<img src=x onerror=alert(1)>Spark' })); ok((await page.textContent('.tb-brand')).includes('<img') && (await page.locator('.tb-brand img').count()) === 0, 'app name is inserted as text (no HTML injection)');
  await page.evaluate(() => applyRemoteConfig({})); ok((await page.textContent('.tb-brand')).replace(/\s/g, '') === 'EduSpark', 'empty config restores the default brand');
  // block screen
  await page.evaluate(() => { window.__DB['blockedUsers/uid9'] = { reason: 'spam' }; window.__signIn('b@gmail.com', 'uid9'); }); await page.waitForTimeout(500);
  ok(await vis('rcBlocked') && (await page.textContent('#rcBlocked')).includes('spam'), 'blocked student sees the block screen with reason');
  // block hata do aur doosre user se
  await page.evaluate(() => { window.__signIn('ok@gmail.com', 'uid10'); }); await page.waitForTimeout(400);
  ok(!(await vis('rcBlocked')), 'a non-blocked student does not');
  ok(errors.length === 0, 'no JS errors' + (errors.length ? ' → ' + errors.slice(0, 3).join(' | ') : ''));
}
console.log('— 5) Draft (published:false) content is hidden from students');
{
  const seed = `(function(){ const D=window.__DB; D['content/a']={title:'Live note',board:'CBSE-10',subject:'math',type:'pdf',link:'https://x.test/a',date:'2026-11-18T00:00:00.000Z'}; D['content/b']={title:'Hidden draft',board:'CBSE-10',subject:'math',type:'pdf',link:'https://x.test/b',date:'2026-11-19T00:00:00.000Z',published:false}; })();`;
  const { page } = await open({ seed, preload: `localStorage.setItem('es_student','${profile}'); localStorage.setItem('es_board','CBSE-10'); localStorage.setItem('es_onboarded','1');` });
  await page.goto(BASE); await page.waitForSelector('#splash', { state: 'hidden', timeout: 15000 }).catch(()=>{}); await page.waitForTimeout(500); await page.evaluate(()=>{ ['notifAsk','boardSel'].forEach(i=>{ const e=document.getElementById(i); if(e) e.classList.remove('show'); }); });
  const titles = await page.evaluate(() => (typeof allContent !== 'undefined' ? allContent : []).map(c => c.title));
  ok(titles.includes('Live note') && !titles.includes('Hidden draft'), 'allContent has the live item and not the draft (' + JSON.stringify(titles) + ')');
}
await browser.close(); srv.close();
console.log(failed ? '\n' + failed + ' INDEX SMOKE CHECK(S) FAILED' : '\nall index smoke checks passed');
process.exit(failed ? 1 : 0);
