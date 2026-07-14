/**
 * GlassButton Component
 * Premium button with glassmorphism effect
 *
 * @description
 * A reusable button component with glassmorphism styling,
 * multiple variants, and smooth interactions.
 *
 * @example
 * // Basic usage
 * <GlassButton>Click Me</GlassButton>
 *
 * // With icon
 * <GlassButton icon={<SaveIcon />}>Simpan</GlassButton>
 *
 * // Loading state
 * <GlassButton loading>Saving...</GlassButton>
 */

import { motion } from 'framer-motion';

/**
 * GlassButton Component
 */
const GlassButton = ({
  // Content
  children,
  icon = null,
  iconPosition = 'left',

  // Variant
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'glass'
  size = 'md', // 'sm' | 'md' | 'lg'
  glassVariant = false, // Use glassmorphism styling

  // State
  loading = false,
  disabled = false,

  // Interaction
  onClick,
  type = 'button',

  // Styling
  className = '',
  style = {},
  fullWidth = false,
}) => {
  // Size configurations
  const sizeConfig = {
    sm: {
      height: 36,
      padding: '0 14px',
      fontSize: 12,
      iconSize: 14,
      gap: 6,
    },
    md: {
      height: 42,
      padding: '0 18px',
      fontSize: 13,
      iconSize: 16,
      gap: 8,
    },
    lg: {
      height: 48,
      padding: '0 24px',
      fontSize: 14,
      iconSize: 18,
      gap: 10,
    },
  };

  // Variant configurations - Standard
  const standardVariants = {
    primary: {
      background: 'linear-gradient(135deg, #8B5CF6, #6e2e78)',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: '0 4px 12px rgba(110, 46, 120, 0.35)',
    },
    secondary: {
      background: '#FFFFFF',
      color: '#6e2e78',
      border: '1.5px solid #6e2e78',
      boxShadow: '0 2px 8px rgba(110, 46, 120, 0.1)',
    },
    ghost: {
      background: 'transparent',
      color: '#6e2e78',
      border: 'none',
      boxShadow: 'none',
    },
    danger: {
      background: '#EF4444',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.35)',
    },
    success: {
      background: '#10B981',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
    },
    warning: {
      background: '#F59E0B',
      color: '#FFFFFF',
      border: 'none',
      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
    },
  };

  // Glass variant configurations
  const glassVariants = {
    primary: {
      background: 'rgba(110, 46, 120, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#FFFFFF',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 4px 15px rgba(110, 46, 120, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#6e2e78',
      border: '1px solid rgba(110, 46, 120, 0.3)',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
    },
    ghost: {
      background: 'rgba(255, 255, 255, 0.5)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#6e2e78',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#FFFFFF',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    success: {
      background: 'rgba(16, 185, 129, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#FFFFFF',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      color: '#FFFFFF',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: '#374151',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
    },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;
  const currentVariant = (glassVariant ? glassVariants : standardVariants)[variant] || standardVariants.primary;

  const isDisabled = disabled || loading;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: currentSize.gap,
    height: currentSize.height,
    padding: currentSize.padding,
    fontFamily: 'Poppins, sans-serif',
    fontSize: currentSize.fontSize,
    fontWeight: 600,
    borderRadius: 10,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled ? 0.6 : 1,
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    width: fullWidth ? '100%' : 'auto',
    ...currentVariant,
  };

  const buttonContent = (
    <>
      {loading && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: currentSize.iconSize,
            height: currentSize.iconSize,
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: 'currentColor',
            borderRadius: '50%',
          }}
        />
      )}
      {!loading && icon && iconPosition === 'left' && (
        <span style={{ fontSize: currentSize.iconSize, display: 'flex' }}>
          {icon}
        </span>
      )}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && (
        <span style={{ fontSize: currentSize.iconSize, display: 'flex' }}>
          {icon}
        </span>
      )}
    </>
  );

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={baseStyle}
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      className={className}
    >
      {buttonContent}
    </motion.button>
  );
};

/**
 * GlassButtonGroup - Group of buttons
 */
export const GlassButtonGroup = ({
  children,
  gap = 8,
  align = 'left',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        gap,
        justifyContent: align,
        flexWrap: 'wrap',
      }}
    >
      {children}
    </div>
  );
};

/**
 * GlassIconButton - Icon-only button with glassmorphism
 */
export const GlassIconButton = ({
  icon,
  onClick,
  size = 40,
  variant = 'ghost', // 'primary' | 'secondary' | 'ghost' | 'glass'
  color = '#6e2e78',
  glassVariant = true,
  disabled = false,
}) => {
  const glassVariants = {
    primary: {
      background: 'rgba(110, 46, 120, 0.85)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      color: '#FFFFFF',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.7)',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      color: color,
    },
    ghost: {
      background: 'rgba(0, 0, 0, 0.04)',
      border: '1px solid transparent',
      color: color,
    },
    glass: {
      background: 'rgba(255, 255, 255, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.5)',
      color: color,
    },
  };

  const currentVariant = glassVariant ? glassVariants[variant] || glassVariants.glass : {
    background: 'transparent',
    border: '1px solid #E5E7EB',
    color: color,
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        border: currentVariant.border,
        background: currentVariant.background,
        backdropFilter: glassVariant ? 'blur(8px)' : undefined,
        WebkitBackdropFilter: glassVariant ? 'blur(8px)' : undefined,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: currentVariant.color,
        transition: 'all 0.15s ease',
        ...(glassVariant ? {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        } : {}),
      }}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      {icon}
    </motion.button>
  );
};

export default GlassButton;
