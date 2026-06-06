// ─────────────────────────────────────────────────────────────────────────────
// StokBahanPage — stok inventaris + status pengajuan barang per outlet
// Satu halaman untuk kasir/frontline:
//   Tab Stok: item, level stok, badge pengajuan aktif per barang
//   Tab Pengajuan: riwayat & status pengadaan outlet (data dari admin)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Chip, useAppRefresh, SearchFilterRow, SkeletonList } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

const STOCK_STATUS = {
  safe:     { label: 'Aman',      color: '#10B981', bg: '#DCFCE7' },
  low:      { label: 'Rendah',    color: '#F59E0B', bg: '#FEF3C7' },
  empty:    { label: 'Habis',     color: '#DC2626', bg: '#FEE2E2' },
  untracked:{ label: 'N/A',       color: '#6B7280', bg: '#F3F4F6' },
};

const URGENCY_META = {
  normal:   { label: 'Normal',   bg: '#DBEAFE', fg: '#1E40AF', color: '#3B82F6', icon: '📋' },
  urgent:   { label: 'Urgent',   bg: '#FEF3C7', fg: '#92400E', color: '#F59E0B', icon: '⚠️' },
  critical: { label: 'Kritis',   bg: '#FEE2E2', fg: '#991B1B', color: '#DC2626', icon: '🚨' },
};

const STATUS_META = {
  pending:   { label: 'Menunggu Admin', bg: '#FEF3C7', fg: '#92400E', icon: '⏳' },
  revised:   { label: 'Perlu Diperbaiki', bg: '#FED7AA', fg: '#9A3412', icon: '↩️' },
  approved:  { label: 'Disetujui', bg: '#DBEAFE', fg: '#1E40AF', icon: '✅' },
  fulfilled: { label: 'Sudah Dibeli', bg: '#DCFCE7', fg: '#15803D', icon: '🎉' },
  rejected:  { label: 'Ditolak', bg: '#FEE2E2', fg: '#991B1B', icon: '❌' },
  cancelled: { label: 'Dibatalkan', bg: '#F3F4F6', fg: '#6B7280', icon: '⊘' },
};

const STATUS_HELP = {
  pending: 'Pengajuan sudah terkirim. Tunggu admin menyetujui atau memberi catatan.',
  revised: 'Admin minta perbaikan. Edit lalu kirim ulang supaya diproses lagi.',
  approved: 'Sudah disetujui admin. Menunggu pembelian & pengiriman ke outlet Anda.',
  fulfilled: 'Barang sudah dibeli. Stok outlet otomatis bertambah jika dari katalog.',
  rejected: 'Pengajuan ditolak admin. Lihat catatan di bawah untuk alasan.',
  cancelled: 'Pengajuan ini dibatalkan.',
};

const ACTIVE_STATUSES = ['pending', 'revised', 'approved'];

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

const PAGE_TABS = [
  { key: 'stok', label: 'Stok Saya', icon: '📦' },
  { key: 'pengajuan', label: 'Pengajuan Saya', icon: '📋' },
];

const STOCK_LEVEL_FILTERS = [
  { key: 'all', label: 'Semua Stok', icon: '📋' },
  { key: 'low', label: 'Stok Rendah', icon: '⚠️' },
  { key: 'empty', label: 'Stok Habis', icon: '🔴' },
];

const REQ_STATUS_FILTERS = [
  { key: 'aktif', label: 'Sedang Berjalan', icon: '🔄' },
  { key: 'action', label: 'Perlu Tindakan', icon: '✏️' },
  { key: 'waiting', label: 'Menunggu Admin', icon: '⏳' },
  { key: 'approved', label: 'Disetujui', icon: '✅' },
  { key: 'done', label: 'Sudah Selesai', icon: '🎉' },
  { key: 'all', label: 'Semua', icon: '📋' },
];

