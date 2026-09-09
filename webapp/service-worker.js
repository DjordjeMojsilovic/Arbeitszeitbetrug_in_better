/**
 * Minimal offline app-shell cache. No backend, no database — this only
 * lets the installed app open without a network connection. Online P2P
 * play still needs internet for the initial WebRTC handshake.
 */
const CACHE_NAME = 'arcade-casino-shell-v6';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  '../lib/peerjs.min.js',
  '../src/core/cards.js',
  '../src/core/wallet.js',
  '../src/core/ledger.js',
  '../src/core/board-games.js',
  '../src/core/casino-games.js',
  '../src/core/p2p.js',
  '../src/ui/theme.js',
  '../src/ui/icons.js',
  '../src/ui/casino-panels.js',
  '../src/ui/app.js',
  '../src/entry-webapp.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return res;
    }).catch(() => cached))
  );
});
