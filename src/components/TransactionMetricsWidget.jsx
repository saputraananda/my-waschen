// ─────────────────────────────────────────────────────────────────────────────
// TransactionMetricsWidget.jsx — Transaction metrics for dashboard
// Phase 4: Dashboard Intelligence (Enhanced)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';
import { useAppRefresh } from './ui';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, CheckCircle, DollarSign, Package, RefreshCw, TrendingDown } from 'lucide-react';
import { IconChart, IconTrendUp, IconClock, IconDone, IconWarning, IconMoney, IconPackage, IconTrendDown } from './ui/StatusIcons';

const METRIC_CARDS = [
  { key: 'transactionCount', label: 'Transaksi', icon: <IconChart size={16} />, color: '#8B5CF6', format: 'number' },
  { key: 'avgTransactionValue', label: 'Rata-rata Nilai', icon: <IconTrendUp size={16} />, color: '#059669', format: 'currency' },
  { key: 'completedCount', label: 'Selesai', icon: <IconDone size={16} />, color: '#10B981', format: 'number' },
  { key: 'pendingCount', label: 'Proses', icon: <IconClock size={16} />, color: '#6366F1', format: 'number' },
];

const PAYMENT_BREAKDOWN = [
  { key: 'paidAmount', label: 'Lunas', color: '#10B981' },
  { key: 'partialAmount', label: 'Sebagian', color: '#F59E0B' },
  { key: 'unpaidAmount', label: 'Belum Bayar', color: '#EF4444' },
];

function fmtValue(val, format) {
  if (format === 'currency') return rp(val);
  if (format === 'number') return Number(val).toLocaleString('id-ID');
  return val;
}

