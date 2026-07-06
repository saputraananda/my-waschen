// ─────────────────────────────────────────────────────────────────────────────
// PremiumAnimations.jsx — Shared Premium Animation Components
// Premium Claymorphism + Glassmorphism Design System v3.0 (July 2026)
//
// Reusable animation components for consistent premium styling
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING BUBBLE
// Soft floating soap bubble animation
// ═══════════════════════════════════════════════════════════════════════════════
export const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, style = {} }) => (
  <motion.div
    animate={{
      y: [0, -20, 0],
      scale: [1, 1.1, 1],
      opacity: [0.4, 0.7, 0.4],
    }}
    transition={{
      duration,
      repeat: Infinity,
      ease: 'easeInOut',
      delay,
    }}
    style={{
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width: size,
      height: size,
      ...style,
    }}
  >
    <img
      src={src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
      }}
      loading="lazy"
    />
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SPARKLE PARTICLE
// Twinkling star/sparkle effect
// ═══════════════════════════════════════════════════════════════════════════════
export const Sparkle = ({ top, left, right, bottom, size = 8, delay = 0, color = '#fff' }) => (
  <motion.div
    style={{
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width: size,
      height: size,
      background: color,
      borderRadius: '50%',
      boxShadow: `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}40`,
    }}
    animate={{
      scale: [0, 1, 0],
      opacity: [0, 1, 0],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 2,
      delay,
      repeat: Infinity,
      ease: 'easeOut',
    }}
  />
);

