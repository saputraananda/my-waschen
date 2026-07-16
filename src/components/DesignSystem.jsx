/**
 * Waschen Design System - Shared Components
 * Version: 3.0 (July 2026)
 *
 * Import patterns:
 * import { ClayCard, ClayIcon, ClayAvatar, ClayBtn, ClayInput, StatusBadge, ListItemRow, LoadingState, EmptyState, GlassCard } from '../../components/DesignSystem';
 */

import { motion, AnimatePresence } from 'framer-motion';
import { C } from '../../utils/theme';

// ═══════════════════════════════════════════════════════════════════════════
// BASE STYLES
// ═══════════════════════════════════════════════════════════════════════════

const FONTS = {
  primary: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
};

export const GRADIENTS = {
  brand: 'linear-gradient(155deg, #3B0B47 0%, #5C1A6B 55%, #4A1259 100%)',
  header: `
    radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
    radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
    linear-gradient(155deg, #3B0B47 0%, #5C1A6B 55%, #4A1259 100%)
  `,
  btnPrimary: 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
  btnSuccess: 'linear-gradient(145deg, #5FD9AE 0%, #1F9E75 100%)',
  btnDanger: 'linear-gradient(145deg, #E11D48, #a32d2d)',
  btnSecondary: 'linear-gradient(145deg, #F5E9FB, #E9D3F2)',
};

export const SHADOWS = {
  clay: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  claySm: '4px 4px 10px rgba(110, 46, 120, 0.08), -2px -2px 6px rgba(255, 255, 255, 0.95)',
  glass: '0 20px 40px -12px rgba(59, 11, 71, 0.22), 0 4px 12px rgba(59, 11, 71, 0.08)',
  btn: '-4px -4px 10px rgba(255, 255, 255, 0.4), 5px 6px 14px rgba(59, 11, 71, 0.35)',
  btnSuccess: '-4px -4px 10px rgba(255, 255, 255, 0.6), 5px 6px 14px rgba(31, 158, 117, 0.4)',
};

export const STATUS_COLORS = {
  lunas: { bg: '#059669', color: 'white' },
  paid: { bg: '#059669', color: 'white' },
  proses: { bg: '#5B005F', color: 'white' },
  done: { bg: '#059669', color: 'white' },
  partial: { bg: '#D97706', color: 'white' },
  dp: { bg: '#D97706', color: 'white' },
  lunas_sebagian: { bg: '#D97706', color: 'white' },
  unpaid: { bg: '#6B7280', color: 'white' },
  batal: { bg: '#E11D48', color: 'white' },
  cancelled: { bg: '#E11D48', color: 'white' },
  pending: { bg: '#6B7280', color: 'white' },
  express: { bg: '#F93E11', color: 'white' },
};

// ═══════════════════════════════════════════════════════════════════════════
// GLASS STYLES (CSS Injection)
// ═══════════════════════════════════════════════════════════════════════════

export const GLASS_CSS = `
  :root {
    --glass-bg: #F3EEF7;
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
  }

  .glass-card {
    background: var(--glass-strong);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    box-shadow:
      0 20px 40px -12px rgba(59, 11, 71, 0.22),
      0 4px 12px rgba(59, 11, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .clay-avatar {
    border-radius: 18px;
    background: linear-gradient(145deg, #FFFFFF, #E9D3F2);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.7),
      5px 6px 14px rgba(59, 11, 71, 0.25),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .page-header {
    background:
      radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
      radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
      linear-gradient(155deg, #3B0B47 0%, #5C1A6B 55%, #4A1259 100%);
    position: relative;
    overflow: hidden;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(18px);
  }

  .blob-1 {
    width: 180px; height: 180px;
    background: radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%);
    top: -60px; right: -40px;
    animation: floatB 11s ease-in-out infinite;
  }

  .blob-2 {
    width: 150px; height: 150px;
    background: radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%);
    bottom: 20px; left: -50px;
    animation: floatC 16s ease-in-out infinite;
  }

  .blob-3 {
    width: 90px; height: 90px;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    top: 40px; left: 55%;
    animation: floatA 9s ease-in-out infinite;
  }

  @keyframes floatA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-14px, 16px) scale(1.08); } }
  @keyframes floatB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(18px, -12px) scale(1.1); } }
  @keyframes floatC { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(16px, 10px) scale(0.95); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  @media (prefers-reduced-motion: reduce) {
    .blob-1, .blob-2, .blob-3 { animation: none; }
  }
`;

