// ─────────────────────────────────────────────────────────────────────────────
// PremiumPageBackground.jsx — Reusable Premium Page Decoration
// Premium Claymorphism + Glassmorphism Design System v3.0 (July 2026)
//
// Adds premium decorative elements to any page:
// - Floating bubbles
// - Sparkle particles
// - Ambient glow orbs
// - Shimmer effects
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';

// ─── Asset Imports ─────────────────────────────────────────────────────────────
import bubbleIcon from '../assets/Decorative icon/bubble-1.webp'
import bubble2Icon from '../assets/Decorative icon/bubble-2.webp'
import soapBubble from '../assets/Decorative icon/soap-bubble.webp'
import sparkleIcon from '../assets/Decorative icon/sparkle.webp'

// ─── Floating Bubble Component ─────────────────────────────────────────────────
export const FloatingBubble = ({ src, size, top, left, right, bottom, delay = 0, duration = 5, opacity = 0.5 }) => (
  <motion.div
    animate={{
      y: [0, -20, 0],
      scale: [1, 1.1, 1],
      opacity: [opacity * 0.6, opacity, opacity * 0.6],
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
      pointerEvents: 'none',
      zIndex: 0,
    }}
  >
    <img
      src={src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
      }}
      loading="lazy"
    />
  </motion.div>
);

// ─── Sparkle Particle Component ───────────────────────────────────────────────
export const Sparkle = ({ top, left, right, bottom, size = 8, delay = 0, color = '#E85D04' }) => (
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
      boxShadow: `0 0 ${size}px ${color}, 0 0 ${size * 2}px ${color}50`,
      pointerEvents: 'none',
      zIndex: 0,
    }}
    animate={{
      scale: [0, 1, 0],
      opacity: [0, 1, 0],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 2.5,
      delay,
      repeat: Infinity,
      ease: 'easeOut',
    }}
  />
);

// ─── Sparkle SVG Component ───────────────────────────────────────────────────
export const SparkleIcon = ({ top, left, right, bottom, size = 24, delay = 0, color = '#E85D04', animate = true }) => {
  const Wrapper = animate ? motion.div : 'div';
  const wrapperProps = animate ? {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [0.7, 1, 0.7],
      rotate: [0, 10, 0],
    },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut', delay }
  } : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        position: 'absolute',
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
          fill={color}
        />
      </svg>
    </Wrapper>
  );
};

// ─── Glow Orb Component ───────────────────────────────────────────────────────
export const GlowOrb = ({
  color = 'rgba(91, 0, 95, 0.05)',
  size = 200,
  top,
  left,
  right,
  bottom,
  blur = 40,
  animate = true,
}) => (
  <motion.div
    animate={animate ? {
      scale: [1, 1.1, 1],
      opacity: [0.5, 0.8, 0.5],
    } : {}}
    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
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
      zIndex: 0,
    }}
  />
);

