// ══════════════════════════════════════════════════════════════
// EduSpark — Notification Sender
// ══════════════════════════════════════════════════════════════
//
// GitHub Actions ke through:
// 1. Admin broadcast notifications
// 2. 3-day inactive student reminders
//
// Firebase Cloud Messaging (FCM)
// ══════════════════════════════════════════════════════════════

const admin = require("firebase-admin");

const INACTIVITY_DAYS = 3;

const MS_PER_DAY =
  24 * 60 * 60 * 1000;

const APP_URL =
  "https://eduspark.de5.net/";


// ══════════════════════════════════════════════════════════════
// FIREBASE INIT
// ══════════════════════════════════════════════════════════════

function init() {

  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {

    console.error(
      "❌ FIREBASE_SERVICE_ACCOUNT secret nahi mila."
    );

    process.exit(1);

  }


  let serviceAccount;

  try {

    serviceAccount =
      JSON.parse(raw);

  } catch (error) {

    console.error(
      "❌ FIREBASE_SERVICE_ACCOUNT valid JSON nahi hai."
    );

    console.error(error);

    process.exit(1);

  }


  admin.initializeApp({

    credential:
      admin.credential.cert(
        serviceAccount
      )

  });


  return admin.firestore();

}


// ══════════════════════════════════════════════════════════════
// SEND FCM
// ══════════════════════════════════════════════════════════════

async function sendToTokens(
  db,
  tokens,
  notification,
  tokenToStudentId
) {

  if (!tokens.length) {

    return {
      successCount: 0,
      failureCount: 0
    };

  }


  const CHUNK = 500;

  let successCount = 0;
  let failureCount = 0;


  for (
    let i = 0;
    i < tokens.length;
    i += CHUNK
  ) {

    const chunk =
      tokens.slice(
        i,
        i + CHUNK
      );


    const response =
      await admin.messaging()
        .sendEachForMulticast({

          tokens: chunk,

          // Notification payload
          notification: {

            title:
              notification.title ||
              "EduSpark",

            body:
              notification.body ||
              ""

          },


          // Web-specific settings
          webpush: {

            headers: {

              Urgency: "high"

            },


            notification: {

              title:
                notification.title ||
                "EduSpark",

              body:
                notification.body ||
                "",

              icon:
                "/icon-192.png",

              badge:
                "/icon-192.png",

              vibrate:
                [200, 100, 200],

              requireInteraction:
                false

            },


            fcmOptions: {

              link:
                APP_URL

            }

          },


          // Extra data
          data: {

            title:
              String(
                notification.title ||
                "EduSpark"
              ),

            body:
              String(
                notification.body ||
                ""
              ),

            url:
              APP_URL

          }

        });


    successCount +=
      response.successCount;

    failureCount +=
      response.failureCount;


    // ════════════════════════════════════════════════════════
    // INVALID TOKEN CLEANUP
    // ════════════════════════════════════════════════════════

    const cleanupBatch =
      db.batch();

    let cleanupCount = 0;


    response.responses.forEach(
      function(result, index) {

        if (result.success) {
          return;
        }


        const code =
          result.error &&
          result.error.code;


        if (
          code ===
            "messaging/registration-token-not-registered" ||

          code ===
            "messaging/invalid-registration-token"
        ) {

          const token =
            chunk[index];

          const studentId =
            tokenToStudentId[
              token
            ];


          if (studentId) {

            cleanupBatch.update(

              db
                .collection("students")
                .doc(studentId),

              {

                fcmToken:
                  admin
                    .firestore
                    .FieldValue
                    .delete()

              }

            );

            cleanupCount++;

          }

        }

      }
    );


    if (cleanupCount > 0) {

      await cleanupBatch.commit();

      console.log(
        `🧹 ${cleanupCount} invalid FCM token cleanup`
      );

    }

  }


  return {
    successCount,
    failureCount
  };

}


// ══════════════════════════════════════════════════════════════
// PART 1 — ADMIN BROADCAST
// ══════════════════════════════════════════════════════════════

async function processQueue(db) {

  const snap =
    await db
      .collection("notificationQueue")
      .where(
        "status",
        "==",
        "pending"
      )
      .get();


  if (snap.empty) {

    console.log(
      "ℹ️ Koi pending broadcast nahi."
    );

    return;

  }


  const studentsSnap =
    await db
      .collection("students")
      .get();


  const allStudents =
    studentsSnap.docs.map(
      function(doc) {

        return {
          id: doc.id,
          ...doc.data()
        };

      }
    );


  for (const doc of snap.docs) {

    const q =
      doc.data();


    const targets =
      q.audience &&
      q.audience !== "all"

        ? allStudents.filter(
            function(student) {

              return (
                student.board ===
                q.audience
              );

            }
          )

        : allStudents;


    const tokens = [];

    const tokenToStudentId = {};


    targets.forEach(
      function(student) {

        if (
          student.fcmToken
        ) {

          tokens.push(
            student.fcmToken
          );

          tokenToStudentId[
            student.fcmToken
          ] =
            student.id;

        }

      }
    );


    console.log(
      `📢 Broadcast: ${q.title}`
    );

    console.log(
      `👥 Target students: ${targets.length}`
    );

    console.log(
      `📱 FCM tokens: ${tokens.length}`
    );


    const result =
      await sendToTokens(

        db,

        tokens,

        {

          title:
            q.title ||
            "EduSpark",

          body:
            q.body ||
            ""

        },

        tokenToStudentId

      );


    console.log(
      `📤 FCM result → ${result.successCount} success, ${result.failureCount} failed`
    );


    await doc.ref.update({

      status:
        "sent",

      sentAt:
        admin
          .firestore
          .FieldValue
          .serverTimestamp(),

      sentCount:
        result.successCount,

      failureCount:
        result.failureCount

    });

  }

}


