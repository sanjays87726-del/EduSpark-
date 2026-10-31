// Slot "claim" ho jaata hai bhejne se pehle. Agar bhejte waqt error aaye (Firestore quota / FCM down) to slot wapas khulna chahiye,
// warna us din ka reminder hamesha ke liye kho jaata tha (notification "kabhi aati, kabhi nahi").
const assert = require('assert');
process.env.ENABLED_SLOTS = '';
require('./helpers/fake-admin');
const { makeDb } = require('./helpers/fakedb');
const S = require('../scripts/send-notifications.js');
let mode = 'throw', sent = [];
global.__fcm = { sendEach: async msgs => {
  if (mode === 'throw') throw new Error('FCM/Firestore quota');
  sent = sent.concat(msgs);
  return { successCount: msgs.length, failureCount: 0, responses: msgs.map(() => ({ success: true })) };
} };
const quiet = async fn => { const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => {}; try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; } };
const RealNow = Date.now;
(async () => {
  const at = (h, m) => Date.UTC(2026, 9, 31, h, m) - 5.5 * 3600e3;          // 31 Oct 2026, IST samay
  Date.now = () => at(7, 45);
  const db = makeDb({ students: { a: { name: 'Asha', board: 'BSER-10', fcmToken: 'tokA' }, b: { name: 'Bhanu', board: 'CBSE-10', fcmToken: 'tokB' } } });
  const failed = await quiet(() => S.runDueSlots(db));
  assert.strictEqual(failed, true, 'error par run fail dikhna chahiye');
  const st = db._cols.notificationState && db._cols.notificationState.get('dailySlots');
  assert.ok(!st || !st.morning, 'error ke baad morning slot claimed nahi rehna chahiye');
  console.log('✓ send error -> slot released, retry possible');
  mode = 'ok'; Date.now = () => at(8, 5);                                   // agli run (20 min baad)
  const failed2 = await quiet(() => S.runDueSlots(db));
  assert.strictEqual(failed2, false);
  assert.strictEqual(sent.length, 2, 'dono students ko morning reminder jaana chahiye');
  assert.strictEqual(db._cols.notificationState.get('dailySlots').morning, '2026-10-31');
  assert.strictEqual(sent[0].webpush.headers.TTL, '10800', 'reminder TTL 3 ghante');
  const lr = db._cols.notificationState.get('lastRun');
  assert.ok(lr && lr.results[0].slot === 'morning' && lr.results[0].ok === true && lr.results[0].sent === 2);
  console.log('✓ retry sends once, TTL=3h, lastRun logged');
  const before = sent.length; Date.now = () => at(8, 25);
  await quiet(() => S.runDueSlots(db));
  assert.strictEqual(sent.length, before, 'ek din me ek hi baar');
  console.log('✓ no duplicate on the next 20-min run');
  Date.now = RealNow;
  console.log('slot release tests passed');
})().catch(e => { Date.now = RealNow; console.error(e.stack); process.exit(1); });
