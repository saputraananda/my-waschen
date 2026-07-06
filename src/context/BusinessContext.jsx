/**
 * BusinessContext.jsx — Business data state (customers, transactions, nota).
 * Split from AppContext so auth changes don't trigger re-renders on business consumers.
 */
import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const BusinessContext = createContext(null);

export const BusinessProvider = ({ children }) => {
  const { navigate } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [notaCustomer, setNotaCustomer] = useState(null);
  const [notaCart, setNotaCart] = useState([]);
  const [adminOutletId, setAdminOutletId] = useState('');

  const addTransaction = useCallback((nota) => {
    setTransactions((prev) => [nota, ...prev]);
    navigate('nota_berhasil', nota, { replace: true });
  }, [navigate]);

  const addCustomer = useCallback((customer, andNota = false) => {
    setCustomers((prev) => [customer, ...prev]);
    if (andNota) {
      setNotaCustomer(customer);
      navigate('nota_step2');
    } else {
      navigate('customer');
    }
  }, [navigate]);

  const cancelTransaction = useCallback((txId, reason) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'dibatalkan', cancelReason: reason } : t))
    );
    navigate('transaksi');
  }, [navigate]);

  return (
    <BusinessContext.Provider value={{
      customers, transactions, notaCustomer, notaCart, adminOutletId,
      addTransaction, addCustomer, cancelTransaction,
      setNotaCustomer, setNotaCart, setAdminOutletId, setCustomers, setTransactions,
    }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const ctx = useContext(BusinessContext);
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider');
  return ctx;
};
