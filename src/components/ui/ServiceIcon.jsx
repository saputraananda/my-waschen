// ─────────────────────────────────────────────────────────────────────────────
// ServiceIcon — Gambar dari Icon and Asset Laundry dijadikan icon konsisten
// Ukuran mengikuti standar lucide-react: 16, 18, 20, 22, 24, 32
//
// Available files (verified):
// - chat, delivery, express-clock, folded-laundry, garansi, hygienic,
//   leaves-eco-friendly, location, notifikasi, order, pembayaran-wallet,
//   pickup, premium-cloth, promo-atau-diskon, riwayat, schedule
// - 2-33, 35, 36 (numbered icons)
// ─────────────────────────────────────────────────────────────────────────────

// Import named icons dari Icon and Asset Laundry
import iconChat from '../../assets/Icon and Asset Laundry/chat.webp';
import iconDelivery from '../../assets/Icon and Asset Laundry/delivery.webp';
import iconExpressClock from '../../assets/Icon and Asset Laundry/express-clock.webp';
import iconFoldedLaundry from '../../assets/Icon and Asset Laundry/folded-laundry.webp';
import iconGaransi from '../../assets/Icon and Asset Laundry/garansi.webp';
import iconHygienic from '../../assets/Icon and Asset Laundry/hygienic.webp';
import iconLeavesEco from '../../assets/Icon and Asset Laundry/leaves-eco-friendly.webp';
import iconLocation from '../../assets/Icon and Asset Laundry/location.webp';
import iconNotifikasi from '../../assets/Icon and Asset Laundry/notifikasi.webp';
import iconOrder from '../../assets/Icon and Asset Laundry/order.webp';
import iconWallet from '../../assets/Icon and Asset Laundry/pembayaran-wallet.webp';
import iconPickup from '../../assets/Icon and Asset Laundry/pickup.webp';
import iconPremiumCloth from '../../assets/Icon and Asset Laundry/premium-cloth.webp';
import iconPromo from '../../assets/Icon and Asset Laundry/promo-atau-diskon.webp';
import iconRiwayat from '../../assets/Icon and Asset Laundry/riwayat.webp';
import iconSchedule from '../../assets/Icon and Asset Laundry/schedule.webp';

// Import numbered icons (2-33, 35, 36)
import iconS2 from '../../assets/Icon and Asset Laundry/2.webp';
import iconS3 from '../../assets/Icon and Asset Laundry/3.webp';
import iconS4 from '../../assets/Icon and Asset Laundry/4.webp';
import iconS5 from '../../assets/Icon and Asset Laundry/5.webp';
import iconS6 from '../../assets/Icon and Asset Laundry/6.webp';
import iconS7 from '../../assets/Icon and Asset Laundry/7.webp';
import iconS8 from '../../assets/Icon and Asset Laundry/8.webp';
import iconS9 from '../../assets/Icon and Asset Laundry/9.webp';
import iconS10 from '../../assets/Icon and Asset Laundry/10.webp';
import iconS11 from '../../assets/Icon and Asset Laundry/11.webp';
import iconS12 from '../../assets/Icon and Asset Laundry/12.webp';
import iconS13 from '../../assets/Icon and Asset Laundry/13.webp';
import iconS14 from '../../assets/Icon and Asset Laundry/14.webp';
import iconS15 from '../../assets/Icon and Asset Laundry/15.webp';
import iconS16 from '../../assets/Icon and Asset Laundry/16.webp';
import iconS17 from '../../assets/Icon and Asset Laundry/17.webp';
import iconS18 from '../../assets/Icon and Asset Laundry/18.webp';
import iconS19 from '../../assets/Icon and Asset Laundry/19.webp';
import iconS20 from '../../assets/Icon and Asset Laundry/20.webp';
import iconS21 from '../../assets/Icon and Asset Laundry/21.webp';
import iconS22 from '../../assets/Icon and Asset Laundry/22.webp';
import iconS23 from '../../assets/Icon and Asset Laundry/23.webp';
import iconS24 from '../../assets/Icon and Asset Laundry/24.webp';
import iconS25 from '../../assets/Icon and Asset Laundry/25.webp';
import iconS26 from '../../assets/Icon and Asset Laundry/26.webp';
import iconS27 from '../../assets/Icon and Asset Laundry/27.webp';
import iconS28 from '../../assets/Icon and Asset Laundry/28.webp';
import iconS29 from '../../assets/Icon and Asset Laundry/29.webp';
import iconS30 from '../../assets/Icon and Asset Laundry/30.webp';
import iconS31 from '../../assets/Icon and Asset Laundry/31.webp';
import iconS32 from '../../assets/Icon and Asset Laundry/32.webp';
import iconS33 from '../../assets/Icon and Asset Laundry/33.webp';
import iconS35 from '../../assets/Icon and Asset Laundry/35.webp';
import iconS36 from '../../assets/Icon and Asset Laundry/36.webp';

