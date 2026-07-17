// ─────────────────────────────────────────────────────────────────────────────
// RefundListPage.jsx — Daftar Request Refund
// Untuk Admin: Approve/Reject refund
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { C, T, SHADOW } from '../../utils/theme';
import { rp, formatDate, formatTime } from '../../utils/helpers';
import {
  Btn, Badge, useAppRefresh, StatCard,
  PageHeader, FilterBar, EmptyState
} from '../../components/ui';
import {
  Search, Filter, ChevronRight, CheckCircle2,
  XCircle, Clock, AlertTriangle, Download,
  Eye, ArrowUpDown, TrendingDown
} from 'lucide-react';
import { useResponsive } from '../../utils/hooks';
import { GlowOrb, Sparkle, FloatingBubble } from '../../components/ui/PremiumAnimations';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#ba7517', bg: '#fef3c7', icon: Clock },
  approved: { label: 'Disetujui', color: '#0f6e56', bg: '#d1fae5', icon: CheckCircle2 },
  rejected: { label: 'Ditolak', color: '#dc2626', bg: '#fee2e2', icon: XCircle },
  processed: { label: 'Diproses', color: '#5B005F', bg: '#f3e8ff', icon: CheckCircle2 },
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

// Premium card gradient
const cardGradient = 'linear-gradient(145deg, #FFFFFF, #F8F4FF)';
const cardShadow = '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)';
const headerGradient = 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)';

// Skeleton loading shimmer
const shimmerStyle = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
};

const SkeletonBlock = ({ height = 20, width = '100%', style = {} }) => (
  <div
    style={{
      height,
      width,
      borderRadius: 10,
      ...shimmerStyle,
      ...style,
    }}
  />
);

