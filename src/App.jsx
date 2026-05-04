import { useToast, BottomNav, Toast } from './components/ui';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { C } from './utils/theme';

// Auth
import SplashPage from './pages/auth/SplashPage';
import LoginPage from './pages/auth/LoginPage';

// Kasir
import KasirDashboardPage from './pages/kasir/DashboardPage';
import CustomerListPage from './pages/kasir/CustomerListPage';
import TambahCustomerPage from './pages/kasir/TambahCustomerPage';
import NotaStep1Page from './pages/kasir/NotaStep1Page';
import NotaStep2Page from './pages/kasir/NotaStep2Page';
import NotaStep3Page from './pages/kasir/NotaStep3Page';
import NotaBerhasilPage from './pages/kasir/NotaBerhasilPage';
import TransaksiListPage from './pages/kasir/TransaksiListPage';
import DetailTransaksiPage from './pages/kasir/DetailTransaksiPage';

// Admin
import AdminDashboardPage from './pages/admin/DashboardPage';
import ManajemenUserPage from './pages/admin/ManajemenUserPage';
import ManajemenLayananPage from './pages/admin/ManajemenLayananPage';
import ApprovalPage from './pages/admin/ApprovalPage';
import MonitoringPage from './pages/admin/MonitoringPage';

// Produksi
import ProduksiDashboardPage from './pages/produksi/DashboardPage';
import DetailItemProduksiPage from './pages/produksi/DetailItemPage';
import FotoKondisiPage from './pages/produksi/FotoKondisiPage';

// Member
import DetailCustomerPage from './pages/member/DetailCustomerPage';
import TopupDepositPage from './pages/member/TopupDepositPage';
import DaftarMemberPage from './pages/member/DaftarMemberPage';

// Shared pages
import SettingsPage from './pages/SettingsPage';
import NotifikasiPage from './pages/NotifikasiPage';

const SCREENS_NO_NAV = new Set([
  'splash', 'login', 'nota_step1', 'nota_step2', 'nota_step3', 'nota_berhasil',
  'tambah_customer', 'detail_item_produksi', 'foto_kondisi',
  'detail_transaksi', 'detail_customer', 'topup_deposit', 'notifikasi',
  'manajemen_user', 'manajemen_layanan',
]);

function AppInner() {
  const {
    screen, screenParams, user, customers, transactions,
    navActive, notaCustomer, notaCart,
    navigate, handleLogin, handleLogout, handleSwitchRole,
    addTransaction, addCustomer, cancelTransaction,
    setNotaCustomer, setNotaCart,
  } = useApp();

  const [toast, showToast] = useToast();

  const showNav = user && !SCREENS_NO_NAV.has(screen);

  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return <SplashPage onDone={() => navigate('login')} />;
      case 'login':
        return <LoginPage onLogin={handleLogin} />;
      case 'dashboard':
        if (!user) return <LoginPage onLogin={handleLogin} />;
        if (user.role === 'admin' || user.role === 'finance')
          return <AdminDashboardPage user={user} transactions={transactions} customers={customers} navigate={navigate} />;
        if (user.role === 'produksi')
          return <ProduksiDashboardPage user={user} transactions={transactions} navigate={navigate} />;
        return <KasirDashboardPage user={user} transactions={transactions} navigate={navigate} />;

      case 'transaksi':
        return <TransaksiListPage transactions={transactions} navigate={navigate} />;
      case 'history_produksi':
        return <TransaksiListPage transactions={transactions} navigate={navigate} historyOnly />;

      case 'customer':
        return <CustomerListPage customers={customers} navigate={navigate} />;
      case 'tambah_customer':
        return <TambahCustomerPage navigate={navigate} onAdd={addCustomer} />;
      case 'detail_customer':
        return <DetailCustomerPage navigate={navigate} screenParams={screenParams} transactions={transactions} />;
      case 'daftar_member':
        return <DaftarMemberPage customers={customers} navigate={navigate} />;

      case 'nota_step1':
        return <NotaStep1Page customers={customers} navigate={navigate} setNotaCustomer={setNotaCustomer} />;
      case 'nota_step2':
        return <NotaStep2Page navigate={navigate} notaCustomer={notaCustomer} notaCart={notaCart} setNotaCart={setNotaCart} />;
      case 'nota_step3':
        return <NotaStep3Page navigate={navigate} notaCustomer={notaCustomer} notaCart={notaCart} user={user} onConfirm={addTransaction} />;
      case 'nota_berhasil':
        return <NotaBerhasilPage navigate={navigate} screenParams={screenParams} />;

      case 'detail_transaksi':
        return <DetailTransaksiPage navigate={navigate} screenParams={screenParams} onCancel={cancelTransaction} />;

      case 'antrian':
        return <ProduksiDashboardPage user={user} transactions={transactions} navigate={navigate} />;
      case 'detail_item_produksi':
        return <DetailItemProduksiPage navigate={navigate} screenParams={screenParams} user={user} />;
      case 'foto_kondisi':
        return <FotoKondisiPage navigate={navigate} screenParams={screenParams} />;

      case 'manajemen_user':
        return <ManajemenUserPage navigate={navigate} />;
      case 'manajemen_layanan':
        return <ManajemenLayananPage navigate={navigate} />;
      case 'approval':
        return <ApprovalPage navigate={navigate} />;
      case 'monitoring':
        return <MonitoringPage transactions={transactions} navigate={navigate} />;

      case 'topup_deposit':
        return <TopupDepositPage navigate={navigate} screenParams={screenParams} showToast={showToast} />;

      case 'settings':
        return <SettingsPage user={user} navigate={navigate} onLogout={handleLogout} onSwitchRole={handleSwitchRole} />;

      case 'notifikasi':
        return <NotifikasiPage navigate={navigate} />;

      default:
        return <KasirDashboardPage user={user} transactions={transactions} navigate={navigate} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative', background: C.n50, fontFamily: 'Poppins, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {renderScreen()}

      {showNav && (
        <BottomNav role={user.role} active={navActive} navigate={navigate} />
      )}

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<AppInner />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
