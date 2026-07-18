// ─────────────────────────────────────────────────────────────────────────────
// KasirDashboardPage — Premium Glassmorphism + Claymorphism UI
// Layout: Target Hero → Stat Cards → Status + Target Progress → Charts → Menu Fitur → Transaksi
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../../utils/theme';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import { ProfileAvatar } from '../../components/ui';
import TodayTargetWidget from '../../components/TodayTargetWidget';
import RevenueTrendChart from '../../components/RevenueTrendChart';
import TopServicesChart from '../../components/TopServicesChart';
import TopupSelectCustomerModal from '../../components/TopupSelectCustomerModal';
import {
  Plus, Users, Package, CreditCard, FileText,
  TrendingUp, Clock, Check, Bell, ChevronRight, Search,
  DollarSign, X, ArrowUpRight, ArrowDownRight,
  Edit3, ArrowLeftRight, Receipt, Sparkles,
  Zap, AlertTriangle, ShoppingCart, Target, Percent, Home,
  ArrowRightLeft, FileSignature, Building, ChevronDown
} from 'lucide-react';

// ─── Extended Colors ────────────────────────────────────────────────────────
// Using design tokens from theme.js for consistency
const COLORS = {
  ...C,
  // Brand variants - use theme tokens
  primaryDark: C.primaryStrong || '#3D0040',
  primaryTint: C.primarySoft || '#F8F4FF',
  // Semantic backgrounds
  successBg: C.successBg || '#D1FAE5',
  warningBg: C.warningBg || '#FEF3C7',
  dangerBg: C.dangerBg || '#FEE2E2',
  infoLight: C.infoBg || '#DBEAFE',
};

// ─── Responsive CSS Variables ───────────────────────────────────────────────
const getResponsiveStyles = (bp) => {
  // Breakpoint-based responsive values
  const spacing = {
    mobile: { xs: 8, sm: 12, md: 16, lg: 20, xl: 24 },
    tablet: { xs: 10, sm: 14, md: 18, lg: 22, xl: 28 },
    desktop: { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 },
  };

  const fonts = {
    mobile: { xs: 9, sm: 10, md: 11, lg: 13, xl: 15, xxl: 18, hero: 20 },
    tablet: { xs: 10, sm: 11, md: 12, lg: 14, xl: 16, xxl: 20, hero: 24 },
    desktop: { xs: 11, sm: 12, md: 13, lg: 15, xl: 18, xxl: 22, hero: 26 },
  };

  const radius = {
    mobile: { sm: 10, md: 14, lg: 18, xl: 22 },
    tablet: { sm: 12, md: 16, lg: 20, xl: 24 },
    desktop: { sm: 14, md: 18, lg: 22, xl: 26 },
  };

  // Determine device type
  const type = bp.isMobile ? 'mobile' : bp.isTablet ? 'tablet' : 'desktop';

  return {
    spacing: spacing[type],
    fonts: fonts[type],
    radius: radius[type],
    // Grid columns based on breakpoint
    statGridCols: bp.isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
    notaGridCols: bp.isMobile ? 'repeat(2, 1fr)' : bp.isTablet ? 'repeat(4, 1fr)' : 'repeat(4, 1fr)',
    statusTargetCols: bp.isMobile ? '1fr' : '1fr 1fr',
    chartGridCols: bp.isMobile ? '1fr' : '1fr 1fr',
    menuGridCols: bp.isMobile ? 'repeat(4, 1fr)' : bp.isTablet ? 'repeat(4, 1fr)' : 'repeat(6, 1fr)',
    // Content max-width for desktop
    maxContentWidth: '100%',
  };
};

// ─── Claymorphism Card Style ────────────────────────────────────────────────
const clayCard = (isHero = false, r = { sm: 14, md: 18, lg: 22 }) => ({
  background: `linear-gradient(145deg, ${C.white}, ${C.primarySoft || '#F8F4FF'})`,
  borderRadius: isHero ? r.lg : r.md,
  padding: isHero ? '18px 16px' : '14px',
  boxShadow: `10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)`,
  border: `1px solid ${C.primarySoft || 'rgba(139, 92, 246, 0.08)'}`,
  position: 'relative',
  overflow: 'hidden',
});

const clayIcon = (color = COLORS.primary, size = 36) => ({
  width: size,
  height: size,
  borderRadius: 10,
  background: `linear-gradient(145deg, ${color}20, ${color}10)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: `4px 4px 10px ${color}20, -2px -2px 6px rgba(255, 255, 255, 0.9)`,
});

// ─── Helpers ────────────────────────────────────────────────────────────────
const rp = (n) => {
  if (n == null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(n);
};

const formatDate = () => {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = new Date();
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatTime = () => new Date().toLocaleTimeString('id-ID', {
  hour: '2-digit', minute: '2-digit'
});

const fmtElapsed = (openedAt) => {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
};

const fmtK = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}Jt`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}Rb`;
  return n.toString();
};

// ─── Mini Sparkline Component ───────────────────────────────────────────────
function MiniSparkline({ data, color = COLORS.primary, height = 32 }) {
  if (!data || data.length < 2) {
    data = [0, 0];
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 70;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height * 0.8 - height * 0.1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Components ────────────────────────────────────────────────────────────

/** ClayStatCard — Premium Stat Card with Sparkline */
function ClayStatCard({ icon, label, value, subValue, trend, trendValue, color, sparkData, delay = 0, styles }) {
  const { fonts, spacing } = styles || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        ...clayCard(false, { sm: 14, md: 18, lg: 22 }),
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        padding: 0,
        minHeight: 80,
      }}
    >
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: spacing?.md || 12, padding: `${spacing?.md || 14}px ${spacing?.sm || 12}px` }}>
        <div style={{ ...clayIcon(color, 36), color, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 10, fontWeight: 600, color: COLORS.n500, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
            {label}
          </div>
          <div style={{ fontFamily: 'Poppins', fontSize: fonts?.lg || 18, fontWeight: 800, color: COLORS.n800, lineHeight: 1.2 }}>
            {value}
          </div>
          {subValue && (
            <div style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 10, color: COLORS.n500, marginTop: 2 }}>{subValue}</div>
          )}
        </div>
      </div>

      {/* Right side: Trend badge + Sparkline stacked */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        padding: `${spacing?.sm || 10}px ${spacing?.sm || 12}px ${spacing?.sm || 10}px 0`,
        minWidth: 90,
      }}>
        {trend !== undefined && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.1 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 2,
              padding: '3px 8px', borderRadius: 999,
              background: trend >= 0 ? COLORS.successBg : COLORS.dangerBg,
              color: trend >= 0 ? COLORS.success : COLORS.danger,
              fontFamily: 'Poppins',
              fontSize: fonts?.xs || 10, fontWeight: 600,
            }}
          >
            {trend >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trendValue !== undefined ? trendValue : Math.abs(trend)}
          </motion.div>
        )}
        <div style={{ marginTop: 'auto' }}>
          <MiniSparkline data={sparkData} color={color} height={32} />
        </div>
      </div>
    </motion.div>
  );
}

/** ClayMenuBtn — Premium Menu Button */
function ClayMenuBtn({ icon, label, color, badge, onClick, index = 0, styles }) {
  const { fonts, spacing, radius } = styles || {};

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03 }}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: `${spacing?.sm || 10}px ${spacing?.xs || 6}px`,
        background: `linear-gradient(145deg, ${C.white}, ${C.primarySoft || '#F8F4FF'})`,
        border: `1.5px solid rgba(139, 92, 246, 0.08)`,
        borderRadius: radius?.md || 14, cursor: 'pointer',
        boxShadow: `4px 4px 12px rgba(110, 46, 120, 0.06), -2px -2px 8px rgba(255, 255, 255, 0.95)`,
        minHeight: 80,
      }}
    >
      {badge > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: 'absolute', top: -4, right: -4,
            background: `linear-gradient(135deg, ${C.danger}, ${C.danger})`,
            color: 'white', fontFamily: 'Poppins',
            fontSize: 8, fontWeight: 700,
            padding: '1px 5px', borderRadius: 999,
            boxShadow: '0 2px 4px rgba(239,68,68,0.4)',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </motion.div>
      )}
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `linear-gradient(145deg, ${color}20, ${color}08)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color,
        boxShadow: `3px 3px 8px ${color}15, -1px -1px 4px rgba(255, 255, 255, 0.9)`,
      }}>
        {icon}
      </div>
      <span style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 9, fontWeight: 600, color: COLORS.n700, textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </span>
    </motion.button>
  );
}

