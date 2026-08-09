/* Woofa's Games — network-first for HTML/JS so updates aren't stuck offline. */
const CACHE = 'woofa-games-v54';
const ASSETS = [
  './',
  './index.html',
  './trophies.html',
  './fetch.html',
  './snake.html',
  './sheep.html',
  './shear.html',
  './farm.html',
  './tractor.html',
  './trials.html',
  './fishing.html',
  './wrestling.html',
  './style.css',
  './game.js',
  './tractor.js',
  './trials.js',
  './fishing.js',
  './snake.js',
  './sheep.js',
  './shear.js',
  './farm.js',
  './wrestling.js',
  './manifest.webmanifest',
  './icon.svg',
  './icon-maskable.svg',
  './assets/woofa_frame.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isHTML(req) {
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate') return true;
  if (accept.includes('text/html')) return true;
  const path = new URL(req.url).pathname;
  return path.endsWith('.html') || path.endsWith('/');
}

function isCode(req) {
  const path = new URL(req.url).pathname;
  return path.endsWith('.js') || path.endsWith('.css');
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML + JS + CSS: network first so broken caches don't stick
  if (isHTML(request) || isCode(request)) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Other assets: cache first
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