function SkeletonLoader({ compact }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      borderRadius: 20,
      padding: '16px 18px',
      boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E2E8F0', animation: 'pulse 1.5s infinite' }} />
        <div>
          <div style={{ height: 14, width: 120, background: '#E2E8F0', borderRadius: 7, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 10, width: 80, background: '#F1F5F9', borderRadius: 5, animation: 'pulse 1.5s infinite', animationDelay: '0.1s' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: 70, background: '#F1F5F9', borderRadius: 14,
            animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.1}s`
          }} />
        ))}
      </div>
      <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        background: 'linear-gradient(145deg, #FEF2F2, #FEE2E2)',
        borderRadius: 20,
        padding: '20px 18px',
        boxShadow: '8px 8px 20px rgba(220, 38, 38, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconWarning size={28} color="#DC2626" /></div>
      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 8 }}>
        Gagal memuat metrik
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

export default function TransactionMetricsWidget({ period = 'today', compact = false, onPeriodChange, refreshInterval = 30000 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchMetrics = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard-intelligence/metrics', { timeout: 10000 });
      if (res?.data?.data) {
        setData(res.data.data);
        setLastFetch(new Date());
      }
    } catch (err) {
      console.error('[TransactionMetricsWidget] Fetch error:', err);
      setError(err?.response?.data?.message || 'Gagal memuat metrik');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  // Real-time refresh
  useEffect(() => {
    if (!refreshInterval) return;
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  // Pull to refresh
  useAppRefresh(() => fetchMetrics(), [fetchMetrics]);

  if (loading && !data) return <SkeletonLoader compact={compact} />;
  if (error && !data) return <ErrorState onRetry={fetchMetrics} />;

  const todayData = data?.today || {};
  const monthData = data?.month || {};

  // Calculate completion rate
  const total = todayData.transactionCount || 0;
  const completed = todayData.completedCount || 0;
  const pending = todayData.pendingCount || 0;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate average
  const avgValue = todayData.avgTransactionValue || 0;

  // Payment breakdown for mini bar
  const totalPayment = (todayData.paidAmount || 0) + (todayData.partialAmount || 0) + (todayData.unpaidAmount || 0);

  // Completion rate color
  const completionColor = completionRate >= 80 ? '#10B981' :
    completionRate >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 20,
        padding: '16px 18px',
        boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.08)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '4px 4px 10px rgba(109, 40, 217, 0.15)',
            flexShrink: 0,
          }}>
            <BarChart3 size={18} color="#6e2e78" />
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconChart size={18} color="#6e2e78" /> Metrik Transaksi
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#9ca3af' }}>
              {period === 'today' ? 'Hari ini' : period === 'month' ? 'Bulan ini' : 'Semua'}
              {lastFetch && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  · {Math.round((Date.now() - lastFetch.getTime()) / 1000)}s lalu
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onPeriodChange && (
            <div style={{ display: 'flex', gap: 4 }}>
              {['today', 'month'].map(p => (
                <button
                  key={p}
                  onClick={() => onPeriodChange(p)}
                  style={{
                    padding: '4px 10px', borderRadius: 8, border: 'none',
                    background: period === p ? '#6e2e78' : '#F1F5F9',
                    color: period === p ? 'white' : '#64748B',
                    fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p === 'today' ? 'Hari' : 'Bulan'}
                </button>
              ))}
            </div>
          )}
          <motion.button
            whileHover={{ rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={fetchMetrics}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: '#F1F5F9', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RefreshCw size={12} color="#9ca3af" />
          </motion.button>
        </div>
      </div>

      {/* Main stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {METRIC_CARDS.map((card, idx) => {
          const val = card.key === 'avgTransactionValue' ? avgValue :
                       card.key === 'transactionCount' ? total :
                       card.key === 'completedCount' ? completed :
                       card.key === 'pendingCount' ? pending : 0;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              style={{
                background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
                borderRadius: 14,
                padding: '12px 10px',
                textAlign: 'center',
                boxShadow: 'inset 2px 2px 6px rgba(109, 40, 217, 0.08), inset -1px -1px 4px rgba(255, 255, 255, 0.9)',
                border: `1px solid ${card.color}20`,
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `${card.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px',
              }}>
                <span style={{ color: card.color }}>{card.icon}</span>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: compact ? 14 : 16, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.3px' }}>
                {loading ? '—' : fmtValue(val, card.format)}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B', marginTop: 4, fontWeight: 500 }}>{card.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Completion rate bar */}
      <div style={{ marginBottom: compact ? 0 : 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#64748B' }}>Tingkat Penyelesaian</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
              color: completionColor,
            }}>
              {completionRate}%
            </span>
            {completionRate < 50 && total > 0 && (
              <TrendingDown size={12} color="#EF4444" />
            )}
            {completionRate >= 80 && (
              <TrendingUp size={12} color="#10B981" />
            )}
          </div>
        </div>
        <div style={{ background: '#E2E8F0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionRate}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: `linear-gradient(90deg, ${completionColor}, ${completionColor}aa)`,
              borderRadius: 6,
            }}
          />
        </div>
      </div>

      {/* Payment breakdown mini bars */}
      {!compact && totalPayment > 0 && (
        <div>
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>Komposisi Pembayaran</div>
          <div style={{ display: 'flex', gap: 4, height: 24, borderRadius: 8, overflow: 'hidden' }}>
            {PAYMENT_BREAKDOWN.map(item => {
              const val = todayData[item.key] || 0;
              const pct = totalPayment > 0 ? (val / totalPayment) * 100 : 0;
              if (pct < 1) return null;
              return (
                <motion.div
                  key={item.key}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  style={{
                    background: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    minWidth: pct > 5 ? 'auto' : 0,
                  }}
                  title={`${item.label}: ${rp(val)}`}
                >
                  {pct > 10 && (
                    <span style={{ fontFamily: 'Poppins', fontSize: 8, fontWeight: 700, color: 'white', padding: '0 4px' }}>
                      {Math.round(pct)}%
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {PAYMENT_BREAKDOWN.map(item => {
              const val = todayData[item.key] || 0;
              const pct = totalPayment > 0 ? Math.round((val / totalPayment) * 100) : 0;
              return (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: item.color }} />
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>
                    {item.label}: {pct}% ({rp(val)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly summary (if not compact) */}
      {!compact && monthData.totalRevenue > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: '1px solid rgba(139, 92, 246, 0.08)',
          }}
        >
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>Bulan Ini</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: '#F8F4FF', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: '#6e2e78' }}>{rp(monthData.totalRevenue)}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B', marginTop: 2 }}>Total Omset</div>
            </div>
            <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: '#059669' }}>{rp(monthData.totalPaid)}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B', marginTop: 2 }}>Sudah Bayar</div>
            </div>
            <div style={{ flex: 1, background: '#FEF3C7', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: '#D97706' }}>{monthData.transactionCount}</div>
              <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B', marginTop: 2 }}>Transaksi</div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