// Named service icons map
const SERVICE_ICONS = {
  chat: iconChat,
  delivery: iconDelivery,
  'express-clock': iconExpressClock,
  'folded-laundry': iconFoldedLaundry,
  garansi: iconGaransi,
  hygienic: iconHygienic,
  'eco-friendly': iconLeavesEco,
  location: iconLocation,
  notifikasi: iconNotifikasi,
  order: iconOrder,
  wallet: iconWallet,
  pickup: iconPickup,
  'premium-cloth': iconPremiumCloth,
  promo: iconPromo,
  riwayat: iconRiwayat,
  schedule: iconSchedule,
  // Numbered service icons (2-33, 35, 36 - no 1 or 34)
  2: iconS2,
  3: iconS3,
  4: iconS4,
  5: iconS5,
  6: iconS6,
  7: iconS7,
  8: iconS8,
  9: iconS9,
  10: iconS10,
  11: iconS11,
  12: iconS12,
  13: iconS13,
  14: iconS14,
  15: iconS15,
  16: iconS16,
  17: iconS17,
  18: iconS18,
  19: iconS19,
  20: iconS20,
  21: iconS21,
  22: iconS22,
  23: iconS23,
  24: iconS24,
  25: iconS25,
  26: iconS26,
  27: iconS27,
  28: iconS28,
  29: iconS29,
  30: iconS30,
  31: iconS31,
  32: iconS32,
  33: iconS33,
  35: iconS35,
  36: iconS36,
};

// Preset icon combinations for common use cases
export const SERVICE_ICON_PRESETS = {
  // Dashboard
  transactions: { icon: 'order', label: 'Transaksi', color: '#7C3AED' },
  customers: { icon: 'chat', label: 'Pelanggan', color: '#3B82F6' },
  delivery: { icon: 'delivery', label: 'Pengiriman', color: '#10B981' },
  schedule: { icon: 'schedule', label: 'Jadwal', color: '#F59E0B' },
  notifications: { icon: 'notifikasi', label: 'Notifikasi', color: '#EF4444' },

  // Transaction
  payment: { icon: 'wallet', label: 'Pembayaran', color: '#7C3AED' },
  history: { icon: 'riwayat', label: 'Riwayat', color: '#6B7280' },
  promo: { icon: 'promo', label: 'Promo', color: '#F59E0B' },

  // Production
  pickup: { icon: 'pickup', label: 'Ambil', color: '#3B82F6' },
  folded: { icon: 'folded-laundry', label: 'Lipat', color: '#10B981' },
  hygienic: { icon: 'hygienic', label: 'Higienis', color: '#06B6D4' },
  premium: { icon: 'premium-cloth', label: 'Premium', color: '#F59E0B' },
  guarantee: { icon: 'garansi', label: 'Garansi', color: '#8B5CF6' },

  // Location
  location: { icon: 'location', label: 'Lokasi', color: '#EF4444' },
  express: { icon: 'express-clock', label: 'Express', color: '#F97316' },
  eco: { icon: 'eco-friendly', label: 'Eco', color: '#22C55E' },
};

/**
 * ServiceIcon — Icon dari gambar dengan ukuran konsisten
 *
 * @param {string} name - Nama icon (dari SERVICE_ICONS keys)
 * @param {number} size - Ukuran pixel (default: 22, standar lucide-react)
 * @param {string} variant - Variasi tampilan:
 *   'filled' - Background dengan warna (default)
 *   'transparent' - Tanpa background
 *   'outlined' - Border dengan background transparan
 * @param {string} color - Warna tint/icon (default: primary purple)
 * @param {string} bgColor - Background color (default: sesuai variant)
 * @param {boolean} lazy - Lazy load gambar (default: true)
 */
