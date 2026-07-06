// ─────────────────────────────────────────────────────────────────────────────
// LaundryIcon.jsx — Custom icon component untuk replace emoji
// Mapping emoji ke custom asset images
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../utils/theme';

// ─── Import Assets ────────────────────────────────────────────────────────────
import laundry_2 from '../assets/Icon and Asset Laundry/2.webp'
import laundry_3 from '../assets/Icon and Asset Laundry/3.webp'
import laundry_4 from '../assets/Icon and Asset Laundry/4.webp'
import laundry_5 from '../assets/Icon and Asset Laundry/5.webp'
import laundry_6 from '../assets/Icon and Asset Laundry/6.webp'
import laundry_7 from '../assets/Icon and Asset Laundry/7.webp'
import laundry_8 from '../assets/Icon and Asset Laundry/8.webp'
import laundry_9 from '../assets/Icon and Asset Laundry/9.webp'
import laundry_10 from '../assets/Icon and Asset Laundry/10.webp'
import laundry_11 from '../assets/Icon and Asset Laundry/11.webp'
import laundry_12 from '../assets/Icon and Asset Laundry/12.webp'
import laundry_13 from '../assets/Icon and Asset Laundry/13.webp'
import laundry_14 from '../assets/Icon and Asset Laundry/14.webp'
import laundry_15 from '../assets/Icon and Asset Laundry/15.webp'
import laundry_16 from '../assets/Icon and Asset Laundry/16.webp'
import laundry_17 from '../assets/Icon and Asset Laundry/17.webp'
import laundry_18 from '../assets/Icon and Asset Laundry/18.webp'
import laundry_19 from '../assets/Icon and Asset Laundry/19.webp'
import laundry_20 from '../assets/Icon and Asset Laundry/20.webp'
import laundry_21 from '../assets/Icon and Asset Laundry/21.webp'
import laundry_22 from '../assets/Icon and Asset Laundry/22.webp'
import laundry_23 from '../assets/Icon and Asset Laundry/23.webp'
import laundry_24 from '../assets/Icon and Asset Laundry/24.webp'
import laundry_25 from '../assets/Icon and Asset Laundry/25.webp'
import laundry_26 from '../assets/Icon and Asset Laundry/26.webp'
import laundry_27 from '../assets/Icon and Asset Laundry/27.webp'
import laundry_28 from '../assets/Icon and Asset Laundry/28.webp'
import laundry_29 from '../assets/Icon and Asset Laundry/29.webp'
import laundry_30 from '../assets/Icon and Asset Laundry/30.webp'
import laundry_31 from '../assets/Icon and Asset Laundry/31.webp'
import laundry_32 from '../assets/Icon and Asset Laundry/32.webp'
import laundry_33 from '../assets/Icon and Asset Laundry/33.webp'
import laundry_35 from '../assets/Icon and Asset Laundry/35.webp'
import laundry_36 from '../assets/Icon and Asset Laundry/36.webp'

// Named icons
import laundry_chat from '../assets/Icon and Asset Laundry/chat.webp'
import laundry_delivery from '../assets/Icon and Asset Laundry/delivery.webp'
import laundry_express from '../assets/Icon and Asset Laundry/express-clock.webp'
import laundry_folded from '../assets/Icon and Asset Laundry/folded-laundry.webp'
import laundry_garansi from '../assets/Icon and Asset Laundry/garansi.webp'
import laundry_hygienic from '../assets/Icon and Asset Laundry/hygienic.webp'
import laundry_leaves from '../assets/Icon and Asset Laundry/leaves-eco-friendly.webp'
import laundry_location from '../assets/Icon and Asset Laundry/location.webp'
import laundry_notifikasi from '../assets/Icon and Asset Laundry/notifikasi.webp'
import laundry_order from '../assets/Icon and Asset Laundry/order.webp'
import laundry_payment from '../assets/Icon and Asset Laundry/pembayaran-wallet.webp'
import laundry_pickup from '../assets/Icon and Asset Laundry/pickup.webp'
import laundry_premium from '../assets/Icon and Asset Laundry/premium-cloth.webp'
import laundry_promo from '../assets/Icon and Asset Laundry/promo-atau-diskon.webp'
import laundry_riwayat from '../assets/Icon and Asset Laundry/riwayat.webp'
import laundry_schedule from '../assets/Icon and Asset Laundry/schedule.webp'

// ─── Decorative Assets ────────────────────────────────────────────────────────
import decor_bubble1 from '../assets/Decorative icon/bubble-1.webp'
import decor_bubble2 from '../assets/Decorative icon/bubble-2.webp'
import decor_soap from '../assets/Decorative icon/soap-bubble.webp'
import decor_sparkle from '../assets/Decorative icon/sparkle.webp'
import decor_star from '../assets/Decorative icon/star.webp'
import decor_flower from '../assets/Decorative icon/flower.webp'
import decor_wave from '../assets/Decorative icon/wave.webp'