/** Hook to inject glass styles once per page */
export function useGlassStyles(styleId = 'glass-global-styles') {
  if (typeof window === 'undefined') return;
  useEffect(() => {
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = GLASS_CSS;
    document.head.appendChild(style);
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, [styleId]);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GlassCard - Card dengan backdrop blur
 */
export function GlassCard({ children, style, onClick, padding = 16, ...props }) {
  return (
    <motion.div
      whileHover={onClick ? { y: -2 } : {}}
      whileTap={onClick ? { scale: 0.99 } : {}}
      onClick={onClick}
      style={{
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        border: '1px solid rgba(255, 255, 255, 0.7)',
        borderRadius: 24,
        padding,
        boxShadow: SHADOWS.glass,
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * ClayCard - Card dengan soft clay elevation
 */
export function ClayCard({ children, style, onClick, padding = 16, ...props }) {
  return (
    <motion.div
      whileHover={onClick ? { y: -3, scale: 1.01 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      onClick={onClick}
      style={{
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 18,
        padding,
        boxShadow: SHADOWS.clay,
        border: `1px solid rgba(139, 92, 246, 0.08)`,
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * ClayIcon - Icon box dengan clay style
 */
export function ClayIcon({ icon, color = C.primary, size = 40, style }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(145deg, ${color}20, ${color}08)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        boxShadow: `3px 3px 8px ${color}15, -1px -1px 4px rgba(255, 255, 255, 0.9)`,
        ...style,
      }}
    >
      {icon}
    </div>
  );
}

/**
 * ClayAvatar - Avatar dengan clay style + gender-based defaults
 */
export function ClayAvatar({ initials, src, size = 50, gradient, style }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        background: gradient || 'linear-gradient(145deg, #FFFFFF, #E9D3F2)',
        boxShadow: `
          -4px -4px 10px rgba(255, 255, 255, 0.7),
          5px 6px 14px rgba(59, 11, 71, 0.25),
          inset 0 1px 1px rgba(255, 255, 255, 0.5)
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.primary,
        fontSize: size * 0.35,
        fontWeight: 700,
        color: C.primary,
        overflow: 'hidden',
        ...style,
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : initials}
    </div>
  );
}

/**
 * ClayBtn - Primary Button
 */
export function ClayBtn({ children, onClick, loading, disabled, variant = 'primary', size = 48, fullWidth, style, ...props }) {
  const variants = {
    primary: {
      bg: disabled ? C.n300 : GRADIENTS.btnPrimary,
      shadow: disabled ? 'none' : SHADOWS.btn,
    },
    success: {
      bg: disabled ? C.n300 : GRADIENTS.btnSuccess,
      shadow: disabled ? 'none' : SHADOWS.btnSuccess,
    },
    danger: {
      bg: disabled ? C.n300 : GRADIENTS.btnDanger,
      shadow: disabled ? 'none' : SHADOWS.btn,
    },
    secondary: {
      bg: GRADIENTS.btnSecondary,
      shadow: '-4px -4px 10px rgba(255, 255, 255, 0.6), 5px 6px 14px rgba(59, 11, 71, 0.2)',
      border: `1.5px solid ${C.n200}`,
    },
  };

  const v = variants[variant] || variants.primary;

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={disabled ? {} : { scale: 1.02, y: -1 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
      style={{
        width: fullWidth ? '100%' : 'auto',
        height: size,
        padding: `0 24px`,
        borderRadius: 14,
        border: v.border || 'none',
        background: v.bg,
        color: variant === 'secondary' ? C.primary : 'white',
        fontFamily: FONTS.primary,
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: v.shadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...style,
      }}
      {...props}
    >
      {loading ? 'Memuat...' : children}
    </motion.button>
  );
}

/**
 * ClayInput - Input field dengan clay style
 */
export function ClayInput({ label, value, onChange, placeholder, type = 'text', style, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <div style={{
          fontFamily: FONTS.primary,
          fontSize: 11,
          fontWeight: 600,
          color: C.n600,
        }}>
          {label}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          borderRadius: 12,
          border: `1.5px solid ${C.n200}`,
          background: C.white,
          fontFamily: FONTS.primary,
          fontSize: 13,
          color: C.n900,
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 0.2s',
          ...style,
        }}
        {...props}
      />
    </div>
  );
}

/**
 * StatusBadge - Badge untuk status
 */
export function StatusBadge({ label, status, style }) {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.pending;

  return (
    <div style={{
      padding: '4px 12px',
      borderRadius: 8,
      background: cfg.bg,
      color: cfg.color,
      fontFamily: FONTS.primary,
      fontSize: 10,
      fontWeight: 600,
      ...style,
    }}>
      {label || status}
    </div>
  );
}

/**
 * ListItemRow - Row item untuk list dengan animasi
 */
export function ListItemRow({ title, subtitle, right, onClick, index = 0, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      whileHover={onClick ? { x: 4, backgroundColor: C.primaryTint } : {}}
      whileTap={onClick ? { scale: 0.99 } : {}}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 14,
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: SHADOWS.claySm,
        border: '1px solid rgba(139, 92, 246, 0.06)',
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: FONTS.primary,
          fontSize: 13,
          fontWeight: 600,
          color: C.n900,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontFamily: FONTS.primary,
            fontSize: 11,
            color: C.n500,
            marginTop: 2,
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </motion.div>
  );
}

/**
 * LoadingState - Spinner loading
 */
export function LoadingState({ message = 'Memuat...', size = 32, style }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      gap: 12,
      ...style,
    }}>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `3px solid ${C.n200}`,
        borderTopColor: C.primary,
        animation: 'spin 1s linear infinite',
      }} />
      <div style={{
        fontFamily: FONTS.primary,
        fontSize: 12,
        color: C.n500,
      }}>
        {message}
      </div>
    </div>
  );
}

/**
 * EmptyState - Empty state dengan icon
 */
export function EmptyState({ icon = '📋', message = 'Belum ada data', action, style }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
      gap: 12,
      ...style,
    }}>
      <div style={{ fontSize: 48 }}>{icon}</div>
      <div style={{
        fontFamily: FONTS.primary,
        fontSize: 14,
        color: C.n500,
        textAlign: 'center',
      }}>
        {message}
      </div>
      {action && (
        <ClayBtn onClick={action.onClick} variant="secondary" style={{ marginTop: 8 }}>
          {action.label}
        </ClayBtn>
      )}
    </div>
  );
}

/**
 * SkeletonBlock - Loading skeleton
 */
export function SkeletonBlock({ height = 40, width = '100%', style }) {
  return (
    <div style={{
      height,
      width,
      borderRadius: 10,
      background: `linear-gradient(90deg, ${C.n100} 0%, ${C.n200} 50%, ${C.n100} 100%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style,
    }} />
  );
}

/**
 * SkeletonList - List of skeleton blocks
 */
export function SkeletonList({ count = 5, height = 60, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBlock key={i} height={height} />
      ))}
    </div>
  );
}

/**
 * Chip - Small tag/label
 */
export function Chip({ label, color = C.primary, variant = 'filled', style }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 999,
      background: variant === 'filled' ? `${color}15` : 'transparent',
      border: `1px solid ${color}30`,
      fontFamily: FONTS.primary,
      fontSize: 10,
      fontWeight: 600,
      color: color,
      ...style,
    }}>
      {label}
    </div>
  );
}

/**
 * Divider - Horizontal divider
 */
export function Divider({ label, style }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '16px 0',
      ...style,
    }}>
      <div style={{ flex: 1, height: 1, background: C.n200 }} />
      {label && (
        <div style={{
          fontFamily: FONTS.primary,
          fontSize: 10,
          fontWeight: 600,
          color: C.n400,
          textTransform: 'uppercase',
        }}>
          {label}
        </div>
      )}
      <div style={{ flex: 1, height: 1, background: C.n200 }} />
    </div>
  );
}

