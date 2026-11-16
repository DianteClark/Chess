// Knight Club service worker: makes the app installable and playable offline.
// - The page is network-first with a short timeout (a slow phone network never leaves a blank
//   screen: after 3.5 s the cached copy is shown and the fresh one is saved for next time).
// - Fonts, icons and engines are cache-first (they rarely change); the big variant engine
//   (vendor/fairy) is cached the first time a World Game is opened, not at install.
// - Translations are network-first and cached for offline.
// - A new version waits until the page says so (the "New version ready, Reload" toast in boot.js).
const VERSION = 'v15';
const CACHE = 'knightclub-' + VERSION;
const CORE = ['./', './index.html', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './manifest.webmanifest',
  './fonts/lilita-one-latin-400-normal.woff2', './fonts/atkinson-hyperlegible-latin-400-normal.woff2', './fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  './fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  './vendor/stockfish/stockfish-19-lite-single.js', './vendor/stockfish/stockfish-19-lite-single.wasm'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
    // first install: take over at once; an update waits for the page to ask (no surprise reloads mid-game)
    .then(() => self.registration.active ? null : self.skipWaiting()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting' || (e.data && e.data.type === 'SKIP_WAITING')) self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('knightclub-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (key, res) => { if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); } return res; };
function pageResponse(req) {
  const net = fetch(req).then(res => put('./index.html', res));
  const cached = () => caches.match('./index.html').then(r => r || caches.match('./'));
  const timeout = new Promise(res => setTimeout(res, 3500)).then(() => cached());
  // whichever answers first with something usable wins; if the network fails outright, use the cache
  return Promise.race([net.catch(cached), timeout.then(r => r || net)]).then(r => r || net).catch(() => cached());
}
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // lobby and other sites: straight to network
  if (req.headers.has('range')) return; // media range requests are not cacheable
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (isPage) { e.respondWith(pageResponse(req)); return; }
  if (url.pathname.includes('/data/i18n/')) { // translations: fresh when online, cached for offline
    e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => put(req, res))));
});
