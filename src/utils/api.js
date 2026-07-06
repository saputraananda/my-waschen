import axios from 'axios';

const AUTH_TOKEN_KEY = 'waschen_auth_token';

// ─── Helper: Decode JWT payload (no verify, just read) ───────────────────────
function decodeJwtPayload(token) {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return null; }
}

// ─── Auto-refresh token jika hampir expired ──────────────────────────────────
let refreshing = null;
async function maybeRefreshToken() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresIn = payload.exp - nowSec;
  // Refresh kalau sisa waktu kurang dari 30 menit (1800 detik)
  if (expiresIn > 1800 || expiresIn <= 0) return;

  // Cegah multiple refresh paralel
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await axios.post('/api/auth/refresh', null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const newToken = res?.data?.data?.token;
      if (newToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, newToken);
      }
    } catch {
      // Refresh gagal — biarkan token lama, response interceptor akan handle 401
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// ─── Request deduplication (in-flight) ──────────────────────────────────────
// Dua request GET identik yang fire dalam window 1 detik di-coalesce ke 1
// promise. Bermanfaat banget untuk:
//   - React StrictMode double-mount (dev) — tidak double fetch
//   - User klik tombol cepat 2x — tidak double request
//   - Race condition saat polling + manual refresh
//
// Aman: GET only (idempotent). POST/PUT/PATCH/DELETE tidak di-dedup.
const inflightGet = new Map();
const INFLIGHT_TTL_MS = 1000;

function inflightKey(config) {
  // Stable key: method + url + sorted params + Authorization (untuk per-user)
  const params = config.params || {};
  const sortedParams = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  // Include token suffix supaya beda user tidak share inflight
  const auth = config.headers?.Authorization || '';
  const tokenSuffix = auth.slice(-12);
  return `${config.method}:${config.url}?${sortedParams}#${tokenSuffix}`;
}

// ─── Global request interceptor ───────────────────────────────────────────────
// Setiap axios request otomatis menyertakan token JWT dari localStorage.
// Sekaligus auto-refresh kalau hampir expired.
axios.interceptors.request.use(async (config) => {
  // Skip refresh & authorization header for auth endpoints that don't need it
  const isAuthPublicEndpoint = config.url?.includes('/api/auth/login') || config.url?.includes('/api/auth/outlets');
  
  if (!isAuthPublicEndpoint && !config.url?.includes('/api/auth/refresh')) {
    await maybeRefreshToken();
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token && !isAuthPublicEndpoint) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Global response interceptor ──────────────────────────────────────────────
// Auto-retry untuk gateway errors (502, 503, 504). 429 TIDAK di-retry supaya
// tidak memperparah beban server (retry = lebih banyak request ke server yang sudah kelebihan beban).
const RETRY_STATUS = new Set([502, 503, 504]);
const MAX_RETRY = 2;

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      const code = error?.response?.data?.code;
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('waschen_auth_user');
        window.dispatchEvent(new CustomEvent('waschen:session-expired'));
      }
      return Promise.reject(error);
    }

    // Auto-retry untuk transient errors (rate limit, gateway timeout, dll).
    // Hanya untuk GET — POST/PUT bisa double-create kalau di-retry.
    const cfg = error.config || {};
    const status = error?.response?.status;
    const isRetryable = RETRY_STATUS.has(status) && cfg.method?.toLowerCase() === 'get';

    if (isRetryable) {
      cfg._retryCount = (cfg._retryCount || 0) + 1;
      if (cfg._retryCount <= MAX_RETRY) {
        // Exponential backoff dengan jitter: 500ms, 1500ms, 3500ms
        const baseDelay = 500 * Math.pow(2, cfg._retryCount - 1);
        const jitter = Math.random() * 300;
        const delay = baseDelay + jitter;
        await new Promise((r) => setTimeout(r, delay));
        // Pakai axios langsung (bukan axios.get) supaya bypass dedup —
        // request retry boleh hit ulang
        return axios.request(cfg);
      }
    }

    return Promise.reject(error);
  }
);

// ─── GET dedup wrapper ───────────────────────────────────────────────────────
// Wrap axios.get supaya request identik dalam 1 detik di-coalesce. Ini cegah
// double-fetch dari StrictMode dan klik tombol cepat 2x.
const _origGet = axios.get.bind(axios);
axios.get = function dedupedGet(url, config = {}) {
  // Skip dedup kalau:
  //   - signal di-pass (caller punya AbortController, biarkan terpisah)
  //   - X-Skip-Cache header (caller minta fresh data)
  //   - responseType blob/arraybuffer (file download — bukan JSON)
  const skipDedup =
    !!config.signal ||
    config.headers?.['X-Skip-Cache'] === '1' ||
    config.headers?.['x-skip-cache'] === '1' ||
    ['blob', 'arraybuffer', 'stream'].includes(config.responseType || '');

  if (skipDedup) {
    return _origGet(url, config);
  }

  const key = inflightKey({ method: 'get', url, params: config.params, headers: { Authorization: localStorage.getItem(AUTH_TOKEN_KEY) || '' } });
  const existing = inflightGet.get(key);
  if (existing && Date.now() - existing.startedAt < INFLIGHT_TTL_MS) {
    // Return shared promise
    return existing.promise;
  }

  const promise = _origGet(url, config).finally(() => {
    // Clear setelah selesai (dengan delay kecil supaya parallel call tetap shared)
    setTimeout(() => {
      const cur = inflightGet.get(key);
      if (cur && cur.promise === promise) inflightGet.delete(key);
    }, 50);
  });

  inflightGet.set(key, { promise, startedAt: Date.now() });
  return promise;
};

// ─── Helper: bypass cache untuk fresh data ───────────────────────────────────
// Pakai saat pull-to-refresh atau ketika user explicit minta data baru.
//
// Contoh:
//   import { withFresh } from '../utils/api';
//   const res = await axios.get('/api/customers', withFresh({ params: { page: 1 } }));
export function withFresh(config = {}) {
  return {
    ...config,
    headers: { ...(config.headers || {}), 'X-Skip-Cache': '1' },
  };
}

export default axios;
