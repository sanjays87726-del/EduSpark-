const CACHE_NAME = "eduspark-v4";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copy);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ══════════════════════════════════════════
// PUSH NOTIFICATIONS
// (GitHub Actions job FCM ke through push bhejta hai — yahan use
// notification ki tarah dikhaya jaata hai, chahe app khuli ho ya band)
// ══════════════════════════════════════════
self.addEventListener("push", event => {
  let data = { title: "EduSpark", body: "Naya update aa gaya hai! 📚" };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  // FCM data-message aane par title/body notification key ke andar bhi ho sakte hain
  const title = data.notification?.title || data.title || "EduSpark";
  const body = data.notification?.body || data.body || "";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "https://raw.githubusercontent.com/sanjays87726-del/EduSpark-/main/icon-192.png",
      badge: "https://raw.githubusercontent.com/sanjays87726-del/EduSpark-/main/icon-192.png",
      vibrate: [200, 100, 200],
      data: { url: "/EduSpark-/" }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/EduSpark-/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes("EduSpark-") && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