export default function StokBahanPage({ goBack, navigate, screenParams }) {
  const { user } = useApp();
  const [pageTab, setPageTab] = useState(screenParams?.tab === 'pengajuan' ? 'pengajuan' : 'stok');
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reqLoading, setReqLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [reqError, setReqError] = useState(null);
  const [stockTab, setStockTab] = useState('all');
  const [search, setSearch] = useState('');
  const [reqSearch, setReqSearch] = useState('');
  const [reqFilter, setReqFilter] = useState('aktif');
  const [reqUrgencyFilter, setReqUrgencyFilter] = useState('all');
  const [showStockFilterModal, setShowStockFilterModal] = useState(false);
  const [showReqFilterModal, setShowReqFilterModal] = useState(false);
  const [adjustModal, setAdjustModal] = useState(null);
  const [qtyStr, setQtyStr] = useState('');
  const [noteStr, setNoteStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestItem, setRequestItem] = useState(null);
  const [editRequest, setEditRequest] = useState(null);
  const [highlightRequestId, setHighlightRequestId] = useState(screenParams?.highlightRequestId || null);

  const outletId = user?.outletId;

  const loadStock = useCallback(async (fresh = false) => {
    if (!outletId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setFetchError(null);
    try {
      const config = fresh ? { params: { _t: Date.now() } } : {};
      const res = await axios.get(`/api/inventory/stock?outletId=${outletId}`, config);
      setRows(res?.data?.data || []);
    } catch (err) {
      setFetchError(err?.response?.data?.message || 'Gagal memuat stok.');
      console.error('[StokBahan loadStock]', err);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  const loadRequests = useCallback(async (fresh = false) => {
    if (!outletId) { setRequests([]); setReqLoading(false); return; }
    setReqLoading(true);
    setReqError(null);
    try {
      const params = { page: 1, limit: 100 };
      if (fresh) params._t = Date.now();
      const res = await axios.get('/api/purchase-requests', { params });
      setRequests(res?.data?.data || []);
    } catch (err) {
      setReqError(err?.response?.data?.message || 'Gagal memuat pengajuan.');
      console.error('[StokBahan loadRequests]', err);
    } finally {
      setReqLoading(false);
    }
  }, [outletId]);

  const refreshAll = useCallback(async (fresh = false) => {
    await Promise.all([loadStock(fresh), loadRequests(fresh)]);
  }, [loadStock, loadRequests]);

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useAppRefresh(() => refreshAll(true), [refreshAll]);

  useEffect(() => {
    if (screenParams?.tab === 'pengajuan') setPageTab('pengajuan');
    if (screenParams?.highlightRequestId) setHighlightRequestId(screenParams.highlightRequestId);
  }, [screenParams?.tab, screenParams?.highlightRequestId]);

  useEffect(() => {
    if (!highlightRequestId) return;
    const t = setTimeout(() => setHighlightRequestId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightRequestId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const lowCount = rows.filter(r => r.stockQty <= r.minStock && r.stockQty > 0).length;
    const emptyCount = rows.filter(r => r.stockQty === 0).length;
    const criticalCount = rows.filter(r => r.lowStock).length;
    return { total, lowCount, emptyCount, criticalCount };
  }, [rows]);

  const reqStats = useMemo(() => ({
    aktif: requests.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
    action: requests.filter(r => r.status === 'revised').length,
    waiting: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    done: requests.filter(r => r.status === 'fulfilled').length,
    total: requests.length,
  }), [requests]);

  const requestByInventoryId = useMemo(() => {
    const map = new Map();
    const priority = { revised: 0, pending: 1, approved: 2 };
    for (const r of requests) {
      if (!r.inventoryId || !ACTIVE_STATUSES.includes(r.status)) continue;
      const prev = map.get(r.inventoryId);
      if (!prev || (priority[r.status] ?? 9) < (priority[prev.status] ?? 9)) {
        map.set(r.inventoryId, r);
      }
    }
    return map;
  }, [requests]);

  const filtered = useMemo(() => {
    let result = rows;
    if (stockTab === 'low') result = result.filter(r => r.stockQty <= r.minStock && r.stockQty > 0);
    if (stockTab === 'empty') result = result.filter(r => r.stockQty === 0);

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.itemCode || '').toLowerCase().includes(q) ||
        (r.categoryName || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, stockTab, search]);

  const filteredRequests = useMemo(() => {
    let result = requests;
    if (reqFilter === 'aktif') result = result.filter(r => ACTIVE_STATUSES.includes(r.status));
    else if (reqFilter === 'action') result = result.filter(r => r.status === 'revised');
    else if (reqFilter === 'waiting') result = result.filter(r => r.status === 'pending');
    else if (reqFilter === 'approved') result = result.filter(r => r.status === 'approved');
    else     if (reqFilter === 'done') result = result.filter(r => r.status === 'fulfilled');
    if (reqUrgencyFilter !== 'all') result = result.filter(r => r.urgency === reqUrgencyFilter);

    const q = reqSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(r =>
        (r.itemName || '').toLowerCase().includes(q) ||
        (r.brand || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [requests, reqFilter, reqUrgencyFilter, reqSearch]);

  const stockActiveFilterCount = stockTab !== 'all' ? 1 : 0;
  const reqActiveFilterCount =
    (reqFilter !== 'aktif' ? 1 : 0)
    + (reqUrgencyFilter !== 'all' ? 1 : 0);

  const stockFilterLabel = STOCK_LEVEL_FILTERS.find(f => f.key === stockTab)?.label || stockTab;
  const reqFilterLabel = REQ_STATUS_FILTERS.find(f => f.key === reqFilter)?.label || reqFilter;
  const reqUrgencyLabel = URGENCY_META[reqUrgencyFilter]?.label;

  const submitAdjust = async () => {
    if (!adjustModal || !outletId) return;
    const q = Number(qtyStr);
    if (!Number.isFinite(q) || q === 0) { alertWarning('Perubahan qty tidak valid.'); return; }
    setSaving(true);
    try {
      await axios.post('/api/inventory/adjust', {
        inventoryId: adjustModal.id,
        outletId,
        qtyDelta: q,
        notes: noteStr || null,
      });
      setAdjustModal(null);
      setQtyStr('');
      setNoteStr('');
      await refreshAll(true);
      alertSuccess('Stok berhasil disesuaikan.');
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRequest = (item) => {
    setRequestItem(item);
    setShowRequestForm(true);
  };

  const handleViewRequest = (request) => {
    setPageTab('pengajuan');
    setReqFilter(request.status === 'revised' ? 'action' : 'aktif');
    setHighlightRequestId(request.id);
  };

  const closeRequestForm = () => {
    setShowRequestForm(false);
    setRequestItem(null);
  };

  const subtitle = pageTab === 'stok'
    ? `${stats.total} item · ${stats.lowCount} rendah · ${stats.emptyCount} habis`
    : `${reqStats.aktif} berjalan · ${reqStats.action} perlu tindakan`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Stok & Pengadaan"
        subtitle={subtitle}
        onBack={goBack}
      />

      {/* Main tab: Stok vs Pengajuan */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 16px 0',
        background: C.n50, borderBottom: `1px solid ${C.n200}`,
      }}>
        {PAGE_TABS.map(t => {
          const isActive = pageTab === t.key;
          const badge = t.key === 'pengajuan' && reqStats.action > 0
            ? reqStats.action
            : t.key === 'pengajuan' && reqStats.aktif > 0
              ? null
              : null;
          const showDot = t.key === 'pengajuan' && reqStats.action > 0;
          return (
            <button
              key={t.key}
              onClick={() => setPageTab(t.key)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: '12px 12px 0 0',
                border: `1.5px solid ${isActive ? C.primary : 'transparent'}`,
                borderBottom: isActive ? `2px solid ${C.n50}` : '1.5px solid transparent',
                background: isActive ? C.white : 'transparent',
                fontFamily: 'Poppins', fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? C.primary : C.n600,
                cursor: 'pointer', position: 'relative',
                marginBottom: -1,
              }}
            >
              {t.icon} {t.label}
              {showDot && (
                <span style={{
                  position: 'absolute', top: 6, right: 8,
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: '#F59E0B', color: 'white',
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {pageTab === 'stok' ? (
          <>
            {stats.criticalCount > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #DC2626, #991B1B)',
                borderRadius: 14, padding: '12px 14px', marginBottom: 10,
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(220,38,38,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>🚨</span>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 800 }}>{stats.criticalCount} item kritis</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, opacity: 0.85 }}>Stok di bawah minimum — ajukan pengadaan!</div>
                  </div>
                </div>
                <button
                  onClick={() => setPageTab('pengajuan')}
                  style={{
                    background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.5)',
                    borderRadius: 10, padding: '8px 14px',
                    color: 'white', fontFamily: 'Poppins', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Lihat Pengajuan
                </button>
              </div>
            )}

            {reqStats.aktif > 0 && (
              <div style={{
                background: '#EFF6FF', border: '1px solid #BFDBFE',
                borderRadius: 12, padding: '10px 12px', marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#1E40AF', lineHeight: 1.4 }}>
                  📋 <strong>{reqStats.aktif} pengajuan sedang berjalan</strong>
                  {reqStats.action > 0 && <> · <strong style={{ color: '#9A3412' }}>{reqStats.action} perlu diperbaiki</strong></>}
                </div>
                <button
                  onClick={() => setPageTab('pengajuan')}
                  style={{
                    flexShrink: 0, padding: '6px 12px', borderRadius: 8,
                    border: 'none', background: C.primary, color: 'white',
                    fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Cek Status →
                </button>
              </div>
            )}

            {stockActiveFilterCount > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
                padding: '8px 10px', borderRadius: 10,
                background: `${C.primary}08`, border: `1px solid ${C.primary}22`,
              }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                  {STOCK_LEVEL_FILTERS.find(f => f.key === stockTab)?.icon} {stockFilterLabel}
                </span>
              </div>
            )}

            <SearchFilterRow
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Cari nama item, kode, kategori..."
              onFilterClick={() => setShowStockFilterModal(true)}
              activeFilterCount={stockActiveFilterCount}
            />

            {loading && <SkeletonList count={4} height={90} />}

            {!loading && fetchError && (
              <ErrorPanel message={fetchError} onRetry={() => loadStock(true)} />
            )}

            {!loading && !fetchError && filtered.length === 0 && (
              <EmptyState icon="📦" text={search ? 'Tidak ada item sesuai pencarian.' : 'Belum ada data stok.'} />
            )}

            {!loading && !fetchError && filtered.map(r => (
              <StockCard
                key={r.id}
                item={r}
                activeRequest={requestByInventoryId.get(r.id)}
                onAdjust={() => { setAdjustModal(r); setQtyStr(''); setNoteStr(''); }}
                onQuickRequest={() => handleQuickRequest(r)}
                onViewRequest={handleViewRequest}
              />
            ))}
          </>
        ) : (
          <>
            {/* Pengajuan summary */}
            <div style={{
              background: reqStats.action > 0
                ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
                : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
              borderRadius: 16, padding: '14px 16px', marginBottom: 12,
              color: 'white', boxShadow: '0 4px 12px rgba(249,115,22,0.18)',
            }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, opacity: 0.9 }}>
                📋 STATUS PENGADAAN OUTLET ANDA
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                <MiniStat value={reqStats.waiting} label="Menunggu" />
                <MiniStat value={reqStats.action} label="Perlu Perbaiki" highlight={reqStats.action > 0} />
                <MiniStat value={reqStats.approved} label="Disetujui" />
                <MiniStat value={reqStats.done} label="Sudah Dibeli" />
              </div>
            </div>

            <button
              onClick={() => navigate?.('pengadaan_barang')}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                border: 'none', background: C.primary, color: 'white',
                fontFamily: 'Poppins', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', marginBottom: 12,
                boxShadow: '0 4px 12px rgba(91,0,95,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <span style={{ fontSize: 16 }}>+</span> Ajukan Barang Baru
            </button>

            {reqActiveFilterCount > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
                padding: '8px 10px', borderRadius: 10,
                background: `${C.primary}08`, border: `1px solid ${C.primary}22`,
              }}>
                {reqFilter !== 'aktif' && (
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                    📌 {reqFilterLabel}
                  </span>
                )}
                {reqUrgencyFilter !== 'all' && (
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                    {URGENCY_META[reqUrgencyFilter]?.icon} {reqUrgencyLabel}
                  </span>
                )}
              </div>
            )}

            <SearchFilterRow
              searchValue={reqSearch}
              onSearchChange={setReqSearch}
              searchPlaceholder="Cari nama barang, merek, alasan..."
              onFilterClick={() => setShowReqFilterModal(true)}
              activeFilterCount={reqActiveFilterCount}
            />

            {reqLoading && <SkeletonList count={3} height={120} />}

            {!reqLoading && reqError && (
              <ErrorPanel message={reqError} onRetry={() => loadRequests(true)} />
            )}

            {!reqLoading && !reqError && filteredRequests.length === 0 && (
              <EmptyState
                icon="📋"
                text={reqSearch || reqActiveFilterCount > 0
                  ? 'Tidak ada pengajuan sesuai filter.'
                  : 'Belum ada pengajuan barang. Ketuk tombol di atas untuk mengajukan.'}
              />
            )}

            {!reqLoading && !reqError && filteredRequests.map(it => (
              <PengajuanCard
                key={it.id}
                item={it}
                highlighted={highlightRequestId === it.id}
                onEdit={() => setEditRequest(it)}
              />
            ))}
          </>
        )}
      </div>

      <Modal visible={!!adjustModal} onClose={() => setAdjustModal(null)} title={adjustModal ? `Stok: ${adjustModal.name}` : ''}>
        <div style={{ padding: '8px 18px 18px' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 12 }}>
            Stok sekarang: <strong>{adjustModal ? Number(adjustModal.stockQty).toLocaleString('id-ID') : ''}</strong> {adjustModal?.unit}.
            Masukkan perubahan (positif = tambah, negatif = kurang).
          </div>
          <Input
            label="Perubahan qty"
            value={qtyStr}
            onChange={(v) => setQtyStr(v.replace(/[^\d.-]/g, ''))}
            placeholder="Contoh: 5 atau -2"
            inputMode="decimal"
          />
          <Input label="Catatan (opsional)" value={noteStr} onChange={setNoteStr} placeholder="Mis. Penyesuaian stok gudang" />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Btn variant="secondary" style={{ flex: 1 }} onClick={() => setAdjustModal(null)}>Batal</Btn>
            <Btn variant="primary" style={{ flex: 1 }} loading={saving} onClick={submitAdjust}>Simpan</Btn>
          </div>
        </div>
      </Modal>

      {showRequestForm && requestItem && (
        <QuickRequestModal
          item={requestItem}
          onClose={closeRequestForm}
          onSuccess={() => {
            closeRequestForm();
            refreshAll(true);
            setPageTab('pengajuan');
            setReqFilter('aktif');
          }}
        />
      )}

      {editRequest && (
        <ResubmitModal
          request={editRequest}
          onClose={() => setEditRequest(null)}
          onSuccess={() => {
            setEditRequest(null);
            refreshAll(true);
          }}
        />
      )}

      {showStockFilterModal && (
        <Modal visible onClose={() => setShowStockFilterModal(false)} title="Filter Stok">
          <div style={{ padding: '8px 18px 18px' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
              📦 Level Stok
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {STOCK_LEVEL_FILTERS.map(f => (
                <Chip
                  key={f.key}
                  label={`${f.icon} ${f.label}${f.key === 'low' && stats.lowCount ? ` (${stats.lowCount})` : ''}${f.key === 'empty' && stats.emptyCount ? ` (${stats.emptyCount})` : ''}${f.key === 'all' ? ` (${stats.total})` : ''}`}
                  active={stockTab === f.key}
                  onClick={() => setStockTab(f.key)}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn variant="secondary" onClick={() => setStockTab('all')} style={{ flex: 1 }}>Reset</Btn>
              <Btn variant="primary" onClick={() => setShowStockFilterModal(false)} style={{ flex: 1 }}>Terapkan</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showReqFilterModal && (
        <Modal visible onClose={() => setShowReqFilterModal(false)} title="Filter Pengajuan">
          <div style={{ padding: '8px 18px 18px' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
              📌 Status Pengajuan
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {REQ_STATUS_FILTERS.map(f => (
                <Chip
                  key={f.key}
                  label={`${f.icon} ${f.label}`}
                  active={reqFilter === f.key}
                  onClick={() => setReqFilter(f.key)}
                />
              ))}
            </div>

            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
              🚨 Tingkat Urgensi
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <Chip label="Semua Urgensi" active={reqUrgencyFilter === 'all'} onClick={() => setReqUrgencyFilter('all')} />
              {Object.entries(URGENCY_META).map(([k, m]) => (
                <Chip
                  key={k}
                  label={`${m.icon} ${m.label}`}
                  active={reqUrgencyFilter === k}
                  onClick={() => setReqUrgencyFilter(k)}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn
                variant="secondary"
                onClick={() => { setReqFilter('aktif'); setReqUrgencyFilter('all'); }}
                style={{ flex: 1 }}
              >
                Reset
              </Btn>
              <Btn variant="primary" onClick={() => setShowReqFilterModal(false)} style={{ flex: 1 }}>Terapkan</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MiniStat({ value, label, highlight }) {
  return (
    <div style={{
      flex: '1 1 70px', background: highlight ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)',
      borderRadius: 10, padding: '8px 10px',
      border: highlight ? '1.5px solid rgba(255,255,255,0.5)' : 'none',
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800 }}>{value}</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.9 }}>{label}</div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, background: '#FEF2F2', borderRadius: 12, border: '1px solid #FECACA' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#991B1B', marginBottom: 12 }}>{message}</div>
      <button onClick={onRetry} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: C.primary, color: 'white', fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Coba Lagi</button>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>{text}</div>
    </div>
  );
}

function StockCard({ item: r, activeRequest, onAdjust, onQuickRequest, onViewRequest }) {
  const stockPct = r.minStock > 0 ? Math.min(1, r.stockQty / r.minStock) : 1;
  const barColor = r.stockQty === 0 ? '#DC2626' : r.stockQty <= r.minStock ? '#F59E0B' : '#10B981';
  const isLow = r.lowStock;
  const stDef = STOCK_STATUS[r.stockQty === 0 ? 'empty' : isLow ? 'low' : 'safe'];
  const barBg = r.stockQty === 0 ? '#FEE2E2' : isLow ? '#FEF3C7' : '#DCFCE7';
  const reqSt = activeRequest ? (STATUS_META[activeRequest.status] || STATUS_META.pending) : null;
  const hasPendingRequest = !!activeRequest;

  return (
    <div style={{
      background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 10,
      boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
      borderLeft: `4px solid ${stDef.color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{r.categoryName}</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.name}
          </div>
          {r.itemCode && (
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400, marginTop: 1 }}>📦 {r.itemCode}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
            padding: '2px 8px', borderRadius: 999,
            background: stDef.bg, color: stDef.color,
          }}>
            {stDef.label}
          </span>
        </div>
      </div>

      {hasPendingRequest && reqSt && (
        <button
          onClick={() => onViewRequest(activeRequest)}
          style={{
            width: '100%', marginTop: 8, padding: '8px 10px',
            borderRadius: 8, border: `1px solid ${reqSt.fg}33`,
            background: reqSt.bg, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: reqSt.fg }}>
            {reqSt.icon} Pengajuan: {reqSt.label}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>
            {activeRequest.qty} {activeRequest.unit} diajukan
            {activeRequest.approvedQty != null && activeRequest.approvedQty !== activeRequest.qty
              ? ` · disetujui ${activeRequest.approvedQty} ${activeRequest.unit}`
              : ''}
            {' '}· Ketuk untuk detail →
          </div>
        </button>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 800, color: barColor }}>
              {Number(r.stockQty).toLocaleString('id-ID')}
            </span>
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{r.unit}</span>
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
            Min. {Number(r.minStock).toLocaleString('id-ID')} {r.unit}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn
            size="sm"
            variant={isLow ? 'warning' : 'secondary'}
            onClick={onAdjust}
            style={isLow ? { background: '#F59E0B', color: 'white' } : {}}
          >
            ⚙️ Sesuaikan
          </Btn>
          {isLow && !hasPendingRequest && (
            <button
              onClick={onQuickRequest}
              style={{
                padding: '0 12px', height: 36, borderRadius: 10,
                border: '1.5px solid #F59E0B',
                background: '#FEF3C7', color: '#92400E',
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              📦 Ajukan
            </button>
          )}
          {isLow && hasPendingRequest && (
            <button
              onClick={() => onViewRequest(activeRequest)}
              style={{
                padding: '0 12px', height: 36, borderRadius: 10,
                border: `1.5px solid ${reqSt.fg}`,
                background: reqSt.bg, color: reqSt.fg,
                fontFamily: 'Poppins', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Lihat Status
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 10, height: 5, background: barBg, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, stockPct * 100)}%`,
          background: barColor,
          borderRadius: 3,
          transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

function PengajuanCard({ item: it, highlighted, onEdit }) {
  const urg = URGENCY_META[it.urgency] || URGENCY_META.normal;
  const st = STATUS_META[it.status] || STATUS_META.pending;
  const help = STATUS_HELP[it.status] || '';

  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '12px 14px', marginBottom: 10,
      boxShadow: highlighted ? '0 0 0 2px #F59E0B, 0 4px 12px rgba(245,158,11,0.2)' : '0 1px 4px rgba(15,23,42,0.05)',
      borderLeft: `4px solid ${it.status === 'revised' ? '#F59E0B' : urg.color}`,
      transition: 'box-shadow 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
            {it.itemName}
            {it.brand ? <span style={{ color: C.n600, fontWeight: 500 }}> · {it.brand}</span> : null}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>
            Diminta: <strong>{it.qty} {it.unit}</strong>
            {it.approvedQty != null && it.approvedQty !== it.qty && (
              <span style={{ color: C.primary, fontWeight: 600 }}> · Disetujui: {it.approvedQty} {it.unit}</span>
            )}
            {it.estimatedPrice ? ` · Estimasi ${rp(it.estimatedPrice)}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <span style={{
            fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 999,
            background: urg.bg, color: urg.fg,
          }}>{urg.icon} {urg.label}</span>
          <span style={{
            fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
            padding: '2px 7px', borderRadius: 999,
            background: st.bg, color: st.fg,
          }}>{st.icon} {st.label}</span>
        </div>
      </div>

      <div style={{
        background: st.bg, borderRadius: 8, padding: '8px 10px', marginTop: 8,
        fontFamily: 'Poppins', fontSize: 11, color: st.fg, lineHeight: 1.45,
      }}>
        💡 {help}
      </div>

      <div style={{ background: C.n50, borderRadius: 8, padding: '6px 10px', marginTop: 8, fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
        💬 {it.reason}
      </div>

      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 6 }}>
        Diajukan {fmtDate(it.createdAt)}
        {it.resolvedAt && ` · Diproses ${fmtDate(it.resolvedAt)}`}
        {it.fulfilledAt && ` · Dibeli ${fmtDate(it.fulfilledAt)}`}
        {it.approverName && ` · oleh ${it.approverName}`}
      </div>

      {it.adminNote && (
        <div style={{
          background: it.status === 'revised' ? '#FEF3C7' : it.status === 'rejected' ? '#FEE2E2' : '#EFF6FF',
          borderLeft: `3px solid ${it.status === 'revised' ? '#F59E0B' : it.status === 'rejected' ? '#DC2626' : '#3B82F6'}`,
          borderRadius: 6, padding: '8px 10px', marginTop: 8,
          fontFamily: 'Poppins', fontSize: 11, color: '#1E293B', lineHeight: 1.5,
        }}>
          📝 <strong>Catatan admin:</strong> {it.adminNote}
        </div>
      )}

      {it.status === 'fulfilled' && it.fulfilledAmount && (
        <div style={{ background: '#DCFCE7', borderRadius: 6, padding: '4px 8px', marginTop: 6, fontFamily: 'Poppins', fontSize: 10, color: '#15803D' }}>
          💸 Dibeli senilai {rp(it.fulfilledAmount)}
        </div>
      )}

      {it.status === 'revised' && (
        <button
          onClick={onEdit}
          style={{
            width: '100%', marginTop: 10, padding: '10px',
            background: '#F59E0B', color: 'white',
            border: 'none', borderRadius: 10,
            fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ✏️ Perbaiki & Kirim Ulang
        </button>
      )}
    </div>
  );
}

function QuickRequestModal({ item, onClose, onSuccess }) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('urgent');
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const numQty = Number(qty);
    if (!Number.isFinite(numQty) || numQty <= 0) { alertWarning('Jumlah harus lebih dari 0.'); return; }
    if (!reason.trim()) { alertWarning('Alasan kenapa butuh wajib.'); return; }
    setLoading(true);
    try {
      await axios.post('/api/purchase-requests', {
        inventoryId: item.id,
        itemName: item.name,
        brand: null,
        category: item.categoryName,
        qty: numQty,
        unit: item.unit,
        estimatedPrice: estimatedPrice ? Number(estimatedPrice) : null,
        urgency,
        reason: reason.trim(),
      });
      alertSuccess('Pengajuan berhasil dikirim ke admin.');
      onSuccess();
    } catch (err) {
      if (err?.response?.status === 409) {
        alertError(err?.response?.data?.message || 'Sudah ada pengajuan aktif untuk item ini.');
      } else {
        alertError(err?.response?.data?.message || 'Gagal kirim pengajuan.');
      }
    } finally {
      setLoading(false);
    }
  };

  const suggestedQty = Math.max(1, Math.ceil(2 * Number(item.minStock) - Number(item.stockQty)));

  return (
    <Modal visible onClose={onClose} title="📦 Ajukan Pengadaan">
      <div style={{ padding: '8px 18px 18px' }}>
        <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{item.name}</div>
          {item.itemCode && (
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>📦 {item.itemCode} · {item.categoryName}</div>
          )}
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4 }}>
            Stok sekarang: <strong style={{ color: '#DC2626' }}>{Number(item.stockQty).toLocaleString('id-ID')} {item.unit}</strong>
            {' '}· Min: {Number(item.minStock).toLocaleString('id-ID')}
          </div>
        </div>

        <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontFamily: 'Poppins', fontSize: 11, color: '#92400E' }}>
          💡 Rekomendasi: <strong>{suggestedQty} {item.unit}</strong> (2× minimum − stok sekarang)
        </div>

        <Input
          label="Jumlah yang diminta *"
          value={qty}
          onChange={(v) => setQty(v.replace(/[^\d.]/g, ''))}
          placeholder={`Min. 1 ${item.unit}`}
          inputMode="decimal"
        />

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>
            Tingkat Urgensi
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {Object.entries(URGENCY_META).map(([key, opt]) => {
              const active = urgency === key;
              return (
                <button
                  key={key}
                  onClick={() => setUrgency(key)}
                  style={{
                    padding: '8px 6px', borderRadius: 10,
                    border: `1.5px solid ${active ? opt.color : C.n200}`,
                    background: active ? opt.bg : 'white',
                    color: active ? opt.fg : C.n600,
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Estimasi harga (opsional)"
          value={estimatedPrice}
          onChange={(v) => setEstimatedPrice(v.replace(/[^\d]/g, ''))}
          placeholder="250000"
          inputMode="numeric"
        />

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>
            Alasan / Kebutuhan *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={`Stok ${item.name} tinggal ${item.stockQty} ${item.unit} — minimum ${item.minStock}. Butuh tambahan segera.`}
            style={{
              width: '100%', borderRadius: 10, padding: '10px 12px',
              border: `1.5px solid ${C.n300}`,
              fontFamily: 'Poppins', fontSize: 13, color: C.n900,
              background: C.white, outline: 'none', resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" style={{ flex: 1 }} onClick={onClose}>Batal</Btn>
          <Btn variant="primary" style={{ flex: 1 }} loading={loading} onClick={submit}>Kirim ke Admin</Btn>
        </div>
      </div>
    </Modal>
  );
}

function ResubmitModal({ request, onClose, onSuccess }) {
  const [qty, setQty] = useState(String(request.qty ?? ''));
  const [reason, setReason] = useState(request.reason || '');
  const [urgency, setUrgency] = useState(request.urgency || 'normal');
  const [estimatedPrice, setEstimatedPrice] = useState(request.estimatedPrice != null ? String(request.estimatedPrice) : '');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!Number(qty) || Number(qty) <= 0) { alertWarning('Jumlah harus lebih dari 0.'); return; }
    if (!reason.trim()) { alertWarning('Alasan wajib diisi.'); return; }
    setLoading(true);
    try {
      await axios.patch(`/api/purchase-requests/${request.id}/resubmit`, {
        itemName: request.itemName,
        brand: request.brand || null,
        qty: Number(qty),
        unit: request.unit,
        estimatedPrice: estimatedPrice ? Number(estimatedPrice) : null,
        urgency,
        reason: reason.trim(),
      });
      alertSuccess('Pengajuan dikirim ulang ke admin.');
      onSuccess();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal kirim ulang.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible onClose={onClose} title="✏️ Perbaiki Pengajuan">
      <div style={{ padding: '8px 18px 18px' }}>
        {request.adminNote && (
          <div style={{
            background: '#FEF3C7', border: '1px solid #FCD34D',
            borderRadius: 10, padding: '10px 12px', marginBottom: 14,
            fontFamily: 'Poppins', fontSize: 11, color: '#92400E', lineHeight: 1.5,
          }}>
            📝 <strong>Catatan admin:</strong><br />{request.adminNote}
          </div>
        )}

        <div style={{ background: C.n50, borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700 }}>{request.itemName}</div>
        </div>

        <Input label="Jumlah *" value={qty} onChange={(v) => setQty(v.replace(/[^\d.]/g, ''))} inputMode="decimal" />

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>
            Urgensi
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {Object.entries(URGENCY_META).map(([key, opt]) => {
              const active = urgency === key;
              return (
                <button
                  key={key}
                  onClick={() => setUrgency(key)}
                  style={{
                    padding: '8px 6px', borderRadius: 10,
                    border: `1.5px solid ${active ? opt.color : C.n200}`,
                    background: active ? opt.bg : 'white',
                    color: active ? opt.fg : C.n600,
                    fontFamily: 'Poppins', fontSize: 11, fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {opt.icon} {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Estimasi harga (opsional)"
          value={estimatedPrice}
          onChange={(v) => setEstimatedPrice(v.replace(/[^\d]/g, ''))}
          inputMode="numeric"
        />

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>
            Alasan *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={{
              width: '100%', borderRadius: 10, padding: '10px 12px',
              border: `1.5px solid ${C.n300}`,
              fontFamily: 'Poppins', fontSize: 13, color: C.n900,
              background: C.white, outline: 'none', resize: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="secondary" style={{ flex: 1 }} onClick={onClose}>Batal</Btn>
          <Btn variant="primary" style={{ flex: 1 }} loading={loading} onClick={submit}>Kirim Ulang</Btn>
        </div>
      </div>
    </Modal>
  );
}
