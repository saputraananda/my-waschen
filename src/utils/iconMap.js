// ─────────────────────────────────────────────────────────────────────────────
// iconMap.js — Mapping emoji/icon strings to PNG assets
// Replaces emoji icons with branded PNG illustrations
// ─────────────────────────────────────────────────────────────────────────────

// Lazy-loaded imports for all available assets
export const ICON_ASSETS = {
  // ─── Laundry Service Icons (Icon and Asset Laundry folder) ───────────
  // Files: 2.png through 35.png (various service icons)

  // Common service/lifestyle icons
  laundry: () => import('../assets/Icon and Asset Laundry/2.webp"),
  tag: () => import('../assets/Icon and Asset Laundry/3.webp"),
  trolley: () => import('../assets/Icon and Asset Laundry/4.webp"),
  iron: () => import('../assets/Icon and Asset Laundry/5.webp"),
  bag: () => import('../assets/Icon and Asset Laundry/6.webp"),
  deliveryVan: () => import('../assets/Icon and Asset Laundry/7.webp"),
  motorbike: () => import('../assets/Icon and Asset Laundry/8.webp"),
  car: () => import('../assets/Icon and Asset Laundry/9.webp"),

  // Feature icons (10-35.png)
  express: () => import('../assets/Icon and Asset Laundry/express-clock.webp"),
  hygienic: () => import('../assets/Icon and Asset Laundry/hygienic.webp"),
  eco: () => import('../assets/Icon and Asset Laundry/leaves-eco-friendly.webp"),
  premium: () => import('../assets/Icon and Asset Laundry/premium-cloth.webp"),
  guarantee: () => import('../assets/Icon and Asset Laundry/garansi.webp"),
  notification: () => import('../assets/Icon and Asset Laundry/notifikasi.webp"),
  history: () => import('../assets/Icon and Asset Laundry/riwayat.webp"),
  promo: () => import('../assets/Icon and Asset Laundry/promo-atau-diskon.webp"),
  wallet: () => import('../assets/Icon and Asset Laundry/pembayaran-wallet.webp"),
  chat: () => import('../assets/Icon and Asset Laundry/chat.webp"),
  location: () => import('../assets/Icon and Asset Laundry/location.webp"),
  schedule: () => import('../assets/Icon and Asset Laundry/schedule.webp"),
  order: () => import('../assets/Icon and Asset Laundry/order.webp"),
  delivery: () => import('../assets/Icon and Asset Laundry/delivery.webp"),
  pickup: () => import('../assets/Icon and Asset Laundry/pickup.webp"),
  foldedLaundry: () => import('../assets/Icon and Asset Laundry/folded-laundry.webp"),

  // ─── Avatar/Character Assets ───────────────────────────────────────────
  // karakter Perempuan folder

  // Full body illustrations
  avatarSmile: () => import('../assets/karakter Perempuan/avatar-smile.webp"),
  avatarFlat: () => import('../assets/karakter Perempuan/avatar-flat.webp"),
  avatarPolite: () => import('../assets/karakter Perempuan/avatar-polite-pose.webp"),
  avatarSmileWell: () => import('../assets/karakter Perempuan/avatar-smile-well.webp"),
  fullSayHi: () => import('../assets/karakter Perempuan/full-say-hi.webp"),
  fullBringBasket: () => import('../assets/karakter Perempuan/full-bring-basket-cloths.webp"),
  fullBringFolded: () => import('../assets/karakter Perempuan/full-bring-folded-cloth.webp"),
  fullIroning: () => import('../assets/karakter Perempuan/full-ironing.webp"),
  fullWithHanger: () => import('../assets/karakter Perempuan/full-cloth-with-hanger.webp"),
  fullWithSpray: () => import('../assets/karakter Perempuan/full-body-with-spray.webp"),
  fullFolding: () => import('../assets/karakter Perempuan/fullbody-folding-cloths.webp"),
  fullWithBag: () => import('../assets/karakter Perempuan/full-with-bag.webp"),
  fullWithTab: () => import('../assets/karakter Perempuan/full-with-tab.webp"),
  fullOkay: () => import('../assets/karakter Perempuan/full-okay.webp"),
  fullPolitePose: () => import('../assets/karakter Perempuan/full-polite-pose.webp"),
  halfBodySmile: () => import('../assets/karakter Perempuan/hafl-body-smile.webp"),
  halfBodySayHi: () => import('../assets/karakter Perempuan/half-body-say-hi.webp"),

  // Avatar set folder (role-based avatars)
  adminAvatar: () => import('../assets/Avatar set/admin.webp"),
  adminAvatar2: () => import('../assets/Avatar set/admin-2.webp"),
  adminAvatar3: () => import('../assets/Avatar set/admin3.webp"),
  adminLaptop: () => import('../assets/Avatar set/admin-laptop.webp"),
  customerFemale: () => import('../assets/Avatar set/customer-girl.webp"),
  customerFemale2: () => import('../assets/Avatar set/customer-girl-2.webp"),
  customerMale1: () => import('../assets/Avatar set/customer-male-1.webp"),
  customerMale2: () => import('../assets/Avatar set/customer-male-2.webp"),
  driver: () => import('../assets/Avatar set/driver.webp"),
  courier: () => import('../assets/Avatar set/courier.webp"),
  staffBoy: () => import('../assets/Avatar set/staff-boy.webp"),
  staffBoyThumbsUp: () => import('../assets/Avatar set/staff-boy-thumbs-up.webp"),

  // ─── Decorative Icons ────────────────────────────────────────────────
  bubble1: () => import('../assets/Decorative icon/bubble-1.webp"),
  bubble2: () => import('../assets/Decorative icon/bubble-2.webp"),
  soapBubble: () => import('../assets/Decorative icon/soap-bubble.webp"),
  sparkle: () => import('../assets/Decorative icon/sparkle.webp"),
  star: () => import('../assets/Decorative icon/star.webp"),
  waterDrop: () => import('../assets/Decorative icon/water-drop.webp"),
  wave: () => import('../assets/Decorative icon/wave.webp"),
  smoke: () => import('../assets/Decorative icon/smokeheat.webp"),
  ice: () => import('../assets/Decorative icon/ice.webp"),
  leaves: () => import('../assets/Decorative icon/leaves.webp"),
  barSoap: () => import('../assets/Decorative icon/bar-soap.webp"),
  splashWater: () => import('../assets/Decorative icon/splash-water.webp"),
  clothespin: () => import('../assets/Decorative icon/clothespin.webp"),
  flower: () => import('../assets/Decorative icon/flower.webp"),
  rainbow: () => import('../assets/Decorative icon/rainbow.webp"),
  shineBurst: () => import('../assets/Decorative icon/shine-burst.webp"),
  dotPattern: () => import('../assets/Decorative icon/dot-pattern.webp"),
  dashLine: () => import('../assets/Decorative icon/dashline.webp"),
  waveLine: () => import('../assets/Decorative icon/Wave-Line.webp"),
  confetti: () => import('../assets/Decorative icon/Confetti.webp"),

  // ─── Brand Assets ────────────────────────────────────────────────
  logo: () => import('../assets/images/waschen.webp"),
};

// ─── Emoji to Asset Key Mapping ─────────────────────────────────────────
// Maps common emojis to their corresponding asset keys
export const EMOJI_TO_ASSET = {
  // Status & badges
  '⚡': 'express',
  '✅': 'history',  // bisa pakai icon checkmark lain
  '❌': 'order',    // bisa pakai icon X lain
  '⚠️': 'notification',
  '🚨': 'notification',

  // Actions
  '➕': 'order',
  '➖': 'bag',
  '📋': 'order',
  '📝': 'order',
  '📌': 'tag',
  '🏷️': 'tag',

  // Communication
  '💬': 'chat',
  '📢': 'notification',
  '🔔': 'notification',

  // Transport & delivery
  '🚗': 'car',
  '🏍️': 'motorbike',
  '🛵': 'motorbike',
  '🚚': 'deliveryVan',
  '📦': 'bag',
  '🛍️': 'bag',

  // Laundry specific
  '🧺': 'laundry',
  '👕': 'foldedLaundry',
  '👔': 'iron',
  '🧴': 'bag',
  '🧽': 'soapBubble',
  '🫧': 'bubble1',

  // Location & time
  '📍': 'location',
  '🗺️': 'location',
  '🕐': 'schedule',
  '📅': 'schedule',

  // Money & payment
  '💰': 'wallet',
  '💳': 'wallet',
  '💵': 'wallet',

  // Quality & trust
  '✨': 'sparkle',
  '⭐': 'star',
  '🏅': 'guarantee',
  '🎖️': 'guarantee',

  // Eco & nature
  '🌿': 'eco',
  '🍃': 'leaves',
  '🌸': 'flower',
  '💐': 'flower',

  // People
  '👤': 'customerFemale',
  '👥': 'customerMale1',
  '👩‍💼': 'adminAvatar',
  '👨‍💼': 'adminAvatar3',
  '🧑‍💻': 'adminLaptop',
  '👨‍🔧': 'staffBoy',
  '🚴': 'driver',
};

// ─── Get Asset URL ────────────────────────────────────────────────────────
// Returns the URL for a given asset key
const assetCache = new Map();

export async function getAssetUrl(key) {
  if (!key) return null;

  // Check cache first
  if (assetCache.has(key)) {
    return assetCache.get(key);
  }

  // Check if it's a direct URL
  if (typeof key === 'string' && (key.startsWith('http') || key.startsWith('/') || key.startsWith('.'))) {
    return key;
  }

  // Try to get from ICON_ASSETS
  const loader = ICON_ASSETS[key];
  if (!loader) {
    console.warn(`[IconMap] No asset found for key: ${key}`);
    return null;
  }

  try {
    const module = await loader();
    const url = module.default;
    assetCache.set(key, url);
    return url;
  } catch (err) {
    console.error(`[IconMap] Failed to load asset ${key}:`, err);
    return null;
  }
}

// ─── Sync version for when you already know the key ─────────────────────
export function getAssetUrlSync(key) {
  if (!key) return null;
  if (assetCache.has(key)) return assetCache.get(key);

  // For static assets that are likely pre-loaded
  // Return the import path as a string for <img src>
  // Note: This won't work directly - use getAssetUrl() for dynamic loading
  return null;
}

// ─── Preload all assets ─────────────────────────────────────────────────
export async function preloadAllAssets() {
  const keys = Object.keys(ICON_ASSETS);
  const promises = keys.map(async (key) => {
    try {
      const module = await ICON_ASSETS[key]();
      assetCache.set(key, module.default);
    } catch (err) {
      console.warn(`[IconMap] Failed to preload ${key}:`, err);
    }
  });
  await Promise.all(promises);
  console.debug(`[IconMap] Preloaded ${assetCache.size} assets`);
}

// ─── Image Component ────────────────────────────────────────────────────
// React component that loads and displays an asset icon
import { useState, useEffect } from 'react';

export function AssetIcon({ name, emoji, size = 24, style = {}, className = '', alt = '' }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // First try emoji mapping
      let assetKey = name;
      if (emoji && !name) {
        assetKey = EMOJI_TO_ASSET[emoji];
      }

      if (!assetKey) {
        setLoading(false);
        return;
      }

      try {
        const url = await getAssetUrl(assetKey);
        if (!cancelled && url) {
          setSrc(url);
        }
      } catch (err) {
        console.warn(`[AssetIcon] Failed to load ${assetKey}:`, err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [name, emoji]);

  if (loading || !src) {
    // Fallback to emoji if asset not loaded yet
    return emoji ? (
      <span style={{ fontSize: size, display: 'inline-flex', ...style }} className={className}>
        {emoji}
      </span>
    ) : null;
  }

  return (
    <img
      src={src}
      alt={alt || name || emoji || ''}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
      className={className}
    />
  );
}

// ─── Export all asset keys for documentation ────────────────────────────
export const ASSET_KEYS = Object.keys(ICON_ASSETS);