/** Period Selector Button */
function PeriodSelector({ value, onChange, options, styles }) {
  return (
    <div style={{
      display: 'flex',
      background: 'linear-gradient(145deg, #F4EDF4, #E6D9E7)',
      borderRadius: 10,
      padding: 2,
      gap: 2,
    }}>
      {options.map(opt => (
        <motion.button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          whileTap={{ scale: 0.95 }}
          style={{
            padding: '4px 10px',
            borderRadius: 8,
            border: 'none',
            background: value === opt.value
              ? `linear-gradient(145deg, ${C.primaryStrong || '#5B005F'}, ${C.primaryHover || '#8C4C8F'})`
              : 'transparent',
            color: value === opt.value ? 'white' : COLORS.n600,
            fontFamily: 'Poppins',
            fontSize: 10, fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}

/** ClayProgressBar — Premium Progress Bar */
function ClayProgressBar({ value, max, color = COLORS.primary, styles }) {
  const { fonts } = styles || {};
  if (max == null || max <= 0) return null;
  const percent = Math.min((value / max) * 100, 100);

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 10, color: COLORS.n500 }}>{rp(value)}</span>
        <span style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 10, fontWeight: 600, color }}>{percent.toFixed(0)}%</span>
      </div>
      <div style={{
        height: 8, borderRadius: 999,
        background: `${color}15`, overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            height: '100%', borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        />
      </div>
    </div>
  );
}

/** LowStockAlertsCard — Low stock alerts for kasir dashboard */
function LowStockAlertsCard({ alerts, loading, onClick, styles }) {
  const { fonts, spacing, radius } = styles || {};

  const urgencyConfig = {
    critical: { color: COLORS.danger, bg: COLORS.dangerBg, icon: '🚨', label: 'Habis' },
    high:     { color: '#F97316',  bg: '#FFF7ED',       icon: '⚠️', label: 'Rendah' },
    medium:   { color: COLORS.warning, bg: COLORS.warningBg, icon: '📉', label: 'Menipis' },
    low:      { color: COLORS.info, bg: COLORS.infoBg, icon: '🔔', label: 'Waspada' },
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ ...clayCard(false, radius), padding: spacing?.md || 14 }}
      >
        <div style={{ fontFamily: 'Poppins', fontSize: fonts?.sm || 11, fontWeight: 700, color: COLORS.n700, marginBottom: spacing?.sm || 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          ⚠️ Stok Rendah
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ height: 40, borderRadius: 8, background: '#f3f4f6', marginBottom: 6, animation: 'shimmer 1.5s infinite', backgroundSize: '200% 100%' }} />
        ))}
      </motion.div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ ...clayCard(false, radius), padding: spacing?.md || 14, cursor: onClick ? 'pointer' : 'default' }}
        onClick={onClick}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing?.sm || 8, marginBottom: spacing?.sm || 8 }}>
          <div style={{ ...clayIcon(COLORS.success, 28), background: COLORS.successBg }}>
            <Check size={12} color={COLORS.success} />
          </div>
          <span style={{ fontFamily: 'Poppins', fontSize: fonts?.sm || 11, fontWeight: 700, color: COLORS.n700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ⚠️ Stok Rendah
          </span>
        </div>
        <div style={{ textAlign: 'center', padding: spacing?.md || 12 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
          <div style={{ fontFamily: 'Poppins', fontSize: fonts?.sm || 11, color: COLORS.success, fontWeight: 600 }}>Semua stok aman</div>
          <div style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 10, color: COLORS.n400, marginTop: 2 }}>Tidak ada item di bawah minimum</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      style={{ ...clayCard(false, radius), padding: spacing?.md || 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing?.sm || 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing?.sm || 8 }}>
          <div style={{ ...clayIcon(COLORS.warning, 28), background: COLORS.warningBg }}>
            <AlertTriangle size={12} color={COLORS.warning} />
          </div>
          <span style={{ fontFamily: 'Poppins', fontSize: fonts?.sm || 11, fontWeight: 700, color: COLORS.n700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ⚠️ Stok Rendah
          </span>
        </div>
        <motion.button
          onClick={onClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            padding: '4px 10px', borderRadius: 8,
            background: COLORS.warningBg, border: 'none', cursor: 'pointer',
            fontFamily: 'Poppins', fontSize: fonts?.xs || 10, fontWeight: 600, color: COLORS.warning,
          }}
        >
          Lihat Semua
        </motion.button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing?.xs || 6 }}>
        {alerts.slice(0, 3).map((alert, i) => {
          const cfg = urgencyConfig[alert.urgency] || urgencyConfig.low;
          return (
            <motion.div
              key={alert.itemId || i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              style={{
                display: 'flex', alignItems: 'center', gap: spacing?.sm || 8,
                padding: `${spacing?.xs || 6}px ${spacing?.sm || 8}px`,
                background: cfg.bg, borderRadius: radius?.sm || 8,
                border: `1px solid ${cfg.color}20`,
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{cfg.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'Poppins', fontSize: fonts?.xs || 10, fontWeight: 600,
                  color: COLORS.n800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {alert.itemName}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: COLORS.n500 }}>
                  {alert.currentStock} / {alert.minStock} {alert.unit}
                </div>
              </div>
              <div style={{
                padding: '2px 8px', borderRadius: 6,
                background: cfg.color, color: 'white',
                fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                flexShrink: 0,
              }}>
                {cfg.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {alerts.length > 3 && (
        <div style={{ textAlign: 'center', marginTop: spacing?.sm || 8, fontFamily: 'Poppins', fontSize: fonts?.xs || 10, color: COLORS.n400 }}>
          +{alerts.length - 3} item lainnya
        </div>
      )}
    </motion.div>
  );
}

/** ClayTransactionRow — Premium Transaction Row (Responsive) */
function ClayTransactionRow({ tx, onClick, index = 0, styles, isMobile = false }) {
  const { fonts, spacing } = styles || {};
  const statusConfig = {
    paid: { bg: C.success, label: 'Lunas' },
    partial: { bg: C.warning, label: 'DP' },
    unpaid: { bg: '#6B7280', label: 'Nanti' },
  };
  const status = statusConfig[tx.paymentStatus] || statusConfig.unpaid;

  // Format ID untuk display - gunakan transactionNo jika ada
  const displayId = tx.transactionNo
    ? tx.transactionNo.split('-').slice(-2).join('-')
    : tx.id?.slice(-6) || tx.id || '-';

  // Format time
  const displayTime = tx.time || (tx.createdAt
    ? new Date(tx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '-');

  // Responsive sizing
  const dotSize = isMobile ? 8 : 10;
  const infoWidth = isMobile ? 70 : 80;
  const badgePadding = isMobile ? '2px 8px' : '3px 10px';
  const amountWidth = isMobile ? 65 : 75;
  const iconSize = isMobile ? 14 : 16;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      whileHover={{ x: 4, backgroundColor: `${C.primarySoft || '#F8F4FF'}` }}
      whileTap={{ scale: 0.99 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : (spacing?.md || 12),
        padding: isMobile ? '10px 12px' : `${spacing?.md || 12}px ${spacing?.md || 14}px`,
        background: `linear-gradient(145deg, ${C.white}, ${C.primarySoft || '#F8F4FF'})`,
        borderRadius: isMobile ? 12 : 14,
        cursor: 'pointer',
        boxShadow: `4px 4px 10px rgba(110, 46, 120, 0.06), -2px -2px 8px rgba(255, 255, 255, 0.95)`,
        border: `1px solid rgba(139, 92, 246, 0.06)`,
        minHeight: isMobile ? 56 : 64,
      }}
    >
      {/* Status indicator dot */}
      <div style={{
        width: dotSize,
        height: dotSize,
        borderRadius: '50%',
        background: status.bg,
        flexShrink: 0,
        boxShadow: `0 0 6px ${status.bg}50`,
      }} />

      {/* Transaction info - left side */}
      <div style={{ width: infoWidth, flexShrink: 0 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: isMobile ? 9 : (fonts?.sm || 11),
          fontWeight: 600,
          color: COLORS.n800,
          lineHeight: 1.2,
        }}>
          {displayId}
        </div>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: isMobile ? 8 : (fonts?.xs || 10),
          color: COLORS.n500,
        }}>
          {displayTime}
        </div>
      </div>

      {/* Customer name - center (flexible) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: isMobile ? 11 : (fonts?.md || 12),
          fontWeight: 600,
          color: COLORS.n800,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.3,
        }}>
          {tx.customerName || 'Non-member'}
        </div>
        {tx.customerPhone && !isMobile && (
          <div style={{
            fontFamily: 'Poppins',
            fontSize: fonts?.xs || 10,
            color: COLORS.n500,
          }}>
            {tx.customerPhone}
          </div>
        )}
      </div>

      {/* Status badge */}
      <div style={{
        padding: badgePadding,
        borderRadius: isMobile ? 6 : 8,
        background: status.bg,
        color: 'white',
        fontFamily: 'Poppins',
        fontSize: isMobile ? 8 : (fonts?.xs || 9),
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {status.label}
      </div>

      {/* Amount - right side */}
      <div style={{ width: amountWidth, textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontFamily: 'Poppins',
          fontSize: isMobile ? 11 : (fonts?.md || 12),
          fontWeight: 700,
          color: COLORS.n800,
        }}>
          {rp(tx.total)}
        </div>
      </div>

      <ChevronRight size={iconSize} color={COLORS.n400} style={{ flexShrink: 0 }} />
    </motion.div>
  );
}

// ─── Mini Line Chart ────────────────────────────────────────────────────────
function MiniLineChart({ data, color = COLORS.primary }) {
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    // Flat line when no data
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="0" y1="90" x2="100" y2="90" stroke={color} strokeWidth="2" strokeDasharray="5,5" opacity="0.3" />
        <text x="50" y="55" textAnchor="middle" fill={COLORS.n400} fontSize="10" fontFamily="Poppins">Tidak ada data</text>
      </svg>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 100;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height * 0.85 - height * 0.05;
    return `${x},${y}`;
  }).join(' ');

  // Add dots for each point
  const dots = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height * 0.85 - height * 0.05;
    return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
  });

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`chart-grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#chart-grad-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dots}
    </svg>
  );
}

// ─── Donut Chart ────────────────────────────────────────────────────────────
function DonutChart({ data, loading, styles }) {
  const { fonts } = styles || {};
  // Color palette for payment methods
  const paymentColors = {
    Tunai: COLORS.success,
    QRIS: COLORS.info,
    Deposit: COLORS.warning,
    EDC: COLORS.n500,
    Transfer: C.primaryHover,
    Lainnya: COLORS.n400,
  };

  // Map API data to chart format with fallback colors
  const chartData = data && data.length > 0
    ? data.map(item => ({
        ...item,
        color: item.color || paymentColors[item.label] || COLORS.primary,
      }))
    : null;

  const total = chartData?.reduce((sum, d) => sum + (d.value || 0), 0) || 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{
          fontFamily: 'Poppins', fontSize: fonts?.sm || 11, color: COLORS.n400,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2px solid ' + COLORS.n200,
            borderTopColor: COLORS.primary,
            animation: 'spin 1s linear infinite',
          }} />
          Memuat...
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0 || total === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 24 }}>📊</span>
        <span style={{ fontFamily: 'Poppins', fontSize: fonts?.sm || 11, color: COLORS.n400 }}>Belum ada data</span>
      </div>
    );
  }

  let currentAngle = -90;

  const segments = chartData.map(item => {
    const angle = ((item.value || 0) / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
    const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
    const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

    const largeArc = angle > 180 ? 1 : 0;

    return { ...item, path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z` };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: '100%' }}>
      <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, flexShrink: 0 }}>
        {segments.map((seg, i) => (
          <path key={i} d={seg.path} fill={seg.color} />
        ))}
        <circle cx="50" cy="50" r="25" fill="white" />
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 10, color: COLORS.n600, flex: 1 }}>{seg.label}</span>
            <span style={{ fontFamily: 'Poppins', fontSize: fonts?.xs || 10, fontWeight: 600, color: COLORS.n800 }}>{seg.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────
export default function KasirDashboardPage({ user, navigate }) {
  // Responsive hooks
  const bp = useResponsive();
  const { width } = useWindowSize();
  const styles = getResponsiveStyles(bp);

  const [stats, setStats] = useState({
    total: 0,
    omset: 0,
    omset_real: 0,      // REAL: cash received (completed)
    target: null,
    targetMonth: null,
    omsetMonth: 0,      // PROYEK: all orders
    omsetMonthReal: 0,   // REAL: cash received
    express: 0,
    pending: 0,
    completed: 0,
    lunasRate: 0,
    notaCount: {
      dibuat: 0, lunas: 0, dp: 0, selesai: 0
    },
    timeMetrics: { avgProcessingHours: 0, oldestWaitingHours: 0, expressProcessing: 0, overduePickup: 0 },
  });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [clock, setClock] = useState({ date: formatDate(), time: formatTime() });
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [lowStockLoading, setLowStockLoading] = useState(true);
  const [topupModalVisible, setTopupModalVisible] = useState(false);

  // Scroll container ref for modal scroll lock
  const scrollContainerRef = useRef(null);

  // Sparkline data from API
  const [sparkData, setSparkData] = useState({
    omset: null,
    transaksi: null,
    selesai: null,
    target: null,
  });

  // Chart data with period
  const [chartPeriod, setChartPeriod] = useState('7d');
  const [paymentPeriod, setPaymentPeriod] = useState('7d');
  const [chartData, setChartData] = useState({
    revenue: { '7d': null, '14d': null, '30d': null },
    payment: { '7d': null, '14d': null, '30d': null },
  });
  const [chartLoading, setChartLoading] = useState(false);

  // Menu Items - all operational features
  const MENU_ITEMS = [
    // Transaction
    { key: 'nota', label: 'Nota Baru', icon: <Plus size={16} />, color: COLORS.primary, category: 'Transaksi' },
    { key: 'customer', label: 'Customer', icon: <Users size={16} />, color: COLORS.info, category: 'Transaksi' },
    { key: 'topup', label: 'Top Up', icon: <CreditCard size={16} />, color: COLORS.success, category: 'Operasional' },
    // Inventory & Stock
    { key: 'inventory', label: 'Inventory', icon: <Package size={16} />, color: COLORS.primaryHover, category: 'Inventory' },
    { key: 'adjustment', label: 'Koreksi Nota', icon: <Edit3 size={16} />, color: COLORS.warning, category: 'Operasional' },
    { key: 'pengajuan', label: 'Pengajuan Operasional', icon: <Receipt size={16} />, color: '#EC4899', category: 'Operasional' },
    // Financial
    { key: 'piutang', label: 'Piutang', icon: <TrendingUp size={16} />, color: COLORS.danger, category: 'Operasional' },
    // Reports & Admin
    { key: 'laporan', label: 'Laporan', icon: <FileText size={16} />, color: '#64748B', category: 'Laporan' },
    { key: 'shift', label: 'Shift', icon: <Clock size={16} />, color: '#6B7280', category: 'Laporan' },
  ];

  // Clock
  useEffect(() => {
    const tick = () => setClock({ date: formatDate(), time: formatTime() });
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [statsRes, shiftRes, sparkRes, targetRes] = await Promise.all([
          axios.get('/api/transactions/dashboard/stats').catch(() => null),
          axios.get('/api/shifts/status').catch(() => null),
          axios.get('/api/dashboard/sparkline?days=7').catch(() => null),
          axios.get('/api/targets/today-summary').catch(() => null),
        ]);

        if (statsRes?.data?.data) {
          const d = statsRes.data.data;
          // Calculate lunas rate based on REAL omset (cash received)
          const omsetReal = d.omset_today_real ?? 0;
          const pelunasanToday = d.pelunasan_today ?? 0;
          const lunasRate = omsetReal > 0 && pelunasanToday > 0
            ? Math.round((pelunasanToday / omsetReal) * 100)
            : 0;

          setStats(prev => ({
            ...prev,
            // PROYEK = all non-cancelled orders
            total: d.transaksi_today ?? 0,
            omset: d.omset_today ?? 0,         // PROYEK omset today
            omset_real: omsetReal,              // REAL omset today (completed)
            // From target API
            target: targetRes?.data?.data?.dailyTarget ?? null,
            targetMonth: targetRes?.data?.data?.monthlyTarget ?? null,
            omsetMonth: targetRes?.data?.data?.monthProyek ?? 0,  // PROYEK bulan ini
            omsetMonthReal: targetRes?.data?.data?.monthActual ?? 0, // REAL bulan ini
            // Transaction counts
            express: d.express_today ?? 0,
            pending: d.pending_transactions ?? 0,
            completed: d.transaksi_today_real ?? 0,   // Done tx today
            lunasRate: lunasRate,
            notaCount: {
              dibuat: d.transaksi_today ?? 0,
              lunas: d.transaksi_today_real ?? 0,
              dp: 0, // DP calculated from payment status
              selesai: d.transaksi_today_real ?? 0,
            },
            timeMetrics: d.timeMetrics || { avgProcessingHours: 0, oldestWaitingHours: 0, expressProcessing: 0, overduePickup: 0 },
          }));
          setRecent(d.recent || []);
        }
        if (shiftRes?.data) setShift(shiftRes.data);

        // Sparkline data
        if (sparkRes?.data?.data) {
          setSparkData({
            omset: sparkRes.data.data.omset || null,
            transaksi: sparkRes.data.data.transaksi || null,
            selesai: sparkRes.data.data.selesai || null,
            target: sparkRes.data.data.target || null,
          });
        } else {
          setSparkData({
            omset: stats.omset > 0 ? [stats.omset * 0.6, stats.omset * 0.8, stats.omset * 0.7, stats.omset * 0.9, stats.omset] : null,
            transaksi: stats.total > 0 ? [Math.round(stats.total * 0.6), Math.round(stats.total * 0.8), Math.round(stats.total * 0.7), Math.round(stats.total * 0.9), stats.total] : null,
            selesai: stats.completed > 0 ? [Math.round(stats.completed * 0.6), Math.round(stats.completed * 0.8), Math.round(stats.completed * 0.7), Math.round(stats.completed * 0.9), stats.completed] : null,
            target: stats.target > 0 ? [stats.omset / stats.target * 0.6, stats.omset / stats.target * 0.8, stats.omset / stats.target * 0.7, stats.omset / stats.target * 0.9, stats.omset / stats.target] : null,
          });
        }
      } catch (err) { console.error('Error loading dashboard data:', err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Load low stock alerts
  useEffect(() => {
    let cancelled = false;
    axios.get('/api/dashboard-intelligence/low-stock')
      .then(r => { if (!cancelled) setLowStockAlerts(r?.data?.data?.alerts || []); })
      .catch(() => { if (!cancelled) setLowStockAlerts([]); })
      .finally(() => { if (!cancelled) setLowStockLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch chart data with periods
  useEffect(() => {
    const fetchCharts = async () => {
      setChartLoading(true);
      try {
        const [revenueRes, paymentRes] = await Promise.all([
          axios.get(`/api/transactions/dashboard/revenue-trend?days=${chartPeriod === '7d' ? 7 : chartPeriod === '14d' ? 14 : 30}`).catch(() => null),
          axios.get(`/api/transactions/dashboard/payment-methods?days=${paymentPeriod === '7d' ? 7 : paymentPeriod === '14d' ? 14 : 30}`).catch(() => null),
        ]);

        // Process revenue data
        if (revenueRes?.data?.data) {
          const revenue = Array.isArray(revenueRes.data.data)
            ? revenueRes.data.data.map(d => d.revenue)
            : revenueRes.data.data;
          setChartData(prev => ({
            ...prev,
            revenue: { ...prev.revenue, [chartPeriod]: revenue }
          }));
        }

        // Process payment data - API returns {success, data: [...]} format
        if (paymentRes?.data?.data) {
          setChartData(prev => ({
            ...prev,
            payment: { ...prev.payment, [paymentPeriod]: paymentRes.data.data }
          }));
        }
      } catch (err) { console.error('Error fetching chart data:', err); }
      finally { setChartLoading(false); }
    };
    fetchCharts();
  }, [chartPeriod, paymentPeriod]);

  const shiftOpen = shift?.isOpen || shift?.bypass;
  const shiftElapsed = shift?.session?.openedAt ? fmtElapsed(shift.session.openedAt) : '';

  const goTo = (key) => {
    if (key === 'topup') {
      setTopupModalVisible(true);
      return;
    }
    const routes = {
      nota: () => shiftOpen ? navigate('nota_step1') : navigate('kasir_shift'),
      customer: () => navigate('customer'),
      inventory: () => navigate('kasir_stok_bahan'),
      pengajuan: () => navigate('pengajuan_belanja'),
      piutang: () => navigate('outstanding_list'),
      laporan: () => navigate('kasir_laporan'),
      shift: () => navigate('kasir_shift'),
      adjustment: () => navigate('adjustment_list'),
      merge: () => navigate('merge_transaction'),
    };
    routes[key]?.();
  };

  // Handle customer selection from topup modal
  const handleTopupSelectCustomer = (customer) => {
    setTopupModalVisible(false);
    navigate('topup_deposit', customer);
  };

  const targetHariPercent = stats.target > 0 ? Math.round((stats.omset / stats.target) * 100) : 0;
  const targetBulanPercent = stats.targetMonth > 0 ? Math.round((stats.omsetMonth / stats.targetMonth) * 100) : 0;

  // Get revenue data for current period
  const getRevenueData = () => {
    const data = chartData.revenue[chartPeriod];
    if (data && data.length > 0) return data;
    // Show flat line if no data
    return [0];
  };

  // Get payment data for current period
  const getPaymentData = () => {
    const data = chartData.payment[paymentPeriod];
    if (data && data.length > 0) return data;
    return null;
  };

  // Component styles object for passing responsive values
  const componentStyles = { fonts: styles.fonts, spacing: styles.spacing, radius: styles.radius };

  return (
    <div
      ref={scrollContainerRef}
      style={{
        flex: 1,
        width: '100%',
        overflowY: 'auto',
        paddingBottom: bp.isMobile ? 120 : 100,
        background: `linear-gradient(180deg, ${C.primarySoft || '#F8F4FF'} 0%, #F1F5F9 50%, #E8EEF5 100%)`,
        margin: 0,
      }}
    >

      {/* ── PREMIUM HEADER - Ultra Aesthetic Cosmic Theme ── */}
      <div style={{
        background: `
          radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
          radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
          linear-gradient(155deg, #3B0B47 0%, #5C1A6B 55%, #4A1259 100%)
        `,
        padding: `${styles.spacing.lg}px ${styles.spacing.md}px 44px`,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 220,
      }}>

        {/* ── BACKGROUND GRID PATTERN ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
          pointerEvents: 'none',
        }} />

        {/* ── LARGE AMBIENT ORB (header::after style) ── */}
        <div style={{
          position: 'absolute',
          width: 260, height: 260, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          top: -120, right: -80,
          filter: 'blur(2px)',
          animation: 'floatA 14s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* ── BLOB 1 - Magenta Top Right ── */}
        <div style={{
          position: 'absolute',
          width: 180, height: 180, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%)',
          top: -60, right: -40,
          filter: 'blur(18px)',
          animation: 'floatB 11s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* ── BLOB 2 - Mint Bottom Left ── */}
        <div style={{
          position: 'absolute',
          width: 150, height: 150, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%)',
          bottom: 20, left: -50,
          filter: 'blur(18px)',
          animation: 'floatC 16s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* ── BLOB 3 - White Subtle Center ── */}
        <div style={{
          position: 'absolute',
          width: 90, height: 90, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)',
          top: 40, left: '55%',
          filter: 'blur(18px)',
          animation: 'floatA 9s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* ── SPARKLES - 4 Stars with twinkle ── */}
        <div className="sparkle" style={{ width: 14, top: 24, right: 70, animationDelay: '0s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 8, top: 60, right: 30, animationDelay: '1.1s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 10, top: 15, left: '30%', animationDelay: '2s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 6, bottom: 40, left: '15%', animationDelay: '0.6s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>
        <div className="sparkle" style={{ width: 9, top: 90, right: 110, animationDelay: '1.7s' }}>
          <svg viewBox="0 0 24 24"><path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"/></svg>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 5,
            paddingLeft: bp.isMobile ? 8 : 16,
            flexWrap: 'wrap',
            gap: styles.spacing.sm,
          }}
        >
          <div>
            <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.sm, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 }}>{clock.date}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.hero, fontWeight: 800, color: 'white', marginTop: 4 }}>
              Halo, {user.name.split(' ')[0]} 👋
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.md, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              {user.outlet?.name || 'Waschen'} · <span style={{ fontWeight: 700, color: 'white' }}>{clock.time}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: styles.spacing.sm }}>
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('notifikasi')}
              style={{
                width: bp.isMobile ? 36 : 42, height: bp.isMobile ? 36 : 42, borderRadius: bp.isMobile ? 18 : 21,
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', position: 'relative',
              }}
            >
              <Bell size={bp.isMobile ? 16 : 18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('profil')}
              style={{
                width: bp.isMobile ? 36 : 42, height: bp.isMobile ? 36 : 42, borderRadius: bp.isMobile ? 12 : 14,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', overflow: 'hidden',
              }}
            >
              {user.photo ? (
                <img src={user.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <ProfileAvatar user={user} size={bp.isMobile ? 36 : 42} />
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Shift Status */}
        <motion.div
          onClick={() => navigate('kasir_shift')}
          animate={shiftOpen ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 999,
            background: shiftOpen
              ? 'linear-gradient(145deg, rgba(16,185,129,0.9), rgba(5,150,105,0.9))'
              : 'linear-gradient(145deg, rgba(239,68,68,0.9), rgba(220,38,38,0.9))',
            cursor: 'pointer', marginTop: styles.spacing.sm, marginLeft: bp.isMobile ? 8 : 16,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', boxShadow: '0 0 8px rgba(255,255,255,0.8)' }} />
          <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.sm, fontWeight: 600, color: 'white' }}>
            {shiftOpen ? `Shift Terbuka · ${shiftElapsed}` : 'Shift Tertutup'}
          </span>
        </motion.div>

        <style dangerouslySetInnerHTML={{ __html: `
          /* ===== BLOBS - floating background orbs (matching profile design) ===== */
          @keyframes floatA {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-14px, 16px) scale(1.08); }
          }
          @keyframes floatB {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(18px, -12px) scale(1.1); }
          }
          @keyframes floatC {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(16px, 10px) scale(0.95); }
          }
          /* ===== SPARKLES - stars with twinkle animation ===== */
          .sparkle {
            position: absolute;
            pointer-events: none;
            animation: twinkle 3.2s ease-in-out infinite;
          }
          .sparkle svg {
            width: 100%;
            height: 100%;
            fill: #fff;
            filter: drop-shadow(0 0 4px rgba(255,255,255,0.9));
          }
          @keyframes twinkle {
            0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
            50% { opacity: 1; transform: scale(1) rotate(20deg); }
          }
          @media (prefers-reduced-motion: reduce) {
            .sparkle { animation: none; opacity: 0.6; }
            .header::after, .blob-1, .blob-2, .blob-3 { animation: none; }
          }
        `}} />
      </div>

      {/* ── CONTENT ── */}
      <div style={{
        paddingLeft: styles.spacing.md,
        paddingRight: styles.spacing.md,
        paddingTop: 0,
        marginTop: -16,
        paddingBottom: bp.isMobile ? 120 : 100
      }}>

        {/* ── 0. TODAY TARGET HERO WIDGET ── */}
        <TodayTargetWidget onClick={() => navigate('target_page')} />

        {/* ── 1. STAT CARDS ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: styles.statGridCols,
          gap: bp.isMobile ? 8 : 10,
          marginBottom: styles.spacing.md
        }}>
          {/* PROYEK Omset - All orders value */}
          <ClayStatCard
            icon={<TrendingUp size={16} />}
            label="Proyek Omset"
            value={loading ? '...' : fmtK(stats.omset)}
            subValue="order masuk"
            color={COLORS.primary}
            sparkData={sparkData.omset}
            delay={0.1}
            styles={componentStyles}
          />
          {/* REAL Omset - Cash received */}
          <ClayStatCard
            icon={<DollarSign size={16} />}
            label="Real Omset"
            value={loading ? '...' : fmtK(stats.omset_real)}
            subValue="cash masuk"
            color={COLORS.success}
            sparkData={null}
            delay={0.15}
            styles={componentStyles}
          />
          {/* Nota count */}
          <ClayStatCard
            icon={<FileText size={16} />}
            label="Nota"
            value={loading ? '...' : stats.total}
            subValue={`${stats.completed} selesai`}
            color={COLORS.info}
            sparkData={sparkData.transaksi}
            delay={0.2}
            styles={componentStyles}
          />
          {/* Target Progress */}
          <ClayStatCard
            icon={<Target size={16} />}
            label="Target"
            value={loading ? '...' : `${targetHariPercent}%`}
            subValue={stats.target != null ? `${fmtK(stats.omset)} / ${fmtK(stats.target)}` : 'Belum ada target'}
            color={COLORS.warning}
            sparkData={sparkData.target}
            delay={0.25}
            styles={componentStyles}
          />
        </div>

        {/* ── 2. MENU FITUR ── */}
        <div style={{ ...clayCard(true, styles.radius), padding: styles.spacing.md, marginBottom: styles.spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: styles.spacing.sm, marginBottom: styles.spacing.md }}>
            <Sparkles size={bp.isMobile ? 14 : 16} color={COLORS.primary} />
            <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.md, fontWeight: 700, color: COLORS.n700, textTransform: 'uppercase' }}>
              Menu Fitur
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: styles.menuGridCols, gap: bp.isMobile ? 6 : styles.spacing.sm }}>
            {MENU_ITEMS.map((item, i) => {
              const { key, ...rest } = item;
              return <ClayMenuBtn key={key} {...rest} index={i} onClick={() => goTo(key)} styles={componentStyles} />;
            })}
          </div>
        </div>

        {/* ── 3. STATUS PEKERJAAN (Full Width - Prominent) ── */}
        <div style={{ ...clayCard(true, styles.radius), padding: styles.spacing.md, marginBottom: styles.spacing.md }}>
          <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.sm, fontWeight: 700, color: COLORS.n700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: styles.spacing.md }}>
            Status Pekerjaan
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: bp.isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)', gap: styles.spacing.sm }}>
            {/* Express */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              whileHover={{ y: -3, scale: 1.02 }}
              style={{
                background: '#FFF7ED',
                borderRadius: styles.radius.md,
                padding: `${styles.spacing.md}px`,
                textAlign: 'center',
                border: '1.5px solid #FED7AA',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(145deg, #FFEDD5, #FFF7ED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px',
                boxShadow: '4px 4px 10px rgba(249,115,22,0.1), -2px -2px 6px rgba(255,255,255,0.9)',
              }}>
                <Zap size={20} color="#F97316" />
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 20 : 26, fontWeight: 800, color: '#C2410C', lineHeight: 1 }}>
                {loading ? '-' : stats.express || 0}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: '#9A3412', fontWeight: 600, marginTop: 4 }}>Express</div>
              {stats.timeMetrics?.expressProcessing > 0 && (
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: '#F97316', marginTop: 6, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '2px 6px' }}>
                  ⚡ {stats.timeMetrics.expressProcessing} lagi proses
                </div>
              )}
            </motion.div>

            {/* Proses */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -3, scale: 1.02 }}
              style={{
                background: COLORS.infoLight,
                borderRadius: styles.radius.md,
                padding: `${styles.spacing.md}px`,
                textAlign: 'center',
                border: '1.5px solid #BFDBFE',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(145deg, #DBEAFE, #EFF6FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px',
                boxShadow: '4px 4px 10px rgba(59,130,246,0.1), -2px -2px 6px rgba(255,255,255,0.9)',
              }}>
                <Clock size={20} color={COLORS.info} />
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 20 : 26, fontWeight: 800, color: '#1D4ED8', lineHeight: 1 }}>
                {loading ? '-' : stats.pending || 0}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: '#1E40AF', fontWeight: 600, marginTop: 4 }}>Proses</div>
              {stats.timeMetrics?.oldestWaitingHours > 0 && (
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: COLORS.info, marginTop: 6, background: '#DBEAFE', border: '1px solid #BFDBFE', borderRadius: 6, padding: '2px 6px' }}>
                  🕐 Tertunda {stats.timeMetrics.oldestWaitingHours} jam
                </div>
              )}
            </motion.div>

            {/* Selesai */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              whileHover={{ y: -3, scale: 1.02 }}
              style={{
                background: COLORS.successBg,
                borderRadius: styles.radius.md,
                padding: `${styles.spacing.md}px`,
                textAlign: 'center',
                border: '1.5px solid #A7F3D0',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(145deg, #D1FAE5, #ECFDF5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 8px',
                boxShadow: '4px 4px 10px rgba(16,185,129,0.1), -2px -2px 6px rgba(255,255,255,0.9)',
              }}>
                <Check size={20} color={COLORS.success} />
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 20 : 26, fontWeight: 800, color: '#047857', lineHeight: 1 }}>
                {loading ? '-' : stats.completed || 0}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: '#065F46', fontWeight: 600, marginTop: 4 }}>Selesai</div>
              {stats.timeMetrics?.avgProcessingHours > 0 && (
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: COLORS.success, marginTop: 6, background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 6, padding: '2px 6px' }}>
                  ✓ Avg {stats.timeMetrics.avgProcessingHours} jam proses
                </div>
              )}
              {stats.timeMetrics?.overduePickup > 0 && (
                <div style={{ fontFamily: 'Poppins', fontSize: 9, color: COLORS.danger, marginTop: 4, background: COLORS.dangerBg, border: '1px solid #FECACA', borderRadius: 6, padding: '2px 6px' }}>
                  ⚠ {stats.timeMetrics.overduePickup} belum diambil
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* ── 4. NOTA + TARGET + STOK (2 Column Grid) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: styles.statusTargetCols, gap: bp.isMobile ? styles.spacing.sm : styles.spacing.md, marginBottom: styles.spacing.md }}>

          {/* KIRI: Ringkasan Nota Hari Ini (2x2 Grid) */}
          <div style={{ ...clayCard(true, styles.radius), padding: styles.spacing.md }}>
            <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.sm, fontWeight: 700, color: COLORS.n700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: styles.spacing.sm }}>
              📋 Nota Hari Ini
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: styles.spacing.sm }}>
              {/* Dibuat */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                style={{
                  textAlign: 'center',
                  padding: `${styles.spacing.sm}px`,
                  background: `${COLORS.primary}10`,
                  borderRadius: styles.radius.md,
                  border: '1.5px solid rgba(139,92,246,0.15)',
                }}
              >
                <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 20 : 26, fontWeight: 800, color: COLORS.primary, lineHeight: 1.2 }}>
                  {loading ? '-' : stats.notaCount.dibuat}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: COLORS.n500, marginTop: 4, fontWeight: 600 }}>Dibuat</div>
              </motion.div>
              {/* Proses */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                  textAlign: 'center',
                  padding: `${styles.spacing.sm}px`,
                  background: COLORS.infoLight,
                  borderRadius: styles.radius.md,
                  border: '1.5px solid rgba(59,130,246,0.15)',
                }}
              >
                <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 20 : 26, fontWeight: 800, color: COLORS.info, lineHeight: 1.2 }}>
                  {loading ? '-' : stats.pending || 0}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: COLORS.n500, marginTop: 4, fontWeight: 600 }}>Proses</div>
              </motion.div>
              {/* Belum Diambil */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                  textAlign: 'center',
                  padding: `${styles.spacing.sm}px`,
                  background: COLORS.dangerBg,
                  borderRadius: styles.radius.md,
                  border: '1.5px solid rgba(239,68,68,0.15)',
                }}
              >
                <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 20 : 26, fontWeight: 800, color: COLORS.danger, lineHeight: 1.2 }}>
                  {loading ? '-' : stats.timeMetrics?.overduePickup || 0}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: COLORS.n500, marginTop: 4, fontWeight: 600 }}>Belum Diambil</div>
              </motion.div>
              {/* Lunas Rate */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{
                  textAlign: 'center',
                  padding: `${styles.spacing.sm}px`,
                  background: COLORS.successBg,
                  borderRadius: styles.radius.md,
                  border: '1.5px solid rgba(16,185,129,0.15)',
                }}
              >
                <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 20 : 26, fontWeight: 800, color: COLORS.success, lineHeight: 1.2 }}>
                  {loading ? '-' : stats.lunasRate || 0}%
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: COLORS.n500, marginTop: 4, fontWeight: 600 }}>Lunas Rate</div>
              </motion.div>
            </div>
          </div>

          {/* KANAN: Target Bulanan + Stok Rendah */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: styles.spacing.sm }}>
            {/* Target Bulan Ini — hanya tampil kalau ada target */}
            {stats.targetMonth != null && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                style={{ ...clayCard(false, styles.radius), padding: `${styles.spacing.sm}px ${styles.spacing.md}px` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: styles.spacing.xs }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, fontWeight: 600, color: COLORS.n500, textTransform: 'uppercase' }}>Target Bulan Ini</div>
                  <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.lg, fontWeight: 800, color: COLORS.primary }}>{targetBulanPercent}%</span>
                </div>
                <ClayProgressBar value={stats.omsetMonth} max={stats.targetMonth} color={COLORS.primary} styles={componentStyles} />
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: COLORS.n500 }}>Realisasi</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, fontWeight: 600, color: COLORS.n700 }}>{rp(stats.omsetMonth)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, color: COLORS.n500 }}>Target</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, fontWeight: 600, color: COLORS.n700 }}>{rp(stats.targetMonth)}</span>
                </div>
              </motion.div>
            )}

            {/* Stok Rendah Alerts */}
            <LowStockAlertsCard
              alerts={lowStockAlerts}
              loading={lowStockLoading}
              onClick={() => navigate('kasir_stok_bahan')}
              styles={componentStyles}
            />
          </div>
        </div>

        {/* ── 5. CHARTS ROW 1: Revenue Trend ── */}
        <div style={{ ...clayCard(false, styles.radius), minHeight: bp.isMobile ? 180 : 220, marginBottom: styles.spacing.md }}>
          <RevenueTrendChart />
        </div>

        {/* ── 6. CHARTS ROW 2: Payment Methods + Top Services ── */}
        <div style={{ display: 'grid', gridTemplateColumns: styles.chartGridCols, gap: bp.isMobile ? styles.spacing.sm : styles.spacing.md, marginBottom: styles.spacing.md }}>
          {/* Payment Methods Donut */}
          <div style={{ ...clayCard(false, styles.radius), minHeight: bp.isMobile ? 180 : 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: styles.spacing.sm, flexWrap: 'wrap', gap: styles.spacing.xs }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: styles.spacing.sm }}>
                <div style={{ ...clayIcon(COLORS.primary, bp.isMobile ? 28 : 32) }}>
                  <CreditCard size={bp.isMobile ? 12 : 14} />
                </div>
                <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.md, fontWeight: 700, color: COLORS.n800 }}>Metode Bayar</span>
              </div>
              <PeriodSelector
                value={paymentPeriod}
                onChange={setPaymentPeriod}
                options={[
                  { value: '7d', label: '7H' },
                  { value: '14d', label: '14H' },
                  { value: '30d', label: '30H' },
                ]}
              />
            </div>
            <div style={{ height: bp.isMobile ? 100 : 120 }}>
              <DonutChart data={getPaymentData()} loading={chartLoading} styles={componentStyles} />
            </div>
          </div>

          {/* Top Services */}
          <div style={{ ...clayCard(false, styles.radius), minHeight: bp.isMobile ? 180 : 200 }}>
            <TopServicesChart />
          </div>
        </div>

        {/* ── 7. TRANSAKSI TERAKHIR ── */}
        <div style={{ ...clayCard(true, styles.radius), padding: styles.spacing.md, marginBottom: styles.spacing.md }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: styles.spacing.sm, flexWrap: 'wrap', gap: styles.spacing.xs }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: styles.spacing.sm }}>
              <Clock size={bp.isMobile ? 14 : 16} color={COLORS.primary} />
              <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.md, fontWeight: 700, color: COLORS.n700, textTransform: 'uppercase' }}>
                Transaksi Terakhir
              </span>
            </div>
            <motion.button
              onClick={() => navigate('transaksi')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: `${styles.spacing.xs}px ${styles.spacing.md}px`,
                background: 'linear-gradient(145deg, #5B005F, #8C4C8F)',
                border: 'none', borderRadius: styles.radius.sm,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(91, 0, 95, 0.25)',
              }}
            >
              <span style={{ fontFamily: 'Poppins', fontSize: styles.fonts.xs, fontWeight: 600, color: 'white' }}>Lihat Semua</span>
              <ChevronRight size={bp.isMobile ? 10 : 12} color="white" />
            </motion.button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: bp.isMobile ? 6 : styles.spacing.sm }}>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{
                  height: bp.isMobile ? 48 : 56,
                  background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
                  backgroundSize: '200% 100%',
                  borderRadius: bp.isMobile ? 10 : 12,
                  animation: 'shimmer 1.5s infinite',
                }} />
              ))
            ) : recent.length === 0 ? (
              <div style={{ textAlign: 'center', padding: bp.isMobile ? 24 : styles.spacing.lg }}>
                <div style={{ fontSize: bp.isMobile ? 24 : 32, marginBottom: bp.isMobile ? 8 : styles.spacing.sm }}>📋</div>
                <div style={{ fontFamily: 'Poppins', fontSize: bp.isMobile ? 12 : styles.fonts.md, fontWeight: 600, color: COLORS.n500 }}>Belum Ada Transaksi</div>
              </div>
            ) : (
              recent.slice(0, 4).map((tx, i) => (
                <ClayTransactionRow key={tx.id || i} tx={tx} index={i} onClick={() => navigate('detail_transaksi', tx)} styles={componentStyles} isMobile={bp.isMobile} />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Top Up Customer Selection Modal */}
      <TopupSelectCustomerModal
        visible={topupModalVisible}
        onClose={() => setTopupModalVisible(false)}
        onSelectCustomer={handleTopupSelectCustomer}
        scrollContainerRef={scrollContainerRef}
      />

    </div>
  );
}
