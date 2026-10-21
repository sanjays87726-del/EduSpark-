// ══════════════════════════════════════════════════════════════
// EduSpark — Notification Sender  (v2)
// ══════════════════════════════════════════════════════════════
// GitHub Actions isse har 20 minute mein chalata hai
// (.github/workflows/notifications.yml). Ye 3 kaam karti hai:
//
//   1) Admin panel ke "instant broadcast" (notificationQueue) — lease-lock, retry + backoff, dead-letter ke saath
//   2) Roz 3 baar study reminder — subah, dopahar, shaam (IST)
//   3) Roz ek baar: 1+ din (INACTIVITY_DAYS) se inactive students ko wapas bulana
//
// Pehle ki script har 20 minute mein POORA `students` collection padhti thi
// (din mein 72 baar!) — isse Firestore ke free 50,000 reads/day jaldi khatam ho
// sakte the. Ab students tabhi padhe jaate hain jab sach mein kuch bhejna ho,
// aur sirf wahi jinke paas notification token hai.
//
// Workflow ab tabhi "success" dikhata hai jab notifications sach mein gaye;
// agar sab fail ho gaye to GitHub par run laal (fail) dikhega.
//
// Setup: GitHub repo → Settings → Secrets → Actions → FIREBASE_SERVICE_ACCOUNT
// (Firebase service-account JSON ka poora content).
// Daily reminders band karne ke liye workflow mein DAILY_SLOTS: 'off' kar dein.
// ══════════════════════════════════════════════════════════════

const admin = require('firebase-admin');

const APP_URL = 'https://eduspark.de5.net/';
// Kitne din inactive rehne par "wapas aao" reminder jaye (workflow me env INACTIVITY_DAYS se badal sakte ho). Default 1 din.
const INACTIVITY_DAYS = parseFloat(process.env.INACTIVITY_DAYS) > 0 ? parseFloat(process.env.INACTIVITY_DAYS) : 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const IST_MS = 5.5 * 60 * 60 * 1000;
// Roz ke slot ka time thoda aage-peeche hota hai (kal 11:18 par gaya, aaj 11:02 par chalega). Isliye "pichhli baar kab gaya"
// check me thodi chhoot: warna 1-din wale reminder par student ek din chhoot jaata. Dobara-bhejna slot-claim se hi rukta hai.
const NOTIFY_SLACK_MS = 3 * 60 * 60 * 1000;
const ACTIVE_NOW_MS = 15 * 60 * 1000;           // jo abhi app use kar raha ho use daily reminder nahi
const DAILY_SLOTS_ON = process.env.DAILY_SLOTS !== 'off';
// Cost lever: har slot (subah/dopahar/shaam) token wale SAARE students padhta hai. 20,000 students × 3 slots = 60,000 reads/din
// (free limit 50,000). ENABLED_SLOTS='morning,evening' se ek slot hata do. Khali = sab chalein.
const ENABLED_SLOTS = (process.env.ENABLED_SLOTS || '').split(',').map(x => x.trim()).filter(Boolean);
// Queue reliability: lease (distributed lock), retry with exponential backoff, dead-letter
const MAX_ATTEMPTS = 3;                          // itni kosish ke baad broadcast "dead" (dead-letter) ho jaata hai
const LEASE_MS = 10 * 60 * 1000;                 // 'sending' ka lease — run crash ho to itni der baad koi aur run le sakti hai
const RETRY_BASE_MS = 20 * 60 * 1000;            // pehli retry 20 min baad, phir 40 min ...

// atMin = din ke kaun se minute (IST) se bhejna shuru; windowMin = us ke baad kitni der tak
// (GitHub ka schedule kabhi late chalta hai, isliye thodi khidki rakhi hai)
const SLOTS = [
  { key: 'morning',    atMin: 7 * 60 + 30, windowMin: 150 },   // 7:30 AM se
  { key: 'afternoon',  atMin: 14 * 60,     windowMin: 150 },   // 2:00 PM se
  { key: 'evening',    atMin: 19 * 60,     windowMin: 150 },   // 7:00 PM se
  { key: 'inactivity', atMin: 11 * 60,     windowMin: 180 }    // 11:00 AM se, roz ek baar (dopahar wale slot se pehle khatam)
];

