/**
 * AdjustmentListPage.jsx
 * Halaman daftar dan manajemen Transaction Adjustments
 * Untuk kasir dan admin
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { rp } from '../../utils/helpers';
import { C, SHADOW } from '../../utils/theme';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import {
  FilterBar,
  PageHeader,
  ListCard,
  EmptyState,
  StatCard,
} from '../../components/ui';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

const ADJUSTMENT_TYPE_LABELS = {
  price: 'Harga',
  quantity: 'Qty',
  discount: 'Diskon',
  cancel: 'Batal',
  payment: 'Pembayaran',
};

const ADJUSTMENT_TYPE_COLORS = {
  price: '#6366F1',
  quantity: '#F59E0B',
  discount: '#10B981',
  cancel: '#EF4444',
  payment: '#8B5CF6',
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: '#F59E0B', bg: '#FEF3C7', icon: Clock },
  approved: { label: 'Disetujui', color: '#10B981', bg: '#D1FAE5', icon: CheckCircle },
  rejected: { label: 'Ditolak', color: '#EF4444', bg: '#FEE2E2', icon: XCircle },
  rolled_back: { label: 'Di-Rollback', color: '#6B7280', bg: '#F3F4F6', icon: RotateCcw },
};

const ACTION_CONFIG = {
  charge: { label: 'Tambah', color: '#EF4444', icon: TrendingUp, prefix: '+' },
  refund: { label: 'Refund', color: '#10B981', icon: TrendingDown, prefix: '-' },
  none: { label: 'Netral', color: '#6B7280', icon: Minus, prefix: '' },
};

export default function AdjustmentListPage() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { width } = useWindowSize();
  const [searchParams] = useSearchParams();

  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalCharge: 0,
    totalRefund: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || 'all',
    type: searchParams.get('type') || 'all',
    dateFrom: searchParams.get('from') || '',
    dateTo: searchParams.get('to') || '',
    search: searchParams.get('q') || '',
  });

  const loadAdjustments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.type !== 'all') params.set('type', filters.type);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.search) params.set('transactionNo', filters.search);

      const res = await axios.get(`/api/adjustments?${params.toString()}`);
      setAdjustments(res.data.data || []);

      // Calculate summary from response
      if (res.data.summary) {
        setSummary({
          total: res.data.summary.total_adjustments || 0,
          pending: res.data.summary.pending_count || 0,
          approved: res.data.summary.approved_count || 0,
          rejected: res.data.summary.rejected_count || 0,
          totalCharge: res.data.summary.total_charge || 0,
          totalRefund: res.data.summary.total_refund || 0,
        });
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdjustments();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      status: 'all',
      type: 'all',
      dateFrom: '',
      dateTo: '',
      search: '',
    });
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const getActionConfig = (action) => ACTION_CONFIG[action] || ACTION_CONFIG.none;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)' }}>Manajemen</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'white' }}>
              Koreksi Nota
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: isMobile ? 36 : 40, height: isMobile ? 36 : 40, borderRadius: isMobile ? 10 : 12,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronRight size={isMobile ? 18 : 20} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
        gap: isMobile ? 4 : 6,
        padding: isMobile ? 6 : 8,
        overflowX: 'auto',
      }}>
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: isMobile ? 10 : 12,
          textAlign: 'center',
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>Pending</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#F59E0B' }}>{summary.pending}</div>
        </div>
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: isMobile ? 10 : 12,
          textAlign: 'center',
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>Disetujui</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#10B981' }}>{summary.approved}</div>
        </div>
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: isMobile ? 10 : 12,
          textAlign: 'center',
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>Ditolak</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#EF4444' }}>{summary.rejected}</div>
        </div>
      </div>

      {/* Financial Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: isMobile ? 6 : 8,
        padding: `0 ${isMobile ? 10 : 12}px ${isMobile ? 8 : 12}px`,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
          borderRadius: 12,
          padding: '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#991B1B', marginBottom: 4 }}>Total Tambahan</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
            {rp(summary.totalCharge)}
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
          borderRadius: 12,
          padding: '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#065F46', marginBottom: 4 }}>Total Refund</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#059669' }}>
            {rp(summary.totalRefund)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        margin: `0 ${isMobile ? 10 : 12}px ${isMobile ? 10 : 12}px`,
        borderRadius: 12,
        padding: isMobile ? 10 : 12,
        boxShadow: SHADOW.sm,
        overflowX: 'hidden',
      }}>
        {/* Search */}
        <div style={{ marginBottom: isMobile ? 8 : 12 }}>
          <input
            type="text"
            placeholder="Cari no nota..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            style={{
              width: '100%',
              minWidth: 0,
              height: isMobile ? 40 : 44,
              borderRadius: 10,
              border: '1.5px solid #E5E7EB',
              padding: '0 12px',
              fontSize: isMobile ? 12 : 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Filter Rows */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            style={{
              flex: '1 1 100px',
              minWidth: 0,
              width: isMobile ? 'calc(50% - 4px)' : 'auto',
              height: isMobile ? 36 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 11 : 12,
              background: 'white',
            }}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>

          <select
            value={filters.type}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            style={{
              flex: 1,
              minWidth: 100,
              width: isMobile ? 'calc(50% - 4px)' : 'auto',
              height: isMobile ? 36 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 11 : 12,
              background: 'white',
            }}
          >
            <option value="all">Semua Tipe</option>
            <option value="price">Harga</option>
            <option value="quantity">Quantity</option>
            <option value="discount">Diskon</option>
            <option value="payment">Pembayaran</option>
          </select>

          <button
            onClick={resetFilters}
            style={{
              width: isMobile ? '100%' : 'auto',
              height: isMobile ? 36 : 40,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              background: 'white',
              fontSize: isMobile ? 11 : 12,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        {/* Date Range */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            style={{
              flex: 1,
              minWidth: 120,
              width: isMobile ? 'calc(50% - 4px)' : 'auto',
              height: isMobile ? 36 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 11 : 12,
            }}
          />
          <span style={{ color: '#9CA3AF', display: 'flex', alignItems: 'center' }}>s/d</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            style={{
              flex: 1,
              minWidth: 120,
              width: isMobile ? 'calc(50% - 4px)' : 'auto',
              height: isMobile ? 36 : 40,
              borderRadius: 8,
              border: '1px solid #E5E7EB',
              padding: '0 8px',
              fontSize: isMobile ? 11 : 12,
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* List */}
        <div style={{ padding: '0 12px 80px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
              <div style={{ marginTop: 8, color: '#9CA3AF', fontSize: 12 }}>Memuat...</div>
            </div>
          ) : adjustments.length === 0 ? (
            <EmptyState
              type="transactions"
              title="Belum ada koreksi"
              description="Adjustment akan muncul setelah ada koreksi transaksi"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adjustments.map((adj, idx) => {
                const statusCfg = getStatusConfig(adj.status);
                const actionCfg = getActionConfig(adj.action);
                const StatusIcon = statusCfg.icon;
                const ActionIcon = actionCfg.icon;
                const typeColor = ADJUSTMENT_TYPE_COLORS[adj.type] || '#6B7280';

                return (
                  <div
                    key={adj.id}
                    onClick={() => navigate(`/adjustment/${adj.id}`)}
                    style={{
                      background: 'white',
                      borderRadius: 12,
                      padding: 14,
                      cursor: 'pointer',
                      boxShadow: SHADOW.sm,
                      borderLeft: `4px solid ${typeColor}`,
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
                          {adj.adjustment_no || `ADJ-${adj.id}`}
                        </div>
                        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                          {adj.transaction_no} - {adj.customer_name || 'Customer'}
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: statusCfg.bg,
                        fontSize: 11,
                        fontWeight: 600,
                        color: statusCfg.color,
                      }}>
                        <StatusIcon size={12} />
                        {statusCfg.label}
                      </div>
                    </div>

                    {/* Info Row */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <div style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: `${typeColor}15`,
                        fontSize: 11,
                        color: typeColor,
                        fontWeight: 600,
                      }}>
                        {ADJUSTMENT_TYPE_LABELS[adj.type] || adj.type}
                      </div>
                    </div>

                    {/* Values */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>
                        <span style={{ textDecoration: 'line-through' }}>{rp(adj.old_value)}</span>
                        {' -> '}
                        <span style={{ fontWeight: 600, color: '#1F2937' }}>{rp(adj.new_value)}</span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 14,
                        fontWeight: 700,
                        color: adj.difference >= 0 ? '#EF4444' : '#10B981',
                      }}>
                        <ActionIcon size={14} />
                        {adj.difference >= 0 ? '+' : ''}{rp(Math.abs(adj.difference))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#9CA3AF' }}>
                      <span>{adj.created_by_name || adj.pic_name || 'Unknown'}</span>
                      <span>{new Date(adj.created_at).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                );
              })}
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
    </div>
  );
}
