// ══════════════════════════════════════════════════════════════
// EduSpark — Data migrations (schema versioning)
// DEFAULT = DRY RUN. Asli ke liye APPLY=1.  Pehle scripts/backup.js chala lo.
// Har migration idempotent hai; jo lag chuki hai wo notificationState/migrations me yaad rehti hai.
// Naya migration = MIGRATIONS me end me naya {id, name, run} jodo (purane kabhi mat badlo).
// ══════════════════════════════════════════════════════════════
const SCHEMA_VERSION = 1;

async function updateAll(db, items, apply) {            // items: [{ref, patch}]
  if (apply) {
    for (let i = 0; i < items.length; i += 400) {
      const b = db.batch(); items.slice(i, i + 400).forEach(x => b.update(x.ref, x.patch)); await b.commit();
    }
  }
  return items.length;
}

const MIGRATIONS = [
  { id: 1, name: 'stamp schema=1 on content/quizzes/pyq',
    async run(db, apply) {
      let n = 0;
      for (const c of ['content', 'quizzes', 'pyq']) {
        const snap = await db.collection(c).get();
        n += await updateAll(db, snap.docs.filter(d => d.data().schema == null).map(d => ({ ref: d.ref, patch: { schema: SCHEMA_VERSION } })), apply);
      }
      return n;
    } },
  { id: 2, name: 'pyq.board uppercase (BSER-10 jaisa)',
    async run(db, apply) {
      const snap = await db.collection('pyq').get();
      return updateAll(db, snap.docs.filter(d => { const b = d.data().board; return typeof b === 'string' && b !== b.toUpperCase(); })
        .map(d => ({ ref: d.ref, patch: { board: d.data().board.toUpperCase() } })), apply);
    } }
];

async function migrate(db, { apply = false } = {}) {
  const stRef = db.collection('notificationState').doc('migrations');
  const st = await stRef.get();
  const applied = (st.exists && st.data().applied) || [];
  const report = [];
  for (const m of MIGRATIONS) {
    if (applied.includes(m.id)) { report.push({ id: m.id, name: m.name, status: 'already-applied' }); continue; }
    const n = await m.run(db, apply);
    report.push({ id: m.id, name: m.name, status: apply ? 'applied' : 'dry-run', docs: n });
    if (apply) { applied.push(m.id); await stRef.set({ applied }, { merge: true }); }   // har migration ke baad yaad rakho
  }
  return report;
}
module.exports = { MIGRATIONS, migrate, SCHEMA_VERSION };

if (require.main === module) {
  (async () => {
    const admin = require('firebase-admin');
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) { console.error('❌ FIREBASE_SERVICE_ACCOUNT nahi mila.'); process.exit(1); }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    const apply = process.env.APPLY === '1';
    const rep = await migrate(admin.firestore(), { apply });
    console.log(apply ? '✅ Migrations:' : '🧪 DRY RUN — asli ke liye APPLY=1:');
    rep.forEach(r => console.log(' •', r.id, r.name, '→', r.status, r.docs != null ? '(' + r.docs + ' docs)' : ''));
    process.exit(0);
  })().catch(e => { console.error('❌ Migration fail:', e); process.exit(1); });
}
