import { useState, useEffect } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Select } from '../../components/ui';
import { alertError, alertSuccess, confirmAction } from '../../utils/alert';
import { exportToExcel } from '../../utils/excelExport';

export default function CashDepositApproval({ navigate, goBack }) {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [outletFilter, setOutletFilter] = useState('');
  const [outlets, setOutlets] = useState([]);

  const loadDeposits = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (outletFilter) params.outlet_id = outletFilter;
      
      const res = await axios.get('/api/cash-deposits', { params });
      setDeposits(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load deposits:', e);
      alertError('Gagal memuat data setoran kas');
    } finally {
      setLoading(false);
    }
  };

  const loadOutlets = async () => {
    try {
      const res = await axios.get('/api/outlets');
      setOutlets(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load outlets:', e);
    }
  };

  useEffect(() => {
    loadOutlets();
  }, []);

  useEffect(() => {
    loadDeposits();
  }, [statusFilter, outletFilter]);

  const handleApprove = async (deposit) => {
    const confirmed = await confirmAction({
      text: `Setujui setoran kas sebesar ${rp(deposit.deposit_amount)}?`,
    });
    if (!confirmed) return;

    try {
      await axios.patch(`/api/cash-deposits/${deposit.id}/approve`);
      alertSuccess('Setoran kas berhasil disetujui');
      loadDeposits();
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal menyetujui setoran kas');
    }
  };

  const handleReject = async (deposit) => {
    const reason = window.prompt('Alasan penolakan:');
    if (!reason?.trim()) return;

    const confirmed = await confirmAction({
      text: `Tolak setoran kas sebesar ${rp(deposit.deposit_amount)}?`,
    });
    if (!confirmed) return;

    try {
      await axios.patch(`/api/cash-deposits/${deposit.id}/reject`, {
        reject_reason: reason.trim(),
      });
      alertSuccess('Setoran kas berhasil ditolak');
      loadDeposits();
    } catch (e) {
      alertError(e?.response?.data?.message || 'Gagal menolak setoran kas');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: C.warningBg, color: C.warningDark, label: 'Menunggu' },
      approved: { bg: C.successBg, color: C.successDark, label: 'Disetujui' },
      rejected: { bg: C.dangerBg, color: C.dangerDark, label: 'Ditolak' },
    };
    const cfg = config[status] || config.pending;
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '4px 10px', background: cfg.bg }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      </div>
    );
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleExport = () => {
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'outlet_name', label: 'Outlet' },
      { key: 'cashier_name', label: 'Kasir' },
      { key: 'deposit_date', label: 'Tanggal Setoran' },
      { key: 'deposit_amount', label: 'Jumlah Setoran (Rp)', format: (v) => rp(v) },
      { key: 'cash_sales_total', label: 'Penjualan Tunai (Rp)', format: (v) => rp(v) },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Catatan' },
      { key: 'reject_reason', label: 'Alasan Penolakan' },
      { key: 'created_at', label: 'Dibuat Pada', format: (v) => v ? new Date(v).toLocaleString('id-ID') : '' },
      { key: 'approved_at', label: 'Disetujui Pada', format: (v) => v ? new Date(v).toLocaleString('id-ID') : '' },
      { key: 'approved_by_name', label: 'Disetujui Oleh' },
      { key: 'rejected_at', label: 'Ditolak Pada', format: (v) => v ? new Date(v).toLocaleString('id-ID') : '' },
      { key: 'rejected_by_name', label: 'Ditolak Oleh' },
    ];
    
    exportToExcel(deposits, 'laporan-setoran-kas', 'Setoran Kas', columns);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Setoran Kas" subtitle="Approval setoran kas dari outlet" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Filters */}
        <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Status</div>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'pending', label: 'Menunggu' },
                  { value: 'approved', label: 'Disetujui' },
                  { value: 'rejected', label: 'Ditolak' },
                  { value: '', label: 'Semua' },
                ]}
              />
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 4 }}>Outlet</div>
              <Select
                value={outletFilter}
                onChange={setOutletFilter}
                options={[
                  { value: '', label: 'Semua Outlet' },
                  ...outlets.map(o => ({ value: String(o.id), label: o.name })),
                ]}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="primary" onClick={handleExport} disabled={deposits.length === 0}>
              📥 Export Excel
            </Btn>
          </div>
        </div>

        {/* Deposits List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat...</span>
          </div>
        ) : deposits.length === 0 ? (
          <div style={{ background: C.white, borderRadius: 16, padding: 28, textAlign: 'center', boxShadow: SHADOW.md }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💵</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n800 }}>Belum ada setoran kas</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 4 }}>
              {statusFilter === 'pending' ? 'Tidak ada setoran yang menunggu approval' : 'Tidak ada data setoran'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deposits.map((dep) => (
              <div key={dep.id} style={{ background: C.white, borderRadius: 16, padding: 16, boxShadow: SHADOW.sm }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: C.n900 }}>{rp(dep.deposit_amount)}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 2 }}>
                      {dep.outlet_name} • {formatDate(dep.deposit_date)}
                    </div>
                  </div>
                  {getStatusBadge(dep.status)}
                </div>

                {/* Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: C.n50, borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n700, marginBottom: 2 }}>Penjualan Tunai</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>{rp(dep.cash_sales_total)}</div>
                  </div>
                  <div style={{ background: C.n50, borderRadius: 10, padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.n700, marginBottom: 2 }}>Kasir</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>{dep.cashier_name}</div>
                  </div>
                </div>

                {/* Notes */}
                {dep.notes && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 2 }}>Catatan</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n900, background: C.n50, borderRadius: 10, padding: '8px 10px' }}>{dep.notes}</div>
                  </div>
                )}

                {/* Reject Reason */}
                {dep.reject_reason && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.danger, marginBottom: 2 }}>Alasan Penolakan</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.danger, background: C.dangerBg, borderRadius: 10, padding: '8px 10px' }}>{dep.reject_reason}</div>
                  </div>
                )}

                {/* Proof Documents */}
                {dep.proof_documents && dep.proof_documents.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n700, marginBottom: 6 }}>Bukti Dokumen</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {dep.proof_documents.map((doc, i) => (
                        <img
                          key={i}
                          src={doc.url}
                          alt={doc.label}
                          style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: `1px solid ${C.n200}` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {dep.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <Btn variant="danger" fullWidth onClick={() => handleReject(dep)}>
                      Tolak
                    </Btn>
                    <Btn variant="success" fullWidth onClick={() => handleApprove(dep)}>
                      Setujui
                    </Btn>
                  </div>
                )}

                {/* Metadata */}
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 8 }}>
                  Dibuat: {new Date(dep.created_at).toLocaleString('id-ID')}
                  {dep.approved_at && ` • Disetujui: ${new Date(dep.approved_at).toLocaleString('id-ID')} (${dep.approved_by_name})`}
                  {dep.rejected_at && ` • Ditolak: ${new Date(dep.rejected_at).toLocaleString('id-ID')} (${dep.rejected_by_name})`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
