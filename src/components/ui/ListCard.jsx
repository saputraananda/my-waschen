/**
 * ListCard Component
 * Compact list item/card for transactions, customers, etc.
 * Features premium glassmorphism design
 *
 * @description
 * Displays data in a compact card format optimized for mobile-first
 * with expandable details and inline actions.
 * Now with glassmorphism effect: translucent backdrop with blur
 *
 * @example
 * // Transaction row
 * <ListCard
 *   type="transaction"
 *   title="WSC-0707-001"
 *   subtitle="Budi Santoso"
 *   meta="08:30 • 3 layanan"
 *   value="Rp 125.000"
 *   status="lunas"
 *   onClick={() => handleOpen(id)}
 * />
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Glassmorphism styles for cards
 */
const glassStyles = {
  card: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
  },
  hover: {
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  },
};

/**
 * Express Badge Component - Lightning icon for express orders
 */
const ExpressBadge = ({ size = 'sm' }) => {
  const sizeConfig = size === 'lg'
    ? { icon: 14, padding: '4px 10px', fontSize: 11, label: 'Express' }
    : { icon: 12, padding: '3px 8px', fontSize: 10, label: 'Express' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: sizeConfig.padding,
        borderRadius: 999,
        fontSize: sizeConfig.fontSize,
        fontWeight: 700,
        background: '#FEF3C7',
        color: '#D97706',
        border: '1.5px solid #F59E0B',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
        letterSpacing: '0.3px',
      }}
    >
      {/* Lightning Icon */}
      <svg
        width={sizeConfig.icon}
        height={sizeConfig.icon}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>
      </svg>
      {sizeConfig.label}
    </span>
  );
};

/**
 * Status Badge component
 */
const StatusBadge = ({ status, type = 'payment', size = 'sm' }) => {
  const configs = {
    payment: {
      lunas: { bg: '#10B98120', color: '#10B981', label: 'Lunas' },
      paid: { bg: '#10B98120', color: '#10B981', label: 'Lunas' },
      dp: { bg: '#F59E0B20', color: '#F59E0B', label: 'DP' },
      partial: { bg: '#F59E0B20', color: '#F59E0B', label: 'DP' },
      bayarnanti: { bg: '#6B728020', color: '#6B7280', label: 'Bayar Nanti' },
      unpaid: { bg: '#6B728020', color: '#6B7280', label: 'Belum Lunas' },
      pending: { bg: '#6B728020', color: '#6B7280', label: 'Pending' },
      lunas_partial: { bg: '#10B98120', color: '#10B981', label: 'Lunas' },
    },
    production: {
      received: { bg: '#3B82F620', color: '#3B82F6', label: 'Diterima' },
      washing: { bg: '#F59E0B20', color: '#F59E0B', label: 'Dicuci' },
      drying: { bg: '#F59E0B20', color: '#F59E0B', label: 'Dikeringkan' },
      ironing: { bg: '#F59E0B20', color: '#F59E0B', label: 'Disetrika' },
      packing: { bg: '#8B5CF620', color: '#8B5CF6', label: 'Dikemas' },
      packed: { bg: '#10B98120', color: '#10B981', label: 'Siap' },
    },
    stock: {
      critical: { bg: '#EF444420', color: '#EF4444', label: 'Kritis' },
      warning: { bg: '#F59E0B20', color: '#F59E0B', label: 'Warning' },
      normal: { bg: '#10B98120', color: '#10B981', label: 'Normal' },
    },
    // Order status types
    order: {
      baru: { bg: '#3B82F620', color: '#3B82F6', label: 'Baru' },
      proses: { bg: '#F59E0B20', color: '#F59E0B', label: 'Proses' },
      selesai: { bg: '#10B98120', color: '#10B981', label: 'Siap Ambil' },
      diambil: { bg: '#6B728020', color: '#6B7280', label: 'Diambil' },
      dibatalkan: { bg: '#EF444420', color: '#EF4444', label: 'Batal' },
    },
  };

  const config = configs[type]?.[status] || configs.payment.pending;
  const fontSize = size === 'sm' ? 10 : 11;
  const padding = size === 'sm' ? '2px 8px' : '3px 10px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        borderRadius: 999,
        fontSize,
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
};

