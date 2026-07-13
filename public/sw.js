/* Minimal app-shell service worker (spec §7.1/§7.3).
   Caches the shell on install; network-first for navigation with cache
   fallback so the app opens offline. Data freshness indicators are handled
   in-app — the SW never serves stale API data as live. */
const CACHE = 'idn-shell-v1'
const SHELL = ['/', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((hit) => hit ?? caches.match('/')))
  )
})
