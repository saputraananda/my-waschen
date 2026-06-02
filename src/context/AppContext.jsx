import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { clearAllSavedFilters } from '../utils/savedFilters';
import { connectRealtime, disconnectRealtime } from '../utils/realtime';

const AppContext = createContext(null);

const AUTH_TOKEN_KEY = 'waschen_auth_token';
const AUTH_USER_KEY = 'waschen_auth_user';

// ═════════════════════════════════════════════════════════════════════════════
// URL ↔ Screen mapping
// ═════════════════════════════════════════════════════════════════════════════

const ID_PARAM_KEY = {
  detail_transaksi: 'id',
  cetak_nota: 'id',
  detail_customer: 'id',
  topup_deposit: 'id',
  detail_item_produksi: 'id',
  detail_riwayat_produksi: 'id',
  foto_kondisi: 'id',
  info_outlet: 'outletId',
};

const ALL_SCREENS = new Set([
  'splash', 'login', 'dashboard', 'transaksi', 'history_produksi',
  'customer', 'tambah_customer', 'detail_customer', 'daftar_member',
  'nota_step1', 'nota_step2', 'nota_step3', 'nota_berhasil',
  'detail_transaksi', 'cetak_nota', 'antrian',
  'detail_item_produksi', 'detail_riwayat_produksi', 'foto_kondisi', 'produksi_qr_scan',
  'manajemen_user', 'manajemen_outlet', 'manajemen_layanan', 'kelola_layanan_outlet',
  'admin_promo_sla', 'admin_promo', 'admin_stok',
  'kasir_stok_bahan', 'kasir_antrian', 'kasir_siap_ambil',
  'kasir_shift', 'kasir_laporan', 'printer_settings',
  'approval', 'monitoring', 'admin_laporan', 'admin_shift',
  'info_outlet', 'rekap_pendapatan',
  'verifikasi_payment', 'laporan_keuangan', 'laporan_per_outlet',
  'topup_deposit', 'settings', 'notifikasi', 'profil',
  'buka_shift', 'tutup_shift',
  'general_report', 'admin_target', 'admin_period_close',
  'comparison_report', 'forecast', 'kebijakan_privasi',
  'kas_outlet', 'kas_approval', 'qr_payment', 'request_barang', 'admin_purchase_requests',
]);

function screenToUrl(scr, params) {
  if (!scr || scr === 'splash') return '/';
  if (scr === 'login') return '/login';
  if (scr === 'dashboard') return '/dashboard';

  const slug = scr.replace(/_/g, '-');
  const paramKey = ID_PARAM_KEY[scr];
  const id = paramKey && params?.[paramKey];

  if (id) return `/${slug}/${encodeURIComponent(id)}`;
  return `/${slug}`;
}

function urlToScreen(pathname) {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (!clean) return { screen: null, params: null };

  const parts = clean.split('/');
  const slug = parts[0];
  const screen = slug.replace(/-/g, '_');

  if (!ALL_SCREENS.has(screen)) return { screen: null, params: null };

  if (parts.length >= 2) {
    const paramKey = ID_PARAM_KEY[screen];
    if (paramKey) {
      return { screen, params: { [paramKey]: decodeURIComponent(parts[1]) } };
    }
  }

  return { screen, params: null };
}

// ═════════════════════════════════════════════════════════════════════════════
// Auth persistence
// ═════════════════════════════════════════════════════════════════════════════

