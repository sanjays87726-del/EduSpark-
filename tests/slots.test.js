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
console.log('slot filter tests ✓');
