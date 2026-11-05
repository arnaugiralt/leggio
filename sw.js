// The page shell is network-first, so a deploy (or a dev rebuild) is never shadowed by a stale copy and the
// cache only matters offline. Hashed bundles under assets/ never change, so they are served from the cache.
// build.mjs rewrites the next two lines for site/: a cache name per build, and the hashed file names.
const CACHE = 'leggio'
const SHELL = ['./', './index.html', './dist/app.js', './dist/app.css', './manifest.json', './icon-192.png', './icon-512.png']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

// A new build brings a new cache name; the old caches only hold bundles nothing points at any more.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  // Cross-origin requests (Google Fonts, images in documents) go straight to the network under the page's own
  // rules; fetching them from here would put them under the worker's content security policy instead.
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(e.request).then(hit => hit ?? fetch(e.request).then(res => store(e.request, res))))
    return
  }
  e.respondWith(
    fetch(e.request)
      .then(res => store(e.request, res))
      .catch(async () => (await caches.match(e.request)) ?? (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)),
  )
})

function store(request, res) {
  if (res.ok) {
    const copy = res.clone()
    caches.open(CACHE).then(c => c.put(request, copy))
  }
  return res
}
