// Minimal in-memory Firebase compat stub (smoke test ke liye) — asli SDK network ke bina nahi chalta
(function(){
  const DB = window.__DB = {};          // path-> data   ("students/u1")
  const ts = function(ms){ return { toMillis: function(){ return ms; }, __ts: ms }; };
  window.__ts = ts;
  const FV = { serverTimestamp: function(){ return { __sv: true }; }, delete: function(){ return { __del: true }; } };
  const resolveSV = function(o){ const r = {}; Object.keys(o || {}).forEach(function(k){ const v = o[k]; r[k] = (v && v.__sv) ? ts(Date.now()) : v; }); return r; };
  function collOf(path){ return path.split('/')[0]; }
  class DocumentReference {
    constructor(path){ this.path = path; this.id = path.split('/').pop(); this.parent = { id: collOf(path) }; }
    get(){ const d = DB[this.path]; const self = this; return Promise.resolve({ exists: d !== undefined, id: this.id, data: function(){ return d; }, ref: self }); }
    set(data, opts){ DB[this.path] = (opts && opts.merge) ? Object.assign({}, DB[this.path] || {}, resolveSV(data)) : resolveSV(data); return Promise.resolve(); }
    update(data){ if(DB[this.path] === undefined) return Promise.reject(new Error('No document to update')); DB[this.path] = Object.assign({}, DB[this.path], resolveSV(data)); return Promise.resolve(); }
    delete(){ delete DB[this.path]; return Promise.resolve(); }
    onSnapshot(cb){ cb({ exists: DB[this.path] !== undefined, data: () => DB[this.path] }); return function(){}; }
  }
  class Query {
    constructor(coll, st){ this.coll = coll; this.st = st || { wh: [], ord: null, lim: 1e9, after: null, start: null, end: null }; }
    _c(patch){ return new Query(this.coll, Object.assign({}, this.st, patch)); }
    where(f, op, v){ return this._c({ wh: this.st.wh.concat([[f, op, v]]) }); }
    orderBy(f, dir){ return this._c({ ord: [f, dir || 'asc'] }); }
    limit(n){ return this._c({ lim: n }); }
    startAfter(d){ return this._c({ after: d }); } startAt(v){ return this._c({ start: v }); } endAt(v){ return this._c({ end: v }); }
    onSnapshot(cb){ const self = this; this.get().then(function(sn){ try{ cb(sn); }catch(e){ console.warn('snapshot cb error: ' + e.message); } }); return function(){}; }
    get(){
      let rows = Object.keys(DB).filter(function(p){ return p.indexOf(this.coll + '/') === 0 && p.split('/').length === 2; }, this).map(function(p){ return { p: p, d: DB[p] }; });
      this.st.wh.forEach(function(w){ rows = rows.filter(function(r){ const x = r.d[w[0]]; if(w[1] === '==') return x === w[2]; if(w[1] === '!=') return x !== undefined && x !== w[2]; return true; }); });
      if(this.st.ord){ const f = this.st.ord[0], dir = this.st.ord[1] === 'desc' ? -1 : 1; rows = rows.filter(function(r){ return r.d[f] !== undefined; }); const val = function(x){ return x && x.toMillis ? x.toMillis() : x; }; rows.sort(function(a, b){ return (val(a.d[f]) > val(b.d[f]) ? 1 : val(a.d[f]) < val(b.d[f]) ? -1 : 0) * dir; }); if(this.st.start !== null && typeof this.st.start === 'string'){ const s = this.st.start, e = this.st.end; rows = rows.filter(function(r){ return String(r.d[f]) >= s && (e === null || String(r.d[f]) <= e); }); } }
      if(this.st.after){ const i = rows.findIndex(function(r){ return r.p === this.st.after.ref.path; }, this); if(i >= 0) rows = rows.slice(i + 1); }
      rows = rows.slice(0, this.st.lim);
      const docs = rows.map(function(r){ const ref = new DocumentReference(r.p); return { id: ref.id, ref: ref, exists: true, data: function(){ return r.d; } }; });
      return Promise.resolve({ docs: docs, size: docs.length, empty: !docs.length });
    }
  }
  class CollectionReference extends Query {
    constructor(name){ super(name); this.path = name; this.id = name; }
    doc(id){ return new DocumentReference(this.path + '/' + (id || ('auto' + Math.random().toString(36).slice(2, 8)))); }
    add(data){ const ref = this.doc(); DB[ref.path] = resolveSV(data); return Promise.resolve(ref); }
  }
  const authCbs = [];
  const authObj = { currentUser: null, setPersistence: function(){ return Promise.resolve(); }, onAuthStateChanged: function(cb){ authCbs.push(cb); setTimeout(function(){ cb(authObj.currentUser); }, 0); return function(){}; }, signOut: function(){ authObj.currentUser = null; authCbs.forEach(function(c){ try{ c(null); }catch(e){ console.warn('auth cb error: ' + e.message); } }); return Promise.resolve(); }, getRedirectResult: function(){ return Promise.resolve({ user: null }); }, signInWithRedirect: function(){ return Promise.resolve(); }, signInWithCredential: function(){ return Promise.reject({ code: 'x' }); }, signInWithPopup: function(){ return Promise.reject({ code: 'auth/popup-closed-by-user' }); } };
  window.__signIn = function(email, uid){ authObj.currentUser = { email: email, uid: uid || 'u_' + email, emailVerified: true, getIdToken: function(){ return Promise.resolve('tok'); } }; authCbs.forEach(function(c){ try{ c(authObj.currentUser); }catch(e){ console.warn('auth cb error: ' + e.message); } }); };
  const dbObj = { enablePersistence: function(){ return Promise.resolve(); }, settings: function(){}, enableNetwork: function(){ return Promise.resolve(); }, collection: function(n){ return new CollectionReference(n); }, runTransaction: function(fn){ return fn({ get: function(r){ return r.get(); }, update: function(r, d){ return r.update(d); } }); } };
  const fs = function(){ return dbObj; }; fs.FieldValue = FV; fs.CACHE_SIZE_UNLIMITED = -1; fs.Timestamp = { fromDate: function(d){ return ts(d.getTime()); } }; fs.DocumentReference = DocumentReference; fs.CollectionReference = CollectionReference;
  const au = function(){ return authObj; }; au.Auth = { Persistence: { LOCAL: 'local' } }; au.GoogleAuthProvider = function(){ this.setCustomParameters = function(){ return this; }; this.addScope = function(){ return this; }; }; au.GoogleAuthProvider.credential = function(){ return {}; }; au.getRedirectResult = function(){ return Promise.resolve({ user: null }); };
  window.firebase = { apps: [], initializeApp: function(){ this.apps.push(1); }, auth: au, firestore: fs };
})();