const SLOT_MESSAGES = {
  morning: [
    n => [`सुप्रभात ${n}! ☀️`, `आज का लक्ष्य तय करें — सुबह की पढ़ाई सबसे असरदार होती है। एक chapter से शुरुआत करें।`],
    n => [`${n}, नया दिन, नया मौका 🌅`, `आज सिर्फ़ 15 मिनट का Quiz दें और अपनी तैयारी परखें।`],
    n => [`${n}, आज की शुरुआत पढ़ाई से करें 📖`, `छोटी-छोटी रोज़ की कोशिशें ही बड़ी सफलता बनती हैं।`],
    n => [`गुड मॉर्निंग ${n}! 🌞`, `आज का एक PYQ paper हल करके दिन की शानदार शुरुआत करें।`],
    n => [`${n}, आज आप कितना आगे बढ़ेंगे? 🚀`, `EduSpark खोलें और आज का पहला Quiz दें।`],
    n => [`उठिए ${n}, आपके सपने इंतज़ार कर रहे हैं ✨`, `आज 10 मिनट revision करें — फ़र्क़ ख़ुद दिखेगा।`],
    n => [`${n}, सुबह की ताज़गी में पढ़ाई 🌿`, `दिमाग़ सबसे तेज़ अभी चलता है — आज एक मुश्किल topic उठाएँ।`]
  ],
  afternoon: [
    n => [`${n}, 10 मिनट का Quiz? 🧩`, `थोड़ा break लेकर एक छोटा Quiz हल करें — याददाश्त पक्की होगी।`],
    n => [`${n}, आज का revision कैसा चल रहा है? 📖`, `एक PYQ paper देखें — exam का pattern समझ आएगा।`],
    n => [`${n}, दोपहर का सही इस्तेमाल करें ⏰`, `सिर्फ़ 10 मिनट — एक chapter के important points दोहरा लें।`],
    n => [`${n}, कोई doubt अटका है? 🤔`, `EduSpark में doubt पूछें, या "AI से समझें" दबाकर तुरंत जवाब पाएँ।`],
    n => [`${n}, थोड़ी practice, बड़ा फ़ायदा 💪`, `आज का Quiz दें और अपना score देखें।`],
    n => [`${n}, आधा दिन बीत गया ⌛`, `बचे हुए समय में एक topic पक्का कर लें।`],
    n => [`${n}, एक छोटा सा कदम 👣`, `आज का एक सवाल हल करें — रफ़्तार अपने आप बन जाएगी।`]
  ],
  evening: [
    n => [`शुभ संध्या ${n}! 🌆`, `दिन भर जो पढ़ा उसे 10 मिनट में revise कर लें — रात से पहले का revision याद रखने में मदद करता है।`],
    n => [`${n}, आज का target पूरा किया? 🎯`, `एक Quiz देकर अपना score देखें और streak बनाए रखें।`],
    n => [`${n}, दिन ख़त्म होने से पहले एक कोशिश 🔥`, `आज एक PYQ paper हल कर लें — कल का आप शुक्रिया कहेगा।`],
    n => [`${n}, आज की मेहनत कल का रिज़ल्ट है 🏆`, `EduSpark खोलें और आज की पढ़ाई पूरी करें।`],
    n => [`${n}, सोने से पहले 10 मिनट 🌙`, `आज पढ़े हुए 3 सबसे ज़रूरी points दोहरा लें।`],
    n => [`${n}, आपकी streak आपका इंतज़ार कर रही है 🔥`, `आज एक छोटा Quiz देकर इसे बनाए रखें।`],
    n => [`${n}, कल की तैयारी आज से 📅`, `अगला chapter एक नज़र देख लें — कल आसानी होगी।`]
  ]
};

function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT secret nahi mila (GitHub → Settings → Secrets → Actions).');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

// ── Time helpers (IST) ─────────────────────────────────────────
function istNow(now = Date.now()) {
  const d = new Date(now + IST_MS);
  const y = d.getUTCFullYear();
  return {
    dateKey: d.toISOString().slice(0, 10),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    dayOfYear: Math.floor((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 0)) / MS_PER_DAY)
  };
}
function dueSlots(now = Date.now()) {
  const t = istNow(now);
  return SLOTS.filter(s => (!ENABLED_SLOTS.length || ENABLED_SLOTS.includes(s.key)) && t.minutes >= s.atMin && t.minutes < s.atMin + s.windowMin);
}
function firstName(name) { return String(name || 'Student').trim().split(/\s+/)[0] || 'Student'; }
function pickSlotMessage(slotKey, name, dayOfYear) {
  const pool = SLOT_MESSAGES[slotKey];
  const [title, body] = pool[dayOfYear % pool.length](firstName(name));
  return { title, body };
}

// ── FCM bhejna (sendEach) — galat tokens saaf, errors ginte hue ──
function webpushOpts() {
  return { headers: { Urgency: 'high', TTL: '86400' }, fcmOptions: { link: APP_URL } };
}
const DEAD_TOKEN_CODES = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

