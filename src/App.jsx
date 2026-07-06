import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BottomNav, ErrorBoundary, OfflineIndicator, GlobalPullToRefresh, GlobalErrorBoundary } from './components/ui';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { C } from './utils/theme';
import { isAdmin, isFinance, isProduksi, isDelivery, isDataAnalyst, ADMIN_ROLES, FINANCE_ROLES } from './utils/roles';
import { Toaster } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

// Auth
import SplashPage from './pages/auth/SplashPage';
import LoginPage from './pages/auth/LoginPage';

// Components
import ShiftPromptModal from './components/ShiftPromptModal';
import { useShiftEnforcement, screenNeedsShift } from './utils/useShiftEnforcement';

// Kasir (frequently used - no lazy)
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
import KasOutletPage from './pages/KasOutletPage';
import KasApprovalPage from './pages/admin/KasApprovalPage';
import AdminKasOverviewPage from './pages/admin/AdminKasOverviewPage';
import PurchaseRequestApprovalPage from './pages/admin/PurchaseRequestApprovalPage';
import RequestBarangPage from './pages/kasir/RequestBarangPage';
import AllOutletStocksPage from './pages/admin/AllOutletStocksPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import StokBahanPage from './pages/kasir/StokBahanPage';
import KasirShiftPage from './pages/kasir/ShiftPage';
import PrinterSettingsPage from './pages/kasir/PrinterSettingsPage';
import KasirLaporanPage from './pages/kasir/LaporanPage';
import CashDepositPage from './pages/kasir/CashDepositPage';
import CashDepositApproval from './pages/admin/CashDepositApproval';

// Admin Dashboard (frequently used - no lazy)
import AdminDashboardPage from './pages/admin/DashboardPage';

// Admin pages (lazy loaded for performance)
const ManajemenUserPage = lazy(() => import('./pages/admin/ManajemenUserPage'));
const ManajemenOutletPage = lazy(() => import('./pages/admin/ManajemenOutletPage'));
const ManajemenLayananPage = lazy(() => import('./pages/admin/ManajemenLayananPage'));
const KelolaLayananOutletPage = lazy(() => import('./pages/admin/KelolaLayananOutletPage'));
const AdminLaporanPage = lazy(() => import('./pages/admin/AdminLaporanPage'));
// ApprovalCenterPage & InventoryMasterPage: non-lazy (frequently used)
import ApprovalCenterPage from './pages/admin/ApprovalCenterPage';
import InventoryMasterPage from './pages/admin/InventoryMasterPage';
const AdminShiftReportPage = lazy(() => import('./pages/admin/AdminShiftReportPage'));
const AdminSubSessionPage = lazy(() => import('./pages/admin/AdminSubSessionPage'));
const AdminPromoSlaStokPage = lazy(() => import('./pages/admin/AdminPromoSlaStokPage'));
const BirthdayPage = lazy(() => import('./pages/admin/BirthdayPage'));
const ErrorDashboardPage = lazy(() => import('./pages/admin/ErrorDashboardPage'));
const InfoOutletPage = lazy(() => import('./pages/admin/InfoOutletPage'));
const RekapPendapatanPage = lazy(() => import('./pages/admin/RekapPendapatanPage'));
const GeneralReportPage = lazy(() => import('./pages/admin/GeneralReportPage'));
const AdminTargetPage = lazy(() => import('./pages/admin/AdminTargetPage'));
const AdminTargetDetailPage = lazy(() => import('./pages/admin/AdminTargetDetailPage'));
const AdminPeriodClosePage = lazy(() => import('./pages/admin/AdminPeriodClosePage'));
const ComparisonReportPage = lazy(() => import('./pages/admin/ComparisonReportPage'));
const ForecastPage = lazy(() => import('./pages/admin/ForecastPage'));
const SetorApprovalPage = lazy(() => import('./pages/admin/SetorApprovalPage'));

// Produksi
import ProduksiDashboardPage from './pages/produksi/DashboardPage';
import ProduksiAntrianPage from './pages/produksi/AntrianPage';
import DetailItemProduksiPage from './pages/produksi/DetailItemPage';
import FotoKondisiPage from './pages/produksi/FotoKondisiPage';
import ProduksiQRScanPage from './pages/produksi/QRScanPage';
import ProduksiRiwayatPage from './pages/produksi/RiwayatPage';
import DetailRiwayatProduksiPage from './pages/produksi/DetailRiwayatProduksiPage';
import ProduksiNotifikasiPage from './pages/produksi/NotifikasiPage';

