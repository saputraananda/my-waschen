// ─────────────────────────────────────────────────────────────────────────────
// AnimatedListCard — Wrapper untuk animasi list items dengan framer-motion
// Gunakan ini untuk membungkus list items agar mendapat animasi staggered
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

// Single animated item wrapper
export const AnimatedCard = ({
  children,
  delay = 0,
  index,
  onClick,
  style = {},
  isMobile = false,
}) => {
  const ref = useRef(null);
  // triggerOnce: true ensures each item animates only once when first entering view
  const isInView = useInView(ref, { amount: 0.2, triggerOnce: true });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.4,
        delay: delay * 0.06, // Stagger delay per item
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={!isMobile ? { scale: 1.005 } : {}}
      whileTap={{ scale: 0.99 }}
      style={{
        marginBottom: 12,
        width: '100%',
        boxSizing: 'border-box',
        willChange: 'transform, opacity', // GPU acceleration hint
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
};

// Staggered list container - wrap array of items with animation
export const StaggeredList = ({
  items = [],
  renderItem,
  delayStart = 0,
  isMobile = false,
  className = '',
}) => {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <AnimatedCard
          key={item.id || index}
          delay={delayStart + index}
          index={index}
          isMobile={isMobile}
        >
          {renderItem(item, index)}
        </AnimatedCard>
      ))}
    </div>
  );
};

// Simple fade-in animation for container
export const FadeIn = ({
  children,
  delay = 0,
  direction = 'up', // 'up', 'down', 'left', 'right', 'scale'
  duration = 0.4,
  isMobile = false,
  style = {},
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.2, triggerOnce: true });

  const getInitialState = () => {
    switch (direction) {
      case 'up': return { opacity: 0, y: isMobile ? 20 : 30 };
      case 'down': return { opacity: 0, y: isMobile ? -20 : -30 };
      case 'left': return { opacity: 0, x: isMobile ? 20 : 30 };
      case 'right': return { opacity: 0, x: isMobile ? -20 : -30 };
      case 'scale': return { opacity: 0, scale: 0.9 };
      default: return { opacity: 0, y: 20 };
    }
  };

  const getAnimateState = () => {
    return { opacity: 1, x: 0, y: 0, scale: 1 };
  };

  return (
    <motion.div
      ref={ref}
      initial={getInitialState()}
      animate={isInView ? getAnimateState() : getInitialState()}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      style={style}
    >
      {children}
    </motion.div>
  );
};

export default AnimatedCard;
