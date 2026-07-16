// ─────────────────────────────────────────────────────────────────────────────
// PaymentTrendChart.jsx — 14-day cash vs non-cash trend
// Phase 4: Dashboard Intelligence (Enhanced)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';
import { useAppRefresh } from './ui';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { TrendingUp, CreditCard, Banknote, RefreshCw, Calendar } from 'lucide-react';

const DAY_OPTIONS = [
  { key: 7, label: '7H' },
  { key: 14, label: '14H' },
  { key: 30, label: '30H' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const date = new Date(label);
  const formattedDate = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div style={{
      background: 'white', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
      fontFamily: 'Poppins', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 6 }}>{formattedDate}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />
          <span style={{ color: '#64748B' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: '#1E293B' }}>{rp(p.value || 0)}</span>
        </div>
      ))}
    </div>
  );
};

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
      <div style={{ height: 200, background: '#F1F5F9', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
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
        borderRadius: 20, padding: '20px 18px',
        boxShadow: '8px 8px 20px rgba(220, 38, 38, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 8 }}>
        Gagal memuat data tren
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
          <TrendingUp size={28} color="#5B005F" />
        </div>
      </motion.div>
      <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: '#5B005F', marginBottom: 4 }}>Belum Ada Data Tren</div>
      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#9ca3af' }}>
        Data tren akan muncul setelah ada transaksi
      </div>
    </motion.div>
  );
}

export default function PaymentTrendChart({ days = 14, height = 220, refreshInterval = 60000 }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(days);

  const fetchData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get(`/api/admin-dashboard/payment-trend?days=${selectedDays}`, { timeout: 10000 });
      if (res?.data?.data) setData(res.data.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [selectedDays]);

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

  if (loading && !data.length) return <SkeletonLoader />;
  if (error && !data.length) return <ErrorState onRetry={fetchData} />;
  if (!data.length) return <EmptyState />;

  // Calculate totals
  const totalCash = data.reduce((s, d) => s + (d.cashAmount || 0), 0);
  const totalNonCash = data.reduce((s, d) => s + (d.nonCashAmount || 0), 0);
  const total = totalCash + totalNonCash;
  const cashPct = total > 0 ? Math.round((totalCash / total) * 100) : 0;
  const nonCashPct = total > 0 ? 100 - cashPct : 0;

  // Chart data with formatted dates
  const chartData = data.map(d => ({
    ...d,
    dateLabel: new Date(d.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 20, padding: '16px 18px',
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
            <TrendingUp size={18} color="#5B005F" />
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#1E293B' }}>💳 Tren Pembayaran</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#9ca3af' }}>
              {selectedDays} hari terakhir
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Summary badges */}
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(139, 92, 246, 0.1)', borderRadius: 999,
              padding: '4px 10px',
            }}>
              <Banknote size={12} color="#8B5CF6" />
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#5B005F' }}>{cashPct}%</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'rgba(16, 185, 129, 0.1)', borderRadius: 999,
              padding: '4px 10px',
            }}>
              <CreditCard size={12} color="#10B981" />
              <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#059669' }}>{nonCashPct}%</span>
            </div>
          </div>

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
        </div>
      </div>

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {DAY_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSelectedDays(opt.key)}
            style={{
              padding: '5px 12px', borderRadius: 999,
              border: 'none',
              background: selectedDays === opt.key ? '#5B005F' : '#F1F5F9',
              color: selectedDays === opt.key ? 'white' : '#64748B',
              fontFamily: 'Poppins', fontSize: 10, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="gradNonCash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.08)" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontFamily: 'Poppins', fontSize: 9, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : v}
            tick={{ fontFamily: 'Poppins', fontSize: 9, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: 10 }} />
          <Bar dataKey="cashAmount" name="Tunai" fill="url(#gradCash)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="nonCashAmount" name="Non-Tunai" fill="url(#gradNonCash)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div style={{
        display: 'flex', gap: 10, marginTop: 14, paddingTop: 12,
        borderTop: '1px solid rgba(139, 92, 246, 0.08)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ flex: 1, background: 'rgba(139, 92, 246, 0.06)', borderRadius: 10, padding: '10px 12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Banknote size={14} color="#8B5CF6" />
            <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: '#64748B' }}>Total Tunai</span>
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#5B005F' }}>{rp(totalCash)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <div style={{
              height: 4, background: '#E2E8F0', borderRadius: 2, flex: 1, overflow: 'hidden',
            }}>
              <div style={{ height: '100%', width: `${cashPct}%`, background: '#8B5CF6', borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>{cashPct}%</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ flex: 1, background: 'rgba(16, 185, 129, 0.06)', borderRadius: 10, padding: '10px 12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <CreditCard size={14} color="#10B981" />
            <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: '#64748B' }}>Total Non-Tunai</span>
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#059669' }}>{rp(totalNonCash)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <div style={{
              height: 4, background: '#E2E8F0', borderRadius: 2, flex: 1, overflow: 'hidden',
            }}>
              <div style={{ height: '100%', width: `${nonCashPct}%`, background: '#10B981', borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>{nonCashPct}%</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
