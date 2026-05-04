import { createContext, useContext, useState } from 'react';
import { MOCK_DATA } from '../utils/mockData';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [screen, setScreen] = useState('splash');
  const [screenParams, setScreenParams] = useState(null);
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState(MOCK_DATA.customers);
  const [transactions, setTransactions] = useState(MOCK_DATA.transactions);
  const [navActive, setNavActive] = useState('dashboard');
  const [notaCustomer, setNotaCustomer] = useState(null);
  const [notaCart, setNotaCart] = useState([]);

  const navigate = (to, params = null) => {
    setScreen(to);
    setScreenParams(params);
    if (['dashboard', 'transaksi', 'customer', 'settings', 'antrian', 'approval', 'monitoring', 'history_produksi'].includes(to)) {
      setNavActive(to);
    }
  };

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    setScreen('dashboard');
    setNavActive('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setScreen('login');
  };

  const handleSwitchRole = (role) => {
    const u = MOCK_DATA.users.find((u2) => u2.role === role) || MOCK_DATA.users[0];
    setUser({ ...u, role, outlet: user.outlet });
    navigate('dashboard');
  };

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
        screen, screenParams, user, customers, transactions,
        navActive, notaCustomer, notaCart,
        navigate, handleLogin, handleLogout, handleSwitchRole,
        addTransaction, addCustomer, cancelTransaction,
        setNotaCustomer, setNotaCart,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
