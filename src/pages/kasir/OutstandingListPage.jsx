/**
 * OutstandingListPage.jsx
 * Halaman daftar Piutang / Outstanding Receivables
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { rp, buildWaMeLink } from '../../utils/helpers';
import { C, SHADOW } from '../../utils/theme';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import {
  PageHeader,
  EmptyState,
} from '../../components/ui';
import {
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  MessageCircle,
  Phone,
  Plus,
} from 'lucide-react';

const STATUS_CONFIG = {
  unpaid: { label: 'Belum Bayar', color: '#EF4444', bg: '#FEE2E2', icon: Clock },
  partial: { label: 'Sebagian', color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle },
  paid: { label: 'Lunas', color: '#10B981', bg: '#D1FAE5', icon: CheckCircle },
  overdue: { label: 'Jatuh Tempo', color: '#DC2626', bg: '#FEE2E2', icon: AlertCircle },
  written_off: { label: 'Write-Off', color: '#6B7280', bg: '#F3F4F6', icon: Clock },
};

export default function OutstandingListPage() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { width } = useWindowSize();

  const [outstandings, setOutstandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_count: 0,
    total_amount: 0,
    total_remaining: 0,
    total_paid: 0,
    unpaid_count: 0,
    partial_count: 0,
    overdue_count: 0,
    paid_count: 0,
  });

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const [showFilter, setShowFilter] = useState(false);

  const loadOutstandings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const res = await axios.get(`/api/outstandings?${params.toString()}`);
      setOutstandings(res.data.data || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (error) {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOutstandings();
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ status: 'all', search: '', dateFrom: '', dateTo: '' });
  };

  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.unpaid;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8F4FF', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #065F46 0%, #047857 100%)',
        padding: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)' }}>Manajemen</div>
            <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 700, color: 'white' }}>
              Piutang Pelanggan
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
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: isMobile ? 6 : 8,
        padding: isMobile ? 8 : 12,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #FEE2E2, #FECACA)',
          borderRadius: 12,
          padding: isMobile ? 10 : '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#991B1B', marginBottom: 4 }}>Total Piutang</div>
          <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: '#DC2626' }}>
            {rp(summary.total_remaining || 0)}
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)',
          borderRadius: 12,
          padding: isMobile ? 10 : '12px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#065F46', marginBottom: 4 }}>Sudah Bayar</div>
          <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: '#059669' }}>
            {rp(summary.total_paid || 0)}
          </div>
        </div>
      </div>

      {/* Status Counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: isMobile ? 6 : 8,
        padding: `0 ${isMobile ? 10 : 12}px ${isMobile ? 8 : 12}px`,
      }}>
        <div style={{
          background: C.white,
          borderRadius: 12,
          padding: isMobile ? 10 : '12px',
          textAlign: 'center',
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>Belum Bayar</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#EF4444' }}>{summary.unpaid_count || 0}</div>
        </div>
        <div style={{
          background: C.white,
          borderRadius: 12,
          padding: isMobile ? 10 : '12px',
          textAlign: 'center',
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>Sebagian</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#F59E0B' }}>{summary.partial_count || 0}</div>
        </div>
        <div style={{
          background: C.white,
          borderRadius: 12,
          padding: isMobile ? 10 : '12px',
          textAlign: 'center',
          boxShadow: SHADOW.sm,
        }}>
          <div style={{ fontSize: isMobile ? 9 : 10, color: '#6B7280', marginBottom: 4 }}>Jatuh Tempo</div>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#DC2626' }}>{summary.overdue_count || 0}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div style={{
        background: C.white,
        margin: `0 ${isMobile ? 10 : 12}px ${isMobile ? 8 : 12}px`,
        borderRadius: 12,
        padding: isMobile ? 10 : 12,
        boxShadow: SHADOW.sm,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              type="text"
              placeholder="Cari nama, no invoice..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={{
                width: '100%',
                minWidth: 0,
                height: isMobile ? 40 : 44,
                borderRadius: 10,
                border: '1.5px solid #E5E7EB',
                padding: '0 12px 0 36px',
                fontSize: isMobile ? 12 : 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            style={{
              width: isMobile ? 40 : 44, height: isMobile ? 40 : 44,
              borderRadius: 10,
              border: showFilter ? '2px solid #059669' : '1.5px solid #E5E7EB',
              background: showFilter ? '#F0FDF4' : 'white',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Filter size={18} color={showFilter ? '#059669' : '#6B7280'} />
          </button>
        </div>

        {showFilter && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{
                flex: 1,
                minWidth: 120,
                height: isMobile ? 36 : 40,
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                padding: '0 8px',
                fontSize: isMobile ? 11 : 12,
                background: C.white,
              }}
            >
              <option value="all">Semua Status</option>
              <option value="unpaid">Belum Bayar</option>
              <option value="partial">Sebagian</option>
              <option value="paid">Lunas</option>
              <option value="overdue">Jatuh Tempo</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              style={{
                flex: 1,
                minWidth: 100,
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
                minWidth: 100,
                height: isMobile ? 36 : 40,
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                padding: '0 8px',
                fontSize: isMobile ? 11 : 12,
              }}
            />

            <button
              onClick={resetFilters}
              style={{
                width: isMobile ? '100%' : 'auto',
                height: isMobile ? 36 : 40,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: C.white,
                fontSize: isMobile ? 11 : 12,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* List */}
      <div style={{ padding: '0 12px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#9CA3AF' }} />
            <div style={{ marginTop: 8, color: '#9CA3AF', fontSize: 12 }}>Memuat...</div>
          </div>
        ) : outstandings.length === 0 ? (
          <EmptyState
            type="transactions"
            title="Belum ada piutang"
            description="Piutang pelanggan akan muncul di sini"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {outstandings.map((item) => {
              const statusCfg = getStatusConfig(item.status);
              const StatusIcon = statusCfg.icon;
              const remaining = parseFloat(item.remaining_amount || 0);
              const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'paid';

              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`outstanding_detail`, { state: { outstanding: item } })}
                  style={{
                    background: C.white,
                    borderRadius: 12,
                    padding: 14,
                    cursor: 'pointer',
                    boxShadow: SHADOW.sm,
                    borderLeft: `4px solid ${statusCfg.color}`,
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1F2937' }}>
                        {item.principal_name || item.customer_name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        {item.invoice_no}
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
                      {isOverdue ? 'Jatuh Tempo' : statusCfg.label}
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>Sisa Bayar</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: remaining > 0 ? '#DC2626' : '#10B981' }}>
                        {rp(remaining)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#9CA3AF' }}>Total</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#6B7280' }}>
                        {rp(item.amount)}
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  {item.status !== 'paid' && item.paid_amount > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>
                        <span>Progress</span>
                        <span>{Math.round((item.paid_amount / item.amount) * 100)}%</span>
                      </div>
                      <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, (item.paid_amount / item.amount) * 100)}%`,
                          height: '100%',
                          background: '#10B981',
                          borderRadius: 3,
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {item.due_date && (
                        <span style={{ color: isOverdue ? '#DC2626' : '#9CA3AF' }}>
                          Jatuh tempo: {new Date(item.due_date).toLocaleDateString('id-ID')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {item.phone && (
                        <a href={buildWaMeLink(item.phone) || '#'} target="_blank" rel="noopener noreferrer">
                          <button style={{
                            width: 32, height: 32,
                            borderRadius: 8,
                            background: '#25D366',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <MessageCircle size={16} color="white" />
                          </button>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      </div>

      {/* FAB - Add New */}
      <button
        onClick={() => navigate('create_outstanding')}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'linear-gradient(135deg, #065F46, #047857)',
          border: 'none',
          boxShadow: '0 4px 12px rgba(6, 95, 70, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={24} color="white" />
      </button>
    </div>
    </div>
  );
}
