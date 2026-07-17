// ─────────────────────────────────────────────────────────────────────────────
// IconMapper — Mapping lucide-react names ke ServiceIcon names
// Digunakan untuk migrasi bertahap dari lucide ke gambar
// ─────────────────────────────────────────────────────────────────────────────

import { ServiceIcon } from './ServiceIcon';

// Mapping dari lucide icon names ke ServiceIcon names
export const LUCIDE_TO_SERVICE = {
  // Commerce & Shopping
  'shopping-cart': 'order',
  'shopping-bag': 'order',
  'package': 'pickup',
  'gift': 'promo',
  'tag': 'order',
  'receipt': 'order',
  'credit-card': 'wallet',
  'dollar-sign': 'wallet',
  'wallet': 'wallet',

  // Communication
  'message-circle': 'chat',
  'message-square': 'chat',
  'bell': 'notifikasi',
  'mail': 'chat',

  // Maps & Location
  'map-pin': 'location',
  'map': 'location',
  'navigation': 'location',
  'compass': 'location',

  // Time & Schedule
  'clock': 'schedule',
  'calendar': 'schedule',
  'timer': 'express-clock',
  'watch': 'schedule',

  // Delivery & Transport
  'truck': 'delivery',
  'car': 'delivery',
  'bike': 'delivery',

  // Quality & Trust
  'shield': 'garansi',
  'shield-check': 'garansi',
  'award': 'garansi',
  'badge-check': 'garansi',
  'sparkles': 'hygienic',
  'shine': 'hygienic',
  'crown': 'garansi',

  // Eco & Nature
  'leaf': 'eco-friendly',
  'tree-pine': 'eco-friendly',
  'flower': 'eco-friendly',
  'sprout': 'eco-friendly',

  // Documents & Files
  'file-text': 'order',
  'file': 'order',
  'clipboard-list': 'riwayat',
  'clipboard-check': 'riwayat',
  'history': 'riwayat',

  // People & Users
  'users': 'chat',
  'user': 'chat',
  'user-check': 'chat',
  'user-plus': 'chat',

  // Settings & Tools
  'settings': 'schedule',
  'tool': 'schedule',
  'wrench': 'schedule',

  // Status & Quality
  'check-circle': 'hygienic',
  'check-square': 'hygienic',
  'check': 'hygienic',
  'x-circle': 'garansi',
  'x': 'garansi',
  'alert-circle': 'notifikasi',
  'alert-triangle': 'notifikasi',
  'info': 'notifikasi',

  // Navigation
  'home': 'order',
  'grid': 'order',
  'list': 'order',
  'menu': 'order',
  'more-horizontal': 'order',
  'more-vertical': 'order',

  // Actions
  'plus': 'order',
  'minus': 'order',
  'edit': 'schedule',
  'edit-2': 'schedule',
  'edit-3': 'schedule',
  'trash': 'schedule',
  'trash-2': 'schedule',
  'search': 'order',
  'filter': 'order',
  'download': 'delivery',
  'upload': 'pickup',
  'refresh-cw': 'schedule',
  'rotate-ccw': 'schedule',
  'copy': 'order',
  'share': 'chat',
  'send': 'chat',
  'external-link': 'location',

  // Arrows
  'arrow-right': 'order',
  'arrow-left': 'order',
  'arrow-up': 'order',
  'arrow-down': 'order',
  'chevron-right': 'order',
  'chevron-left': 'order',
  'chevron-up': 'order',
  'chevron-down': 'order',

  // Media & Entertainment
  'star': 'garansi',
  'star-half': 'garansi',
  'heart': 'garansi',
  'thumbs-up': 'garansi',
  'thumbs-down': 'garansi',

  // Money & Finance
  'trending-up': 'wallet',
  'trending-down': 'wallet',
  'trending': 'wallet',
  'bar-chart': 'wallet',
  'pie-chart': 'wallet',

  // Print & Media
  'printer': 'order',
  'save': 'order',
};

