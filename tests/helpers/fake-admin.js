// firebase-admin ko nakli module se badal deta hai (real package install ho ya na ho) — scripts ke tests ke liye
const Module = require('module');
const FV = { serverTimestamp: () => ({ __fv: 'ts' }), delete: () => ({ __fv: 'del' }), arrayUnion: (...v) => ({ __fv: 'union', v }) };
function firestore() { return null; }
firestore.FieldValue = FV;
firestore.Timestamp = { fromMillis: ms => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 }) };
const fake = { initializeApp() {}, credential: { cert() {} }, firestore, messaging: () => global.__fcm };
const fakeApp = { initializeApp: (...args) => fake.initializeApp(...args), cert: value => value };
const fakeFirestore = {
  getFirestore: () => fake.firestore(),
  FieldValue: FV,
  Timestamp: firestore.Timestamp
};
const fakeMessaging = { getMessaging: () => fake.messaging() };
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'firebase-admin') return fake;
  if (request === 'firebase-admin/app') return fakeApp;
  if (request === 'firebase-admin/firestore') return fakeFirestore;
  if (request === 'firebase-admin/messaging') return fakeMessaging;
  return orig.call(this, request, ...rest);
};
module.exports = fake;
