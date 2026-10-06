const CACHE_NAME = "eduspark-v9";

const APP_SHELL = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// Firebase SDK + fonts: pehle ye offline me cache nahi hote the (opaque response ko
// "ok" nahi mana jaata tha) — isi wajah se internet band hone par app khulta hi nahi tha.
const CDN_ASSETS = [
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js",
  "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics-compat.js",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
];
const CDN_HOSTS = ["www.gstatic.com", "fonts.gstatic.com", "fonts.googleapis.com"];

const API_HOSTS = [
  "firestore.googleapis.com", "identitytoolkit.googleapis.com", "securetoken.googleapis.com",
  "firebaseinstallations.googleapis.com", "fcmregistrations.googleapis.com", "firebase.googleapis.com",
  "www.googleapis.com", "apis.google.com", "accounts.google.com", "firebaseio.com", "firebaseapp.com",
  "googlesyndication.com", "doubleclick.net", "googleadservices.com", "adservice.google.com",
  "google-analytics.com", "googletagmanager.com"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.all([
    ...APP_SHELL.map(u => cache.add(u).catch(() => {})),
    ...CDN_ASSETS.map(u => fetch(u, { mode: "no-cors" }).then(r => cache.put(u, r)).catch(() => {}))
  ])));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.searchParams.has("__probe")) return;                       // online-check hamesha asli network se
  if (API_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h))) return;
  const isCdn = CDN_HOSTS.includes(url.hostname);
  if (url.origin !== location.origin && !isCdn) return;              // baaki cross-origin (video/images) cache nahi

  // Stale-while-revalidate: cache se turant, background me fresh copy
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    const net = fetch(req).then(res => {
      if (res && (res.status === 200 || (isCdn && res.type === "opaque"))) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(net); return cached; }
    // Data khatam/slow net: network ka intezaar sirf 4 sec — phir cache/shell par fallback (pehle yahan page atak jaata tha)
    const res = await Promise.race([net, new Promise(r=>setTimeout(()=>r(null),4000))]);
    if (res) return res;
    if (req.mode === "navigate") { const shell = await cache.match("/index.html"); if (shell) return shell; }
    return new Response("Offline", { status: 503, statusText: "Offline" });
  })());
});

// ── PUSH (app band ho tab bhi) ──
self.addEventListener("push", event => {
  let data = { title: "EduSpark", body: "Naya update aa gaya hai! 📚" };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data = { body: event.data.text() }; }
  }
  const n = data.notification || ((data.data && (data.data.title || data.data.body)) ? data.data : data);
  const title = n.title || "EduSpark";
  const body = n.body || "";
  const url = (data.data && data.data.url) || (data.fcmOptions && data.fcmOptions.link) || "/";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    tag: "fcm-" + (title + body).slice(0, 60),   // app khuli ho to duplicate notification na bane
    data: { url }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (new URL(c.url).origin === location.origin && "focus" in c) return c.focus();
      }
      return clients.openWindow ? clients.openWindow(target) : undefined;
    })
  );
});
