const assert = require('assert'); const { execFileSync } = require('child_process'); const path = require('path');
// dueSlots env ko module load par padhta hai — isliye har case alag process me
function slots(env, utc) {
  const code = `require(${JSON.stringify(path.join(__dirname, 'helpers/fake-admin.js'))}); const S = require(${JSON.stringify(path.join(__dirname, '../scripts/send-notifications.js'))}); console.log(JSON.stringify(S.dueSlots(${utc}).map(s => s.key)));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', code], { env: { ...process.env, ...env }, encoding: 'utf8' }));
}
const IST = (h, m) => Date.UTC(2026, 9, 17, h, m) - 5.5 * 3600e3;          // IST samay ko UTC ms me
assert.deepStrictEqual(slots({ ENABLED_SLOTS: '' }, IST(7, 40)), ['morning']);
assert.deepStrictEqual(slots({ ENABLED_SLOTS: '' }, IST(14, 5)), ['afternoon']);
assert.deepStrictEqual(slots({ ENABLED_SLOTS: 'morning,evening' }, IST(14, 5)), []);                // afternoon band
assert.deepStrictEqual(slots({ ENABLED_SLOTS: 'morning, evening ' }, IST(19, 10)), ['evening']);   // spaces theek
assert.deepStrictEqual(slots({ ENABLED_SLOTS: 'inactivity' }, IST(11, 30)), ['inactivity']);
assert.deepStrictEqual(slots({ ENABLED_SLOTS: 'inactivity' }, IST(7, 40)), []);
assert.deepStrictEqual(slots({ ENABLED_SLOTS: '' }, IST(3, 0)), []);                                // raat ko kuch nahi

// ── inactivity: 1 din (default) ──
function inact(env, code) {
  const c = `require(${JSON.stringify(path.join(__dirname, 'helpers/fake-admin.js'))}); const S = require(${JSON.stringify(path.join(__dirname, '../scripts/send-notifications.js'))}); const D = 86400e3, H = 3600e3, now = 1e13; console.log(JSON.stringify(${code}));`;
  return JSON.parse(execFileSync(process.execPath, ['-e', c], { env: { ...process.env, ...env }, encoding: 'utf8' }));
}
assert.strictEqual(inact({ INACTIVITY_DAYS: '' }, 'S.INACTIVITY_DAYS'), 1);                          // default 1 din
assert.strictEqual(inact({ INACTIVITY_DAYS: '3' }, 'S.INACTIVITY_DAYS'), 3);                         // env se badla ja sakta hai
assert.strictEqual(inact({ INACTIVITY_DAYS: 'abc' }, 'S.INACTIVITY_DAYS'), 1);                       // kharab value -> default
assert.strictEqual(inact({}, 'S.needsInactivityReminder(now - 25*H, 0, now)'), true);                // 25 ghante inactive, kabhi notify nahi
assert.strictEqual(inact({}, 'S.needsInactivityReminder(now - 10*H, 0, now)'), false);               // abhi 1 din nahi hua
assert.strictEqual(inact({}, 'S.needsInactivityReminder(now - 3*D, now - 23.9*H, now)'), true);      // kal 11:18 gaya, aaj 11:02 -> phir bhi jaye (slack)
assert.strictEqual(inact({}, 'S.needsInactivityReminder(now - 3*D, now - 2*H, now)'), false);        // abhi 2 ghante pehle gaya -> dobara nahi
console.log('slot filter tests ✓');
