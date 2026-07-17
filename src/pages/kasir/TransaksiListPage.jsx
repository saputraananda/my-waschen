import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import axios from 'axios';

import { C, SHADOW } from '../../utils/theme';

import { rp, txApiId } from '../../utils/helpers';

import { TopBar, SearchBar, Badge, Chip, EmptyState, Modal, SkeletonList, useAppRefresh, ListCard, ListCardGroup, ProfileAvatar } from '../../components/ui';

import { AnimatedCard } from '../../components/AnimatedListCard';

import { useDebounce, useResponsive, useWindowSize } from '../../utils/hooks';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useSavedFilter } from '../../utils/savedFilters';
import { useRealtimeMulti } from '../../utils/realtime';


const PAGE_SIZE = 30;

// Glass card CSS - injected once
const GLASS_STYLES = `
  :root {
    --purple-deep: #3B0B47;
    --purple-mid: #5C1A6B;
    --magenta: #C0247D;
    --magenta-soft: #E85AA8;
    --mint: #5FD9AE;
    --mint-deep: #1F9E75;
    --coral: #F0466B;
    --coral-deep: #B82848;
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
    --ink: #2B1130;
    --ink-soft: #7A6584;
  }

  .glass-card {
    background: var(--glass-strong);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    box-shadow:
      0 20px 40px -12px rgba(59, 11, 71, 0.22),
      0 4px 12px rgba(59, 11, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .glass-btn {
    background: var(--glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(59, 11, 71, 0.15);
  }

  .clay-avatar {
    border-radius: 18px;
    background: linear-gradient(145deg, #FFFFFF, #E9D3F2);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.7),
      5px 6px 14px rgba(59, 11, 71, 0.25),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  /* Header gradient with blobs */
  .tx-header {
    background:
      radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
      radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
      linear-gradient(155deg, var(--purple-deep) 0%, var(--purple-mid) 55%, #4A1259 100%);
    position: relative;
    overflow: hidden;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(18px);
  }

  .tx-blob-1 {
    width: 180px;
    height: 180px;
    background: radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%);
    top: -60px;
    right: -40px;
    animation: floatB 11s ease-in-out infinite;
  }

  .tx-blob-2 {
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%);
    bottom: 20px;
    left: -50px;
    animation: floatC 16s ease-in-out infinite;
  }

  .tx-blob-3 {
    width: 90px;
    height: 90px;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    top: 40px;
    left: 55%;
    animation: floatA 9s ease-in-out infinite;
  }

  @keyframes floatA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-14px, 16px) scale(1.08); } }
  @keyframes floatB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(18px, -12px) scale(1.1); } }
  @keyframes floatC { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(16px, 10px) scale(0.95); } }

  @media (prefers-reduced-motion: reduce) { .tx-blob-1, .tx-blob-2, .tx-blob-3 { animation: none; } }
`;

// Inject styles on mount
function useGlassStyles() {
  useEffect(() => {
    const styleId = 'glass-tx-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLASS_STYLES;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
}

// Transaction avatar with clay style
function TransactionAvatar({ transaction, size = 52 }) {
  useGlassStyles();

  return (
    <div
      className="clay-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        padding: 0,
      }}
    >
      <ProfileAvatar
        user={{
          name: transaction.customerName,
          photo: transaction.customerPhoto,
          gender: transaction.customerGender,
          type: 'customer',
        }}
        size={size}
        showBorder={false}
        style={{ width: size, height: size }}
      />
    </div>
  );
}

// Unified status filters — semua status pesanan di 1 halaman
// 'active' = nota yang masih aktif (belum diambil) — gabungan baru/proses/selesai (siap ambil)
const STATUS_FILTERS = [
  { key: 'semua',      label: 'Semua' },
  { key: 'active',     label: 'Aktif' },
  { key: 'baru',       label: 'Baru' },
  { key: 'proses',     label: 'Proses' },
  { key: 'selesai',    label: 'Siap Ambil' },
  { key: 'diambil',    label: 'Diambil' },
  { key: 'dibatalkan', label: 'Batal' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'deadline', label: 'Deadline terdekat' },
  { value: 'deadline_desc', label: 'Deadline terjauh' },
  { value: 'oldest', label: 'Terlama' },
  { value: 'name_asc', label: 'Nama A-Z' },
  { value: 'name_desc', label: 'Nama Z-A' },
  { value: 'amount_asc', label: 'Nominal rendah' },
  { value: 'amount_desc', label: 'Nominal tinggi' },
];

