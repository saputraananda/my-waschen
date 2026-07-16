// ─────────────────────────────────────────────────────────────────────────────
// RefundListPage.jsx — Daftar Request Refund Saya (Kasir)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp, formatDate } from '../../utils/helpers';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, EmptyState } from '../../components/ui';
import {
  Clock, CheckCircle2, XCircle, Download,
  Eye, ArrowUpDown
} from 'lucide-react';

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

export default function RefundListPage({ goBack }) {
  const { isMobile, isTablet } = useResponsive();
  const { width } = useWindowSize();
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
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [page, statusFilter]);

  const handleCancel = async (refundId) => {
    if (!confirm('Batalkan request refund ini?')) return;
    try {
      await axios.post(`/api/refunds/${refundId}/cancel`, { reason: 'Dibatalkan kasir' });
      fetchRefunds();
    } catch (err) {
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f7fa', overflow: 'hidden' }}>
      <TopBar title="Refund Saya" subtitle="Request refund Anda" onBack={goBack} />
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 12 : 16 }}>
        <h1 style={{ fontFamily: 'Poppins', fontSize: isMobile ? 16 : 18, fontWeight: 700, color: C.n900, margin: '0 0 4px' }}>
          📋 Refund Saya
        </h1>
        <p style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500, margin: 0 }}>
          Lihat status request refund Anda
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#fff8e6', borderRadius: 12, padding: isMobile ? 12 : 14, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#ba7517' }}>
            {stats.pending}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#92400e' }}>Menunggu</div>
        </div>
        <div style={{ background: '#f3e8ff', borderRadius: 12, padding: isMobile ? 12 : 14, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: '#5B005F' }}>
            {rp(stats.total)}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#581c87' }}>Total Refund</div>
        </div>
      </div>

      {/* Filter & Export */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            flex: '1 1 150px', minWidth: 0, height: 40, padding: '0 12px',
            border: `1px solid ${C.n200}`, borderRadius: 10,
            fontFamily: 'Poppins', fontSize: 13, cursor: 'pointer',
            maxWidth: '100%',
          }}
        >
          <option value="all">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="processed">Diproses</option>
        </select>
        <Btn variant="secondary" size="sm" onClick={handleExport}>
          <Download size={14} />
        </Btn>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.n500 }}>
          Memuat...
        </div>
      ) : refunds.length === 0 ? (
        <EmptyState
          type="transactions"
          title="Tidak ada refund"
          subtitle="Request refund Anda akan muncul di sini"
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
                padding: isMobile ? 12 : 16,
                marginBottom: 12,
                boxShadow: SHADOW.sm,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 14, fontWeight: 600, color: C.n900 }}>
                    {refund.refund_no}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n800 }}>
                    {refund.customer_name}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
                    {formatDate(refund.created_at)}
                  </div>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 14 : 16, fontWeight: 700, color: '#dc2626' }}>
                  -{rp(refund.refund_amount)}
                </div>
              </div>

              <div style={{
                background: '#f8fafc', borderRadius: 8, padding: '8px 10px',
                fontSize: 12, color: C.n700, marginBottom: 10
              }}>
                <span style={{ fontWeight: 600 }}>Alasan: </span>
                {REASON_LABELS[refund.reason] || refund.reason}
              </div>

              {refund.status === 'pending' && (
                <Btn
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCancel(refund.id)}
                >
                  Batalkan
                </Btn>
              )}
            </div>
          );
        })
      )}

      {/* Pagination */}
      {refunds.length >= perPage && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <Btn variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            ← Prev
          </Btn>
          <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'Poppins', fontSize: 13, color: C.n600 }}>
            {page}
          </span>
          <Btn variant="secondary" size="sm" onClick={() => setPage(p => p + 1)}>
            Next →
          </Btn>
        </div>
        )}
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
