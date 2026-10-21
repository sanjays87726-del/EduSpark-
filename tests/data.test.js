const assert = require('assert'); const { makeDb } = require('./helpers/fakedb');
const admin = require('./helpers/fake-admin');
const B = require('../scripts/backup.js'), R = require('../scripts/restore.js'), M = require('../scripts/migrate.js'); const TS = admin.firestore.Timestamp;
let n = 0; const t = async (name, fn) => { try { await fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };
const seed = () => makeDb({
  content: { c1: { title: 'Ch1', board: 'CBSE-10', type: 'pdf', link: 'https://x', date: '2026-10-01T00:00:00Z' }, c2: { title: 'Q', type: 'quiz', questions: [{ q: 'a', options: ['1', '2'], ans: 1 }], schema: 1 } },
  quizzes: { z1: { title: 'Z', sectional: true, sections: [{ name: 'S', questions: [] }] } },
  pyq: { p1: { board: 'bser-10', year: 2024, title: 'P' }, p2: { board: 'CBSE-12', year: 2023, title: 'P2', schema: 1 }, p3: { board: 'Bser-12', year: 2022, title: 'P3' } },
  _config: { community: { whatsappLink: 'https://wa' } },
  students: { s1: { name: 'Private', email: 'x@y.z' } }, doubts: { d1: { text: 'secret doubt', uid: 'u' } }, usernames: { u1: { uid: 'u' } }
});
const snapshot = db => JSON.stringify(Object.fromEntries(Object.entries(db._cols).filter(([, m]) => m.size).map(([c, m]) => [c, [...m.entries()]])));   // khaali collections ignore (fake DB me read se ban jaati hain)

(async () => {
  await t('backup: only public collections, counts right, no personal data', async () => {
    const b = await B.createBackup(seed(), new Date('2026-10-17T00:00:00Z'));
    assert.deepStrictEqual(Object.keys(b.data).sort(), ['_config', 'content', 'pyq', 'quizzes']);
    assert.deepStrictEqual(b.meta.counts, { content: 2, quizzes: 1, pyq: 3, _config: 1 });
    const txt = JSON.stringify(b); assert.ok(!txt.includes('Private') && !txt.includes('secret doubt') && !txt.includes('x@y.z'));
    assert.strictEqual(b.meta.format, 1); assert.strictEqual(b.meta.createdAt, '2026-10-17T00:00:00.000Z');
  });
  await t('encode/decode: Timestamp round trip, nested arrays/maps, unsupported types fail loudly', () => {
    const v = { a: TS.fromMillis(1234567), arr: [{ t: TS.fromMillis(5) }, 1, 'x', null], n: { m: true } };
    const e = B.encode(v, 'x'); assert.deepStrictEqual(e.a, { __type: 'timestamp', ms: 1234567 });
    const d = B.decode(JSON.parse(JSON.stringify(e)), TS); assert.strictEqual(d.a.toMillis(), 1234567); assert.strictEqual(d.arr[0].t.toMillis(), 5); assert.deepStrictEqual(d.arr.slice(1), [1, 'x', null]);
    class DocumentReference { constructor() { this.path = 'a/b'; } }
    assert.throws(() => B.encode({ r: new DocumentReference() }, 'c/d'), /Unsupported Firestore type at c\/d\.r/);
  });
  await t('restore: dry-run writes nothing; apply recreates deleted + reverts edited docs; extra docs untouched', async () => {
    const db = seed(); const b = JSON.parse(JSON.stringify(await B.createBackup(db)));
    const before = snapshot(db);
    let r = await R.restoreBackup(db, b, { apply: false, Timestamp: TS }); assert.strictEqual(r.applied, false); assert.strictEqual(snapshot(db), before);
    db._cols.content.delete('c1'); db._cols.pyq.get('p1').title = 'EDITED'; db._cols.pyq.set('new', { title: 'after backup' });
    r = await R.restoreBackup(db, b, { apply: true, Timestamp: TS });
    assert.deepStrictEqual(r.counts, { content: 2, quizzes: 1, pyq: 3, _config: 1 });
    assert.strictEqual(db._cols.content.get('c1').title, 'Ch1'); assert.strictEqual(db._cols.pyq.get('p1').title, 'P'); assert.ok(db._cols.pyq.has('new'));
    assert.ok(db._cols.students.has('s1'));                                                                   // personal collections chhui nahi
  });
  await t('restore: ONLY filter, allow-list (students in file ignored), bad format/ids rejected', async () => {
    const db = seed(); const b = JSON.parse(JSON.stringify(await B.createBackup(db)));
    b.data.students = [{ id: 'evil', data: { admin: true } }]; db._cols.content.clear();
    const r = await R.restoreBackup(db, b, { apply: true, only: ['content', 'students'], Timestamp: TS });
    assert.deepStrictEqual(r.counts, { content: 2 }); assert.ok(!db._cols.students.has('evil'));
    await assert.rejects(R.restoreBackup(db, { meta: { format: 99 }, data: {} }, {}), /format/);
    const bad = JSON.parse(JSON.stringify(b)); bad.data.pyq[0].id = 'a/b'; await assert.rejects(R.restoreBackup(db, bad, { apply: true, Timestamp: TS }), /Bad doc/);
  });
  await t('restore handles >400 docs in batches', async () => {
    const db = makeDb({}); const docs = Array.from({ length: 950 }, (_, i) => ({ id: 'd' + i, data: { i } }));
    const r = await R.restoreBackup(db, { meta: { format: 1 }, data: { content: docs } }, { apply: true, Timestamp: TS });
    assert.strictEqual(r.counts.content, 950); assert.strictEqual(db._cols.content.size, 950);
  });
  await t('migrate: dry-run changes nothing; apply stamps schema + uppercases board; second run no-op', async () => {
    const db = seed(); const before = snapshot(db);
    let rep = await M.migrate(db, { apply: false });
    assert.deepStrictEqual(rep.map(x => [x.id, x.status, x.docs]), [[1, 'dry-run', 4], [2, 'dry-run', 2]]); assert.strictEqual(snapshot(db), before);
    rep = await M.migrate(db, { apply: true });
    assert.deepStrictEqual(rep.map(x => [x.id, x.status, x.docs]), [[1, 'applied', 4], [2, 'applied', 2]]);
    assert.ok([...db._cols.content.values(), ...db._cols.quizzes.values(), ...db._cols.pyq.values()].every(d => d.schema === 1));
    assert.deepStrictEqual([...db._cols.pyq.values()].map(d => d.board).sort(), ['BSER-10', 'BSER-12', 'CBSE-12']);
    assert.deepStrictEqual(db._cols.notificationState.get('migrations').applied, [1, 2]);
    rep = await M.migrate(db, { apply: true }); assert.ok(rep.every(x => x.status === 'already-applied'));
    assert.strictEqual(db._cols.pyq.get('p2').schema, 1); assert.strictEqual(db._cols.content.get('c1').title, 'Ch1');   // baaki fields safe
  });
  console.log(`\n${n} data-tooling tests passed`);
})();
