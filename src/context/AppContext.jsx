import { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_DATA } from '../utils/mockData';

const AppContext = createContext(null);

const AUTH_TOKEN_KEY = 'waschen_auth_token';
const AUTH_USER_KEY  = 'waschen_auth_user';

// ─── Load auth dari localStorage saat app pertama kali buka ──────────────────
const loadStoredAuth = () => {
  try {
    const token   = localStorage.getItem(AUTH_TOKEN_KEY);
    const userRaw = localStorage.getItem(AUTH_USER_KEY);
    const user    = userRaw ? JSON.parse(userRaw) : null;
    if (!user) return { token: null, user: null };
    // Normalisasi legacy: pastikan originalRoleCode selalu ada
    if (!user.originalRoleCode) {
      // Ambil dari roleCode jika ada, atau role
      user.originalRoleCode = user.roleCode || user.role;
    }
    // Pastikan roleCode selalu = originalRoleCode (bukan role tampilan)
    user.roleCode = user.originalRoleCode;
    if (!user.roleCode) return { token: null, user: null };
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AppProvider = ({ children }) => {
  const stored = loadStoredAuth();

  const [screen,        setScreen]        = useState(stored.user ? 'dashboard' : 'splash');
  const [screenParams,  setScreenParams]  = useState(null);
  const [user,          setUser]          = useState(stored.user);
  const [token,         setToken]         = useState(stored.token);
  const [customers,     setCustomers]     = useState(MOCK_DATA.customers);
  const [transactions,  setTransactions]  = useState(MOCK_DATA.transactions);
  const [navActive,     setNavActive]     = useState('dashboard');
  const [notaCustomer,  setNotaCustomer]  = useState(null);
  const [notaCart,      setNotaCart]      = useState([]);

  // ─── Repair user state on mount (handle stale localStorage) ────────────
  useEffect(() => {
    if (!user) return;
    const needsRepair = !user.originalRoleCode;
    if (needsRepair) {
      const repaired = {
        ...user,
        originalRoleCode: user.roleCode || user.role,
        roleCode:         user.roleCode || user.role,
      };
      setUser(repaired);
      try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(repaired)); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── navigate ───────────────────────────────────────────────────────────
  const navigate = (to, params = null) => {
    setScreen(to);
    setScreenParams(params);
    const navScreens = ['dashboard', 'transaksi', 'customer', 'settings', 'antrian',
                        'approval', 'monitoring', 'history_produksi', 'nota_step1',
                        'verifikasi_payment', 'laporan_keuangan'];
    if (navScreens.includes(to)) setNavActive(to);
  };

  // ─── loginContext — dipanggil dari LoginPage setelah API berhasil ────────
  const loginContext = ({ token: t, userId, roleCode, outletId, outletName, name, avatar, phone, email, photo, username }) => {
    const normalizedUser = {
      userId,
      name:             name || '',
      username:         username || '',
      avatar:           avatar || (name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'US'),
      phone:            phone  || null,
      email:            email  || null,
      photo:            photo  || null,
      roleCode,
      originalRoleCode: roleCode,   // TIDAK PERNAH berubah, dipakai untuk isAdmin check
      role:             roleCode,
      outletId,
      outletName,
      outlet: outletId ? { id: outletId, name: outletName } : null,
    };

    setToken(t || null);
    setUser(normalizedUser);

    try {
      localStorage.setItem(AUTH_TOKEN_KEY, t || '');
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
    } catch {
      // localStorage mungkin penuh atau disabled
    }

    setScreen('dashboard');
    setNavActive('dashboard');
  };

  // ─── handleLogin — dipanggil dari App.jsx (onLogin callback) ────────────
  const handleLogin = (loggedUser) => {
    if (!loggedUser) return;

    if (loggedUser.token || loggedUser.roleCode) {
      loginContext({
        token:      loggedUser.token,
        userId:     loggedUser.userId,
        roleCode:   loggedUser.roleCode || loggedUser.role,
        outletId:   loggedUser.outletId  || loggedUser.outlet?.id,
        outletName: loggedUser.outletName || loggedUser.outlet?.name,
        name:       loggedUser.name || '',
        username:   loggedUser.username || '',
        avatar:     loggedUser.avatar || '',
        phone:      loggedUser.phone  || null,
        email:      loggedUser.email  || null,
        photo:      loggedUser.photo  || null,
      });
      return;
    }

    // Fallback lama (jika dipanggil langsung dengan user object)
    setUser(loggedUser);
    setScreen('dashboard');
    setNavActive('dashboard');
  };

  // ─── handleLogout ────────────────────────────────────────────────────────
  const handleLogout = () => {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    } catch {}
    setToken(null);
    setUser(null);
    setScreen('login');
    setNavActive('dashboard');
  };

  // ─── handleSwitchRole — hanya untuk admin, ganti tampilan role tanpa ubah data ───
  const handleSwitchRole = (role) => {
    const updatedUser = {
      ...user,
      role,
      // roleCode dan originalRoleCode TIDAK berubah — hanya tampilan (role) yang ganti
    };
    setUser(updatedUser);
    try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser)); } catch {}
    navigate('dashboard');
  };

  // ─── updateUserProfile — dipanggil setelah simpan profil berhasil ──────────────
  const updateUserProfile = ({ name, phone, email, photo }) => {
    const updatedUser = {
      ...user,
      name:   name   ?? user?.name,
      phone:  phone  ?? user?.phone,
      email:  email  ?? user?.email,
      photo:  photo  !== undefined ? photo : user?.photo,
      avatar: name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : user?.avatar,
    };
    setUser(updatedUser);
    try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser)); } catch {}
  };

  // ─── Transaksi & customer actions ────────────────────────────────────────
  const addTransaction = (nota) => {
    setTransactions((prev) => [nota, ...prev]);
    navigate('nota_berhasil', nota);
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
        navActive, notaCustomer, notaCart,
        navigate, loginContext, handleLogin, handleLogout, handleSwitchRole, updateUserProfile,
        addTransaction, addCustomer, cancelTransaction,
        setNotaCustomer, setNotaCart,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);