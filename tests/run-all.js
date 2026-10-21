// Saare tests ek ke baad ek; koi bhi fail ho to exit 1
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const files = fs.readdirSync(__dirname).filter(f => /\.test\.(js|mjs)$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  process.stdout.write('▶ ' + f + ' ... ');
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' });
  if (r.status === 0) { const last = (r.stdout.trim().split('\n').pop() || '').trim(); console.log('ok  ' + last); }
  else { failed++; console.log('FAIL'); console.log((r.stdout || '') + (r.stderr || '')); }
}
console.log(failed ? `\n${failed} test file(s) FAILED` : `\nAll ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
