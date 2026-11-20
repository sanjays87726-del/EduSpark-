// firebase-admin ko nakli module se badal deta hai (real package install ho ya na ho) — scripts ke tests ke liye
const Module = require('module');
const FV = { serverTimestamp: () => ({ __fv: 'ts' }), delete: () => ({ __fv: 'del' }), arrayUnion: (...v) => ({ __fv: 'union', v }) };
function firestore() { return null; }
firestore.FieldValue = FV;
firestore.Timestamp = { fromMillis: ms => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 }) };
const fake = { initializeApp() {}, credential: { cert() {} }, firestore, messaging: () => global.__fcm };
const orig = Module._load;
Module._load = function (request, ...rest) { return request === 'firebase-admin' ? fake : orig.call(this, request, ...rest); };
module.exports = fake;
