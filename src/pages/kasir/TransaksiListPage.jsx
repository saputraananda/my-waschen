import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import axios from 'axios';

import { C, SHADOW } from '../../utils/theme';

import { rp, txApiId } from '../../utils/helpers';

import { TopBar, SearchBar, Badge, Chip, Avatar, EmptyState, Modal, SkeletonList, useAppRefresh } from '../../components/ui';

import { useDebounce } from '../../utils/hooks';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';
import { useSavedFilter } from '../../utils/savedFilters';
import { useRealtimeMulti } from '../../utils/realtime';



const PAGE_SIZE = 30;

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
  { value: 'lunas', label: '✅ Lunas' },
  { value: 'belum_lunas', label: '⏳ Belum Lunas' },
  { value: 'partial', label: '💳 DP/Sebagian' },
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
  if (status === 'paid') return { bg: C.successBg, color: C.success, label: 'Lunas' };
  if (status === 'partial') return { bg: C.warningBg, color: C.warning, label: 'DP/Sebagian' };
  return { bg: C.dangerBg, color: C.danger, label: 'Belum Lunas' };
};



export default function TransaksiListPage({ navigate, historyOnly, screenParams }) {

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

      console.error('Failed to fetch transactions:', error);

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



  return (

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>

      <TopBar title={title} subtitle={`${historyOnly ? list.length : totalCount} total`} />



      <div

        ref={scrollRef}

        onScroll={(e) => {

          const el = e.currentTarget;

          if (loading || loadingMore || !hasMore) return;

          if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {

            fetchTransactions(pageRef.current + 1, true);

          }

        }}

        style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}

      >

        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: C.n50, paddingBottom: 8 }}>

          <SearchBar value={query} onChange={setQuery} placeholder="Cari nama, no nota, atau telepon..." />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>

            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', flex: 1 }}>

              {STATUS_FILTERS.map((f) => (

                <Chip key={f.key} label={f.label} active={activeFilter === f.key} onClick={() => setActiveFilter(f.key)} />

              ))}

            </div>

            <button
              onClick={() => setFilterOpen(true)}
              aria-label="Filter"
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.primary,
                position: 'relative',
              }}
            >
              {/* Sliders icon (filter system) */}
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
                  position: 'absolute', top: 2, right: 2,
                  width: 16, height: 16, borderRadius: 8,
                  background: C.primary, color: 'white',
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{activeFilterCount}</span>
              )}
            </button>

          </div>
        </div>


        {/* Alerts dari produksi — dipindah dari halaman Antrian lama */}
        {!loading && (alerts.prodIncomplete.length > 0 || alerts.siapPrematur.length > 0 || alerts.siapTanpaFoto.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {alerts.prodIncomplete.length > 0 && (
              <div style={{ background: C.warningBg, border: `1px solid ${C.warning}`, borderRadius: 12, padding: '10px 12px', fontFamily: 'Poppins', fontSize: 11, color: C.warning }}>
                <strong>⚠️ {alerts.prodIncomplete.length} order</strong> masih diproses di produksi (belum selesai cuci/setrika/packing). Jangan tandai siap diambil sebelum produksi selesai.
              </div>
            )}
            {alerts.siapPrematur.length > 0 && (
              <div style={{ background: C.dangerBg, border: '1px solid C.danger', borderRadius: 12, padding: '10px 12px', fontFamily: 'Poppins', fontSize: 11, color: C.danger }}>
                <strong>🚨 {alerts.siapPrematur.length} order</strong> berstatus siap diambil tetapi produksi belum rampung. Koordinasikan dengan tim produksi.
              </div>
            )}
            {alerts.siapTanpaFoto.length > 0 && (
              <div style={{ background: C.infoBg, border: '1px solid C.info', borderRadius: 12, padding: '10px 12px', fontFamily: 'Poppins', fontSize: 11, color: C.info }}>
                <strong>📷 {alerts.siapTanpaFoto.length} order</strong> belum ada foto packing di produksi. Wajib dokumentasi sebelum diserahkan ke customer.
              </div>
            )}
          </div>
        )}

        {loading ? (

          <SkeletonList count={5} lines={3} />

        ) : list.length === 0 ? (

          <EmptyState title="Tidak ada transaksi" subtitle="Belum ada transaksi yang sesuai filter" />

        ) : (

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {list.map((tx) => {
              const pay = payBadgeStyle(tx.paymentStatus);
              const prod = tx.production;
              const prodWarn = prod && prod.notReadyUnits > 0;
              const siapMismatch = tx.status === 'selesai' && prod && !prod.allProductionReady;
              const canMarkReady = (tx.status === 'proses' || tx.status === 'baru') && prod?.canMarkReadyForPickup;
              const isUpdating = updating === tx.id;
              return (

              <div

                key={tx.id}

                onClick={() => navigate('detail_transaksi', tx)}

                style={{
                  background: C.white, borderRadius: 14, padding: '12px 14px',
                  boxShadow: SHADOW.sm, cursor: 'pointer',
                  border: siapMismatch ? `2px solid ${C.danger}` : prodWarn ? `1.5px solid ${C.warning}` : '1px solid transparent',
                }}

              >

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>

                  <Avatar initials={tx.customerName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={40} />

                  <div style={{ flex: 1 }}>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>

                      <Badge status={tx.status} small />

                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>

                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{tx.id}</span>

                      {tx.items?.some((i) => i.express) && (

                        <span style={{ background: C.warningBg, color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>⚡ Express</span>

                      )}

                      {/* Payment status badge */}
                      <span style={{
                        background: pay.bg,
                        color: pay.color,
                        fontFamily: 'Poppins',
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 999,
                      }}>
                        {pay.label}
                      </span>

                      {/* Pickup status badge */}
                      {tx.status === 'selesai' && (
                        <span style={{
                          background: C.infoBg,
                          color: C.info,
                          fontFamily: 'Poppins',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 999,
                        }}>
                          📦 Belum Diambil
                        </span>
                      )}
                      {tx.status === 'diambil' && (
                        <span style={{
                          background: C.successBg,
                          color: C.success,
                          fontFamily: 'Poppins',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 999,
                        }}>
                          ✅ Sudah Diambil
                        </span>
                      )}

                      {/* Produksi stage badge — muncul kalau ada data produksi */}
                      {prod && (tx.status === 'baru' || tx.status === 'proses' || siapMismatch) && (
                        <span style={{
                          fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                          color: prodWarn ? C.warning : C.info,
                          background: prodWarn ? C.warningBg : C.infoBg,
                          padding: '1px 6px', borderRadius: 999,
                        }}>
                          🧺 {prod.productionStageLabel} ({prod.readyUnits}/{prod.totalUnits})
                        </span>
                      )}

                    </div>

                    {/* Warning text inline */}
                    {siapMismatch && (
                      <div style={{ marginTop: 4, fontFamily: 'Poppins', fontSize: 10, color: C.danger, fontWeight: 600 }}>
                        ⚠️ Belum boleh diambil — produksi masih {prod.productionStageLabel}
                      </div>
                    )}
                    {prod?.allProductionReady && !prod?.hasPackingPhoto && tx.status === 'selesai' && (
                      <div style={{ marginTop: 4, fontFamily: 'Poppins', fontSize: 10, color: C.info }}>
                        📷 Menunggu foto packing dari produksi
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>

                      <div style={{ display: 'flex', gap: 10 }}>

                        <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>📅 {tx.date}</span>

                        {tx.dueDate && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>⏰ {tx.dueDate}</span>}

                      </div>

                      <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp(tx.total)}</span>

                    </div>

                  </div>

                </div>

              {/* Quick action: Tandai Siap Ambil */}
              {canMarkReady && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.n100}` }}>
                  <button
                    onClick={(e) => markReady(e, tx)}
                    disabled={isUpdating}
                    style={{
                      flex: 1, height: 34, borderRadius: 8, border: 'none',
                      background: isUpdating ? C.n200 : C.success,
                      fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                      color: 'white', cursor: isUpdating ? 'default' : 'pointer',
                    }}
                  >
                    {isUpdating ? 'Memproses…' : '✓ Tandai Siap Ambil'}
                  </button>
                </div>
              )}

              </div>

              );
            })}

          </div>

        )}



        {loadingMore && (

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', color: C.n600, fontFamily: 'Poppins', fontSize: 12 }}>

            Memuat data berikutnya...

          </div>

        )}

      </div>



      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter & Pencarian Lanjutan">

        <div style={{ padding: '16px 18px' }}>

          {/* Tanggal */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>📅 Periode Waktu</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>

            {PERIODS.map((p) => (

              <Chip key={p.value} label={p.label} active={periodFilter === p.value} onClick={() => setPeriodFilter(p.value)} />

            ))}

          </div>


          {/* Pembayaran */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>💰 Status Pembayaran</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {PAYMENT_FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} active={paymentFilter === f.value} onClick={() => setPaymentFilter(f.value)} />
            ))}
          </div>


          {/* Pengambilan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>📦 Status Pengambilan</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {PICKUP_FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} active={pickupFilter === f.value} onClick={() => setPickupFilter(f.value)} />
            ))}
          </div>


          {/* Layanan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>⚡ Layanan</div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>

            <Chip label="Express" active={onlyExpress} onClick={() => setOnlyExpress((v) => !v)} />

          </div>



          {/* Urutkan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>🔄 Urutkan</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

            {SORTS.map((s) => (

              <Chip key={s.value} label={s.label} active={sortBy === s.value} onClick={() => setSortBy(s.value)} />

            ))}

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

                border: `1.5px solid ${C.n200}`,

                background: C.n50,

                fontFamily: 'Poppins',

                fontSize: 12,

                fontWeight: 600,

                color: C.n600,

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

                background: C.primary,

                fontFamily: 'Poppins',

                fontSize: 12,

                fontWeight: 600,

                color: 'white',

                cursor: 'pointer',

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