// messages: [{ token, notification:{title,body}, studentId }]
async function sendMessages(db, messages) {
  const out = { successCount: 0, failureCount: 0, errors: {}, sample: '', okIds: [] };
  const CHUNK = 500;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    const res = await admin.messaging().sendEach(chunk.map(m => ({
      token: m.token, notification: m.notification, webpush: webpushOpts()
    })));
    out.successCount += res.successCount;
    out.failureCount += res.failureCount;
    const cleanup = db.batch();
    let cleanupCount = 0;
    res.responses.forEach((r, idx) => {
      if (r.success) { if (chunk[idx].studentId) out.okIds.push(chunk[idx].studentId); return; }
      const code = (r.error && r.error.code) || 'unknown';
      out.errors[code] = (out.errors[code] || 0) + 1;
      if (!out.sample && r.error) out.sample = `${code}: ${r.error.message}`;
      if (DEAD_TOKEN_CODES.includes(code) && chunk[idx].studentId) {
        cleanup.update(db.collection('students').doc(chunk[idx].studentId), { fcmToken: admin.firestore.FieldValue.delete() });
        cleanupCount++;
      }
    });
    if (cleanupCount) await cleanup.commit();
  }
  return out;
}
function logErrors(r) {
  const keys = Object.keys(r.errors);
  if (!keys.length) return;
  console.log('   ⚠️ Fail ki wajah:', keys.map(k => `${k} ×${r.errors[k]}`).join(', '));
  if (r.sample) console.log('   ⚠️ Udaharan:', r.sample);
}

// ── Roz-ke-slot ek hi baar chalein (do runs overlap hon tab bhi) ──
function slotRef(db) { return db.collection('notificationState').doc('dailySlots'); }
async function claimSlot(db, key, dateKey) {
  const ref = slotRef(db);
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    if (d[key] === dateKey) return false;
    tx.set(ref, { [key]: dateKey }, { merge: true });
    return true;
  });
}
async function releaseSlot(db, key) {
  await slotRef(db).set({ [key]: admin.firestore.FieldValue.delete() }, { merge: true });
}

// Sirf wahi students jinke paas token hai (poora collection nahi)
async function studentsWithTokens(db) {
  const snap = await db.collection('students').where('fcmToken', '!=', null).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => typeof s.fcmToken === 'string' && s.fcmToken);
}

// ── PART 1: Admin ke instant broadcasts ──────────────────────────
// Status flow:  pending → sending (lease) → sent
//                         ↘ fail: pending (attempts+1, nextAttemptAt, exponential backoff) → ... → dead (MAX_ATTEMPTS ke baad)
// 'sending' ka lease khatam ho jaaye (run beech me crash hui) to koi doosri run use dobara utha leti hai
// (at-least-once: crash ke case me kuch students ko do baar ja sakta hai, kisi ko miss nahi hota).

// Transaction se broadcast ko "claim" karo — do runs ek hi broadcast ek saath nahi bhej sakti
async function claimQueueDoc(db, ref) {
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const d = snap.data();
    const now = Date.now();
    const reclaim = d.status === 'sending' && (d.leaseUntil || 0) < now;
    const due = d.status === 'pending' && !(d.nextAttemptAt && d.nextAttemptAt > now);
    if (!reclaim && !due) return null;
    tx.update(ref, { status: 'sending', leaseUntil: now + LEASE_MS });
    return d;                                   // claim se pehle ka data (attempts waghera)
  });
}

