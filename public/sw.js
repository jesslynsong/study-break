const CACHE = 'study-break-shell-v7-event-name';
const ASSETS = ['./', './index.html', './style.css', './upgrade.css', './doodle.css', './assets/study-break-doodle.png', './assets/fonts/kalam-400.ttf', './assets/fonts/kalam-700.ttf', './site.mjs', './dashboard.mjs', './api.mjs', './core.mjs', './interest-v2.mjs', './event.json', './icon.svg', './manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('study-break-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Availability and private organiser data must never be served from an offline cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  // Update whenever online; the complete pre-cached shell is the offline fallback.
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(request, { ignoreSearch: true })) ||
    (request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
