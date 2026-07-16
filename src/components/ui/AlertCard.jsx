/**
 * AlertCard Component
 * Alert/warning notification cards for low stock, reminders, etc.
 * Features premium glassmorphism design
 *
 * @description
 * Displays alerts with severity indicators, inline actions,
 * and consistent styling across all pages.
 * Now with glassmorphism effect: translucent backdrop with blur
 *
 * @example
 * // Low stock alert
 * <AlertCard
 *   severity="critical"
 *   title="Deterjen Cair Reguler"
 *   subtitle="Outlet: Cibubur"
 *   meta="Stok: 2.5L / Min: 5L (50%)"
 *   actions={[
 *     { label: "Kirim Alert", onClick: handleAlert },
 *     { label: "Ajukan PR", onClick: handlePR }
 *   ]}
 * />
 */

import React from 'react';
import { motion } from 'framer-motion';

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
 * Severity configurations
 */
const SEVERITY_CONFIG = {
  critical: {
    color: '#EF4444',
    bg: '#FEF2F2',
    label: 'Kritis',
    icon: '🚨',
  },
  warning: {
    color: '#F59E0B',
    bg: '#FFFBEB',
    label: 'Peringatan',
    icon: '⚠️',
  },
  info: {
    color: '#3B82F6',
    bg: '#EFF6FF',
    label: 'Info',
    icon: 'ℹ️',
  },
  success: {
    color: '#10B981',
    bg: '#ECFDF5',
    label: 'Berhasil',
    icon: '✅',
  },
};

/**
 * AlertIcon component
 */
