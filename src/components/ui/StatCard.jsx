/**
 * StatCard Component
 * Compact stat card for dashboard with inline metrics
 * Features premium glassmorphism design
 *
 * @description
 * Displays a single metric with optional trend indicator and icon.
 * Optimized for high information density dashboards.
 * Now with glassmorphism effect: translucent backdrop with blur
 *
 * @example
 * // Basic usage
 * <StatCard
 *   label="Omset"
 *   value="Rp 2.45Jt"
 *   trend={{ value: 12, direction: 'up' }}
 *   icon={<MoneyIcon />}
 * />
 *
 * // Glassmorphism variant (default)
 * <StatCard
 *   label="Target"
 *   value="75%"
 *   progress={75}
 *   glassmorphism
 * />
 */

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Glassmorphism card wrapper
 * Creates a frosted glass effect with backdrop blur
 */
const GlassWrapper = ({ children, style, className, onClick }) => {
  const glassStyle = {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
    ...style,
  };

  if (onClick) {
    return (
      <motion.div
        style={glassStyle}
        onClick={onClick}
        whileHover={{
          y: -2,
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div style={glassStyle} className={className}>
      {children}
    </div>
  );
};

/**
 * Semi-Claymorphism card wrapper (alternative style)
 * Softer, more pillowy appearance
 */
const ClayWrapper = ({ children, style, className, onClick }) => {
  const clayStyle = {
    background: 'linear-gradient(145deg, #ffffff, #f0f4f8)',
    boxShadow: '8px 8px 16px rgba(0, 0, 0, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.9)',
    ...style,
  };

  if (onClick) {
    return (
      <motion.div
        style={clayStyle}
        onClick={onClick}
        whileHover={{
          y: -2,
          boxShadow: '10px 10px 20px rgba(0, 0, 0, 0.1), -5px -5px 15px rgba(255, 255, 255, 0.95)',
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div style={clayStyle} className={className}>
      {children}
    </div>
  );
};

/**
 * Trend indicator component
 */
const TrendIndicator = ({ trend, size = 'sm' }) => {
  if (!trend) return null;

  const { value = 0, direction = 'neutral', label = '' } = trend;
  const isPositive = direction === 'up';
  const isNegative = direction === 'down';
  const isNeutral = direction === 'neutral' || value === 0;

  const colors = {
    up: '#10B981',
    down: '#EF4444',
    neutral: '#6B7280',
  };

  const color = colors[direction] || colors.neutral;
  const arrow = isPositive ? '↑' : isNegative ? '↓' : '';
  const sign = isPositive ? '+' : '';

  const fontSize = size === 'sm' ? 10 : 11;
  const arrowSize = size === 'sm' ? 12 : 14;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize,
        fontWeight: 500,
        color,
        lineHeight: 1,
      }}
    >
      <span style={{ fontSize: arrowSize, lineHeight: 1 }}>{arrow}</span>
      <span>{sign}{value}%</span>
      {label && <span style={{ color: '#9CA3AF', marginLeft: 2 }}>{label}</span>}
    </span>
  );
};

/**
 * Mini progress bar component
 */
const MiniProgress = ({ progress, color = '#6e2e78', height = 4 }) => {
  const clampedProgress = Math.min(100, Math.max(0, progress || 0));

  return (
    <div
      style={{
        width: '100%',
        height,
        backgroundColor: '#E5E7EB',
        borderRadius: height / 2,
        overflow: 'hidden',
        marginTop: 6,
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${clampedProgress}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          height: '100%',
          background: progress >= 100
            ? 'linear-gradient(90deg, #10B981, #059669)'
            : `linear-gradient(90deg, ${color}, ${color}CC)`,
          borderRadius: height / 2,
        }}
      />
    </div>
  );
};

/**
 * Icon wrapper with background
 */
const IconWrapper = ({ icon, color = '#6e2e78', size = 32 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      backgroundColor: `${color}18`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color,
      flexShrink: 0,
    }}
  >
    {icon}
  </div>
);

/**
 * StatCard Component
 */
const StatCard = ({
  // Content
  label = '',
  value = '',
  sub = '',
  trend = null,
  progress = null,

  // Icon
  icon = null,
  iconColor = '#6e2e78',
  iconSize = 30,

  // Visual
  color = '#6e2e78',
  compact = false,
  interactive = false,

  // Glassmorphism effect
  glassmorphism = true, // Enable by default for premium look

  // Actions
  onClick,

  // Styling
  className = '',
  style = {},
}) => {
  // Glassmorphism card style
  const glassCardStyle = {
    borderRadius: compact ? 12 : 16,
    padding: compact ? '12px 14px' : '14px 18px',
    cursor: onClick || interactive ? 'pointer' : 'default',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'all 0.2s ease',
    ...style,
  };

  // Standard card style (fallback)
  const standardCardStyle = {
    background: '#FFFFFF',
    borderRadius: compact ? 10 : 12,
    padding: compact ? '10px 12px' : '12px 14px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
    cursor: onClick || interactive ? 'pointer' : 'default',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'box-shadow 0.22s ease, transform 0.22s ease',
    ...style,
  };

  // Use glassmorphism or standard style
  const cardStyle = glassmorphism ? glassCardStyle : standardCardStyle;

  const labelStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 10 : 11,
    color: '#3a3a3a',
    lineHeight: 1.3,
    marginBottom: 4,
  };

  const valueStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 16 : 18,
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1,
  };

  const subStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 9 : 10,
    color: color,
    marginTop: 4,
    fontWeight: 500,
  };

  const content = (
    <>
      {/* Header row with icon and label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: compact ? 2 : 4,
        }}
      >
        {icon && <IconWrapper icon={icon} color={iconColor} size={iconSize} />}
        <div style={labelStyle}>{label}</div>
      </div>

      {/* Value */}
      <div style={valueStyle}>{value}</div>

      {/* Trend or sub text */}
      {(trend || sub) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {trend && <TrendIndicator trend={trend} size={compact ? 'sm' : 'md'} />}
          {sub && !trend && (
            <span style={subStyle}>{sub}</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      {progress !== null && (
        <MiniProgress progress={progress} color={color} />
      )}
    </>
  );

  // Determine wrapper based on props
  const cardWrapper = (
    <div style={cardStyle} className={className}>
      {content}
    </div>
  );

  // Interactive wrapper with hover effect
  if (onClick || interactive) {
    return (
      <motion.div
        style={cardStyle}
        onClick={onClick}
        whileHover={glassmorphism ? {
          y: -2,
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        } : {
          y: -2,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={className}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div style={cardStyle} className={className}>
      {content}
    </div>
  );
};

/**
 * StatCardGrid - Grid layout for multiple stat cards
 */
export const StatCardGrid = ({
  children,
  columns = 4,
  gap = 12,
  className = '',
  style = {},
}) => {
  // Responsive column calculation
  const getColumns = () => {
    if (typeof window === 'undefined') return columns;
    const width = window.innerWidth;
    if (width < 640) return 2;
    if (width < 1024) return 2;
    return columns;
  };

  return (
    <div
      className={`stat-card-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * StatCardSkeleton - Loading placeholder
 */
export const StatCardSkeleton = ({ compact = false }) => (
  <div
    style={{
      background: '#FFFFFF',
      borderRadius: compact ? 10 : 12,
      padding: compact ? '10px 12px' : '12px 14px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
    }}
  >
    <div
      className="skeleton"
      style={{
        width: '60%',
        height: 12,
        borderRadius: 6,
        marginBottom: 8,
      }}
    />
    <div
      className="skeleton"
      style={{
        width: '80%',
        height: 20,
        borderRadius: 6,
        marginBottom: 8,
      }}
    />
    <div
      className="skeleton"
      style={{
        width: '40%',
        height: 10,
        borderRadius: 4,
      }}
    />
  </div>
);

/**
 * StatCardGridSkeleton - Loading grid
 */
export const StatCardGridSkeleton = ({ count = 4, compact = false }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} compact={compact} />
    ))}
  </div>
);

export default StatCard;

/**
 * StatMini - Ultra compact stat display for inline use
 * Used in AdminLaporanPage for quick info pills
 */
export const StatMini = ({ label, value, suffix = '' }) => {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      borderRadius: 10,
      padding: '8px 10px',
      textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
    }}>
      <div style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 9,
        fontWeight: 500,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 12,
        fontWeight: 700,
        color: '#1F2937',
        lineHeight: 1.2,
      }}>
        {value}{suffix && <span style={{ fontWeight: 400, fontSize: 9, color: '#9CA3AF', marginLeft: 2 }}>{suffix}</span>}
      </div>
    </div>
  );
};
