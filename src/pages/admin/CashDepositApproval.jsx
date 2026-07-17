import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Select } from '../../components/ui';
import { alertError, alertSuccess, confirmAction } from '../../utils/alert';
import { exportToExcel } from '../../utils/excelExport';
import { useResponsive } from '../../utils/hooks';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

const cardStyle = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

const shimmerKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export default function CashDepositApproval({ navigate, goBack }) {
  const { isMobile } = useResponsive();
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
      pending: { bg: '#FFF3E0', color: '#E65100', label: 'Menunggu' },
      approved: { bg: '#E8F5E9', color: '#2E7D32', label: 'Disetujui' },
      rejected: { bg: '#FFEBEE', color: '#D32F2F', label: 'Ditolak' },
    };
    const cfg = config[status] || config.pending;
    return (
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '4px 10px', background: cfg.bg }}
      >
        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      </motion.div>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{shimmerKeyframes}</style>

      {/* Premium Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 8,
        paddingBottom: 16,
      }}>
        <GlowOrb color="#E040FB" size={120} opacity={0.15} top="-20px" right="-20px" />
        <GlowOrb color="#FF6D00" size={80} opacity={0.1} bottom="-10px" left="20%" />
        <FloatingBubble src={bubbleIcon} size={28} top="12px" right="60px" />
        <FloatingBubble src={bubble2Icon} size={22} top="28px" right="20px" delay={0.5} />
        <Sparkle color="#FFD700" size={16} top="8px" left="40%" delay={0.2} />
        <Sparkle color="#FFFFFF" size={12} top="32px" left="25%" delay={0.8} />

        <TopBar title="Setoran Kas" subtitle="Approval setoran kas dari outlet" onBack={goBack} isPremium />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, overflowX: 'hidden' }}>
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ ...cardStyle, padding: isMobile ? 12 : 16, marginBottom: 16 }}
        >
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: isMobile ? '100%' : 150 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 4 }}>Status</div>
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
            <div style={{ flex: 1, minWidth: isMobile ? '100%' : 150 }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 4 }}>Outlet</div>
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
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleExport}
              disabled={deposits.length === 0}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: 'none',
                background: deposits.length === 0 ? '#E0E0E0' : 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontSize: 13,
                fontWeight: 600,
                cursor: deposits.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              📥 Export Excel
            </motion.button>
          </div>
        </motion.div>

        {/* Deposits List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                style={{
                  ...cardStyle,
                  padding: 16,
                  background: `linear-gradient(90deg, #F0E6F5 25%, #FFFFFF 50%, #F0E6F5 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ width: 120, height: 22, background: '#E8DDF0', borderRadius: 6, marginBottom: 6 }} />
                    <div style={{ width: 160, height: 14, background: '#EDE4F0', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 70, height: 24, background: '#EDE4F0', borderRadius: 12 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ height: 60, background: '#F5F0FA', borderRadius: 10 }} />
                  <div style={{ height: 60, background: '#F5F0FA', borderRadius: 10 }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, height: 36, background: '#EDE4F0', borderRadius: 10 }} />
                  <div style={{ flex: 1, height: 36, background: '#EDE4F0', borderRadius: 10 }} />
                </div>
              </motion.div>
            ))}
          </div>
        ) : deposits.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ ...cardStyle, padding: 28, textAlign: 'center' }}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>💵</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: '#5B005F' }}>Belum ada setoran kas</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#9E9E9E', marginTop: 4 }}>
              {statusFilter === 'pending' ? 'Tidak ada setoran yang menunggu approval' : 'Tidak ada data setoran'}
            </div>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {deposits.map((dep, idx) => (
                <motion.div
                  key={dep.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04 }}
                  style={{ ...cardStyle, padding: 16 }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#1A1A1A' }}>{rp(dep.deposit_amount)}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#5B005F', marginTop: 2 }}>
                        {dep.outlet_name} • {formatDate(dep.deposit_date)}
                      </div>
                    </div>
                    {getStatusBadge(dep.status)}
                  </div>

                  {/* Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div style={{ background: '#F3EEF7', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: '#5B005F', marginBottom: 2 }}>Penjualan Tunai</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{rp(dep.cash_sales_total)}</div>
                    </div>
                    <div style={{ background: '#F3EEF7', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: '#5B005F', marginBottom: 2 }}>Kasir</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{dep.cashier_name}</div>
                    </div>
                  </div>

                  {/* Notes */}
                  {dep.notes && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 2 }}>Catatan</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#1A1A1A', background: '#F3EEF7', borderRadius: 10, padding: '8px 10px' }}>{dep.notes}</div>
                    </div>
                  )}

                  {/* Reject Reason */}
                  {dep.reject_reason && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#D32F2F', marginBottom: 2 }}>Alasan Penolakan</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#D32F2F', background: '#FFEBEE', borderRadius: 10, padding: '8px 10px' }}>{dep.reject_reason}</div>
                    </div>
                  )}

                  {/* Proof Documents */}
                  {dep.proof_documents && dep.proof_documents.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 6 }}>Bukti Dokumen</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {dep.proof_documents.map((doc, i) => (
                          <img
                            key={i}
                            src={doc.url}
                            alt={doc.label}
                            style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover', border: '1px solid #E8DDF0' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {dep.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleReject(dep)}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 12,
                          border: '1.5px solid #D32F2F', background: '#FFFFFF',
                          fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                          color: '#D32F2F', cursor: 'pointer',
                        }}
                      >
                        Tolak
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleApprove(dep)}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 12,
                          border: 'none',
                          background: 'linear-gradient(135deg, #2E7D32 0%, #388E3C 100%)',
                          fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                          color: '#FFFFFF', cursor: 'pointer',
                        }}
                      >
                        Setujui
                      </motion.button>
                    </div>
                  )}

                  {/* Metadata */}
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#9E9E9E', marginTop: 8 }}>
                    Dibuat: {new Date(dep.created_at).toLocaleString('id-ID')}
                    {dep.approved_at && ` • Disetujui: ${new Date(dep.approved_at).toLocaleString('id-ID')} (${dep.approved_by_name})`}
                    {dep.rejected_at && ` • Ditolak: ${new Date(dep.rejected_at).toLocaleString('id-ID')} (${dep.rejected_by_name})`}
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
