// ─────────────────────────────────────────────────────────────────────────────
// GlassPanel.jsx — Glassmorphism Panel Component
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { SHADOWS, RADIUS } from '../../utils/designSystem';

/**
 * GlassPanel — Glassmorphism panel with backdrop blur
 *
 * @param {string} intensity - 'light' | 'medium' | 'heavy'
 * @param {string} variant - 'light' | 'dark'
 */
export function GlassPanel({
  children,
  intensity = 'medium',
  variant = 'light',
  animated = true,
  delay = 0,
  style,
  className,
  ...props
}) {
  const configs = {
    light: {
      light: {
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
      },
      medium: {
        background: 'rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
      },
      heavy: {
        background: 'rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.35)',
      },
    },
    dark: {
      light: {
        background: 'rgba(60, 10, 99, 0.15)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      },
      medium: {
        background: 'rgba(60, 10, 99, 0.2)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
      },
      heavy: {
        background: 'rgba(60, 10, 99, 0.25)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
      },
    },
  };

  const glassStyle = configs[variant][intensity];

  if (animated) {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4 }}
        style={{
          borderRadius: RADIUS['2xl'],
          boxShadow: SHADOWS.elevated.sm,
          ...glassStyle,
          ...style,
        }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={className} style={{ borderRadius: RADIUS['2xl'], ...glassStyle, ...style }} {...props}>
      {children}
    </div>
  );
}

/**
 * GlassCard — Glass panel styled as a card
 */
export function GlassCard({
  children,
  intensity = 'medium',
  variant = 'light',
  animated = true,
  delay = 0,
  style,
  className,
  ...props
}) {
  return (
    <GlassPanel
      intensity={intensity}
      variant={variant}
      animated={animated}
      delay={delay}
      className={className}
      style={{
        padding: '18px 20px',
        ...style,
      }}
      {...props}
    >
      {children}
    </GlassPanel>
  );
}

/**
 * GlassNavBar — Glassmorphism navigation bar
 */
export function GlassNavBar({
  children,
  position = 'fixed',
  top,
  bottom,
  left,
  right,
  animated = true,
  style,
  className,
  ...props
}) {
  return (
    <GlassPanel
      intensity="medium"
      variant="dark"
      animated={animated}
      className={className}
      style={{
        position,
        [top !== undefined ? 'top' : 'bottom']: top !== undefined ? top : bottom,
        left: 0,
        right: 0,
        borderRadius: 0,
        border: 'none',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '8px 16px',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
        zIndex: 100,
        ...style,
      }}
      {...props}
    >
      {children}
    </GlassPanel>
  );
}

export default GlassPanel;