/**
 * FormSection - Grouped form section with glass card
 */
export function FormSection({ title, children, style }) {
  return (
    <div
      className="glass-card"
      style={{ padding: 16, marginBottom: 12, ...style }}
    >
      {title && (
        <div style={{
          fontFamily: FONTS.primary,
          fontSize: 12,
          fontWeight: 700,
          color: C.n700,
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * StatsCard - Dashboard stat card
 */
export function StatsCard({ icon, label, value, subValue, color = C.primary, trend, trendValue, delay = 0, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      style={{
        background: `linear-gradient(145deg, ${C.white}, ${C.primaryTint})`,
        borderRadius: 18,
        padding: 14,
        boxShadow: SHADOWS.clay,
        border: `1px solid rgba(139, 92, 246, 0.08)`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 80,
        ...style,
      }}
    >
      <ClayIcon icon={icon} color={color} size={40} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: FONTS.primary,
          fontSize: 9,
          fontWeight: 600,
          color: C.n500,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: FONTS.primary,
          fontSize: 18,
          fontWeight: 800,
          color: C.n900,
          lineHeight: 1.2,
        }}>
          {value}
        </div>
        {subValue && (
          <div style={{
            fontFamily: FONTS.primary,
            fontSize: 10,
            color: C.n500,
            marginTop: 2,
          }}>
            {subValue}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * PageHeader - Header dengan blob animasi
 */
export function PageHeader({ title, subtitle, right, style }) {
  return (
    <div className="page-header" style={{ ...style }}>
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />
      <div style={{
        position: 'relative',
        zIndex: 1,
        padding: '20px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: FONTS.primary,
            fontSize: 18,
            fontWeight: 700,
            color: 'white',
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontFamily: FONTS.primary,
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)',
              marginTop: 4,
            }}>
              {subtitle}
            </div>
          )}
        </div>
        {right}
      </div>
    </div>
  );
}

/**
 * ConfirmDialog - Confirmation modal
 */
export function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Ya', cancelLabel = 'Batal', danger = false }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 20,
              padding: 24,
              maxWidth: 320,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{
              fontFamily: FONTS.primary,
              fontSize: 16,
              fontWeight: 700,
              color: C.n900,
              marginBottom: 8,
            }}>
              {title}
            </div>
            <div style={{
              fontFamily: FONTS.primary,
              fontSize: 13,
              color: C.n600,
              marginBottom: 20,
            }}>
              {message}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <ClayBtn onClick={onCancel} variant="secondary" fullWidth>
                {cancelLabel}
              </ClayBtn>
              <ClayBtn
                onClick={onConfirm}
                variant={danger ? 'danger' : 'success'}
                fullWidth
              >
                {confirmLabel}
              </ClayBtn>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * ProgressBar - Animated progress bar
 */
export function ProgressBar({ value, max, color = C.primary, showLabel = true, height = 8, style }) {
  if (max == null || max <= 0) return null;
  const percent = Math.min((value / max) * 100, 100);

  return (
    <div style={{ width: '100%', ...style }}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: FONTS.primary, fontSize: 10, color: C.n500 }}>
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)}
          </span>
          <span style={{ fontFamily: FONTS.primary, fontSize: 10, fontWeight: 600, color }}>
            {percent.toFixed(0)}%
          </span>
        </div>
      )}
      <div style={{
        height,
        borderRadius: 999,
        background: `${color}15`,
        overflow: 'hidden',
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Tabs - Tab navigation
 */
export function Tabs({ tabs, activeTab, onChange, style }) {
  return (
    <div style={{
      display: 'flex',
      background: 'linear-gradient(145deg, #F4EDF4, #E6D9E7)',
      borderRadius: 10,
      padding: 2,
      gap: 2,
      ...style,
    }}>
      {tabs.map((tab) => (
        <motion.button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          whileTap={{ scale: 0.95 }}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === tab.value
              ? GRADIENTS.btnPrimary
              : 'transparent',
            color: activeTab === tab.value ? 'white' : C.n600,
            fontFamily: FONTS.primary,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {tab.label}
        </motion.button>
      ))}
    </div>
  );
}

/**
 * SearchBar - Search input
 */
export function SearchBar({ value, onChange, placeholder = 'Cari...', style }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 14px',
      height: 44,
      background: C.white,
      borderRadius: 12,
      border: `1.5px solid ${C.n200}`,
      ...style,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          fontFamily: FONTS.primary,
          fontSize: 13,
          color: C.n900,
          outline: 'none',
        }}
      />
      {value && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onChange({ target: { value: '' } })}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </motion.button>
      )}
    </div>
  );
}