// ══════════════════════════════════════════════════════════════
// INACTIVITY MESSAGE
// ══════════════════════════════════════════════════════════════

function pickInactivityMessage(
  name,
  days
) {

  const firstName =
    String(
      name || "Student"
    )
      .trim()
      .split(/\s+/)[0];


  const pool = [

    [
      `${firstName}, आपकी किताबें आपको याद कर रही हैं 📖`,
      `${days} दिन हो गए! आज सिर्फ़ 10 मिनट पढ़ें — बड़ी सफलता छोटे कदमों से ही मिलती है।`
    ],

    [
      `${firstName}, आज का Quiz आपका इंतज़ार कर रहा है 🧩`,
      `अपनी तैयारी परखें और अपना score बढ़ाएँ। आप जितना सोचते हैं, उससे ज़्यादा कर सकते हैं!`
    ],

    [
      `वापस आइए ${firstName}! 🔥`,
      `Topper बनने के लिए रोज़ थोड़ा-थोड़ा काफ़ी है। आज एक chapter revise कर लें।`
    ],

    [
      `${firstName}, आपका सपना इंतज़ार नहीं करेगा ⏳`,
      `आज की मेहनत कल का रिज़ल्ट बनेगी। EduSpark खोलें और शुरू करें!`
    ],

    [
      `${firstName}, बस एक PYQ paper! 📜`,
      `पिछले साल के सवाल हल करके exam का pattern समझें — आज ही शुरुआत करें।`
    ],

    [
      `${firstName}, आप कर सकते हैं! 💪`,
      `${days} दिन का gap कोई बात नहीं — आज से फिर शुरू करें, हम आपके साथ हैं।`
    ]

  ];


  const message =
    pool[
      Math.floor(
        Math.random() *
        pool.length
      )
    ];


  return {

    title:
      message[0],

    body:
      message[1]

  };

}


// ══════════════════════════════════════════════════════════════
// PART 2 — 3 DAY INACTIVE REMINDERS
// ══════════════════════════════════════════════════════════════

async function sendInactivityReminders(
  db
) {

  const snap =
    await db
      .collection("students")
      .get();


  if (snap.empty) {

    console.log(
      "ℹ️ Koi registered student nahi mila."
    );

    return;

  }


  const now =
    Date.now();


  let sentCount = 0;


  for (const doc of snap.docs) {

    const student =
      doc.data();


    if (!student.fcmToken) {
      continue;
    }


    const lastActive =
      student.lastActive &&
      student.lastActive.toMillis
        ? student.lastActive.toMillis()
        : 0;


    const lastNotified =
      student.lastNotifiedAt &&
      student.lastNotifiedAt.toMillis
        ? student.lastNotifiedAt.toMillis()
        : 0;


    if (!lastActive) {
      continue;
    }


    const daysSinceActive =
      (
        now -
        lastActive
      ) /
      MS_PER_DAY;


    const daysSinceNotified =
      lastNotified
        ? (
            now -
            lastNotified
          ) /
          MS_PER_DAY
        : Infinity;


    if (
      daysSinceActive >=
        INACTIVITY_DAYS &&

      daysSinceNotified >=
        INACTIVITY_DAYS
    ) {

      const name =
        student.name ||
        "Student";


      const token =
        student.fcmToken;


      const tokenToStudentId = {

        [token]:
          doc.id

      };


      const result =
        await sendToTokens(

          db,

          [token],

          pickInactivityMessage(
            name,
            Math.floor(
              daysSinceActive
            )
          ),

          tokenToStudentId

        );


      if (
        result.successCount >
        0
      ) {

        sentCount++;


        await doc.ref.update({

          lastNotifiedAt:
            admin
              .firestore
              .FieldValue
              .serverTimestamp()

        });

      }

    }

  }


  console.log(
    `📅 3-day inactivity reminder → ${sentCount} students ko bheja gaya`
  );

}


// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

(async function() {

  try {

    const db =
      init();


    await processQueue(
      db
    );


    await sendInactivityReminders(
      db
    );


    console.log(
      "✅ EduSpark notifications completed successfully."
    );


    process.exit(0);

  } catch (error) {

    console.error(
      "❌ Notification script failed:"
    );

    console.error(
      error
    );


    process.exit(1);

  }

})();