// Keeps a copy of the game on the phone so the installed app opens without internet.
// Bump VERSION whenever the game's files change, so phones fetch the new copy.
const VERSION = 'musical-wits-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/style.css', 'fonts/fonts.css', 'fonts/dm-sans.woff2', 'fonts/monoton.woff2', 'fonts/righteous.woff2',
  'js/tunes.js', 'js/storage.js', 'js/audio.js', 'js/rounds.js', 'js/library.js', 'js/screens.js', 'js/app.js', 'js/online.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Try the network first so updates show up, and fall back to the saved copy when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    })
    .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
});
