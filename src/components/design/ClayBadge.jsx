// ─────────────────────────────────────────────────────────────────────────────
// ClayBadge.jsx — Animated Badge Component
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { SHADOWS, GRADIENTS, RADIUS } from '../../utils/designSystem';

/**
 * ClayBadge — Premium badge with animations
 *
 * @param {string} variant - 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'purple' | 'orange'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} animated - Enable animations
 * @param {boolean} pulse - Show pulse animation
 * @param {node} icon - Icon to show (React node, e.g., <IconCheck /> or SVG element)
 */
export function ClayBadge({
  children,
  variant = 'primary',
  size = 'md',
  animated = true,
  pulse = false,
  icon,
  style,
  className,
  ...props
}) {
  const sizeStyles = {
    sm: { fontSize: 10, padding: '2px 8px', gap: 4 },
    md: { fontSize: 11, padding: '4px 12px', gap: 6 },
    lg: { fontSize: 12, padding: '6px 16px', gap: 8 },
  };

  const variantStyles = {
    primary: {
      background: GRADIENTS.primary,
      color: '#FFFFFF',
    },
    secondary: {
      background: GRADIENTS.purpleSoft,
      color: '#7C3AED',
    },
    success: {
      background: GRADIENTS.successSoft,
      color: '#059669',
    },
    warning: {
      background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
      color: '#D97706',
    },
    danger: {
      background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)',
      color: '#DC2626',
    },
    purple: {
      background: 'linear-gradient(135deg, #F3E8FF 0%, #E9D5FF 100%)',
      color: '#7C3AED',
    },
    orange: {
      background: GRADIENTS.orangeSoft,
      color: '#E85D00',
    },
    outline: {
      background: 'transparent',
      color: '#3C0A63',
      border: '1px solid rgba(124, 58, 237, 0.3)',
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.2)',
      backdropFilter: 'blur(10px)',
      color: '#3C0A63',
      border: '1px solid rgba(255, 255, 255, 0.3)',
    },
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  const content = (
    <>
      {icon && <span style={{ display: 'flex', alignItems: 'center', fontSize: 'inherit' }}>{icon}</span>}
      {children && <span>{children}</span>}
    </>
  );

  if (animated) {
    return (
      <motion.span
        className={className}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        style={{
          ...badgeStyle,
          position: 'relative',
        }}
        {...props}
      >
        {pulse && (
          <motion.span
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 'inherit',
              background: 'inherit',
            }}
          />
        )}
        {content}
      </motion.span>
    );
  }

  return (
    <span className={className} style={badgeStyle} {...props}>
      {content}
    </span>
  );
}

/**
 * ClayStatusBadge — Status indicator badge
 */
export function ClayStatusBadge({ status, size = 'md' }) {
  const statusConfig = {
    // Transaction statuses
    baru: { variant: 'primary', label: 'Baru', Icon: 'IconSparkle' },
    diproses: { variant: 'warning', label: 'Proses', Icon: 'IconProcess' },
    selesai: { variant: 'success', label: 'Selesai', Icon: 'IconDone' },
    siap_diambil: { variant: 'primary', label: 'Siap', Icon: 'IconReady' },
    selesai_diambil: { variant: 'secondary', label: 'Diambil', Icon: 'IconPickedUp' },
    dibatalkan: { variant: 'danger', label: 'Batal', Icon: 'IconCancelled' },
    pending: { variant: 'warning', label: 'Menunggu', Icon: 'IconClock' },
    picked: { variant: 'primary', label: 'Dijemput', Icon: 'IconPickedUp' },
    delivered: { variant: 'primary', label: 'Diantar', Icon: 'IconDelivered' },
    completed: { variant: 'success', label: 'Selesai', Icon: 'IconDone' },
    // Payment statuses
    lunas: { variant: 'success', label: 'Lunas', Icon: 'IconPaid' },
    belum_lunas: { variant: 'danger', label: 'Belum Lunas', Icon: 'IconUnpaid' },
    // Membership statuses
    aktif: { variant: 'success', label: 'Aktif', Icon: 'IconStar' },
    non_aktif: { variant: 'secondary', label: 'Non Aktif', Icon: 'IconInactive' },
    expired: { variant: 'danger', label: 'Expired', Icon: 'IconExpired' },
    // Default
    default: { variant: 'secondary', label: status, Icon: 'IconList' },
  };

  // Dynamic icon import helper
  const getIconElement = (iconName) => {
    if (!iconName) return null;
    const iconMap = {
      IconSparkle: <svg width="12" height="12" viewBox="0 0 24 24" fill="#7C3AED"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>,
      IconProcess: <svg width="12" height="12" viewBox="0 0 24 24" fill="#D97706"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>,
      IconDone: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01L9 11.01"/></svg>,
      IconReady: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6e2e78" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01L20.73 6.96"/><path d="M12 22.08V12"/></svg>,
      IconPickedUp: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
      IconDelivered: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6e2e78" strokeWidth="2"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M5 12l3 3 5-6" stroke="#10B981"/></svg>,
      IconCancelled: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9L9 15M9 9l6 6"/></svg>,
      IconClock: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
      IconPaid: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>,
      IconUnpaid: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
      IconStar: <svg width="12" height="12" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>,
      IconInactive: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>,
      IconExpired: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
      IconList: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6e2e78" strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
    };
    return iconMap[iconName] || null;
  };

  const config = statusConfig[status] || statusConfig.default;

  return (
    <ClayBadge variant={config.variant} size={size} icon={getIconElement(config.Icon)}>
      {config.label}
    </ClayBadge>
  );
}

/**
 * ClayCountBadge — Notification count badge
 */
export function ClayCountBadge({ count, max = 99, size = 'sm' }) {
  if (!count || count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      style={{
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        background: '#EF4444',
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'Poppins, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4px',
        boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
        border: '2px solid #FFFFFF',
      }}
    >
      {displayCount}
    </motion.div>
  );
}

export default ClayBadge;
