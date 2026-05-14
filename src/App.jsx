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
import CetakNotaPage from './pages/kasir/CetakNotaPage';
import StokBahanPage from './pages/kasir/StokBahanPage';
import KasirShiftPage from './pages/kasir/ShiftPage';
import PrinterSettingsPage from './pages/kasir/PrinterSettingsPage';

// Admin
import AdminDashboardPage from './pages/admin/DashboardPage';
import ManajemenUserPage from './pages/admin/ManajemenUserPage';
import ManajemenLayananPage from './pages/admin/ManajemenLayananPage';
import ApprovalPage from './pages/admin/ApprovalPage';
import MonitoringPage from './pages/admin/MonitoringPage';
import AdminLaporanPage from './pages/admin/AdminLaporanPage';
import AdminShiftReportPage from './pages/admin/AdminShiftReportPage';
import AdminPromoSlaStokPage from './pages/admin/AdminPromoSlaStokPage';
import InfoOutletPage from './pages/admin/InfoOutletPage';
import RekapPendapatanPage from './pages/admin/RekapPendapatanPage';

// Produksi
import ProduksiDashboardPage from './pages/produksi/DashboardPage';
import DetailItemProduksiPage from './pages/produksi/DetailItemPage';
import FotoKondisiPage from './pages/produksi/FotoKondisiPage';
import ProduksiQRScanPage from './pages/produksi/QRScanPage';

// Finance
import FinanceDashboardPage from './pages/finance/DashboardPage';
import VerifikasiPaymentPage from './pages/finance/VerifikasiPaymentPage';
import LaporanKeuanganPage from './pages/finance/LaporanKeuanganPage';

// Member
import DetailCustomerPage from './pages/member/DetailCustomerPage';
import TopupDepositPage from './pages/member/TopupDepositPage';
import DaftarMemberPage from './pages/member/DaftarMemberPage';

// Shared pages
import SettingsPage from './pages/SettingsPage';
import NotifikasiPage from './pages/NotifikasiPage';
import ProfilePage from './pages/ProfilePage';
import BukaShiftPage from './pages/kasir/BukaShiftPage';
import TutupShiftPage from './pages/kasir/TutupShiftPage';
import KasirAntrianPage from './pages/kasir/AntrianPage';
import SiapAmbilPage from './pages/kasir/SiapAmbilPage';

const SCREENS_NO_NAV = new Set([
  'splash', 'login', 'nota_step1', 'nota_step2', 'nota_step3', 'nota_berhasil',
  'tambah_customer', 'detail_item_produksi', 'foto_kondisi',
  'detail_transaksi', 'cetak_nota', 'detail_customer', 'topup_deposit', 'notifikasi',
  'manajemen_user', 'manajemen_layanan', 'admin_promo_sla', 'admin_promo', 'admin_stok', 'kasir_stok_bahan',
  'profil', 'buka_shift', 'tutup_shift', 'admin_laporan', 'admin_shift', 'info_outlet', 'rekap_pendapatan',
  'kasir_antrian', 'kasir_siap_ambil', 'printer_settings'
]);

