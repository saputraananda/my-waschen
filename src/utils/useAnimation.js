// ─────────────────────────────────────────────────────────────────────────────
// useAnimation.js — Custom hooks for animations
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════════
// Animation Variants
// ═══════════════════════════════════════════════════════════════════════════════

export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeDownVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeLeftVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export const fadeRightVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
};

export const scaleVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

export const scaleBounceVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 15 } },
};

export const slideUpVariants = {
  hidden: { y: '100%' },
  visible: { y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
};

export const slideDownVariants = {
  hidden: { y: '-100%' },
  visible: { y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
};

// Stagger container variants
export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

// Stagger item variants
export const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

// Card hover variants
export const cardHoverVariants = {
  initial: { y: 0, scale: 1 },
  hover: { y: -4, scale: 1.02 },
  tap: { scale: 0.98 },
};

// Button variants
export const buttonTapVariants = {
  initial: { scale: 1 },
  tap: { scale: 0.97 },
  hover: { scale: 1.02 },
};

// List item variants
export const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, type: 'spring', stiffness: 300, damping: 24 },
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

// Modal variants
export const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 },
  },
  exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } },
};

// Overlay variants
export const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Custom Hooks
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * useStaggerAnimation — Animate children with stagger effect
 */
export function useStaggerAnimation(itemCount = 10, baseDelay = 0.1) {
  return {
    container: staggerContainerVariants,
    item: {
      ...staggerItemVariants,
      visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
          delay: baseDelay + i * 0.05,
          type: 'spring',
          stiffness: 300,
          damping: 24,
        },
      }),
    },
  };
}

/**
 * useCountUp — Animate number counting
 */
export function useCountUp(endValue, duration = 2000, startOnMount = true) {
  const [value, setValue] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const startTimeRef = useRef(null);
  const animationRef = useRef(null);

  const startAnimation = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * endValue));

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [endValue, duration, hasStarted]);

  useEffect(() => {
    if (startOnMount) {
      startAnimation();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [startAnimation, startOnMount]);

  return { value, startAnimation };
}

/**
 * useInViewAnimation — Trigger animation when element comes into view
 */
export function useInViewAnimation(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView, variants: inView ? fadeUpVariants : fadeVariants };
}

/**
 * useHoverAnimation — Add hover/tap animations to element
 */
export function useHoverAnimation(initial = { scale: 1 }, hover = { scale: 1.05 }) {
  const controls = useAnimation();

  const handleHoverStart = () => controls.start(hover);
  const handleHoverEnd = () => controls.start(initial);

  return { controls, handleHoverStart, handleHoverEnd };
}

/**
 * useTypingAnimation — Animate text typing effect
 */
export function useTypingAnimation(text, speed = 50, startOnMount = true) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const start = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);
  }, [hasStarted]);

  useEffect(() => {
    if (!startOnMount && !hasStarted) return;

    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [text, currentIndex, speed, startOnMount, hasStarted]);

  return { displayText, isComplete: currentIndex >= text.length, start };
}

/**
 * usePulseAnimation — Pulsing animation hook
 */
export function usePulseAnimation(isActive = true, interval = 2000) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setPulse((p) => !p);
    }, interval);

    return () => clearInterval(timer);
  }, [isActive, interval]);

  return pulse;
}

/**
 * useFloatingAnimation — Floating animation values
 */
export function useFloatingAnimation(speed = 3000) {
  const controls = useAnimation();

  const startFloating = useCallback(async () => {
    await controls.start({
      y: [0, -10, 0],
      transition: {
        duration: speed / 1000,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    });
  }, [controls]);

  useEffect(() => {
    startFloating();
  }, [startFloating]);

  return controls;
}

/**
 * useGlitchEffect — Glitch text effect (for special elements)
 */
export function useGlitchEffect(trigger = false) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    if (trigger) {
      setGlitching(true);
      const timeout = setTimeout(() => setGlitching(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [trigger]);

  return glitching;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Animated Components (wrappers)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AnimateOnView — Wrapper that animates children when in view
 */
export function AnimateOnView({ children, variants = fadeUpVariants, className }) {
  const { ref, inView } = useInViewAnimation();

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * AnimatedList — List with staggered animation
 */
export function AnimatedList({ children, className }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={listItemVariants}
            >
              {child}
            </motion.div>
          ))
        : children
      }
    </motion.div>
  );
}

/**
 * AnimatedCounter — Number with counting animation
 */
export function AnimatedCounter({ value, prefix = '', suffix = '', className }) {
  const { value: displayValue } = useCountUp(value);

  return (
    <span className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}

/**
 * SkeletonLoader — Animated skeleton loading
 */
export function SkeletonLoader({ width = '100%', height = 20, borderRadius = 8, className }) {
  return (
    <motion.div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
      }}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

export default {
  // Variants
  fadeVariants,
  fadeUpVariants,
  fadeDownVariants,
  fadeLeftVariants,
  fadeRightVariants,
  scaleVariants,
  scaleBounceVariants,
  slideUpVariants,
  slideDownVariants,
  staggerContainerVariants,
  staggerItemVariants,
  cardHoverVariants,
  buttonTapVariants,
  listItemVariants,
  modalVariants,
  overlayVariants,

  // Hooks
  useStaggerAnimation,
  useCountUp,
  useInViewAnimation,
  useHoverAnimation,
  useTypingAnimation,
  usePulseAnimation,
  useFloatingAnimation,
  useGlitchEffect,

  // Components
  AnimateOnView,
  AnimatedList,
  AnimatedCounter,
  SkeletonLoader,
};
