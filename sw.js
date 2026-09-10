// ponytail: network-first, not cache-first. The dev server always wins, so a rebuild is never
// shadowed by a stale bundle, and the cache is only there for offline. Switch to cache-first
// if the app is ever served from a CDN and startup latency starts to matter.
const CACHE = 'md-reader'
const SHELL = ['./', './index.html', './dist/app.js', './dist/app.css', './manifest.json', './icon-192.png', './icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cross-origin font responses are opaque (ok === false) and the browser caches them itself.
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, copy))
        }
        return res
      })
      .catch(async () => (await caches.match(e.request)) ?? (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)),
  )
})
