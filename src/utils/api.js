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

// ─── Global request interceptor ───────────────────────────────────────────────
// Setiap axios request otomatis menyertakan token JWT dari localStorage.
// Sekaligus auto-refresh kalau hampir expired.
axios.interceptors.request.use(async (config) => {
  // Skip refresh kalau ini sendiri request /refresh (cegah infinite loop)
  if (!config.url?.includes('/api/auth/refresh') && !config.url?.includes('/api/auth/login')) {
    await maybeRefreshToken();
  }
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Global response interceptor ──────────────────────────────────────────────
// Redirect ke login jika token expired / invalid.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const code = error?.response?.data?.code;
      if (code === 'TOKEN_EXPIRED' || code === 'TOKEN_INVALID') {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('waschen_auth_user');
        window.dispatchEvent(new CustomEvent('waschen:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export default axios;