async function processQueue(db) {
  const now = Date.now();
  const [pend, stuck] = await Promise.all([
    db.collection('notificationQueue').where('status', '==', 'pending').get(),
    db.collection('notificationQueue').where('status', '==', 'sending').get()
  ]);
  const candidates = pend.docs.concat(stuck.docs).filter(d => {
    const x = d.data();
    return x.status === 'sending' ? (x.leaseUntil || 0) < now : !(x.nextAttemptAt && x.nextAttemptAt > now);
  });
  if (!candidates.length) { console.log('ℹ️  Koi bhejne layak broadcast nahi.'); return false; }

  let students = null;                           // sirf tab padho jab sach me kuch bhejna ho
  let anyDead = false;

  for (const doc of candidates) {
    const q = await claimQueueDoc(db, doc.ref);
    if (!q) { console.log(`⏭️  "${doc.data().title}" kisi aur run ne le liya ya abhi due nahi.`); continue; }
    if (!students) {
      students = await studentsWithTokens(db);
      console.log(`📋 ${candidates.length} broadcast | notification token wale students: ${students.length}`);
    }
    const targets = q.audience && q.audience !== 'all' ? students.filter(s => s.board === q.audience) : students;
    if (!targets.length) {
      console.warn(`⚠️  "${q.title}" — audience "${q.audience || 'all'}" me kisi student ke paas token nahi (shayad kisi ne notification allow nahi ki).`);
      await doc.ref.update({ status: 'sent', sentCount: 0, note: 'koi token nahi', leaseUntil: admin.firestore.FieldValue.delete(), sentAt: admin.firestore.FieldValue.serverTimestamp() });
      continue;
    }
    let result;
    try {
      result = await sendMessages(db, targets.map(s => ({ token: s.fcmToken, studentId: s.id, notification: { title: q.title, body: q.body } })));
    } catch (e) {                                // FCM call hi fail — ise bhi ek failed attempt gino (warna infinite loop)
      result = { successCount: 0, failureCount: targets.length, errors: {}, sample: String((e && e.message) || e), okIds: [] };
    }
    console.log(`📤 Broadcast "${q.title}" → ${result.successCount} bheje, ${result.failureCount} fail`);
    logErrors(result);
    if (result.successCount === 0) {
      const attempts = (q.attempts || 0) + 1;
      const lastError = result.sample || 'sab fail';
      if (attempts >= MAX_ATTEMPTS) {
        anyDead = true;
        console.error(`☠️  "${q.title}" ${attempts} kosish ke baad dead (dead-letter).`);
        await doc.ref.update({ status: 'dead', attempts, sentCount: 0, lastError, leaseUntil: admin.firestore.FieldValue.delete(), sentAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        const wait = RETRY_BASE_MS * Math.pow(2, attempts - 1);
        console.warn(`🔁 "${q.title}" attempt ${attempts}/${MAX_ATTEMPTS} fail — ${Math.round(wait / 60000)} min baad dobara.`);
        await doc.ref.update({ status: 'pending', attempts, lastError, nextAttemptAt: Date.now() + wait, leaseUntil: admin.firestore.FieldValue.delete() });
      }
    } else {
      await doc.ref.update({ status: 'sent', sentCount: result.successCount, leaseUntil: admin.firestore.FieldValue.delete(), sentAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }
  return anyDead;                                // sirf permanent fail par workflow laal hota hai
}

// ── PART 2: Subah / dopahar / shaam ke study reminders ──────────
async function sendDailySlot(db, slot, t) {
  const students = await studentsWithTokens(db);
  const now = Date.now();
  const targets = students.filter(s => {
    const la = s.lastActive && s.lastActive.toMillis ? s.lastActive.toMillis() : 0;
    return !(la && now - la < ACTIVE_NOW_MS);
  });
  if (!targets.length) { console.log(`ℹ️  ${slot.key}: bhejne layak koi student nahi (token wale: ${students.length}).`); return { ok: true }; }
  const result = await sendMessages(db, targets.map(s => ({
    token: s.fcmToken, studentId: s.id, notification: pickSlotMessage(slot.key, s.name, t.dayOfYear)
  })));
  console.log(`🕒 ${slot.key} reminder → ${result.successCount} bheje, ${result.failureCount} fail (token wale: ${students.length})`);
  logErrors(result);
  return { ok: result.successCount > 0, result };
}

// ── PART 3: inactive students (INACTIVITY_DAYS se zyada, roz ek baar) ──
function pickInactivityMessage(name, days) {
  const f = firstName(name);
  const pool = [
    [`${f}, आपकी किताबें आपको याद कर रही हैं 📖`, `${days} दिन हो गए! आज सिर्फ़ 10 मिनट पढ़ें — बड़ी सफलता छोटे कदमों से ही मिलती है।`],
    [`${f}, आज का Quiz आपका इंतज़ार कर रहा है 🧩`, `अपनी तैयारी परखें और अपना score बढ़ाएँ। आप जितना सोचते हैं, उससे ज़्यादा कर सकते हैं!`],
    [`वापस आइए ${f}! 🔥`, `Topper बनने के लिए रोज़ थोड़ा-थोड़ा काफ़ी है। आज एक chapter revise कर लें।`],
    [`${f}, आपका सपना इंतज़ार नहीं करेगा ⏳`, `आज की मेहनत कल का रिज़ल्ट बनेगी। EduSpark खोलें और शुरू करें!`],
    [`${f}, बस एक PYQ paper! 📜`, `पिछले साल के सवाल हल करके exam का pattern समझें — आज ही शुरुआत करें।`],
    [`${f}, आप कर सकते हैं! 💪`, `${days} दिन का gap कोई बात नहीं — आज से फिर शुरू करें, हम आपके साथ हैं।`]
  ];
  const m = pool[Math.floor(Math.random() * pool.length)];
  return { title: m[0], body: m[1] };
}
// la / ln = lastActive / lastNotifiedAt (ms; 0 = kabhi nahi)
function needsInactivityReminder(la, ln, now = Date.now()) {
  const cooldownMs = Math.max(0, INACTIVITY_DAYS * MS_PER_DAY - NOTIFY_SLACK_MS);
  return (now - la) >= INACTIVITY_DAYS * MS_PER_DAY && (!ln || (now - ln) >= cooldownMs);
}
async function sendInactivityReminders(db) {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - INACTIVITY_DAYS * MS_PER_DAY);
  // Sirf wo jo INACTIVITY_DAYS se inactive hain (poora collection nahi padhte)
  const snap = await db.collection('students').where('lastActive', '<', cutoff).get();
  const now = Date.now();
  const messages = [];
  snap.docs.forEach(doc => {
    const s = doc.data();
    if (!s.fcmToken) return;
    const la = s.lastActive && s.lastActive.toMillis ? s.lastActive.toMillis() : 0;
    const ln = s.lastNotifiedAt && s.lastNotifiedAt.toMillis ? s.lastNotifiedAt.toMillis() : 0;
    if (needsInactivityReminder(la, ln, now)) {
      messages.push({ token: s.fcmToken, studentId: doc.id, ref: doc.ref, notification: pickInactivityMessage(s.name, Math.max(1, Math.floor((now - la) / MS_PER_DAY))) });
    }
  });
  if (!messages.length) { console.log('ℹ️  Inactive reminder: koi nahi.'); return { ok: true }; }
  const result = await sendMessages(db, messages);
  console.log(`📅 ${INACTIVITY_DAYS}-din inactivity reminder → ${result.successCount} bheje, ${result.failureCount} fail`);
  logErrors(result);
  // Jinko sach mein gaya sirf unka lastNotifiedAt likho (dobara INACTIVITY_DAYS baad hi)
  const okSet = new Set(result.okIds);
  const sent = messages.filter(m => okSet.has(m.studentId));
  for (let i = 0; i < sent.length; i += 400) {
    const b = db.batch();
    sent.slice(i, i + 400).forEach(m => b.update(m.ref, { lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp() }));
    await b.commit().catch(e => console.warn('lastNotifiedAt update fail:', e.message));
  }
  return { ok: result.successCount > 0, result };
}

async function runDueSlots(db) {
  if (!DAILY_SLOTS_ON) { console.log('ℹ️  Daily reminders band hain (DAILY_SLOTS=off).'); return false; }
  const t = istNow();
  const due = dueSlots();
  console.log(`⏰ IST ${t.dateKey} ${String(Math.floor(t.minutes / 60)).padStart(2, '0')}:${String(t.minutes % 60).padStart(2, '0')} | abhi due slots: ${due.map(s => s.key).join(', ') || 'koi nahi'}`);
  let anyFailed = false;
  for (const slot of due) {
    const claimed = await claimSlot(db, slot.key, t.dateKey);
    if (!claimed) { console.log(`✔️  ${slot.key} aaj pehle hi ja chuka hai.`); continue; }
    const r = slot.key === 'inactivity' ? await sendInactivityReminders(db) : await sendDailySlot(db, slot, t);
    if (!r.ok) {              // kuch bhi nahi gaya — slot wapas khol do taaki agli run (20 min baad) dobara try kare
      await releaseSlot(db, slot.key).catch(() => {});
      anyFailed = true;
    }
  }
  return anyFailed;
}

module.exports = { needsInactivityReminder, INACTIVITY_DAYS, istNow, dueSlots, pickSlotMessage, firstName, SLOTS, SLOT_MESSAGES, claimSlot, runDueSlots, processQueue, claimQueueDoc, MAX_ATTEMPTS, RETRY_BASE_MS, LEASE_MS };

if (require.main === module) {
  (async () => {
    const db = init();
    const f1 = await processQueue(db);
    const f2 = await runDueSlots(db);
    if (f1 || f2) { console.error('❌ Kuch notifications bheje nahi ja sake (upar ke log dekhein).'); process.exit(1); }
    console.log('✅ Done.');
    process.exit(0);
  })().catch(err => {
    console.error('❌ Script fail ho gayi:', err);
    process.exit(1);
  });
}
