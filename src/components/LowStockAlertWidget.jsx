// ─────────────────────────────────────────────────────────────────────────────
// LowStockAlertWidget.jsx — Proactive inventory warning widget
// Phase 4: Dashboard Intelligence (Enhanced)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../utils/theme';
import { rp } from '../utils/helpers';
import { useAppRefresh } from './ui';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Package, ChevronRight, RefreshCw, X, TrendingDown } from 'lucide-react';
import { IconWarning, IconPackage, IconDone, IconProcess, IconChart } from './ui/StatusIcons';

const URGENCY_META = {
  critical: { color: '#DC2626', bg: '#FEE2E2', label: 'Kritis', icon: 'critical', border: '#FCA5A5' },
  high:     { color: '#EA580C', bg: '#FFEDD5', label: 'Tinggi',  icon: 'high', border: '#FDBA74' },
  medium:   { color: '#D97706', bg: '#FEF3C7', label: 'Sedang',  icon: 'medium', border: '#FDE68A' },
  low:      { color: '#0891B2', bg: '#E0F2FE', label: 'Rendah', icon: 'low', border: '#7DD3FC' },
};

// Urgency Icon Component
const UrgencyIcon = ({ type, size = 16, color }) => {
  const iconProps = { size, color };
  switch (type) {
    case 'critical': return <AlertTriangle {...iconProps} />;
    case 'high': return <IconWarning {...iconProps} />;
    case 'medium': return <IconProcess {...iconProps} />;
    case 'low': return <IconPackage {...iconProps} />;
    default: return <IconChart {...iconProps} />;
  }
};

function SkeletonLoader() {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
      borderRadius: 20,
      padding: '16px 18px',
      boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(139, 92, 246, 0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'linear-gradient(145deg, #E2E8F0, #CBD5E1)',
          animation: 'pulse 1.5s infinite',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: '60%', background: '#E2E8F0', borderRadius: 7, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 12, width: '40%', background: '#F1F5F9', borderRadius: 6, animation: 'pulse 1.5s infinite', animationDelay: '0.2s' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 24, width: 70, background: '#E2E8F0', borderRadius: 12, animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: 56, background: '#F1F5F9', borderRadius: 12, marginBottom: 8,
          animation: 'pulse 1.5s infinite', animationDelay: `${i * 0.1}s`
        }} />
      ))}
    </div>
  );
}

function EmptyState({ onRefresh }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 20,
        padding: '24px 18px',
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
          background: 'linear-gradient(145deg, #D1FAE5, #A7F3D0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto',
          boxShadow: '8px 8px 20px rgba(5, 150, 105, 0.15)',
        }}>
          <Package size={28} color="#059669" />
        </div>
      </motion.div>
      <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: '#059669', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconDone size={16} color="#059669" /> Stok Aman
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
        Semua bahan baku dalam kondisi normal
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onRefresh}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 10,
          background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          cursor: 'pointer',
          fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#6e2e78',
        }}
      >
        <RefreshCw size={12} />
        Refresh
      </motion.button>
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
        borderRadius: 20,
        padding: '20px 18px',
        boxShadow: '8px 8px 20px rgba(220, 38, 38, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(239, 68, 68, 0.15)',
        textAlign: 'center',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: '#FEE2E2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px',
      }}>
        <AlertTriangle size={22} color="#DC2626" />
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 8 }}>
        Gagal memuat data stok
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onRetry}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 10,
          background: 'linear-gradient(145deg, #FEE2E2, #FECACA)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          cursor: 'pointer',
          fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#DC2626',
        }}
      >
        <RefreshCw size={12} />
        Coba Lagi
      </motion.button>
    </motion.div>
  );
}