// ─── Floating Element Wrapper ─────────────────────────────────────────────────
export const FloatingElement = ({ children, yRange = [-10, 5], duration = 5, delay = 0, style = {} }) => (
  <motion.div
    animate={{ y: [...yRange, yRange[0]] }}
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

// ─── Shimmer Sweep Effect ────────────────────────────────────────────────────
export const ShimmerSweep = ({ duration = 8, delay = 0, width = '30%', position = 'top' }) => (
  <motion.div
    style={{
      position: 'absolute',
      [position]: 0,
      left: '-50%',
      width,
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
      transform: 'skewX(-15deg)',
      pointerEvents: 'none',
      zIndex: 1,
    }}
    animate={{
      left: ['-50%', '120%'],
    }}
    transition={{
      duration,
      repeat: Infinity,
      repeatDelay: 4,
      ease: 'easeInOut',
      delay,
    }}
  />
);

// ─── Main Premium Page Background Component ───────────────────────────────────
export const PremiumPageBackground = ({
  variant = 'light', // light, dark, subtle
  intensity = 'medium', // light, medium, heavy
  bubbles = true,
  sparkles = false,
  glow = true,
  shimmer = false,
  showStaff = false,
  staffImage,
  style = {},
  children,
}) => {
  // Bubble configuration based on intensity
  const bubbleConfig = {
    light: { count: 3, maxSize: 20 },
    medium: { count: 5, maxSize: 28 },
    heavy: { count: 8, maxSize: 36 },
  };

  // Sparkle configuration based on intensity
  const sparkleConfig = {
    light: { count: 2, maxSize: 6 },
    medium: { count: 4, maxSize: 8 },
    heavy: { count: 6, maxSize: 10 },
  };

  const bubbles_data = bubbles ? Array.from({ length: bubbleConfig[intensity].count }, (_, i) => ({
    src: [bubbleIcon, bubble2Icon, soapBubble][i % 3],
    size: 16 + Math.random() * bubbleConfig[intensity].maxSize,
    positions: [
      { top: '10%', left: '8%' },
      { top: '25%', right: '12%' },
      { top: '45%', left: '5%' },
      { top: '60%', right: '8%' },
      { top: '75%', left: '10%' },
      { top: '15%', right: '20%' },
      { top: '40%', left: '15%' },
      { top: '80%', right: '15%' },
    ][i],
    delay: i * 0.3,
    duration: 5 + Math.random() * 2,
    opacity: 0.3 + Math.random() * 0.3,
  })) : [];

  const sparkles_data = sparkles ? Array.from({ length: sparkleConfig[intensity].count }, (_, i) => ({
    size: 4 + Math.random() * sparkleConfig[intensity].maxSize,
    positions: [
      { top: '12%', left: '20%' },
      { top: '30%', left: '70%' },
      { top: '50%', left: '35%' },
      { top: '70%', left: '60%' },
      { top: '25%', left: '50%' },
      { top: '60%', left: '15%' },
    ][i],
    delay: i * 0.5,
  })) : [];

  // Background styles
  const backgrounds = {
    light: {
      background: `
        radial-gradient(ellipse at 15% 15%, rgba(244, 237, 244, 0.8) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 25%, rgba(230, 217, 231, 0.6) 0%, transparent 45%),
        radial-gradient(ellipse at 50% 80%, rgba(255, 235, 240, 0.4) 0%, transparent 40%),
        linear-gradient(180deg, #FFFFFF 0%, #FAFAFA 50%, #FFFFFF 100%)
      `,
    },
    dark: {
      background: `
        radial-gradient(ellipse at 20% 20%, rgba(140, 76, 143, 0.15) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 30%, rgba(91, 0, 95, 0.1) 0%, transparent 45%),
        linear-gradient(180deg, #F4EDF4 0%, #FFFFFF 100%)
      `,
    },
    subtle: {
      background: `
        radial-gradient(ellipse at 10% 10%, rgba(244, 237, 244, 0.5) 0%, transparent 40%),
        linear-gradient(180deg, #FFFFFF 0%, #F8F6FA 100%)
      `,
    },
  };

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100%',
        ...backgrounds[variant],
        ...style,
      }}
    >
      {/* Ambient Glow Orbs */}
      {glow && (
        <>
          <GlowOrb color="rgba(91, 0, 95, 0.03)" size={300} top="-10%" left="-10%" blur={60} animate={false} />
          <GlowOrb color="rgba(91, 0, 95, 0.02)" size={250} bottom="-5%" right="-5%" blur={50} animate={false} />
          <GlowOrb color="rgba(140, 76, 143, 0.02)" size={200} top="40%" right="10%" blur={40} animate={false} />
        </>
      )}

      {/* Floating Bubbles */}
      {bubbles_data.map((bubble, i) => (
        <FloatingBubble
          key={`bubble-${i}`}
          src={bubble.src}
          size={bubble.size}
          top={bubble.positions.top}
          left={bubble.positions.left}
          right={bubble.positions.right}
          delay={bubble.delay}
          duration={bubble.duration}
          opacity={bubble.opacity}
        />
      ))}

      {/* Sparkle Particles */}
      {sparkles_data.map((sparkle, i) => (
        <Sparkle
          key={`sparkle-${i}`}
          top={sparkle.positions.top}
          left={sparkle.positions.left}
          size={sparkle.size}
          delay={sparkle.delay}
        />
      ))}

      {/* Shimmer Sweep Effect */}
      {shimmer && <ShimmerSweep />}

      {/* Staff Character (optional) */}
      {showStaff && staffImage && (
        <motion.div
          animate={{ y: [-5, 5, -5] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            bottom: '5%',
            right: '5%',
            width: 120,
            height: 180,
            zIndex: 2,
            filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))',
          }}
        >
          <img
            src={staffImage}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
            loading="lazy"
          />
        </motion.div>
      )}

      {/* Content Layer */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        {children}
      </div>
    </div>
  );
};

export default PremiumPageBackground;
