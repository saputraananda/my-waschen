// ─────────────────────────────────────────────────────────────────────────────
// OutletComparisonWidget.jsx — Side-by-side outlet performance comparison
// Phase 4: Dashboard Intelligence (Enhanced)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';
import { useAppRefresh } from './ui';
import { motion } from 'framer-motion';
import { Building2, TrendingUp, BarChart3, ChevronRight, RefreshCw, TrendingDown } from 'lucide-react';

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Hari ini' },
  { key: 'week', label: '7 Hari' },
  { key: 'month', label: '30 Hari' },
  { key: 'all', label: 'Semua' },
];

const COLORS = ['#8B5CF6', '#10B981', '#0EA5E9', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

function Bar({ label, value, maxValue, color, pct, isActive, rank }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Rank badge */}
          {rank <= 3 && (
            <div style={{
              width: 18, height: 18, borderRadius: 6,
              background: rank === 1 ? 'linear-gradient(145deg, #FCD34D, #F59E0B)' :
                rank === 2 ? 'linear-gradient(145deg, #D1D5DB, #9CA3AF)' :
                'linear-gradient(145deg, #FDBA74, #EA580C)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, fontWeight: 700, color: 'white',
            }}>
              {rank}
            </div>
          )}
          <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{label}</span>
          {!isActive && (
            <span style={{ fontFamily: 'Poppins', fontSize: 8, fontWeight: 600, color: '#9CA3AF', background: '#F1F5F9', padding: '1px 6px', borderRadius: 999 }}>
              Non-Aktif
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: color }}>{rp(value)}</span>
          {rank === 1 && value > 0 && (
            <TrendingUp size={12} color="#10B981" />
          )}
        </div>
      </div>
      <div style={{ background: '#E2E8F0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            height: '100%',
            background: isActive ? `linear-gradient(90deg, ${color}, ${color}cc)` : '#9CA3AF',
            borderRadius: 6,
            boxShadow: isActive && rank <= 3 ? `0 0 8px ${color}60` : 'none',
          }}
        />
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      borderRadius: 20, padding: '16px 18px',
      boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E2E8F0', animation: 'pulse 1.5s infinite' }} />
        <div>
          <div style={{ height: 14, width: 160, background: '#E2E8F0', borderRadius: 7, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 10, width: 100, background: '#F1F5F9', borderRadius: 5, animation: 'pulse 1.5s infinite', animationDelay: '0.1s' }} />
        </div>
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ height: 12, width: '50%', background: '#E2E8F0', borderRadius: 6, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 10, background: '#F1F5F9', borderRadius: 6, animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 20, padding: '24px 18px',
        boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.08)',
        textAlign: 'center',
      }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ marginBottom: 12 }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto',
          boxShadow: '8px 8px 20px rgba(109, 40, 217, 0.15)',
        }}>
          <Building2 size={28} color="#5B005F" />
        </div>
      </motion.div>
      <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: '#5B005F', marginBottom: 4 }}>Belum Ada Outlet</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#9ca3af' }}>
        Data outlet akan muncul setelah ada transaksi
      </div>
    </motion.div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: 'linear-gradient(145deg, #FEF2F2, #FEE2E2)',
        borderRadius: 20, padding: '20px 18px',
        boxShadow: '8px 8px 20px rgba(220, 38, 38, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>🏪</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 8 }}>
        Gagal memuat data outlet
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onRetry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 10,
          background: '#FEE2E2', border: '1px solid rgba(239, 68, 68, 0.2)',
          cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#DC2626',
        }}
      >
        <RefreshCw size={12} />
        Coba Lagi
      </motion.button>
    </motion.div>
  );
}

