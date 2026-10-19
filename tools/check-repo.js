#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════
// EduSpark — repo checks (CI me chalta hai; local: npm run check)
//   node tools/check-repo.js [--base origin/main] [--strict-cache]
// Kya dekhta hai: HTML ke inline scripts compile hote hain, JS/JSON files sahi hain, internal links maujood hain,
// app-shell files maujood hain, version (package.json = index.html = CHANGELOG), rules ka admin email = admin.html ka,
// aur --base par: app shell badla par sw.js ka CACHE_NAME nahi badla.
// ══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const cp = require('child_process');

function check(root, opts = {}) {
  const errors = [], warnings = [];
  const err = m => errors.push(m), warn = m => warnings.push(m);
  const p = f => path.join(root, f);
  const has = f => fs.existsSync(p(f));
  const read = f => fs.readFileSync(p(f), 'utf8');
  const jsCheck = (file, asModule) => {                         // node --check
    let target = file;
    if (asModule) { target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'es-chk-')), 'm.mjs'); fs.copyFileSync(file, target); }
    const r = cp.spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
    if (r.status !== 0) err(`${path.relative(root, file)}: syntax error\n${(r.stderr || '').split('\n').slice(0, 4).join('\n')}`);
  };

  // 1) HTML inline scripts compile (run nahi hote)
  const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  for (const f of htmlFiles) {
    const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i = 0;
    const html = read(f);
    while ((m = re.exec(html))) {
      if (/\bsrc\s*=/.test(m[1])) continue;
      const type = (m[1].match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
      if (type && !/^(text|application)\/javascript$/i.test(type)) continue;
      i++;
      try { new vm.Script(m[2], { filename: `${f}#script${i}` }); } catch (e) { err(`${f} inline script #${i}: ${e.message}`); }
    }
  }

  // 2) JS files
  for (const f of ['sw.js']) if (has(f)) jsCheck(p(f)); else err(`${f} missing`);
  if (has('worker.js')) jsCheck(p('worker.js'), true);
  for (const dir of ['scripts', 'scripts/lib']) if (has(dir)) for (const f of fs.readdirSync(p(dir)).filter(f => f.endsWith('.js'))) jsCheck(p(dir + '/' + f));

  // 3) JSON
  const json = {};
  for (const f of ['manifest.json', 'package.json', 'firebase.json', 'firestore.indexes.json']) {
    if (!has(f)) { if (f === 'manifest.json' || f === 'package.json') err(`${f} missing`); continue; }
    try { json[f] = JSON.parse(read(f)); } catch (e) { err(`${f}: invalid JSON (${e.message})`); }
  }
  const man = json['manifest.json'];
  if (man) { for (const k of ['name', 'start_url', 'icons']) if (!man[k]) err(`manifest.json: "${k}" missing`); }

  // 4) SEO / ads files
  if (has('sitemap.xml')) {
    const x = read('sitemap.xml');
    if (!/^\s*<\?xml/.test(x) || !/<urlset[\s>]/.test(x) || !/<\/urlset>\s*$/.test(x)) err('sitemap.xml: urlset structure sahi nahi');
    const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    if (!locs.length) err('sitemap.xml: koi <loc> nahi');
    for (const l of locs) { if (!/^https:\/\/[^/]+\//.test(l)) err(`sitemap.xml: ${l} https URL nahi`); }
    for (const l of locs) { const pg = l.replace(/^https:\/\/[^/]+\//, ''); if (pg && !has(pg)) err(`sitemap.xml: ${l} — file "${pg}" repo me nahi`); }
  }
  if (has('ads.txt') && !/^[a-z0-9.-]+,\s*pub-\d+,\s*(DIRECT|RESELLER)/im.test(read('ads.txt'))) err('ads.txt: format galat (domain, pub-ID, DIRECT)');
  if (has('robots.txt') && !/^Sitemap:\s*https?:\/\//im.test(read('robots.txt'))) warn('robots.txt me Sitemap: line nahi');

  // 5) Internal links + service-worker app shell
  const linkRe = /(?:href|src)\s*=\s*["'](\/[a-zA-Z0-9_\-./]+\.(?:html|png|json|js|xml|txt))["']/g;
  const openRe = /openLegal\(\s*['"](\/[a-zA-Z0-9_\-./]+\.html)['"]/g;
  for (const f of htmlFiles) {
    const html = read(f); const seen = new Set();
    for (const re of [linkRe, openRe]) for (const m of html.matchAll(re)) {
      const target = m[1].slice(1);
      if (seen.has(target)) continue; seen.add(target);
      if (!has(target)) err(`${f}: link "${m[1]}" ki file repo me nahi hai`);
    }
  }
  let cacheName = null;
  if (has('sw.js')) {
    const sw = read('sw.js');
    cacheName = (sw.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/) || [])[1] || null;
    if (!cacheName) err('sw.js: CACHE_NAME nahi mila');
    const shell = (sw.match(/APP_SHELL\s*=\s*\[([^\]]*)\]/) || [])[1] || '';
    for (const m of shell.matchAll(/["'](\/[^"']*)["']/g)) { const t = m[1] === '/' ? 'index.html' : m[1].slice(1); if (!has(t)) err(`sw.js APP_SHELL: "${m[1]}" repo me nahi (offline shell tootega)`); }
  }

  // 6) Version consistency
  const pkgV = json['package.json'] && json['package.json'].version;
  if (has('index.html')) {
    const iv = (read('index.html').match(/ES\.version\s*=\s*'(\d+\.\d+\.\d+)'/) || [])[1];
    if (!iv) err('index.html: ES.version nahi mila');
    else if (pkgV && iv !== pkgV) err(`version mismatch: package.json=${pkgV}, index.html ES.version=${iv}`);
  }
  if (pkgV && has('deploy/helm/eduspark/Chart.yaml')) {
    const av = (read('deploy/helm/eduspark/Chart.yaml').match(/^appVersion:\s*"?(\d+\.\d+\.\d+)"?/m) || [])[1];
    if (av !== pkgV) err(`Helm Chart appVersion (${av}) != package.json (${pkgV})`);
  }
  if (pkgV && has('deploy/k8s/deployment.yaml')) {
    const tag = (read('deploy/k8s/deployment.yaml').match(/image:\s*\S+:(\d+\.\d+\.\d+)\s*$/m) || [])[1];
    if (tag !== pkgV) err(`deploy/k8s/deployment.yaml image tag (${tag}) != package.json (${pkgV})`);
  }
  if (pkgV) {
    if (!/^\d+\.\d+\.\d+$/.test(pkgV)) err(`package.json version "${pkgV}" semver (MAJOR.MINOR.PATCH) nahi`);
    if (has('CHANGELOG.md') ? !new RegExp('^## \\[' + pkgV.replace(/\./g, '\\.') + '\\]', 'm').test(read('CHANGELOG.md')) : true) err(`CHANGELOG.md me "## [${pkgV}]" section nahi`);
  }

  // 7) Admin email: firestore.rules == admin.html (drift se admin lock ho sakta hai)
  if (has('firestore.rules') && has('admin.html')) {
    const r = (read('firestore.rules').match(/token\.email\s*==\s*"([^"]+)"/) || [])[1];
    const a = (read('admin.html').match(/ADMIN_EMAIL\s*=\s*"([^"]+)"/) || [])[1];
    if (!r || !a) err('ADMIN email firestore.rules ya admin.html me nahi mila');
    else if (r !== a) err(`admin email mismatch: rules=${r}, admin.html=${a}`);
    if (!/rules_version\s*=\s*'2'/.test(read('firestore.rules'))) err("firestore.rules: rules_version = '2' nahi");
  }

  // 8) App shell badla par CACHE_NAME nahi badla (git base ke saath)
  if (opts.base && cacheName) {
    const git = args => cp.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    const diff = git(['diff', '--name-only', opts.base + '...HEAD']);
    const baseSw = git(['show', opts.base + ':sw.js']);
    if (diff.status !== 0 || baseSw.status !== 0) warn(`cache-bump check skip (git base "${opts.base}" nahi mila)`);
    else {
      const shellFiles = ['index.html', 'manifest.json', 'privacy.html', 'terms.html', 'delete-account.html'];
      const changed = diff.stdout.split('\n').filter(f => shellFiles.includes(f));
      const baseName = (baseSw.stdout.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/) || [])[1];
      if (changed.length && baseName === cacheName) {
        (opts.strictCache ? err : warn)(`${changed.join(', ')} badle par sw.js ka CACHE_NAME ("${cacheName}") wahi hai — students ko "नया version" toast nahi milega`);
      }
    }
  }
  return { errors, warnings };
}

module.exports = { check };

if (require.main === module) {
  const a = process.argv.slice(2);
  const opts = { base: a.includes('--base') ? a[a.indexOf('--base') + 1] : null, strictCache: a.includes('--strict-cache') };
  const { errors, warnings } = check(path.join(__dirname, '..'), opts);
  const gh = !!process.env.GITHUB_ACTIONS;
  warnings.forEach(w => console.log(gh ? `::warning::${w.split('\n')[0]}` : '⚠️  ' + w));
  errors.forEach(e => console.log(gh ? `::error::${e.split('\n')[0]}` : '❌ ' + e));
  console.log(errors.length ? `\n${errors.length} error(s), ${warnings.length} warning(s)` : `✅ repo checks pass (${warnings.length} warning(s))`);
  process.exit(errors.length ? 1 : 0);
}
