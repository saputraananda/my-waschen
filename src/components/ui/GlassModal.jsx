/**
 * GlassModal Component
 * Premium modal/dialog with glassmorphism effect
 *
 * @description
 * A reusable modal component with frosted glass appearance,
 * smooth animations, and consistent styling.
 *
 * @example
 * // Basic usage
 * <GlassModal
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Konfirmasi"
 * >
 *   <p>Apakah Anda yakin?</p>
 * </GlassModal>
 *
 * // With footer actions
 * <GlassModal
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Hapus Item"
 *   footer={
 *     <>
 *       <Button onClick={() => setIsOpen(false)}>Batal</Button>
 *       <Button variant="primary" onClick={handleDelete}>Hapus</Button>
 *     </>
 *   }
 * >
 *   <p>Item ini akan dihapus permanen.</p>
 * </GlassModal>
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollLock } from '../../utils/useScrollLock';

/**
 * GlassModal Component
 */
const GlassModal = ({
  // Visibility
  visible = false,
  onClose,

  // Header
  title = '',
  subtitle = '',
  showCloseButton = true,

  // Content
  children,

  // Footer
  footer = null,

  // Size
  size = 'md', // 'sm' | 'md' | 'lg' | 'full'

  // Position
  position = 'center', // 'center' | 'bottom' | 'top'

  // Styling
  color = '#5B005F',

  // Animation
  enableAnimation = true,

  // ClassName
  className = '',
  style = {},

  // Scroll container ref for scroll lock
  scrollContainerRef = null,
}) => {
  const contentRef = useRef(null);

  // Scroll lock - works with specific container or document.body
  useScrollLock(visible, scrollContainerRef);

  // Handle escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && visible) {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  // Size configurations
  const sizeConfig = {
    sm: { maxWidth: 360 },
    md: { maxWidth: 480 },
    lg: { maxWidth: 640 },
    full: { maxWidth: '100%', width: '100%', height: '100%', maxHeight: '100vh' },
  };

  // Position configurations
  const positionConfig = {
    center: {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      borderRadius: 20,
    },
    bottom: {
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: '24px 24px 0 0',
      maxHeight: '90vh',
    },
    top: {
      top: 0,
      left: 0,
      right: 0,
      borderRadius: '0 0 24px 24px',
      maxHeight: '90vh',
    },
  };

  const animations = enableAnimation
    ? {
        overlay: {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.2 },
        },
        modal: {
          center: {
            initial: { opacity: 0, scale: 0.95, y: 20 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.95, y: 20 },
            transition: { type: 'spring', damping: 25, stiffness: 300 },
          },
          bottom: {
            initial: { opacity: 0, y: '100%' },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: '100%' },
            transition: { type: 'spring', damping: 30, stiffness: 400 },
          },
          top: {
            initial: { opacity: 0, y: '-100%' },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: '-100%' },
            transition: { type: 'spring', damping: 30, stiffness: 400 },
          },
        },
      }
    : {
        overlay: {},
        modal: {},
      };

  const currentSize = sizeConfig[size] || sizeConfig.md;
  const currentPosition = positionConfig[position] || positionConfig.center;
  const currentAnimation = animations.modal[position] || animations.modal.center;

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            {...animations.overlay}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              zIndex: 500, // GlassModal level — above Premium Modal (400), below Select (9000)
              ...(position === 'bottom' || position === 'top'
                ? { display: 'flex', flexDirection: 'column', justifyContent: position === 'bottom' ? 'flex-end' : 'flex-start' }
                : {}),
            }}
          />

          {/* Modal */}
          <motion.div
            {...currentAnimation}
            style={{
              position: 'fixed',
              ...currentPosition,
              ...currentSize,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              zIndex: 501, // GlassModal content — one above backdrop
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              ...style,
            }}
            className={className}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                  flexShrink: 0,
                }}
              >
                <div>
                  {title && (
                    <div
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#111827',
                        lineHeight: 1.3,
                      }}
                    >
                      {title}
                    </div>
                  )}
                  {subtitle && (
                    <div
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 12,
                        color: '#6B7280',
                        marginTop: 2,
                      }}
                    >
                      {subtitle}
                    </div>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      border: 'none',
                      background: 'rgba(0, 0, 0, 0.04)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6B7280',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div
              ref={contentRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '16px 20px',
                  paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                  borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                  flexShrink: 0,
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

/**
 * ConfirmModal - Pre-configured confirmation dialog
 */
export const ConfirmModal = ({
  visible,
  onClose,
  onConfirm,
  title = 'Konfirmasi',
  message = '',
  confirmText = 'Ya',
  cancelText = 'Batal',
  variant = 'danger', // 'danger' | 'primary' | 'warning'
  loading = false,
}) => {
  const buttonColors = {
    danger: { bg: '#EF4444', hover: '#DC2626' },
    primary: { bg: '#5B005F', hover: '#8B5CF6' },
    warning: { bg: '#F59E0B', hover: '#D97706' },
  };

  const colors = buttonColors[variant] || buttonColors.primary;

  return (
    <GlassModal
      visible={visible}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              border: '1.5px solid #E5E7EB',
              background: 'white',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: '#6B7280',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 10,
              border: 'none',
              background: colors.bg,
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: 'white',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Memproses...' : confirmText}
          </button>
        </>
      }
    >
      <p
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          color: '#6B7280',
          lineHeight: 1.6,
          margin: 0,
          textAlign: 'center',
        }}
      >
        {message}
      </p>
    </GlassModal>
  );
};

/**
 * AlertModal - Simple alert/info dialog
 */
export const AlertModal = ({
  visible,
  onClose,
  title = 'Informasi',
  message = '',
  buttonText = 'OK',
  icon = 'ℹ️',
}) => {
  return (
    <GlassModal
      visible={visible}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      footer={
        <button
          onClick={onClose}
          style={{
            width: '100%',
            height: 44,
            borderRadius: 10,
            border: 'none',
            background: '#5B005F',
            cursor: 'pointer',
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            color: 'white',
          }}
        >
          {buttonText}
        </button>
      }
    >
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
        {title && (
          <div
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 16,
              fontWeight: 700,
              color: '#111827',
              marginBottom: 8,
            }}
          >
            {title}
          </div>
        )}
        <p
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            color: '#6B7280',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {message}
        </p>
      </div>
    </GlassModal>
  );
};

/**
 * SuccessModal - Success feedback dialog
 */
export const SuccessModal = ({ visible, onClose, title = 'Berhasil!', message = '' }) => {
  return (
    <AlertModal
      visible={visible}
      onClose={onClose}
      title={title}
      message={message}
      icon="✅"
      buttonText="OK"
    />
  );
};

/**
 * ErrorModal - Error feedback dialog
 */
export const ErrorModal = ({ visible, onClose, title = 'Terjadi Kesalahan', message = '' }) => {
  return (
    <AlertModal
      visible={visible}
      onClose={onClose}
      title={title}
      message={message}
      icon="❌"
      buttonText="Tutup"
    />
  );
};

export default GlassModal;
