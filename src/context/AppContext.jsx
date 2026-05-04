import { createContext, useContext, useState } from 'react';
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
    // Validasi minimal: user harus punya roleCode
    if (user && !user.roleCode && user.role) user.roleCode = user.role;
    return { token, user: user?.roleCode ? user : null };
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

  // ─── navigate ───────────────────────────────────────────────────────────
  const navigate = (to, params = null) => {
    setScreen(to);
    setScreenParams(params);
    const navScreens = ['dashboard', 'transaksi', 'customer', 'settings', 'antrian',
                        'approval', 'monitoring', 'history_produksi', 'nota_step1'];
    if (navScreens.includes(to)) setNavActive(to);
  };

  // ─── loginContext — dipanggil dari LoginPage setelah API berhasil ────────
  const loginContext = ({ token: t, userId, roleCode, outletId, outletName, name, avatar }) => {
    const normalizedUser = {
      userId,
      name:      name || '',
      avatar:    avatar || (userId ? userId.slice(-2).toUpperCase() : 'US'),
      roleCode,
      role:      roleCode,   // alias untuk komponen yang pakai user.role
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
        avatar:     loggedUser.avatar || '',
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

  // ─── handleSwitchRole — untuk testing di settings ────────────────────────
  const handleSwitchRole = (role) => {
    const mockUser = MOCK_DATA.users.find((u) => u.role === role) || MOCK_DATA.users[0];
    const updatedUser = {
      ...user,
      ...mockUser,
      role,
      roleCode: role,
      outlet: user?.outlet || mockUser.outlet,
    };
    setUser(updatedUser);
    try { localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser)); } catch {}
    navigate('dashboard');
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
        navigate, loginContext, handleLogin, handleLogout, handleSwitchRole,
        addTransaction, addCustomer, cancelTransaction,
        setNotaCustomer, setNotaCart,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);