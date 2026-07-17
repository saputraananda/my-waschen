// ─────────────────────────────────────────────────────────────────────────────
// RefundListPage.jsx — Daftar Request Refund Saya (Kasir)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp, formatDate } from '../../utils/helpers';
import { useResponsive } from '../../utils/hooks';
import { TopBar, Btn, EmptyState } from '../../components/ui';
import { Clock, CheckCircle2, XCircle, Download } from 'lucide-react';

// ─── Clay Card ────────────────────────────────────────────────────────────────
const ClayCard = ({ children, style, padding = 16 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
      borderRadius: 20,
      padding: padding,
      boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
      ...style,
    }}
  >
    {children}
  </motion.div>
);

// ─── Glass Styles ─────────────────────────────────────────────────────────────
const useGlassStyles = () => {
  useEffect(() => {
    const styleId = 'refund-list-glass';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        :root { --glass-bg: #F3EEF7; }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
};

// ─── Status Config ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: { label: 'Pending', color: C.warning, bg: C.warning + '15', icon: Clock },
  approved: { label: 'Disetujui', color: C.success, bg: C.success + '15', icon: CheckCircle2 },
  rejected: { label: 'Ditolak', color: C.danger, bg: C.danger + '10', icon: XCircle },
  processed: { label: 'Diproses', color: C.primary, bg: C.primary + '10', icon: CheckCircle2 },
};

const REASON_LABELS = {
  customer_request: 'Permintaan Customer',
  produk_rusak: 'Produk Rusak/Cacat',
  salah_layanan: 'Salah Layanan',
  tidak_sesuai: 'Tidak Sesuai Pesanan',
  batal_order: 'Batal Order',
  kompensasi: 'Kompensasi',
  lainnya: 'Lainnya',
};

export default function RefundListPage({ goBack }) {
  useGlassStyles();
  const { isMobile } = useResponsive();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, total: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: perPage,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      const [listRes, statsRes] = await Promise.all([
        axios.get(`/api/refunds?${params}`),
        axios.get('/api/refunds/stats'),
      ]);

      setRefunds(listRes.data.data || listRes.data.refunds || []);
      setStats({
        pending: statsRes.data.pending || 0,
        total: statsRes.data.totalAmount || 0,
      });
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRefunds(); }, [page, statusFilter]);

  const handleCancel = async (refundId) => {
    if (!confirm('Batalkan request refund ini?')) return;
    try {
      await axios.post(`/api/refunds/${refundId}/cancel`, { reason: 'Dibatalkan kasir' });
      fetchRefunds();
    } catch {
      alert('Gagal membatalkan refund');
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['No Refund', 'No Transaksi', 'Customer', 'Tanggal', 'Jumlah', 'Status'].join(','),
      ...refunds.map(r => [
        r.refund_no,
        r.transaction_no,
        r.customer_name,
        formatDate(r.created_at),
        r.refund_amount,
        r.status,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refund-saya-${formatDate(new Date())}.csv`;
    a.click();
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg, #F3EEF7)',
      overflow: 'hidden',
    }}>
      <TopBar title="Refund Saya" subtitle="Request refund Anda" onBack={goBack} />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? 12 : 16,
        paddingBottom: isMobile ? 100 : 16,
      }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <ClayCard padding={14} style={{ textAlign: 'center', background: C.warning + '10', border: `1px solid ${C.warning}20` }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 24, fontWeight: 800, color: C.warning }}>
              {stats.pending}
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.warning, marginTop: 2 }}>
              Menunggu
            </div>
          </ClayCard>
          <ClayCard padding={14} style={{ textAlign: 'center', background: C.primary + '08', border: `1px solid ${C.primary}20` }}>
            <div style={{ fontFamily: "'Poppins'", fontSize: 20, fontWeight: 800, color: C.primary }}>
              {rp(stats.total)}
            </div>
            <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.primary, marginTop: 2 }}>
              Total Refund
            </div>
          </ClayCard>
        </div>

        {/* Filter & Export */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              flex: 1,
              height: 44,
              padding: '0 14px',
              border: `1.5px solid ${C.n200}`,
              borderRadius: 12,
              fontFamily: "'Poppins'",
              fontSize: 13,
              color: C.n900,
              background: C.white,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="processed">Diproses</option>
          </select>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            style={{
              height: 44,
              padding: '0 16px',
              borderRadius: 12,
              border: `1.5px solid ${C.n200}`,
              background: C.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Download size={18} color={C.n600} />
          </motion.button>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, fontFamily: "'Poppins'", fontSize: 13, color: C.n500 }}>
            Memuat...
          </div>
        ) : refunds.length === 0 ? (
          <EmptyState
            type="transactions"
            title="Tidak ada refund"
            subtitle="Request refund Anda akan muncul di sini"
          />
        ) : (
          refunds.map((refund, idx) => {
            const status = STATUS_CONFIG[refund.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={refund.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                style={{ marginBottom: 12 }}
              >
                <ClayCard padding={16}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "'Poppins'", fontSize: 13, fontWeight: 600, color: C.n900 }}>
                        {refund.refund_no}
                      </div>
                      <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500, marginTop: 2 }}>
                        {refund.transaction_no}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: status.bg,
                    }}>
                      <StatusIcon size={12} color={status.color} />
                      <span style={{ fontFamily: "'Poppins'", fontSize: 11, fontWeight: 600, color: status.color }}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "'Poppins'", fontSize: 13, color: C.n800 }}>
                        {refund.customer_name}
                      </div>
                      <div style={{ fontFamily: "'Poppins'", fontSize: 11, color: C.n500, marginTop: 2 }}>
                        {formatDate(refund.created_at)}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Poppins'", fontSize: 16, fontWeight: 700, color: C.danger }}>
                      -{rp(refund.refund_amount)}
                    </div>
                  </div>

                  <div style={{
                    background: C.n50,
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontFamily: "'Poppins'",
                    fontSize: 12,
                    color: C.n700,
                    marginBottom: 12,
                  }}>
                    <span style={{ fontWeight: 600 }}>Alasan: </span>
                    {REASON_LABELS[refund.reason] || refund.reason}
                  </div>

                  {refund.status === 'pending' && (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleCancel(refund.id)}
                      style={{
                        width: '100%',
                        height: 40,
                        borderRadius: 12,
                        border: `1.5px solid ${C.n200}`,
                        background: C.white,
                        fontFamily: "'Poppins'",
                        fontSize: 13,
                        fontWeight: 600,
                        color: C.n600,
                        cursor: 'pointer',
                      }}
                    >
                      Batalkan
                    </motion.button>
                  )}
                </ClayCard>
              </motion.div>
            );
          })
        )}

        {/* Pagination */}
        {refunds.length >= perPage && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                background: C.white,
                fontFamily: "'Poppins'",
                fontSize: 13,
                fontWeight: 600,
                color: page === 1 ? C.n300 : C.n700,
                cursor: page === 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Prev
            </motion.button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              fontFamily: "'Poppins'",
              fontSize: 13,
              color: C.n600,
              padding: '0 8px',
            }}>
              {page}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '8px 16px',
                borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                background: C.white,
                fontFamily: "'Poppins'",
                fontSize: 13,
                fontWeight: 600,
                color: C.n700,
                cursor: 'pointer',
              }}
            >
              Next →
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
