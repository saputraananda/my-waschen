// ─────────────────────────────────────────────────────────────────────────────
// RefundListPage.jsx — Daftar Request Refund
// Untuk Admin: Approve/Reject refund
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.n200}`, padding: '16px 20px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n900, margin: 0 }}>
              💰 Daftar Refund
            </h1>
            <p style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, margin: 0 }}>
              Approve/Reject request refund
            </p>
          </div>
          <Btn variant="secondary" size="sm" onClick={handleExport}>
            <Download size={14} style={{ marginRight: 6 }} />
            Export
          </Btn>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
          <div style={{ background: '#fff8e6', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: '#ba7517' }}>
              {stats.pending || 0}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#92400e' }}>Pending</div>
          </div>
          <div style={{ background: '#d1fae5', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: '#0f6e56' }}>
              {stats.approved || 0}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#065f46' }}>Disetujui</div>
          </div>
          <div style={{ background: '#fee2e2', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: '#dc2626' }}>
              {stats.rejected || 0}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#991b1b' }}>Ditolak</div>
          </div>
          <div style={{ background: '#f3e8ff', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: '#5B005F' }}>
              {rp(stats.totalAmount || 0)}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#581c87' }}>Total</div>
          </div>
        </div>

        {/* Filters */}
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
                border: `1px solid ${C.n200}`, borderRadius: 10, fontSize: 13,
                fontFamily: 'Poppins', outline: 'none',
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              height: 40, padding: '0 12px', border: `1px solid ${C.n200}`,
              borderRadius: 10, fontSize: 13, fontFamily: 'Poppins',
              background: '#fff', cursor: 'pointer',
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
              height: 40, padding: '0 12px', border: `1px solid ${C.n200}`,
              borderRadius: 10, fontSize: 13, fontFamily: 'Poppins',
            }}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{
              height: 40, padding: '0 12px', border: `1px solid ${C.n200}`,
              borderRadius: 10, fontSize: 13, fontFamily: 'Poppins',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: 16, overflowX: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.n500 }}>
            Memuat data...
          </div>
        ) : refunds.length === 0 ? (
          <EmptyState
            type="transactions"
            title="Tidak ada refund"
            subtitle="Belum ada request refund"
          />
        ) : (
          refunds.map((refund) => {
            const status = STATUS_CONFIG[refund.status] || STATUS_CONFIG.pending;
            const StatusIcon = status.icon;

            return (
              <div
                key={refund.id}
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 12,
                  boxShadow: SHADOW.sm,
                }}
              >
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
                    background: status.bg, color: status.color, fontSize: 11, fontWeight: 600
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
                  background: '#f8fafc', borderRadius: 8, padding: '8px 10px',
                  marginBottom: 12, fontSize: 12, color: C.n700
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
                    <Btn
                      variant="danger"
                      size="sm"
                      style={{ flex: 1 }}
                      onClick={() => {
                        const reason = prompt('Alasan penolakan:');
                        if (reason) handleReject(refund.id, reason);
                      }}
                    >
                      <XCircle size={14} style={{ marginRight: 4 }} />
                      Tolak
                    </Btn>
                    <Btn
                      variant="primary"
                      size="sm"
                      style={{ flex: 1 }}
                      onClick={() => {
                        const amount = prompt(' Jumlah disetujui (default sama):', refund.refund_amount);
                        handleApprove(refund.id, amount ? Number(amount) : undefined);
                      }}
                    >
                      <CheckCircle2 size={14} style={{ marginRight: 4 }} />
                      Setujui
                    </Btn>
                  </div>
                )}

                {refund.status === 'approved' && (
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => handleProcess(refund.id)}
                  >
                    <TrendingDown size={14} style={{ marginRight: 4 }} />
                    Proses Refund
                  </Btn>
                )}
              </div>
            );
          })
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <Btn
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </Btn>
            <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>
              {page} / {totalPages}
            </span>
            <Btn
              variant="secondary"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}