// Payment status filters
const PAYMENT_FILTERS = [
  { value: 'semua', label: 'Semua' },
  { value: 'lunas', label: 'Lunas' },
  { value: 'belum_lunas', label: 'Belum Lunas' },
  { value: 'partial', label: 'DP/Sebagian' },
];

const PERIODS = [
  { value: 'all', label: 'Semua Waktu' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: 'this_month', label: 'Bulan Ini' },
];

// Pickup / pengambilan filters
const PICKUP_FILTERS = [
  { value: 'semua', label: 'Semua' },
  { value: 'belum_diambil', label: 'Belum Diambil' },
  { value: 'sudah_diambil', label: 'Sudah Diambil' },
];

// Badge color helper for payment status
const payBadgeStyle = (status) => {
  if (status === 'paid') return { bg: '#10B98120', color: '#10B981', label: 'Lunas' };
  if (status === 'partial') return { bg: '#F59E0B20', color: '#F59E0B', label: 'DP' };
  return { bg: '#6B728020', color: '#6B7280', label: 'Belum Lunas' };
};

// Order status badge colors
const ORDER_STATUS_META = {
  baru: { bg: '#3B82F620', color: '#3B82F6', label: 'BARU', border: '#3B82F6' },
  proses: { bg: '#F59E0B20', color: '#F59E0B', label: 'PROSES', border: '#F59E0B' },
  selesai: { bg: '#10B98120', color: '#10B981', label: 'SIAP', border: '#10B981' },
  diambil: { bg: '#6B728020', color: '#6B7280', label: 'DIAMBIL', border: '#6B7280' },
  dibatalkan: { bg: '#EF444420', color: '#EF4444', label: 'BATAL', border: '#EF4444' },
};

// Card border colors for special conditions
const CARD_BORDER_COLORS = {
  express: '#F59E0B',    // Yellow/orange for express
  overdue: '#EF4444',     // Red for overdue
  expressOverdue: '#DC2626', // Darker red for both
};

// Helper to check if due date is overdue
const isOverdue = (tx) => {
  if (!tx.dueDate) return false;
  const dueDate = new Date(tx.dueDate);
  const now = new Date();
  // Set time to end of day for comparison
  dueDate.setHours(23, 59, 59, 999);
  return now > dueDate && tx.status !== 'diambil' && tx.status !== 'dibatalkan';
};



export default function TransaksiListPage({ navigate, historyOnly, screenParams }) {

  useGlassStyles();

  const [transactions, setTransactions] = useState([]);

  const [loading, setLoading] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);

  const [updating, setUpdating] = useState(null);

  const [query, setQuery] = useState('');

  // Saved filter — persist 4 filter utama ke localStorage. screenParams override saved.
  const [savedFilters, setSavedFilters] = useSavedFilter('transaksi-list', {
    status: 'semua', period: 'all', payment: 'semua', pickup: 'semua',
  });

  const [activeFilter, setActiveFilter] = useState(screenParams?.status || savedFilters.status);

  const [periodFilter, setPeriodFilter] = useState(screenParams?.period || savedFilters.period);

  const [sortBy, setSortBy] = useState(screenParams?.sort || 'newest');

