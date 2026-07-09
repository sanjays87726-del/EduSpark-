const CACHE_NAME = 'eduspark-v2';
const ASSETS = [
  '/EduSpark-/',
  '/EduSpark-/index.html',
  '/EduSpark-/manifest.json'
];

// Install — files cache karo
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — purana cache delete karo
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — pehle cache check karo
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(res => {
        // Firebase aur YouTube cache mat karo
        if(e.request.url.includes('firebase') || 
           e.request.url.includes('youtube') ||
           e.request.url.includes('googleapis')) {
          return res;
        }
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => {
        // Offline hone par index.html return karo
        if(e.request.destination === 'document') {
          return caches.match('/EduSpark-/index.html');
        }
      });
    })
  );
});
