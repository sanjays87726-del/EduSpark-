// ══════════════════════════════════════════════════════════════
// EduSpark Service Worker
// PWA Cache + Firebase Cloud Messaging
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = "eduspark-v10";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Firebase SDKs
const FIREBASE_SDK = [
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js"
];

// Other CDN assets
const CDN_ASSETS = [
  ...FIREBASE_SDK,
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics-compat.js",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
];

const CDN_HOSTS = [
  "www.gstatic.com",
  "fonts.gstatic.com",
  "fonts.googleapis.com"
];

const API_HOSTS = [
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "fcmregistrations.googleapis.com",
  "firebase.googleapis.com",
  "fcm.googleapis.com",
  "www.googleapis.com",
  "apis.google.com",
  "accounts.google.com",
  "firebaseio.com",
  "firebaseapp.com",
  "googlesyndication.com",
  "doubleclick.net",
  "googleadservices.com",
  "adservice.google.com",
  "google-analytics.com",
  "googletagmanager.com"
];


// ══════════════════════════════════════════════════════════════
// FIREBASE MESSAGING
// ══════════════════════════════════════════════════════════════

importScripts(
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js"
);


// Firebase configuration
firebase.initializeApp({
  apiKey: "AIzaSyD90ruZHQ_VGuOoO__Q6PC2svRga3jyfXs",
  authDomain: "eduspark-41703.firebaseapp.com",
  projectId: "eduspark-41703",
  storageBucket: "eduspark-41703.firebasestorage.app",
  messagingSenderId: "455546882437",
  appId: "1:455546882437:web:093e07eef1d8c685915cec",
  measurementId: "G-WGP977E30D"
});

const messaging = firebase.messaging();


// Background FCM messages
// Notification payload ko Firebase khud display kar sakta hai.
// Data-only messages ke liye ye handler notification show karega.
messaging.onBackgroundMessage(function(payload) {

  console.log(
    "[EduSpark SW] Background FCM message received:",
    payload
  );

  // Agar notification payload already present hai,
  // Firebase/browser usko background me display karega.
  if (payload && payload.notification) {
    return;
  }

  const data = (payload && payload.data) || {};

  const title = data.title || "EduSpark";

  const body =
    data.body ||
    "Naya update aa gaya hai! 📚";

  const url =
    data.url ||
    "https://eduspark.de5.net/";

  return self.registration.showNotification(title, {

    body: body,

    icon: "/icon-192.png",

    badge: "/icon-192.png",

    vibrate: [200, 100, 200],

    tag:
      "eduspark-" +
      (title + body).slice(0, 80),

    data: {
      url: url
    }
  });

});


// ══════════════════════════════════════════════════════════════
// INSTALL
// ══════════════════════════════════════════════════════════════

self.addEventListener("install", function(event) {

  self.skipWaiting();

  event.waitUntil(

    caches.open(CACHE_NAME).then(function(cache) {

      return Promise.all([

        ...APP_SHELL.map(function(url) {
          return cache.add(url).catch(function() {});
        }),

        ...CDN_ASSETS.map(function(url) {

          return fetch(url, {
            mode: "no-cors"
          })
          .then(function(response) {

            return cache.put(
              url,
              response
            );

          })
          .catch(function() {});

        })

      ]);

    })

  );

});


// ══════════════════════════════════════════════════════════════
// ACTIVATE
// ══════════════════════════════════════════════════════════════

self.addEventListener("activate", function(event) {

  event.waitUntil(

    caches.keys().then(function(keys) {

      return Promise.all(

        keys
          .filter(function(key) {
            return key !== CACHE_NAME;
          })
          .map(function(key) {
            return caches.delete(key);
          })

      );

    })
    .then(function() {

      return self.clients.claim();

    })

  );

});


// ══════════════════════════════════════════════════════════════
// FETCH / OFFLINE CACHE
// ══════════════════════════════════════════════════════════════

self.addEventListener("fetch", function(event) {

  const req = event.request;

  if (req.method !== "GET") {
    return;
  }

  const url = new URL(req.url);

  // Online probe ko cache mat karo
  if (url.searchParams.has("__probe")) {
    return;
  }

  // Firebase / APIs ko service-worker cache se interfere mat karo
  if (
    API_HOSTS.some(function(host) {

      return (
        url.hostname === host ||
        url.hostname.endsWith("." + host)
      );

    })
  ) {
    return;
  }

  const isCdn =
    CDN_HOSTS.includes(url.hostname);

  // Unknown external resources ko untouched rakho
  if (
    url.origin !== location.origin &&
    !isCdn
  ) {
    return;
  }


  event.respondWith(

    (async function() {

      const cache =
        await caches.open(CACHE_NAME);

      const cached =
        await cache.match(
          req,
          {
            ignoreSearch:
              req.mode === "navigate"
          }
        );


      const network =
        fetch(req)
          .then(function(response) {

            if (
              response &&
              (
                response.status === 200 ||
                (
                  isCdn &&
                  response.type === "opaque"
                )
              )
            ) {

              cache
                .put(
                  req,
                  response.clone()
                )
                .catch(function() {});

            }

            return response;

          })
          .catch(function() {

            return null;

          });


      // Cache available → immediately return cache
      if (cached) {

        event.waitUntil(network);

        return cached;

      }


      // Network max 4 seconds
      const response =
        await Promise.race([

          network,

          new Promise(function(resolve) {

            setTimeout(function() {

              resolve(null);

            }, 4000);

          })

        ]);


      if (response) {
        return response;
      }


      // Offline navigation fallback
      if (req.mode === "navigate") {

        const shell =
          await cache.match(
            "/index.html"
          );

        if (shell) {
          return shell;
        }

      }


      return new Response(
        "Offline",
        {
          status: 503,
          statusText: "Offline"
        }
      );

    })()

  );

});


// ══════════════════════════════════════════════════════════════
// NOTIFICATION CLICK
// ══════════════════════════════════════════════════════════════

self.addEventListener(
  "notificationclick",
  function(event) {

    event.notification.close();

    const target =
      (
        event.notification.data &&
        event.notification.data.url
      ) ||
      "https://eduspark.de5.net/";


    event.waitUntil(

      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then(function(clientList) {

          // Existing EduSpark window
          for (const client of clientList) {

            try {

              const clientUrl =
                new URL(client.url);

              const targetUrl =
                new URL(target);

              if (
                clientUrl.origin ===
                targetUrl.origin
              ) {

                if ("focus" in client) {

                  return client
                    .focus()
                    .then(function() {

                      if (
                        "navigate" in client &&
                        client.url !== target
                      ) {

                        return client.navigate(
                          target
                        );

                      }

                    });

                }

              }

            } catch (e) {}

          }


          // No existing window → open EduSpark
          if (clients.openWindow) {

            return clients.openWindow(
              target
            );

          }

        })

    );

  }
);