export default function LowStockAlertWidget({ compact = false, maxItems = 5, onViewAll, refreshInterval = 60000 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchAlerts = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard-intelligence/low-stock', { timeout: 10000 });
      if (res?.data?.data) {
        setData(res.data.data);
        setLastFetch(new Date());
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Real-time refresh
  useEffect(() => {
    if (!refreshInterval) return;
    const interval = setInterval(fetchAlerts, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAlerts, refreshInterval]);

  // Pull to refresh
  useAppRefresh(() => fetchAlerts(), [fetchAlerts]);

  if (loading && !data) return <SkeletonLoader />;
  if (error && !data) return <ErrorState onRetry={fetchAlerts} />;
  if (!data?.hasAlerts) return <EmptyState onRefresh={fetchAlerts} />;

  const { alerts, summary } = data;
  const displayAlerts = compact && !expanded ? alerts.slice(0, maxItems) : alerts;
  const topUrgency = alerts[0]?.urgency || 'low';
  const urgencyMeta = URGENCY_META[topUrgency] || URGENCY_META.low;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: 20,
        padding: '16px 18px',
        boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
        border: `1px solid ${urgencyMeta.bg}`,
        borderLeft: `4px solid ${urgencyMeta.color}`,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.div
            animate={urgencyMeta.color === '#DC2626' ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1, repeat: urgencyMeta.color === '#DC2626' ? Infinity : 0 }}
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: urgencyMeta.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `4px 4px 10px ${urgencyMeta.color}20`,
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} color={urgencyMeta.color} />
          </motion.div>
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconWarning size={18} color="#D97706" /> Stok Rendah
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {summary.total} item perlu perhatian
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Last updated indicator */}
          {lastFetch && (
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#9ca3af' }}>
              {Math.round((Date.now() - lastFetch.getTime()) / 1000)}s lalu
            </div>
          )}
          <motion.button
            whileHover={{ rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={fetchAlerts}
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

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {summary.critical > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{ background: '#FEE2E2', color: '#DC2626', padding: '3px 10px', borderRadius: 999, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={12} /> {summary.critical} Kritis
          </motion.div>
        )}
        {summary.high > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.05 }}
            style={{ background: '#FFEDD5', color: '#EA580C', padding: '3px 10px', borderRadius: 999, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconWarning size={12} /> {summary.high} Tinggi
          </motion.div>
        )}
        {summary.medium > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            style={{ background: '#FEF3C7', color: '#D97706', padding: '3px 10px', borderRadius: 999, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconProcess size={12} /> {summary.medium} Sedang
          </motion.div>
        )}
        {summary.low > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15 }}
            style={{ background: '#E0F2FE', color: '#0891B2', padding: '3px 10px', borderRadius: 999, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconPackage size={12} /> {summary.low}
          </motion.div>
        )}
      </div>

      {/* Alert list */}
      <AnimatePresence mode="popLayout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayAlerts.map((alert, idx) => {
            const meta = URGENCY_META[alert.urgency] || URGENCY_META.low;
            return (
              <motion.div
                key={`${alert.itemId}-${alert.outletId}`}
                layout
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ delay: idx * 0.03, type: 'spring', stiffness: 300 }}
                style={{
                  background: meta.bg,
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: `1px solid ${meta.border}`,
                  overflow: 'hidden',
                }}
              >
                <div style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#1E293B',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {alert.itemName}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#64748B', marginTop: 2 }}>
                    {alert.outletName} · Stok: {alert.currentStock} {alert.unit} (min: {alert.minStock})
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: meta.color }}>
                    {alert.stockPercentage}%
                  </div>
                  {alert.shortage > 0 && (
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#64748B' }}>
                      Kurang: {alert.shortage}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>

      {/* Expand / collapse */}
      {alerts.length > maxItems && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setExpanded(e => !e)}
          style={{
            width: '100%', marginTop: 12, padding: '10px',
            background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: 12, cursor: 'pointer',
            fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: '#6e2e78',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ChevronRight
            size={14}
            style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
          />
          {expanded ? 'Sembunyikan' : `Lihat semua (${alerts.length})`}
        </motion.button>
      )}

      {/* View all / dismiss */}
      {onViewAll && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={onViewAll}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%', marginTop: 10, padding: '8px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: '#6e2e78',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          Kelola Inventori →
        </motion.button>
      )}
    </motion.div>
  );
}
