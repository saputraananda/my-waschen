import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import axios from 'axios';

import { C, SHADOW } from '../../utils/theme';

import { rp, txApiId } from '../../utils/helpers';

import { TopBar, SearchBar, Badge, Chip, Avatar, EmptyState, Modal, SkeletonList, useAppRefresh, ListCard, ListCardGroup } from '../../components/ui';

import { AnimatedCard } from '../../components/AnimatedListCard';

import { useDebounce, useResponsive, useWindowSize } from '../../utils/hooks';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useSavedFilter } from '../../utils/savedFilters';
import { useRealtimeMulti } from '../../utils/realtime';
import { getAvatarSource } from '../../utils/avatar';



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
  const customerData = useMemo(() => ({
    photo: transaction.customerPhoto,
    gender: transaction.customerGender,
    name: transaction.customerName,
  }), [transaction]);

  const avatarSrc = useMemo(() => getAvatarSource(customerData, 'customer'), [customerData]);
  const initials = transaction.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const getAvatarBg = (name) => {
    if (!name) return 'linear-gradient(145deg, #E9D3F2, #D4B8E3)';
    const first = name.charAt(0).toUpperCase();
    const ranges = [
      { chars: 'ABCDE', gradient: 'linear-gradient(145deg, #E9D3F2, #C77DCB)' },
      { chars: 'FGHIJ', gradient: 'linear-gradient(145deg, #C8E6FF, #7BA7D4)' },
      { chars: 'KLMNO', gradient: 'linear-gradient(145deg, #FFE0B2, #E4A87C)' },
      { chars: 'PQRST', gradient: 'linear-gradient(145deg, #C8F7C5, #7DC97D)' },
      { chars: 'UVWXYZ', gradient: 'linear-gradient(145deg, #FFD1DC, #E07A8F)' },
    ];
    const found = ranges.find(r => r.chars.includes(first));
    return found?.gradient || 'linear-gradient(145deg, #E9D3F2, #D4B8E3)';
  };

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
        position: 'relative',
        padding: 0,
      }}
    >
      {transaction.customerPhoto ? (
        <img
          src={transaction.customerPhoto}
          alt={transaction.customerName || 'avatar'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 18,
          }}
        />
      ) : (
        <>
          <img
            src={avatarSrc}
            alt={transaction.customerName || 'avatar'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 18,
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div
            style={{
              display: 'none',
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: getAvatarBg(transaction.customerName),
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Poppins',
              fontSize: size * 0.35,
              fontWeight: 700,
              color: '#3B0B47',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            {initials}
          </div>
        </>
      )}
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

// Pickup / pengambilan filters
const PICKUP_FILTERS = [
  { value: 'semua', label: 'Semua' },
  { value: 'belum_diambil', label: 'Belum Diambil' },
  { value: 'sudah_diambil', label: 'Sudah Diambil' },
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

  { value: '7d', label: '7 Hari' },

  { value: '30d', label: '30 Hari' },

];

const SORTS = [

  { value: 'newest', label: 'Terbaru' },

  { value: 'deadline', label: 'Deadline terdekat' },

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

        sort: sortBy,

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

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', overflow: 'hidden' }}>

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

        style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>


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
                flex: 1,
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', flex: 1 }}>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    padding: '6px 14px',
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

            <button
              onClick={() => setFilterOpen(true)}
              aria-label="Filter"
              className="clay-avatar"
              style={{
                padding: '8px 10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--purple-mid)',
                position: 'relative',
                height: 40,
                flexShrink: 0,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
              {activeFilterCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0,
                  width: 18, height: 18, borderRadius: 9,
                  background: 'var(--coral)', color: '#FFF',
                  fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 80 }}>
            {list.map((tx, idx) => {
              const pay = payBadgeStyle(tx.paymentStatus);
              const prod = tx.production;
              const prodWarn = prod && prod.notReadyUnits > 0;
              const siapMismatch = tx.status === 'selesai' && prod && !prod.allProductionReady;
              const canMarkReady = (tx.status === 'proses' || tx.status === 'baru') && prod?.canMarkReadyForPickup;
              const isUpdating = updating === tx.id;

              // Detect if transaction has express items
              const hasExpress = tx.items?.some((i) => i.express);

              const mappedOrderStatus = orderStatusMap[tx.status] || null;
              const orderMeta = mappedOrderStatus ? ORDER_STATUS_META[mappedOrderStatus] : null;

              const metaParts = [tx.date];
              if (tx.dueDate) metaParts.push(`⏰ ${tx.dueDate}`);
              if (prod) metaParts.push(`🧺 ${prod.productionStageLabel} (${prod.readyUnits}/${prod.totalUnits})`);

              return (
                <AnimatedCard key={tx.id} delay={idx} index={idx}>
                  <div
                    className="glass-card"
                    style={{
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'hidden',
                      borderLeft: orderMeta ? `4px solid ${orderMeta.border}` : 'none',
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
                    <TransactionAvatar transaction={tx} size={52} />

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{
                          fontFamily: 'Poppins',
                          fontSize: 15,
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
                            padding: '2px 8px',
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
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>#{tx.id}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--ink-soft)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        {metaParts.map((m, i) => (
                          <span key={i}>{m}{i < metaParts.length - 1 ? ' • ' : ''}</span>
                        ))}
                      </div>
                    </div>

                    {/* Right side: value & status */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                        {rp(tx.total)}
                      </div>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontFamily: 'Poppins',
                        fontSize: 10,
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
                            padding: '4px 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(135deg, #5FD9AE, #1F9E75)',
                            color: '#FFFFFF',
                            fontFamily: 'Poppins',
                            fontSize: 10,
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
        )}

        {loadingMore && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', color: 'var(--ink-soft)', fontFamily: 'Poppins', fontSize: 12 }}>
            Memuat data berikutnya...
          </div>
        )}

      </div>



      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter & Pencarian Lanjutan">

        <div style={{ padding: '16px 18px' }}>

          {/* Tanggal */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>📅 Periode Waktu</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>

            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodFilter(p.value)}
                style={{
                  padding: '6px 14px',
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

          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 'max-content' }}>
              {PAYMENT_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setPaymentFilter(f.value)}
                  style={{
                    padding: '6px 14px',
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
          </div>


          {/* Pengambilan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>📦 Status Pengambilan</div>

          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 'max-content' }}>
              {PICKUP_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setPickupFilter(f.value)}
                  style={{
                    padding: '6px 14px',
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
          </div>


          {/* Layanan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>⚡ Layanan</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              onClick={() => setOnlyExpress((v) => !v)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'Poppins',
                fontSize: 11,
                fontWeight: 600,
                background: onlyExpress
                  ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                  : 'rgba(255, 255, 255, 0.7)',
                color: onlyExpress ? '#FFFFFF' : '#7A6584',
                boxShadow: onlyExpress
                  ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                  : '0 2px 8px rgba(59, 11, 71, 0.08)',
              }}
            >
              Express
            </button>
          </div>



          {/* Sort options */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>🔄 Urutkan</div>
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 'max-content' }}>
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSortBy(s.value)}
                  style={{
                    padding: '6px 14px',
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
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>

            <button

              onClick={() => {

                setPeriodFilter('all');

                setPaymentFilter('semua');

                setPickupFilter('semua');

                setOnlyExpress(false);

                setSortBy('newest');

              }}

              style={{

                flex: 1,

                height: 38,

                borderRadius: 10,

                border: '1.5px solid rgba(255, 255, 255, 0.6)',

                background: 'rgba(255, 255, 255, 0.7)',

                fontFamily: 'Poppins',

                fontSize: 12,

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

                flex: 1,

                height: 38,

                borderRadius: 10,

                border: 'none',

                background: 'linear-gradient(135deg, #6B2D7E, #4A1A59)',

                fontFamily: 'Poppins',

                fontSize: 12,

                fontWeight: 600,

                color: 'white',

                cursor: 'pointer',

                boxShadow: '0 4px 12px rgba(59, 11, 71, 0.25)',

              }}

            >

              Terapkan

            </button>

          </div>

        </div>

      </Modal>

    </div>

  );

}
