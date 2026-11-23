/* HerdBook offline worker: keeps the program itself on the device so it opens with no signal.
   (Records are not here - they are in the page's own storage, see store.js.)
   The live copy (/herdbook/) and the test copy (/herdbook/test/) each have their own worker and cache. */
const SCOPE = self.registration.scope;
const CH = /\/test\/$/.test(SCOPE) ? 'test' : 'live';
const CACHE = 'herdbook-' + CH + '-2.0.0';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'store.js', 'config.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('herdbook-' + CH + '-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;      // Google sign-in / Drive go straight to the internet
  if (CH === 'live' && url.href.startsWith(SCOPE + 'test/')) return;        // leave the test copy alone
  if (req.mode === 'navigate') { e.respondWith(caches.match(new URL('index.html', SCOPE).href).then(r => r || fetch(req))); return; }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
