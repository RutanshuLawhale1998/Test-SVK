/* Nukad Coffee — offline shell.
   Caches the page itself so the corner opens without a signal. Track data and
   YouTube are always fetched live: a cached reel would be a stale tape. */

const CACHE = 'nukad-shell-v1';
const SHELL = [
  '/', '/index.html', '/styles.css', '/app.js', '/art.js',
  '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => { /* a missing file must not block the install */ })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;      // never touch YouTube
  if (url.pathname.startsWith('/api/')) return;    // reels stay live

  /* shell: cache first, then network, refreshing the copy in the background */
  e.respondWith(
    caches.match(e.request).then(hit => {
      const fresh = fetch(e.request)
        .then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    })
  );
});