const AlertIcon = ({ severity = 'warning', size = 24 }) => {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: `${config.color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        flexShrink: 0,
      }}
    >
      {config.icon}
    </div>
  );
};

/**
 * SeverityBadge component
 */
const SeverityBadge = ({ severity = 'warning', size = 'sm' }) => {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;
  const fontSize = size === 'sm' ? 9 : 10;
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: padding,
        borderRadius: 999,
        fontSize,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        backgroundColor: config.bg,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
};

/**
 * AlertActionButton component
 */
const AlertActionButton = ({
  label,
  onClick,
  variant = 'default', // 'default' | 'primary' | 'ghost'
  size = 'sm',
  icon,
}) => {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 600,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  };

  const sizeStyles = {
    sm: { height: 32, padding: '0 12px', fontSize: 11 },
    md: { height: 36, padding: '0 16px', fontSize: 12 },
  };

  const variantStyles = {
    default: {
      backgroundColor: '#F3F4F6',
      color: '#374151',
    },
    primary: {
      backgroundColor: '#5B005F',
      color: '#FFFFFF',
      boxShadow: '0 2px 8px rgba(110, 46, 120, 0.3)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#5B005F',
    },
  };

  const style = {
    ...baseStyle,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  return (
    <motion.button
      style={style}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </motion.button>
  );
};

/**
 * StockIndicator component
 */
const StockIndicator = ({
  current = 0,
  minimum = 5,
  unit = 'L',
  compact = false,
}) => {
  const percentage = minimum > 0 ? (current / minimum) * 100 : 0;
  const isLow = percentage < 50;
  const isCritical = percentage < 25;

  const barColor = isCritical
    ? '#EF4444'
    : isLow
    ? '#F59E0B'
    : '#10B981';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {!compact && (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 10,
            color: '#9CA3AF',
          }}
        >
          {current}{unit} / Min: {minimum}{unit}
        </span>
      )}
      <div
        style={{
          width: '100%',
          height: 4,
          backgroundColor: '#E5E7EB',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            height: '100%',
            backgroundColor: barColor,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

/**
 * AlertCard Component
 */
const AlertCard = ({
  // Content
  title = '',
  subtitle = '',
  meta = '',
  description = '',

  // Severity
  severity = 'warning', // 'critical' | 'warning' | 'info' | 'success'

  // Stock info (for inventory alerts)
  stock = null, // { current, minimum, unit }
  showStockIndicator = true,

  // Icon
  icon = null,
  customIcon = null,

  // Actions
  actions = [], // [{ label, onClick, variant?, icon? }]
  primaryAction = null, // { label, onClick, icon? }

  // Link
  href = null,
  onClick,

  // Compact mode
  compact = false,

  // Glassmorphism effect
  glassmorphism = true, // Enable by default for premium look

  // Styling
  className = '',
  style = {},
}) => {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;

  // Glassmorphism card style
  const glassCardStyle = {
    borderRadius: compact ? 10 : 14,
    borderLeft: `4px solid ${config.color}`,
    padding: compact ? '10px 12px' : '12px 16px',
    cursor: onClick || href ? 'pointer' : 'default',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    ...style,
  };

  // Standard card style (fallback)
  const standardCardStyle = {
    background: '#FFFFFF',
    borderRadius: compact ? 8 : 10,
    borderLeft: `4px solid ${config.color}`,
    padding: compact ? '8px 10px' : '10px 12px',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
    cursor: onClick || href ? 'pointer' : 'default',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'box-shadow 0.2s ease',
    ...style,
  };

  // Use glassmorphism or standard style
  const cardStyle = glassmorphism ? glassCardStyle : standardCardStyle;

  const titleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 12 : 13,
    fontWeight: 600,
    color: '#111827',
    lineHeight: 1.3,
  };

  const subtitleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  };

  const metaStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  };

  const descriptionStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 1.5,
    marginTop: 6,
  };

  const actionsContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: compact ? 6 : 10,
  };

  const Content = (
    <>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Icon */}
        {customIcon || <AlertIcon severity={severity} size={compact ? 20 : 24} />}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={titleStyle}>{title}</div>
            <SeverityBadge severity={severity} size="sm" />
          </div>

          {/* Subtitle */}
          {subtitle && <div style={subtitleStyle}>{subtitle}</div>}

          {/* Meta */}
          {meta && <div style={metaStyle}>{meta}</div>}

          {/* Stock indicator */}
          {showStockIndicator && stock && (
            <div style={{ marginTop: 8 }}>
              <StockIndicator
                current={stock.current}
                minimum={stock.minimum}
                unit={stock.unit}
                compact={compact}
              />
            </div>
          )}

          {/* Description */}
          {description && <div style={descriptionStyle}>{description}</div>}
        </div>
      </div>

      {/* Actions */}
      {(actions.length > 0 || primaryAction) && (
        <div style={actionsContainerStyle}>
          {primaryAction && (
            <AlertActionButton
              label={primaryAction.label}
              onClick={primaryAction.onClick}
              variant="primary"
              size={compact ? 'sm' : 'md'}
              icon={primaryAction.icon}
            />
          )}
          {actions.map((action, index) => (
            <AlertActionButton
              key={index}
              label={action.label}
              onClick={action.onClick}
              variant={action.variant || 'default'}
              size={compact ? 'sm' : 'md'}
              icon={action.icon}
            />
          ))}
        </div>
      )}
    </>
  );

  // Interactive wrapper
  if (href || onClick) {
    return (
      <motion.a
        href={href}
        onClick={onClick}
        style={{ ...cardStyle, textDecoration: 'none' }}
        whileHover={glassmorphism ? {
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        } : {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        className={className}
      >
        {Content}
      </motion.a>
    );
  }

  return (
    <div style={cardStyle} className={className}>
      {Content}
    </div>
  );
};

/**
 * AlertCardGroup - Container for multiple alerts
 */
export const AlertCardGroup = ({
  children,
  title = '',
  severity = null, // Filter by severity
  count = null, // Show count badge
  collapsible = false,
  defaultExpanded = true,
  className = '',
  style = {},
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const config = severity ? SEVERITY_CONFIG[severity] : null;

  return (
    <div className={className} style={style}>
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 10,
            cursor: collapsible ? 'pointer' : 'default',
          }}
          onClick={() => collapsible && setExpanded(!expanded)}
        >
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {title}
          </span>
          {count !== null && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 10,
                backgroundColor: config ? `${config.color}20` : '#E5E7EB',
                color: config ? config.color : '#6B7280',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {count}
            </span>
          )}
          {collapsible && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                marginLeft: 'auto',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'hidden',
          maxHeight: expanded ? 'none' : 0,
          transition: 'max-height 0.3s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * AlertCardSkeleton - Loading placeholder
 */
export const AlertCardSkeleton = ({ compact = false }) => (
  <div
    style={{
      background: '#FFFFFF',
      borderRadius: compact ? 8 : 10,
      borderLeft: '4px solid #E5E7EB',
      padding: compact ? '8px 10px' : '10px 12px',
      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 6 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ width: '70%', height: 14, borderRadius: 4, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: '40%', height: 10, borderRadius: 4 }} />
      </div>
    </div>
  </div>
);

/**
 * AlertCardGridSkeleton - Loading grid
 */
export const AlertCardGridSkeleton = ({ count = 3 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    {Array.from({ length: count }).map((_, i) => (
      <AlertCardSkeleton key={i} />
    ))}
  </div>
);

export {
  AlertIcon,
  SeverityBadge,
  AlertActionButton,
  StockIndicator,
  SEVERITY_CONFIG,
};
export default AlertCard;
