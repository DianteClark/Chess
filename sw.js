// Knight Club service worker: makes the app installable and playable offline.
// The page itself is fetched network-first (so updates arrive right away);
// the engine files and icons are cache-first (they rarely change).
const CACHE = 'knightclub-v13';
const CORE = ['./', './index.html', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './manifest.webmanifest',
  './fonts/lilita-one-latin-400-normal.woff2', './fonts/atkinson-hyperlegible-latin-400-normal.woff2', './fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  './vendor/stockfish/stockfish-19-lite-single.js', './vendor/stockfish/stockfish-19-lite-single.wasm'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // lobby, fonts: straight to network
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isPage) {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  if (url.pathname.includes('/data/i18n/')) { // translations: fresh when online, cached for offline
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
});