// Finance (lazy loaded for performance)
const FinanceDashboardPage = lazy(() => import('./pages/finance/DashboardPage'));
const VerifikasiPaymentPage = lazy(() => import('./pages/finance/VerifikasiPaymentPage'));
const LaporanKeuanganPage = lazy(() => import('./pages/finance/LaporanKeuanganPage'));

// Member
import DetailCustomerPage from './pages/member/DetailCustomerPage';
import TopupDepositPage from './pages/member/TopupDepositPage';
import DaftarMemberPage from './pages/member/DaftarMemberPage';
import MembershipRegistrationPage from './pages/member/MembershipRegistrationPage';

// Delivery
import DriverDashboardPage from './pages/delivery/DashboardPage';

// Shared pages
import SettingsPage from './pages/SettingsPage';
import KebijakanPrivasiPage from './pages/KebijakanPrivasiPage';
import NotifikasiPage from './pages/NotifikasiPage';
import ProfilePage from './pages/ProfilePage';
import SetorTunaiPage from './pages/kasir/SetorTunaiPage';

// ── Lazy Loading Fallback ─────────────────────────────────────────────────────
const PageLoader = () => (
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    background: C.n50,
  }}>
    <div style={{
      width: 32,
      height: 32,
      border: '3px solid ' + C.n200,
      borderTopColor: C.primary,
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <span style={{
      fontFamily: 'Poppins',
      fontSize: 13,
      color: '#3a3a3a',
    }}>Memuat...</span>
  </div>
);

// ── Lazy Component Wrapper ────────────────────────────────────────────────────
// Wrap lazy-loaded component dengan Suspense untuk loading state
const withSuspense = (LazyComponent) => (props) => (
  <Suspense fallback={<PageLoader />}>
    <LazyComponent {...props} />
  </Suspense>
);

// Pre-wrap lazy components
const LazyManajemenUserPage = withSuspense(ManajemenUserPage);
const LazyManajemenOutletPage = withSuspense(ManajemenOutletPage);
const LazyManajemenLayananPage = withSuspense(ManajemenLayananPage);
const LazyKelolaLayananOutletPage = withSuspense(KelolaLayananOutletPage);
const LazyAdminLaporanPage = withSuspense(AdminLaporanPage);
const LazyAdminShiftReportPage = withSuspense(AdminShiftReportPage);
const LazyAdminSubSessionPage = withSuspense(AdminSubSessionPage);
const LazyAdminPromoSlaStokPage = withSuspense(AdminPromoSlaStokPage);
const LazyBirthdayPage = withSuspense(BirthdayPage);
const LazyErrorDashboardPage = withSuspense(ErrorDashboardPage);
const LazyInfoOutletPage = withSuspense(InfoOutletPage);
const LazyRekapPendapatanPage = withSuspense(RekapPendapatanPage);
const LazyGeneralReportPage = withSuspense(GeneralReportPage);
const LazyAdminTargetPage = withSuspense(AdminTargetPage);
const LazyAdminTargetDetailPage = withSuspense(AdminTargetDetailPage);
const LazyAdminPeriodClosePage = withSuspense(AdminPeriodClosePage);
const LazyComparisonReportPage = withSuspense(ComparisonReportPage);
const LazyForecastPage = withSuspense(ForecastPage);
const LazySetorApprovalPage = withSuspense(SetorApprovalPage);
const LazyFinanceDashboardPage = withSuspense(FinanceDashboardPage);
const LazyVerifikasiPaymentPage = withSuspense(VerifikasiPaymentPage);
const LazyLaporanKeuanganPage = withSuspense(LaporanKeuanganPage);

const SCREENS_NO_NAV = new Set([
  'splash', 'login', 'nota_step1', 'nota_step2', 'nota_step3', 'nota_berhasil',
  'tambah_customer', 'detail_item_produksi', 'foto_kondisi', 'detail_riwayat_produksi',
  'detail_transaksi', 'cetak_nota', 'detail_customer', 'topup_deposit', 'notifikasi', 'notifikasi_produksi', 'pelunasan',
  'membership_register',
  'kas_outlet', 'kas_approval', 'admin_kas_overview', 'pengadaan_barang', 'approval_pengadaan_barang', 'daftar_pengadaan_barang',
  'request_barang', 'admin_purchase_requests', 'admin_all_outlet_stocks', 'admin_settings',
  'manajemen_user', 'manajemen_layanan', 'kelola_layanan_outlet', 'admin_promo_sla', 'admin_promo', 'admin_stok', 'kasir_stok_bahan', 'birthday', 'error_dashboard',
  'profil', 'buka_shift', 'tutup_shift', 'oper_shift', 'setor_tunai', 'admin_laporan', 'admin_shift', 'setor_approval', 'info_outlet', 'rekap_pendapatan',
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

  // Kasir role identifiers
  const CASHIER_ROLES = new Set(['kasir', 'frontline']);

  // ── Shift enforcement (global) ────────────────────────────────────────────
  const [shiftPromptVisible, setShiftPromptVisible] = useState(false);

  const handleShiftRequired = useCallback((message) => {
    setShiftPromptVisible(true);
  }, []);

  const { shiftOpen, checkShift } = useShiftEnforcement({
    onShiftRequired: handleShiftRequired,
  });

  // Cek shift saat mount dan saat screen berubah ke halaman keuangan
  useEffect(() => {
    if (!user) return;
    if (!CASHIER_ROLES.has(user.roleCode)) return;
    if (!screenNeedsShift(user, screen)) return;
    checkShift();
  }, [user, screen, checkShift]);

  // ── Online status ─────────────────────────────────────────────────────────
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
      case 'tutup_shift':
      case 'oper_shift':
        return <KasirShiftPage goBack={goBack} initialScreen={screen} />;
      case 'setor_tunai':
        return <SetorTunaiPage goBack={goBack} />;
      case 'setor_approval':
        if (!isAdminUser) return renderUnauthorized();
        return <LazySetorApprovalPage goBack={goBack} />;
      case 'dashboard':
        if (!user) return <LoginPage onLogin={handleLogin} />;
        if (isAdmin(user))
          return <AdminDashboardPage user={user} navigate={navigate} />;
        if (isFinance(user))
          return <FinanceDashboardPage user={user} navigate={navigate} />;
        if (isProduksi(user))
          return <ProduksiDashboardPage user={user} navigate={navigate} />;
        if (isDelivery(user))
          return <DriverDashboardPage user={user} navigate={navigate} />;
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

      case 'pelunasan':
        return <PelunasanPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

      case 'kas_outlet':
        return <KasOutletPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'kas_approval':
        if (!isAdminUser && !isFinanceUser) return renderUnauthorized();
        return <KasApprovalPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'admin_kas_overview':
        if (!isAdminUser) return renderUnauthorized();
        return <AdminKasOverviewPage navigate={navigate} goBack={goBack} />;
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

      case 'notifikasi_produksi':
        return <ProduksiNotifikasiPage navigate={navigate} />;
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

      // ─── Admin-Only Screens (Role Guard, Lazy Loaded) ────────────────────
      case 'manajemen_user':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyManajemenUserPage navigate={navigate} goBack={goBack} />;
      case 'manajemen_outlet':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyManajemenOutletPage navigate={navigate} goBack={goBack} />;
      case 'manajemen_layanan':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyManajemenLayananPage navigate={navigate} goBack={goBack} />;
      case 'kelola_layanan_outlet':
        // Kasir & frontline bisa kelola layanan di outlet mereka sendiri
        return <LazyKelolaLayananOutletPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'admin_promo_sla':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="stok" />;
      case 'admin_promo':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminPromoSlaStokPage navigate={navigate} goBack={goBack} initialTab="promo" />;
      case 'birthday':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyBirthdayPage navigate={navigate} goBack={goBack} />;
      case 'error_dashboard':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyErrorDashboardPage navigate={navigate} goBack={goBack} />;
      case 'admin_stok':
      case 'admin_inventory':
        if (!isAdminUser) return renderUnauthorized();
        return <InventoryMasterPage goBack={goBack} />;
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
      case 'cash_deposit':
        return <CashDepositPage navigate={navigate} goBack={goBack} />;
      case 'admin_cash_deposit':
        if (!isAdminUser && !isFinanceUser) return renderUnauthorized();
        return <CashDepositApproval navigate={navigate} goBack={goBack} />;
      case 'approval':
        if (!isAdminUser) return renderUnauthorized();
        return <ApprovalCenterPage goBack={goBack} />;
      case 'admin_laporan':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminLaporanPage navigate={navigate} goBack={goBack} />;
      case 'admin_shift':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminShiftReportPage navigate={navigate} goBack={goBack} />;
      case 'admin_sub_session':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminSubSessionPage navigate={navigate} goBack={goBack} />;
      case 'info_outlet':
        return <LazyInfoOutletPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;
      case 'rekap_pendapatan':
        if (!canViewReports) return renderUnauthorized();
        return <LazyRekapPendapatanPage navigate={navigate} goBack={goBack} />;
      case 'laporan_per_outlet':
        if (!canViewReports) return renderUnauthorized();
        return <KasirLaporanPage navigate={navigate} goBack={goBack} />;
      case 'general_report':
        if (!canViewReports) return renderUnauthorized();
        return <LazyGeneralReportPage navigate={navigate} goBack={goBack} />;
      case 'admin_target':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminTargetPage navigate={navigate} goBack={goBack} />;
      case 'admin_target_detail':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminTargetDetailPage navigate={navigate} goBack={goBack} screenParams={screenParams} />
      case 'admin_period_close':
        if (!isAdminUser) return renderUnauthorized();
        return <LazyAdminPeriodClosePage navigate={navigate} goBack={goBack} />;
      case 'comparison_report':
        if (!canViewReports) return renderUnauthorized();
        return <LazyComparisonReportPage navigate={navigate} goBack={goBack} />;
      case 'forecast':
        if (!canViewReports) return renderUnauthorized();
        return <LazyForecastPage navigate={navigate} goBack={goBack} />;

      // ─── Finance-Only Screens (Role Guard, Lazy Loaded) ─────────────────
      case 'verifikasi_payment':
        if (!isFinanceUser) return renderUnauthorized();
        return <LazyVerifikasiPaymentPage navigate={navigate} goBack={goBack} />;
      case 'laporan_keuangan':
        if (!isFinanceUser) return renderUnauthorized();
        return <LazyLaporanKeuanganPage navigate={navigate} goBack={goBack} />;

      case 'topup_deposit':
        return <TopupDepositPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

      case 'membership_register':
        return <MembershipRegistrationPage navigate={navigate} goBack={goBack} screenParams={screenParams} />;

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
        /* Make sure all interactive elements have good touch targets */
        .app-inner button,
        .app-inner a,
        .app-inner [role="button"],
        .app-inner [tabindex]:not([tabindex="-1"]) {
          min-height: 44px;
          min-width: 44px;
        }
        /* Tiny buttons that can stay small if needed (override with inline styles) */
        .app-inner button.tiny,
        .app-inner a.tiny {
          min-height: auto;
          min-width: auto;
        }
        /* Tablet / iPad — scale up font */
        @media (min-width: 768px) {
          .app-inner {
            font-size: 15px;
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

      <ErrorBoundary>
        <GlobalPullToRefresh>
          <AnimatePresence mode="wait">
            <motion.div
              key={screen}
              initial={{ opacity: 0, x: 30, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -30, scale: 0.98 }}
              transition={{
                duration: 0.25,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
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
              style={{ width: '100%', padding: '12px 0', fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: 'white', background: '#6e2e78', border: 'none', borderRadius: 12, cursor: 'pointer' }}
            >
              Login Kembali
            </button>
          </div>
        </div>
      )}

      {/* ── Shift Prompt Modal (global — triggered by API 403 or mount check) ── */}
      <ShiftPromptModal
        visible={shiftPromptVisible}
        onOpenShift={() => {
          setShiftPromptVisible(false);
          navigate('kasir_shift');
        }}
        onClose={() => setShiftPromptVisible(false)}
      />
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
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: 'Poppins, sans-serif',
              borderRadius: '14px',
              background: '#fff',
              boxShadow: '0 4px 20px rgba(110, 46, 120, 0.12), 0 2px 8px rgba(0,0,0,0.06)',
              fontSize: '13px',
            },
          }}
        />
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