const loadStoredAuth = () => {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userRaw = localStorage.getItem(AUTH_USER_KEY);
    const user = userRaw ? JSON.parse(userRaw) : null;
    if (!user) return { token: null, user: null };
    // Pastikan originalRoleCode selalu ada (role asli dari DB)
    if (!user.originalRoleCode) {
      user.originalRoleCode = user.roleCode || user.role;
    }
    // Pertahankan roleCode terakhir yang dipilih (jangan reset ke original)
    // Ini supaya admin yang switch ke kasir tetap di kasir setelah reload
    if (!user.roleCode) {
      user.roleCode = user.originalRoleCode;
    }
    user.role = user.roleCode;
    if (!user.roleCode) return { token: null, user: null };
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// Provider
// ═════════════════════════════════════════════════════════════════════════════

export const AppProvider = ({ children }) => {
  const stored = loadStoredAuth();

  // Determine initial screen from URL (deep link support)
  const urlParsed = urlToScreen(window.location.pathname);
  const canDeepLink = stored.user && urlParsed.screen && urlParsed.screen !== 'splash' && urlParsed.screen !== 'login';
  const initialScreen = canDeepLink ? urlParsed.screen : (stored.user ? 'dashboard' : 'splash');
  const initialParams = canDeepLink ? urlParsed.params : null;

  const [screen, setScreen] = useState(initialScreen);
  const [screenParams, setScreenParams] = useState(initialParams);
  const [user, setUser] = useState(stored.user);
  const [token, setToken] = useState(stored.token);
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [navActive, setNavActive] = useState('dashboard');
  const [notaCustomer, setNotaCustomer] = useState(null);
  const [notaCart, setNotaCart] = useState([]);
  const [adminOutletId, setAdminOutletId] = useState('');

  const isPopState = useRef(false);

  const NAV_SCREENS = ['dashboard', 'transaksi', 'customer', 'settings', 'kasir_shift', 'antrian',
    'approval', 'monitoring', 'admin_laporan', 'history_produksi', 'nota_step1',
    'verifikasi_payment', 'laporan_keuangan'];

  // ─── Set initial history state on mount ────────────────────────────────────
  useEffect(() => {
    window.history.replaceState(
      { screen: initialScreen, params: initialParams, depth: 0 },
      '',
      screenToUrl(initialScreen, initialParams)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Listen to browser back/forward (popstate) ─────────────────────────────
  useEffect(() => {
    const handler = (event) => {
      const state = event.state;
      isPopState.current = true;

      if (state?.screen && ALL_SCREENS.has(state.screen)) {
        setScreen(state.screen);
        setScreenParams(state.params || null);
        if (NAV_SCREENS.includes(state.screen)) setNavActive(state.screen);
      } else {
        setScreen(user ? 'dashboard' : 'login');
        setScreenParams(null);
        setNavActive('dashboard');
      }

      setTimeout(() => { isPopState.current = false; }, 0);
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ─── Repair user state on mount (handle stale localStorage) ────────────
  useEffect(() => {
    if (!user) return;
    const needsRepair = !user.originalRoleCode;
    if (needsRepair) {
      const repaired = {
        ...user,
        originalRoleCode: user.roleCode || user.role,
        roleCode: user.roleCode || user.role,
      };
      setUser(repaired);
      try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(repaired)); } catch { }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── SSE Realtime — connect on token, disconnect on logout ───────────────
  useEffect(() => {
    if (token) {
      connectRealtime(token);
    } else {
      disconnectRealtime();
    }
    return () => {
      // No-op on token change — disconnectRealtime di handleLogout sudah cukup
    };
  }, [token]);

  // ─── navigate ──────────────────────────────────────────────────────────────
  const navigate = (to, params = null, { replace = false } = {}) => {
    setScreen(to);
    setScreenParams(params);
    if (NAV_SCREENS.includes(to)) setNavActive(to);

    if (!isPopState.current) {
      const url = screenToUrl(to, params);
      const currentDepth = window.history.state?.depth || 0;
      const stateObj = { screen: to, params, depth: replace ? currentDepth : currentDepth + 1 };

      if (replace) {
        window.history.replaceState(stateObj, '', url);
      } else {
        window.history.pushState(stateObj, '', url);
      }
    }
  };

  // ─── goBack — uses browser history ─────────────────────────────────────────
  const goBack = () => {
    const depth = window.history.state?.depth || 0;
    if (depth > 0) {
      window.history.back();
    } else {
      navigate('dashboard', null, { replace: true });
    }
  };

  // ─── loginContext — dipanggil dari LoginPage setelah API berhasil ────────
  const loginContext = ({ token: t, userId, roleCode, originalRoleCode: origRole, outletId, outletName, name, avatar, phone, email, photo, username }) => {
    // originalRoleCode = role asli dari DB (admin tetap admin meskipun switch ke kasir)
    const trueOriginalRole = origRole || roleCode;

    const normalizedUser = {
      userId,
      name: name || '',
      username: username || '',
      avatar: avatar || (name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'US'),
      phone: phone || null,
      email: email || null,
      photo: photo || null,
      roleCode,
      originalRoleCode: trueOriginalRole,
      role: roleCode,
      outletId,
      outletName,
      outlet: outletId ? { id: outletId, name: outletName } : null,
    };

    setToken(t || null);
    setUser(normalizedUser);

    try {
      localStorage.setItem(AUTH_TOKEN_KEY, t || '');
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
    } catch { }

    navigate('dashboard', null, { replace: true });
  };

  // ─── handleLogin — dipanggil dari App.jsx (onLogin callback) ────────────
  const handleLogin = (loggedUser) => {
    if (!loggedUser) return;

    if (loggedUser.token || loggedUser.roleCode) {
      loginContext({
        token: loggedUser.token,
        userId: loggedUser.userId,
        roleCode: loggedUser.roleCode || loggedUser.role,
        originalRoleCode: loggedUser.originalRoleCode || loggedUser.roleCode || loggedUser.role,
        outletId: loggedUser.outletId || loggedUser.outlet?.id,
        outletName: loggedUser.outletName || loggedUser.outlet?.name,
        name: loggedUser.name || '',
        username: loggedUser.username || '',
        avatar: loggedUser.avatar || '',
        phone: loggedUser.phone || null,
        email: loggedUser.email || null,
        photo: loggedUser.photo || null,
      });
      return;
    }

    setUser(loggedUser);
    navigate('dashboard', null, { replace: true });
  };

  // ─── handleLogout ──────────────────────────────────────────────────────────
  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      clearAllSavedFilters();
      disconnectRealtime();
    } catch { }
    setToken(null);
    setUser(null);
    navigate('login', null, { replace: true });
  };

  // ─── handleSwitchRole ──────────────────────────────────────────────────────
  const handleSwitchRole = (role) => {
    // Update BOTH role AND roleCode agar BottomNav, dashboard routing, dan
    // semua komponen yang membaca user.roleCode ikut berubah
    const updatedUser = { ...user, role, roleCode: role };
    setUser(updatedUser);
    try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser)); } catch { }
    navigate('dashboard', null, { replace: true });
  };

  // ─── updateUserProfile ─────────────────────────────────────────────────────
  const updateUserProfile = ({ name, phone, email, photo }) => {
    const updatedUser = {
      ...user,
      name: name ?? user?.name,
      phone: phone ?? user?.phone,
      email: email ?? user?.email,
      photo: photo !== undefined ? photo : user?.photo,
      avatar: name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : user?.avatar,
    };
    setUser(updatedUser);
    try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser)); } catch { }
  };

  // ─── Transaksi & customer actions ──────────────────────────────────────────
  const addTransaction = (nota) => {
    setTransactions((prev) => [nota, ...prev]);
    // Replace history — jangan biarkan user kembali ke step checkout setelah berhasil
    navigate('nota_berhasil', nota, { replace: true });
  };

  const addCustomer = (customer, andNota = false) => {
    setCustomers((prev) => [customer, ...prev]);
    if (andNota) {
      setNotaCustomer(customer);
      navigate('nota_step2');
    } else {
      navigate('customer');
    }
  };

  const cancelTransaction = (txId, reason) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'dibatalkan', cancelReason: reason } : t))
    );
    navigate('transaksi');
  };

  return (
    <AppContext.Provider
      value={{
        screen, screenParams, user, token, customers, transactions,
        navActive, notaCustomer, notaCart, adminOutletId,
        navigate, goBack, loginContext, handleLogin, handleLogout, handleSwitchRole, updateUserProfile,
        addTransaction, addCustomer, cancelTransaction,
        setNotaCustomer, setNotaCart, setAdminOutletId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
