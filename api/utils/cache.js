// ─────────────────────────────────────────────────────────────────────────────
// Cache facade — auto-detect Redis kalau REDIS_URL diset, fallback ke memory.
// ─────────────────────────────────────────────────────────────────────────────
// Untuk single-instance deployment, in-memory cukup.
// Untuk multi-instance (load balancer, k8s, multiple PM2), set REDIS_URL.
// Switching otomatis tanpa ubah controller/route.
//
// Cara pakai:
//   import cache from '../utils/cache.js';
//   const data = await cache.wrap('outlets:active', 60_000, async () => {
//     const [rows] = await pool.execute('...');
//     return rows;
//   });
//   cache.invalidate('outlets:*');
// ─────────────────────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════════════
// Memory backend
// ════════════════════════════════════════════════════════════════════════════
function createMemoryBackend({ maxKeys = 500 } = {}) {
  const store = new Map();
  const inflight = new Map();

  function gc() {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.expiresAt && v.expiresAt < now) store.delete(k);
    }
    if (store.size > maxKeys) {
      const overflow = store.size - maxKeys;
      let i = 0;
      for (const k of store.keys()) {
        if (i++ >= overflow) break;
        store.delete(k);
      }
    }
  }

  if (typeof setInterval !== 'undefined') {
    setInterval(gc, 5 * 60 * 1000).unref?.();
  }

  return {
    name: 'memory',
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlMs) {
      if (store.size >= maxKeys) gc();
      store.set(key, { value, expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0 });
    },
    async del(key) {
      store.delete(key);
    },
    async invalidate(pattern) {
      if (!pattern.endsWith('*')) {
        store.delete(pattern);
        return 1;
      }
      const prefix = pattern.slice(0, -1);
      let count = 0;
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) { store.delete(k); count++; }
      }
      return count;
    },
    async clear() {
      store.clear();
      inflight.clear();
    },
    stats() {
      return { backend: 'memory', keys: store.size, inflight: inflight.size, maxKeys };
    },
    inflight, // expose untuk request coalescing di facade
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Redis backend (optional, butuh package ioredis terinstal)
// ════════════════════════════════════════════════════════════════════════════
async function createRedisBackend(redisUrl) {
  let IORedis;
  try {
    const mod = await import('ioredis');
    IORedis = mod.default || mod;
  } catch {
    console.warn('[cache] REDIS_URL set tetapi ioredis tidak terinstal. Jalankan: npm install ioredis');
    return null;
  }

  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  client.on('error', (err) => {
    console.error('[cache:redis] error:', err.message);
  });
  client.on('connect', () => {
    console.log('[cache:redis] connected to', redisUrl.replace(/:[^:@]+@/, ':****@'));
  });

  const PREFIX = process.env.CACHE_PREFIX || 'waschen:';

  const inflight = new Map();

  return {
    name: 'redis',
    async get(key) {
      try {
        const raw = await client.get(PREFIX + key);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.error('[cache:redis] get error:', err.message);
        return null;
      }
    },
    async set(key, value, ttlMs) {
      try {
        const raw = JSON.stringify(value);
        if (ttlMs > 0) {
          await client.set(PREFIX + key, raw, 'PX', ttlMs);
        } else {
          await client.set(PREFIX + key, raw);
        }
      } catch (err) {
        console.error('[cache:redis] set error:', err.message);
      }
    },
    async del(key) {
      try { await client.del(PREFIX + key); }
      catch (err) { console.error('[cache:redis] del error:', err.message); }
    },
    async invalidate(pattern) {
      try {
        if (!pattern.endsWith('*')) {
          await client.del(PREFIX + pattern);
          return 1;
        }
        // Pakai SCAN supaya tidak block Redis (KEYS command bahaya di prod)
        const matchPattern = PREFIX + pattern;
        let cursor = '0';
        let count = 0;
        do {
          const [next, keys] = await client.scan(cursor, 'MATCH', matchPattern, 'COUNT', 200);
          if (keys.length > 0) {
            await client.del(...keys);
            count += keys.length;
          }
          cursor = next;
        } while (cursor !== '0');
        return count;
      } catch (err) {
        console.error('[cache:redis] invalidate error:', err.message);
        return 0;
      }
    },
    async clear() {
      try {
        const keys = await client.keys(PREFIX + '*');
        if (keys.length) await client.del(...keys);
        inflight.clear();
      } catch (err) {
        console.error('[cache:redis] clear error:', err.message);
      }
    },
    stats() {
      return { backend: 'redis', prefix: PREFIX, inflight: inflight.size };
    },
    inflight,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Bootstrap backend
// ════════════════════════════════════════════════════════════════════════════
let backend = createMemoryBackend();

if (process.env.REDIS_URL) {
  // Async init — sampai siap, kita pakai memory dulu (hot start)
  createRedisBackend(process.env.REDIS_URL).then((redis) => {
    if (redis) {
      backend = redis;
      console.log('[cache] backend switched to Redis');
    } else {
      console.log('[cache] tetap pakai memory backend (Redis tidak available)');
    }
  });
} else {
  console.log('[cache] backend: memory (set REDIS_URL untuk pakai Redis)');
}

// ════════════════════════════════════════════════════════════════════════════
// Public facade
// ════════════════════════════════════════════════════════════════════════════
export const cache = {
  /** Get raw value (null kalau tidak ada / expired) */
  async get(key) {
    return backend.get(key);
  },

  /** Set value dengan TTL ms (0 = no expire) */
  async set(key, value, ttlMs = 60_000) {
    return backend.set(key, value, ttlMs);
  },

  /** Hapus 1 key */
  async del(key) {
    return backend.del(key);
  },

  /** Hapus banyak key by pattern (prefix*) — contoh: 'outlets:*' */
  async invalidate(pattern) {
    return backend.invalidate(pattern);
  },

  /**
   * Wrap async fetcher dengan cache + request coalescing.
   * Kalau 2 request bersamaan dengan key sama, hanya 1 yang panggil database.
   */
  async wrap(key, ttlMs, fetcher) {
    const cached = await backend.get(key);
    if (cached !== null && cached !== undefined) return cached;

    if (backend.inflight.has(key)) return backend.inflight.get(key);

    const promise = (async () => {
      try {
        const value = await fetcher();
        await backend.set(key, value, ttlMs);
        return value;
      } finally {
        backend.inflight.delete(key);
      }
    })();
    backend.inflight.set(key, promise);
    return promise;
  },

  /** Statistik untuk monitoring/debug */
  stats() {
    return backend.stats();
  },

  /** Clear semua cache (untuk test atau emergency) */
  async clear() {
    return backend.clear();
  },

  /** Backend name (untuk health check / debug) */
  get backendName() {
    return backend.name;
  },
};

export default cache;
