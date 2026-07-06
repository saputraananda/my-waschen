// ─────────────────────────────────────────────────────────────────────────────
// CharacterAvatar — 3D character avatar from Asset folder
// Premium claymorphism display with purple/orange brand colors
// ─────────────────────────────────────────────────────────────────────────────
import { C } from '../utils/theme';

// Static imports for character avatars (from karakter Perempuan folder)
import avatarWaving from '../assets/karakter Perempuan/avatar-smile.webp'
import avatarBasket from '../assets/karakter Perempuan/full-bring-basket-cloths.webp'
import avatarFolded from '../assets/karakter Perempuan/fullbody-folding-cloths.webp'
import avatarIroning from '../assets/karakter Perempuan/full-ironing.webp'
import avatarHanging from '../assets/karakter Perempuan/full-cloth-with-hanger.webp'
import avatarThumbsup from '../assets/karakter Perempuan/full-okay.webp'
import avatarSpray from '../assets/karakter Perempuan/full-body-with-spray.webp'
import avatarBag from '../assets/karakter Perempuan/full-with-bag.webp'
import avatarVariant1 from '../assets/karakter Perempuan/avatar-flat.webp'
import avatarVariant2 from '../assets/karakter Perempuan/avatar-polite-pose.webp'
import avatarVariant3 from '../assets/karakter Perempuan/avatar-smile-well.webp'
import avatarVariant4 from '../assets/karakter Perempuan/full-polite-pose.webp'
import avatarVariant5 from '../assets/karakter Perempuan/half-body-say-hi.webp'
import avatarWaving2 from '../assets/karakter Perempuan/full-say-hi.webp'

// Avatar set imports (only files that exist)
import avatarSet1 from '../assets/Avatar set/admin.webp'
import avatarSet4 from '../assets/Avatar set/admin3.webp'
import avatarSet7 from '../assets/Avatar set/customer-girl.webp'
import avatarSet10 from '../assets/Avatar set/customer-male-1.webp'
import avatarSet13 from '../assets/Avatar set/driver.webp'

// Process icons
import iconReception from '../assets/Icon and Asset Laundry/2.webp'
import iconTag from '../assets/Icon and Asset Laundry/3.webp'
import iconTrolley from '../assets/Icon and Asset Laundry/4.webp'
import iconIron from '../assets/Icon and Asset Laundry/5.webp'
import iconBag from '../assets/Icon and Asset Laundry/6.webp'
import iconDelivery from '../assets/Icon and Asset Laundry/7.webp'
import iconMotorbike from '../assets/Icon and Asset Laundry/8.webp'
import iconCar from '../assets/Icon and Asset Laundry/9.webp'

// Delivery vehicles (use delivery.png and pickup.png)
import vehicleVan from '../assets/Icon and Asset Laundry/delivery.webp'
import vehicleScooter from '../assets/Icon and Asset Laundry/pickup.webp'

// Decorative icons (use existing files)
import decorBubble from '../assets/Decorative icon/bubble-1.webp'
import decorSparkle from '../assets/Decorative icon/sparkle.webp'
import decorFlower from '../assets/Decorative icon/flower.webp'

// Character avatar paths
const AVATAR_PATHS = {
  waving: avatarWaving,
  basket: avatarBasket,
  folded: avatarFolded,
  ironing: avatarIroning,
  hanging: avatarHanging,
  thumbsup: avatarThumbsup,
  spray: avatarSpray,
  bag: avatarBag,
  variant1: avatarVariant1,
  variant2: avatarVariant2,
  variant3: avatarVariant3,
  variant4: avatarVariant4,
  variant5: avatarVariant5,
  waving2: avatarWaving2,
  avatar1: avatarSet1,
  avatar4: avatarSet4,
  avatar7: avatarSet7,
  avatar10: avatarSet10,
  avatar13: avatarSet13,
  van: vehicleVan,
  scooter: vehicleScooter,
};

// Process icons
const ICON_PATHS = {
  reception: iconReception,
  tag: iconTag,
  trolley: iconTrolley,
  iron: iconIron,
  bag: iconBag,
  delivery: iconDelivery,
  motorbike: iconMotorbike,
  car: iconCar,
};

// Decorative icons
const DECORATIVE_PATHS = {
  bubble: decorBubble,
  sparkle: decorSparkle,
  flower: decorFlower,
};

