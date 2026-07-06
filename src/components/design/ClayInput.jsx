// ─────────────────────────────────────────────────────────────────────────────
// ClayInput.jsx — Animated Input Component with Glassmorphism
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHADOWS, GRADIENTS, RADIUS, TIMING } from '../../utils/designSystem';

/**
 * ClayInput — Premium input with glassmorphism styling
 *
 * @param {string} label - Input label
 * @param {string} error - Error message
 * @param {string} success - Success message
 * @param {string} helper - Helper text
 * @param {boolean} icon - Show icon
 * @param {boolean} clearable - Show clear button
 * @param {boolean} animated - Enable animations
 */
export function ClayInput({
  label,
  placeholder,
  value,
  onChange,
  error,
  success,
  helper,
  icon,
  clearable = true,
  animated = true,
  type = 'text',
  disabled = false,
  required = false,
  maxLength,
  onClear,
  onFocus,
  onBlur,
  className,
  style,
  inputStyle,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(!!value);

  const handleFocus = (e) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const handleChange = (e) => {
    setHasValue(!!e.target.value);
    onChange?.(e);
  };

  const handleClear = () => {
    setHasValue(false);
    onClear?.();
  };

  const getBorderColor = () => {
    if (error) return 'rgba(220, 38, 38, 0.5)';
    if (success) return 'rgba(5, 150, 105, 0.5)';
    if (isFocused) return 'rgba(124, 58, 237, 0.5)';
    return 'rgba(124, 58, 237, 0.15)';
  };

  const inputVariants = animated ? {
    focused: { scale: 1.01 },
    unfocused: { scale: 1 },
  } : {};

  return (
    <div className={className} style={{ width: '100%', ...style }}>
      {/* Label */}
      {label && (
        <motion.label
          initial={animated ? { opacity: 0, y: -5 } : false}
          animate={animated ? { opacity: 1, y: 0 } : false}
          style={{
            display: 'block',
            fontFamily: 'Poppins, sans-serif',
            fontSize: 12,
            fontWeight: 600,
            color: error ? '#DC2626' : '#374151',
            marginBottom: 6,
          }}
        >
          {label}
          {required && <span style={{ color: '#DC2626', marginLeft: 2 }}>*</span>}
        </motion.label>
      )}

      {/* Input Container */}
      <motion.div
        animate={animated ? (isFocused ? 'focused' : 'unfocused') : false}
        variants={inputVariants}
        style={{
          position: 'relative',
          transition: `all ${TIMING.fast}`,
        }}
      >
        {/* Icon */}
        {icon && (
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: isFocused ? '#7C3AED' : '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1,
            transition: `color ${TIMING.fast}`,
          }}>
            {icon}
          </div>
        )}

        {/* Input */}
        <input
          type={type}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          style={{
            width: '100%',
            height: 48,
            padding: icon ? '0 44px 0 44px' : '0 14px',
            fontSize: 14,
            fontFamily: 'Poppins, sans-serif',
            color: disabled ? '#9CA3AF' : '#1F2937',
            background: disabled
              ? 'rgba(243, 244, 246, 1)'
              : isFocused
                ? '#FFFFFF'
                : GRADIENTS.input,
            border: `1.5px solid ${getBorderColor()}`,
            borderRadius: RADIUS.lg,
            outline: 'none',
            boxSizing: 'border-box',
            transition: `all ${TIMING.fast}`,
            boxShadow: isFocused
              ? `0 0 0 3px rgba(124, 58, 237, 0.1), ${SHADOWS.inset.md}`
              : SHADOWS.inset.sm,
            ...inputStyle,
          }}
          {...props}
        />

        {/* Clear Button */}
        <AnimatePresence>
          {clearable && hasValue && !disabled && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              type="button"
              onClick={handleClear}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(156, 163, 175, 0.2)',
                border: 'none',
                borderRadius: RADIUS.sm,
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B7280',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Focus indicator */}
        {isFocused && !error && !success && (
          <motion.div
            layoutId="focusIndicator"
            style={{
              position: 'absolute',
              bottom: -1,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#7C3AED',
            }}
          />
        )}
      </motion.div>

      {/* Helper/Error Text */}
      <AnimatePresence mode="wait">
        {(error || success || helper) && (
          <motion.div
            key={error || success || helper}
            initial={{ opacity: 0, y: -5, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -5, height: 0 }}
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 11,
              marginTop: 4,
              color: error ? '#DC2626' : success ? '#059669' : '#6B7280',
            }}
          >
            {error || success || helper}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * ClayTextarea — Multi-line input
 */
export function ClayTextarea({
  label,
  placeholder,
  value,
  onChange,
  error,
  helper,
  rows = 4,
  disabled = false,
  animated = true,
  style,
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ width: '100%', ...style }}>
      {label && (
        <label style={{
          display: 'block',
          fontFamily: 'Poppins, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: error ? '#DC2626' : '#374151',
          marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontSize: 14,
          fontFamily: 'Poppins, sans-serif',
          color: disabled ? '#9CA3AF' : '#1F2937',
          background: isFocused ? '#FFFFFF' : GRADIENTS.input,
          border: `1.5px solid ${error ? 'rgba(220, 38, 38, 0.5)' : isFocused ? 'rgba(124, 58, 237, 0.5)' : 'rgba(124, 58, 237, 0.15)'}`,
          borderRadius: RADIUS.lg,
          outline: 'none',
          boxSizing: 'border-box',
          resize: 'vertical',
          minHeight: rows * 24,
          transition: `all ${TIMING.fast}`,
          boxShadow: isFocused
            ? `0 0 0 3px rgba(124, 58, 237, 0.1), ${SHADOWS.inset.md}`
            : SHADOWS.inset.sm,
        }}
        {...props}
      />
      {(error || helper) && (
        <div style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 11,
          marginTop: 4,
          color: error ? '#DC2626' : '#6B7280',
        }}>
          {error || helper}
        </div>
      )}
    </div>
  );
}

export default ClayInput;
