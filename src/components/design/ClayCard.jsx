// ─────────────────────────────────────────────────────────────────────────────
// ClayCard.jsx — Animated Card Component with Claymorphism
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { SHADOWS, GRADIENTS, RADIUS, TIMING } from '../../utils/designSystem';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  hover: { y: -4, scale: 1.01 },
  tap: { scale: 0.99 },
};

/**
 * ClayCard — Premium card with claymorphism styling and animations
 *
 * @param {string} variant - 'sm' | 'md' | 'lg'
 * @param {boolean} hoverable - Enable hover animations
 * @param {boolean} animated - Enable entrance animations
 * @param {number} delay - Animation delay in seconds
 * @param {string} gradient - Use gradient background
 */
export function ClayCard({
  children,
  variant = 'md',
  hoverable = true,
  animated = true,
  delay = 0,
  gradient = true,
  onClick,
  className,
  style,
  ...props
}) {
  const shadowMap = {
    sm: SHADOWS.clay.sm,
    md: SHADOWS.clay.md,
    lg: SHADOWS.clay.lg,
  };

  const radiusMap = {
    sm: RADIUS.lg,
    md: RADIUS['2xl'],
    lg: RADIUS['3xl'],
  };

  const hoverShadowMap = {
    sm: SHADOWS.clay.md,
    md: SHADOWS.clay.lg,
    lg: SHADOWS.clay.xl,
  };

  return (
    <motion.div
      className={className}
      initial={animated ? 'initial' : false}
      animate="animate"
      whileHover={hoverable ? 'hover' : undefined}
      whileTap={hoverable ? 'tap' : undefined}
      variants={animated ? {
        initial: cardVariants.initial,
        animate: { ...cardVariants.animate, transition: { delay, duration: 0.4 } },
        hover: cardVariants.hover,
        tap: cardVariants.tap,
      } : undefined}
      onClick={onClick}
      style={{
        background: gradient ? GRADIENTS.card : '#FFFFFF',
        borderRadius: radiusMap[variant],
        boxShadow: shadowMap[variant],
        padding: variant === 'sm' ? '12px 14px' : variant === 'lg' ? '24px 28px' : '18px 20px',
        border: '1px solid rgba(124, 58, 237, 0.06)',
        transition: `box-shadow ${TIMING.normal}, transform ${TIMING.fast}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * ClayCardHeader — Card header section
 */
export function ClayCardHeader({ title, subtitle, action, icon }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && (
          <div style={{
            width: 40,
            height: 40,
            borderRadius: RADIUS.lg,
            background: GRADIENTS.purpleSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            boxShadow: SHADOWS.inset.sm,
          }}>
            {icon}
          </div>
        )}
        <div>
          <div style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            color: '#1F2937',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 11,
              color: '#6B7280',
              marginTop: 2,
            }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/**
 * ClayCardFooter — Card footer section
 */
export function ClayCardFooter({ children, actions }) {
  return (
    <div style={{
      marginTop: 16,
      paddingTop: 16,
      borderTop: '1px solid rgba(124, 58, 237, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: actions ? 'space-between' : 'flex-start',
      gap: 12,
    }}>
      {children}
      {actions && (
        <div style={{ display: 'flex', gap: 8 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

export default ClayCard;
