/* Offline cache for Leandro's Robo Dino Island. Only same-origin files; nothing is fetched from other sites. */
const CACHE = 'robo-dino-island-808d347c6b';
const FILES = ['./',
  './assets/hdri/sky_1k.hdr',
  './assets/hdri/sky_2k.jpg',
  './assets/hdri/sky_4k.jpg',
  './assets/tex/dirt_diff.jpg',
  './assets/tex/grass_diff.jpg',
  './assets/tex/grass_nor.jpg',
  './assets/tex/metal_nor.jpg',
  './assets/tex/metal_rough.jpg',
  './assets/tex/rock_diff.jpg',
  './assets/tex/rock_nor.jpg',
  './assets/tex/sand_diff.jpg',
  './assets/tex/sand_nor.jpg',
  './css/style.css',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './js/audio.js',
  './js/beast.js',
  './js/data.js',
  './js/fx.js',
  './js/game.js',
  './js/input.js',
  './js/main.js',
  './js/mech.js',
  './js/noise.js',
  './js/proctex.js',
  './js/vendor/three.bundle.min.js',
  './js/world.js',
  './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