export default function OutletComparisonWidget({ onSelectOutlet, compact = false, refreshInterval = 60000 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('today');

  const fetchData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get(`/api/dashboard-intelligence/outlet-comparison?period=${period}`, { timeout: 10000 });
      if (res?.data?.data) setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  // Initial fetch
  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time refresh
  useEffect(() => {
    if (!refreshInterval) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  // Pull to refresh
  useAppRefresh(() => fetchData(), [fetchData]);

  if (loading && !data) return <SkeletonLoader />;
  if (error && !data) return <ErrorState onRetry={fetchData} />;
  if (!data?.outlets?.length) return <EmptyState />;

  const { outlets, totalRevenue, totalTransactions } = data;
  const maxRevenue = Math.max(...outlets.map(o => o.revenue), 1);

  // Compact mode styles
  const padding = compact ? '12px' : '16px 18px';
  const borderRadius = compact ? 14 : 20;
  const headerIconSize = compact ? 28 : 40;
  const headerIconBox = compact ? 28 : 40;
  const titleSize = compact ? 11 : 14;
  const subtitleSize = compact ? 9 : 11;
  const itemPadding = compact ? '8px 0' : '10px 0';
  const showLegend = !compact;
  const maxItems = compact ? 4 : outlets.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: borderRadius, padding: padding,
        boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.08)',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 10 : 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 10 }}>
          <div style={{
            width: headerIconBox, height: headerIconBox, borderRadius: compact ? 8 : 12,
            background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '4px 4px 10px rgba(109, 40, 217, 0.15)',
            flexShrink: 0,
          }}>
            <Building2 size={compact ? 14 : 18} color="#5B005F" />
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: titleSize, fontWeight: 700, color: '#1E293B' }}>🏪 Perbandingan</div>
            {!compact && (
              <div style={{ fontFamily: 'Poppins', fontSize: subtitleSize, color: '#9ca3af' }}>
                {totalTransactions} transaksi · Total {rp(totalRevenue)}
              </div>
            )}
          </div>
        </div>
        {!compact && (
          <motion.button
            whileHover={{ rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={fetchData}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: '#F1F5F9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={12} color="#9ca3af" />
          </motion.button>
        )}
      </div>

      {/* Period selector - hide in compact */}
      {!compact && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {PERIOD_OPTIONS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '5px 12px', borderRadius: 999,
                border: 'none',
                background: period === p.key ? '#5B005F' : '#F1F5F9',
                color: period === p.key ? 'white' : '#64748B',
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Outlet bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {outlets.slice(0, maxItems).map((outlet, idx) => {
          const pct = maxRevenue > 0 ? Math.round((outlet.revenue / maxRevenue) * 100) : 0;
          const color = COLORS[idx % COLORS.length];
          return (
            <motion.div
              key={outlet.outletId}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectOutlet?.(outlet.outletId)}
              style={{
                cursor: onSelectOutlet ? 'pointer' : 'default',
                padding: itemPadding,
                borderBottom: idx < Math.min(outlets.length, maxItems) - 1 ? '1px solid rgba(139, 92, 246, 0.06)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? 3 : 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 4 : 6 }}>
                  {idx < 3 && (
                    <div style={{
                      width: compact ? 14 : 18, height: compact ? 14 : 18, borderRadius: compact ? 4 : 6,
                      background: idx === 0 ? 'linear-gradient(145deg, #FCD34D, #F59E0B)' :
                        idx === 1 ? 'linear-gradient(145deg, #D1D5DB, #9CA3AF)' :
                          'linear-gradient(145deg, #FDBA74, #EA580C)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: compact ? 7 : 8, fontWeight: 700, color: 'white',
                    }}>
                      {idx + 1}
                    </div>
                  )}
                  <span style={{ fontFamily: 'Poppins', fontSize: compact ? 10 : 12, fontWeight: 600, color: '#1E293B' }}>{outlet.outletName}</span>
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: compact ? 10 : 11, fontWeight: 700, color: color }}>{rp(outlet.revenue)}</span>
              </div>
              <div style={{ background: '#E2E8F0', borderRadius: compact ? 4 : 6, height: compact ? 6 : 10, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    background: outlet.isActive ? `linear-gradient(90deg, ${color}, ${color}cc)` : '#9CA3AF',
                    borderRadius: compact ? 4 : 6,
                    boxShadow: outlet.isActive && idx <= 2 ? `0 0 6px ${color}60` : 'none',
                  }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Market share legend */}
      {showLegend && outlets.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            marginTop: 14, padding: '10px 12px',
            background: '#F8F4FF', borderRadius: 12,
            border: '1px solid rgba(139, 92, 246, 0.08)',
          }}
        >
          <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>Pangsa Pasar</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {outlets.map((o, i) => (
              <div key={o.outletId} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS[i % COLORS.length] }} />
                <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>
                  {o.outletName}: {o.marketShare}%
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top performer highlight */}
      {outlets.length >= 2 && outlets[0].revenue > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{
            marginTop: 14, padding: '12px 14px',
            background: 'linear-gradient(145deg, #F0FDF4, #D1FAE5)',
            borderRadius: 12, border: '1px solid #A7F3D0',
            display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(145deg, #FCD34D, #F59E0B)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800, color: 'white',
            boxShadow: '4px 4px 10px rgba(245, 158, 11, 0.3)',
          }}>
            🏆
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: '#065F46' }}>
              {outlets[0].outletName}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#059669', marginTop: 2 }}>
              Top Performer · {rp(outlets[0].revenue)} ({outlets[0].marketShare}% pasar)
            </div>
          </div>
          <TrendingUp size={16} color="#059669" />
        </motion.div>
      )}
    </motion.div>
  );
}
