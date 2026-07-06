// ─────────────────────────────────────────────────────────────────────────────
// KasirDashboardPage.jsx — Redesigned with Responsive Grid Layout
// Mobile: 1 column stacked │ Desktop: Multi-column packed to top
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { Avatar, Badge, Btn, SectionHeader, useAppRefresh, TransactionMetricsWidget, LowStockAlertWidget } from '../../components/ui';
import TradingLineChart from '../../components/ui/TradingLineChart';
import { alertWarning } from '../../utils/alert';
import TodayTargetWidget from '../../components/TodayTargetWidget';
import { useRealtimeMulti } from '../../utils/realtime';
import { checkLowBalance } from '../../utils/outletCashApi';
import { CharacterAvatar } from '../../components/CharacterAvatar';
import { motion } from 'framer-motion';
import {
  Plus, List, Users, CreditCard, DollarSign, TrendingUp,
  Clock, ArrowLeftRight, PenLine, Wallet, Package,
  Bell, FileText, AlertCircle, LayoutGrid, Zap, Check, ChevronRight, X,
} from 'lucide-react';

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

// Sparkle dengan multiple colors dan styles
const Sparkle = ({ top, left, size = 6, delay = 0, color = '#FFD700' }) => (
  <motion.div
    style={{
      position: 'absolute', top, left, width: size, height: size,
      pointerEvents: 'none', zIndex: 2,
    }}
    animate={{
      scale: [0, 1.2, 0],
      opacity: [0, 1, 0],
      rotate: [0, 180, 360],
    }}
    transition={{ duration: 2, delay, repeat: Infinity, ease: 'easeOut' }}
  >
    {/* Star shape */}
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ filter: `drop-shadow(0 0 ${size/2}px ${color})` }}>
      <path
        d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
        fill={color}
      />
    </svg>
  </motion.div>
);

// GlowOrb with animation
const GlowOrb = ({ color = 'rgba(91, 0, 95, 0.08)', size = 200, top, left, right, bottom, blur = 40 }) => (
  <motion.div
    animate={{
      scale: [1, 1.15, 1],
      opacity: [0.6, 0.8, 0.6],
    }}
    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      position: 'absolute', top, left, right, bottom, width: size, height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: `blur(${blur}px)`,
      pointerEvents: 'none', zIndex: 0,
    }}
  />
);

const WIB_FORMATTER = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const WIB_TIME = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const SHIFT_LABEL = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam', full: 'Full Day' };

const STATUS_META = {
  baru: { label: 'Baru', color: C.prosesText, bg: C.prosesBg },
  diproses: { label: 'Proses', color: C.prosesText, bg: C.prosesBg },
  selesai: { label: 'Selesai', color: C.success, bg: C.successBg },
  siap_diambil: { label: 'Siap Ambil', color: C.primary, bg: C.primaryTint },
  selesai_diambil: { label: 'Diambil', color: C.n600, bg: C.n100 },
  dibatalkan: { label: 'Batal', color: C.batalText, bg: C.batalBg },
};

function fmtElapsed(openedAt) {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function fmtTime(v) {
  if (!v) return '';
  return new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
}

// ─── Responsive Hook ─────────────────────────────────────────────────────────
const useResponsive = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1024,
    isDesktop: width >= 1024,
    width,
  };
};

