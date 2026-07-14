// ─────────────────────────────────────────────────────────────────────────────
// PageWrapper.jsx — Consistent Layout Container for All Pages
// Design System v3.0 (July 2026)
//
// Provides:
// - Consistent root container (flex column, overflow hidden)
// - Responsive padding
// - Bottom nav padding
// - Optional max-width for desktop
// - Header/footer slots
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { motion } from 'framer-motion';
import { C, SHADOW } from '../../utils/theme';
import { RADIUS } from '../../utils/designSystem';
import { useResponsive } from '../../utils/hooks';

// ─── Layout Tokens ────────────────────────────────────────────────────────────
export const LAYOUT = {
  // Container max-widths
  maxWidth: {
    compact: 400,   // Forms, notes
    standard: 640,   // Standard pages
    wide: 1024,      // Dashboard, reports
    full: '100%',    // Full width
  },

  // Page padding scale
  padding: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },

  // Bottom navigation padding
  bottomNav: {
    mobile: 120,
    desktop: 100,
  },

  // Gap scale
  gap: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
};

// ─── Spacing helpers ──────────────────────────────────────────────────────────
export function getPagePadding(isMobile) {
  return {
    padding: isMobile ? LAYOUT.padding.sm : LAYOUT.padding.md,
  };
}

export function getBottomNavPadding(isMobile) {
  return isMobile ? LAYOUT.bottomNav.mobile : LAYOUT.bottomNav.desktop;
}

// ─── PageWrapper Component ────────────────────────────────────────────────────
/**
 * PageWrapper - Consistent page layout container
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @param {React.ReactNode} props.header - Optional fixed header
 * @param {React.ReactNode} props.footer - Optional fixed footer
 * @param {'compact'|'standard'|'wide'|'full'} props.maxWidth - Container max-width
 * @param {boolean} props.withPadding - Add page padding (default: true)
 * @param {boolean} props.withBottomNav - Add bottom nav padding (default: true)
 * @param {string} props.background - Background color (default: C.n50)
 * @param {Object} props.style - Additional styles
 * @param {Object} props.contentStyle - Additional content styles
 * @param {boolean} props.animate - Enable entrance animation (default: false)
 */
export function PageWrapper({
  children,
  header,
  footer,
  maxWidth = 'standard',
  withPadding = true,
  withBottomNav = true,
  background = C.n50,
  style = {},
  contentStyle = {},
  animate = false,
  ...props
}) {
  const { isMobile } = useResponsive();
  const maxWidthValue = typeof LAYOUT.maxWidth[maxWidth] === 'number'
    ? `${LAYOUT.maxWidth[maxWidth]}px`
    : LAYOUT.maxWidth[maxWidth];

  const containerStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background,
    overflow: 'hidden',
    maxWidth: maxWidthValue !== '100%' ? maxWidthValue : undefined,
    margin: '0 auto',
    width: '100%',
    ...style,
  };

  const contentStyleFinal = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: withBottomNav ? getBottomNavPadding(isMobile) : 0,
    paddingLeft: withPadding ? (isMobile ? LAYOUT.padding.sm : LAYOUT.padding.md) : 0,
    paddingRight: withPadding ? (isMobile ? LAYOUT.padding.sm : LAYOUT.padding.md) : 0,
    paddingTop: withPadding ? (isMobile ? LAYOUT.padding.sm : LAYOUT.padding.md) : 0,
    ...contentStyle,
  };

  const content = (
    <>
      {header && (
        <div style={{ padding: isMobile ? LAYOUT.padding.sm : LAYOUT.padding.md }}>
          {header}
        </div>
      )}
      <div style={contentStyleFinal}>
        {children}
      </div>
      {footer && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: LAYOUT.padding.md,
          background: C.white,
          boxShadow: SHADOW.nav,
          zIndex: 100,
        }}>
          {footer}
        </div>
      )}
    </>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        style={containerStyle}
        {...props}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div style={containerStyle} {...props}>
      {content}
    </div>
  );
}

// ─── Card Components ─────────────────────────────────────────────────────────

/**
 * Standard Card - Consistent card styling
 */
export function Card({
  children,
  variant = 'default', // default, elevated, glass
  size = 'md', // sm, md, lg
  style = {},
  ...props
}) {
  const { isMobile } = useResponsive();

  const sizes = {
    sm: { padding: LAYOUT.padding.sm, borderRadius: RADIUS.md },
    md: { padding: isMobile ? LAYOUT.padding.sm : LAYOUT.padding.md, borderRadius: RADIUS.lg },
    lg: { padding: LAYOUT.padding.lg, borderRadius: RADIUS['2xl'] },
  };

  const variants = {
    default: {
      background: C.white,
      boxShadow: SHADOW.sm,
      border: `1px solid ${C.border}`,
    },
    elevated: {
      background: C.white,
      boxShadow: SHADOW.md,
      border: 'none',
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: `1px solid rgba(255, 255, 255, 0.7)`,
      borderRadius: RADIUS['3xl'],
    },
  };

  return (
    <div
      style={{
        ...sizes[size],
        ...variants[variant],
        marginBottom: LAYOUT.gap.md,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card Header
 */
export function CardHeader({ title, subtitle, action, style = {} }) {
  return (
    <div style={{ marginBottom: LAYOUT.gap.md, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: C.n900,
            margin: 0,
            marginBottom: subtitle ? 4 : 0,
          }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 12,
              color: C.n500,
              margin: 0,
            }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}

/**
 * Grid Layout Helper
 */
export function Grid({
  children,
  columns = 2,
  gap = 'md',
  style = {},
  ...props
}) {
  const { isMobile } = useResponsive();

  const gapValue = typeof gap === 'number' ? gap : LAYOUT.gap[gap] || LAYOUT.gap.md;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : `repeat(${columns}, 1fr)`,
        gap: gapValue,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Stack Layout (flex column)
 */
export function Stack({
  children,
  gap = 'md',
  style = {},
  ...props
}) {
  const gapValue = typeof gap === 'number' ? gap : LAYOUT.gap[gap] || LAYOUT.gap.md;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: gapValue,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Row Layout (flex row)
 */
export function Row({
  children,
  gap = 'md',
  align = 'center',
  justify = 'space-between',
  style = {},
  ...props
}) {
  const gapValue = typeof gap === 'number' ? gap : LAYOUT.gap[gap] || LAYOUT.gap.md;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: align,
        justifyContent: justify,
        gap: gapValue,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Spacer Component ─────────────────────────────────────────────────────────
export function Spacer({ size = 'md', style = {} }) {
  const sizeValue = typeof size === 'number' ? size : LAYOUT.gap[size] || LAYOUT.gap.md;
  return <div style={{ height: sizeValue, ...style }} />;
}

// ─── Divider Component ─────────────────────────────────────────────────────────
export function Divider({ style = {} }) {
  return (
    <div
      style={{
        height: 1,
        background: C.border,
        marginVertical: LAYOUT.gap.md,
        ...style,
      }}
    />
  );
}

// ─── Export all ───────────────────────────────────────────────────────────────
export default PageWrapper;
// Note: Divider is exported from ui/index.jsx (already defined there)