/**
 * Chevron indicator
 */
const ChevronIcon = ({ expanded, size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9CA3AF"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
      transition: 'transform 0.2s ease',
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Main ListCard Component
 */
const ListCard = ({
  // Type
  type = 'default', // 'transaction' | 'customer' | 'item' | 'custom'

  // Content
  title = '',
  subtitle = '',
  meta = '',
  value = '',
  secondary = '',

  // Status
  status = null,
  statusType = 'payment', // 'payment' | 'production' | 'stock' | 'order'

  // Express indicator (new)
  isExpress = false,

  // Order status for border color (new)
  orderStatus = null, // 'baru' | 'proses' | 'selesai' | 'diambil' | 'dibatalkan'

  // Expandable
  expandable = false,
  expanded = false,
  onToggle = null,
  detail = null,

  // Actions
  actions = null,
  actionPosition = 'right', // 'right' | 'bottom'

  // Click handling
  onClick,

  // Styling
  color = '#6e2e78',
  compact = false,
  interactive = true,

  // Glassmorphism effect
  glassmorphism = true, // Enable by default for premium look

  // Left accent (for alerts)
  accent = null, // 'critical' | 'warning' | 'success' | 'info'
  accentColor = null,

  // Avatar/Icon
  avatar = null,
  avatarColor = '#6e2e78',

  // ClassName
  className = '',
  style = {},
}) => {
  // Order status to border color mapping
  const orderStatusColors = {
    baru: { border: '#3B82F6', shadow: 'rgba(59, 130, 246, 0.15)' },
    proses: { border: '#F59E0B', shadow: 'rgba(245, 158, 11, 0.15)' },
    selesai: { border: '#10B981', shadow: 'rgba(16, 185, 129, 0.15)' },
    diambil: { border: '#6B7280', shadow: 'rgba(107, 114, 128, 0.1)' },
    dibatalkan: { border: '#EF4444', shadow: 'rgba(239, 68, 68, 0.15)' },
  };

  const accentColors = {
    critical: '#EF4444',
    warning: '#F59E0B',
    success: '#10B981',
    info: '#3B82F6',
  };

  // Priority: accentColor > accent > orderStatus > isExpress
  const leftBorderColor = accentColor || accentColors[accent] || (orderStatus && orderStatusColors[orderStatus]?.border) || (isExpress ? '#F59E0B' : 'transparent');
  const cardShadow = accentColor ? undefined : (orderStatus ? orderStatusColors[orderStatus]?.shadow : (isExpress ? 'rgba(245, 158, 11, 0.1)' : undefined));

  // Glassmorphism card style with order status border
  const glassCardStyle = {
    background: isExpress
      ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(254, 243, 199, 0.4) 100%)'
      : 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: compact ? 10 : 14,
    border: `1px solid ${isExpress ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.4)'}`,
    borderLeft: `4px solid ${leftBorderColor}`,
    padding: compact ? '10px 12px' : '12px 16px',
    cursor: onClick || expandable ? 'pointer' : 'default',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    boxShadow: cardShadow
      ? `0 4px 16px ${cardShadow}, 0 2px 8px rgba(0, 0, 0, 0.04)`
      : '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    ...style,
  };

  // Standard card style with order status border
  const standardCardStyle = {
    background: isExpress
      ? 'linear-gradient(135deg, #FFFFFF 0%, #FEF3C7 100%)'
      : '#FFFFFF',
    borderRadius: compact ? 8 : 10,
    border: `1px solid ${isExpress ? 'rgba(245, 158, 11, 0.3)' : 'rgba(0, 0, 0, 0.05)'}`,
    borderLeft: `4px solid ${leftBorderColor}`,
    padding: compact ? '8px 10px' : '10px 12px',
    boxShadow: cardShadow
      ? `0 4px 12px ${cardShadow}`
      : '0 1px 4px rgba(0, 0, 0, 0.05)',
    cursor: onClick || expandable ? 'pointer' : 'default',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'background 0.15s ease',
    overflow: 'hidden',
    ...style,
  };

  // Use glassmorphism or standard style
  const cardStyle = glassmorphism ? glassCardStyle : standardCardStyle;

  const headerStyle = {
    display: 'flex',
    alignItems: compact ? 'flex-start' : 'center',
    justifyContent: 'space-between',
    gap: 8,
  };

  const titleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 12 : 13,
    fontWeight: 600,
    color: '#111827',
    lineHeight: 1.3,
    flex: 1,
    minWidth: 0,
  };

  const subtitleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 10 : 11,
    color: '#374151',
    marginTop: 2,
  };

  const metaStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  };

  const valueStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 12 : 14,
    fontWeight: 700,
    color: '#111827',
    textAlign: 'right',
    whiteSpace: 'nowrap',
  };

  const secondaryStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 2,
  };

  const avatarStyle = {
    width: compact ? 32 : 36,
    height: compact ? 32 : 36,
    borderRadius: compact ? 8 : 10,
    background: `linear-gradient(135deg, ${avatarColor}CC, ${avatarColor})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 12 : 14,
    fontWeight: 700,
    flexShrink: 0,
  };

  const handleClick = (e) => {
    if (onClick && !e.defaultPrevented) {
      onClick(e);
    }
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle(!expanded);
    }
  };

  const cardContent = (
    <>
      {/* Main row */}
      <div
        style={headerStyle}
        onClick={expandable ? handleToggle : handleClick}
      >
        {/* Left side: Avatar/Icon + Content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          {/* Avatar */}
          {avatar ? (
            <div style={avatarStyle}>{avatar}</div>
          ) : avatar === null && title ? (
            // Default avatar with first letter
            <div style={avatarStyle}>
              {title.charAt(0).toUpperCase()}
            </div>
          ) : null}

          {/* Text content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={titleStyle}>{title}</div>
            {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
            {meta && <div style={metaStyle}>{meta}</div>}
          </div>
        </div>

        {/* Right side: Value/Status + Chevron */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {value && <div style={valueStyle}>{value}</div>}
          {secondary && <div style={secondaryStyle}>{secondary}</div>}
          {status && <StatusBadge status={status} type={statusType} size={compact ? 'sm' : 'md'} />}
          {isExpress && <ExpressBadge size={compact ? 'sm' : 'md'} />}
        </div>

        {/* Expand indicator */}
        {expandable && (
          <div style={{ marginLeft: 4 }}>
            <ChevronIcon expanded={expanded} />
          </div>
        )}
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {expandable && expanded && detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #E5E7EB',
            }}>
              {detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom actions */}
      {actions && actionPosition === 'bottom' && expanded && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid #E5E7EB',
            display: 'flex',
            gap: 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </>
  );

  // Interactive wrapper
  if (onClick || expandable) {
    return (
      <motion.div
        style={cardStyle}
        onClick={onClick}
        whileTap={{ scale: 0.995 }}
        whileHover={glassmorphism ? glassStyles.hover : {}}
        className={className}
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <div style={cardStyle} className={className}>
      {cardContent}
    </div>
  );
};

/**
 * ListCardGroup - Container for multiple list cards
 */
export const ListCardGroup = ({
  children,
  title = '',
  className = '',
  style = {},
}) => (
  <div className={className} style={style}>
    {title && (
      <div
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 8,
          paddingLeft: 4,
        }}
      >
        {title}
      </div>
    )}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {children}
    </div>
  </div>
);

/**
 * ListCardSkeleton - Loading placeholder
 */
export const ListCardSkeleton = ({ compact = false }) => (
  <div
    style={{
      background: '#FFFFFF',
      borderRadius: compact ? 8 : 10,
      padding: compact ? '8px 10px' : '10px 12px',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 4, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '40%', height: 10, borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 10 }} />
    </div>
  </div>
);

/**
 * ListCardGridSkeleton - Loading placeholder grid
 */
export const ListCardGridSkeleton = ({ count = 5, compact = false }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {Array.from({ length: count }).map((_, i) => (
      <ListCardSkeleton key={i} compact={compact} />
    ))}
  </div>
);

export { StatusBadge };
export default ListCard;
