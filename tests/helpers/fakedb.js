// Chhota in-memory Firestore: collection/where/get, doc ref update/set/delete, batch, transaction (optimistic retry jaisa asli Firestore me)
function applyFV(old, obj) { const n = { ...old }; for (const [k, v] of Object.entries(obj)) { if (v && v.__fv === 'del') delete n[k]; else if (v && v.__fv === 'ts') n[k] = { __ts: Date.now() }; else if (v && v.__fv === 'union') n[k] = [...new Set([...(n[k] || []), ...v.v])]; else n[k] = v; } return n; }
function makeDb(init = {}) {
  const cols = {}; const ver = {};
  for (const [c, docs] of Object.entries(init)) { cols[c] = new Map(Object.entries(docs).map(([id, d]) => [id, JSON.parse(JSON.stringify(d))])); }
  const col = c => cols[c] || (cols[c] = new Map());
  const key = (c, id) => c + '/' + id;
  const snapOf = (c, id) => { const m = col(c); const ex = m.has(id); const data = ex ? m.get(id) : undefined; return { id, exists: ex, data: () => (ex ? JSON.parse(JSON.stringify(data)) : undefined), ref: refOf(c, id) }; };
  const refOf = (c, id) => ({ id, _c: c,
    get: async () => snapOf(c, id),
    update: async obj => { if (!col(c).has(id)) throw new Error('NOT_FOUND ' + c + '/' + id); col(c).set(id, applyFV(col(c).get(id), obj)); ver[key(c, id)] = (ver[key(c, id)] || 0) + 1; },
    set: async (obj, opt) => { col(c).set(id, applyFV(opt && opt.merge ? (col(c).get(id) || {}) : {}, obj)); ver[key(c, id)] = (ver[key(c, id)] || 0) + 1; },
    delete: async () => { col(c).delete(id); ver[key(c, id)] = (ver[key(c, id)] || 0) + 1; } });
  const db = {
    _cols: cols,
    collection: c => ({
      doc: id => refOf(c, id),
      get: async () => ({ docs: [...col(c).keys()].map(id => snapOf(c, id)), empty: col(c).size === 0, size: col(c).size }),
      where: (f, op, v) => ({ get: async () => {
        const docs = [...col(c).keys()].map(id => snapOf(c, id)).filter(s => { const d = s.data(); if (op === '==') return d[f] === v; if (op === '!=') return f in d && d[f] !== v; if (op === '<') return d[f] != null && d[f] < v; throw new Error('op ' + op); });
        return { docs, empty: !docs.length, size: docs.length }; } })
    }),
    batch: () => { const ops = []; return { update: (r, o) => ops.push(() => r.update(o)), set: (r, o, opt) => ops.push(() => r.set(o, opt)), delete: r => ops.push(() => r.delete()), commit: async () => { for (const f of ops) await f(); } }; },
    runTransaction: async fn => {
      for (let i = 0; i < 6; i++) {
        const seen = {}; const writes = [];
        const tx = { get: async r => { await Promise.resolve(); seen[key(r._c, r.id)] = ver[key(r._c, r.id)] || 0; return snapOf(r._c, r.id); }, update: (r, o) => writes.push(() => r.update(o)), set: (r, o, opt) => writes.push(() => r.set(o, opt)) };
        const out = await fn(tx);
        if (Object.entries(seen).some(([k, v]) => (ver[k] || 0) !== v)) continue;     // kisi aur ne badal diya — dobara chalao
        for (const w of writes) await w(); return out;
      }
      throw new Error('too much contention');
    }
  };
  return db;
}
module.exports = { makeDb };
