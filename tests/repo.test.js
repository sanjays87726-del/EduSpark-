const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const { check } = require('../tools/check-repo.js');
const ROOT = path.join(__dirname, '..');

// 1) Asli repo ka fixture copy: icons/about/contact jaise binary/aur-pages sirf is test ke liye banao
function fixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'es-repo-'));
  for (const f of ['index.html', 'admin.html', 'privacy.html', 'terms.html', 'delete-account.html', 'sw.js', 'worker.js', 'manifest.json', 'package.json', 'CHANGELOG.md', 'firestore.rules', 'sitemap.xml', 'ads.txt', 'robots.txt']) fs.copyFileSync(path.join(ROOT, f), path.join(d, f));
  fs.mkdirSync(path.join(d, 'scripts/lib'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts'))) if (f.endsWith('.js')) fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(d, 'scripts', f));
  for (const f of fs.readdirSync(path.join(ROOT, 'scripts/lib'))) fs.copyFileSync(path.join(ROOT, 'scripts/lib', f), path.join(d, 'scripts/lib', f));
  fs.mkdirSync(path.join(d, 'deploy/helm/eduspark'), { recursive: true }); fs.mkdirSync(path.join(d, 'deploy/k8s'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'deploy/helm/eduspark/Chart.yaml'), path.join(d, 'deploy/helm/eduspark/Chart.yaml'));
  fs.copyFileSync(path.join(ROOT, 'deploy/k8s/deployment.yaml'), path.join(d, 'deploy/k8s/deployment.yaml'));
  for (const f of ['icon-192.png', 'icon-512.png', 'about.html', 'contact.html']) fs.writeFileSync(path.join(d, f), 'x');
  return d;
}
const w = (d, f, fn) => fs.writeFileSync(path.join(d, f), fn(fs.readFileSync(path.join(d, f), 'utf8')));
const has = (r, re) => r.errors.some(e => re.test(e));

let d = fixture(); let r = check(d);
assert.deepStrictEqual(r.errors, [], 'clean fixture: ' + r.errors.join(' | '));

d = fixture(); w(d, 'index.html', s => s.replace('function showToast(msg){', 'function showToast(msg){ var = ;')); assert.ok(has(check(d), /inline script/), 'broken inline script pakda jaye');
d = fixture(); w(d, 'package.json', s => s.replace('"version": "1.5.0"', '"version": "9.9.9"')); r = check(d); assert.ok(has(r, /version mismatch/) && has(r, /CHANGELOG/) && has(r, /Helm Chart appVersion/) && has(r, /deployment\.yaml image tag/), 'version drift');
d = fixture(); w(d, 'deploy/helm/eduspark/Chart.yaml', s => s.replace('appVersion: "1.5.0"', 'appVersion: "1.4.0"')); r = check(d); assert.ok(has(r, /Helm Chart appVersion \(1\.4\.0\)/) && r.errors.length === 1, 'chart drift only');
d = fixture(); w(d, 'scripts/lib/webhook.js', s => s + '\n}}}'); assert.ok(has(check(d), /webhook\.js: syntax/), 'scripts/lib bhi check hota hai');
d = fixture(); w(d, 'package.json', s => s.replace('"version": "1.5.0"', '"version": "1.4"')); assert.ok(has(check(d), /semver/));
d = fixture(); fs.unlinkSync(path.join(d, 'about.html')); assert.ok(has(check(d), /about\.html/), 'toota link');
d = fixture(); fs.unlinkSync(path.join(d, 'icon-512.png')); assert.ok(has(check(d), /APP_SHELL/), 'shell file missing');
d = fixture(); w(d, 'firestore.rules', s => s.replace('bhupeshkumar36882@gmail.com', 'other@x.com')); assert.ok(has(check(d), /admin email mismatch/));
d = fixture(); w(d, 'manifest.json', s => s + ','); assert.ok(has(check(d), /manifest\.json: invalid JSON/));
d = fixture(); w(d, 'sitemap.xml', s => s.replace('</urlset>', '')); assert.ok(has(check(d), /sitemap/));
d = fixture(); w(d, 'sitemap.xml', s => s.replace('/terms.html', '/missing-page.html')); assert.ok(has(check(d), /missing-page/));
d = fixture(); w(d, 'ads.txt', () => 'garbage'); assert.ok(has(check(d), /ads\.txt/));
d = fixture(); w(d, 'worker.js', s => s + '\n}}}'); assert.ok(has(check(d), /worker\.js: syntax/));
d = fixture(); w(d, 'sw.js', s => s.replace('const CACHE_NAME', 'const CACHE')); assert.ok(has(check(d), /CACHE_NAME/));

// 2) cache-bump guard (asli git repo banakar)
const git = (d, ...a) => require('child_process').execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: d, encoding: 'utf8' });
d = fixture(); git(d, 'init', '-q', '-b', 'main'); git(d, 'add', '.'); git(d, 'commit', '-qm', 'base'); git(d, 'checkout', '-qb', 'feat');
w(d, 'index.html', s => s + '\n<!-- change -->'); git(d, 'commit', '-qam', 'edit');
r = check(d, { base: 'main' }); assert.ok(r.warnings.some(x => /CACHE_NAME/.test(x)) && !r.errors.length, 'warning on same CACHE_NAME');
r = check(d, { base: 'main', strictCache: true }); assert.ok(has(r, /CACHE_NAME/), 'strict => error');
d = fixture();
git(d, 'init', '-q', '-b', 'main');
git(d, 'add', '.');
git(d, 'commit', '-qm', 'base');
git(d, 'checkout', '-qb', 'feat');

const current = (fs.readFileSync(path.join(d, 'sw.js'), 'utf8').match(/CACHE_NAME\s*=\s*"([^"]+)"/) || [])[1];
const next = current.replace(/(\d+)$/, n => String(Number(n) + 1));
w(d, 'sw.js', s => s.replace(current, next));
git(d, 'commit', '-qam', 'bump');

r = check(d, { base: 'main', strictCache: true });
assert.ok(!has(r, /CACHE_NAME/) && !r.warnings.some(x => /CACHE_NAME/.test(x)), 'bumped => ok');
const nextVersion = current.replace(/(\d+)$/, n => String(Number(n) + 1));
w(d, 'sw.js', s => s.replace(current, next));
git(d, 'commit', '-qam', 'bump');
r = check(d, { base: 'main', strictCache: true }); assert.ok(!has(r, /CACHE_NAME/) && !r.warnings.some(x => /CACHE_NAME/.test(x)), 'bumped => ok');
r = check(d, { base: 'no-such-ref' }); assert.ok(r.warnings.some(x => /skip/.test(x)), 'bad base => warning only');
console.log('repo-check tests ✓');
