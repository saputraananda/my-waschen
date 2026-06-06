// ─────────────────────────────────────────────────────────────────────────────
// Admin: review & resolve purchase requests dari kasir
// ─────────────────────────────────────────────────────────────────────────────
// Action: approve / revise / reject / fulfill (untuk yang sudah approved)
// Approve auto-tambah stok outlet kalau request berasal dari item katalog.
// Revise & Reject WAJIB isi catatan admin.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Input, Textarea, Chip, MoneyInput, useAppRefresh, OutletDropdown, SkeletonList, SearchFilterRow, Avatar } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

const URGENCY_META = {
  normal:   { label: 'Normal',   color: '#3B82F6', icon: '📋' },
  urgent:   { label: 'Urgent',   color: '#F59E0B', icon: '⚠️' },
  critical: { label: 'Kritis',   color: '#DC2626', icon: '🚨' },
};

const STATUS_META = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', fg: '#92400E', icon: '⏳' },
  revised:   { label: 'Revisi',    bg: '#FED7AA', fg: '#9A3412', icon: '↩️' },
  approved:  { label: 'Disetujui', bg: '#DBEAFE', fg: '#1E40AF', icon: '✅' },
  fulfilled: { label: 'Dibeli',    bg: '#DCFCE7', fg: '#15803D', icon: '🎉' },
  rejected:  { label: 'Ditolak',   bg: '#FEE2E2', fg: '#991B1B', icon: '❌' },
  cancelled: { label: 'Dibatalkan', bg: '#F3F4F6', fg: '#6B7280', icon: '⊘' },
};

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

const fmtDateOnly = (v) => {
  if (!v) return '';
  try {
    return new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(v); }
};

const PERIOD_PRESETS = [
  { key: '7d', label: '7 Hari', days: 7 },
  { key: '30d', label: '30 Hari', days: 30 },
  { key: '90d', label: '90 Hari', days: 90 },
];

function periodToRange(days) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
  return { startDate: start, endDate: end };
}