/**
 * ServiceIconWrapper — Wrapper untuk menggunakan ServiceIcon dengan nama lucide
 *
 * @param {string} iconName - Nama icon lucide-react
 * @param {number} size - Ukuran (default: 20)
 * @param {string} variant - Variants: filled, transparent, outlined
 * @param {string} color - Warna
 */
export function ServiceIconWrapper({
  iconName = 'circle',
  size = 20,
  variant = 'transparent',
  color,
}) {
  // Map lucide name ke service icon name
  const mappedName = LUCIDE_TO_SERVICE[iconName];

  // Fallback: jika tidak ada mapping, return null
  if (!mappedName) {
    return null;
  }

  return (
    <ServiceIcon
      name={mappedName}
      size={size}
      variant={variant}
      color={color}
    />
  );
}

/**
 * HybridIcon — Coba ServiceIcon, fallback ke lucide
 *
 * @param {string} iconName - Nama icon (lucide atau service)
 * @param {number} size - Ukuran
 * @param {object} lucideIcon - Lucide icon component (fallback)
 */
export function HybridIcon({
  iconName = 'circle',
  size = 20,
  lucideIcon: LucideIcon,
  ...props
}) {
  const mappedName = LUCIDE_TO_SERVICE[iconName];

  if (mappedName) {
    return <ServiceIcon name={mappedName} size={size} {...props} />;
  }

  // Fallback ke lucide
  if (LucideIcon) {
    return <LucideIcon size={size} {...props} />;
  }

  return null;
}

/**
 * IconButton dengan ServiceIcon
 *
 * @param {string} iconName - Nama icon
 * @param {function} onClick - Handler click
 * @param {string} size - Ukuran button: sm, md, lg
 * @param {string} variant - filled, transparent
 */
export function ServiceIconButton({
  iconName = 'order',
  onClick,
  size = 'md',
  variant = 'transparent',
  color,
  className,
  style,
}) {
  const sizeMap = {
    sm: { button: 32, icon: 16 },
    md: { button: 40, icon: 20 },
    lg: { button: 48, icon: 24 },
  };

  const sizes = sizeMap[size] || sizeMap.md;

  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        width: sizes.button,
        height: sizes.button,
        borderRadius: sizes.button / 3,
        border: 'none',
        background: variant === 'filled' ? `${color || '#7C3AED'}20` : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <ServiceIcon
        name={iconName}
        size={sizes.icon}
        variant={variant === 'filled' ? 'filled' : 'transparent'}
        color={color}
      />
    </button>
  );
}

/**
 * QuickIconBadge — Icon + Text badge
 */
export function QuickIconBadge({
  iconName = 'order',
  label = '',
  color = '#7C3AED',
  size = 'md',
}) {
  const sizeMap = {
    sm: { icon: 14, text: 10, padding: '4px 8px', gap: 4 },
    md: { icon: 16, text: 11, padding: '6px 10px', gap: 6 },
    lg: { icon: 18, text: 12, padding: '8px 12px', gap: 8 },
  };

  const sizes = sizeMap[size] || sizeMap.md;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizes.gap,
        padding: sizes.padding,
        borderRadius: 999,
        background: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <ServiceIcon name={iconName} size={sizes.icon} variant="filled" color={color} />
      {label && (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: sizes.text,
            fontWeight: 600,
            color: color,
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * IconGrid — Grid of icons (untuk showcase atau picker)
 */
export function IconGrid({
  icons = [],
  selectedIcon,
  onSelect,
  size = 24,
  columns = 6,
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 8,
      }}
    >
      {icons.map((iconName) => {
        const isSelected = selectedIcon === iconName;
        return (
          <button
            key={iconName}
            onClick={() => onSelect?.(iconName)}
            style={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: 8,
              border: isSelected ? '2px solid #7C3AED' : '1px solid #E5E7EB',
              background: isSelected ? 'rgba(124, 58, 237, 0.1)' : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            <ServiceIcon name={iconName} size={size} variant="filled" />
          </button>
        );
      })}
    </div>
  );
}

// Export semua helper functions
export {
  ServiceIcon,
  ServiceIconBadge,
  ServiceIconGroup,
  ServiceIconList,
} from './ServiceIcon';
