// Seen History service worker — caches the app shell so it opens offline
// and makes the app installable. Only same-origin requests are cached;
// poster images from IMDb/TVMaze always come from the network.
//
// Update policy: bump CACHE on every release so the new worker installs,
// deletes the old cache and serves the fresh files. Page navigations are
// network-first (fresh HTML when online, cached page when offline), so a
// new release shows up on the next visit instead of serving a stale page.
const CACHE = 'seen-history-v3'
const ASSETS = [
  '/seen-history/',
  '/seen-history/index.html',
  '/seen-history/manifest.webmanifest',
  '/seen-history/icon-192.png',
  '/seen-history/icon-512.png',
  '/seen-history/icon-maskable-512.png',
  '/seen-history/icon-180.png',
  '/seen-history/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // cache:'reload' forces a real network fetch, never a stale HTTP cache
      .then((cache) => Promise.all(ASSETS.map((u) => cache.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (new URL(event.request.url).origin !== self.location.origin) return

  // Navigations (the page itself): fresh HTML when online, cached page when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return res
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/seen-history/index.html'))),
    )
    return
  }

  // Other same-origin files (icons, manifest, favicon): cache-first.
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return res
        }),
    ),
  )
})
