// ─────────────────────────────────────────────────────────────────────────────
// Service Worker — Wäschen POS
// Strategy: Network-first for API, Cache-first for static assets
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_NAME = 'waschen-pos-v1';
const STATIC_CACHE = 'waschen-static-v1';

// Assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ── Install ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Silently fail if some assets not available
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // API calls: Network-first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful GET API responses (master data)
          if (response.ok && isCacheable(url.pathname)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: Cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Cache only stable master data endpoints
function isCacheable(pathname) {
  const cacheablePatterns = [
    '/api/master/outlets',
    '/api/master/area-zones',
    '/api/master/awareness',
    '/api/services',
    '/api/auth/outlets',
  ];
  return cacheablePatterns.some((p) => pathname.startsWith(p));
}

// ── Background Sync (offline queue) ──────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  // Placeholder — actual implementation would read from IndexedDB
  // and retry failed checkout requests
  console.log('[SW] Background sync triggered');
}
