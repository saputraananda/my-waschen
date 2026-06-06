import { useState, useEffect } from 'react';
import { BottomNav, ErrorBoundary, OfflineIndicator, GlobalPullToRefresh, GlobalErrorBoundary } from './components/ui';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { C } from './utils/theme';
import { isAdmin, isFinance, isProduksi, isDataAnalyst, ADMIN_ROLES, FINANCE_ROLES } from './utils/roles';

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
import PelunasanPage from './pages/kasir/PelunasanPage';
import CetakNotaPage from './pages/kasir/CetakNotaPage';
import QrPaymentPage from './pages/kasir/QrPaymentPage';
import KasOutletPage from './pages/KasOutletPage';
import KasApprovalPage from './pages/admin/KasApprovalPage';
import PurchaseRequestApprovalPage from './pages/admin/PurchaseRequestApprovalPage';
import RequestBarangPage from './pages/kasir/RequestBarangPage';
import AllOutletStocksPage from './pages/admin/AllOutletStocksPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import StokBahanPage from './pages/kasir/StokBahanPage';
import KasirShiftPage from './pages/kasir/ShiftPage';
import PrinterSettingsPage from './pages/kasir/PrinterSettingsPage';
import KasirLaporanPage from './pages/kasir/LaporanPage';

// Admin
import AdminDashboardPage from './pages/admin/DashboardPage';
import ManajemenUserPage from './pages/admin/ManajemenUserPage';
import ManajemenOutletPage from './pages/admin/ManajemenOutletPage';
import ManajemenLayananPage from './pages/admin/ManajemenLayananPage';
import KelolaLayananOutletPage from './pages/admin/KelolaLayananOutletPage';
import ApprovalPage from './pages/admin/ApprovalPage';
import AdminLaporanPage from './pages/admin/AdminLaporanPage';
import AdminShiftReportPage from './pages/admin/AdminShiftReportPage';
import AdminPromoSlaStokPage from './pages/admin/AdminPromoSlaStokPage';
import InfoOutletPage from './pages/admin/InfoOutletPage';
import RekapPendapatanPage from './pages/admin/RekapPendapatanPage';
import GeneralReportPage from './pages/admin/GeneralReportPage';
import AdminTargetPage from './pages/admin/AdminTargetPage';
import AdminTargetDetailPage from './pages/admin/AdminTargetDetailPage';
import AdminPeriodClosePage from './pages/admin/AdminPeriodClosePage';
import ComparisonReportPage from './pages/admin/ComparisonReportPage';
import ForecastPage from './pages/admin/ForecastPage';

// Produksi
import ProduksiDashboardPage from './pages/produksi/DashboardPage';
import ProduksiAntrianPage from './pages/produksi/AntrianPage';
import DetailItemProduksiPage from './pages/produksi/DetailItemPage';
import FotoKondisiPage from './pages/produksi/FotoKondisiPage';
import ProduksiQRScanPage from './pages/produksi/QRScanPage';
import ProduksiRiwayatPage from './pages/produksi/RiwayatPage';
import DetailRiwayatProduksiPage from './pages/produksi/DetailRiwayatProduksiPage';

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
import KebijakanPrivasiPage from './pages/KebijakanPrivasiPage';
import NotifikasiPage from './pages/NotifikasiPage';
import ProfilePage from './pages/ProfilePage';
import BukaShiftPage from './pages/kasir/BukaShiftPage';
import TutupShiftPage from './pages/kasir/TutupShiftPage';

const SCREENS_NO_NAV = new Set([
  'splash', 'login', 'nota_step1', 'nota_step2', 'nota_step3', 'nota_berhasil',
  'tambah_customer', 'detail_item_produksi', 'foto_kondisi', 'detail_riwayat_produksi',
  'detail_transaksi', 'cetak_nota', 'detail_customer', 'topup_deposit', 'notifikasi', 'qr_payment', 'pelunasan',
  'kas_outlet', 'kas_approval', 'pengadaan_barang', 'approval_pengadaan_barang', 'daftar_pengadaan_barang',
  'request_barang', 'admin_purchase_requests', 'admin_all_outlet_stocks', 'admin_settings',
  'manajemen_user', 'manajemen_layanan', 'kelola_layanan_outlet', 'admin_promo_sla', 'admin_promo', 'admin_stok', 'kasir_stok_bahan',
  'profil', 'buka_shift', 'tutup_shift', 'admin_laporan', 'admin_shift', 'info_outlet', 'rekap_pendapatan',
  'kasir_antrian', 'kasir_siap_ambil', 'kasir_laporan', 'printer_settings', 'general_report', 'admin_target', 'admin_target_detail', 'admin_period_close',
  'comparison_report', 'forecast', 'laporan_per_outlet', 'manajemen_outlet', 'kebijakan_privasi',
]);

