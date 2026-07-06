// ─────────────────────────────────────────────────────────────────────────────
// CustomerSegmentationWidget.jsx — Customer Segmentation Overview Widget
// Phase 5-7: Customer Segmentation
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAppRefresh } from './ui';
import { motion } from 'framer-motion';
import { Users, Crown, Star, TrendingUp, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { IconStar, IconWarning, IconChart, IconUsers, IconTrendUp } from './ui/StatusIcons';

// SVG icon components for segment display
const SegmentIcon = ({ type, size = 24, color }) => {
  const iconProps = { size, color };
  switch (type) {
    case 'VIP': return <Crown {...iconProps} />;
    case 'GOLD': return <IconStar {...iconProps} />;
    case 'SILVER': return <Star {...iconProps} />;
    case 'BRONZE': return <TrendingUp {...iconProps} />;
    case 'NEW': return <Sparkles {...iconProps} />;
    case 'AT_RISK': return <IconWarning {...iconProps} />;
    case 'CHURNED': return <Users {...iconProps} />;
    default: return <IconUsers {...iconProps} />;
  }
};

const SEGMENT_CONFIG = {
  VIP: { label: 'VIP', color: '#F59E0B', bg: '#FEF3C7', icon: 'VIP', description: 'Pelanggan paling berharga' },
  GOLD: { label: 'Gold', color: '#D97706', bg: '#FFEDD5', icon: 'GOLD', description: 'Pelanggan setia' },
  SILVER: { label: 'Silver', color: '#6B7280', bg: '#F3F4F6', icon: 'SILVER', description: 'Pelanggan tetap' },
  BRONZE: { label: 'Bronze', color: '#92400E', bg: '#FEF2F2', icon: 'BRONZE', description: 'Pelanggan aktif' },
  NEW: { label: 'New', color: '#8B5CF6', bg: '#EDE9FE', icon: 'NEW', description: 'Pelanggan baru' },
  AT_RISK: { label: 'At Risk', color: '#DC2626', bg: '#FEE2E2', icon: 'AT_RISK', description: 'Perlu perhatian' },
  CHURNED: { label: 'Churned', color: '#9CA3AF', bg: '#F9FAFB', icon: 'CHURNED', description: 'Sudah tidak aktif' },
};

function SkeletonLoader() {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      borderRadius: 20, padding: 16,
      boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#E2E8F0', animation: 'pulse 1.5s infinite' }} />
        <div>
          <div style={{ height: 14, width: 140, background: '#E2E8F0', borderRadius: 7, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 10, width: 80, background: '#F1F5F9', borderRadius: 5, animation: 'pulse 1.5s infinite', animationDelay: '0.1s' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} style={{ height: 72, background: '#F1F5F9', borderRadius: 12, animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  );
}

function SegmentCard({ segment, delay }) {
  const config = SEGMENT_CONFIG[segment.key] || SEGMENT_CONFIG.NEW;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: config.bg,
        borderRadius: 14,
        padding: '12px 10px',
        textAlign: 'center',
        border: `1px solid ${config.color}30`,
      }}
    >
      <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}>
        <SegmentIcon type={config.icon} size={24} color={config.color} />
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: config.color }}>
        {segment.customerCount}
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B', marginTop: 2 }}>
        {config.label}
      </div>
      {segment.percentage > 0 && (
        <div style={{ fontFamily: 'Poppins', fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>
          {segment.percentage}%
        </div>
      )}
    </motion.div>
  );
}

export default function CustomerSegmentationWidget({ onViewAll, refreshInterval = 60000 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get('/api/segmentation/overview', { timeout: 10000 });
      if (res?.data?.data) setData(res.data.data);
    } catch (err) {
      console.error('[CustomerSegmentationWidget]', err);
      setError(err?.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!refreshInterval) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  useAppRefresh(() => fetchData(), [fetchData]);

  if (loading && !data) return <SkeletonLoader />;
  if (error && !data) {
    return (
      <div style={{
        background: '#FEF2F2', borderRadius: 20, padding: 20, textAlign: 'center',
        border: '1px solid rgba(239, 68, 68, 0.15)',
      }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><IconChart size={28} color="#DC2626" /></div>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#DC2626' }}>{error}</div>
        <button onClick={fetchData} style={{ marginTop: 12, padding: '8px 16px', background: '#FEE2E2', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
          Coba Lagi
        </button>
      </div>
    );
  }

  const { segments, activitySummary, revenueSummary } = data || {};
  const topSegments = segments?.filter(s => ['VIP', 'GOLD', 'SILVER'].includes(s.key)).slice(0, 3) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 20, padding: 16,
        boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08)',
        border: '1px solid rgba(139, 92, 246, 0.08)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '4px 4px 10px rgba(109, 40, 217, 0.15)',
          }}>
            <Users size={18} color="#6e2e78" />
          </div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconChart size={18} color="#6e2e78" /> Segmentasi Pelanggan
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#9ca3af' }}>
              {activitySummary?.total || 0} Total Pelanggan
            </div>
          </div>
        </div>
        <button onClick={fetchData} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={12} color="#9ca3af" />
        </button>
      </div>

      {/* Segment Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {segments?.slice(0, 4).map((seg, idx) => (
          <SegmentCard key={seg.key} segment={seg} delay={idx * 0.05} />
        ))}
      </div>

      {/* Activity Summary */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        background: '#F8F4FF', borderRadius: 12,
        border: '1px solid rgba(139, 92, 246, 0.08)',
        marginBottom: 14,
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: '#10B981' }}>
            {activitySummary?.active || 0}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>Aktif</div>
        </div>
        <div style={{ width: 1, background: 'rgba(139, 92, 246, 0.1)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>
            {activitySummary?.at_risk || 0}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>At Risk</div>
        </div>
        <div style={{ width: 1, background: 'rgba(139, 92, 246, 0.1)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: '#EF4444' }}>
            {activitySummary?.churned || 0}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>Churned</div>
        </div>
        <div style={{ width: 1, background: 'rgba(139, 92, 246, 0.1)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: '#6e2e78' }}>
            {activitySummary?.activeRate || 0}%
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>Active Rate</div>
        </div>
      </div>

      {/* Revenue Summary */}
      {revenueSummary && (
        <div style={{
          display: 'flex', gap: 10,
          paddingTop: 12, borderTop: '1px solid rgba(139, 92, 246, 0.08)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#64748B', marginBottom: 4 }}>Total Revenue</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#6e2e78' }}>
              Rp {(revenueSummary.total / 1000000).toFixed(1)}jt
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#64748B', marginBottom: 4 }}>Avg/Customer</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#059669' }}>
              Rp {(revenueSummary.avgPerCustomer / 1000).toFixed(0)}rb
            </div>
          </div>
        </div>
      )}

      {/* View All Button */}
      {onViewAll && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onViewAll}
          style={{
            width: '100%', marginTop: 14, padding: '10px',
            background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: 12, cursor: 'pointer',
            fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#6e2e78',
          }}
        >
          Lihat Detail Segmentasi →
        </motion.button>
      )}
    </motion.div>
  );
}
