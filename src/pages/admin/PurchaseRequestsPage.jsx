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
import { TopBar, Btn, Modal, Input, Textarea, Chip, useAppRefresh } from '../../components/ui';
import { alertError, alertSuccess, alertWarning } from '../../utils/alert';

const URGENCY_META = {
  normal:   { label: 'Normal',   color: '#3B82F6', icon: '📋' },
  urgent:   { label: 'Urgent',   color: '#F59E0B', icon: '⚠️' },
  critical: { label: 'Kritis',   color: '#DC2626', icon: '🚨' },
};

const STATUS_META = {
  pending:   { label: 'Pending',   bg: '#FEF3C7', fg: '#92400E', icon: '⏳' },
  revised:   { label: 'Revisi',    bg: '#FEE2E2', fg: '#991B1B', icon: '↩️' },
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

export default function PurchaseRequestsPage({ goBack }) {
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [outletFilter, setOutletFilter] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  // Modal states
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
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (outletFilter) params.outletId = outletFilter;
      const r = await axios.get('/api/purchase-requests', { params });
      setItems(r?.data?.data || []);
    } catch (err) {
      console.error('[fetchData]', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, outletFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  // Load outlet list (untuk filter dropdown)
  useEffect(() => {
    axios.get('/api/outlets').then(r => setOutlets(r?.data?.data || [])).catch(() => {});
  }, []);

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

  const stats = useMemo(() => ({
    pending: items.filter(i => i.status === 'pending').length,
    revised: items.filter(i => i.status === 'revised').length,
    critical: items.filter(i => i.urgency === 'critical' && i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
  }), [items]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Pengajuan Stok"
        subtitle={stats.critical > 0 ? `🚨 ${stats.critical} kritis pending!` : `${stats.pending} pending`}
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

        {/* Filter outlet */}
        {outlets.length > 1 && (
          <div style={{ marginBottom: 10 }}>
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
              style={{
                width: '100%', height: 40, borderRadius: 10, padding: '0 12px',
                border: `1.5px solid ${C.n200}`, fontFamily: 'Poppins', fontSize: 13,
                color: C.n700, background: 'white', outline: 'none',
              }}
            >
              <option value="">Semua Outlet</option>
              {outlets.map(o => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </div>
        )}

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[
            { value: 'pending',   label: '⏳ Pending' },
            { value: 'revised',   label: '↩️ Revisi' },
            { value: 'approved',  label: '✅ Approved' },
            { value: 'fulfilled', label: '🎉 Fulfilled' },
            { value: 'rejected',  label: '❌ Rejected' },
            { value: 'all',       label: 'Semua' },
          ].map(f => (
            <Chip key={f.value} label={f.label} active={statusFilter === f.value} onClick={() => setStatusFilter(f.value)} />
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat…</div>}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Tidak ada request {statusFilter}.</div>
          </div>
        )}

        {!loading && items.map(it => {
          const urg = URGENCY_META[it.urgency] || URGENCY_META.normal;
          const st = STATUS_META[it.status] || STATUS_META.pending;
          return (
            <div key={it.id} style={{
              background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
              borderLeft: `4px solid ${urg.color}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>
                      {it.itemName}
                    </span>
                    {it.inventoryCode && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.n500, background: C.n100, padding: '1px 6px', borderRadius: 4 }}>
                        📦 {it.inventoryCode}
                      </span>
                    )}
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
                      background: `${urg.color}20`, color: urg.color,
                      padding: '2px 7px', borderRadius: 999,
                    }}>{urg.icon} {urg.label}</span>
                    <span style={{
                      fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                      background: st.bg, color: st.fg,
                      padding: '2px 7px', borderRadius: 999,
                    }}>{st.icon} {st.label}</span>
                  </div>
                  {it.brand && <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>Merek: {it.brand}</div>}
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, fontWeight: 600, marginTop: 4 }}>
                    {it.qty} {it.unit}
                    {it.approvedQty != null && it.approvedQty !== it.qty && (
                      <span style={{ color: C.primary }}> · disetujui {it.approvedQty} {it.unit}</span>
                    )}
                    {it.estimatedPrice && ` · Estimasi ${rp(it.estimatedPrice)}`}
                  </div>
                </div>
              </div>

              <div style={{ background: C.n50, borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontFamily: 'Poppins', fontSize: 11, color: C.n700 }}>
                💬 {it.reason}
              </div>

              {it.adminNote && (
                <div style={{
                  background: it.status === 'revised' ? '#FEF3C7' : '#EFF6FF',
                  borderLeft: `3px solid ${it.status === 'revised' ? '#F59E0B' : '#3B82F6'}`,
                  borderRadius: 6, padding: '6px 10px', marginBottom: 8,
                  fontFamily: 'Poppins', fontSize: 11, color: '#1E293B',
                }}>
                  📝 <strong>Catatan admin:</strong> {it.adminNote}
                </div>
              )}

              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginBottom: 8 }}>
                🏪 {it.outletName} · 👤 {it.requesterName} · {fmtDate(it.createdAt)}
                {it.resubmittedAt && (
                  <span style={{ color: C.primary, fontWeight: 600 }}> · 🔄 Resubmit {fmtDate(it.resubmittedAt)}</span>
                )}
              </div>

              {/* Actions */}
              {it.status === 'pending' && (
                <div style={{ display: 'flex', gap: 6 }}>
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
                >
                  💸 Tandai Sudah Dibeli
                </Btn>
              )}
              {it.status === 'fulfilled' && it.fulfilledAmount && (
                <div style={{ background: '#DCFCE7', borderRadius: 6, padding: '6px 10px', fontFamily: 'Poppins', fontSize: 11, color: '#15803D', fontWeight: 600 }}>
                  💸 Sudah dibeli sebesar {rp(it.fulfilledAmount)}
                  {it.fulfillerName && ` oleh ${it.fulfillerName}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
          <Input
            label="Total dibelanjakan (Rp)"
            value={fulfilledAmount}
            onChange={(v) => setFulfilledAmount(v.replace(/\D/g, ''))}
            inputMode="numeric"
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
