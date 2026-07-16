/**
 * Premium EmptyState Component
 * Beautiful, informative empty states for all pages
 *
 * Features:
 * - Animated illustrations with floating decorations
 * - Context-aware messaging
 * - Actionable suggestions
 * - Responsive layout
 * - Smooth animations
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { C, SHADOW } from '../../utils/theme';
import {
  Inbox, FileX, Users, Package, Bell, ShoppingCart,
  Calendar, BarChart3, Search, WifiOff, AlertTriangle,
  Plus, RefreshCw, Filter, Sparkles
} from 'lucide-react';

// ─── Design Tokens ─────────────────────────────────────────────────────────
const COLORS = {
  primary: '#5B005F',
  primaryDark: '#4D0051',
  primaryLight: '#F8F4FF',
  primaryMid: '#E9D5FF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  n100: '#F5F5F5',
  n200: '#E5E5E5',
  n400: '#A3A3A3',
  n500: '#737373',
  n600: '#525252',
  n700: '#404040',
};

// ─── Illustration Components (SVG-based for reliability) ───────────────────

/** Animated floating orbs */
const FloatingOrbs = ({ color = '#5B005F', count = 5 }) => (
  <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    {Array.from({ length: count }).map((_, i) => (
      <motion.div
        key={i}
        style={{
          position: 'absolute',
          width: 8 + i * 4,
          height: 8 + i * 4,
          borderRadius: '50%',
          background: `${color}`,
          opacity: 0.15 + i * 0.03,
        }}
        animate={{
          y: [-20, 20, -20],
          x: [-10, 10, -10],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 3 + i,
          repeat: Infinity,
          delay: i * 0.3,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

/** Decorative sparkle */
const SparkleDecor = ({ size = 16, color = '#FFD700', style = {} }) => (
  <motion.div
    animate={{
      scale: [0.8, 1.2, 0.8],
      opacity: [0.4, 1, 0.4],
      y: [-2, 2, -2],
    }}
    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      position: 'absolute',
      width: size,
      height: size,
      ...style,
    }}
  >
    <svg viewBox="0 0 24 24" fill={color}>
      <path d="M12 0L14 10L24 12L14 14L12 24L10 14L0 12L10 10L12 0Z" />
    </svg>
  </motion.div>
);

/** Main empty state illustration */
const EmptyIllustration = ({ type = 'default', size = 160 }) => {
  const illustrations = {
    transactions: {
      icon: <FileX size={64} strokeWidth={1.5} />,
      color: '#5B005F',
      bg: '#F8F4FF',
    },
    customers: {
      icon: <Users size={64} strokeWidth={1.5} />,
      color: '#6366F1',
      bg: '#EEF2FF',
    },
    inventory: {
      icon: <Package size={64} strokeWidth={1.5} />,
      color: '#10B981',
      bg: '#ECFDF5',
    },
    notifications: {
      icon: <Bell size={64} strokeWidth={1.5} />,
      color: '#F59E0B',
      bg: '#FFFBEB',
    },
    search: {
      icon: <Search size={64} strokeWidth={1.5} />,
      color: '#6B7280',
      bg: '#F9FAFB',
    },
    orders: {
      icon: <ShoppingCart size={64} strokeWidth={1.5} />,
      color: '#EC4899',
      bg: '#FDF2F8',
    },
    calendar: {
      icon: <Calendar size={64} strokeWidth={1.5} />,
      color: '#3B82F6',
      bg: '#EFF6FF',
    },
    reports: {
      icon: <BarChart3 size={64} strokeWidth={1.5} />,
      color: '#8B5CF6',
      bg: '#F5F3FF',
    },
    error: {
      icon: <AlertTriangle size={64} strokeWidth={1.5} />,
      color: '#EF4444',
      bg: '#FEF2F2',
    },
    offline: {
      icon: <WifiOff size={64} strokeWidth={1.5} />,
      color: '#F59E0B',
      bg: '#FFFBEB',
    },
    default: {
      icon: <Inbox size={64} strokeWidth={1.5} />,
      color: '#5B005F',
      bg: '#F8F4FF',
    },
  };

  const config = illustrations[type] || illustrations.default;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Background glow */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          inset: '-20%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${config.color}20 0%, transparent 70%)`,
          filter: 'blur(20px)',
        }}
      />

      {/* Main circle */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `linear-gradient(145deg, ${config.bg}, white)`,
          border: `2px solid ${config.color}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: `0 8px 32px ${config.color}15`,
        }}
      >
        {/* Icon */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ color: config.color }}
        >
          {config.icon}
        </motion.div>

        {/* Decorative sparkles */}
        <SparkleDecor size={12} color={config.color} style={{ top: '10%', left: '15%' }} />
        <SparkleDecor size={8} color="#FFD700" style={{ top: '20%', right: '10%' }} />
        <SparkleDecor size={10} color={config.color} style={{ bottom: '15%', left: '20%' }} />
      </motion.div>
    </div>
  );
};

// ─── Configuration per type ─────────────────────────────────────────────────
const EMPTY_STATE_CONFIG = {
  transactions: {
    type: 'transactions',
    title: 'Tidak Ada Transaksi',
    message: 'Belum ada transaksi yang sesuai dengan filter saat ini',
    suggestion: 'Coba ubah filter atau buat transaksi baru',
    action: { label: '+ Buat Nota Baru', primary: true },
    icon: '📋',
  },
  customers: {
    type: 'customers',
    title: 'Belum Ada Pelanggan',
    message: 'Pelanggan yang terdaftar akan muncul di sini',
    suggestion: 'Tambahkan pelanggan baru untuk memulai',
    action: { label: '+ Tambah Pelanggan', primary: true },
    icon: '👥',
  },
  inventory: {
    type: 'inventory',
    title: 'Stok Kosong',
    message: 'Item inventori akan muncul di sini setelah ditambahkan',
    suggestion: 'Pastikan stok sudah ter-input dengan benar',
    action: { label: '+ Tambah Stok', primary: true },
    icon: '📦',
  },
  notifications: {
    type: 'notifications',
    title: 'Tidak Ada Notifikasi',
    message: 'Notifikasi akan muncul di sini',
    suggestion: 'Pantau aktivitas terbaru dari sistem',
    icon: '🔔',
  },
  search: {
    type: 'search',
    title: 'Tidak Ditemukan',
    message: 'Hasil pencarian tidak ditemukan',
    suggestion: 'Coba kata kunci lain atau periksa ejaan',
    icon: '🔍',
  },
  orders: {
    type: 'orders',
    title: 'Tidak Ada Pesanan',
    message: 'Pesanan akan muncul di sini',
    suggestion: 'Buat pesanan baru untuk memulai',
    action: { label: '+ Buat Pesanan', primary: true },
    icon: '🛒',
  },
  calendar: {
    type: 'calendar',
    title: 'Tidak Ada Acara',
    message: 'Acara atau jadwal akan muncul di sini',
    suggestion: 'Tambahkan acara baru untuk jadwal Anda',
    action: { label: '+ Tambah Acara', primary: true },
    icon: '📅',
  },
  reports: {
    type: 'reports',
    title: 'Belum Ada Data Laporan',
    message: 'Data laporan akan muncul setelah ada aktivitas',
    suggestion: 'Pastikan sudah ada transaksi untuk periode ini',
    icon: '📊',
  },
  shifts: {
    type: 'transactions',
    title: 'Belum Ada Shift',
    message: 'Riwayat shift akan muncul di sini',
    suggestion: 'Buka shift untuk memulai pekerjaan',
    action: { label: '+ Buka Shift', primary: true },
    icon: '⏰',
  },
  production: {
    type: 'inventory',
    title: 'Belum Ada Item Produksi',
    message: 'Item yang sedang diproses akan muncul di sini',
    suggestion: 'Tunggu transaksi baru masuk',
    icon: '🧺',
  },
  error: {
    type: 'error',
    title: 'Terjadi Kesalahan',
    message: 'Gagal memuat data dari server',
    suggestion: 'Coba beberapa saat lagi atau hubungi admin',
    action: { label: '🔄 Coba Lagi', primary: false },
    icon: '⚠️',
  },
  offline: {
    type: 'offline',
    title: 'Koneksi Terputus',
    message: 'Tidak dapat terhubung ke server',
    suggestion: 'Periksa koneksi internet Anda',
    action: { label: '🔄 Ulangi', primary: false },
    icon: '📡',
  },
  default: {
    type: 'default',
    title: 'Kosong',
    message: 'Data akan muncul di sini',
    suggestion: '',
    icon: '📭',
  },
};

// ─── Main EmptyState Component ──────────────────────────────────────────────
/**
 * Premium EmptyState Component
 *
 * @param {Object} props
 * @param {string} props.type - Type of empty state
 * @param {string} props.title - Custom title
 * @param {string} props.message - Custom message
 * @param {string} props.suggestion - Additional suggestion
 * @param {Object} props.action - { label, onClick, primary }
 * @param {number} props.illustrationSize - Size of illustration
 * @param {boolean} props.compact - Compact mode
 * @param {Function} props.onAction - Action handler
 */
const EmptyState = ({
  type = 'default',
  title,
  message,
  subtitle,
  suggestion,
  action,
  illustrationSize = 140,
  compact = false,
  onAction,
  ...props
}) => {
  const config = EMPTY_STATE_CONFIG[type] || EMPTY_STATE_CONFIG.default;
  const displayTitle = title || config.title;
  const displayMessage = message || subtitle || config.message;
  const displaySuggestion = suggestion || config.suggestion;
  const displayAction = action || config.action;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '32px 20px' : '48px 24px',
        textAlign: 'center',
        minHeight: compact ? 300 : 400,
        position: 'relative',
      }}
      {...props}
    >
      {/* Illustration */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 200 }}
        style={{ marginBottom: 24 }}
      >
        <EmptyIllustration type={config.type} size={illustrationSize} />
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: compact ? 16 : 18,
          fontWeight: 700,
          color: COLORS.n800,
          marginBottom: 8,
          margin: 0,
        }}
      >
        {displayTitle}
      </motion.h3>

      {/* Message */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: compact ? 12 : 13,
          color: COLORS.n600,
          marginBottom: 4,
          maxWidth: 280,
          lineHeight: 1.5,
          margin: '0 0 4px 0',
        }}
      >
        {displayMessage}
      </motion.p>

      {/* Suggestion */}
      {displaySuggestion && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 11,
            color: COLORS.n600,
            fontStyle: 'normal',
            marginBottom: 0,
          }}
        >
          {displaySuggestion}
        </motion.p>
      )}

      {/* Action Button */}
      {displayAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ marginTop: 20 }}
        >
          <motion.button
            onClick={onAction || displayAction?.onClick}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
              color: 'white',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${COLORS.primary}30`,
              transition: 'all 0.2s ease',
            }}
          >
            {type === 'error' || type === 'offline' ? (
              <RefreshCw size={16} />
            ) : type === 'search' ? (
              <Filter size={16} />
            ) : (
              <Plus size={16} />
            )}
            {displayAction.label || (onAction ? 'Tambah' : '+ Tambah Baru')}
          </motion.button>
        </motion.div>
      )}

      {/* Decorative bottom gradient */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.primary}20, transparent)`,
        }}
      />
    </motion.div>
  );
};

// ─── EmptyStateList (for list components) ─────────────────────────────────
/**
 * EmptyStateList - For empty list items
 */
export const EmptyStateList = ({
  title = 'Tidak ada data',
  message = 'Data akan muncul di sini',
  action,
  icon: IconComponent,
  compact = false,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact ? '24px 16px' : '32px 20px',
      textAlign: 'center',
    }}
  >
    {/* Icon Circle */}
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: COLORS.primaryLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
      }}
    >
      {IconComponent ? (
        <IconComponent size={24} color={COLORS.primary} />
      ) : (
        <Inbox size={24} color={COLORS.primary} />
      )}
    </div>

    <h4
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        color: COLORS.n700,
        marginBottom: 4,
        margin: '0 0 4px 0',
      }}
    >
      {title}
    </h4>

    <p
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 11,
        color: COLORS.n500,
        marginBottom: action ? 12 : 0,
        margin: 0,
      }}
    >
      {message}
    </p>

    {action && (
      <button
        onClick={action.onClick}
        style={{
          marginTop: 8,
          padding: '6px 16px',
          borderRadius: 8,
          border: 'none',
          background: COLORS.primary,
          color: 'white',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {action.label}
      </button>
    )}
  </motion.div>
);

// ─── EmptyStateCard (for empty cards in grid) ──────────────────────────────
/**
 * EmptyStateCard - For empty cards in grid layouts
 */
export const EmptyStateCard = ({
  title = 'Kosong',
  subtitle,
  icon: IconComponent,
}) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    style={{
      borderRadius: 16,
      border: `2px dashed ${COLORS.n200}`,
      padding: '24px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      minHeight: 140,
      background: `${COLORS.primaryLight}50`,
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: COLORS.primaryLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        opacity: 0.7,
      }}
    >
      {IconComponent ? (
        <IconComponent size={20} color={COLORS.primary} />
      ) : (
        <Inbox size={20} color={COLORS.primary} />
      )}
    </div>
    <p
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 11,
        fontWeight: 600,
        color: COLORS.n500,
        margin: 0,
      }}
    >
      {title}
    </p>
    {subtitle && (
      <p
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 9,
          color: COLORS.n400,
          margin: '4px 0 0 0',
        }}
      >
        {subtitle}
      </p>
    )}
  </motion.div>
);

// ─── EmptyStateInline (for tables/rows) ───────────────────────────────────
/**
 * EmptyStateInline - For inline empty states in tables
 */
export const EmptyStateInline = ({ colSpan = 1, message = 'Tidak ada data' }) => (
  <tr>
    <td colSpan={colSpan}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          color: COLORS.n400,
        }}
      >
        <Inbox size={32} strokeWidth={1.5} style={{ marginBottom: 8, opacity: 0.5 }} />
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 12,
          }}
        >
          {message}
        </span>
      </div>
    </td>
  </tr>
);

// ─── EmptyStateSearch (specialized for search results) ──────────────────────
/**
 * EmptyStateSearch - For search with no results
 */
export const EmptyStateSearch = ({ query, onClear, suggestion }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
    }}
  >
    {/* Search icon with animation */}
    <motion.div
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: COLORS.primaryLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
      }}
    >
      <Search size={36} color={COLORS.primary} strokeWidth={1.5} />
    </motion.div>

    <h4
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 15,
        fontWeight: 700,
        color: COLORS.n800,
        marginBottom: 6,
        margin: '0 0 6px 0',
      }}
    >
      Pencarian "{query}" tidak ditemukan
    </h4>

    <p
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 12,
        color: COLORS.n500,
        marginBottom: 16,
        margin: 0,
        maxWidth: 260,
      }}
    >
      {suggestion || 'Coba kata kunci lain atau periksa ejaan'}
    </p>

    {onClear && (
      <button
        onClick={onClear}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 8,
          border: `1px solid ${COLORS.n200}`,
          background: 'white',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.n600,
          cursor: 'pointer',
        }}
      >
        <RefreshCw size={14} />
        Reset Pencarian
      </button>
    )}
  </motion.div>
);

// ─── Export ────────────────────────────────────────────────────────────────
export default EmptyState;
export { EmptyIllustration, EMPTY_STATE_CONFIG };
