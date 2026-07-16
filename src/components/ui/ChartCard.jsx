/**
 * ChartCard Component
 * Container for chart visualizations with consistent styling
 * Features premium glassmorphism design
 *
 * @description
 * Wrapper component for Recharts or custom charts with
 * consistent header, padding, and responsive behavior.
 * Now with glassmorphism effect: translucent backdrop with blur
 *
 * @example
 * // Basic usage
 * <ChartCard
 *   title="Tren Omset"
 *   subtitle="7 Hari Terakhir"
 * >
 *   <LineChart data={data} />
 * </ChartCard>
 *
 * // Glassmorphism variant (default)
 * <ChartCard
 *   title="Metode Pembayaran"
 *   glassmorphism
 * >
 *   <PieChart data={data} />
 * </ChartCard>
 */

import React from 'react';
import { motion } from 'framer-motion';

/**
 * Glassmorphism card styles
 * Creates a frosted glass effect with backdrop blur
 */
const glassStyles = {
  card: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
  },
  hover: {
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  },
};

/**
 * ChartCard Component
 */
const ChartCard = ({
  // Header
  title = '',
  subtitle = '',
  icon = null,

  // Actions
  actions = null,
  actionPosition = 'right', // 'right' | 'bottom'

  // Content
  children,

  // Styling
  color = '#5B005F',
  compact = false,

  // Glassmorphism effect
  glassmorphism = true, // Enable by default for premium look

  // State
  loading = false,
  error = null,

  // Collapsible (for mobile)
  collapsible = false,
  defaultExpanded = true,

  // Footer
  footer = null,

  // ClassName
  className = '',
  style = {},
}) => {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const headerStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: compact ? 12 : 16,
    gap: 12,
  };

  const titleContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  };

  const iconStyle = {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${color}18`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color,
    flexShrink: 0,
  };

  const titleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: compact ? 13 : 14,
    fontWeight: 600,
    color: '#111827',
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const subtitleStyle = {
    fontFamily: 'Poppins, sans-serif',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  };

  const actionsStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  };

  const chartContainerStyle = {
    minHeight: compact ? 180 : 220,
    position: 'relative',
    transition: 'max-height 0.3s ease',
    overflow: 'hidden',
  };

  const footerStyle = {
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid #E5E7EB',
  };

  // Get card styles based on glassmorphism prop
  const getCardStyle = (baseStyle = {}) => ({
    ...baseStyle,
    borderRadius: compact ? 14 : 18,
    padding: compact ? 14 : 18,
    ...(glassmorphism ? glassStyles.card : {}),
    ...style,
  });

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={`chart-card ${className}`}
        style={getCardStyle()}
      >
        {/* Header skeleton */}
        <div style={{ marginBottom: 16 }}>
          <div className="skeleton" style={{ width: '50%', height: 16, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: '30%', height: 12, borderRadius: 4 }} />
        </div>

        {/* Chart skeleton */}
        <div
          className="skeleton"
          style={{
            width: '100%',
            height: 200,
            borderRadius: 8,
          }}
        />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={`chart-card ${className}`}
        style={getCardStyle()}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: '#111827' }}>
            {title}
          </div>
        </div>

        <div
          style={{
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9CA3AF',
            textAlign: 'center',
            padding: 20,
          }}
        >
          <span style={{ fontSize: 32, marginBottom: 8 }}>⚠️</span>
          <p style={{ fontFamily: 'Poppins', fontSize: 13, color: '#6B7280', margin: 0 }}>
            Gagal memuat data
          </p>
          <p style={{ fontFamily: 'Poppins', fontSize: 11, color: '#9CA3AF', margin: '8px 0 0' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  const cardContent = (
    <>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleContainerStyle}>
          {icon && <div style={iconStyle}>{icon}</div>}
          <div style={{ minWidth: 0 }}>
            <div style={titleStyle}>{title}</div>
            {subtitle && <div style={subtitleStyle}>{subtitle}</div>}
          </div>
        </div>

        {actions && actionPosition === 'right' && (
          <div style={actionsStyle}>{actions}</div>
        )}
      </div>

      {/* Chart Container */}
      <div style={chartContainerStyle}>
        {collapsible && !expanded ? (
          <div
            style={{
              height: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9CA3AF',
              fontSize: 13,
              cursor: 'pointer',
            }}
            onClick={() => setExpanded(true)}
          >
            Klik untuk melihat chart
          </div>
        ) : (
          <motion.div
            animate={{ opacity: expanded ? 1 : 0, height: expanded ? 'auto' : 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </div>

      {/* Footer */}
      {footer && <div style={footerStyle}>{footer}</div>}

      {/* Collapsible toggle */}
      {collapsible && expanded && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 8,
            cursor: 'pointer',
            color: '#9CA3AF',
            fontSize: 11,
          }}
          onClick={() => setExpanded(false)}
        >
          ▼ Sembunyikan
        </div>
      )}
    </>
  );

  return (
    <motion.div
      className={`chart-card ${className}`}
      style={getCardStyle()}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={glassmorphism ? glassStyles.hover : {}}
      transition={{ duration: 0.3 }}
    >
      {cardContent}
    </motion.div>
  );
};

/**
 * ChartCardGrid - Grid layout for chart cards
 */
export const ChartCardGrid = ({
  children,
  columns = 2,
  gap = 12,
  className = '',
  style = {},
}) => {
  const [columnsPerRow, setColumnsPerRow] = React.useState(columns);

  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setColumnsPerRow(1);
      } else if (width < 1024) {
        setColumnsPerRow(2);
      } else {
        setColumnsPerRow(columns);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [columns]);

  return (
    <div
      className={`chart-card-grid ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columnsPerRow}, 1fr)`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * ChartSkeleton - Loading placeholder for charts
 */
export const ChartSkeleton = ({ height = 200 }) => (
  <div
    className="skeleton"
    style={{
      width: '100%',
      height,
      borderRadius: 8,
    }}
  />
);

/**
 * ChartCardSkeleton - Loading card with chart
 */
export const ChartCardSkeleton = ({ height = 200 }) => (
  <div
    style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
    }}
  >
    <div style={{ marginBottom: 16 }}>
      <div className="skeleton" style={{ width: '50%', height: 16, borderRadius: 4, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: '30%', height: 12, borderRadius: 4 }} />
    </div>
    <ChartSkeleton height={height} />
  </div>
);

/**
 * ChartGridSkeleton - Loading grid of chart cards
 */
export const ChartGridSkeleton = ({ count = 2, height = 200 }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <ChartCardSkeleton key={i} height={height} />
    ))}
  </div>
);

export default ChartCard;
