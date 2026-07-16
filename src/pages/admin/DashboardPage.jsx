import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useResponsive } from '../../utils/hooks';
import { Avatar, useAppRefresh, StatCard, StatCardGrid, ChartCard, ChartCardGrid } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, ChevronRight, ChevronDown, Home, FileText, DollarSign, AlertCircle,
  LayoutGrid, Clock, User,
} from 'lucide-react';
import { checkLowBalance } from '../../utils/outletCashApi';
import LowStockAlertWidget from '../../components/LowStockAlertWidget';
import TransactionMetricsWidget from '../../components/TransactionMetricsWidget';
import OutletComparisonWidget from '../../components/OutletComparisonWidget';
import PaymentTrendChart from '../../components/PaymentTrendChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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

        {/* Sparkles */}
        <div style={{
          position: 'absolute', top: 25, right: isMobile ? 100 : 140,
          fontSize: 14, animation: 'twinkle 2s ease-in-out infinite',
        }}>✨</div>
        <div style={{
          position: 'absolute', bottom: 50, left: 50,
          fontSize: 12, animation: 'twinkle 2.5s ease-in-out infinite 0.5s',
        }}>⭐</div>

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
              <Avatar photo={user.photo} initials={user.avatar} size={isMobile ? 30 : 34} />
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

        {/* ── HERO STAT CARD — claymorphism floating card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
            borderRadius: cardRadius,
            padding: cardPadding,
            boxShadow: '12px 12px 28px rgba(60, 10, 99, 0.12), -6px -6px 16px rgba(255, 255, 255, 0.95)',
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

          {/* Stats row - responsive layout */}
          <div style={{
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'stretch',
            gap: 0,
            marginBottom: 12,
            position: 'relative',
            flexDirection: isMobile ? 'column' : 'row',
          }}>
            {/* Omset */}
            <div style={{
              flex: 1,
              paddingRight: isMobile ? 0 : 14,
              marginBottom: isMobile ? 12 : 0,
              borderRight: isMobile ? 'none' : '1.5px solid rgba(139, 92, 246, 0.2)',
              borderBottom: isMobile ? '1.5px solid rgba(139, 92, 246, 0.2)' : 'none',
              paddingBottom: isMobile ? 12 : 0,
            }}>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
              >
                <div style={{
                  width: isMobile ? 24 : 28,
                  height: isMobile ? 24 : 28,
                  borderRadius: isMobile ? 8 : 10,
                  background: 'linear-gradient(145deg, #EDE9FE, #DDD6FE)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '4px 4px 10px rgba(109, 40, 217, 0.15)'
                }}>
                  <FileText size={isMobile ? 12 : 14} color={C.primaryDark} strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: fontSize.label, fontWeight: 600, color: C.primaryDark }}>Omset {periodLabel}</span>
              </motion.div>
              <div style={{ fontFamily: 'Poppins', fontSize: fontSize.stat, fontWeight: 800, color: C.primaryDark, letterSpacing: '-0.5px' }}>{rp(omset)}</div>
            </div>

            {/* Pelunasan */}
            <div style={{
              flex: 1,
              paddingLeft: isMobile ? 0 : 14,
              paddingTop: isMobile ? 12 : 0,
            }}>
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
              >
                <div style={{
                  width: isMobile ? 24 : 28,
                  height: isMobile ? 24 : 28,
                  borderRadius: isMobile ? 8 : 10,
                  background: 'linear-gradient(145deg, #D1FAE5, #A7F3D0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '4px 4px 10px rgba(5, 150, 105, 0.15)'
                }}>
                  <DollarSign size={isMobile ? 12 : 14} color={C.success} strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: fontSize.label, fontWeight: 600, color: C.success }}>Pelunasan</span>
              </motion.div>
              <div style={{ fontFamily: 'Poppins', fontSize: fontSize.stat, fontWeight: 800, color: C.success, letterSpacing: '-0.5px' }}>{rp(pelunasan)}</div>
            </div>
          </div>

          {piutang > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: C.warningBg,
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 8,
                  background: C.warningBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertCircle size={12} color={C.warning} strokeWidth={2.5} />
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.warningDark }}>Piutang</span>
              </div>
              <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.warningDark }}>{rp(piutang)}</span>
            </motion.div>
          )}

          {/* Stat row */}
          <div style={{
            display: 'flex',
            gap: 0,
            borderTop: '1px solid rgba(139, 92, 246, 0.08)',
            paddingTop: 12,
            flexWrap: 'wrap',
          }}>
            {[
              { label: 'Nota', val: transaksi, color: C.info, icon: <LayoutGrid size={12} strokeWidth={2.5} /> },
              { label: 'Proses', val: stats.pending_transactions, color: C.info, icon: <Clock size={12} strokeWidth={2.5} /> },
              { label: 'Customer', val: stats.total_customers, color: C.success, icon: <User size={12} strokeWidth={2.5} /> },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  borderRight: i < 2 && !isMobile ? '1px solid rgba(139, 92, 246, 0.08)' : 'none',
                  padding: isMobile ? '8px 4px' : '6px 4px 4px',
                  minWidth: isMobile ? '33.33%' : 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 8,
                    background: `${s.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</span>
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 16 : 18, fontWeight: 700, color: C.n800 }}>{s.val}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Phase 4: Dashboard Intelligence Widgets */}

        {/* Transaction Metrics Widget */}
        <TransactionMetricsWidget
          period={metricsPeriod}
          onPeriodChange={setMetricsPeriod}
        />

        {/* Low Stock Alert Widget */}
        <LowStockAlertWidget
          compact={true}
          maxItems={3}
          onViewAll={() => navigate('admin_inventory')}
        />

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

        {/* Outlet Comparison Widget — Phase 4 */}
        <OutletComparisonWidget
          onSelectOutlet={(outletId) => {
            setAdminOutletId(outletId);
            setPeriod('today');
          }}
        />

        {/* Chart Period Selector — claymorphism pill */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
            borderRadius: isMobile ? 14 : 16,
            padding: isMobile ? '12px 14px' : '14px 18px',
            marginBottom: 14,
            boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.06)',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}>
            <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 12 : 13, fontWeight: 700, color: C.n800 }}>Periode Grafik</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['7d', '30d', '90d'].map((p) => {
                const active = chartPeriod === p;
                const label = p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : '90 Hari';
                return (
                  <motion.button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: isMobile ? '5px 10px' : '6px 14px',
                      borderRadius: isMobile ? 8 : 10,
                      border: 'none',
                      background: active
                        ? 'linear-gradient(145deg, #8B5CF6, #5B005F)'
                        : 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
                      color: active ? C.white : C.primaryDark,
                      fontFamily: 'Poppins',
                      fontSize: isMobile ? 10 : 11,
                      fontWeight: active ? 700 : 600,
                      cursor: 'pointer',
                      boxShadow: active
                        ? '0 4px 12px rgba(110, 46, 120, 0.3)'
                        : '2px 2px 6px rgba(109, 40, 217, 0.1)',
                    }}
                  >{label}</motion.button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Outlet Performance Chart — claymorphism card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
            borderRadius: sectionCardRadius,
            padding: isMobile ? '12px 12px' : '14px 16px',
            marginBottom: 14,
            boxShadow: '10px 10px 24px rgba(60, 10, 99, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.08)',
            overflowX: 'auto',
          }}
        >
          <div style={{
            fontFamily: 'Poppins',
            fontSize: isMobile ? 12 : 13,
            fontWeight: 700,
            color: C.n800,
            marginBottom: 12,
            whiteSpace: 'nowrap'
          }}>
            🏪 Performa Omzet per Outlet
          </div>
          {loadingCharts ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 28, height: 28, border: `3px solid ${C.n200}`,
                  borderTopColor: C.primary,
                  borderRadius: '50%',
                  margin: '0 auto 10px',
                }}
              />
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat grafik...</span>
            </div>
          ) : outletPerformance.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.n500, fontFamily: 'Poppins', fontSize: 12 }}>Belum ada data transaksi</div>
          ) : (
            <>
              {outletPerformance.filter(o => o.isActive).length > 0 && (
                <div style={{ marginBottom: 14, minWidth: isMobile ? 300 : 'auto' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.success, marginBottom: 6 }}>Aktif</div>
                  <ResponsiveContainer width="100%" height={isMobile ? 160 : 180}>
                    <BarChart data={outletPerformance.filter(o => o.isActive)} margin={isMobile ? { top: 5, right: 10, left: -20, bottom: 5 } : {}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.08)" />
                      <XAxis dataKey="outletName" tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} interval={isMobile ? 'preserveStartEnd' : 0} />
                      <YAxis tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} tickFormatter={(val) => rp(val).replace('Rp ', '')} width={isMobile ? 40 : 60} />
                      <Tooltip
                        formatter={(value) => rp(value)}
                        contentStyle={{ fontFamily: 'Poppins', borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.1)', boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.1)', fontSize: 11 }}
                      />
                      <Bar dataKey="totalRevenue" fill={C.primary} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {outletPerformance.filter(o => !o.isActive).length > 0 && (
                <div style={{ minWidth: isMobile ? 300 : 'auto' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, marginBottom: 6 }}>Non Aktif</div>
                  <ResponsiveContainer width="100%" height={isMobile ? 160 : 180}>
                    <BarChart data={outletPerformance.filter(o => !o.isActive)} margin={isMobile ? { top: 5, right: 10, left: -20, bottom: 5 } : {}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.n200} />
                      <XAxis dataKey="outletName" tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} interval={isMobile ? 'preserveStartEnd' : 0} />
                      <YAxis tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} tickFormatter={(val) => rp(val).replace('Rp ', '')} width={isMobile ? 40 : 60} />
                      <Tooltip
                        formatter={(value) => rp(value)}
                        contentStyle={{ fontFamily: 'Poppins', borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.1)', boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.1)', fontSize: 11 }}
                      />
                      <Bar dataKey="totalRevenue" fill={C.n500} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Cash Deposit Status Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
            borderRadius: sectionCardRadius,
            padding: isMobile ? '12px 12px' : '14px 16px',
            marginBottom: 14,
            boxShadow: '10px 10px 24px rgba(60, 10, 99, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.08)',
            overflowX: 'auto',
          }}
        >
          <div style={{
            fontFamily: 'Poppins',
            fontSize: isMobile ? 12 : 13,
            fontWeight: 700,
            color: C.n800,
            marginBottom: 12,
            whiteSpace: 'nowrap'
          }}>
            💵 Status Setoran Kas per Outlet
          </div>
          {loadingCharts ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.n500, fontFamily: 'Poppins', fontSize: 12 }}>Memuat grafik...</div>
          ) : cashDepositStatus.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.n500, fontFamily: 'Poppins', fontSize: 12 }}>Belum ada data setoran</div>
          ) : (
            <>
              {cashDepositStatus.filter(o => o.isActive).length > 0 && (
                <div style={{ marginBottom: 14, minWidth: isMobile ? 300 : 'auto' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.success, marginBottom: 6 }}>Aktif</div>
                  <ResponsiveContainer width="100%" height={isMobile ? 160 : 180}>
                    <BarChart data={cashDepositStatus.filter(o => o.isActive)} margin={isMobile ? { top: 5, right: 10, left: -20, bottom: 5 } : {}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.08)" />
                      <XAxis dataKey="outletName" tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} interval={isMobile ? 'preserveStartEnd' : 0} />
                      <YAxis tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} tickFormatter={(val) => rp(val).replace('Rp ', '')} width={isMobile ? 40 : 60} />
                      <Tooltip
                        formatter={(value) => rp(value)}
                        contentStyle={{ fontFamily: 'Poppins', borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.1)', boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.1)', fontSize: 11 }}
                      />
                      <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: isMobile ? 8 : 10 }} />
                      <Bar dataKey="approvedAmount" stackId="a" name="Disetujui" fill={C.success} radius={[0, 0, 8, 8]} />
                      <Bar dataKey="pendingAmount" stackId="a" name="Menunggu" fill={C.warning} />
                      <Bar dataKey="rejectedAmount" stackId="a" name="Ditolak" fill={C.danger} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {cashDepositStatus.filter(o => !o.isActive).length > 0 && (
                <div style={{ minWidth: isMobile ? 300 : 'auto' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n500, marginBottom: 6 }}>Non Aktif</div>
                  <ResponsiveContainer width="100%" height={isMobile ? 160 : 180}>
                    <BarChart data={cashDepositStatus.filter(o => !o.isActive)} margin={isMobile ? { top: 5, right: 10, left: -20, bottom: 5 } : {}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.n200} />
                      <XAxis dataKey="outletName" tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} interval={isMobile ? 'preserveStartEnd' : 0} />
                      <YAxis tick={{ fontSize: isMobile ? 8 : 10, fontFamily: 'Poppins' }} tickFormatter={(val) => rp(val).replace('Rp ', '')} width={isMobile ? 40 : 60} />
                      <Tooltip
                        formatter={(value) => rp(value)}
                        contentStyle={{ fontFamily: 'Poppins', borderRadius: 12, border: '1px solid rgba(139, 92, 246, 0.1)', boxShadow: '8px 8px 20px rgba(60, 10, 99, 0.1)', fontSize: 11 }}
                      />
                      <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: isMobile ? 8 : 10 }} />
                      <Bar dataKey="approvedAmount" stackId="a" name="Disetujui" fill={C.successBg} radius={[0, 0, 8, 8]} />
                      <Bar dataKey="pendingAmount" stackId="a" name="Menunggu" fill={C.warningBg} />
                      <Bar dataKey="rejectedAmount" stackId="a" name="Ditolak" fill={C.dangerBg} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </motion.div>

        {/* Payment Trend Chart — Phase 4 */}
        <PaymentTrendChart days={14} height={isMobile ? 180 : 200} />

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
