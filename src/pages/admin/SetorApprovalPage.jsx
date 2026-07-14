import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Select } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useResponsive } from '../../utils/hooks';

const TABS = [
  { value: 'pending', label: '⏳ Pending' },
  { value: 'approved', label: '✅ Approved' },
  { value: 'rejected', label: '❌ Ditolak' },
];

function SetorApprovalPage({ goBack }) {
  const { isMobile } = useResponsive();
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState('pending');
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [outletFilter, setOutletFilter] = useState('');
  const [outlets, setOutlets] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: activeTab, limit: 100 };
      if (outletFilter) params.outlet_id = outletFilter;
      const res = await api.get('/api/cash-deposits/pending', { params });
      setDeposits(res?.data?.data || []);
    } catch (err) { console.error('Error loading data:', err); }
    finally { setLoading(false); }
  }, [activeTab, outletFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load outlets for filter
  useEffect(() => {
    api.get('/api/master/outlets').then(r => {
      setOutlets([{ value: '', label: 'Semua Outlet' }, ...(r?.data?.data || []).map(o => ({ value: String(o.id), label: o.name }))]);
    }).catch((err) => { console.error('Error loading outlets:', err); });
  }, []);

  const handleApprove = async (id) => {
    if (!confirm('Approve setor ini?')) return;
    try {
      await api.patch(`/api/cash-deposits/${id}/approve`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal approve.');
    }
  };

  const handleReject = async (id) => {
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      alert('Alasan penolakan minimal 3 karakter.');
      return;
    }
    try {
      await api.patch(`/api/cash-deposits/${id}/reject`, { reason: rejectReason });
      setRejectingId(null);
      setRejectReason('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal reject.');
    }
  };

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const fmtTime = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Approval Setor Tunai" subtitle="Verifikasi penyetoran kas kasir" onBack={goBack} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 16px', background: C.white, borderBottom: `1px solid ${C.n200}`, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            style={{
              flex: 1, padding: '12px 0', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'Poppins', fontSize: 12, fontWeight: activeTab === tab.value ? 600 : 400,
              color: activeTab === tab.value ? C.primary : C.textMuted,
              borderBottom: activeTab === tab.value ? `2px solid ${C.primary}` : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter */}
      {outlets.length > 1 && (
        <div style={{ padding: '12px 16px 0' }}>
          <Select
            value={outletFilter}
            onChange={v => setOutletFilter(v)}
            options={outlets}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, overflowX: 'hidden' }}>
        <div style={{ maxWidth: 540, margin: '0 auto' }}>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, fontFamily: 'Poppins', fontSize: 13, color: C.textMuted }}>Memuat...</div>
          ) : deposits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 500, color: C.n700 }}>
                Tidak ada setor {activeTab}
              </div>
            </div>
          ) : (
            deposits.map(d => (
              <div key={d.id} style={{ background: C.white, borderRadius: 14, padding: 16, boxShadow: SHADOW.sm, marginBottom: 12 }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>{rp(d.amount)}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.textMuted }}>
                      {d.cashierName} · {d.outletName}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.textMuted }}>{fmtDate(d.depositDate)}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.textMuted }}>{fmtTime(d.createdAt)}</div>
                  </div>
                </div>

                {/* Notes */}
                {d.notes && (
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, background: C.n50, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                    📝 {d.notes}
                  </div>
                )}

                {/* PIC Info */}
                {d.picName && (
                  <div style={{
                    background: `${C.primary}08`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    marginBottom: 10,
                    fontFamily: 'Poppins',
                    fontSize: 10,
                    color: C.primary,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    👤 PIC: <strong>{d.picName}</strong>
                  </div>
                )}

                {/* Proof photo */}
                {d.proofPhotoUrl && (
                  <div style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.n200}`, maxHeight: 200 }}>
                    <img src={d.proofPhotoUrl} alt="proof" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                  </div>
                )}

                {/* Rejection reason */}
                {d.status === 'rejected' && d.rejectionReason && (
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.danger, background: C.dangerBg, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                    ❌ Alasan: {d.rejectionReason}
                  </div>
                )}

                {/* Approved info */}
                {d.status === 'approved' && d.approvedByName && (
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.successDark, background: C.successBg, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                    ✅ Disetujui oleh {d.approvedByName} · {fmtDate(d.approvedAt)}
                  </div>
                )}

                {/* Action buttons (pending only) */}
                {d.status === 'pending' && (
                  <div style={{ marginTop: 12 }}>
                    {rejectingId === d.id ? (
                      <div>
                        <textarea
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Alasan penolakan (wajib diisi)"
                          rows={2}
                          style={{
                            width: '100%', boxSizing: 'border-box', borderRadius: 8,
                            border: `1.5px solid ${C.border}`, padding: 10,
                            fontFamily: 'Poppins', fontSize: 12, marginBottom: 8, resize: 'vertical',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Btn variant="outline" size="sm" style={{ flex: 1 }} onClick={() => { setRejectingId(null); setRejectReason(''); }}>Batal</Btn>
                          <Btn variant="primary" size="sm" style={{ flex: 1, background: C.danger }} onClick={() => handleReject(d.id)}>Konfirmasi Tolak</Btn>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Btn variant="outline" size="sm" style={{ flex: 1, color: C.danger, borderColor: C.danger }} onClick={() => setRejectingId(d.id)}>
                          ❌ Tolak
                        </Btn>
                        <Btn variant="primary" size="sm" style={{ flex: 1 }} onClick={() => handleApprove(d.id)}>
                          ✅ Approve
                        </Btn>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default SetorApprovalPage;
