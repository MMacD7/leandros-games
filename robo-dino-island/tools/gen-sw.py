# Regenerates sw.js with the full precache list + a content hash version.
import os, hashlib
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = []
for d, _, fs in os.walk(root):
    rel = os.path.relpath(d, root)
    if rel.split(os.sep)[0] in ('screenshots', 'tools', '.git'): continue
    for f in fs:
        if f in ('sw.js', 'README.md') or f.endswith('.txt'): continue
        files.append(os.path.normpath(os.path.join(rel, f)).replace(os.sep, '/'))
files.sort()
h = hashlib.sha1()
for f in files: h.update(open(os.path.join(root, f), 'rb').read())
ver = h.hexdigest()[:10]
lst = ',\n  '.join("'./%s'" % f for f in files)
open(os.path.join(root, 'sw.js'), 'w').write(f"""/* Offline cache for Leandro's Robo Dino Island. Only same-origin files; nothing is fetched from other sites. */
const CACHE = 'robo-dino-island-{ver}';
const FILES = ['./',
  {lst}];
self.addEventListener('install', e => {{ e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); }});
self.addEventListener('activate', e => {{ e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); }});
self.addEventListener('fetch', e => {{
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.match(req, {{ ignoreSearch: true }}).then(hit => hit || fetch(req).then(res => {{
    if (res && res.ok) {{ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }}
    return res;
  }}).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
}});
""")
print(ver, len(files), 'files')