function AppInner() {
  const {
    screen, screenParams, user, customers, transactions,
    navActive, notaCustomer, notaCart,
    navigate, goBack, handleLogin, handleLogout, handleSwitchRole,
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
      case 'buka_shift':
        return <BukaShiftPage goBack={goBack} />;
      case 'tutup_shift':
        return <TutupShiftPage goBack={goBack} />;
      case 'dashboard':
        if (!user) return <LoginPage onLogin={handleLogin} />;
        if (user.role === 'admin')
          return <AdminDashboardPage user={user} navigate={navigate} />;
        if (user.role === 'finance')
          return <FinanceDashboardPage user={user} navigate={navigate} />;
        if (user.role === 'produksi')
          return <ProduksiDashboardPage user={user} navigate={navigate} />;
        return <KasirDashboardPage user={user} navigate={navigate} />;

      case 'transaksi':
        return <TransaksiListPage navigate={navigate} />;
      case 'history_produksi':
        return <TransaksiListPage navigate={navigate} historyOnly />;

      case 'customer':
        return <CustomerListPage navigate={navigate} />;
      case 'tambah_customer':
        return <TambahCustomerPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'detail_customer':
        return <DetailCustomerPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'daftar_member':
        return <DaftarMemberPage navigate={navigate} goBack={goBack} />;

      case 'nota_step1':
        return <NotaStep1Page goBack={goBack} />;
      case 'nota_step2':
        return <NotaStep2Page goBack={goBack} />;
      case 'nota_step3':
        return <NotaStep3Page goBack={goBack} />;
      case 'nota_berhasil':
        return <NotaBerhasilPage navigate={navigate} screenParams={screenParams} />;

      case 'detail_transaksi':
        return <DetailTransaksiPage navigate={navigate} goBack={goBack} screenParams={screenParams} onCancel={cancelTransaction} />;
      case 'cetak_nota':
        return <CetakNotaPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

      case 'antrian':
        return <ProduksiDashboardPage user={user} transactions={transactions} navigate={navigate} />;
      case 'detail_item_produksi':
        return <DetailItemProduksiPage navigate={navigate} goBack={goBack} screenParams={screenParams} user={user} />;
      case 'foto_kondisi':
        return <FotoKondisiPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'produksi_qr_scan':
        return <ProduksiQRScanPage navigate={navigate} goBack={goBack} />;

      case 'manajemen_user':
        return <ManajemenUserPage navigate={navigate} goBack={goBack} />;
      case 'manajemen_layanan':
        return <ManajemenLayananPage navigate={navigate} goBack={goBack} />;
      case 'admin_promo_sla':
        return <AdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="stok" />;
      case 'admin_promo':
        return <AdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="promo" />;
      case 'admin_stok':
        return <AdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="stok" />;
      case 'kasir_stok_bahan':
        return <StokBahanPage goBack={goBack} />;
      case 'kasir_antrian':
        return <KasirAntrianPage navigate={navigate} goBack={goBack} />;
      case 'kasir_siap_ambil':
        return <SiapAmbilPage navigate={navigate} goBack={goBack} />;
      case 'kasir_shift':
        return <KasirShiftPage navigate={navigate} goBack={goBack} />;
      case 'printer_settings':
        return <PrinterSettingsPage navigate={navigate} goBack={goBack} />;
      case 'approval':
        return <ApprovalPage navigate={navigate} goBack={goBack} />;
      case 'monitoring':
        return <MonitoringPage navigate={navigate} goBack={goBack} />;
      case 'admin_laporan':
        return <AdminLaporanPage navigate={navigate} goBack={goBack} />;
      case 'admin_shift':
        return <AdminShiftReportPage navigate={navigate} goBack={goBack} />;
      case 'info_outlet':
        return <InfoOutletPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'rekap_pendapatan':
        return <RekapPendapatanPage navigate={navigate} goBack={goBack} />;

      case 'verifikasi_payment':
        return <VerifikasiPaymentPage navigate={navigate} goBack={goBack} />;
      case 'laporan_keuangan':
        return <LaporanKeuanganPage navigate={navigate} goBack={goBack} />;

      case 'topup_deposit':
        return <TopupDepositPage navigate={navigate} goBack={goBack} screenParams={screenParams} showToast={showToast} />;

      case 'settings':
        return <SettingsPage user={user} navigate={navigate} onLogout={handleLogout} onSwitchRole={handleSwitchRole} />;

      case 'notifikasi':
        return <NotifikasiPage navigate={navigate} goBack={goBack} />;

      case 'profil':
        return <ProfilePage navigate={navigate} goBack={goBack} />;

      default:
        return <KasirDashboardPage user={user} transactions={transactions} navigate={navigate} />;
    }
  };

  return (
    <div className="app-inner">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        ::-webkit-scrollbar { display: none; }
        .app-inner {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          position: relative;
          background: ${C.n50};
          font-family: 'Poppins', sans-serif;
        }
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
    <div className="app-wrapper">
      <style>{`
        .app-wrapper {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }
        .app-content {
          width: 100%;
          height: 100%;
          overflow: hidden;
        }
      `}</style>
      <div className="app-content">
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/*" element={<AppInner />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </div>
    </div>
  );
}