// ═══════════════════════════════════════════════════════════════════════════════
// SPARKLE SVG ICON
// Sparkle shape using SVG (for static use)
// ═══════════════════════════════════════════════════════════════════════════════
export const SparkleIcon = ({ size = 24, color = '#E85D04', style = {}, animate = false }) => {
  const Wrapper = animate ? motion.div : 'div';
  const wrapperProps = animate ? {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.8, 1, 0.8],
      rotate: [0, 15, 0],
    },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
  } : {};

  return (
    <Wrapper {...wrapperProps} style={{ width: size, height: size, ...style }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
          fill={color}
        />
        <path
          d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z"
          fill={color}
          opacity={0.6}
        />
        <path
          d="M5 14L5.5 15.5L7 16L5.5 16.5L5 18L4.5 16.5L3 16L4.5 15.5L5 14Z"
          fill={color}
          opacity={0.4}
        />
      </svg>
    </Wrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// GLOW ORB
// Ambient glowing orb for cinematic lighting
// ═══════════════════════════════════════════════════════════════════════════════
export const GlowOrb = ({
  color = 'rgba(140, 76, 143, 0.5)',
  size = 200,
  top,
  left,
  right,
  bottom,
  blur = 40,
  animate = true,
  intensity = 1
}) => (
  <motion.div
    animate={animate ? {
      scale: [1, 1.15, 1],
      opacity: [0.4 * intensity, 0.7 * intensity, 0.4 * intensity],
    } : {}}
    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    style={{
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      filter: `blur(${blur}px)`,
      pointerEvents: 'none',
    }}
  />
);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFETTI
// Floating confetti decoration
// ═══════════════════════════════════════════════════════════════════════════════
export const Confetti = ({ top, left, right, bottom, size = 32, rotation = 0, delay = 0 }) => (
  <motion.div
    animate={{
      y: [-10, 10, -10],
      rotate: [rotation, rotation + 15, rotation],
      opacity: [0.6, 0.9, 0.6],
    }}
    transition={{
      duration: 4,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
    style={{
      position: 'absolute',
      top,
      left,
      right,
      bottom,
    }}
  >
    <img
      src="/assets/Decorative icon/Confetti.webp"
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))',
      }}
      loading="lazy"
    />
  </motion.div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FLOATING ELEMENT
// Wrapper for floating animation on any child element
// ═══════════════════════════════════════════════════════════════════════════════
export const FloatingElement = ({
  children,
  yRange = [-12, 0],
  xRange,
  duration = 5,
  delay = 0,
  style = {}
}) => {
  const animate = {
    y: [...yRange, yRange[0]],
    ...(xRange && { x: [...xRange, xRange[0]] }),
  };

  return (
    <motion.div
      animate={animate}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
      style={style}
    >
      {children}
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM CARD
// Glassmorphism card with premium shadows
// ═══════════════════════════════════════════════════════════════════════════════
export const PremiumCard = ({
  children,
  maxWidth = 400,
  padding = '32px 28px',
  style = {},
  animate = true,
  delay = 0
}) => {
  const CardWrapper = animate ? motion.div : 'div';
  const cardProps = animate ? {
    initial: { opacity: 0, y: 30, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }
  } : {};

  return (
    <CardWrapper {...cardProps} style={{ width: '100', maxWidth, ...style }}>
      <div
        style={{
          width: '100%',
          padding,
          background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 28,
          border: '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: `
            0 20px 40px rgba(91, 0, 95, 0.1),
            0 8px 16px rgba(91, 0, 95, 0.06),
            inset 0 1px 1px rgba(255, 255, 255, 0.8),
            inset 0 -1px 1px rgba(91, 0, 95, 0.02)
          `,
        }}
      >
        {children}
      </div>
    </CardWrapper>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM BUTTON
// Primary button with gradient and glow
// ═══════════════════════════════════════════════════════════════════════════════
export const PremiumButton = ({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = 'primary', // primary, secondary, danger
  size = 'medium', // small, medium, large
  style = {},
  ...props
}) => {
  const variants = {
    primary: {
      background: disabled ? '#9CA3AF' : 'linear-gradient(135deg, #5B005F 0%, #8C4C8F 50%, #AD80AF 100%)',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(91, 0, 95, 0.3), 0 2px 6px rgba(91, 0, 95, 0.15)',
      color: '#fff',
    },
    secondary: {
      background: disabled ? '#E5E7EB' : 'linear-gradient(145deg, #F4EDF4, #E6D9E7)',
      boxShadow: disabled ? 'none' : '0 4px 12px rgba(91, 0, 95, 0.1)',
      color: disabled ? '#9CA3AF' : '#5B005F',
      border: '1px solid rgba(91, 0, 95, 0.15)',
    },
    danger: {
      background: disabled ? '#E5E7EB' : 'linear-gradient(135deg, #dc2626, #ef4444)',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(220, 38, 38, 0.3)',
      color: '#fff',
    },
    orange: {
      background: disabled ? '#9CA3AF' : 'linear-gradient(135deg, #F93E11, #FA6541)',
      boxShadow: disabled ? 'none' : '0 6px 16px rgba(249, 62, 17, 0.35)',
      color: '#fff',
    },
  };

  const sizes = {
    small: { height: 40, fontSize: 13, padding: '0 16px', borderRadius: 10 },
    medium: { height: 48, fontSize: 14, padding: '0 20px', borderRadius: 12 },
    large: { height: 54, fontSize: 15, padding: '0 24px', borderRadius: 14 },
  };

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: 'none',
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 700,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        backgroundSize: '200% 100%',
        transition: 'all 0.2s ease',
        ...sizes[size],
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 20,
            height: 20,
            border: '3px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
          }}
        />
      ) : children}
    </motion.button>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM INPUT
// Input field with glass effect and focus glow
// ═══════════════════════════════════════════════════════════════════════════════
export const PremiumInput = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  icon,
  rightIcon,
  style = {},
  ...props
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ marginBottom: 18, ...style }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: '#374151',
          marginBottom: 8,
          fontFamily: "'Poppins', sans-serif",
        }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#9ca3af',
          }}>
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            height: 50,
            padding: `0 ${rightIcon ? 48 : 16}px 0 ${icon ? 46 : 16}px`,
            fontSize: 14,
            fontFamily: "'Poppins', sans-serif",
            color: '#1a1a2e',
            background: focused ? '#fff' : 'linear-gradient(145deg, #F8F6FA, #F0EDF4)',
            border: `1.5px solid ${error ? '#dc2626' : focused ? '#5B005F' : 'rgba(91, 0, 95, 0.08)'}`,
            borderRadius: 12,
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: focused
              ? '0 0 0 4px rgba(91, 0, 95, 0.08), inset 0 2px 4px rgba(91, 0, 95, 0.02)'
              : 'inset 0 2px 4px rgba(91, 0, 95, 0.02), inset 0 -1px 2px rgba(255, 255, 255, 0.8)',
            transition: 'all 0.2s ease',
          }}
          {...props}
        />
        {rightIcon && (
          <div style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            color: '#6b7280',
          }}>
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p style={{
          fontSize: 11,
          color: '#dc2626',
          margin: '6px 0 0',
          fontWeight: 500,
        }}>
          {error}
        </p>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM BADGE
// Status badge with glow effect
// ═══════════════════════════════════════════════════════════════════════════════
export const PremiumBadge = ({
  children,
  variant = 'default', // default, success, warning, danger, purple
  size = 'medium',
  glow = false,
  style = {}
}) => {
  const variants = {
    default: { bg: 'rgba(91, 0, 95, 0.08)', color: '#5B005F' },
    success: { bg: 'rgba(5, 150, 105, 0.1)', color: '#059669' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', color: '#D97706' },
    danger: { bg: 'rgba(220, 38, 38, 0.1)', color: '#DC2626' },
    purple: { bg: 'rgba(91, 0, 95, 0.12)', color: '#5B005F' },
    orange: { bg: 'rgba(249, 62, 17, 0.1)', color: '#F93E11' },
  };

  const sizes = {
    small: { fontSize: 10, padding: '2px 8px', borderRadius: 6 },
    medium: { fontSize: 12, padding: '4px 10px', borderRadius: 8 },
    large: { fontSize: 13, padding: '6px 12px', borderRadius: 10 },
  };

  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 600,
        boxShadow: glow ? `0 0 12px ${variants[variant].color}40` : 'none',
        ...variants[variant],
        ...sizes[size],
        ...style,
      }}
    >
      {children}
    </motion.span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHIMMER SWEEP
// Light sweep animation for premium feel
// ═══════════════════════════════════════════════════════════════════════════════
export const ShimmerSweep = ({ duration = 6, delay = 0, width = '35%' }) => (
  <motion.div
    style={{
      position: 'absolute',
      top: 0,
      left: '-50%',
      width,
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
      transform: 'skewX(-15deg)',
      pointerEvents: 'none',
    }}
    animate={{
      left: ['-50%', '120%'],
    }}
    transition={{
      duration,
      repeat: Infinity,
      repeatDelay: 3,
      ease: 'easeInOut',
      delay,
    }}
  />
);

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM BACKGROUND
// Ready-to-use premium background with effects
// ═══════════════════════════════════════════════════════════════════════════════
export const PremiumBackground = ({
  variant = 'light', // light, dark, gradient
  withBubbles = false,
  withSparkles = false,
  withShimmer = false,
  children,
  style = {}
}) => {
  const backgrounds = {
    light: {
      background: `
        radial-gradient(ellipse at 20% 20%, rgba(244, 237, 244, 0.6) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 30%, rgba(230, 217, 231, 0.5) 0%, transparent 45%),
        linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 100%)
      `,
    },
    dark: {
      background: GRADIENTS?.hero || 'linear-gradient(160deg, #4D0051 0%, #5B005F 35%, #8C4C8F 100%)',
    },
    gradient: {
      background: `
        linear-gradient(180deg, #F4EDF4 0%, #FFFFFF 40%, #F4EDF4 100%)
      `,
    },
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...backgrounds[variant],
        ...style,
      }}
    >
      {/* Glow Orbs */}
      <GlowOrb color="rgba(91, 0, 95, 0.03)" size={300} top="-10%" right="-10%" blur={60} animate={false} />
      <GlowOrb color="rgba(91, 0, 95, 0.02)" size={250} bottom="-10%" left="-10%" blur={50} animate={false} />

      {/* Floating Bubbles */}
      {withBubbles && (
        <>
          <FloatingBubble src="/assets/Decorative icon/bubble-1.webp" size={24} top="10%" right="15%" delay={0} duration={6} />
          <FloatingBubble src="/assets/Decorative icon/bubble-2.webp" size={18} top="30%" left="10%" delay={0.5} duration={5} />
          <FloatingBubble src="/assets/Decorative icon/bubble-1.webp" size={20} bottom="20%" right="10%" delay={1} duration={6} />
        </>
      )}

      {/* Sparkles */}
      {withSparkles && (
        <>
          <Sparkle top="15%" left="20%" size={6} delay={0} />
          <Sparkle top="25%" left="75%" size={8} delay={0.5} />
          <Sparkle top="70%" left="40%" size={6} delay={1} />
        </>
      )}

      {/* Shimmer Effect */}
      {withShimmer && <ShimmerSweep />}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED GRADIENT TEXT
// Text with gradient color animation
// ═══════════════════════════════════════════════════════════════════════════════
export const AnimatedGradientText = ({
  children,
  size = 16,
  weight = 700,
  style = {}
}) => (
  <motion.span
    style={{
      background: 'linear-gradient(135deg, #5B005F, #8C4C8F, #AD80AF, #5B005F)',
      backgroundSize: '300% 100%',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      fontSize: size,
      fontWeight: weight,
      fontFamily: "'Poppins', sans-serif",
      ...style,
    }}
    animate={{
      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
    }}
    transition={{
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  >
    {children}
  </motion.span>
);

export default {
  FloatingBubble,
  Sparkle,
  SparkleIcon,
  GlowOrb,
  Confetti,
  FloatingElement,
  PremiumCard,
  PremiumButton,
  PremiumInput,
  PremiumBadge,
  ShimmerSweep,
  PremiumBackground,
  AnimatedGradientText,
};