// ─── Mini Sparkline Chart ─────────────────────────────────────────────────────
function MiniSparkline({ data = [], color = '#10B981', width = 80, height = 40 }) {
  if (!data || data.length < 2) {
    // Default line if no data
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={`M0 ${height/2} L${width} ${height/2}`}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const max = Math.max(...data.map(d => typeof d === 'object' ? d.value : d));
  const min = Math.min(...data.map(d => typeof d === 'object' ? d.value : d));
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const val = typeof d === 'object' ? d.value : d;
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  // Create gradient fill
  const gradientId = `sparkline-grad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Fill */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={width}
        cy={points.split(' ').pop().split(',')[1]}
        r="3"
        fill={color}
      />
    </svg>
  );
}

// ─── Trend Indicator ───────────────────────────────────────────────────────────
function TrendIndicator({ value, positive = true }) {
  const color = positive ? '#10B981' : '#EF4444';
  const icon = positive ? '↑' : '↓';
  return (
    <span style={{
      fontFamily: 'Poppins',
      fontSize: 10,
      fontWeight: 600,
      color: color,
      marginLeft: 4,
    }}>
      {icon} {value}%
    </span>
  );
}

// ─── Stat Card Component ──────────────────────────────────────────────────────
function StatCard({ icon, label, value, sublabel, color = '#5B005F', delay = 0, sparklineData = [], trend = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F8F7FC)',
        borderRadius: 14,
        padding: '12px 14px',
        boxShadow: '4px 4px 12px rgba(91, 0, 95, 0.06), -2px -2px 8px rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(91, 0, 95, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 90,
      }}
    >
      {/* Top row: Icon + Label + Sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(145deg, ${color}15, ${color}08)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
          <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: color }}>
            {label}
          </span>
        </div>
        {/* Mini Sparkline */}
        <MiniSparkline data={sparklineData} color={color} width={60} height={32} />
      </div>

      {/* Value with trend */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: '#1E293B', letterSpacing: '-0.5px' }}>
          {value}
        </span>
        {trend !== 0 && <TrendIndicator value={Math.abs(trend)} positive={trend > 0} />}
      </div>

      {/* Sublabel */}
      {sublabel && (
        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#94A3B8' }}>{sublabel}</div>
      )}
    </motion.div>
  );
}

// ─── Quick Action Button ──────────────────────────────────────────────────────
function QuickAction({ label, icon, color, badge, onClick, cols = 2 }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '12px 8px',
        borderRadius: 14,
        background: 'linear-gradient(145deg, #FFFFFF, #F4EDF4)',
        border: '1.5px solid rgba(91, 0, 95, 0.06)',
        cursor: 'pointer',
        boxShadow: '5px 5px 12px rgba(91, 0, 95, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: `linear-gradient(145deg, ${color}08, ${color}03)`,
        opacity: 0,
        transition: 'opacity 0.2s',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `linear-gradient(145deg, ${color}18, ${color}08)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          boxShadow: `3px 3px 10px ${color}18, -2px -2px 5px rgba(255, 255, 255, 0.9)`,
        }}>
          {icon}
        </div>
        {badge && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute', top: -6, right: -6,
              minWidth: 20, height: 20, borderRadius: 10,
              background: 'linear-gradient(145deg, #F93E11, #FA6541)',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 4px 8px rgba(249, 62, 17, 0.4)',
            }}
          >
            <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: 'white' }}>{badge}</span>
          </motion.div>
        )}
      </div>
      <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n800, textAlign: 'center', position: 'relative' }}>
        {label}
      </span>
    </motion.button>
  );
}

