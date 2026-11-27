/* Offline cache for Leandro's Robo Dino Island. Only same-origin files; nothing is fetched from other sites.
   Pages and code (html/js/css/manifest) are network-first with a cache fallback, so new versions show up right away when online
   and the game still works offline. Big assets (textures, sky, icons, vendored three.js) are cache-first; they are re-downloaded
   whenever this file's cache name changes. */
const CACHE = 'rdi-v5-18-0';
const FILES = ['./',
  './CREDITS.md',
  './assets/art/lion-rider.webp',
  './assets/art/lion.webp',
  './assets/art/rex-rider.webp',
  './assets/hdri/sky_1k.hdr',
  './assets/hdri/sky_2k.jpg',
  './assets/hdri/sky_4k.jpg',
  './assets/models/allo.glb',
  './assets/models/anky.glb',
  './assets/models/brachio.glb',
  './assets/models/carno.glb',
  './assets/models/dilo.glb',
  './assets/models/giga.glb',
  './assets/models/jungle-expedition-beacon.glb',
  './assets/models/leandro.glb',
  './assets/models/lion.glb',
  './assets/models/pachy.glb',
  './assets/models/para.glb',
  './assets/models/raptor.glb',
  './assets/models/spino.glb',
  './assets/models/stego.glb',
  './assets/models/swingboy-1024.glb',
  './assets/models/swingboy.glb',
  './assets/models/trex.glb',
  './assets/models/trike.glb',
  './assets/models/westie.glb',
  './assets/tex/dirt_diff.jpg',
  './assets/tex/dirt_nor.jpg',
  './assets/tex/grass_diff.jpg',
  './assets/tex/grass_nor.jpg',
  './assets/tex/metal_nor.jpg',
  './assets/tex/metal_rough.jpg',
  './assets/tex/rock_diff.jpg',
  './assets/tex/rock_nor.jpg',
  './assets/tex/sand_diff.jpg',
  './assets/tex/sand_nor.jpg',
  './assets/textures/stomp/facade-atlas-albedo.ktx2',
  './assets/textures/stomp/facade-atlas-emis.ktx2',
  './assets/textures/stomp/facade-atlas-normal.ktx2',
  './assets/textures/stomp/facade-atlas-orm.ktx2',
  './assets/textures/stomp/facade-atlas-tintmask.ktx2',
  './assets/textures/stomp/roof-cap-albedo.ktx2',
  './assets/textures/stomp/roof-cap-normal.ktx2',
  './audio/deepsea-theme.mp3',
  './audio/farm-theme.mp3',
  './audio/jungle-theme.mp3',
  './audio/sfx-chomp-water.mp3',
  './audio/sfx-coin.mp3',
  './audio/sfx-dino-roar.mp3',
  './audio/sfx-fart.mp3',
  './audio/sfx-poop-plop.mp3',
  './audio/sfx-sonar-boost.mp3',
  './audio/sfx-swing.mp3',
  './audio/sfx-torpedo.mp3',
  './audio/sfx-win.mp3',
  './audio/sfx-wrap.mp3',
  './audio/sfx-zip.mp3',
  './audio/swing-theme.mp3',
  './audio/voice-ricky-bobby-poop.mp3',
  './css/style.css',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './index.html',
  './js/allo.js',
  './js/anky.js',
  './js/art.js',
  './js/audio.js',
  './js/beast.js',
  './js/brachio.js',
  './js/carno.js',
  './js/city.js',
  './js/costume.js',
  './js/data.js',
  './js/dilo.js',
  './js/eggs.js',
  './js/expedition.js',
  './js/farm.js',
  './js/farmplus.js',
  './js/fx.js',
  './js/game.js',
  './js/giga.js',
  './js/hype.js',
  './js/input.js',
  './js/lion.js',
  './js/main.js',
  './js/mayhem.js',
  './js/mech.js',
  './js/models.js',
  './js/music.js',
  './js/noise.js',
  './js/ocean.js',
  './js/pachy.js',
  './js/para.js',
  './js/peak.js',
  './js/persona.js',
  './js/proctex.js',
  './js/raptor.js',
  './js/rider.js',
  './js/roid3d.js',
  './js/sea.js',
  './js/spino.js',
  './js/stego.js',
  './js/stomp.js',
  './js/stompAudio.js',
  './js/stompCity.js',
  './js/trex.js',
  './js/trike.js',
  './js/vendor/BufferGeometryUtils.js',
  './js/vendor/ColorSpaces.js',
  './js/vendor/GLTFLoader.js',
  './js/vendor/KTX2Loader.js',
  './js/vendor/SkeletonUtils.js',
  './js/vendor/WorkerPool.js',
  './js/vendor/basis/basis_transcoder.js',
  './js/vendor/basis/basis_transcoder.wasm',
  './js/vendor/ktx-parse.module.js',
  './js/vendor/meshopt_decoder.module.js',
  './js/vendor/three.bundle.min.js',
  './js/vendor/zstddec.module.js',
  './js/voice.js',
  './js/westie.js',
  './js/westies.js',
  './js/world.js',
  './manifest.webmanifest'];
const fresh = u => new Request(u, { cache: 'reload' }); // bypass the HTTP cache when (re)installing
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(fresh))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(async ks => {
  const old = ks.filter(k => k !== CACHE && (k.startsWith('robo-dino-island-') || k.startsWith('rdi-v'))); await Promise.all(old.map(k => caches.delete(k)));
  await self.clients.claim();
  // upgrading from an older build: reload open game windows once so they run the new version (older pages had no auto-reload)
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
  if (NET_FIRST.test(url.pathname) && !url.pathname.includes('/vendor/')) { e.respondWith(networkFirst(req, url.pathname)); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