function AppInner() {
  const {
    screen, screenParams, user, customers, transactions,
    navActive, notaCustomer, notaCart,
    navigate, goBack, handleLogin, handleLogout, handleSwitchRole,
    addTransaction, addCustomer, cancelTransaction,
    setNotaCustomer, setNotaCart,
  } = useApp();

  const [sessionExpired, setSessionExpired] = useState(false);

  // Online status — inline (no external import needed)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => { window.removeEventListener('online', onUp); window.removeEventListener('offline', onDown); };
  }, []);

  // Keyboard shortcuts — inline (no external import needed)
  useEffect(() => {
    const handler = (e) => {
      if (!e.key) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      parts.push(e.key.toLowerCase());
      const combo = parts.join('+');
      const shortcuts = {
        'ctrl+n': () => navigate('nota_step1'),
        'ctrl+shift+c': () => navigate('customer'),
        'ctrl+shift+t': () => navigate('transaksi'),
        'ctrl+shift+d': () => navigate('dashboard'),
        'escape': () => goBack(),
      };
      if (shortcuts[combo]) { e.preventDefault(); shortcuts[combo](); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, goBack]);

  useEffect(() => {
    const handler = () => setSessionExpired(true);
    window.addEventListener('waschen:session-expired', handler);
    return () => window.removeEventListener('waschen:session-expired', handler);
  }, []);

  const showNav = user && !SCREENS_NO_NAV.has(screen);

  // ─── Role Guard (using centralized helpers) ──────────────────────────────
  const isAdminUser = isAdmin(user);
  const isFinanceUser = isFinance(user);
  const canViewReports = isAdmin(user) || isFinance(user) || isDataAnalyst(user);

  /** Render fallback jika user tidak punya akses ke screen tertentu */
  const renderUnauthorized = () => {
    // Redirect ke dashboard sesuai role
    setTimeout(() => navigate('dashboard'), 0);
    return null;
  };

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
        if (isAdmin(user))
          return <AdminDashboardPage user={user} navigate={navigate} />;
        if (isFinance(user))
          return <FinanceDashboardPage user={user} navigate={navigate} />;
        if (isProduksi(user))
          return <ProduksiDashboardPage user={user} navigate={navigate} />;
        return <KasirDashboardPage user={user} navigate={navigate} />;

      case 'transaksi':
        return <TransaksiListPage navigate={navigate} screenParams={screenParams} />;
      case 'history_produksi':
        return <ProduksiRiwayatPage navigate={navigate} goBack={goBack} />;
      case 'detail_riwayat_produksi':
        return <DetailRiwayatProduksiPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

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

      case 'qr_payment':
        return <QrPaymentPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'pelunasan':
        return <PelunasanPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

      case 'kas_outlet':
        return <KasOutletPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'kas_approval':
        if (!isAdminUser && !isFinanceUser) return renderUnauthorized();
        return <KasApprovalPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'pengadaan_barang':
      case 'request_barang': // alias lama
        return <RequestBarangPage navigate={navigate} goBack={goBack} screenParams={screenParams} preselectedItem={screenParams?.preselectedItem} />;
      case 'approval_pengadaan_barang':
      case 'daftar_pengadaan_barang': // alias — digabung ke approval
      case 'admin_purchase_requests': // alias lama
        if (!isAdminUser && !isFinanceUser) return renderUnauthorized();
        return <PurchaseRequestApprovalPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'admin_all_outlet_stocks':
        if (!isAdminUser) return renderUnauthorized();
        return <AllOutletStocksPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'admin_settings':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminSettingsPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

      case 'antrian':
        // Produksi: page khusus tanpa info kasir/payment
        if (isProduksi(user)) {
          return <ProduksiAntrianPage navigate={navigate} goBack={goBack} />;
        }
        // Kasir/admin: halaman Antrian & Nota terintegrasi
        return <TransaksiListPage navigate={navigate} screenParams={{ status: 'active', ...screenParams }} />;
      case 'detail_item_produksi':
        return <DetailItemProduksiPage navigate={navigate} goBack={goBack} screenParams={screenParams} user={user} />;
      case 'foto_kondisi':
        return <FotoKondisiPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'produksi_qr_scan':
        return <ProduksiQRScanPage navigate={navigate} goBack={goBack} />;

      // ─── Admin-Only Screens (Role Guard) ─────────────────────────────────
      case 'manajemen_user':
        if (!isAdminUser) return renderUnauthorized();
        return <ManajemenUserPage navigate={navigate} goBack={goBack} />;
      case 'manajemen_outlet':
        if (!isAdminUser) return renderUnauthorized();
        return <ManajemenOutletPage navigate={navigate} goBack={goBack} />;
      case 'manajemen_layanan':
        if (!isAdminUser) return renderUnauthorized();
        return <ManajemenLayananPage navigate={navigate} goBack={goBack} />;
      case 'kelola_layanan_outlet':
        // Kasir & frontline bisa kelola layanan di outlet mereka sendiri
        return <KelolaLayananOutletPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'admin_promo_sla':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="stok" />;
      case 'admin_promo':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="promo" />;
      case 'admin_stok':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="stok" />;
      case 'kasir_stok_bahan':
        return <StokBahanPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'kasir_antrian':
        // Redirect ke halaman Antrian & Nota terintegrasi dengan filter aktif
        return <TransaksiListPage navigate={navigate} screenParams={{ status: 'active', ...screenParams }} />;
      case 'kasir_siap_ambil':
        // Redirect ke halaman transaksi terintegrasi dengan filter pre-applied
        return <TransaksiListPage navigate={navigate} screenParams={{ status: 'selesai', pickupFilter: 'belum_diambil', ...screenParams }} />;
      case 'kasir_shift':
        return <KasirShiftPage navigate={navigate} goBack={goBack} />;
      case 'kasir_laporan':
        return <KasirLaporanPage navigate={navigate} goBack={goBack} />;
      case 'printer_settings':
        return <PrinterSettingsPage navigate={navigate} goBack={goBack} />;
      case 'approval':
        if (!isAdminUser) return renderUnauthorized();
        return <ApprovalPage navigate={navigate} goBack={goBack} />;
      case 'admin_laporan':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminLaporanPage navigate={navigate} goBack={goBack} />;
      case 'admin_shift':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminShiftReportPage navigate={navigate} goBack={goBack} />;
      case 'info_outlet':
        return <InfoOutletPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'rekap_pendapatan':
        if (!canViewReports) return renderUnauthorized();
        return <RekapPendapatanPage navigate={navigate} goBack={goBack} />;
      case 'laporan_per_outlet':
        if (!canViewReports) return renderUnauthorized();
        return <KasirLaporanPage navigate={navigate} goBack={goBack} />;
      case 'general_report':
        if (!canViewReports) return renderUnauthorized();
        return <GeneralReportPage navigate={navigate} goBack={goBack} />;
      case 'admin_target':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminTargetPage navigate={navigate} goBack={goBack} />;
      case 'admin_target_detail':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminTargetDetailPage navigate={navigate} goBack={goBack} screenParams={screenParams} />
      case 'admin_period_close':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminPeriodClosePage navigate={navigate} goBack={goBack} />;
      case 'comparison_report':
        if (!canViewReports) return renderUnauthorized();
        return <ComparisonReportPage navigate={navigate} goBack={goBack} />;
      case 'forecast':
        if (!canViewReports) return renderUnauthorized();
        return <ForecastPage navigate={navigate} goBack={goBack} />;

      // ─── Finance-Only Screens (Role Guard) ───────────────────────────────
      case 'verifikasi_payment':
        if (!isFinanceUser) return renderUnauthorized();
        return <VerifikasiPaymentPage navigate={navigate} goBack={goBack} />;
      case 'laporan_keuangan':
        if (!isFinanceUser) return renderUnauthorized();
        return <LaporanKeuanganPage navigate={navigate} goBack={goBack} />;

      case 'topup_deposit':
        return <TopupDepositPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

      case 'settings':
        return <SettingsPage user={user} navigate={navigate} onLogout={handleLogout} onSwitchRole={handleSwitchRole} />;

      case 'kebijakan_privasi':
        return <KebijakanPrivasiPage goBack={goBack} />;

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
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
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
          font-size: 14px;
        }
        /* Prevent horizontal overflow on all direct children */
        .app-inner > * {
          max-width: 100%;
          overflow-x: hidden;
        }
        /* Scrollable areas should clip content */
        .app-inner [style*="overflowY: auto"],
        .app-inner [style*="overflow-y: auto"] {
          overflow-x: hidden !important;
        }
        /* Tablet / iPad — scale up font & touch targets */
        @media (min-width: 768px) {
          .app-inner {
            font-size: 15px;
          }
          .app-inner button {
            min-height: 44px;
          }
        }
        /* Large tablet / iPad Pro */
        @media (min-width: 1024px) {
          .app-inner {
            font-size: 16px;
          }
        }
        /* Datepicker popper must escape overflow */
        .react-datepicker-popper {
          z-index: 9999 !important;
        }
      `}</style>

      <ErrorBoundary key={screen}>
        <GlobalPullToRefresh>
          {renderScreen()}
        </GlobalPullToRefresh>
      </ErrorBoundary>

      <OfflineIndicator online={online} />

      {showNav && (
        <BottomNav role={user.roleCode || user.role} active={navActive} navigate={navigate} />
      )}

      {sessionExpired && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: '32px 24px', maxWidth: 320, width: '90%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <span style={{ fontSize: 28 }}>🔒</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Sesi Berakhir</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 20 }}>
              Sesi login Anda telah berakhir. Silakan login kembali untuk melanjutkan.
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{ width: '100%', padding: '12px 0', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: 'white', background: '#5B005F', border: 'none', borderRadius: 12, cursor: 'pointer' }}
            >
              Login Kembali
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <div className="app-wrapper">
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          width: 100%;
          height: 100%;
        }
        .app-wrapper {
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #F1F5F9;
        }
        .app-content {
          width: 100%;
          height: 100%;
          overflow: hidden;
          position: relative;
        }
      `}</style>
      <div className="app-content">
        <GlobalErrorBoundary>
          <AppProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/*" element={<AppInner />} />
              </Routes>
            </BrowserRouter>
          </AppProvider>
        </GlobalErrorBoundary>
      </div>
    </div>
  );
}
