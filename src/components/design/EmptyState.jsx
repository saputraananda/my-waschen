// ─────────────────────────────────────────────────────────────────────────────
// EmptyState.jsx — Animated Empty State with 3D Assets
// ─────────────────────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { SHADOWS, GRADIENTS, RADIUS } from '../../utils/designSystem';
import { CharacterAvatar } from '../CharacterAvatar';
import {
  IconList, IconSearch, IconWarning, IconSuccess, IconClock,
  IconPackage, IconUsers, IconCar
} from '../ui/StatusIcons';

// Icon component map for empty state types
const EmptyStateIcon = ({ type, size = 40, color }) => {
  const iconProps = { size, color };
  switch (type) {
    case 'no-data': return <IconList {...iconProps} />;
    case 'no-results': return <IconSearch {...iconProps} />;
    case 'error': return <IconWarning {...iconProps} />;
    case 'success': return <IconSuccess {...iconProps} />;
    case 'loading': return <IconClock {...iconProps} />;
    case 'success-delivery': return <IconSuccess {...iconProps} />;
    case 'no-delivery': return <IconCar {...iconProps} />;
    case 'no-transaction': return <IconPackage {...iconProps} />;
    case 'no-customer': return <IconUsers {...iconProps} />;
    default: return <IconList {...iconProps} />;
  }
};

/**
 * EmptyState — Animated empty state with illustration
 *
 * @param {string} type - 'no-data' | 'no-results' | 'error' | 'success' | 'loading'
 * @param {string} title - Title text
 * @param {string} description - Description text
 * @param {string} actionLabel - Button label
 * @param {function} onAction - Action callback
 * @param {boolean} showAvatar - Show 3D character avatar
 * @param {string} avatarVariant - Avatar variant to show
 */
export function EmptyState({
  type = 'no-data',
  title,
  description,
  actionLabel,
  onAction,
  showAvatar = true,
  avatarVariant = 'waving',
  icon,
  style,
  className,
}) {
  const typeConfig = {
    'no-data': {
      title: title || 'Belum Ada Data',
      description: description || 'Data akan muncul di sini setelah ada aktivitas.',
      iconType: 'no-data',
      color: '#7C3AED',
    },
    'no-results': {
      title: title || 'Tidak Ditemukan',
      description: description || 'Coba ubah kata kunci pencarian atau filter.',
      iconType: 'no-results',
      color: '#6B7280',
    },
    'error': {
      title: title || 'Terjadi Kesalahan',
      description: description || 'Silakan coba lagi dalam beberapa saat.',
      iconType: 'error',
      color: '#DC2626',
    },
    'success': {
      title: title || 'Berhasil!',
      description: description || 'Semua berjalan dengan baik.',
      iconType: 'success',
      color: '#059669',
    },
    'loading': {
      title: title || 'Memuat...',
      description: description || 'Sedang mengambil data.',
      iconType: 'loading',
      color: '#7C3AED',
    },
    'success-delivery': {
      title: title || 'Semua Terkirim!',
      description: description || 'Semua pesanan sudah diantar. Kerja bagus!',
      iconType: 'success-delivery',
      color: '#059669',
    },
    'no-delivery': {
      title: title || 'Belum Ada Tugas',
      description: description || 'Tugas penjemputan dan pengantaran akan muncul di sini.',
      iconType: 'no-delivery',
      color: '#7C3AED',
    },
    'no-transaction': {
      title: title || 'Belum Ada Transaksi',
      description: description || 'Transaksi akan muncul setelah ada pelanggan.',
      iconType: 'no-transaction',
      color: '#7C3AED',
    },
    'no-customer': {
      title: title || 'Belum Ada Customer',
      description: description || 'Customer akan muncul setelah ada yang terdaftar.',
      iconType: 'no-customer',
      color: '#7C3AED',
    },
  };

  const config = typeConfig[type] || typeConfig['no-data'];

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 300 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        ...style,
      }}
    >
      {/* Avatar / Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 15 }}
        style={{
          marginBottom: 24,
        }}
      >
        {showAvatar ? (
          <div style={{
            width: 120,
            height: 120,
            borderRadius: 40,
            background: `linear-gradient(145deg, ${config.color}15, ${config.color}08)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `8px 8px 24px ${config.color}15, -4px -4px 12px rgba(255, 255, 255, 0.9)`,
          }}>
            <CharacterAvatar
              variant={avatarVariant}
              size={80}
            />
          </div>
        ) : (
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              background: GRADIENTS.purpleSoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: SHADOWS.clay.lg,
            }}
          >
            {icon ? icon : <EmptyStateIcon type={config.iconType} size={40} color={config.color} />}
          </motion.div>
        )}
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 18,
          fontWeight: 700,
          color: '#1F2937',
          margin: 0,
          marginBottom: 8,
        }}
      >
        {config.title}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          color: '#6B7280',
          margin: 0,
          marginBottom: 24,
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        {config.description}
      </motion.p>

      {/* Action Button */}
      {actionLabel && onAction && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 300 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          style={{
            background: GRADIENTS.primary,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: RADIUS.xl,
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Poppins, sans-serif',
            cursor: 'pointer',
            boxShadow: SHADOWS.button.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {actionLabel}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </motion.button>
      )}
    </motion.div>
  );
}

/**
 * LoadingState — Animated loading placeholder
 */
export function LoadingState({ message = 'Memuat...' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      {/* Animated spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '4px solid rgba(124, 58, 237, 0.2)',
          borderTopColor: '#7C3AED',
          marginBottom: 16,
          boxShadow: SHADOWS.glow.purple,
        }}
      />

      {/* Message */}
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          color: '#6B7280',
          margin: 0,
        }}
      >
        {message}
      </motion.p>
    </motion.div>
  );
}

/**
 * SkeletonCard — Animated skeleton loading card
 */
export function SkeletonCard({ height = 120, style }) {
  return (
    <motion.div
      animate={{
        backgroundPosition: ['0% 0%', '200% 0%'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        height,
        borderRadius: RADIUS['2xl'],
        background: `linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)`,
        backgroundSize: '200% 100%',
        ...style,
      }}
    />
  );
}

/**
 * SkeletonList — Animated skeleton loading list
 */
export function SkeletonList({ count = 5, itemHeight = 80, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          style={{
            height: itemHeight,
            borderRadius: RADIUS['2xl'],
            background: `linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)`,
            backgroundSize: '200% 100%',
            animation: `shimmer 1.5s linear infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default EmptyState;
