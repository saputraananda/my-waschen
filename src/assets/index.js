// ─────────────────────────────────────────────────────────────────────────────
// assets/index.js — Centralized Asset Registry
// Phase 8: Technical Debt & Optimization
// Phase 45: Asset Loading Performance
//
// Features:
// - Lazy loading with dynamic imports
// - Asset preloading strategy
// - Image caching
// - Skeleton loading helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─── Avatars (Character Illustrations) ────────────────────────────────────────

// Staff Avatars - mapped to karakter Perempuan folder
export const staffAvatars = {
  wave: () => import('../assets/karakter Perempuan/avatar-smile.webp"),
  basket: () => import('../assets/karakter Perempuan/full-bring-basket-cloths.webp"),
  folding: () => import('../assets/karakter Perempuan/fullbody-folding-cloths.webp"),
  ironing: () => import('../assets/karakter Perempuan/full-ironing.webp"),
  hanging: () => import('../assets/karakter Perempuan/full-cloth-with-hanger.webp"),
  thumbsup: () => import('../assets/karakter Perempuan/full-okay.webp"),
  spray: () => import('../assets/karakter Perempuan/full-body-with-spray.webp"),
  bag: () => import('../assets/karakter Perempuan/full-with-bag.webp"),
  flat: () => import('../assets/karakter Perempuan/avatar-flat.webp"),
  polite: () => import('../assets/karakter Perempuan/avatar-polite-pose.webp"),
  smile: () => import('../assets/karakter Perempuan/avatar-smile-well.webp"),
  politeFull: () => import('../assets/karakter Perempuan/full-polite-pose.webp"),
  hiHalf: () => import('../assets/karakter Perempuan/half-body-say-hi.webp"),
  hiFull: () => import('../assets/karakter Perempuan/full-say-hi.webp"),
};

// Role-based avatars (Avatar set folder)
export const roleAvatars = {
  admin: () => import('../assets/Avatar set/admin.webp"),
  adminAlt: () => import('../assets/Avatar set/admin3.webp"),
  customerFemale: () => import('../assets/Avatar set/customer-girl.webp"),
  customerMale: () => import('../assets/Avatar set/customer-male-1.webp"),
  driver: () => import('../assets/Avatar set/driver.webp"),
};

// ─── Service Icons ─────────────────────────────────────────────────────────────

export const serviceIcons = {
  reception: () => import('../assets/Icon and Asset Laundry/2.webp"),
  tag: () => import('../assets/Icon and Asset Laundry/3.webp"),
  trolley: () => import('../assets/Icon and Asset Laundry/4.webp"),
  iron: () => import('../assets/Icon and Asset Laundry/5.webp"),
  bag: () => import('../assets/Icon and Asset Laundry/6.webp"),
  delivery: () => import('../assets/Icon and Asset Laundry/7.webp"),
  motorbike: () => import('../assets/Icon and Asset Laundry/8.webp"),
  car: () => import('../assets/Icon and Asset Laundry/9.webp"),
};

// ─── Vehicles ─────────────────────────────────────────────────────────────────

export const vehicles = {
  van: () => import('../assets/Icon and Asset Laundry/delivery.webp"),
  scooter: () => import('../assets/Icon and Asset Laundry/pickup.webp"),
};

// ─── Decorative ───────────────────────────────────────────────────────────────

export const decor = {
  bubble: () => import('../assets/Decorative icon/bubble-1.webp"),
  sparkle: () => import('../assets/Decorative icon/sparkle.webp"),
  flower: () => import('../assets/Decorative icon/flower.webp"),
};

// ─── Brand Assets ─────────────────────────────────────────────────────────────

export const brand = {
  logo: () => import('../assets/images/waschen.webp"),
};

// ─── Avatar Helper ────────────────────────────────────────────────────────────
// Returns the appropriate avatar based on type and variant

const avatarCache = new Map();

export const getAvatar = async (type, variant = 0) => {
  const cacheKey = `${type}-${variant}`;

  if (avatarCache.has(cacheKey)) {
    return avatarCache.get(cacheKey);
  }

  try {
    let avatar;

    switch (type) {
      case 'staff':
        const staffKeys = Object.keys(staffAvatars);
        avatar = staffKeys[variant % staffKeys.length];
        break;
      case 'admin':
        avatar = variant === 0 ? staffAvatars.admin : staffAvatars.adminAlt;
        break;
      case 'customer':
        avatar = variant === 0 ? staffAvatars.customerFemale : staffAvatars.customerMale;
        break;
      case 'driver':
        avatar = staffAvatars.driver;
        break;
      default:
        avatar = staffAvatars.flat;
    }

    const module = await avatar();
    const result = module.default;
    avatarCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[Asset] Failed to load avatar ${type}-${variant}:`, err);
    return null;
  }
};

// ─── Preload Avatars ─────────────────────────────────────────────────────────
// Preload critical avatars in idle time for faster subsequent loads

export const preloadAvatars = async () => {
  const criticalAvatars = [
    // Staff avatars for login page
    'staff-girl-say-hi.webp",
    // Admin avatars
    'admin.webp",
    'admin3.webp",
    // Customer avatars
    'customer-girl.webp",
    'customer-male-1.webp",
  ];

  // Preload all staff avatars
  const avatarPromises = Object.values(staffAvatars).map(a => a());
  const rolePromises = Object.values(roleAvatars).map(a => a());
  const decorPromises = Object.values(decor).map(a => a());
  const vehiclePromises = Object.values(vehicles).map(a => a());

  await Promise.all([
    ...avatarPromises,
    ...rolePromises,
    ...decorPromises,
    ...vehiclePromises,
  ]);

  console.debug('[Asset] Critical avatars preloaded');
};

// ─── Lazy Image Loader ────────────────────────────────────────────────────────
// Load image with promise-based loading and timeout handling

export const loadImage = (src, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const timer = setTimeout(() => {
      reject(new Error(`Image load timeout: ${src}`));
    }, timeout);

    img.onload = () => {
      clearTimeout(timer);
      resolve(img.src);
    };

    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Image load error: ${src}`));
    };

    img.src = src;
  });
};

// ─── Preload Single Image ─────────────────────────────────────────────────────

export const preloadImage = (src) => {
  if (typeof window === 'undefined') return Promise.resolve();

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.src);
    img.onerror = () => resolve(null); // Don't reject, just resolve with null
    img.src = src;
  });
};

// ─── Intersection Observer for Lazy Loading ───────────────────────────────────

let lazyLoadObserver = null;

export const getLazyLoadObserver = (callback) => {
  if (typeof window === 'undefined') return null;

  if (!lazyLoadObserver) {
    lazyLoadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback(entry.target);
            lazyLoadObserver.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '50px 0px', // Start loading 50px before visible
        threshold: 0.01,
      }
    );
  }

  return lazyLoadObserver;
};

// ─── Batch Preload Images ─────────────────────────────────────────────────────

export const preloadImages = async (urls, concurrency = 3) => {
  const results = [];
  const queue = [...urls];

  const worker = async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      try {
        await preloadImage(url);
        results.push({ url, success: true });
      } catch (err) {
        results.push({ url, success: false, error: err.message });
      }
    }
  };

  // Run workers with limited concurrency
  const workers = Array(Math.min(concurrency, urls.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
};

// ─── Cache Status ─────────────────────────────────────────────────────────────

export const getAvatarCacheSize = () => avatarCache.size;

export const clearAvatarCache = () => {
  avatarCache.clear();
  console.debug('[Asset] Avatar cache cleared');
};