export default function RefundListPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch refunds
  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: perPage,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(search && { search }),
        ...(dateFrom && { from: dateFrom }),
        ...(dateTo && { to: dateTo }),
      });

      const [refundRes, statsRes] = await Promise.all([
        axios.get(`/api/refunds?${params}`),
        axios.get('/api/refunds/stats'),
      ]);

      setRefunds(refundRes.data.data || refundRes.data.refunds || []);
      setStats(statsRes.data.data || statsRes.data || {});

      if (refundRes.data.total) {
        setTotalPages(Math.ceil(refundRes.data.total / perPage));
      }
      setError(null);
    } catch (err) {
      setError('Gagal memuat data refund');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [page, statusFilter, search, dateFrom, dateTo]);

  // Handle approve
  const handleApprove = async (refundId, approvedAmount) => {
    try {
      await axios.post(`/api/refunds/${refundId}/approve`, { approvedAmount });
      fetchRefunds();
    } catch (err) {
      alert('Gagal menyetujui refund');
    }
  };

  // Handle reject
  const handleReject = async (refundId, reason) => {
    try {
      await axios.post(`/api/refunds/${refundId}/reject`, { reason });
      fetchRefunds();
    } catch (err) {
      alert('Gagal menolak refund');
    }
  };

  // Handle process (after approved)
  const handleProcess = async (refundId) => {
    try {
      await axios.post(`/api/refunds/${refundId}/process`);
      fetchRefunds();
    } catch (err) {
      alert('Gagal memproses refund');
    }
  };

  // Export
  const handleExport = () => {
    const csvContent = [
      ['No Refund', 'No Transaksi', 'Customer', 'Tanggal', 'Jumlah', 'Alasan', 'Status'].join(','),
      ...refunds.map(r => [
        r.refund_no,
        r.transaction_no,
        r.customer_name,
        formatDate(r.created_at),
        r.refund_amount,
        r.reason,
        r.status,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refund-${formatDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--glass-bg, #F3EEF7)', position: 'relative', overflow: 'hidden' }}>
      {/* Background decorative elements */}
      <GlowOrb color="#5B005F" size={300} top="-100px" right="-100px" opacity={0.08} />
      <GlowOrb color="#9B59B6" size={200} bottom="100px" left="-80px" opacity={0.06} />
      <FloatingBubble color="#5B005F" size={12} top="30%" left="5%" delay={0} />
      <FloatingBubble color="#9B59B6" size={8} top="50%" right="8%" delay={1} />
      <FloatingBubble color="#E8D5F0" size={16} bottom="20%" left="10%" delay={2} />

      {/* Premium Header */}
      <div style={{
        background: headerGradient,
        padding: '16px 20px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Header decorative elements */}
        <GlowOrb color="#FFFFFF" size={120} top="-40px" right="60px" opacity={0.12} />
        <Sparkle size={14} top="12px" right="100px" color="#FFD700" delay={0.5} />
        <Sparkle size={10} top="40px" left="140px" color="#FFFFFF" delay={1.2} />
        <FloatingBubble color="rgba(255,255,255,0.15)" size={20} top="10px" right="30%" delay={0.8} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, position: 'relative', zIndex: 1 }}>
          <div>
            <h1 style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
              💰 Daftar Refund
            </h1>
            <p style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
              Approve/Reject request refund
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 12,
              background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <Download size={14} />
            Export
          </motion.button>
        </div>

        {/* Premium Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, position: 'relative', zIndex: 1 }}>
          {[
            { key: 'pending', label: 'Pending', color: '#ba7517', bg: '#fef3c7', value: stats.pending || 0 },
            { key: 'approved', label: 'Disetujui', color: '#0f6e56', bg: '#d1fae5', value: stats.approved || 0 },
            { key: 'rejected', label: 'Ditolak', color: '#dc2626', bg: '#fee2e2', value: stats.rejected || 0 },
            { key: 'total', label: 'Total', color: '#FFFFFF', bg: 'rgba(255,255,255,0.25)', value: rp(stats.totalAmount || 0), textWhite: true },
          ].map((stat) => (
            <div
              key={stat.key}
              style={{
                background: cardGradient,
                borderRadius: 14,
                padding: '10px 12px',
                textAlign: 'center',
                boxShadow: '6px 6px 16px rgba(0,0,0,0.12), -3px -3px 8px rgba(255,255,255,0.3)',
              }}
            >
              <div style={{
                fontFamily: 'Poppins', fontSize: 18, fontWeight: 700,
                color: stat.textWhite ? '#FFFFFF' : stat.color,
                textShadow: stat.textWhite ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
                {stat.value}
              </div>
              <div style={{
                fontFamily: 'Poppins', fontSize: 10,
                color: stat.textWhite ? 'rgba(255,255,255,0.9)' : stat.color,
                opacity: stat.textWhite ? 0.9 : 1,
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(110, 46, 120, 0.1)',
        padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.n400 }} />
            <input
              type="text"
              placeholder="Cari no nota, customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', height: 40, paddingLeft: 38, paddingRight: 12,
                border: '1.5px solid rgba(110, 46, 120, 0.15)',
                borderRadius: 12, fontSize: 13, fontFamily: 'Poppins', outline: 'none',
                background: 'rgba(255,255,255,0.9)',
                boxShadow: 'inset 0 2px 4px rgba(110, 46, 120, 0.05)',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = C.primary}
              onBlur={(e) => e.target.style.borderColor = 'rgba(110, 46, 120, 0.15)'}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: 40, padding: '0 12px',
              border: '1.5px solid rgba(110, 46, 120, 0.15)',
              borderRadius: 12, fontSize: 13, fontFamily: 'Poppins',
              background: 'rgba(255,255,255,0.9)', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(110, 46, 120, 0.08)',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="processed">Diproses</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{
              height: 40, padding: '0 12px',
              border: '1.5px solid rgba(110, 46, 120, 0.15)',
              borderRadius: 12, fontSize: 13, fontFamily: 'Poppins',
              background: 'rgba(255,255,255,0.9)',
            }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              height: 40, padding: '0 12px',
              border: '1.5px solid rgba(110, 46, 120, 0.15)',
              borderRadius: 12, fontSize: 13, fontFamily: 'Poppins',
              background: 'rgba(255,255,255,0.9)',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: 16, overflowX: 'hidden' }}>
        {loading ? (
          // Premium Skeleton Loading
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: cardGradient,
                  borderRadius: 18,
                  padding: 16,
                  boxShadow: cardShadow,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <SkeletonBlock height={16} width={120} style={{ marginBottom: 6 }} />
                    <SkeletonBlock height={12} width={80} />
                  </div>
                  <SkeletonBlock height={24} width={80} style={{ borderRadius: 20 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <SkeletonBlock height={14} width={100} style={{ marginBottom: 6 }} />
                    <SkeletonBlock height={12} width={140} />
                  </div>
                  <SkeletonBlock height={20} width={80} />
                </div>
                <SkeletonBlock height={40} />
              </div>
            ))}
          </div>
        ) : refunds.length === 0 ? (
          <EmptyState
            type="transactions"
            title="Tidak ada refund"
            subtitle="Belum ada request refund"
          />
        ) : (
          refunds.map((refund, idx) => {
            const status = STATUS_CONFIG[refund.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={refund.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                style={{
                  background: cardGradient,
                  borderRadius: 18,
                  padding: 16,
                  marginBottom: 12,
                  boxShadow: cardShadow,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Subtle inner glow */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: `linear-gradient(90deg, ${status.color}20, transparent)`,
                }} />

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>
                      {refund.refund_no}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                      {refund.transaction_no}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 20,
                    background: status.bg, color: status.color, fontSize: 11, fontWeight: 600,
                    boxShadow: `0 2px 8px ${status.color}25`,
                  }}>
                    <StatusIcon size={12} />
                    {status.label}
                  </div>
                </div>

                {/* Customer & Amount */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 500, color: C.n800 }}>
                      {refund.customer_name || 'Customer'}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>
                      {formatDate(refund.created_at)} • {refund.outlet_name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
                      -{rp(refund.refund_amount)}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                      dari {rp(refund.transaction_total)}
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div style={{
                  background: 'rgba(248, 250, 252, 0.8)', borderRadius: 10, padding: '8px 12px',
                  marginBottom: 12, fontSize: 12, color: C.n700,
                  border: '1px solid rgba(110, 46, 120, 0.06)',
                }}>
                  <span style={{ fontWeight: 600 }}>Alasan: </span>
                  {REASON_LABELS[refund.reason] || refund.reason}
                  {refund.reason_detail && (
                    <span style={{ color: C.n500 }}> - {refund.reason_detail}</span>
                  )}
                </div>

                {/* Actions */}
                {refund.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const reason = prompt('Alasan penolakan:');
                        if (reason) handleReject(refund.id, reason);
                      }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '8px 12px', borderRadius: 10,
                        background: '#fee2e2', border: '1px solid #fecaca',
                        fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                        color: '#dc2626', cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(220, 38, 38, 0.15)',
                      }}
                    >
                      <XCircle size={14} />
                      Tolak
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        const amount = prompt(' Jumlah disetujui (default sama):', refund.refund_amount);
                        handleApprove(refund.id, amount ? Number(amount) : undefined);
                      }}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '8px 12px', borderRadius: 10,
                        background: 'linear-gradient(135deg, #5B005F, #4D0051)',
                        border: 'none',
                        fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                        color: '#FFFFFF', cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(91, 0, 95, 0.3)',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      Setujui
                    </motion.button>
                  </div>
                )}

                {refund.status === 'approved' && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleProcess(refund.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      padding: '8px 12px', borderRadius: 10, width: '100%',
                      background: 'linear-gradient(135deg, #5B005F, #4D0051)',
                      border: 'none',
                      fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                      color: '#FFFFFF', cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(91, 0, 95, 0.3)',
                    }}
                  >
                    <TrendingDown size={14} />
                    Proses Refund
                  </motion.button>
                )}
              </motion.div>
            );
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.9)',
                border: '1.5px solid rgba(110, 46, 120, 0.2)',
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                color: page === 1 ? C.n400 : C.primary,
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.5 : 1,
                boxShadow: '0 2px 8px rgba(110, 46, 120, 0.08)',
              }}
            >
              ← Prev
            </motion.button>
            <div style={{
              display: 'flex', alignItems: 'center',
              fontFamily: 'Poppins', fontSize: 13, color: C.n600,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 10,
              boxShadow: '0 2px 8px rgba(110, 46, 120, 0.08)',
            }}>
              {page} / {totalPages}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 10,
                background: 'linear-gradient(135deg, #5B005F, #4D0051)',
                border: 'none',
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                color: '#FFFFFF', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.5 : 1,
                boxShadow: '0 4px 12px rgba(91, 0, 95, 0.25)',
              }}
            >
              Next →
            </motion.button>
          </div>
        )}
      </div>

      {/* Shimmer animation keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
