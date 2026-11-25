const CACHE = 'kufix-public-v2';
const PUBLIC_PAGES = ['/', '/services', '/about', '/become-a-provider'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_PAGES))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/login') || url.pathname.startsWith('/signup') || url.pathname.startsWith('/request-quote') || url.pathname.startsWith('/contact') || url.pathname.startsWith('/professionals')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { if (response.ok && PUBLIC_PAGES.includes(url.pathname)) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; }).catch(() => caches.match(request).then(cached => cached || caches.match('/'))));
  } else if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/icon-')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; })));
  }
});