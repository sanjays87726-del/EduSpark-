// ══════════════════════════════════════════════════════════════
// EduSpark — Notification Sender
// ══════════════════════════════════════════════════════════════
// Ye script GitHub Actions ke through har 20 minute mein chalti hai
// (.github/workflows/notifications.yml dekhein) aur do kaam karti hai:
//
//   1) Admin panel se bheja gaya koi bhi "instant broadcast"
//      (notificationQueue collection mein status:'pending') bhejna
//   2) Jo student pichhle 3+ din se app nahi khola, unhe ek chhota
//      reminder bhejna (with their name) — automatically, bina admin
//      ke kuchh kiye
//
// Ye 100% FREE hai — na Firebase Blaze plan chahiye, na koi paid
// server. Bas GitHub Actions ka free quota use hota hai.
//
// SETUP (sirf ek baar):
//   1. Firebase Console → Project Settings → Service Accounts →
//      "Generate new private key" — isse ek JSON file download hogi.
//   2. GitHub repo → Settings → Secrets and variables → Actions →
//      "New repository secret" → Name: FIREBASE_SERVICE_ACCOUNT →
//      Value: us poori JSON file ka content paste kar dein.
//   3. Bas — workflow file already isse automatically use karegi.
//
// Poora step-by-step guide NOTIFICATIONS_SETUP.md mein hai.
// ══════════════════════════════════════════════════════════════

const admin = require('firebase-admin');

const INACTIVITY_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function init() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT secret nahi mila. Setup guide dekhein (NOTIFICATIONS_SETUP.md).');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin.firestore();
}

// Ek batch of tokens ko ek hi message bhejta hai, aur expired/invalid
// tokens ko us student ke record se hata deta hai (cleanup)
async function sendToTokens(db, tokens, notification, tokenToStudentId) {
  if (!tokens.length) return { successCount: 0, failureCount: 0 };
  const CHUNK = 500; // FCM ek call mein max 500 tokens allow karta hai
  let successCount = 0, failureCount = 0;
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const chunk = tokens.slice(i, i + CHUNK);
    const res = await admin.messaging().sendEachForMulticast({
      tokens: chunk,
      notification,
      webpush: { fcmOptions: { link: 'https://sanjays87726-del.github.io/EduSpark-/' } }
    });
    successCount += res.successCount;
    failureCount += res.failureCount;
    // Invalid/expired token mile to us student ke record se fcmToken hata dein
    const cleanupBatch = db.batch();
    let cleanupCount = 0;
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          const sid = tokenToStudentId[chunk[idx]];
          if (sid) {
            cleanupBatch.update(db.collection('students').doc(sid), { fcmToken: admin.firestore.FieldValue.delete() });
            cleanupCount++;
          }
        }
      }
    });
    if (cleanupCount) await cleanupBatch.commit();
  }
  return { successCount, failureCount };
}

// ── PART 1: Admin ke instant broadcast queue ko process karo ──
async function processQueue(db) {
  const snap = await db.collection('notificationQueue').where('status', '==', 'pending').get();
  if (snap.empty) { console.log('ℹ️  Koi pending broadcast nahi.'); return; }

  const studentsSnap = await db.collection('students').get();
  const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  for (const doc of snap.docs) {
    const q = doc.data();
    const targets = q.audience && q.audience !== 'all'
      ? allStudents.filter(s => s.board === q.audience)
      : allStudents;
    const tokenToStudentId = {};
    const tokens = [];
    targets.forEach(s => { if (s.fcmToken) { tokens.push(s.fcmToken); tokenToStudentId[s.fcmToken] = s.id; } });

    const result = await sendToTokens(db, tokens, { title: q.title, body: q.body }, tokenToStudentId);
    console.log(`📤 Broadcast "${q.title}" → ${result.successCount} भेजे, ${result.failureCount} fail`);

    await doc.ref.update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      sentCount: result.successCount
    });
  }
}

// Har baar alag, naam + motivation wala message
function pickInactivityMessage(name, days){
  const f = String(name||'Student').trim().split(/\s+/)[0];
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

// ── PART 2: 3-din inactive students ko personalized reminder ──
async function sendInactivityReminders(db) {
  const snap = await db.collection('students').get();
  if (snap.empty) { console.log('ℹ️  Koi registered student nahi mila.'); return; }

  const now = Date.now();
  let sentCount = 0;

  for (const doc of snap.docs) {
    const s = doc.data();
    if (!s.fcmToken) continue;

    const lastActive = s.lastActive && s.lastActive.toMillis ? s.lastActive.toMillis() : 0;
    const lastNotified = s.lastNotifiedAt && s.lastNotifiedAt.toMillis ? s.lastNotifiedAt.toMillis() : 0;
    if (!lastActive) continue;

    const daysSinceActive = (now - lastActive) / MS_PER_DAY;
    const daysSinceNotified = lastNotified ? (now - lastNotified) / MS_PER_DAY : Infinity;

    if (daysSinceActive >= INACTIVITY_DAYS && daysSinceNotified >= INACTIVITY_DAYS) {
      const name = s.name || 'Student';
      const tokenToStudentId = { [s.fcmToken]: doc.id };
      const result = await sendToTokens(
        db,
        [s.fcmToken],
        pickInactivityMessage(name, Math.floor(daysSinceActive)),
        tokenToStudentId
      );
      if (result.successCount) {
        sentCount++;
        await doc.ref.update({ lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
  }
  console.log(`📅 3-din inactivity reminder → ${sentCount} students ko bheja gaya`);
}

(async () => {
  const db = init();
  await processQueue(db);
  await sendInactivityReminders(db);
  console.log('✅ Done.');
  process.exit(0);
})().catch(err => {
  console.error('❌ Script fail ho gayi:', err);
  process.exit(1);
});
