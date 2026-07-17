import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useResponsive } from '../../utils/hooks';
import { ProfileAvatar, useAppRefresh, StatCard, StatCardGrid, ChartCard, ChartCardGrid } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, ChevronRight, ChevronDown, Home, FileText, DollarSign, AlertCircle,
} from 'lucide-react';
import { checkLowBalance } from '../../utils/outletCashApi';
import LowStockAlertWidget from '../../components/LowStockAlertWidget';
import TransactionMetricsWidget from '../../components/TransactionMetricsWidget';
import OutletComparisonWidget from '../../components/OutletComparisonWidget';
import PaymentTrendChart from '../../components/PaymentTrendChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { SHADOWS, GRADIENTS, RADIUS } from '../../utils/designSystem';

// ─── Premium Animation Assets ───────────────────────────────────────────────
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp'
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp'
import soapBubble from '../../assets/Decorative icon/soap-bubble.webp'

// ─── Premium Animation Components ──────────────────────────────────────────────
const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, opacity = 0.5 }) => (
  <motion.div
    animate={{
      y: [0, -20, 0],
      scale: [1, 1.1, 1],
      opacity: [opacity * 0.6, opacity, opacity * 0.6],
    }}
    transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    style={{ position: 'absolute', top, left, right, bottom, width: size, height: size, pointerEvents: 'none', zIndex: 0 }}
  >
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))' }} loading="lazy" />
  </motion.div>
);

const Sparkle = ({ top, left, size = 6, delay = 0 }) => (
  <motion.div
    style={{
      position: 'absolute', top, left, width: size, height: size,
      background: '#E85D04', borderRadius: '50%',
      boxShadow: `0 0 ${size}px #E85D04, 0 0 ${size * 2}px #E85D0450`,
      pointerEvents: 'none', zIndex: 1,
    }}
    animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 180, 360] }}
    transition={{ duration: 2.5, delay, repeat: Infinity, ease: 'easeOut' }}
  />
);

const GlowOrb = ({ color = 'rgba(91, 0, 95, 0.08)', size = 200, top, left, right, bottom, blur = 40 }) => (
  <div
    style={{
      position: 'absolute', top, left, right, bottom, width: size, height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: `blur(${blur}px)`,
      pointerEvents: 'none', zIndex: 0,
    }}
  />
);

