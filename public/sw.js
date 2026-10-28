/* Public learning content only. Account data and Auth responses never enter Cache API. */
const CACHE = 'finlab-public-0.1.0';
const publicPage = (path) =>
  path === '/' ||
  /^\/(path|lab|library|onboarding)\/?$/.test(path) ||
  /^\/lesson\/[a-z0-9-]+\/?$/.test(path);
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png']),
      ),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('finlab-public-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_PAGE') return;
  const url = new URL(event.data.url, self.location.origin);
  if (url.origin !== self.location.origin || !publicPage(url.pathname)) return;
  event.waitUntil(
    fetch(url.pathname, { credentials: 'omit', headers: { Accept: 'text/html' } })
      .then(async (response) => {
        if (response.ok && response.headers.get('content-type')?.includes('text/html'))
          await (await caches.open(CACHE)).put(url.pathname, response);
      })
      .catch(() => {}),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (response.ok && publicPage(url.pathname))
            await cache.put(url.pathname, response.clone());
          return response;
        } catch {
          return (
            (publicPage(url.pathname) && (await cache.match(url.pathname))) ||
            (await cache.match('/offline.html'))
          );
        }
      })(),
    );
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const stored = await cache.match(request);
        if (stored) return stored;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })(),
    );
  }
});
