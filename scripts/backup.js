// ══════════════════════════════════════════════════════════════
// EduSpark — Firestore Backup (Disaster Recovery)
// Sirf admin ka banaya content: content, quizzes, pyq, _config.
// Students / doubts / usernames (personal data) jaan-boojh kar backup me NAHI hain.
// Chalao:  FIREBASE_SERVICE_ACCOUNT='{...}' node scripts/backup.js [outDir]
// Restore: scripts/restore.js
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['content', 'quizzes', 'pyq', '_config'];
const FORMAT_VERSION = 1;

// Firestore Timestamp -> JSON-safe marker. Koi aur special type (DocumentReference, GeoPoint ...) mile to saaf error —
// chupchap bigad kar save karne se behtar hai ki backup fail ho.
function encode(v, where) {
  if (v === null || typeof v !== 'object') return v;
  if (typeof v.toMillis === 'function' && typeof v.seconds === 'number') return { __type: 'timestamp', ms: v.toMillis() };
  if (Array.isArray(v)) return v.map((x, i) => encode(x, where + '[' + i + ']'));
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) throw new Error('Unsupported Firestore type at ' + where);
  const o = {};
  for (const k of Object.keys(v)) o[k] = encode(v[k], where + '.' + k);
  return o;
}
function decode(v, Timestamp) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(x => decode(x, Timestamp));
  if (v.__type === 'timestamp' && typeof v.ms === 'number') return Timestamp.fromMillis(v.ms);
  const o = {};
  for (const k of Object.keys(v)) o[k] = decode(v[k], Timestamp);
  return o;
}

async function createBackup(db, now = new Date()) {
  const data = {}, counts = {};
  for (const c of COLLECTIONS) {
    const snap = await db.collection(c).get();
    data[c] = snap.docs.map(d => ({ id: d.id, data: encode(d.data(), c + '/' + d.id) }));
    counts[c] = data[c].length;
  }
  return { meta: { format: FORMAT_VERSION, createdAt: now.toISOString(), counts }, data };
}

function stamp(d) { return d.toISOString().slice(0, 10); }

module.exports = { COLLECTIONS, FORMAT_VERSION, encode, decode, createBackup };

if (require.main === module) {
  (async () => {
    const admin = require('firebase-admin');
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) { console.error('❌ FIREBASE_SERVICE_ACCOUNT secret nahi mila.'); process.exit(1); }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    const backup = await createBackup(admin.firestore());
    const total = Object.values(backup.meta.counts).reduce((a, b) => a + b, 0);
    if (total === 0) { console.error('❌ Backup khali hai (0 docs) — kuch galat hai, file nahi bani.'); process.exit(1); }
    const dir = process.argv[2] || 'backups';
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'eduspark-backup-' + stamp(new Date()) + '.json');
    fs.writeFileSync(file, JSON.stringify(backup));
    console.log('✅ Backup ban gaya:', file, JSON.stringify(backup.meta.counts));
    process.exit(0);
  })().catch(e => { console.error('❌ Backup fail:', e); process.exit(1); });
}