export default function PurchaseRequestsPage({
  goBack,
  pageTitle = 'Approval Pengadaan Barang',
  filterModalTitle = 'Filter Pengadaan Barang',
}) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [outletFilter, setOutletFilter] = useState('');
  const [datePeriod, setDatePeriod] = useState(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [dateBasis, setDateBasis] = useState('created');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Modal states
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [reviseModal, setReviseModal] = useState(null);
  const [fulfillModal, setFulfillModal] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [approvedQty, setApprovedQty] = useState('');
  const [approveModal, setApproveModal] = useState(null);
  const [fulfilledAmount, setFulfilledAmount] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (urgencyFilter !== 'all') params.urgency = urgencyFilter;
      if (outletFilter) params.outletId = outletFilter;
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      if (dateRange.startDate || dateRange.endDate) params.dateBasis = dateBasis;
      const r = await axios.get('/api/purchase-requests', { params });
      setItems(r?.data?.data || []);

      try {
        const s = await axios.get('/api/purchase-requests/summary');
        setSummary(s?.data?.data || []);
      } catch {}
    } catch (err) {
      console.error('[fetchData]', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, urgencyFilter, outletFilter, dateRange, dateBasis]);

  useEffect(() => {
    axios.get('/api/outlets')
      .then((r) => setOutlets(r?.data?.data || []))
      .catch(() => setOutlets([]));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  // Client-side search filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      (it.itemName || '').toLowerCase().includes(q) ||
      (it.brand || '').toLowerCase().includes(q) ||
      (it.outletName || '').toLowerCase().includes(q) ||
      (it.requesterName || '').toLowerCase().includes(q) ||
      (it.reason || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => ({
    pending: items.filter(i => i.status === 'pending').length,
    revised: items.filter(i => i.status === 'revised').length,
    critical: items.filter(i => i.urgency === 'critical' && i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
  }), [items]);

  const selectedOutletName = useMemo(() => {
    if (!outletFilter) return '';
    return outlets.find((o) => String(o.id) === String(outletFilter))?.name
      || summary.find((s) => String(s.outletId) === String(outletFilter))?.outletName
      || 'Outlet';
  }, [outletFilter, outlets, summary]);

  const listGroups = useMemo(() => {
    const map = new Map();
    for (const it of filtered) {
      const key = String(it.outletId ?? 'unknown');
      if (!map.has(key)) {
        map.set(key, {
          outletId: key,
          outletName: it.outletName || selectedOutletName || 'Outlet',
          items: [],
        });
      }
      map.get(key).items.push(it);
    }
    return [...map.values()];
  }, [filtered, selectedOutletName]);

  const activeFilterCount =
    (outletFilter ? 1 : 0)
    + (urgencyFilter !== 'all' ? 1 : 0)
    + (statusFilter !== 'pending' ? 1 : 0)
    + (dateRange.startDate && dateRange.endDate ? 1 : 0);

  const dateRangeLabel = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return '';
    return `${fmtDateOnly(dateRange.startDate)} – ${fmtDateOnly(dateRange.endDate)}`;
  }, [dateRange]);

  const pageSubtitle = useMemo(() => {
    if (stats.critical > 0 && statusFilter === 'pending') {
      return `🚨 ${stats.critical} kritis · ${stats.pending} menunggu approval`;
    }
    if (statusFilter === 'pending') {
      return `${stats.pending} menunggu approval · gunakan filter untuk riwayat`;
    }
    if (statusFilter === 'all') {
      return `${filtered.length} pengajuan · semua status`;
    }
    const statusLabel = STATUS_META[statusFilter]?.label || statusFilter;
    return `${filtered.length} pengajuan · riwayat ${statusLabel}`;
  }, [stats, statusFilter, filtered.length]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(`${approveModal.id}_approve`);
    try {
      const body = { action: 'approve' };
      if (approvedQty && Number(approvedQty) > 0 && Number(approvedQty) !== Number(approveModal.qty)) {
        body.approvedQty = Number(approvedQty);
      }
      if (adminNote.trim()) body.adminNote = adminNote.trim();
      const res = await axios.patch(`/api/purchase-requests/${approveModal.id}`, body);
      const newStock = res?.data?.data?.newStockQty;
      alertSuccess(newStock != null
        ? `Disetujui — stok outlet sekarang ${Number(newStock).toLocaleString('id-ID')}.`
        : 'Disetujui.');
      setApproveModal(null);
      setApprovedQty('');
      setAdminNote('');
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal approve.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevise = async () => {
    if (!adminNote.trim()) { alertWarning('Catatan revisi wajib diisi.'); return; }
    setActionLoading(`${reviseModal}_revise`);
    try {
      await axios.patch(`/api/purchase-requests/${reviseModal}`, {
        action: 'revise',
        adminNote: adminNote.trim(),
      });
      alertSuccess('Request dikembalikan ke kasir untuk direvisi.');
      setReviseModal(null);
      setAdminNote('');
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal revisi.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!adminNote.trim()) { alertWarning('Alasan tolak wajib.'); return; }
    setActionLoading(`${rejectModal}_reject`);
    try {
      await axios.patch(`/api/purchase-requests/${rejectModal}`, {
        action: 'reject',
        adminNote: adminNote.trim(),
      });
      alertSuccess('Request ditolak.');
      setRejectModal(null);
      setAdminNote('');
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal reject.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFulfill = async () => {
    setActionLoading(`${fulfillModal}_fulfill`);
    try {
      await axios.patch(`/api/purchase-requests/${fulfillModal}`, {
        action: 'fulfill',
        fulfilledAmount: fulfilledAmount ? Number(fulfilledAmount) : null,
      });
      alertSuccess('Barang sudah dibeli, request ditandai fulfilled.');
      setFulfillModal(null);
      setFulfilledAmount('');
      fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal fulfill.');
    } finally {
      setActionLoading(null);
    }
  };

  // Build per-outlet badge count from summary
  const outletSummaryMap = useMemo(() => {
    const m = new Map();
    for (const s of summary) {
      m.set(Number(s.outletId), s);
    }
    return m;
  }, [summary]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title={pageTitle}
        subtitle={pageSubtitle}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Stats banner */}
        <div style={{
          background: stats.critical > 0
            ? 'linear-gradient(135deg, #DC2626, #B91C1C)'
            : 'linear-gradient(135deg, #F59E0B, #D97706)',
          borderRadius: 14, padding: '12px 14px', marginBottom: 12,
          color: 'white', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
        }}>
          {[
            { label: 'Kritis', value: stats.critical, icon: '🚨' },
            { label: 'Pending', value: stats.pending, icon: '⏳' },
            { label: 'Revisi', value: stats.revised, icon: '↩️' },
            { label: 'Approved', value: stats.approved, icon: '✅' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 18 }}>{s.icon}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 800, marginTop: 2 }}>{s.value}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.9 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Ringkasan filter aktif — mudah diaudit finance */}
        {activeFilterCount > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10,
            padding: '8px 10px', borderRadius: 10,
            background: `${C.primary}08`, border: `1px solid ${C.primary}22`,
          }}>
            {outletFilter && (
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.primary, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                🏪 {selectedOutletName}
              </span>
            )}
            {statusFilter !== 'pending' && (
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                📌 {STATUS_META[statusFilter]?.label || statusFilter}
              </span>
            )}
            {urgencyFilter !== 'all' && (
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                {URGENCY_META[urgencyFilter]?.icon} {URGENCY_META[urgencyFilter]?.label}
              </span>
            )}
            {dateRangeLabel && (
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n700, background: 'white', padding: '3px 8px', borderRadius: 999 }}>
                📅 {dateRangeLabel} · {dateBasis === 'resolved' ? 'diproses' : 'diajukan'}
              </span>
            )}
          </div>
        )}

        <SearchFilterRow
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari barang, outlet, kasir..."
          onFilterClick={() => setShowFilterModal(true)}
          activeFilterCount={activeFilterCount}
        />

        {loading ? <SkeletonList count={4} height={90} /> : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Tidak ada pengajuan barang.</div>
          </div>
        ) : null}

        {!loading && listGroups.map((group) => (
          <section key={group.outletId} style={{ marginBottom: 14 }}>
            {!outletFilter && listGroups.length > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', marginBottom: 8, borderRadius: 10,
                background: C.white, border: `1px solid ${C.n200}`,
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>
                  🏪 {group.outletName}
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n500 }}>
                  {group.items.length} pengajuan
                </span>
              </div>
            )}

            {group.items.map((it) => {
          const urg = URGENCY_META[it.urgency] || URGENCY_META.normal;
          const st = STATUS_META[it.status] || STATUS_META.pending;
          const outletSum = outletSummaryMap.get(Number(it.outletId));
          return (
            <div key={it.id} style={{
              background: C.white, borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
              borderLeft: `4px solid ${it.status === 'revised' ? '#F59E0B' : urg.color}`,
            }}>
              {/* Outlet identity strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Avatar
                  initials={(it.outletName || 'OT').split(' ').map(w => w[0]).join('').slice(0, 2)}
                  size={36}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>
                    🏪 {it.outletName || 'Outlet tidak diketahui'}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                    Diajukan oleh {it.requesterName || '-'} · {fmtDate(it.createdAt)}
                    {it.resubmittedAt && <span style={{ color: C.primary }}> · 🔄 Resubmit {fmtDate(it.resubmittedAt)}</span>}
                    {it.resolvedAt && <span> · ✅ Diproses {fmtDate(it.resolvedAt)}</span>}
                    {it.fulfilledAt && <span> · 🎉 Dibeli {fmtDate(it.fulfilledAt)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <span style={{
                    fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                    padding: '2px 8px', borderRadius: 999,
                    background: st.bg, color: st.fg,
                  }}>{st.icon} {st.label}</span>
                  {it.status === 'pending' && (
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
                      padding: '2px 8px', borderRadius: 999,
                      background: `${urg.color}20`, color: urg.color,
                    }}>{urg.icon} {urg.label}</span>
                  )}
                </div>
              </div>

              {/* Item info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>
                    {it.itemName}
                    {it.brand && <span style={{ color: C.n600, fontWeight: 500 }}> · {it.brand}</span>}
                  </div>
                  {it.inventoryCode && (
                    <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.n500, background: C.n100, padding: '1px 6px', borderRadius: 4 }}>
                      📦 {it.inventoryCode}
                    </span>
                  )}
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, fontWeight: 600, marginTop: 4 }}>
                    {it.qty} {it.unit}
                    {it.approvedQty != null && it.approvedQty !== it.qty && (
                      <span style={{ color: C.primary }}> · disetujui {it.approvedQty} {it.unit}</span>
                    )}
                    {it.estimatedPrice && ` · Estimasi ${rp(it.estimatedPrice)}`}
                  </div>
                </div>
                {outletSum && outletSum.pendingCount > 1 && (
                  <div style={{
                    background: '#FEF3C7', borderRadius: 6, padding: '4px 8px',
                    fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: '#92400E',
                    textAlign: 'right', flexShrink: 0,
                  }}>
                    +{outletSum.pendingCount - 1} lainnya
                  </div>
                )}
              </div>

              {/* Reason */}
              <div style={{ background: C.n50, borderRadius: 8, padding: '8px 10px', marginTop: 8, fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
                💬 {it.reason}
              </div>

              {/* Admin note */}
              {it.adminNote && (
                <div style={{
                  background: it.status === 'revised' ? '#FEF3C7' : '#EFF6FF',
                  borderLeft: `3px solid ${it.status === 'revised' ? '#F59E0B' : '#3B82F6'}`,
                  borderRadius: 6, padding: '6px 10px', marginTop: 8,
                  fontFamily: 'Poppins', fontSize: 11, color: '#1E293B',
                }}>
                  📝 <strong>Catatan admin:</strong> {it.adminNote}
                  {it.approverName && <span style={{ color: C.n500 }}> · {it.approverName}</span>}
                </div>
              )}

              {/* Actions */}
              {it.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <Btn
                    variant="danger"
                    onClick={() => { setRejectModal(it.id); setAdminNote(''); }}
                    style={{ flex: 1 }}
                    size="sm"
                  >Tolak</Btn>
                  <Btn
                    variant="warning"
                    onClick={() => { setReviseModal(it.id); setAdminNote(''); }}
                    style={{ flex: 1, background: '#F59E0B', color: 'white' }}
                    size="sm"
                  >↩️ Revisi</Btn>
                  <Btn
                    variant="success"
                    onClick={() => {
                      setApproveModal(it);
                      setApprovedQty(String(it.qty));
                      setAdminNote('');
                    }}
                    style={{ flex: 1 }}
                    size="sm"
                  >Setujui</Btn>
                </div>
              )}
              {it.status === 'approved' && (
                <Btn
                  variant="primary"
                  onClick={() => { setFulfillModal(it.id); setFulfilledAmount(String(it.estimatedPrice || '')); }}
                  loading={actionLoading === `${it.id}_fulfill`}
                  fullWidth
                  size="sm"
                  style={{ marginTop: 12 }}
                >
                  💸 Tandai Sudah Dibeli
                </Btn>
              )}
              {it.status === 'fulfilled' && it.fulfilledAmount && (
                <div style={{ background: '#DCFCE7', borderRadius: 6, padding: '6px 10px', marginTop: 8, fontFamily: 'Poppins', fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                  💸 Sudah dibeli sebesar {rp(it.fulfilledAmount)}
                  {it.fulfillerName && ` oleh ${it.fulfillerName}`}
                </div>
              )}
            </div>
          );
        })}
          </section>
        ))}
      </div>

      {/* Filter modal */}
      {showFilterModal && (
        <Modal visible onClose={() => setShowFilterModal(false)} title={filterModalTitle}>
          <div style={{ padding: '8px 18px 18px' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
              🎯 Outlet
            </div>
            <OutletDropdown
              value={outletFilter}
              onChange={(v) => setOutletFilter(v ? String(v) : '')}
              outlets={outlets}
              placeholder="Semua Outlet"
            />

            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8, marginTop: 16 }}>
              📅 Rentang Tanggal
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <Chip
                label="Semua waktu"
                active={!datePeriod}
                onClick={() => {
                  setDatePeriod(null);
                  setDateRange({ startDate: '', endDate: '' });
                }}
              />
              {PERIOD_PRESETS.map((p) => (
                <Chip
                  key={p.key}
                  label={p.label}
                  active={datePeriod === p.key}
                  onClick={() => {
                    setDatePeriod(p.key);
                    setDateRange(periodToRange(p.days));
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <label style={{ display: 'block' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginBottom: 4 }}>Dari</div>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => {
                    setDatePeriod('custom');
                    setDateRange((prev) => ({ ...prev, startDate: e.target.value }));
                  }}
                  style={{
                    width: '100%', height: 36, borderRadius: 8,
                    border: `1.5px solid ${C.n200}`,
                    padding: '0 10px', fontFamily: 'Poppins', fontSize: 11,
                    color: C.n900, background: 'white', boxSizing: 'border-box',
                  }}
                />
              </label>
              <label style={{ display: 'block' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginBottom: 4 }}>Sampai</div>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => {
                    setDatePeriod('custom');
                    setDateRange((prev) => ({ ...prev, endDate: e.target.value }));
                  }}
                  style={{
                    width: '100%', height: 36, borderRadius: 8,
                    border: `1.5px solid ${C.n200}`,
                    padding: '0 10px', fontFamily: 'Poppins', fontSize: 11,
                    color: C.n900, background: 'white', boxSizing: 'border-box',
                  }}
                />
              </label>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginBottom: 8 }}>
              Tanggal berdasarkan
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <Chip
                label="Tanggal diajukan"
                active={dateBasis === 'created'}
                onClick={() => setDateBasis('created')}
              />
              <Chip
                label="Tanggal diproses"
                active={dateBasis === 'resolved'}
                onClick={() => setDateBasis('resolved')}
              />
            </div>
            <div style={{
              fontFamily: 'Poppins', fontSize: 10, color: C.n500, lineHeight: 1.5,
              background: C.n50, borderRadius: 8, padding: '8px 10px', marginBottom: 12,
            }}>
              Untuk audit riwayat selesai, pilih status <strong>Fulfilled/Approved</strong> + rentang tanggal <strong>diproses</strong>.
            </div>

            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
              🚨 Tingkat Urgensi
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { value: 'all', label: 'Semua Urgensi' },
                { value: 'critical', label: '🚨 Kritis' },
                { value: 'urgent', label: '⚠️ Urgent' },
                { value: 'normal', label: '📋 Normal' },
              ].map(f => (
                <Chip
                  key={f.value}
                  label={f.label}
                  active={urgencyFilter === f.value}
                  onClick={() => setUrgencyFilter(f.value)}
                />
              ))}
            </div>

            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n700, marginBottom: 8 }}>
              📌 Status
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { value: 'pending', label: '⏳ Pending' },
                { value: 'revised', label: '↩️ Revisi' },
                { value: 'approved', label: '✅ Approved' },
                { value: 'fulfilled', label: '🎉 Fulfilled' },
                { value: 'rejected', label: '❌ Rejected' },
                { value: 'all', label: 'Semua' },
              ].map(f => (
                <Chip
                  key={f.value}
                  label={f.label}
                  active={statusFilter === f.value}
                  onClick={() => setStatusFilter(f.value)}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Btn
                variant="secondary"
                onClick={() => {
                  setOutletFilter('');
                  setUrgencyFilter('all');
                  setStatusFilter('pending');
                  setDatePeriod(null);
                  setDateRange({ startDate: '', endDate: '' });
                  setDateBasis('created');
                }}
                style={{ flex: 1 }}
              >
                Reset
              </Btn>
              <Btn
                variant="primary"
                onClick={() => setShowFilterModal(false)}
                style={{ flex: 1 }}
              >
                Terapkan
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Approve modal ── */}
      <Modal visible={!!approveModal} onClose={() => setApproveModal(null)} title="Setujui Pengajuan">
        <div style={{ padding: '8px 18px 18px' }}>
          {approveModal && (
            <>
              <div style={{ background: C.n50, borderRadius: 10, padding: 12, marginBottom: 14, fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>
                <div><strong>{approveModal.itemName}</strong> {approveModal.brand && `· ${approveModal.brand}`}</div>
                <div style={{ marginTop: 4 }}>Diminta: <strong>{approveModal.qty} {approveModal.unit}</strong></div>
                <div style={{ marginTop: 4, color: C.n600 }}>{approveModal.outletName}</div>
              </div>
              <Input
                label="Qty yang disetujui"
                value={approvedQty}
                onChange={(v) => setApprovedQty(v.replace(/[^\d.]/g, ''))}
                inputMode="decimal"
                placeholder={`Default ${approveModal.qty}`}
              />
              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: -10, marginBottom: 14 }}>
                Bisa beda dari yang diminta. Stok outlet akan otomatis bertambah jika item dari katalog.
              </div>
              <Textarea
                label="Catatan (opsional)"
                value={adminNote}
                onChange={setAdminNote}
                rows={2}
                placeholder="Mis. distok hari Senin"
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Btn variant="secondary" onClick={() => setApproveModal(null)} style={{ flex: 1 }}>Batal</Btn>
                <Btn variant="success" onClick={handleApprove} loading={actionLoading === `${approveModal.id}_approve`} style={{ flex: 1 }}>
                  Setujui
                </Btn>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Revise modal ── */}
      <Modal visible={!!reviseModal} onClose={() => setReviseModal(null)} title="Minta Revisi">
        <div style={{ padding: '8px 18px 18px' }}>
          <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: 10, marginBottom: 14, fontFamily: 'Poppins', fontSize: 11, color: '#92400E' }}>
            ↩️ Pengajuan akan dikembalikan ke kasir. Mereka bisa edit dan kirim ulang.
          </div>
          <Textarea
            label="Catatan untuk kasir *"
            value={adminNote}
            onChange={setAdminNote}
            rows={4}
            placeholder="Mis. Qty terlalu banyak, mohon revisi jadi 5 box"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn variant="secondary" onClick={() => setReviseModal(null)} style={{ flex: 1 }}>Batal</Btn>
            <Btn
              onClick={handleRevise}
              disabled={!adminNote.trim()}
              loading={actionLoading === `${reviseModal}_revise`}
              style={{ flex: 1, background: '#F59E0B', color: 'white' }}
            >
              Kirim Revisi
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Reject modal ── */}
      <Modal visible={!!rejectModal} onClose={() => setRejectModal(null)} title="Tolak Pengajuan">
        <div style={{ padding: '8px 18px 18px' }}>
          <Textarea
            label="Alasan tolak *"
            value={adminNote}
            onChange={setAdminNote}
            rows={4}
            placeholder="Mis. Sudah ada stok cukup di outlet"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn variant="secondary" onClick={() => setRejectModal(null)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="danger" onClick={handleReject} disabled={!adminNote.trim()} loading={actionLoading === `${rejectModal}_reject`} style={{ flex: 1 }}>
              Tolak
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Fulfill modal ── */}
      <Modal visible={!!fulfillModal} onClose={() => setFulfillModal(null)} title="Tandai Sudah Dibeli">
        <div style={{ padding: '8px 18px 18px' }}>
          <MoneyInput
            label="Total dibelanjakan (Rp)"
            value={fulfilledAmount}
            onChange={(v) => setFulfilledAmount(v)}
            placeholder="0"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn variant="secondary" onClick={() => setFulfillModal(null)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="primary" onClick={handleFulfill} loading={actionLoading === `${fulfillModal}_fulfill`} style={{ flex: 1 }}>
              Tandai Dibeli
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