// Map frontend sort to API sort
const getApiSort = (sortValue) => {
  const sortMap = {
    newest: { field: 'created_at', direction: 'desc' },
    oldest: { field: 'created_at', direction: 'asc' },
    deadline: { field: 'due_date', direction: 'asc' },
    deadline_desc: { field: 'due_date', direction: 'desc' },
    name_asc: { field: 'customer_name', direction: 'asc' },
    name_desc: { field: 'customer_name', direction: 'desc' },
    amount_asc: { field: 'total', direction: 'asc' },
    amount_desc: { field: 'total', direction: 'desc' },
  };
  return sortMap[sortValue] || sortMap.newest;
};

  // Unified payment filter (replaces old onlyUnpaid boolean)
  const [paymentFilter, setPaymentFilter] = useState(screenParams?.paymentFilter || savedFilters.payment);

  // Unified pickup filter
  const [pickupFilter, setPickupFilter] = useState(screenParams?.pickupFilter || savedFilters.pickup);

  const [onlyExpress, setOnlyExpress] = useState(!!screenParams?.onlyExpress);

  // Sync filter changes ke localStorage (kecuali kalau dari screenParams)
  useEffect(() => {
    setSavedFilters({
      status: activeFilter,
      period: periodFilter,
      payment: paymentFilter,
      pickup: pickupFilter,
    });
  }, [activeFilter, periodFilter, paymentFilter, pickupFilter, setSavedFilters]);

  const [filterOpen, setFilterOpen] = useState(false);

  const [page, setPage] = useState(1);

  const [hasMore, setHasMore] = useState(true);

  const [totalCount, setTotalCount] = useState(0);

  const debouncedQuery = useDebounce(query, 250);

  const scrollRef = useRef(null);

  const pageRef = useRef(1);



  const fetchTransactions = useCallback(async (pageToLoad, append = false) => {

    if (append) {

      setLoadingMore(true);

    } else {

      setLoading(true);

    }

    try {

      const params = {

        page: pageToLoad,

        limit: PAGE_SIZE,

        status: activeFilter,

        search: debouncedQuery.trim() || undefined,

        period: periodFilter,

        ...getApiSort(sortBy),

        isExpress: onlyExpress ? '1' : undefined,

      };

      // Payment status filter
      if (paymentFilter === 'lunas') params.paymentStatus = 'paid';
      else if (paymentFilter === 'belum_lunas') params.paymentStatus = 'unpaid';
      else if (paymentFilter === 'partial') params.paymentStatus = 'partial';

      // Pickup filter — maps to status filter
      if (pickupFilter === 'belum_diambil') params.pickupStatus = 'belum';
      else if (pickupFilter === 'sudah_diambil') params.pickupStatus = 'sudah';

      const res = await axios.get('/api/transactions', { params });

      const data = res?.data?.data || [];

      const pagination = res?.data?.pagination || {};

      const total = Number(pagination.total || 0);

      setTotalCount(total);

      setHasMore((pagination.page || pageToLoad) < (pagination.totalPages || 1));

      pageRef.current = pagination.page || pageToLoad;

      setPage(pageRef.current);

      setTransactions((prev) => (append ? [...prev, ...data] : data));

    } catch (error) {
      // Error handled silently - UI should show appropriate state
    } finally {

      setLoading(false);

      setLoadingMore(false);

    }

  }, [activeFilter, debouncedQuery, periodFilter, sortBy, onlyExpress, paymentFilter, pickupFilter]);



  useEffect(() => {

    pageRef.current = 1;

    setPage(1);

    setHasMore(true);

    fetchTransactions(1, false);

  }, [fetchTransactions, historyOnly]);

  // Pull-to-refresh
  useAppRefresh(() => fetchTransactions(1, false), [fetchTransactions]);

  // Realtime: refresh saat ada checkout baru atau payment masuk di outlet ini
  useRealtimeMulti(['transaction:checkout', 'payment:settled'], () => {
    fetchTransactions(1, false);
  });



  const list = useMemo(() => {

    if (!historyOnly) return transactions;

    return transactions.filter((t) => t.status === 'selesai' || t.status === 'diambil');

  }, [transactions, historyOnly]);


  // ── Alerts dari produksi (dari halaman antrian lama) ──
  const alerts = useMemo(() => {
    const prodIncomplete = list.filter((tx) => {
      const p = tx.production;
      return p && p.notReadyUnits > 0 && (tx.status === 'baru' || tx.status === 'proses');
    });
    const siapPrematur = list.filter((tx) => {
      const p = tx.production;
      return tx.status === 'selesai' && p && !p.allProductionReady;
    });
    const siapTanpaFoto = list.filter((tx) => {
      const p = tx.production;
      return tx.status === 'selesai' && p?.allProductionReady && !p?.hasPackingPhoto;
    });
    return { prodIncomplete, siapPrematur, siapTanpaFoto };
  }, [list]);


  const markReady = async (e, tx) => {
    e?.stopPropagation();
    const prod = tx.production;
    if (prod && !prod.canMarkReadyForPickup) {
      alertWarning(
        prod.allProductionReady
          ? 'Produksi belum mengunggah foto packing. Minta tim produksi selesaikan dokumentasi dulu.'
          : `Produksi masih di tahap: ${prod.productionStageLabel || 'belum selesai'}. Order belum boleh ditandai siap diambil.`
      );
      return;
    }

    setUpdating(tx.id);
    try {
      await axios.put(`/api/transactions/${txApiId(tx)}/status`, { status: 'ready_for_pickup' });
      alertSuccess(`${tx.transactionNo || tx.id} ditandai Siap Ambil.`);
      fetchTransactions(1, false);
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal update status');
    } finally {
      setUpdating(null);
    }
  };



  const title = historyOnly ? 'Riwayat Produksi' : 'Antrian & Nota';

  const activeFilterCount = [

    activeFilter !== 'semua',

    periodFilter !== 'all',

    paymentFilter !== 'semua',

    pickupFilter !== 'semua',

    onlyExpress,

    sortBy !== 'newest',

  ].filter(Boolean).length;


  // Map status to orderStatus for ListCard styling
  const orderStatusMap = {
    baru: 'baru',
    proses: 'proses',
    selesai: 'selesai',
    selesai_pickup: 'selesai',
    ready_for_pickup: 'selesai',
    picked_up: 'diambil',
    diambil: 'diambil',
    cancelled: 'dibatalkan',
    dibatalkan: 'dibatalkan',
  };

  return (

    <div style={{ flex: 2, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', overflow: 'hidden' }}>

      {/* Glass header with gradient */}
      <div className="tx-header" style={{
        position: 'relative',
        padding: '16px 16px 20px',
        overflow: 'hidden',
      }}>
        {/* Atmospheric blobs */}
        <div className="blob tx-blob-1" />
        <div className="blob tx-blob-2" />
        <div className="blob tx-blob-3" />

        {/* Header content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 800, color: C.white, textShadow: '0 2px 8px rgba(59,11,71,0.3)' }}>{title}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{historyOnly ? list.length : totalCount} total</div>
        </div>
      </div>


      <div

        ref={scrollRef}

        onScroll={(e) => {

          const el = e.currentTarget;

          if (loading || loadingMore || !hasMore) return;

          if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {

            fetchTransactions(pageRef.current + 1, true);

          }

        }}

        style={{ flex: 2, overflowY: 'auto', padding: '0 16px 16px' }}>


        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--glass-bg)', padding: '12px 0 8px' }}>

          {/* Glass search bar */}
          <div className="glass-card" style={{
            padding: '4px 4px 4px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, no nota, atau telepon..."
              style={{
                flex: 2,
                border: 'none',
                outline: 'none',
                fontFamily: 'Poppins',
                fontSize: 13,
                color: 'var(--ink)',
                background: 'transparent',
                padding: '10px 0',
              }}
            />
          </div>

          {/* Filter button row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => setFilterOpen(true)}
              aria-label="Filter"
              className="clay-avatar"
              style={{
                padding: '8px 14px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: 'var(--purple-mid)',
                position: 'relative',
                height: 40,
                flexShrink: 0,
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="14" y2="6" />
                <line x1="20" y1="6" x2="18" y2="6" />
                <circle cx="16" cy="6" r="2" />
                <line x1="4" y1="12" x2="6" y2="12" />
                <line x1="20" y1="12" x2="10" y2="12" />
                <circle cx="8" cy="12" r="2" />
                <line x1="4" y1="18" x2="12" y2="18" />
                <line x1="20" y1="18" x2="16" y2="18" />
                <circle cx="14" cy="18" r="2" />
              </svg>
              Filter
              {activeFilterCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: 'var(--coral)', color: '#FFF',
                  fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>{activeFilterCount}</span>
              )}
            </button>
          </div>
        </div>


        {/* Alerts dari produksi */}
        {!loading && (alerts.prodIncomplete.length > 0 || alerts.siapPrematur.length > 0 || alerts.siapTanpaFoto.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {alerts.prodIncomplete.length > 0 && (
              <div style={{ background: '#FEF3C720', border: '1px solid #F59E0B', borderRadius: 12, padding: '10px 12px', fontFamily: 'Poppins', fontSize: 11, color: '#D97706' }}>
                <strong>⚠️ {alerts.prodIncomplete.length} order</strong> masih diproses di produksi (belum selesai cuci/setrika/packing). Jangan tandai siap diambil sebelum produksi selesai.
              </div>
            )}
            {alerts.siapPrematur.length > 0 && (
              <div style={{ background: '#FEE2E220', border: '1px solid #EF4444', borderRadius: 12, padding: '10px 12px', fontFamily: 'Poppins', fontSize: 11, color: '#DC2626' }}>
                <strong>🚨 {alerts.siapPrematur.length} order</strong> berstatus siap diambil tetapi produksi belum rampung. Koordinasikan dengan tim produksi.
              </div>
            )}
            {alerts.siapTanpaFoto.length > 0 && (
              <div style={{ background: '#EFF6FF20', border: '1px solid #3B82F6', borderRadius: 12, padding: '10px 12px', fontFamily: 'Poppins', fontSize: 11, color: '#2563EB' }}>
                <strong>📷 {alerts.siapTanpaFoto.length} order</strong> belum ada foto packing di produksi. Wajib dokumentasi sebelum diserahkan ke customer.
              </div>
            )}
          </div>
        )}

        {loading ? (

          <SkeletonList count={5} lines={3} />

        ) : list.length === 0 ? (

          <div style={{ padding: '20px 0' }}>
            <EmptyState
              type="transactions"
              title="Tidak Ada Transaksi"
              message="Belum ada transaksi yang sesuai filter"
              suggestion="Coba ubah filter atau buat transaksi baru"
              action={{ label: '+ Buat Nota Baru', onClick: () => navigate('nota_step1') }}
              onAction={() => navigate('nota_step1')}
              illustrationSize={120}
            />
          </div>

        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 80 }}>
              {list.map((tx, idx) => {
                const pay = payBadgeStyle(tx.paymentStatus);
                const prod = tx.production;
                const prodWarn = prod && prod.notReadyUnits > 0;
                const siapMismatch = tx.status === 'selesai' && prod && !prod.allProductionReady;
                const canMarkReady = (tx.status === 'proses' || tx.status === 'baru') && prod?.canMarkReadyForPickup;
                const isUpdating = updating === tx.id;

                // Detect if transaction has express items
                const hasExpress = tx.items?.some((i) => i.express);

                // Check if overdue
                const overdue = isOverdue(tx);

                // Map status to orderMeta (must be defined before border calculations)
                const mappedOrderStatus = orderStatusMap[tx.status] || null;
                const orderMeta = mappedOrderStatus ? ORDER_STATUS_META[mappedOrderStatus] : null;

                // Determine border color based on conditions
                let borderColor = orderMeta?.border || 'transparent';
                let borderWidth = orderMeta ? '0 0 0 3px' : '0';
                let borderStyle = orderMeta ? 'solid' : 'none';

                // Override with express/overdue borders if applicable
                if (hasExpress && overdue) {
                  borderColor = CARD_BORDER_COLORS.expressOverdue;
                  borderWidth = '0 0 0 4px';
                  borderStyle = 'solid';
                } else if (hasExpress) {
                  borderColor = CARD_BORDER_COLORS.express;
                  borderWidth = '0 0 0 4px';
                  borderStyle = 'solid';
                } else if (overdue) {
                  borderColor = CARD_BORDER_COLORS.overdue;
                  borderWidth = '0 0 0 4px';
                  borderStyle = 'solid';
                }

                const metaParts = [tx.date];
                if (tx.dueDate) {
                  const dueLabel = overdue ? `⚠️ ${tx.dueDate}` : `⏰ ${tx.dueDate}`;
                  metaParts.push(dueLabel);
                }
                if (prod) metaParts.push(`🧺 ${prod.productionStageLabel} (${prod.readyUnits}/${prod.totalUnits})`);

                return (
                  <AnimatedCard key={tx.id} delay={idx} index={idx}>
                    <div
                      className="glass-card"
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        borderLeft: borderWidth,
                        borderLeftColor: borderColor,
                        borderLeftStyle: borderStyle,
                        borderTop: 'none',
                        borderRight: 'none',
                        borderBottom: 'none',
                      }}
                      onClick={() => navigate('detail_transaksi', tx)}
                    >
                      {/* Decorative blob accent */}
                      <div style={{
                        position: 'absolute',
                        top: -20,
                        right: -20,
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        background: orderMeta
                          ? `radial-gradient(circle, ${orderMeta.color}15 0%, transparent 70%)`
                          : 'radial-gradient(circle, rgba(232,90,168,0.12) 0%, transparent 70%)',
                        pointerEvents: 'none',
                      }} />

                      {/* Avatar with webp */}
                      <TransactionAvatar transaction={tx} size={44} />

                      {/* Info */}
                      <div style={{ flex: 2, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 13,
                            fontWeight: 700,
                            color: 'var(--ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {tx.customerName}
                          </div>
                          {hasExpress && (
                            <span style={{
                              background: '#FEF3C7',
                              color: '#D97706',
                              fontFamily: 'Poppins',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 999,
                              border: '1px solid #F59E0B',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
                              Express
                            </span>
                          )}
                          {overdue && !hasExpress && (
                            <span style={{
                              background: '#FEE2E2',
                              color: '#DC2626',
                              fontFamily: 'Poppins',
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 999,
                              border: '1px solid #EF4444',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                            }}>
                              ⚠️ Terlambat
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--ink-soft)', marginTop: 1 }}>#{tx.id}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: 'var(--ink-soft)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {metaParts.map((m, i) => (
                            <span key={i}>{m}{i < metaParts.length - 1 ? ' • ' : ''}</span>
                          ))}
                        </div>
                      </div>

                      {/* Right side: value & status */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                          {rp(tx.total)}
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontFamily: 'Poppins',
                          fontSize: 9,
                          fontWeight: 600,
                          background: pay.bg,
                          color: pay.color,
                        }}>
                          {pay.label}
                        </span>
                        {canMarkReady && (
                          <button
                            onClick={(e) => markReady(e, tx)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 6,
                              border: 'none',
                              background: 'linear-gradient(135deg, #5FD9AE, #1F9E75)',
                              color: '#FFFFFF',
                              fontFamily: 'Poppins',
                              fontSize: 9,
                              fontWeight: 700,
                              cursor: isUpdating ? 'not-allowed' : 'pointer',
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            {isUpdating ? 'Memproses...' : '✓ Siap Ambil'}
                          </button>
                        )}
                      </div>
                    </div>
                  </AnimatedCard>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {hasMore && list.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', gap: 8 }}>
                {page > 1 && (
                  <button
                    onClick={() => {
                      pageRef.current = 1;
                      fetchTransactions(1, false);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 12,
                      border: '1.5px solid #e8e2ea',
                      background: 'white',
                      fontFamily: 'Poppins',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#5a5a5a',
                      cursor: 'pointer',
                    }}
                  >
                    « First
                  </button>
                )}
                {page > 1 && (
                  <button
                    onClick={() => {
                      fetchTransactions(pageRef.current - 1, false);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 12,
                      border: '1.5px solid #e8e2ea',
                      background: 'white',
                      fontFamily: 'Poppins',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#5a5a5a',
                      cursor: 'pointer',
                    }}
                  >
                    ‹ Prev
                  </button>
                )}
                <span style={{
                  padding: '8px 16px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #6B2D7E, #4A1A59)',
                  fontFamily: 'Poppins',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'white',
                }}>
                  Halaman {page}
                </span>
                <button
                  onClick={() => fetchTransactions(pageRef.current + 1, true)}
                  disabled={!hasMore || loadingMore}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 12,
                    border: 'none',
                    background: hasMore && !loadingMore ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)' : '#e8e2ea',
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    fontWeight: 600,
                    color: hasMore && !loadingMore ? 'white' : '#9a9a9a',
                    cursor: hasMore && !loadingMore ? 'pointer' : 'not-allowed',
                  }}
                >
                  {loadingMore ? 'Memuat...' : 'Next ›'}
                </button>
              </div>
            )}
          </>
        )}

        {loadingMore && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', color: 'var(--ink-soft)', fontFamily: 'Poppins', fontSize: 12 }}>
            Memuat data berikutnya...
          </div>
        )}

      </div>



      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)}>
        <div style={{ padding: '8px 0 16px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Filter & Urutan</div>
            <button onClick={() => setFilterOpen(false)}
              style={{
                width: 36, height: 36, borderRadius: 18, border: 'none',
                background: 'linear-gradient(135deg, #6B2D7E20, #4A1A5920)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#5B005F',
                boxShadow: '0 2px 8px rgba(91, 0, 95, 0.15)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Status */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>📋 Status Pesanan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  background: activeFilter === f.key
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: activeFilter === f.key ? '#FFFFFF' : '#7A6584',
                  boxShadow: activeFilter === f.key
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tanggal */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>📅 Periode Waktu</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodFilter(p.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  background: periodFilter === p.value
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: periodFilter === p.value ? '#FFFFFF' : '#7A6584',
                  boxShadow: periodFilter === p.value
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {p.label}
              </button>
            ))}

          </div>


          {/* Pembayaran */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>💰 Status Pembayaran</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {PAYMENT_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPaymentFilter(f.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  background: paymentFilter === f.value
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: paymentFilter === f.value ? '#FFFFFF' : '#7A6584',
                  boxShadow: paymentFilter === f.value
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Pengambilan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>📦 Status Pengambilan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {PICKUP_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPickupFilter(f.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  background: pickupFilter === f.value
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: pickupFilter === f.value ? '#FFFFFF' : '#7A6584',
                  boxShadow: pickupFilter === f.value
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tampilkan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>⚡ Tampilkan</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setOnlyExpress((v) => !v)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: onlyExpress ? '2px solid #F59E0B' : '1.5px solid #e8e2ea',
                cursor: 'pointer',
                fontFamily: 'Poppins',
                fontSize: 11,
                fontWeight: 600,
                background: onlyExpress
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'rgba(255, 255, 255, 0.7)',
                color: onlyExpress ? '#FFFFFF' : '#7A6584',
                boxShadow: onlyExpress
                  ? '0 4px 12px rgba(245, 158, 11, 0.35)'
                  : '0 2px 8px rgba(59, 11, 71, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
              Express Only
            </button>
          </div>

          {/* Sort options */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>🔄 Urutkan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  background: sortBy === s.value
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: sortBy === s.value ? '#FFFFFF' : '#7A6584',
                  boxShadow: sortBy === s.value
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>

            <button

              onClick={() => {

                setActiveFilter('semua');

                setPeriodFilter('all');

                setPaymentFilter('semua');

                setPickupFilter('semua');

                setOnlyExpress(false);

                setSortBy('newest');

              }}

              style={{

                flex: 1,

                height: 44,

                borderRadius: 12,

                border: '1.5px solid rgba(255, 255, 255, 0.6)',

                background: 'rgba(255, 255, 255, 0.7)',

                fontFamily: 'Poppins',

                fontSize: 13,

                fontWeight: 600,

                color: '#7A6584',

                cursor: 'pointer',

              }}

            >

              Reset

            </button>

            <button

              onClick={() => setFilterOpen(false)}

              style={{

                flex: 2,

                height: 44,

                borderRadius: 12,

                border: 'none',

                background: 'linear-gradient(135deg, #6B2D7E, #4A1A59)',

                fontFamily: 'Poppins',

                fontSize: 13,

                fontWeight: 600,

                color: 'white',

                cursor: 'pointer',

                boxShadow: '0 4px 12px rgba(59, 11, 71, 0.25)',

              }}

            >

              Terapkan Filter

            </button>

          </div>

        </div>

      </Modal>

    </div>

  );

}
