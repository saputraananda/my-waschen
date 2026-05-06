import axios from 'axios';

const AUTH_TOKEN_KEY = 'waschen_auth_token';

// ─── Global request interceptor ───────────────────────────────────────────────
// Setiap axios request otomatis menyertakan token JWT dari localStorage.
// Semua halaman yang pakai `import axios from 'axios'` langsung mendapat manfaatnya.
axios.interceptors.request.use((config) => {
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
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default axios;