/**
 * CharacterAvatar — Displays 3D character avatars with claymorphism styling
 *
 * @param {string} variant - Avatar variant key ('waving', 'basket', 'ironing', etc.)
 * @param {number} size - Size in pixels (default: 80)
 * @param {string} className - Additional CSS class
 * @param {object} style - Additional inline styles
 */
export function CharacterAvatar({ variant = 'waving', size = 80, className = '', style = {} }) {
  const src = AVATAR_PATHS[variant] || AVATAR_PATHS.waving;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(12, size * 0.2),
        overflow: 'hidden',
        boxShadow: `4px 4px 12px rgba(60, 10, 99, 0.15), -2px -2px 8px rgba(255, 255, 255, 0.8)`,
        background: 'linear-gradient(145deg, #F8F4FF, #EDE7F6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <img
        src={src}
        alt={`Character avatar - ${variant}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
}

/**
 * ProcessIcon — Displays laundry process icons
 *
 * @param {string} type - Icon type ('reception', 'tag', 'trolley', 'iron', etc.)
 * @param {number} size - Size in pixels (default: 48)
 * @param {boolean} claymorphism - Apply claymorphism styling (default: true)
 */
export function ProcessIcon({ type = 'reception', size = 48, claymorphism = true }) {
  const src = ICON_PATHS[type];

  if (!src) return null;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: claymorphism ? Math.max(10, size * 0.25) : 0,
        overflow: 'hidden',
        boxShadow: claymorphism
          ? `3px 3px 8px rgba(60, 10, 99, 0.12), -2px -2px 6px rgba(255, 255, 255, 0.9)`
          : 'none',
        background: claymorphism ? 'linear-gradient(145deg, #F8F4FF, #EDE7F6)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: claymorphism ? size * 0.15 : 0,
      }}
    >
      <img
        src={src}
        alt={type}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
}

/**
 * DeliveryVehicle — Displays delivery vehicle (van or scooter)
 *
 * @param {string} type - Vehicle type ('van', 'scooter')
 * @param {number} size - Size in pixels (default: 64)
 */
export function DeliveryVehicle({ type = 'van', size = 64 }) {
  const src = AVATAR_PATHS[type];

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: `4px 4px 12px rgba(60, 10, 99, 0.2), -2px -2px 8px rgba(255, 255, 255, 0.7)`,
        background: 'linear-gradient(145deg, #F8F4FF, #EDE7F6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
      }}
    >
      <img
        src={src}
        alt={type === 'van' ? 'Delivery van' : 'Delivery scooter'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
}

/**
 * DecorativeBubble — Animated bubble decoration
 *
 * @param {number} size - Size in pixels (default: 40)
 * @param {string} color - Bubble color tint (default: 'purple')
 */
export function DecorativeBubble({ size = 40, color = 'purple' }) {
  const colorMap = {
    purple: { bg: 'rgba(124, 58, 237, 0.1)', accent: '#7C3AED' },
    blue: { bg: 'rgba(59, 130, 246, 0.1)', accent: '#3B82F6' },
    orange: { bg: 'rgba(232, 93, 0, 0.1)', accent: '#E85D00' },
  };

  const colors = colorMap[color] || colorMap.purple;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <svg viewBox="0 0 32 32" width={size * 0.8} height={size * 0.8} fill={colors.accent} opacity="0.6">
        <circle cx="10" cy="14" r="6" />
        <circle cx="20" cy="10" r="5" />
        <circle cx="16" cy="22" r="4" />
      </svg>
    </div>
  );
}

/**
 * BrandBadge — Small branded badge with Waschen styling
 *
 * @param {string} text - Badge text
 * @param {string} variant - Badge variant ('primary', 'accent', 'success')
 */
export function BrandBadge({ text, variant = 'primary' }) {
  const variants = {
    primary: { bg: C.primary, color: 'white' },
    accent: { bg: C.accent, color: 'white' },
    success: { bg: C.success, color: 'white' },
    outline: { bg: 'transparent', color: C.primary, border: `1px solid ${C.primary}` },
  };

  const v = variants[variant] || variants.primary;

  return (
    <div
      style={{
        padding: '4px 12px',
        borderRadius: 20,
        background: v.bg,
        color: v.color,
        fontSize: 11,
        fontWeight: 600,
        fontFamily: 'Poppins, sans-serif',
        boxShadow: variant !== 'outline' ? `2px 2px 6px rgba(60, 10, 99, 0.2)` : 'none',
        border: v.border || 'none',
      }}
    >
      {text}
    </div>
  );
}

// Export all paths for direct use
export { AVATAR_PATHS, ICON_PATHS, DECORATIVE_PATHS };
