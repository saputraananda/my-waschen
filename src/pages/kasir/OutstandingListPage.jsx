/**
 * OutstandingListPage.jsx
 * Halaman daftar Piutang / Outstanding Receivables
 * Design System v3.0 - CSS Variables compliant
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { rp, buildWaMeLink } from '../../utils/helpers';
import { C, SHADOW } from '../../utils/theme';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import {
  TopBar,
  EmptyState,
} from '../../components/ui';
import {
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Clock,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Plus,
} from 'lucide-react';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Status Configuration ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  unpaid: {
    label: 'Belum Bayar',
    color: C.danger,
    bg: C.dangerBg,
    icon: Clock,
  },
  partial: {
    label: 'Sebagian',
    color: C.warning,
    bg: C.warningBg,
    icon: AlertCircle,
  },
  paid: {
    label: 'Lunas',
    color: C.success,
    bg: C.successBg,
    icon: CheckCircle,
  },
  overdue: {
    label: 'Jatuh Tempo',
    color: C.danger,
    bg: C.dangerBg,
    icon: AlertCircle,
  },
  written_off: {
    label: 'Write-Off',
    color: C.n500,
    bg: C.n100,
    icon: Clock,
  },
};

// ─── Glass Styles ──────────────────────────────────────────────────────────────
const GLASS_STYLES = `
  :root {
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
    --piutang-primary: #065F46;
    --piutang-success: #059669;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

function useGlassStyles() {
  useEffect(() => {
    const styleId = 'outstanding-list-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLASS_STYLES;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      boxShadow: SHADOW.sm,
    }}>
      <div style={{
        height: 16,
        borderRadius: 8,
        background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        marginBottom: 12,
        width: '60%',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ width: '35%' }}>
          <div style={{
            height: 12,
            borderRadius: 6,
            background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            marginBottom: 8,
          }} />
          <div style={{
            height: 24,
            borderRadius: 8,
            background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }} />
        </div>
        <div style={{ width: '30%' }}>
          <div style={{
            height: 12,
            borderRadius: 6,
            background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            marginBottom: 8,
          }} />
          <div style={{
            height: 24,
            borderRadius: 8,
            background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }} />
        </div>
      </div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

// ─── Summary Card Component ────────────────────────────────────────────────────
function SummaryCard({ title, value, color, bgGradient }) {
  return (
    <div style={{
      background: bgGradient,
      borderRadius: 16,
      padding: '14px 16px',
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: FONT,
        fontSize: 10,
        fontWeight: 600,
        color: color,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: FONT,
        fontSize: 16,
        fontWeight: 700,
        color: color,
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Counter Card Component ────────────────────────────────────────────────────
function CounterCard({ title, value, color }) {
  return (
    <div style={{
      background: C.white,
      borderRadius: 16,
      padding: '14px 12px',
      textAlign: 'center',
      boxShadow: SHADOW.sm,
    }}>
      <div style={{
        fontFamily: FONT,
        fontSize: 10,
        fontWeight: 600,
        color: C.n500,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: FONT,
        fontSize: 20,
        fontWeight: 700,
        color: color,
      }}>
        {value || 0}
      </div>
    </div>
  );
}

// ─── Outstanding Card Component ────────────────────────────────────────────────
function OutstandingCard({ item, onClick, index }) {
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.unpaid;
  const StatusIcon = statusCfg.icon;
  const remaining = parseFloat(item.remaining_amount || 0);
  const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status !== 'paid';
  const progressPct = item.amount > 0 ? Math.round((item.paid_amount / item.amount) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      style={{
        background: C.white,
        borderRadius: 16,
        padding: '16px',
        cursor: 'pointer',
        boxShadow: SHADOW.sm,
        borderLeft: `4px solid ${isOverdue ? C.danger : statusCfg.color}`,
        marginBottom: 12,
      }}
    >
      {/* Header Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            color: C.n900,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {item.principal_name || item.customer_name}
          </div>
          <div style={{
            fontFamily: FONT,
            fontSize: 11,
            color: C.n500,
            marginTop: 2,
          }}>
            {item.invoice_no}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 12px',
          borderRadius: 20,
          background: isOverdue ? C.dangerBg : statusCfg.bg,
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          color: isOverdue ? C.danger : statusCfg.color,
          marginLeft: 12,
        }}>
          <StatusIcon size={12} />
          {isOverdue ? 'Jatuh Tempo' : statusCfg.label}
        </div>
      </div>

      {/* Amount Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: item.status !== 'paid' && item.paid_amount > 0 ? 12 : 0,
      }}>
        <div>
          <div style={{
            fontFamily: FONT,
            fontSize: 9,
            fontWeight: 600,
            color: C.n400,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            marginBottom: 3,
          }}>
            Sisa Bayar
          </div>
          <div style={{
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 800,
            color: remaining > 0 ? C.danger : C.success,
            lineHeight: 1.1,
          }}>
            {rp(remaining)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: FONT,
            fontSize: 9,
            fontWeight: 600,
            color: C.n400,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
            marginBottom: 3,
          }}>
            Total
          </div>
          <div style={{
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 600,
            color: C.n600,
          }}>
            {rp(item.amount)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {item.status !== 'paid' && item.paid_amount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: FONT,
            fontSize: 10,
            fontWeight: 500,
            color: C.n400,
            marginBottom: 6,
          }}>
            <span>Progress</span>
            <span style={{ color: C.success }}>{progressPct}%</span>
          </div>
          <div style={{
            height: 6,
            background: C.n100,
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.min(100, progressPct)}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${C.success}, ${C.successDark})`,
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Footer Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTop: `1px solid ${C.n100}`,
      }}>
        <div style={{
          fontFamily: FONT,
          fontSize: 10,
          color: isOverdue ? C.danger : C.n400,
        }}>
          {item.due_date && (
            <span>
              Jatuh tempo: {new Date(item.due_date).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {item.phone && (
            <a
              href={buildWaMeLink(item.phone) || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(37, 211, 102, 0.35)',
              }}>
                <MessageCircle size={16} color="white" />
              </div>
            </a>
          )}
          <div style={{
            display: 'flex',
            alignItems: 'center',
          }}>
            <ChevronRight size={18} color={C.n300} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function OutstandingListPage({ navigate, goBack }) {
  useGlassStyles();
  const { isMobile } = useResponsive();

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
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ status: 'all', search: '', dateFrom: '', dateTo: '' });
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--glass-bg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: `
          radial-gradient(circle at 85% -10%, rgba(6, 95, 70, 0.5) 0%, transparent 55%),
          radial-gradient(circle at -10% 20%, rgba(5, 150, 105, 0.3) 0%, transparent 45%),
          linear-gradient(155deg, #065F46 0%, #047857 55%, #059669 100%)
        `,
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Blob decorations */}
        <div style={{
          position: 'absolute',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
          top: -40,
          right: -20,
          filter: 'blur(15px)',
        }} />
        <div style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          bottom: -20,
          left: -10,
          filter: 'blur(12px)',
        }} />

        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 4,
            }}>
              Manajemen
            </div>
            <div style={{
              fontFamily: FONT,
              fontSize: 20,
              fontWeight: 700,
              color: 'white',
            }}>
              Piutang Pelanggan
            </div>
          </div>
          <button
            onClick={goBack}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10,
        padding: '12px 16px 0',
      }}>
        <SummaryCard
          title="Total Piutang"
          value={rp(summary.total_remaining || 0)}
          color={C.danger}
          bgGradient={`linear-gradient(135deg, ${C.dangerBg}, #FECACA)`}
        />
        <SummaryCard
          title="Sudah Bayar"
          value={rp(summary.total_paid || 0)}
          color={C.success}
          bgGradient={`linear-gradient(135deg, ${C.successBg}, #A7F3D0)`}
        />
      </div>

      {/* Status Counters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
        padding: '10px 16px',
      }}>
        <CounterCard title="Belum Bayar" value={summary.unpaid_count} color={C.danger} />
        <CounterCard title="Sebagian" value={summary.partial_count} color={C.warning} />
        <CounterCard title="Jatuh Tempo" value={summary.overdue_count} color={C.danger} />
      </div>

      {/* Search & Filter */}
      <div style={{
        background: C.white,
        margin: '0 16px 12px',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: SHADOW.sm,
      }}>
        {/* Search Input */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginBottom: showFilter ? 12 : 0,
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: C.n400,
              }}
            />
            <input
              type="text"
              placeholder="Cari nama, no invoice..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              style={{
                width: '100%',
                minWidth: 0,
                height: isMobile ? 40 : 44,
                borderRadius: 12,
                border: `1.5px solid ${C.n200}`,
                padding: '0 12px 0 38px',
                fontFamily: FONT,
                fontSize: 13,
                color: C.n900,
                outline: 'none',
                boxSizing: 'border-box',
                background: C.white,
              }}
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            style={{
              width: isMobile ? 40 : 44,
              height: isMobile ? 40 : 44,
              borderRadius: 12,
              border: showFilter ? `2px solid ${C.success}` : `1.5px solid ${C.n200}`,
              background: showFilter ? C.successBg : C.white,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Filter size={18} color={showFilter ? C.success : C.n500} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilter && (
          <div style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            paddingTop: 4,
          }}>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{
                flex: 1,
                minWidth: 120,
                height: isMobile ? 36 : 40,
                borderRadius: 10,
                border: `1px solid ${C.n200}`,
                padding: '0 10px',
                fontFamily: FONT,
                fontSize: 12,
                color: C.n800,
                background: C.white,
                outline: 'none',
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
                borderRadius: 10,
                border: `1px solid ${C.n200}`,
                padding: '0 10px',
                fontFamily: FONT,
                fontSize: 12,
                color: C.n800,
                outline: 'none',
              }}
            />
            <span style={{
              color: C.n400,
              display: 'flex',
              alignItems: 'center',
              fontFamily: FONT,
              fontSize: 12,
            }}>
              s/d
            </span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              style={{
                flex: 1,
                minWidth: 100,
                height: isMobile ? 36 : 40,
                borderRadius: 10,
                border: `1px solid ${C.n200}`,
                padding: '0 10px',
                fontFamily: FONT,
                fontSize: 12,
                color: C.n800,
                outline: 'none',
              }}
            />

            <button
              onClick={resetFilters}
              style={{
                height: isMobile ? 36 : 40,
                padding: '0 14px',
                borderRadius: 10,
                border: `1px solid ${C.n200}`,
                background: C.white,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 500,
                color: C.n600,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '80px',
      }}>
        {loading ? (
          <div>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : outstandings.length === 0 ? (
          <EmptyState
            type="transactions"
            title="Belum ada piutang"
            description="Piutang pelanggan akan muncul di sini"
          />
        ) : (
          <div>
            {outstandings.map((item, index) => (
              <OutstandingCard
                key={item.id}
                item={item}
                index={index}
                onClick={() => navigate('outstanding_detail', { state: { outstanding: item } })}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB - Add New */}
      <motion.button
        onClick={() => navigate('create_outstanding')}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          position: 'fixed',
          bottom: isMobile ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : 24,
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: 'linear-gradient(145deg, #047857, #065F46)',
          border: 'none',
          boxShadow: '0 4px 16px rgba(6, 95, 70, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
        }}
      >
        <Plus size={24} color="white" />
      </motion.button>
    </div>
  );
}
