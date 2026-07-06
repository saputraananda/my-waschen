// ─────────────────────────────────────────────────────────────────────────────
// KasApprovalPage — admin approve/reject pengeluaran kas operasional outlet
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useMemo } from 'react';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Modal, Textarea, Chip, useAppRefresh } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';
import { getCashApprovals, resolveCashApproval, CATEGORY_META } from '../../utils/outletCashApi';

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return '-'; }
};

export default function KasApprovalPage({ goBack }) {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCashApprovals(statusFilter);
      setItems(data);
    } catch (err) {
      console.error('[fetchKasApprovals]', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useAppRefresh(() => fetchData(), [fetchData]);

  const handleApprove = async (id) => {
    setActionLoading(`${id}_approve`);
    try {
      await resolveCashApproval(id, 'approve');
      alertSuccess('Pengeluaran kas disetujui. Saldo dipotong.');
      await fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal approve pengeluaran kas.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alertError('Alasan tolak wajib diisi.');
      return;
    }
    setActionLoading(`${rejectModal}_reject`);
    try {
      await resolveCashApproval(rejectModal, 'reject', rejectReason.trim());
      alertSuccess('Pengeluaran kas ditolak.');
      setRejectModal(null);
      setRejectReason('');
      await fetchData();
    } catch (err) {
      alertError(err?.response?.data?.message || 'Gagal tolak pengeluaran kas.');
    } finally {
      setActionLoading(null);
    }
  };

  const pending = useMemo(() => items.filter(it => it.status === 'pending'), [items]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Approval Kas Outlet"
        subtitle={`${pending.length} pengeluaran menunggu`}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 12 }}>
          {[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Disetujui' },
            { value: 'rejected', label: 'Ditolak' },
          ].map(s => (
            <Chip key={s.value} label={s.label} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)} />
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 30, fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
            Memuat…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ textAlign: 'center', padding: 50, fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
            <div>Tidak ada approval kas {statusFilter === 'pending' ? 'pending' : statusFilter}.</div>
          </div>
        )}

        {!loading && items.map(it => {
          const cat = CATEGORY_META[it.category] || CATEGORY_META.other;
          return (
            <div key={it.id} style={{
              background: 'white', borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              boxShadow: SHADOW.md,
              borderLeft: `4px solid ${it.status === 'pending' ? C.warning : it.status === 'approved' ? C.success : C.danger}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                    background: `${cat.color}15`, border: `1px solid ${cat.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>{cat.icon}</div>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
                      {cat.label}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 1 }}>
                      🏪 {it.outletName} · 👤 {it.requesterName}
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 600, color: C.danger }}>
                  {rp(it.amount)}
                </div>
              </div>

              <div style={{ background: C.n50, borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n800 }}>
                  📝 {it.description}
                </div>
              </div>

              {it.receiptPhotoUrl && (
                <a href={it.receiptPhotoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginBottom: 10 }}>
                  <img src={it.receiptPhotoUrl} alt="bon" style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.n200}` }} />
                </a>
              )}

              <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginBottom: 10 }}>
                Diajukan: {fmtDate(it.requestedAt)}
                {it.resolverName && ` · Diproses oleh ${it.resolverName}`}
                {it.resolvedAt && ` · ${fmtDate(it.resolvedAt)}`}
              </div>

              {it.status === 'rejected' && it.rejectReason && (
                <div style={{ background: C.dangerBg, borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontFamily: 'Poppins', fontSize: 11, color: C.dangerDark }}>
                  ❌ Alasan tolak: {it.rejectReason}
                </div>
              )}

              {it.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn
                    variant="danger"
                    onClick={() => { setRejectModal(it.id); setRejectReason(''); }}
                    loading={actionLoading === `${it.id}_reject`}
                    style={{ flex: 1 }}
                    size="sm"
                  >Tolak</Btn>
                  <Btn
                    variant="success"
                    onClick={() => handleApprove(it.id)}
                    loading={actionLoading === `${it.id}_approve`}
                    style={{ flex: 1 }}
                    size="sm"
                  >Setujui</Btn>
                </div>
              )}

              {it.status !== 'pending' && (
                <div style={{
                  display: 'inline-block',
                  fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                  padding: '3px 10px', borderRadius: 999,
                  background: it.status === 'approved' ? C.successBg : C.dangerBg,
                  color: it.status === 'approved' ? C.successDark : C.dangerDark,
                }}>
                  {it.status === 'approved' ? '✓ Disetujui' : '✗ Ditolak'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal visible={!!rejectModal} onClose={() => setRejectModal(null)} title="Tolak Pengeluaran Kas">
        <div style={{ padding: '8px 18px 18px' }}>
          <Textarea
            label="Alasan menolak"
            value={rejectReason}
            onChange={setRejectReason}
            rows={4}
            placeholder="Contoh: Bukti tidak jelas, atau nominal terlalu besar untuk kebutuhan harian"
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Btn variant="secondary" onClick={() => setRejectModal(null)} style={{ flex: 1 }}>Batal</Btn>
            <Btn variant="danger" onClick={handleReject} disabled={!rejectReason.trim()} style={{ flex: 1 }}>
              Tolak
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
