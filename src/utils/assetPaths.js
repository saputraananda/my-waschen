// ─────────────────────────────────────────────────────────────────────────────
// assetPaths.js — Centralized Asset Path Management
// Phase 8: Technical Debt & Optimization
// Provides consistent asset paths to prevent import inconsistencies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base path for public assets
 * In production, assets are served from / (root)
 * In development, also from / (via Vite)
 */
export const ASSET_BASE = '/asset';

/**
 * Avatar assets path
 */
export const AVATARS = {
  // Avatar Set
  admin: `${ASSET_BASE}/Avatar set/admin.png`,
  admin3: `${ASSET_BASE}/Avatar set/admin3.png`,
  customerGirl: `${ASSET_BASE}/Avatar set/customer-girl.png`,
  customerMale1: `${ASSET_BASE}/Avatar set/customer-male-1.png`,
  driver: `${ASSET_BASE}/Avatar set/driver.png`,

  // Character Avatars (Female)
  avatarSmile: `${ASSET_BASE}/karakter Perempuan/avatar-smile.png`,
  avatarFlat: `${ASSET_BASE}/karakter Perempuan/avatar-flat.png`,
  avatarPolitePose: `${ASSET_BASE}/karakter Perempuan/avatar-polite-pose.png`,
  avatarSmileWell: `${ASSET_BASE}/karakter Perempuan/avatar-smile-well.png`,
  fullPolitePose: `${ASSET_BASE}/karakter Perempuan/full-polite-pose.png`,
  halfBodySayHi: `${ASSET_BASE}/karakter Perempuan/half-body-say-hi.png`,
  fullSayHi: `${ASSET_BASE}/karakter Perempuan/full-say-hi.png`,
  fullBringBasket: `${ASSET_BASE}/karakter Perempuan/full-bring-basket-cloths.png`,
  fullFolded: `${ASSET_BASE}/karakter Perempuan/fullbody-folding-cloths.png`,
  fullIroning: `${ASSET_BASE}/karakter Perempuan/full-ironing.png`,
  fullClothWithHanger: `${ASSET_BASE}/karakter Perempuan/full-cloth-with-hanger.png`,
  fullOkay: `${ASSET_BASE}/karakter Perempuan/full-okay.png`,
  fullBodyWithSpray: `${ASSET_BASE}/karakter Perempuan/full-body-with-spray.png`,
  fullWithBag: `${ASSET_BASE}/karakter Perempuan/full-with-bag.png`,
};

/**
 * Icon assets path
 */
export const ICONS = {
  reception: `${ASSET_BASE}/Icon and Asset Laundry/2.png`,
  tag: `${ASSET_BASE}/Icon and Asset Laundry/3.png`,
  trolley: `${ASSET_BASE}/Icon and Asset Laundry/4.png`,
  iron: `${ASSET_BASE}/Icon and Asset Laundry/5.png`,
  bag: `${ASSET_BASE}/Icon and Asset Laundry/6.png`,
  delivery: `${ASSET_BASE}/Icon and Asset Laundry/7.png`,
  motorbike: `${ASSET_BASE}/Icon and Asset Laundry/8.png`,
  car: `${ASSET_BASE}/Icon and Asset Laundry/9.png`,
};

/**
 * Vehicle assets
 */
export const VEHICLES = {
  van: `${ASSET_BASE}/Icon and Asset Laundry/delivery.png`,
  scooter: `${ASSET_BASE}/Icon and Asset Laundry/pickup.png`,
};

/**
 * Decorative assets
 */
export const DECOR = {
  bubble1: `${ASSET_BASE}/Decorative icon/bubble-1.png`,
  sparkle: `${ASSET_BASE}/Decorative icon/sparkle.png`,
  flower: `${ASSET_BASE}/Decorative icon/flower.png`,
};

/**
 * Logo assets
 */
export const LOGOS = {
  waschen: `${ASSET_BASE}/images/waschen.png`,
};

/**
 * Helper to get any asset path
 * @param {string} path - Relative path within asset folder
 * @returns {string} Full asset path
 */
export const asset = (path) => {
  const normalizedPath = path.replace(/^\/asset\/?/, ''); // Remove leading /asset/
  return `${ASSET_BASE}/${normalizedPath}`;
};

/**
 * Lazy-load an image with fallback support
 * @param {string} src - Primary image source
 * @param {string} fallback - Fallback image source
 * @returns {string} src with onError handler for fallback
 */
export const withFallback = (src, fallback) => ({
  src,
  fallback,
  onError: (e) => {
    if (e.target.src !== fallback) {
      e.target.src = fallback;
    }
  },
});

/**
 * Preload critical assets for login page
 */
export const CRITICAL_ASSETS = [
  LOGOS.waschen,
  AVATARS.avatarSmile,
  AVATARS.fullBringBasket,
  DECOR.sparkle,
];

/**
 * Generate preload links for HTML head
 * Usage: <head dangerouslySetInnerHTML={{ __html: generatePreloadLinks() }} />
 */
export const generatePreloadLinks = () => {
  return CRITICAL_ASSETS.map(
    (href) => `<link rel="preload" as="image" href="${href}" />`
  ).join('\n');
};
