/* Offline cache. Everything is local; nothing is fetched from other sites.
   Pages/code are network-first with a cache fallback (new versions show up right away, still works offline); icons are cache-first. */
const CACHE = 'leandros-dino-world-v3';
const FILES = ['./', './index.html', './css/style.css', './js/data.js', './js/audio.js', './js/art.js', './js/island.js', './js/runner.js', './js/main.js',
  './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];
const fresh = u => new Request(u, { cache: 'reload' });
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(fresh))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(async ks => {
  const old = ks.filter(k => k !== CACHE && k.startsWith('leandros-dino-world')); await Promise.all(old.map(k => caches.delete(k)));
  await self.clients.claim();
  if (old.length) for (const c of await self.clients.matchAll({ type: 'window' })) { try { c.navigate(c.url); } catch (err) { } }
})); });
const NET_FIRST = /\.(html|js|css|webmanifest)$/;
function networkFirst(req, key) {
  const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
    return res;
  });
  const timeout = new Promise(r => setTimeout(r, 4000));
  const cached = () => caches.match(key, { ignoreSearch: true }).then(h => h || caches.match('./index.html'));
  return Promise.race([net.catch(() => null), timeout]).then(res => res || cached().then(h => h || net));
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, url.pathname.endsWith('/') ? './' : url.pathname)); return; }
  if (NET_FIRST.test(url.pathname)) { e.respondWith(networkFirst(req, url.pathname)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
