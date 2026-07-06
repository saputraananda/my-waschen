// ─────────────────────────────────────────────────────────────────────────────
// ClayButton.jsx — Animated Button Component with Claymorphism
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { SHADOWS, GRADIENTS, RADIUS, TIMING } from '../../utils/designSystem';

const buttonVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.02, y: -2 },
  tap: { scale: 0.97 },
};

/**
 * ClayButton — Premium button with claymorphism styling and animations
 *
 * @param {string} variant - 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} animated - Enable animations
 * @param {boolean} loading - Show loading state
 * @param {boolean} disabled - Disable button
 * @param {boolean} fullWidth - Full width button
 * @param {ReactNode} icon - Icon to show
 * @param {string} iconPosition - 'left' | 'right'
 */
export function ClayButton({
  children,
  variant = 'primary',
  size = 'md',
  animated = true,
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  className,
  style,
  ...props
}) {
  const sizeStyles = {
    sm: { height: 36, fontSize: 12, padding: '0 14px', gap: 6 },
    md: { height: 44, fontSize: 13, padding: '0 20px', gap: 8 },
    lg: { height: 52, fontSize: 15, padding: '0 28px', gap: 10 },
  };

  const variantStyles = {
    primary: {
      background: disabled
        ? 'linear-gradient(145deg, #9CA3AF 0%, #6B7280 100%)'
        : GRADIENTS.primary,
      color: '#FFFFFF',
      boxShadow: disabled ? 'none' : SHADOWS.button.primary,
      border: 'none',
    },
    secondary: {
      background: '#FFFFFF',
      color: '#3C0A63',
      boxShadow: SHADOWS.button.secondary,
      border: '1.5px solid rgba(124, 58, 237, 0.2)',
    },
    ghost: {
      background: 'transparent',
      color: '#3C0A63',
      boxShadow: 'none',
      border: 'none',
    },
    danger: {
      background: disabled
        ? 'linear-gradient(145deg, #9CA3AF 0%, #6B7280 100%)'
        : GRADIENTS.danger || 'linear-gradient(145deg, #DC2626 0%, #EF4444 100%)',
      color: '#FFFFFF',
      boxShadow: disabled ? 'none' : SHADOWS.button.danger,
      border: 'none',
    },
    success: {
      background: disabled
        ? 'linear-gradient(145deg, #9CA3AF 0%, #6B7280 100%)'
        : GRADIENTS.success,
      color: '#FFFFFF',
      boxShadow: disabled ? 'none' : SHADOWS.button.primary,
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: '#3C0A63',
      boxShadow: 'none',
      border: '1.5px solid #3C0A63',
    },
    accent: {
      background: disabled
        ? 'linear-gradient(145deg, #9CA3AF 0%, #6B7280 100%)'
        : GRADIENTS.orange,
      color: '#FFFFFF',
      boxShadow: disabled ? 'none' : SHADOWS.button.primary,
      border: 'none',
    },
  };

  const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.xl,
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
    transition: `all ${TIMING.fast}`,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  const content = (
    <>
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 16,
            height: 16,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
          }}
        />
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && icon && iconPosition === 'right' && (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      )}
    </>
  );

  if (animated && !disabled && !loading) {
    return (
      <motion.button
        type={type}
        className={className}
        style={buttonStyle}
        variants={buttonVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        onClick={onClick}
        {...props}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <button
      type={type}
      className={className}
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {content}
    </button>
  );
}

/**
 * ClayIconButton — Icon only button
 */
export function ClayIconButton({
  icon,
  size = 44,
  variant = 'primary',
  animated = true,
  disabled = false,
  onClick,
  type = 'button',
  className,
  style,
  ...props
}) {
  const sizeStyle = { width: size, height: size };

  const variantStyles = {
    primary: {
      background: GRADIENTS.primary,
      color: '#FFFFFF',
      boxShadow: SHADOWS.button.primary,
    },
    secondary: {
      background: '#FFFFFF',
      color: '#3C0A63',
      boxShadow: SHADOWS.button.secondary,
      border: '1.5px solid rgba(124, 58, 237, 0.2)',
    },
    ghost: {
      background: 'transparent',
      color: '#3C0A63',
      boxShadow: 'none',
    },
  };

  const buttonStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.xl,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: `all ${TIMING.fast}`,
    ...sizeStyle,
    ...variantStyles[variant],
    ...style,
  };

  if (animated && !disabled) {
    return (
      <motion.button
        type={type}
        className={className}
        style={buttonStyle}
        variants={buttonVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        onClick={onClick}
        {...props}
      >
        {icon}
      </motion.button>
    );
  }

  return (
    <button
      type={type}
      className={className}
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}

/**
 * ClayFloatingButton — FAB (Floating Action Button)
 */
export function ClayFloatingButton({
  icon,
  label,
  onClick,
  position = 'bottom-right',
  size = 56,
  variant = 'primary',
  className,
  style,
  ...props
}) {
  const positions = {
    'bottom-right': { bottom: 24, right: 24 },
    'bottom-left': { bottom: 24, left: 24 },
    'bottom-center': { bottom: 24, left: '50%', transform: 'translateX(-50%)' },
  };

  const variantStyles = {
    primary: {
      background: GRADIENTS.primary,
      color: '#FFFFFF',
      boxShadow: '0 8px 32px rgba(60, 10, 99, 0.35)',
    },
    accent: {
      background: GRADIENTS.orange,
      color: '#FFFFFF',
      boxShadow: '0 8px 32px rgba(232, 93, 0, 0.35)',
    },
  };

  return (
    <motion.button
      className={className}
      type="button"
      onClick={onClick}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        position: 'fixed',
        zIndex: 50,
        width: size,
        height: size,
        borderRadius: size / 2,
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ...positions[position],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {icon}
    </motion.button>
  );
}

export default ClayButton;
