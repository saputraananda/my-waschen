// ─────────────────────────────────────────────────────────────────────────────
// Animated Counter — animasi number counting dengan easing
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';

/**
 * Animate a number from 0 to `value` when it mounts or value changes.
 * @param {number} value — target number
 * @param {number} duration — animation duration in ms (default 800)
 * @param {boolean} enabled — whether to animate (default true)
 * @param {function} formatter — optional formatter, e.g. (v) => 'Rp ' + v.toLocaleString('id-ID')
 */
export function useAnimatedNumber(value, duration = 800, enabled = true) {
  const [display, setDisplay] = useState(enabled ? 0 : value);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(enabled ? 0 : value);
  const toRef = useRef(value);

  useEffect(() => {
    if (!enabled) { setDisplay(value); return; }
    fromRef.current = display;
    toRef.current = value;
    startRef.current = null;

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (toRef.current - fromRef.current) * eased;
      setDisplay(Math.round(current));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(toRef.current);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled, duration]);

  return display;
}

/**
 * Animated counter display component
 */
export function AnimatedNumber({ value, duration = 800, enabled = true, prefix = '', suffix = '', className }) {
  const animated = useAnimatedNumber(value, duration, enabled);
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{typeof animated === 'number' ? animated.toLocaleString('id-ID') : animated}{suffix}
    </span>
  );
}

/**
 * Progress ring / arc component for dashboard KPIs
 */
export function ProgressRing({ progress = 0, size = 80, strokeWidth = 8, color = '#5B005F', bgColor = '#f0ecf2', children }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        />
      </svg>
      {children && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Pulse indicator dot — for live/active status
 */
export function PulseDot({ color = '#5B005F', size = 10, active = true }) {
  if (!active) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color,
        animation: 'pulse-ring 1.5s ease-out infinite',
      }} />
      <span style={{
        position: 'relative', width: size, height: size, borderRadius: '50%',
        background: color, display: 'block',
      }} />
    </span>
  );
}