export function ServiceIcon({
  name = 'order',
  size = 22,
  variant = 'filled',
  color,
  bgColor,
  lazy = true,
}) {
  const src = SERVICE_ICONS[name];

  if (!src) {
    // Fallback: return null jika icon tidak ditemukan
    return null;
  }

  // Default colors berdasarkan variant
  const defaultBg = {
    filled: 'rgba(124, 58, 237, 0.1)',
    transparent: 'transparent',
    outlined: 'transparent',
  };

  const defaultColor = '#7C3AED';

  const bg = bgColor || defaultBg[variant] || 'transparent';
  const iconColor = color || defaultColor;

  // Border untuk outlined variant
  const borderStyle = variant === 'outlined'
    ? `1.5px solid ${iconColor}`
    : 'none';

  // Border radius mengikuti size (lebih round untuk icon kecil)
  const borderRadius = Math.max(6, size * 0.25);

  // Padding untuk filled variant agar icon tidak kepenuhan
  const padding = variant === 'filled' ? size * 0.15 : 0;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius,
        background: bg,
        border: borderStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: padding,
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={name}
        loading={lazy ? 'lazy' : 'eager'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          // Apply color tint via filter jika perlu
          filter: iconColor !== defaultColor
            ? `brightness(0) saturate(100%) invert(35%) sepia(50%) saturate(1000%) hue-rotate(240deg)`
            : 'none',
        }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
}

/**
 * ServiceIconBadge — Icon dengan label, cocok untuk dashboard/stats
 *
 * @param {string} name - Nama icon
 * @param {string} label - Label text
 * @param {number} iconSize - Ukuran icon (default: 24)
 * @param {string} color - Warna accent (default: primary)
 */
export function ServiceIconBadge({
  name = 'order',
  label = '',
  iconSize = 24,
  color = '#7C3AED',
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 12,
        background: `${color}10`,
        border: `1px solid ${color}30`,
      }}
    >
      <ServiceIcon
        name={name}
        size={iconSize}
        variant="filled"
        color={color}
      />
      {label && (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 12,
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
 * ServiceIconGroup — Grid/icon group untuk service categories
 *
 * @param {Array} items - Array of {name, label?} objects
 * @param {number} iconSize - Ukuran icon (default: 20)
 * @param {string} activeIcon - Icon yang sedang active (highlighted)
 * @param {function} onClick - Handler click
 */
export function ServiceIconGroup({
  items = [],
  iconSize = 20,
  activeIcon = null,
  onClick,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {items.map((item, index) => {
        const isActive = activeIcon === item.name;
        return (
          <button
            key={item.name || index}
            onClick={() => onClick?.(item)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: iconSize * 0.4,
              borderRadius: 10,
              border: isActive ? '1.5px solid #7C3AED' : '1.5px solid #E5E7EB',
              background: isActive ? 'rgba(124, 58, 237, 0.08)' : 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <ServiceIcon
              name={item.name}
              size={iconSize}
              variant="transparent"
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * ServiceIconList — List item dengan icon, untuk settings/list pages
 *
 * @param {Array} items - Array of {name, label, description?, badge?} objects
 * @param {number} iconSize - Ukuran icon (default: 18)
 * @param {function} onItemClick - Handler click per item
 */
export function ServiceIconList({
  items = [],
  iconSize = 18,
  onItemClick,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((item, index) => (
        <button
          key={item.name || index}
          onClick={() => onItemClick?.(item)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F3F4F6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <ServiceIcon
            name={item.name}
            size={iconSize + 4}
            variant="filled"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
                fontWeight: 500,
                color: '#1F2937',
              }}
            >
              {item.label}
            </div>
            {item.description && (
              <div
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 11,
                  color: '#6B7280',
                  marginTop: 2,
                }}
              >
                {item.description}
              </div>
            )}
          </div>
          {item.badge && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: '#7C3AED',
                color: 'white',
                fontSize: 10,
                fontWeight: 600,
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {item.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// Export icon names untuk reference
export const SERVICE_ICON_NAMES = Object.keys(SERVICE_ICONS);

export default ServiceIcon;