// ─── Service Icons Map ────────────────────────────────────────────────────────
// Ini mapping dari categoryCode ke asset untuk service icons
export const SERVICE_ICONS = {
  // Numbered service icons (2-36)
  'WS': laundry_2,      // Cuci Setrika
  'DRY': laundry_3,   // Dry Clean
  'SPE': laundry_4,    // Express
  'VIP': laundry_5,    // Premium/VIP
  'KIDS': laundry_6,   // Kids
  'BED': laundry_7,    // Bed Cover
  'CAR': laundry_8,    // Carpet
  'CUR': laundry_9,    // Curtain
  'JAS': laundry_10,   // Jas
  'KIM': laundry_11,   // Kimono
  'SKA': laundry_12,    // Skirt
  'BLO': laundry_13,   // Blouse
  'GAM': laundry_14,   // Gamis
  'JAK': laundry_15,   // Jacket
  'CEL': laundry_16,   // Celana
  'ROK': laundry_17,   // Rok
  'BAJU': laundry_18,  // Baju
  'HEM': laundry_19,   // Hemd
  'Baju_K': laundry_20, // Baju Kurta
  'DRE': laundry_21,    // Dress
  'Kebaya': laundry_22, // Kebaya
  'Batik': laundry_23,  // Batik
  'Suit': laundry_24,   // Suit
  'Blazer': laundry_25, // Blazer
  'Widding': laundry_26, // Wedding
  'Seragam': laundry_27, // Seragam
  'Sarung': laundry_28,  // Sarung
  'Handuk': laundry_29,  // Handuk
  'Selimut': laundry_30, // Selimut
  'Boneka': laundry_31,   // Boneka
  'Tas': laundry_32,     // Tas
  'Sepatu': laundry_33,   // Sepatu
  'Karpet': laundry_35,   // Karpet
  'Sprei': laundry_36,   // Sprei
};

// ─── Feature Icons Map ────────────────────────────────────────────────────────
export const FEATURE_ICONS = {
  express: laundry_express,
  delivery: laundry_delivery,
  pickup: laundry_pickup,
  payment: laundry_payment,
  order: laundry_order,
  chat: laundry_chat,
  schedule: laundry_schedule,
  notification: laundry_notifikasi,
  promo: laundry_promo,
  garansi: laundry_garansi,
  riwayat: laundry_riwayat,
  location: laundry_location,
  folded: laundry_folded,
  hygienic: laundry_hygienic,
  leaves: laundry_leaves,
  premium: laundry_premium,
};

// ─── Decorative Assets Map ──────────────────────────────────────────────────
export const DECOR_ICONS = {
  bubble1: decor_bubble1,
  bubble2: decor_bubble2,
  soap: decor_soap,
  sparkle: decor_sparkle,
  star: decor_star,
  flower: decor_flower,
  wave: decor_wave,
};

// ─── Main LaundryIcon Component ──────────────────────────────────────────────
/**
 * Custom icon component untuk replace emoji
 * @param {string} name - Nama icon (dari FEATURE_ICONS atau DECOR_ICONS)
 * @param {string} categoryCode - Category code service (untuk SERVICE_ICONS)
 * @param {number} size - Size dalam px
 * @param {string} className - Additional className
 * @param {object} style - Additional styles
 */
export default function LaundryIcon({
  name,
  categoryCode,
  size = 24,
  className = '',
  style = {},
  ...props
}) {
  // Priority: name > categoryCode
  let src = null;

  if (name && FEATURE_ICONS[name]) {
    src = FEATURE_ICONS[name];
  } else if (name && DECOR_ICONS[name]) {
    src = DECOR_ICONS[name];
  } else if (categoryCode && SERVICE_ICONS[categoryCode]) {
    src = SERVICE_ICONS[categoryCode];
  }

  if (!src) return null;

  return (
    <img
      src={src}
      alt={name || categoryCode || 'icon'}
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: 'contain',
        ...style
      }}
      {...props}
    />
  );
}

// ─── Service Icon Helper ────────────────────────────────────────────────────
/**
 * Get icon untuk service berdasarkan categoryCode
 * @param {string} categoryCode
 * @returns {string} src untuk img tag
 */
export function getServiceIcon(categoryCode) {
  return SERVICE_ICONS[categoryCode] || null;
}

/**
 * Get feature icon berdasarkan name
 * @param {string} name
 * @returns {string} src untuk img tag
 */
export function getFeatureIcon(name) {
  return FEATURE_ICONS[name] || null;
}

/**
 * Get decorative icon berdasarkan name
 * @param {string} name
 * @returns {string} src untuk img tag
 */
export function getDecorIcon(name) {
  return DECOR_ICONS[name] || null;
}
