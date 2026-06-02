// ═══════════════════════════════════════════════════════════════════════════════
// Waschen POS — Service Worker
// Strategy: Network-First for API, Cache-First for static assets
// Tidak mengganggu performa — justru mempercepat load & handle offline
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_NAME = 'waschen-v1';
const STATIC_CACHE = 'waschen-static-v1';
const API_CACHE = 'waschen-api-v1';

// Static assets yang di-precache saat install
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PUT/PATCH/DELETE harus selalu ke network)
  if (request.method !== 'GET') return;

  // Skip chrome-extension, ws://, etc
  if (!url.protocol.startsWith('http')) return;

  // ── API requests: Network-First ──
  // Coba network dulu, kalau gagal fallback ke cache (untuk GET saja)
  if (url.pathname.startsWith('/api/')) {
    // Hanya cache GET API yang "safe" (master data, dashboard stats)
    const cachableAPIs = [
      '/api/health',
      '/api/master/',
      '/api/outlets',
      '/api/services',
    ];
    const shouldCacheAPI = cachableAPIs.some((p) => url.pathname.startsWith(p));

    if (shouldCacheAPI) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(API_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match(request))
      );
    }
    // Non-cachable API: just let it through (no interception)
    return;
  }

  // ── Static assets: Cache-First ──
  // JS, CSS, images, fonts — serve from cache, update in background
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|ico)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached); // If network fails, use cached

        return cached || fetchPromise;
      })
    );
    return;
  }

  // ── HTML navigation: Network-First with offline fallback ──
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }
});

// ─── MESSAGE: Manual cache clear ─────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
  }
});