// ─── Transaction Card ──────────────────────────────────────────────────────────
function TransactionCard({ tx, onClick, delay = 0 }) {
  const sm = STATUS_META[tx.status] || { label: tx.status, color: C.n600, bg: C.n100 };
  const initials = tx.customerName?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '??';
  const statusAccent = sm.accent || '#5B005F';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onClick(tx)}
      style={{
        background: 'linear-gradient(145deg, #FFFFFF, #F4EDF4)',
        borderRadius: 16,
        padding: '12px 14px',
        boxShadow: '6px 6px 16px rgba(91, 0, 95, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: '1px solid rgba(91, 0, 95, 0.04)',
        borderLeft: `3px solid ${statusAccent}`,
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: `linear-gradient(145deg, ${statusAccent}20, ${statusAccent}08)`,
        border: `1px solid ${statusAccent}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: statusAccent }}>{initials}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tx.customerName}
          </span>
          <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#5B005F', flexShrink: 0 }}>{rp(tx.total)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>#{tx.id}</span>
          {tx.items?.some((i) => i.express) && (
            <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontFamily: 'Poppins', fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡</span>
          )}
          <span style={{
            fontFamily: 'Poppins',
            fontSize: 9,
            fontWeight: 600,
            color: sm.color,
            background: sm.bg,
            padding: '2px 8px',
            borderRadius: 999,
          }}>{sm.label}</span>
        </div>
      </div>
      <ChevronRight size={16} color={statusAccent} style={{ flexShrink: 0 }} />
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function KasirDashboardPage({ user, navigate }) {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const [stats, setStats] = useState({ total: 0, omset: 0, totalPelunasan: 0, express: 0, pending: 0, completed: 0 });
  const [activeQueue, setActiveQueue] = useState({ total: 0, process: 0, ready: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState(null);
  const [periodAlert, setPeriodAlert] = useState(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [clock, setClock] = useState(() => {
    const n = new Date();
    return { date: WIB_FORMATTER.format(n), time: WIB_TIME.format(n) };
  });
  const [shift, setShift] = useState(null);
  const [elapsed, setElapsed] = useState('');
  const [lowBalanceAlert, setLowBalanceAlert] = useState(null);
  const [chartData, setChartData] = useState([]);

  // ── Top Up: customer picker ──
  const [topupSheet, setTopupSheet] = useState(false);
  const [topupSearch, setTopupSearch] = useState('');
  const [topupFilter, setTopupFilter] = useState('all');
  const [topupList, setTopupList] = useState([]);
  const [topupLookup, setTopupLookup] = useState([]);
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupSearching, setTopupSearching] = useState(false);
  const topupDebounce = useRef(null);

  const TOPUP_FILTERS = [
    { key: 'all', label: 'Semua', icon: '👥' },
    { key: 'member', label: 'Member', icon: '⭐' },
    { key: 'has_deposit', label: 'Ada Saldo', icon: '💰' },
  ];

  const openTopupSheet = () => {
    if (!shiftOpen) {
      alertWarning('Buka shift dulu sebelum melakukan Top Up deposit.', { title: '⚠️ Shift Belum Aktif' });
      navigate('kasir_shift');
      return;
    }
    setTopupSearch('');
    setTopupFilter('all');
    setTopupLookup([]);
    setTopupSheet(true);
    setTopupLoading(true);
    axios.get('/api/customers?limit=300&sort=name_asc')
      .then((r) => setTopupList(r?.data?.data || []))
      .catch(() => setTopupList([]))
      .finally(() => setTopupLoading(false));
  };

  useEffect(() => {
    if (!topupSheet) return;
    clearTimeout(topupDebounce.current);
    if (!topupSearch.trim()) {
      setTopupLookup([]);
      setTopupSearching(false);
      return;
    }
    topupDebounce.current = setTimeout(async () => {
      setTopupSearching(true);
      try {
        const res = await axios.get(`/api/customers/lookup?q=${encodeURIComponent(topupSearch)}&limit=30`);
        setTopupLookup(res?.data?.data || []);
      } catch { setTopupLookup([]); }
      finally { setTopupSearching(false); }
    }, 250);
    return () => clearTimeout(topupDebounce.current);
  }, [topupSearch, topupSheet]);

  const topupDisplayList = useMemo(() => {
    let base = topupSearch.trim() ? topupLookup : topupList;
    if (topupFilter === 'member') {
      base = base.filter((c) => c.isMember || c.membershipStatus === 'active');
    } else if (topupFilter === 'has_deposit') {
      base = base.filter((c) => Number(c.depositBalance ?? c.deposit ?? 0) > 0);
    }
    return base;
  }, [topupSearch, topupLookup, topupList, topupFilter]);

  const selectTopupCustomer = (c) => {
    setTopupSheet(false);
    navigate('topup_deposit', c);
  };

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setClock({ date: WIB_FORMATTER.format(n), time: WIB_TIME.format(n) });
      if (shift?.isOpen && shift.session?.openedAt) setElapsed(fmtElapsed(shift.session.openedAt));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shift]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      const [resStats, resShift, resTarget] = await Promise.all([
        axios.get('/api/transactions/dashboard/stats'),
        axios.get('/api/shifts/status'),
        axios.get('/api/targets/progress').catch(() => null),
      ]);
      if (resStats?.data?.data) {
        setStats(resStats.data.data.today);
        setActiveQueue(resStats.data.data.active || { total: 0, process: 0, ready: 0 });
        setRecent(resStats.data.data.recent || []);
      }
      if (resShift?.data?.success !== false) setShift(resShift.data);
      if (resTarget?.data?.data) setTarget(resTarget.data.data);
      try {
        const resPeriod = await axios.get('/api/periods/current');
        const pd = resPeriod?.data?.data;
        if (pd && !pd.alreadyClosed && pd.daysLeft <= 3) {
          const dismissKey = `period_alert_dismissed_${pd.periodStart}`;
          if (!sessionStorage.getItem(dismissKey)) setPeriodAlert(pd);
        }
      } catch (_) { }
      try {
        const lbData = await checkLowBalance();
        if (lbData?.isLow) setLowBalanceAlert(lbData);
        else setLowBalanceAlert(null);
      } catch (_) {}
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);
  useAppRefresh(() => loadDashboard(), []);
  useRealtimeMulti(['transaction:checkout', 'payment:settled', 'cash:low'], () => { loadDashboard(); });

  const shiftOpen = shift?.isOpen || shift?.bypass;

  // Responsive grid columns
  const statsCols = isDesktop ? 4 : isTablet ? 4 : 2;
  // Responsive grid columns - 8 quick actions: 4 cols on desktop/tablet, 2 on mobile
  const quickCols = isDesktop ? 4 : isTablet ? 4 : 2;
  const txCols = isDesktop ? 3 : isTablet ? 2 : 1;

  const QUICK = [
    { label: 'Nota Baru', icon: <Plus size={22} />, action: () => shiftOpen ? navigate('nota_step1') : navigate('kasir_shift'), color: C.primary },
    { label: 'Antrian', icon: <List size={22} />, action: () => navigate('transaksi'), color: C.primary, badge: activeQueue.total > 0 ? activeQueue.total : null },
    { label: 'Customer', icon: <Users size={22} />, action: () => navigate('customer'), color: '#6366F1' },
    { label: 'Top Up', icon: <CreditCard size={22} />, action: () => openTopupSheet(), color: '#EC4899' },
    { label: 'Setor Tunai', icon: <DollarSign size={22} />, action: () => navigate('setor_tunai'), color: C.success },
    { label: 'Laporan', icon: <TrendingUp size={22} />, action: () => navigate('kasir_laporan'), color: '#7C3AED' },
    { label: 'Buka/Oper Shift', icon: <ArrowLeftRight size={22} />, action: () => navigate('oper_shift'), color: '#7C3AED' },
    { label: 'Shift', icon: <Clock size={22} />, action: () => navigate('kasir_shift'), color: C.warning },
  ];

  // Grid template for stats
  const statsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  };

  // Grid template for quick actions - more compact
  const quickGridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${quickCols}, 1fr)`,
    gap: 8,
  };

  // Grid template for transactions
  const txGridStyle = {
    display: 'grid',
    gridTemplateColumns: txCols === 1 ? '1fr' : `repeat(${txCols}, 1fr)`,
    gap: 10,
  };

  return (
    <>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'linear-gradient(180deg, #F8F4FF 0%, #F1F5F9 50%, #E8EEF5 100%)',
        minHeight: '100vh',
      }}>

        {/* ── HEADER ── */}
        <div style={{
          background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
          padding: isDesktop ? '24px 32px' : isTablet ? '20px 24px' : '20px 20px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Premium Glow Orbs */}
          <GlowOrb color="rgba(140, 76, 143, 0.4)" size={300} top="-100px" left="-50px" blur={60} />
          <GlowOrb color="rgba(249, 62, 17, 0.25)" size={200} top="50px" right="-50px" blur={50} />
          <GlowOrb color="rgba(91, 0, 95, 0.5)" size={250} bottom="-80px" right="20%" blur={70} />

          {/* Sparkle Particles - Multi-color Star Shapes */}
          <Sparkle top="12%" left="8%" size={10} delay={0} color="#FFD700" />
          <Sparkle top="20%" left="85%" size={12} delay={0.3} color="#FF6B6B" />
          <Sparkle top="55%" left="12%" size={8} delay={0.6} color="#4ECDC4" />
          <Sparkle top="35%" left="65%" size={10} delay={0.9} color="#FFD700" />
          <Sparkle top="75%" left="40%" size={9} delay={1.2} color="#FF6B6B" />
          <Sparkle top="18%" left="45%" size={7} delay={0.15} color="#4ECDC4" />
          <Sparkle top="65%" left="78%" size={8} delay={0.45} color="#FFD700" />
          <Sparkle top="45%" left="25%" size={6} delay={0.75} color="#FF6B6B" />
          <Sparkle top="80%" left="15%" size={7} delay={1.0} color="#4ECDC4" />
          <Sparkle top="30%" left="92%" size={6} delay={0.5} color="#FFD700" />
          <Sparkle top="60%" left="5%" size={8} delay={1.3} color="#FF6B6B" />
          <Sparkle top="10%" left="55%" size={7} delay={0.8} color="#4ECDC4" />

          {/* Floating Bubbles - More Visible */}
          <FloatingBubble src={bubbleIcon} size={28} top="15%" left="3%" delay={0} duration={5} opacity={0.5} />
          <FloatingBubble src={bubble2Icon} size={24} top="35%" right="5%" delay={0.5} duration={6} opacity={0.45} />
          <FloatingBubble src={soapBubble} size={26} top="50%" left="5%" delay={0.3} duration={5.5} opacity={0.4} />
          <FloatingBubble src={bubbleIcon} size={20} bottom="20%" right="12%" delay={0.8} duration={5} opacity={0.35} />
          <FloatingBubble src={bubble2Icon} size={18} top="8%" right="25%" delay={1.0} duration={6.5} opacity={0.3} />
          <FloatingBubble src={soapBubble} size={22} bottom="10%" left="20%" delay={0.6} duration={5.2} opacity={0.4} />

          {/* Animated decorative blobs */}
          <motion.div style={{
            position: 'absolute', top: -60, right: -60,
            width: 220, height: 220, borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            filter: 'blur(40px)',
            animation: 'floatBlob 8s ease-in-out infinite',
          }} />
          <motion.div style={{
            position: 'absolute', bottom: -40, left: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(250, 101, 65, 0.12)',
            filter: 'blur(30px)',
            animation: 'floatBlob 6s ease-in-out infinite reverse',
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', paddingLeft: 16 }}>
            <div>
              <div style={{ fontFamily: 'Poppins', fontSize: isMobile ? 10 : 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>
                {clock.date}
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ fontFamily: 'Poppins', fontSize: isMobile ? 20 : 26, fontWeight: 800, color: 'white', marginTop: 4, letterSpacing: '-0.5px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              >
                Halo, {user.name.split(' ')[0]} 👋
              </motion.div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                {user.outlet?.name || 'Waschen'} · <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>{clock.time} WIB</span>
              </div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                style={{ marginTop: 12 }}
              >
                {shift ? (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('kasir_shift')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      background: shiftOpen
                        ? 'rgba(5, 150, 105, 0.9)'
                        : 'rgba(220, 38, 38, 0.85)',
                      padding: '8px 16px', borderRadius: 999,
                      cursor: 'pointer',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
                    }}
                  >
                    <motion.span
                      animate={shiftOpen ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        width: 8, height: 8, borderRadius: 4,
                        background: 'white',
                        boxShadow: shiftOpen ? '0 0 8px rgba(255,255,255,0.8)' : 'none',
                      }}
                    />
                    <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: 'white' }}>
                      {shift.bypass ? 'Akses Khusus' : shiftOpen ? `Shift · ${fmtTime(shift.session?.openedAt)}` : 'Shift Tutup — Ketuk untuk buka'}
                    </span>
                    {shiftOpen && elapsed && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.85)', borderLeft: '1px solid rgba(255,255,255,0.4)', paddingLeft: 8 }}>
                        ⏱ {elapsed}
                      </span>
                    )}
                  </motion.div>
                ) : (
                  <div style={{ height: 32, width: 140, borderRadius: 999, background: 'rgba(255,255,255,0.15)' }} />
                )}
              </motion.div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('notifikasi')}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  position: 'relative',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}
              >
                <Bell size={20} />
                <div style={{
                  position: 'absolute', top: 8, right: 8,
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
                  width: 48, height: 48, borderRadius: 16,
                  background: 'linear-gradient(145deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                }}
              >
                <Avatar photo={user.photo} initials={user.avatar} size={38} />
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT — Responsive Grid ── */}
        <div style={{
          padding: isDesktop ? '24px 32px' : isTablet ? '20px 24px' : '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>

          {/* ── ALERTS ROW (Desktop: inline, Mobile: stacked) ── */}
          {(periodAlert && !alertDismissed || lowBalanceAlert?.isLow) && (
            <div style={{
              display: isDesktop ? 'flex' : 'block',
              gap: 12,
            }}>
              {periodAlert && !alertDismissed && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(145deg, rgba(254, 242, 242, 0.9), rgba(255, 247, 237, 0.9))',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 16,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    boxShadow: '6px 6px 16px rgba(0, 0, 0, 0.04), -3px -3px 10px rgba(255, 255, 255, 0.8)',
                    border: `1.5px solid ${periodAlert.daysLeft <= 1 ? 'rgba(252, 165, 165, 0.5)' : 'rgba(253, 230, 138, 0.5)'}`,
                  }}
                >
                  <div style={{ fontSize: 20, flexShrink: 0 }}>{periodAlert.daysLeft <= 1 ? '🚨' : '⚠️'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: periodAlert.daysLeft <= 1 ? C.dangerDark : C.warningDark }}>
                      {periodAlert.daysLeft === 0 ? 'Hari ini terakhir!' : `${periodAlert.daysLeft} hari lagi tutup buku`}
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: periodAlert.daysLeft <= 1 ? C.dangerDark : C.warningDark, marginTop: 2, opacity: 0.8 }}>
                      Periode <strong>{periodAlert.periodLabel}</strong> berakhir {periodAlert.daysLeft === 0 ? 'hari ini' : `${periodAlert.daysLeft} hari lagi`}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      setAlertDismissed(true);
                      sessionStorage.setItem(`period_alert_dismissed_${periodAlert.periodStart}`, '1');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.6)',
                      border: 'none',
                      cursor: 'pointer',
                      color: periodAlert.daysLeft <= 1 ? C.dangerDark : C.warningDark,
                      fontSize: 18,
                      padding: '0 4px',
                      flexShrink: 0,
                      borderRadius: 8,
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >×</motion.button>
                </motion.div>
              )}
              {lowBalanceAlert?.isLow && (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate('kas_outlet')}
                  style={{
                    flex: 1,
                    background: 'linear-gradient(145deg, rgba(254, 252, 232, 0.9), rgba(254, 243, 199, 0.85))',
                    backdropFilter: 'blur(10px)',
                    borderRadius: 16,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '6px 6px 16px rgba(0, 0, 0, 0.04), -3px -3px 10px rgba(255, 255, 255, 0.8)',
                    border: '1.5px solid rgba(253, 230, 138, 0.5)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 24 }}>💰⚠️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.warningDark }}>
                      Saldo Kas Outlet Rendah
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.warningDark, marginTop: 2, opacity: 0.8 }}>
                      Di bawah minimum ({rp(lowBalanceAlert.minBalance)})
                    </div>
                  </div>
                  <ChevronRight size={16} color={C.warningDark} />
                </motion.div>
              )}
            </div>
          )}

          {/* ── STATS GRID (2 columns, 2 rows) ── */}
          <div style={statsGridStyle}>
            <StatCard
              icon={<FileText size={14} color={C.primary} />}
              label="Total Omset"
              value={loading ? '—' : rp(stats.omset)}
              sublabel="Semua transaksi"
              color={C.primary}
              delay={0.05}
              sparklineData={[{ value: stats.omset * 0.2 }, { value: stats.omset * 0.5 }, { value: stats.omset * 0.3 }, { value: stats.omset }]}
              trend={12}
            />
            <StatCard
              icon={<DollarSign size={14} color={C.success} />}
              label="Pelunasan"
              value={loading ? '—' : rp(stats.totalPelunasan)}
              sublabel="Uang diterima"
              color={C.success}
              delay={0.1}
              sparklineData={[{ value: stats.totalPelunasan * 0.3 }, { value: stats.totalPelunasan * 0.6 }, { value: stats.totalPelunasan * 0.4 }, { value: stats.totalPelunasan }]}
              trend={8}
            />
            <StatCard
              icon={<LayoutGrid size={14} color={C.info} />}
              label="Total Nota"
              value={loading ? '—' : stats.total}
              sublabel="Nota dibuat"
              color={C.info}
              delay={0.15}
              sparklineData={[{ value: stats.total * 0.25 }, { value: stats.total * 0.5 }, { value: stats.total * 0.75 }, { value: stats.total }]}
              trend={5}
            />
            <StatCard
              icon={<AlertCircle size={14} color={C.warning} />}
              label="Piutang"
              value={loading ? '—' : rp(Math.max(0, stats.omset - stats.totalPelunasan))}
              sublabel="Belum terbayar"
              color={C.warning}
              delay={0.2}
              sparklineData={[{ value: (stats.omset - stats.totalPelunasan) * 0.4 }, { value: (stats.omset - stats.totalPelunasan) * 0.3 }, { value: (stats.omset - stats.totalPelunasan) * 0.6 }, { value: Math.max(0, stats.omset - stats.totalPelunasan) }]}
              trend={-3}
            />
              sublabel="Belum terbayar"
              color={C.warning}
              delay={0.2}
            />
          </div>

          {/* ── DESKTOP: 2-Column Layout ── */}
          {isDesktop ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
              {/* Left Column: Chart */}
              <TradingLineChart
                data={chartData}
                height={280}
                showLegend={true}
              />

              {/* Right Column: Mini Stats + Quick Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Mini Stats Row */}
                <div style={{
                  display: 'flex',
                  gap: 12,
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  boxShadow: '6px 6px 14px rgba(60, 10, 99, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(139, 92, 246, 0.08)',
                }}>
                  {[
                    { label: 'Express', desc: 'Kilat', val: stats.express, color: C.warning, icon: <Zap size={14} /> },
                    { label: 'Proses', desc: 'Dikerjakan', val: stats.pending, color: C.info, icon: <Clock size={14} /> },
                    { label: 'Selesai', desc: 'Siap ambil', val: stats.completed, color: C.success, icon: <Check size={14} /> },
                  ].map((s, i) => (
                    <motion.button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        if (s.label === 'Express') navigate('transaksi', { onlyExpress: true, period: 'today', status: 'semua' });
                        else if (s.label === 'Proses') navigate('transaksi', { status: 'proses' });
                        else navigate('transaksi', { status: 'selesai', pickupFilter: 'belum_diambil' });
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25 + i * 0.05 }}
                      style={{
                        flex: 1, textAlign: 'center',
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        padding: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ color: s.color }}>{s.icon}</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: s.color }}>{s.label}</span>
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n800 }}>{loading ? '—' : s.val}</div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500 }}>{s.desc}</div>
                    </motion.button>
                  ))}
                </div>

                {/* Quick Actions Grid (2 columns) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                }}>
                  {QUICK.slice(0, 4).map((q, i) => (
                    <QuickAction key={q.label} {...q} cols={2} />
                  ))}
                </div>

                {/* More Quick Actions (2 columns) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                }}>
                  {QUICK.slice(4, 8).map((q, i) => (
                    <QuickAction key={q.label} {...q} cols={2} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ── MOBILE/TABLET: Stacked Layout ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Mini Stats Row */}
              <div style={{
                display: 'flex',
                gap: isDesktop ? 16 : 8,
                background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                borderRadius: 16,
                padding: isDesktop ? '14px 20px' : '12px 16px',
                boxShadow: '6px 6px 14px rgba(60, 10, 99, 0.08), -3px -3px 10px rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(139, 92, 246, 0.08)',
              }}>
                {[
                  { label: 'Express', desc: 'Kilat', val: stats.express, color: C.warning, icon: <Zap size={14} /> },
                  { label: 'Proses', desc: 'Dikerjakan', val: stats.pending, color: C.info, icon: <Clock size={14} /> },
                  { label: 'Selesai', desc: 'Siap ambil', val: stats.completed, color: C.success, icon: <Check size={14} /> },
                ].map((s, i) => (
                  <motion.button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      if (s.label === 'Express') navigate('transaksi', { onlyExpress: true, period: 'today', status: 'semua' });
                      else if (s.label === 'Proses') navigate('transaksi', { status: 'proses' });
                      else navigate('transaksi', { status: 'selesai', pickupFilter: 'belum_diambil' });
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.05 }}
                    style={{
                      flex: 1, textAlign: 'center',
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ color: s.color }}>{s.icon}</span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</span>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: C.n800 }}>{loading ? '—' : s.val}</div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>{s.desc}</div>
                  </motion.button>
                ))}
              </div>

              {/* Chart for tablet/mobile */}
              <TradingLineChart
                data={chartData}
                height={220}
                showLegend={true}
              />

              {/* Quick Actions Grid */}
              <div style={quickGridStyle}>
                {QUICK.map((q, i) => (
                  <QuickAction key={q.label} {...q} cols={quickCols} />
                ))}
              </div>
            </div>
          )}

          {/* ── TARGET WIDGET ── */}
          {target && (
            <div style={{
              background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
              borderRadius: 16,
              padding: '14px 16px',
              boxShadow: '8px 8px 18px rgba(60, 10, 99, 0.1), -4px -4px 12px rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(139, 92, 246, 0.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>🎯 Target Bulan Ini</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>{target.monthName} {target.year}</div>
                </div>
                <div style={{
                  background: target.pct >= 100 ? 'linear-gradient(145deg, #D1FAE5, #A7F3D0)' : target.pct >= 50 ? 'linear-gradient(145deg, #FEF3C7, #FDE68A)' : 'linear-gradient(145deg, #FEE2E2, #FECACA)',
                  padding: '4px 12px',
                  borderRadius: 999,
                }}>
                  <span style={{
                    fontFamily: 'Poppins', fontSize: 14, fontWeight: 800,
                    color: target.pct >= 100 ? C.success : target.pct >= 50 ? C.warning : C.danger,
                  }}>{target.pct}%</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)', borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 8, fontWeight: 600, color: C.primary, textTransform: 'uppercase' }}>Realisasi</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n800, marginTop: 2 }}>{rp(target.actualAmount)}</div>
                </div>
                <div style={{ flex: 1, background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)', borderRadius: 10, padding: '8px 12px' }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 8, fontWeight: 600, color: C.primary, textTransform: 'uppercase' }}>Target</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n800, marginTop: 2 }}>{rp(target.targetAmount)}</div>
                </div>
              </div>
              <div style={{ height: 8, background: C.n200, borderRadius: 4, overflow: 'hidden', marginTop: 10 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, target.pct)}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  style={{
                    height: '100%',
                    background: target.pct >= 100 ? 'linear-gradient(90deg, #10B981, #34D399)' : target.pct >= 50 ? 'linear-gradient(90deg, #F59E0B, #FBBF24)' : 'linear-gradient(90deg, #EF4444, #F87171)',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── RECENT TRANSACTIONS ── */}
          <div style={{
            background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
            borderRadius: 20,
            padding: isDesktop ? '18px 20px' : '16px',
            boxShadow: '10px 10px 24px rgba(60, 10, 99, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: 'Poppins', fontSize: isMobile ? 13 : 14, fontWeight: 700, color: C.n800 }}>Transaksi Terbaru</span>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('transaksi')}
                style={{
                  background: 'linear-gradient(145deg, #F8F4FF, #EDE9FE)',
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                  borderRadius: 999,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Lihat semua →
              </motion.button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
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
                <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat...</span>
              </div>
            ) : recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n800 }}>Belum ada transaksi hari ini</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 4 }}>Yuk mulai transaksi pertama!</div>
              </div>
            ) : (
              <div style={txGridStyle}>
                {recent.slice(0, isDesktop ? 9 : isTablet ? 6 : 5).map((tx, idx) => (
                  <TransactionCard
                    key={tx.id}
                    tx={tx}
                    onClick={() => navigate('detail_transaksi', tx)}
                    delay={0.3 + idx * 0.05}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Up Bottom Sheet ── */}
      {topupSheet && (
        <>
          <div onClick={() => setTopupSheet(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 300, backdropFilter: 'blur(4px)' }} />
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              background: C.white, borderRadius: '20px 20px 0 0',
              padding: '16px 20px 36px',
              boxShadow: SHADOW.xl,
              zIndex: 301, maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.n200, margin: '0 auto 16px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${C.primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 20 }}>💳</span>
                </div>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900 }}>Top Up Deposit</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Pilih customer untuk top up saldo</div>
                </div>
              </div>
              <button onClick={() => setTopupSheet(false)} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${C.n200}`, background: C.white, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} color={C.n600} strokeWidth={2.5} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n600} strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={topupSearch}
                onChange={(e) => setTopupSearch(e.target.value)}
                placeholder="Cari nama, nomor HP, atau alamat…"
                style={{
                  width: '100%', height: 46, borderRadius: 12,
                  border: `1.5px solid ${C.n200}`, background: C.n50,
                  fontFamily: 'Poppins', fontSize: 13,
                  paddingLeft: 40, paddingRight: 12, boxSizing: 'border-box', outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {TOPUP_FILTERS.map((f) => {
                const isActive = topupFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setTopupFilter(f.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 14px', borderRadius: 999,
                      border: `1.5px solid ${isActive ? C.primary : C.n200}`,
                      background: isActive ? C.primaryTint : C.white,
                      fontFamily: 'Poppins', fontSize: 11, fontWeight: isActive ? 700 : 500,
                      color: isActive ? C.primary : C.n600, cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{f.icon}</span>
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, letterSpacing: 0.5, marginBottom: 8 }}>
              {topupLoading ? 'Memuat…' : `${topupDisplayList.length} customer ditemukan`}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {topupLoading && (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ width: 28, height: 28, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat customer…</span>
                </div>
              )}
              {!topupLoading && !topupSearching && topupDisplayList.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Customer tidak ditemukan</div>
                  <button
                    type="button"
                    onClick={() => { setTopupSheet(false); navigate('tambah_customer'); }}
                    style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Tambah Customer Baru
                  </button>
                </div>
              )}
              {topupDisplayList.map((c) => {
                const dep = Number(c.depositBalance ?? c.deposit ?? 0);
                const isMember = c.isMember || c.membershipStatus === 'active';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectTopupCustomer(c)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 12, border: 'none',
                      background: C.white, cursor: 'pointer', textAlign: 'left',
                      marginBottom: 6, boxShadow: SHADOW.sm,
                    }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: isMember ? C.primaryTint : `${C.primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: isMember ? C.primary : C.primary }}>
                        {(c.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        {isMember && <span style={{ fontFamily: 'Poppins', fontSize: 8, fontWeight: 700, color: C.primary, background: C.primaryTint, padding: '1px 5px', borderRadius: 999 }}>MEMBER</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{c.phone || '-'}</span>
                        {dep > 0 && <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, color: C.success, background: C.successBg, padding: '1px 5px', borderRadius: 999 }}>💰 {rp(dep)}</span>}
                      </div>
                    </div>
                    <ChevronRight size={14} color={C.n600} />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* CSS Animations */}
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
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </>
  );
}