// ─── Collapsible Section Component ─────────────────────────────────────────────
function CollapsibleSection({ title, icon, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isMobile } = useResponsive();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
        borderRadius: isMobile ? 16 : 22,
        marginBottom: 14,
        overflow: 'hidden',
        boxShadow: '12px 12px 28px rgba(60, 10, 99, 0.12), -6px -6px 16px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(139, 92, 246, 0.08)',
      }}
    >
      {/* Section Header (clickable) */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ backgroundColor: 'rgba(139, 92, 246, 0.03)' }}
        whileTap={{ scale: 0.99 }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '14px 16px' : '16px 20px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: isMobile ? 13 : 14, fontWeight: 700, color: C.n800 }}>
            {title}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} color={C.n500} />
        </motion.div>
      </motion.button>

      {/* Section Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: isMobile ? '0 16px 14px' : '0 20px 18px' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AdminDashboardPage({ user, navigate }) {
  const { adminOutletId, setAdminOutletId } = useApp();
  const { isMobile, isTablet, isDesktop, md, lg } = useResponsive();
  const [outlets, setOutlets] = useState([]);
  const [period, setPeriod] = useState('today');
  const [stats, setStats] = useState({
    total_omset: 0, total_transaksi: 0, total_pelunasan: 0,
    omset_today: 0, pelunasan_today: 0, transaksi_today: 0,
    omset_month: 0, pelunasan_month: 0, transaksi_month: 0,
    pending_transactions: 0, total_customers: 0, outlet_comparison: null,
  });
  const [statsError, setStatsError] = useState('');
  const [periodAlerts, setPeriodAlerts] = useState([]);
  const [lowBalanceAlert, setLowBalanceAlert] = useState(null);
  const [poolData, setPoolData] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('7d');
  const [outletPerformance, setOutletPerformance] = useState([]);
  const [cashDepositStatus, setCashDepositStatus] = useState([]);
  const [paymentTrend, setPaymentTrend] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(false);
  // Phase 4: Dashboard Intelligence
  const [metricsPeriod, setMetricsPeriod] = useState('today');
  const [targetDaily, setTargetDaily] = useState(null);
  const [loadingDailyTarget, setLoadingDailyTarget] = useState(false);

  // Display mode: 'bar' = compact bar stats, 'graph' = chart inside card
  const [displayMode, setDisplayMode] = useState('bar');

  // Responsive spacing values
  const headerPadding = isMobile ? '14px 14px 36px' : '18px 20px 40px';
  const contentPadding = isMobile ? '0 12px' : '0 16px';
  const cardPadding = isMobile ? '16px 14px' : '20px 18px';
  const cardRadius = isMobile ? 18 : 22;
  const sectionCardRadius = isMobile ? 16 : 20;
  const fontSize = {
    hero: isMobile ? 18 : 22,
    section: isMobile ? 12 : 13,
    label: isMobile ? 10 : 11,
    stat: isMobile ? 18 : 22,
  };

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => {
      const list = r?.data?.data || [];
      setOutlets(list);
      if (!adminOutletId && list.length > 0) setAdminOutletId('_all');
    }).catch(() => setOutlets([]));
  }, []);

  const outletId = adminOutletId;
  const setOutletId = setAdminOutletId;

  const fetchStats = useCallback(async () => {
    if (!outletId) return;
    setStatsError('');
    try {
      const q = new URLSearchParams({ period });
      if (outletId !== '_all') q.set('outletId', outletId);
      if (outletId === '_all' && (period === 'today' || period === 'month')) q.set('compare', '1');
      const statsRes = await axios.get(`/api/dashboard/stats?${q.toString()}`);
      if (statsRes?.data?.data) setStats(statsRes.data.data);
    } catch (error) {
      setStatsError(error?.response?.data?.message || 'Gagal memuat statistik.');
    }
  }, [outletId, period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useAppRefresh(() => fetchStats(), [fetchStats]);

  // Fetch chart data
  const fetchCharts = useCallback(async () => {
    setLoadingCharts(true);
    try {
      const [perfRes, depositRes, paymentRes] = await Promise.all([
        axios.get(`/api/admin-dashboard/outlet-performance?period=${chartPeriod}`),
        axios.get(`/api/admin-dashboard/cash-deposit-status?period=${chartPeriod}`),
        axios.get('/api/admin-dashboard/payment-trend?days=14')
      ]);
      setOutletPerformance(perfRes?.data?.data || []);
      setCashDepositStatus(depositRes?.data?.data || []);
      setPaymentTrend(paymentRes?.data?.data || []);
    } catch (err) {
      // Error handled silently
    } finally {
      setLoadingCharts(false);
    }
  }, [chartPeriod]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  // Phase 4: Fetch daily target progress
  const fetchDailyTarget = useCallback(async () => {
    setLoadingDailyTarget(true);
    try {
      const res = await axios.get('/api/dashboard-intelligence/target-daily');
      if (res?.data?.data) setTargetDaily(res.data.data);
    } catch (err) {
      // Error handled silently
    } finally {
      setLoadingDailyTarget(false);
    }
  }, []);

  useEffect(() => {
    fetchDailyTarget();
  }, [fetchDailyTarget]);

  // Low balance check for admin
  useEffect(() => {
    checkLowBalance().then(d => { if (d?.isLow) setLowBalanceAlert(d); else setLowBalanceAlert(null); }).catch(() => {});
    // Pool kas tertahan
    axios.get('/api/cash-deposits/pool-summary').then(r => setPoolData(r?.data?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!outlets.length) return;
    const targets = outletId && outletId !== '_all' ? outlets.filter(o => o.id === outletId) : outlets;
    Promise.all(
      targets.map(o => axios.get(`/api/periods/current?outletId=${o.id}`).then(r => ({ outlet: o, data: r?.data?.data })).catch(() => null))
    ).then(results => {
      setPeriodAlerts(results.filter(r => r && r.data && !r.data.alreadyClosed && r.data.daysLeft <= 3));
    }).catch(() => {});
  }, [outlets, outletId]);

  const omset = period === 'today' ? stats.omset_today : period === 'month' ? stats.omset_month : stats.total_omset;
  const pelunasan = period === 'today' ? stats.pelunasan_today : period === 'month' ? stats.pelunasan_month : stats.total_pelunasan;
  const transaksi = period === 'today' ? stats.transaksi_today : period === 'month' ? stats.transaksi_month : stats.total_transaksi;
  const piutang = Math.max(0, omset - pelunasan);
  const periodLabel = period === 'today' ? 'Hari Ini' : period === 'month' ? 'Bulan Ini' : 'Akumulasi';

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      paddingBottom: isMobile ? 80 : 100,
      background: 'linear-gradient(180deg, #F8F4FF 0%, #F1F5F9 50%, #E8EEF5 100%)'
    }}>

      {/* ── HEADER — glassmorphism gradient with animated blobs ── */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        padding: headerPadding,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Animated decorative blobs */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.08)',
          filter: 'blur(40px)',
          animation: 'floatBlob 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40,
          width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(250, 101, 65, 0.12)',
          filter: 'blur(30px)',
          animation: 'floatBlob 6s ease-in-out infinite reverse',
        }} />
        <div style={{
          position: 'absolute', top: 30, left: '30%',
          width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.06)',
          filter: 'blur(20px)',
          animation: 'floatBlob 5s ease-in-out infinite 0.5s',
        }} />

        {/* ── Beautiful Animated Background Elements ── */}
        {/* Floating light orbs */}
        <motion.div
          animate={{
            y: [0, -15, 0],
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: isMobile ? 20 : 30,
            right: isMobile ? 80 : 120,
            width: 40, height: 40,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{
            y: [0, 12, 0],
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 0.9, 1],
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          style={{
            position: 'absolute',
            bottom: isMobile ? 40 : 60,
            left: isMobile ? 60 : 100,
            width: 30, height: 30,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,215,0,0.5) 0%, transparent 70%)',
            filter: 'blur(6px)',
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{
            y: [0, -8, 0],
            opacity: [0.25, 0.55, 0.25],
            x: [0, 5, 0],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          style={{
            position: 'absolute',
            top: isMobile ? 50 : 70,
            left: isMobile ? 20 : 60,
            width: 20, height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.6) 0%, transparent 70%)',
            filter: 'blur(5px)',
            pointerEvents: 'none',
          }}
        />

        {/* Sparkle stars - SVG based */}
        <motion.div
          animate={{
            opacity: [0.4, 1, 0.4],
            scale: [0.8, 1.2, 0.8],
            rotate: [0, 180, 360],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            top: isMobile ? 15 : 25,
            right: isMobile ? 100 : 150,
            width: 24, height: 24,
            pointerEvents: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="rgba(255,255,255,0.9)" />
          </svg>
        </motion.div>
        <motion.div
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [0.6, 1, 0.6],
            rotate: [0, -180, -360],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          style={{
            position: 'absolute',
            bottom: isMobile ? 50 : 70,
            left: isMobile ? 40 : 80,
            width: 18, height: 18,
            pointerEvents: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="rgba(255,215,0,0.95)" />
          </svg>
        </motion.div>
        <motion.div
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.3, 1],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          style={{
            position: 'absolute',
            top: isMobile ? 35 : 50,
            right: isMobile ? 40 : 60,
            width: 14, height: 14,
            pointerEvents: 'none',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="rgba(255,255,255,0.7)" />
          </svg>
        </motion.div>

        {/* Shimmer effect line */}
        <motion.div
          animate={{
            x: [-100, 400],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          style={{
            position: 'absolute',
            top: isMobile ? 25 : 40,
            left: 0,
            width: 80,
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
            borderRadius: 1,
            pointerEvents: 'none',
          }}
        />
        <motion.div
          animate={{
            x: [-60, 300],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0,
          }}
          style={{
            position: 'absolute',
            bottom: isMobile ? 30 : 50,
            left: 0,
            width: 50,
            height: 1.5,
            background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5), transparent)',
            borderRadius: 1,
            pointerEvents: 'none',
          }}
        />

        {/* ── Animated Liquid Blob 1 ── */}
        <motion.div
          animate={{
            y: [0, -20, 0],
            x: [0, 15, 0],
            scale: [1, 1.15, 1, 0.9, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            position: 'absolute',
            top: isMobile ? -40 : -60,
            right: isMobile ? 80 : 180,
            width: isMobile ? 120 : 160,
            height: isMobile ? 100 : 130,
            pointerEvents: 'none',
          }}
        >
          {/* Outer glow */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: 'absolute',
              inset: -20,
              borderRadius: '60% 40% 70% 30% / 40% 60% 40% 60%',
              background: 'radial-gradient(circle, rgba(147, 51, 234, 0.5) 0%, transparent 70%)',
              filter: 'blur(25px)',
            }}
          />
          {/* Liquid blob core */}
          <motion.div
            animate={{
              borderRadius: ['60% 40% 70% 30% / 40% 60% 40% 60%', '30% 70% 30% 70% / 60% 40% 60% 40%', '60% 40% 70% 30% / 40% 60% 40% 60%'],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '60% 40% 70% 30% / 40% 60% 40% 60%',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.6) 0%, rgba(91, 0, 95, 0.5) 50%, rgba(167, 139, 250, 0.4) 100%)',
              filter: 'blur(15px)',
              boxShadow: '0 0 40px rgba(147, 51, 234, 0.5), inset 0 0 30px rgba(255,255,255,0.2)',
            }}
          />
          {/* Inner highlight */}
          <div style={{
            position: 'absolute',
            top: '20%',
            left: '25%',
            width: '40%',
            height: '30%',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.5) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }} />
        </motion.div>

        {/* ── Animated Liquid Blob 2 ── */}
        <motion.div
          animate={{
            y: [0, 15, 0],
            x: [0, -12, 0],
            scale: [1, 0.9, 1.1, 1],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          style={{
            position: 'absolute',
            bottom: isMobile ? -30 : -50,
            left: isMobile ? 100 : 200,
            width: isMobile ? 90 : 110,
            height: isMobile ? 80 : 95,
            pointerEvents: 'none',
          }}
        >
          {/* Outer glow */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            style={{
              position: 'absolute',
              inset: -15,
              borderRadius: '40% 60% 30% 70% / 60% 40% 60% 40%',
              background: 'radial-gradient(circle, rgba(255, 215, 0, 0.5) 0%, transparent 70%)',
              filter: 'blur(20px)',
            }}
          />
          {/* Liquid blob core */}
          <motion.div
            animate={{
              borderRadius: ['40% 60% 30% 70% / 60% 40% 60% 40%', '70% 30% 60% 40% / 30% 70% 40% 60%', '40% 60% 30% 70% / 60% 40% 60% 40%'],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '40% 60% 30% 70% / 60% 40% 60% 40%',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.55) 0%, rgba(250, 101, 65, 0.4) 50%, rgba(255, 183, 77, 0.3) 100%)',
              filter: 'blur(12px)',
              boxShadow: '0 0 35px rgba(255, 215, 0, 0.4), inset 0 0 25px rgba(255,255,255,0.15)',
            }}
          />
        </motion.div>

        {/* ── Animated Liquid Blob 3 - Small accent ── */}
        <motion.div
          animate={{
            y: [0, -10, 0],
            x: [0, 8, 0],
            scale: [1, 1.2, 0.85, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          style={{
            position: 'absolute',
            top: isMobile ? 50 : 80,
            right: isMobile ? 15 : 30,
            width: isMobile ? 45 : 55,
            height: isMobile ? 40 : 50,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            animate={{
              borderRadius: ['50% 50% 60% 40% / 60% 40% 50% 50%', '40% 60% 50% 50% / 50% 50% 40% 60%', '50% 50% 60% 40% / 60% 40% 50% 50%'],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50% 50% 60% 40% / 60% 40% 50% 50%',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.5) 0%, rgba(167, 139, 250, 0.4) 100%)',
              filter: 'blur(10px)',
              boxShadow: '0 0 25px rgba(255, 255, 255, 0.4)',
            }}
          />
        </motion.div>

        {/* ── Animated Liquid Blob 4 - Bottom left accent ── */}
        <motion.div
          animate={{
            y: [0, 12, 0],
            x: [0, -8, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          }}
          style={{
            position: 'absolute',
            bottom: isMobile ? -15 : -25,
            left: isMobile ? 20 : 40,
            width: isMobile ? 70 : 85,
            height: isMobile ? 60 : 70,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            animate={{
              borderRadius: ['30% 70% 50% 50% / 50% 30% 70% 50%', '50% 50% 30% 70% / 70% 50% 50% 30%', '30% 70% 50% 50% / 50% 30% 70% 50%'],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '30% 70% 50% 50% / 50% 30% 70% 50%',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.4) 0%, rgba(91, 0, 95, 0.5) 100%)',
              filter: 'blur(14px)',
              boxShadow: '0 0 30px rgba(236, 72, 153, 0.3)',
            }}
          />
        </motion.div>

        {/* ── Animated Liquid Blob 5 - Top left subtle ── */}
        <motion.div
          animate={{
            y: [0, -8, 0],
            scale: [1, 1.05, 0.95, 1],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.8,
          }}
          style={{
            position: 'absolute',
            top: isMobile ? 20 : 30,
            left: isMobile ? 10 : 20,
            width: isMobile ? 60 : 75,
            height: isMobile ? 50 : 60,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            animate={{
              borderRadius: ['60% 40% 50% 50% / 40% 60% 50% 50%', '50% 50% 60% 40% / 50% 50% 40% 60%', '60% 40% 50% 50% / 40% 60% 50% 50%'],
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '60% 40% 50% 50% / 40% 60% 50% 50%',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(139, 92, 246, 0.25) 100%)',
              filter: 'blur(12px)',
              boxShadow: '0 0 20px rgba(255, 255, 255, 0.2)',
            }}
          />
        </motion.div>

        {/* ── Mini Orbiting Liquid Blob ── */}
        <motion.div
          animate={{
            y: [0, -12, 0, 12, 0],
            x: [0, 10, 0, -10, 0],
            scale: [1, 1.15, 1, 0.9, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            position: 'absolute',
            top: isMobile ? 35 : 55,
            right: isMobile ? 25 : 45,
            width: isMobile ? 32 : 42,
            height: isMobile ? 32 : 42,
            pointerEvents: 'none',
          }}
        >
          <motion.div
            animate={{
              borderRadius: ['50% 50% 60% 40% / 60% 40% 50% 50%', '40% 60% 50% 50% / 50% 50% 40% 60%', '50% 50% 60% 40% / 60% 40% 50% 50%'],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50% 50% 60% 40% / 60% 40% 50% 50%',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(139, 92, 246, 0.5) 100%)',
              filter: 'blur(8px)',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)',
            }}
          />
        </motion.div>

        {/* ── Floating Liquid Particles ── */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, i % 2 === 0 ? -18 : 18, 0],
              x: [0, i % 3 === 0 ? 10 : i % 3 === 1 ? -10 : 5, 0],
              opacity: [0.25, 0.65, 0.25],
              scale: [0.8, 1.3, 0.8],
            }}
            transition={{
              duration: 3 + (i * 0.4),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.25,
            }}
            style={{
              position: 'absolute',
              top: 15 + (i * 15) % 70,
              left: 5 + (i * 20) % 60,
              width: isMobile ? 8 + (i % 3) * 3 : 10 + (i % 3) * 4,
              height: isMobile ? 8 + (i % 3) * 3 : 10 + (i % 3) * 4,
              borderRadius: `${30 + i * 10}% ${70 - i * 5}% ${50 + i * 5}% ${50 - i * 10}%`,
              background: i % 3 === 0
                ? 'rgba(255, 255, 255, 0.55)'
                : i % 3 === 1
                  ? 'rgba(167, 139, 250, 0.6)'
                  : 'rgba(255, 215, 0, 0.5)',
              filter: 'blur(4px)',
              boxShadow: i % 3 === 0
                ? '0 0 12px rgba(255,255,255,0.4)'
                : i % 3 === 1
                  ? '0 0 12px rgba(167, 139, 250, 0.4)'
                  : '0 0 12px rgba(255, 215, 0, 0.4)',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* ── Liquid Orbital Ring ── */}
        <motion.div
          animate={{
            rotate: [0, 360],
            scale: [1, 1.05, 1],
          }}
          transition={{
            rotate: { duration: 25, repeat: Infinity, ease: "linear" },
            scale: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{
            position: 'absolute',
            top: isMobile ? -40 : -60,
            right: isMobile ? 40 : 80,
            width: isMobile ? 140 : 180,
            height: isMobile ? 140 : 180,
            borderRadius: '50%',
            border: '2px solid transparent',
            background: 'linear-gradient(rgba(20, 0, 40, 0.3), rgba(20, 0, 40, 0.3)) padding-box, linear-gradient(90deg, rgba(255,255,255,0.1), rgba(147,51,234,0.15), rgba(255,255,255,0.1)) border-box',
            pointerEvents: 'none',
          }}
        />

        {/* ── Liquid Shimmer Line ── */}
        <motion.div
          animate={{
            x: [-50, 400],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          style={{
            position: 'absolute',
            top: isMobile ? 30 : 50,
            left: 0,
            width: 60,
            height: 4,
            borderRadius: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), rgba(167,139,250,0.4), transparent)',
            filter: 'blur(3px)',
            pointerEvents: 'none',
          }}
        />

        {/* Responsive header layout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            display: 'flex',
            alignItems: isMobile ? 'center' : 'flex-start',
            justifyContent: 'space-between',
            position: 'relative',
            paddingLeft: isMobile ? 8 : 16,
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 16 : 0,
          }}
        >
          {/* User info - on mobile center-aligned */}
          <div style={{
            textAlign: isMobile ? 'center' : 'left',
            width: isMobile ? '100%' : 'auto',
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>Selamat datang,</div>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: fontSize.hero,
              fontWeight: 800,
              color: 'white',
              marginTop: 4,
              letterSpacing: '-0.3px',
              textShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              {user.name.split(' ')[0]} 👋
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Admin{outletId && outletId !== '_all' ? ` · ${outlets.find(o => o.id === outletId)?.name || ''}` : ' · Semua outlet'}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: isMobile ? 8 : 10,
            alignItems: 'center',
            justifyContent: isMobile ? 'center' : 'flex-end',
          }}>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('notifikasi')}
              style={{
                width: isMobile ? 38 : 42,
                height: isMobile ? 38 : 42,
                borderRadius: isMobile ? 12 : 21,
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 16px rgba(91,0,95,0.2)',
              }}
            >
              <Bell size={isMobile ? 16 : 18} />
              <div style={{
                position: 'absolute', top: isMobile ? 6 : 8, right: isMobile ? 6 : 8,
                width: 8, height: 8, borderRadius: 4,
                background: '#F93E11',
                border: '2px solid white',
                boxShadow: '0 0 8px rgba(249,62,17,0.6)',
              }} />
            </motion.button>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('profil')}
              style={{
                width: isMobile ? 38 : 42,
                height: isMobile ? 38 : 42,
                borderRadius: isMobile ? 10 : 14,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                cursor: 'pointer',
              }}
            >
              <ProfileAvatar user={user} size={isMobile ? 30 : 34} />
            </motion.div>
          </div>
        </motion.div>

        {/* Add CSS animations */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes floatBlob {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(20px, -20px) scale(1.05); }
            66% { transform: translate(-10px, 15px) scale(0.95); }
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0.4; transform: scale(0.9); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}} />
      </div>

      <div style={{
        padding: contentPadding,
        marginTop: -12,
        paddingBottom: 20,
        position: 'relative',
        zIndex: 2
      }}>

        {/* Outlet selector + Period pill — claymorphism card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F4EDF4)',
            borderRadius: isMobile ? 16 : 20,
            padding: isMobile ? '14px 14px' : cardPadding,
            marginBottom: 14,
            boxShadow: '10px 10px 24px rgba(91, 0, 95, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(91, 0, 95, 0.06)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '30%',
            background: 'linear-gradient(180deg, rgba(91, 0, 95, 0.04), transparent)',
            pointerEvents: 'none',
          }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            position: 'relative',
            flexWrap: 'wrap'
          }}>
            <div style={{
              width: isMobile ? 30 : 34,
              height: isMobile ? 30 : 34,
              borderRadius: isMobile ? 10 : 12,
              background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '4px 4px 10px rgba(109, 40, 217, 0.15)'
            }}>
              <Home size={isMobile ? 14 : 16} color={C.primaryDark} />
            </div>
            <span style={{
              fontFamily: 'Poppins',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 700,
              color: C.n800
            }}>
              {outletId && outletId !== '_all' ? outlets.find(o => o.id === outletId)?.name || 'Pilih Outlet' : '📊 Semua Outlet'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            gap: 8,
            position: 'relative'
          }}>
            {['today', 'month', 'all'].map((p, idx) => {
              const active = period === p;
              const label = p === 'today' ? 'Hari ini' : p === 'month' ? 'Bulan ini' : 'Akumulasi';
              return (
                <motion.button
                  key={p}
                  onClick={() => setPeriod(p)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    flex: 1,
                    padding: isMobile ? '8px 4px' : '10px 0',
                    borderRadius: isMobile ? 10 : 12,
                    border: 'none',
                    background: active
                      ? 'linear-gradient(145deg, #5B005F, #8C4C8F)'
                      : 'linear-gradient(145deg, #F4EDF4, #E6D9E7)',
                    color: active ? C.white : C.primaryDark,
                    fontFamily: 'Poppins',
                    fontSize: isMobile ? 10 : 12,
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: active
                      ? '0 4px 14px rgba(110, 46, 120, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)'
                      : '2px 2px 6px rgba(109, 40, 217, 0.1)',
                    transition: 'all 0.2s ease',
                  }}
                >{label}</motion.button>
              );
            })}

            {/* Display Mode Toggle */}
            <div style={{
              display: 'flex',
              gap: 4,
              marginLeft: 'auto',
              padding: 3,
              background: 'rgba(139, 92, 246, 0.08)',
              borderRadius: 10,
            }}>
              <motion.button
                onClick={() => setDisplayMode('bar')}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: isMobile ? '5px 10px' : '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: displayMode === 'bar'
                    ? 'linear-gradient(145deg, #5B005F, #8C4C8F)'
                    : 'transparent',
                  color: displayMode === 'bar' ? C.white : C.n500,
                  fontFamily: 'Poppins',
                  fontSize: isMobile ? 9 : 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: isMobile ? 10 : 12 }}>≡</span>
                <span style={{ display: isMobile ? 'none' : 'inline' }}>Bar</span>
              </motion.button>
              <motion.button
                onClick={() => setDisplayMode('graph')}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: isMobile ? '5px 10px' : '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: displayMode === 'graph'
                    ? 'linear-gradient(145deg, #5B005F, #8C4C8F)'
                    : 'transparent',
                  color: displayMode === 'graph' ? C.white : C.n500,
                  fontFamily: 'Poppins',
                  fontSize: isMobile ? 9 : 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: isMobile ? 10 : 12 }}>📊</span>
                <span style={{ display: isMobile ? 'none' : 'inline' }}>Grafik</span>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {statsError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background: C.validationErrorBg,
              color: C.danger,
              padding: '12px 16px',
              borderRadius: 14,
              fontFamily: 'Poppins',
              fontSize: isMobile ? 11 : 12,
              marginBottom: 12,
              border: `1.5px solid ${C.validationErrorBorder}`,
              fontWeight: 600
            }}
          >{statsError}</motion.div>
        )}

        {/* ── HERO STAT CARD — with display mode toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
            borderRadius: cardRadius,
            padding: isMobile ? '12px' : '16px',
            boxShadow: '10px 10px 24px rgba(60, 10, 99, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
            marginBottom: 14,
            border: '1px solid rgba(139, 92, 246, 0.08)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: '25%',
            background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.04), transparent)',
            pointerEvents: 'none',
          }} />

          {/* ── BAR MODE: Compact horizontal stats ── */}
          <AnimatePresence mode="wait">
            {displayMode === 'bar' && (
              <motion.div
                key="bar-mode"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Main stats - 2 column grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
                  gap: isMobile ? 10 : 14,
                  marginBottom: isMobile ? 10 : 12,
                }}>
                  {/* Omset Card */}
                  <div style={{
                    background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
                    borderRadius: 14,
                    padding: isMobile ? '10px 12px' : '12px 14px',
                    border: '1px solid rgba(139, 92, 246, 0.1)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 8,
                        background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <FileText size={12} color={C.primaryDark} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.primaryDark }}>Omset {periodLabel}</span>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 16 : 20, fontWeight: 800, color: C.primaryDark, letterSpacing: '-0.3px' }}>{rp(omset)}</div>
                  </div>

                  {/* Pelunasan Card */}
                  <div style={{
                    background: 'linear-gradient(145deg, #F0FDF4, #D1FAE5)',
                    borderRadius: 14,
                    padding: isMobile ? '10px 12px' : '12px 14px',
                    border: '1px solid rgba(5, 150, 105, 0.1)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 8,
                        background: 'linear-gradient(145deg, #D1FAE5, #A7F3D0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <DollarSign size={12} color={C.success} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.success }}>Pelunasan</span>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 16 : 20, fontWeight: 800, color: C.success, letterSpacing: '-0.3px' }}>{rp(pelunasan)}</div>
                  </div>
                </div>

                {/* Piutang alert */}
                {piutang > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                      background: C.warningBg,
                      borderRadius: 10,
                      padding: '8px 12px',
                      marginBottom: isMobile ? 10 : 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={12} color={C.warning} strokeWidth={2.5} />
                      <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.warningDark }}>Piutang</span>
                    </div>
                    <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.warningDark }}>{rp(piutang)}</span>
                  </motion.div>
                )}

                {/* Mini stats row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  paddingTop: isMobile ? 8 : 10,
                  borderTop: '1px solid rgba(139, 92, 246, 0.08)',
                }}>
                  {[
                    { label: 'Nota', val: transaksi, color: C.primaryDark },
                    { label: 'Proses', val: stats.pending_transactions, color: C.info },
                    { label: 'Customer', val: stats.total_customers, color: C.success },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 13 : 16, fontWeight: 700, color: C.n800 }}>{s.val}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── GRAPH MODE: Stats with mini chart inside card ── */}
            {displayMode === 'graph' && (
              <motion.div
                key="graph-mode"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Stats + Mini Chart layout */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr',
                  gap: 14,
                  marginBottom: isMobile ? 10 : 12,
                }}>
                  {/* Left: Stats */}
                  <div>
                    {/* Omset & Pelunasan */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <FileText size={12} color={C.primaryDark} strokeWidth={2.5} />
                        <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.primaryDark }}>Omset {periodLabel}</span>
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.primaryDark }}>{rp(omset)}</div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <DollarSign size={12} color={C.success} strokeWidth={2.5} />
                        <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, color: C.success }}>Pelunasan</span>
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.success }}>{rp(pelunasan)}</div>
                    </div>
                    {piutang > 0 && (
                      <div style={{
                        background: C.warningBg,
                        borderRadius: 10,
                        padding: '6px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.warningDark }}>Piutang</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.warningDark }}>{rp(piutang)}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Mini donut chart */}
                  <div style={{
                    background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
                    borderRadius: 14,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(139, 92, 246, 0.1)',
                  }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n500, marginBottom: 8 }}>Rasio Pelunasan</div>
                    {/* Simple donut visualization */}
                    <div style={{ position: 'relative', width: isMobile ? 80 : 100, height: isMobile ? 80 : 100 }}>
                      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        {/* Background circle */}
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(139, 92, 246, 0.1)" strokeWidth="3" />
                        {/* Progress circle */}
                        <motion.circle
                          cx="18" cy="18" r="15.5"
                          fill="none"
                          stroke={C.success}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(100, Math.round((pelunasan / (omset || 1)) * 100))} 100`}
                          initial={{ strokeDasharray: '0 100' }}
                          animate={{ strokeDasharray: `${Math.min(100, Math.round((pelunasan / (omset || 1)) * 100))} 100` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                        />
                      </svg>
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 14 : 16, fontWeight: 800, color: C.n800 }}>
                          {Math.min(100, Math.round((pelunasan / (omset || 1)) * 100))}%
                        </div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 6 }}>
                      {rp(pelunasan)} / {rp(omset)}
                    </div>
                  </div>
                </div>

                {/* Mini stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  paddingTop: isMobile ? 8 : 10,
                  borderTop: '1px solid rgba(139, 92, 246, 0.08)',
                }}>
                  {[
                    { label: 'Nota', val: transaksi, color: C.primaryDark },
                    { label: 'Proses', val: stats.pending_transactions, color: C.info },
                    { label: 'Customer', val: stats.total_customers, color: C.success },
                  ].map((s) => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 13 : 16, fontWeight: 700, color: C.n800 }}>{s.val}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── COMPACT WIDGET GRID (2-3 columns) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: 12,
          marginBottom: 14,
        }}>
          {/* Transaction Metrics Widget */}
          <div>
            <TransactionMetricsWidget
              period={metricsPeriod}
              onPeriodChange={setMetricsPeriod}
            />
          </div>

          {/* Low Stock Alert Widget */}
          <div>
            <LowStockAlertWidget
              compact={true}
              maxItems={3}
              onViewAll={() => navigate('admin_inventory')}
            />
          </div>
        </div>

        {/* Daily Target Progress Widget */}
        {targetDaily?.targets && targetDaily.targets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            style={{
              background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
              borderRadius: sectionCardRadius,
              padding: isMobile ? '14px 14px' : '16px 18px',
              marginBottom: 14,
              boxShadow: '10px 10px 24px rgba(60, 10, 99, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(139, 92, 246, 0.08)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  borderRadius: isMobile ? 10 : 12,
                  background: 'linear-gradient(145deg, #FFEDD5, #FED7AA)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '4px 4px 10px rgba(234, 88, 12, 0.15)',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: isMobile ? 18 : 20 }}>🎯</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 700, color: C.n800 }}>📈 Target & Capaian</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
                    {targetDaily.monthName} {targetDaily.year}
                  </div>
                </div>
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primaryDark }}>
                {targetDaily.summary.avgPercentage}%
              </div>
            </div>

            {/* Summary stats */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}>
              <div style={{
                flex: 1,
                minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
                background: C.successBg,
                borderRadius: 10,
                padding: '8px 10px',
                textAlign: 'center'
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: C.success }}>
                  {targetDaily.summary.onTrackCount}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>On Track</div>
              </div>
              <div style={{
                flex: 1,
                minWidth: isMobile ? 'calc(50% - 4px)' : 'auto',
                background: C.warningBg,
                borderRadius: 10,
                padding: '8px 10px',
                textAlign: 'center'
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: C.warning }}>
                  {targetDaily.summary.achievedCount}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>Terpenuhi</div>
              </div>
              <div style={{
                flex: 1,
                minWidth: isMobile ? '100%' : 'auto',
                background: C.primaryTint,
                borderRadius: 10,
                padding: '8px 10px',
                textAlign: 'center'
              }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 800, color: C.primaryDark }}>
                  {rp(targetDaily.summary.totalActual)}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2 }}>Total Realisasi</div>
              </div>
            </div>

            {/* Outlet target list - scrollable on mobile */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowX: isMobile ? 'auto' : 'visible',
              paddingBottom: 4,
            }}>
              {targetDaily.targets.slice(0, 4).map((t, idx) => {
                const statusColor = t.status === 'achieved' ? C.success :
                  t.status === 'on_track' ? C.success :
                  t.status === 'behind' ? C.warning : C.danger;
                return (
                  <div key={t.outletId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                        <span style={{
                          fontFamily: 'Poppins',
                          fontSize: isMobile ? 10 : 11,
                          fontWeight: 600,
                          color: C.n800,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>{t.outletName}</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: statusColor }}>{t.percentage}%</span>
                      </div>
                      <div style={{ background: C.n200, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, t.percentage)}%` }}
                          transition={{ duration: 0.6, delay: idx * 0.05 }}
                          style={{ height: '100%', background: statusColor, borderRadius: 4 }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <motion.button
              onClick={() => navigate('admin_target')}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                marginTop: 12,
                padding: isMobile ? '8px' : '10px',
                background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'Poppins',
                fontSize: isMobile ? 11 : 12,
                fontWeight: 600,
                color: C.primaryDark,
              }}
            >
              Kelola Target →
            </motion.button>
          </motion.div>
        )}

        {/* ── CHARTS GRID (2 columns on desktop) ── */}
        {/* Chart Period Selector — compact inline */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 12,
        }}>
          <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 700, color: C.n800 }}>📊 Grafik Periode</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {['7d', '30d', '90d'].map((p) => {
              const active = chartPeriod === p;
              const label = p === '7d' ? '7H' : p === '30d' ? '30H' : '90H';
              return (
                <motion.button
                  key={p}
                  onClick={() => setChartPeriod(p)}
                  whileTap={{ scale: 0.95 }}
                  style={{
                    padding: isMobile ? '4px 8px' : '5px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: active
                      ? 'linear-gradient(145deg, #5B005F, #8C4C8F)'
                      : 'rgba(139, 92, 246, 0.08)',
                    color: active ? C.white : C.n500,
                    fontFamily: 'Poppins',
                    fontSize: isMobile ? 9 : 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >{label}</motion.button>
              );
            })}
          </div>
        </div>

        {/* ═══ TREN + METODE BAYAR — 1 CARD FULL WIDTH ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
            borderRadius: sectionCardRadius,
            padding: isMobile ? '14px' : '16px',
            boxShadow: '6px 6px 16px rgba(60, 10, 99, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.08)',
            marginBottom: 14,
          }}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
          }}>
            {/* Left: Tren Bayar */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n800 }}>📈 Tren Bayar</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500 }}>14 hari terakhir</span>
              </div>
              <PaymentTrendChart days={14} height={isMobile ? 120 : 140} />
            </div>

            {/* Right: Metode Bayar */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n800 }}>💳 Metode Bayar</span>
                <span style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500 }}>Terbaru</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { method: 'Tunai', count: 12, amount: 2450000, color: C.success, icon: '💵' },
                  { method: 'QRIS', count: 8, amount: 1800000, color: C.info, icon: '📱' },
                  { method: 'Transfer', count: 5, amount: 950000, color: C.primaryDark, icon: '🏦' },
                  { method: 'Debit', count: 3, amount: 450000, color: C.warning, icon: '💳' },
                ].map((item) => (
                  <div key={item.method} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10,
                      background: `${item.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                      boxShadow: `2px 2px 6px ${item.color}20`,
                    }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n800 }}>{item.method}</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: item.color }}>{rp(item.amount)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500 }}>{item.count}x transaksi</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500 }}>{Math.round((item.amount / 5650000) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ MANAJEMEN ═══ — claymorphism cards - responsive grid */}
        <CollapsibleSection title="Manajemen" icon="⚙️" defaultOpen={true}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : (isTablet ? '1fr 1fr' : '1fr 1fr'),
            gap: isMobile ? 10 : 12
          }}>
            {[
              { label: 'User & Pegawai', screen: 'manajemen_user', icon: '👥', color: C.primary },
              { label: 'Layanan & Harga', screen: 'manajemen_layanan', icon: '🧺', color: C.info },
              { label: 'Outlet', screen: 'manajemen_outlet', icon: '🏪', color: C.info },
              { label: 'Target & Capaian', screen: 'admin_target', icon: '🎯', color: C.warning },
              { label: 'Birthday Program', screen: 'birthday', icon: '🎂', color: '#EC4899' },
              { label: 'Error Dashboard', screen: 'error_dashboard', icon: '🔍', color: C.danger },
            ].map((item, idx) => (
              <motion.button
                key={item.label}
                onClick={() => navigate(item.screen)}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + idx * 0.03 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 10 : 12,
                  padding: isMobile ? '14px 12px' : '16px 14px',
                  borderRadius: isMobile ? 14 : 18,
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  border: '1.5px solid rgba(139, 92, 246, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: '6px 6px 16px rgba(60, 10, 99, 0.1), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                }}
              >
                <div style={{
                  width: isMobile ? 40 : 46,
                  height: isMobile ? 40 : 46,
                  borderRadius: isMobile ? 12 : 14,
                  background: `linear-gradient(145deg, ${item.color}18, ${item.color}08)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 18 : 20,
                  flexShrink: 0,
                  boxShadow: `6px 6px 14px ${item.color}20, -3px -3px 8px rgba(255, 255, 255, 0.9)`,
                }}>{item.icon}</div>
                <span style={{ fontFamily: 'Poppins', fontSize: isMobile ? 11 : 12, fontWeight: 600, color: C.n800 }}>{item.label}</span>
              </motion.button>
            ))}
          </div>
        </CollapsibleSection>

        {/* ═══ LAPORAN & ANALITIK ═══ */}
        <CollapsibleSection title="Laporan & Analitik" icon="📈" defaultOpen={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Laporan Outlet', desc: 'Revenue, payment mix, top services per outlet', screen: 'laporan_per_outlet', icon: '📊', color: C.primary },
              { label: 'Laporan Pusat', desc: 'Executive summary semua outlet', screen: 'admin_laporan', icon: '📈', color: C.info },
              { label: 'Perbandingan Periode', desc: 'Bandingkan 2 periode side-by-side', screen: 'comparison_report', icon: '⚖️', color: C.info },
              { label: 'Forecast', desc: 'Prediksi revenue berdasarkan tren', screen: 'forecast', icon: '🔮', color: C.primary },
              { label: 'Rekap Pendapatan', desc: 'Detail pemasukan per metode bayar', screen: 'rekap_pendapatan', icon: '💰', color: C.success },
            ].map((item, idx) => (
              <motion.button
                key={item.label}
                onClick={() => navigate(item.screen)}
                whileHover={{ x: 4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + idx * 0.03 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 12 : 14,
                  padding: isMobile ? '12px 14px' : '14px 16px',
                  borderRadius: isMobile ? 14 : 16,
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  border: '1.5px solid rgba(139, 92, 246, 0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  boxShadow: '6px 6px 16px rgba(60, 10, 99, 0.1), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                }}
              >
                <div style={{
                  width: isMobile ? 38 : 44,
                  height: isMobile ? 38 : 44,
                  borderRadius: isMobile ? 12 : 14,
                  background: `linear-gradient(145deg, ${item.color}18, ${item.color}08)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 18 : 20,
                  flexShrink: 0,
                  boxShadow: `6px 6px 14px ${item.color}20, -3px -3px 8px rgba(255, 255, 255, 0.9)`,
                }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 600, color: C.n800 }}>{item.label}</div>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: isMobile ? 10 : 11,
                    color: C.n500,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: isMobile ? 'nowrap' : 'normal',
                  }}>{item.desc}</div>
                </div>
                <ChevronRight size={isMobile ? 16 : 18} color={item.color} strokeWidth={2.5} />
              </motion.button>
            ))}
          </div>
        </CollapsibleSection>

        {/* ═══ OPERASIONAL ═══ */}
        <CollapsibleSection title="Operasional" icon="⚡" defaultOpen={false}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : (isTablet ? '1fr 1fr 1fr' : '1fr 1fr 1fr'),
            gap: isMobile ? 8 : 10
          }}>
            {[
              { label: 'Approval', screen: 'approval', icon: '✅', color: C.primary },
              { label: 'Approval Setor', screen: 'setor_approval', icon: '💵', color: C.success },
              { label: 'Inventori', screen: 'admin_inventory', icon: '📦', color: C.info },
              { label: 'Shift Kasir', screen: 'admin_shift', icon: '🕐', color: C.info },
              { label: 'Tutup Buku', screen: 'admin_period_close', icon: '📒', color: C.info },
              { label: 'Kas Outlet', screen: 'kas_outlet', icon: '💼', color: C.success },
              { label: 'Kas Overview', screen: 'admin_kas_overview', icon: '📊', color: C.success },
            ].map((item, idx) => (
              <motion.button
                key={item.label}
                onClick={() => navigate(item.screen)}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 + idx * 0.02 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: isMobile ? 6 : 8,
                  padding: isMobile ? '14px 6px' : '16px 8px',
                  borderRadius: isMobile ? 14 : 16,
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  border: '1.5px solid rgba(139, 92, 246, 0.08)',
                  cursor: 'pointer',
                  boxShadow: '5px 5px 12px rgba(60, 10, 99, 0.1), -2px -2px 8px rgba(255, 255, 255, 0.95)',
                }}
              >
                <div style={{
                  width: isMobile ? 38 : 44,
                  height: isMobile ? 38 : 44,
                  borderRadius: isMobile ? 12 : 14,
                  background: `linear-gradient(145deg, ${item.color}18, ${item.color}08)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? 18 : 20,
                  flexShrink: 0,
                  boxShadow: `5px 5px 12px ${item.color}18, -2px -2px 6px rgba(255, 255, 255, 0.9)`,
                }}>{item.icon}</div>
                <span style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: isMobile ? 9 : 10,
                  fontWeight: 600,
                  color: C.n800,
                  textAlign: 'center',
                  lineHeight: 1.3
                }}>{item.label}</span>
              </motion.button>
            ))}
          </div>
        </CollapsibleSection>

      </div>
    </div>
  );
}
