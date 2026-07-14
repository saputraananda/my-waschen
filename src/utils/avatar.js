// ─────────────────────────────────────────────────────────────────────────────
// avatar.js — Centralized Avatar Selection by Gender
// Phase 8: Technical Debt & Optimization
//
// Rules:
// - Customer: Laki-laki → customer-male-1.webp, Perempuan → customer-girl.webp
// - Staff/Frontliner/Produksi: Laki-laki → staff-boy.webp, Perempuan → staff-girl.webp
// - Admin: admin-laptop.webp (fixed)
// - Delivery: staff-boy-thumbs-up.webp (fixed)
// ─────────────────────────────────────────────────────────────────────────────

import staffGirl from '../assets/Avatar set/staff-girl.webp';
import staffBoy from '../assets/Avatar set/staff-boy.webp';
import customerGirl from '../assets/Avatar set/customer-girl.webp';
import customerMale from '../assets/Avatar set/customer-male-1.webp';
import adminLaptop from '../assets/Avatar set/admin-laptop.webp';
import staffBoyThumbsUp from '../assets/Avatar set/staff-boy-thumbs-up.webp';

/**
 * Get avatar source based on user type and gender
 *
 * @param {object} user - User object with roleCode, gender, or type properties
 * @param {string} typeOverride - Override type: 'customer' | 'staff' | 'admin' | 'delivery'
 * @returns {string} - Image import reference
 */
export const getAvatarSource = (user, typeOverride = null) => {
  if (!user) return staffGirl;

  const role = user.roleCode || user.originalRoleCode || user.role;
  const gender = (user.gender || '').toLowerCase();
  const type = typeOverride || user.type;

  // Determine type
  let avatarType = type;

  // Auto-detect type from role if not explicitly set
  if (!avatarType) {
    if (role === 'admin') {
      avatarType = 'admin';
    } else if (role === 'frontline' || role === 'kasir' || role === 'finance') {
      avatarType = 'staff';
    } else if (role === 'delivery') {
      avatarType = 'delivery';
    } else if (role === 'produksi') {
      avatarType = 'staff'; // Produksi uses staff avatar
    } else {
      avatarType = 'staff'; // Default to staff
    }
  }

  // Return appropriate avatar
  switch (avatarType) {
    case 'admin':
      return adminLaptop;

    case 'delivery':
      return staffBoyThumbsUp; // Delivery uses thumbs-up variant

    case 'customer':
      // Customer avatars based on gender
      return gender === 'male' ? customerMale : customerGirl;

    case 'staff':
    default:
      // Staff avatars based on gender
      return gender === 'male' ? staffBoy : staffGirl;
  }
};

/**
 * Get initials from name
 * @param {string} name - User's name
 * @returns {string} - Initials (max 2 characters)
 */
export const getInitials = (name) => {
  if (!name) return 'US';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

/**
 * Avatar configuration for different contexts
 */
export const AVATAR_CONFIG = {
  customer: {
    male: customerMale,
    female: customerGirl,
    default: customerGirl,
  },
  staff: {
    male: staffBoy,
    female: staffGirl,
    default: staffGirl,
  },
  admin: {
    male: adminLaptop,
    female: adminLaptop,
    default: adminLaptop,
  },
  delivery: {
    male: staffBoyThumbsUp,
    female: staffBoyThumbsUp,
    default: staffBoyThumbsUp,
  },
};

/**
 * Get avatar from config by type and gender
 * @param {string} type - Avatar type: 'customer' | 'staff' | 'admin' | 'delivery'
 * @param {string} gender - Gender: 'male' | 'female'
 * @returns {string} - Image import reference
 */
export const getAvatarFromConfig = (type, gender) => {
  const config = AVATAR_CONFIG[type] || AVATAR_CONFIG.staff;
  const normalizedGender = gender?.toLowerCase();

  if (normalizedGender === 'male') return config.male;
  if (normalizedGender === 'female') return config.female;
  return config.default;
};

// Export all avatar assets for direct use
export const AVATARS = {
  staffGirl,
  staffBoy,
  customerGirl,
  customerMale,
  adminLaptop,
  staffBoyThumbsUp,
};
