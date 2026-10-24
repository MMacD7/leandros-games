# Regenerates sw.js with the full precache list + a content hash version.
import os, hashlib
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = []
for d, _, fs in os.walk(root):
    rel = os.path.relpath(d, root)
    if rel.split(os.sep)[0] in ('screenshots', 'tools', '.git'): continue
    for f in fs:
        if f in ('sw.js', 'README.md', 'PROGRESS.md') or f.endswith('.txt'): continue
        files.append(os.path.normpath(os.path.join(rel, f)).replace(os.sep, '/'))
files.sort()
h = hashlib.sha1()
for f in files: h.update(open(os.path.join(root, f), 'rb').read())
ver = h.hexdigest()[:10]
lst = ',\n  '.join("'./%s'" % f for f in files)
open(os.path.join(root, 'sw.js'), 'w').write(f"""/* Offline cache for Leandro's Robo Dino Island. Only same-origin files; nothing is fetched from other sites.
   Pages and code (html/js/css/manifest) are network-first with a cache fallback, so new versions show up right away when online
   and the game still works offline. Big assets (textures, sky, icons, vendored three.js) are cache-first; they are re-downloaded
   whenever this file's cache name changes. */
const CACHE = 'robo-dino-island-{ver}';
const FILES = ['./',
  {lst}];
const fresh = u => new Request(u, {{ cache: 'reload' }}); // bypass the HTTP cache when (re)installing
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(fresh))).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(async ks => {{
  const old = ks.filter(k => k !== CACHE && k.startsWith('robo-dino-island-')); await Promise.all(old.map(k => caches.delete(k)));
  await self.clients.claim();
  // upgrading from an older build: reload open game windows once so they run the new version (older pages had no auto-reload)
  if (old.length) for (const c of await self.clients.matchAll({{ type: 'window' }})) {{ try {{ c.navigate(c.url); }} catch (err) {{ }} }}
}})); }});
const NET_FIRST = /\\.(html|js|css|webmanifest)$/;
function networkFirst(req, key) {{
  const net = fetch(req.url, {{ cache: 'no-cache', credentials: 'same-origin' }}).then(res => {{
    if (res && res.ok) {{ const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }}
    return res;
  }});
  const timeout = new Promise(r => setTimeout(r, 4000));
  const cached = () => caches.match(key, {{ ignoreSearch: true }}).then(h => h || caches.match('./index.html'));
  return Promise.race([net.catch(() => null), timeout]).then(res => res || cached().then(h => h || net));
}}
self.addEventListener('fetch', e => {{
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {{ e.respondWith(networkFirst(req, url.pathname.endsWith('/') ? './' : url.pathname)); return; }}
  if (NET_FIRST.test(url.pathname) && !url.pathname.includes('/vendor/')) {{ e.respondWith(networkFirst(req, url.pathname)); return; }}
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then(hit => hit || fetch(req).then(res => {{
    if (res && res.ok) {{ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }}
    return res;
  }})));
}});
""")
print(ver, len(files), 'files')
