// ══════════════════════════════════════════════════════════════
// EduSpark — Restore (backup.js ki file se)
// DEFAULT = DRY RUN (kuch likhta nahi). Asli restore ke liye APPLY=1.
//   node scripts/restore.js backups/eduspark-backup-2026-10-17.json
//   ONLY=content,pyq  — sirf kuch collections
//   APPLY=1           — asli me likho
// Restore doc ko poora "set" karta hai (backup jaisa ho jaata hai). Backup ke baad bane naye docs delete NAHI hote.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const { COLLECTIONS, FORMAT_VERSION, decode } = require('./backup.js');

async function restoreBackup(db, backup, { apply = false, only = null, Timestamp } = {}) {
  if (!backup || !backup.meta || backup.meta.format !== FORMAT_VERSION || !backup.data) throw new Error('Ye EduSpark backup file nahi lagti (format galat).');
  const wanted = (only && only.length ? only : COLLECTIONS).filter(c => COLLECTIONS.includes(c));   // allow-list: file se koi bhi collection nahi likhi jaati
  const result = {};
  for (const c of wanted) {
    const docs = backup.data[c];
    if (!Array.isArray(docs)) { result[c] = 0; continue; }
    for (const d of docs) if (!d || typeof d.id !== 'string' || !d.id || d.id.includes('/') || typeof d.data !== 'object') throw new Error('Bad doc in ' + c);
    if (apply) {
      for (let i = 0; i < docs.length; i += 400) {
        const b = db.batch();
        docs.slice(i, i + 400).forEach(d => b.set(db.collection(c).doc(d.id), decode(d.data, Timestamp)));
        await b.commit();
      }
    }
    result[c] = docs.length;
  }
  return { applied: !!apply, counts: result };
}
module.exports = { restoreBackup };

if (require.main === module) {
  (async () => {
    const file = process.argv[2];
    if (!file) { console.error('Use: node scripts/restore.js <backup.json>'); process.exit(1); }
    const admin = require('firebase-admin');
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) { console.error('❌ FIREBASE_SERVICE_ACCOUNT nahi mila.'); process.exit(1); }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    const apply = process.env.APPLY === '1';
    const only = (process.env.ONLY || '').split(',').map(x => x.trim()).filter(Boolean);
    const res = await restoreBackup(admin.firestore(), JSON.parse(fs.readFileSync(file, 'utf8')), { apply, only, Timestamp: admin.firestore.Timestamp });
    console.log(apply ? '✅ Restore ho gaya:' : '🧪 DRY RUN (kuch likha nahi) — asli ke liye APPLY=1:', JSON.stringify(res.counts));
    process.exit(0);
  })().catch(e => { console.error('❌ Restore fail:', e.message || e); process.exit(1); });
}
