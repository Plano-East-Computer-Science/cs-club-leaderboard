/*
 * Minimal service worker: lets the site install and load its shell offline.
 *  - /api/* and /gw/*: straight to the network, never cached (accounts, rooms).
 *  - Navigations: network first, fall back to the cached shell when offline.
 *  - Static files (hashed assets, icons, /pyodide): cache on first use. The
 *    Pyodide files are large, so they are never fetched on install.
 * Bump VERSION to drop old caches.
 */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/gw/') || url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put('/', res.clone()));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
          return res;
        })
    )
  );
});
