// ─────────────────────────────────────────────────────────────────────────────
// ClayStatCard.jsx — Animated Statistics Card Component
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { SHADOWS, GRADIENTS, RADIUS, TIMING } from '../../utils/designSystem';
import { useCountUp } from '../../utils/useAnimation';

/**
 * ClayStatCard — Premium statistics card with counting animation
 *
 * @param {string} label - Stat label
 * @param {number|string} value - Stat value (number will be animated)
 * @param {string} icon - Icon emoji or element
 * @param {string} trend - Trend indicator ('up' | 'down' | 'neutral')
 * @param {string} trendValue - Trend percentage
 * @param {string} color - Accent color
 * @param {boolean} animated - Enable value counting animation
 * @param {string} format - Value format ('number' | 'currency' | 'percent')
 */
export function ClayStatCard({
  label,
  value,
  icon = '📊',
  trend,
  trendValue,
  color = '#7C3AED',
  animated = true,
  format = 'number',
  delay = 0,
  onClick,
  className,
  style,
}) {
  const numericValue = typeof value === 'number' ? value : 0;
  const { value: displayValue } = useCountUp(numericValue, 1500, true);

  const formatValue = (val) => {
    if (format === 'currency') {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(val);
    }
    if (format === 'percent') {
      return `${val}%`;
    }
    return new Intl.NumberFormat('id-ID').format(val);
  };

  const trendColors = {
    up: { color: '#059669', bg: '#D1FAE5' },
    down: { color: '#DC2626', bg: '#FEE2E2' },
    neutral: { color: '#6B7280', bg: '#F3F4F6' },
  };

  const trendStyle = trend ? trendColors[trend] : null;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, type: 'spring', stiffness: 300 }}
      whileHover={onClick ? { y: -4, scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      onClick={onClick}
      style={{
        background: GRADIENTS.card,
        borderRadius: RADIUS['2xl'],
        padding: '18px 16px',
        boxShadow: SHADOWS.clay.md,
        border: '1px solid rgba(124, 58, 237, 0.06)',
        cursor: onClick ? 'pointer' : 'default',
        transition: `box-shadow ${TIMING.normal}, transform ${TIMING.fast}`,
        ...style,
      }}
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: delay + 0.1, type: 'spring', stiffness: 400 }}
        style={{
          width: 48,
          height: 48,
          borderRadius: RADIUS.lg,
          background: `linear-gradient(135deg, ${color}15, ${color}08)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          marginBottom: 12,
          boxShadow: `4px 4px 10px ${color}10, -2px -2px 6px rgba(255, 255, 255, 0.9)`,
        }}
      >
        {icon}
      </motion.div>

      {/* Value */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.2 }}
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 24,
          fontWeight: 700,
          color: '#1F2937',
          lineHeight: 1.2,
          letterSpacing: '-0.5px',
        }}
      >
        {animated && typeof value === 'number'
          ? formatValue(displayValue)
          : formatValue(numericValue)}
      </motion.div>

      {/* Label */}
      <div style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
      }}>
        {label}
      </div>

      {/* Trend */}
      {trend && trendValue && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.3 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 10,
            padding: '4px 10px',
            borderRadius: RADIUS.pill,
            background: trendStyle?.bg,
            fontSize: 11,
            fontWeight: 600,
            color: trendStyle?.color,
          }}
        >
          <span>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
          {trendValue}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * ClayStatRow — Row of stat cards (3-column or 4-column)
 */
export function ClayStatRow({ stats, columns = 3, gap = 12 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap,
    }}>
      {stats.map((stat, index) => (
        <ClayStatCard
          key={stat.label}
          {...stat}
          delay={index * 0.1}
        />
      ))}
    </div>
  );
}

export default ClayStatCard;
