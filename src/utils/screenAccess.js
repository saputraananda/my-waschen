// Role-based screen access control
// Ensures screens are only accessible by authorized roles

// Role definitions
export const ROLES = {
  ADMIN: ['admin'],
  FRONTLINER: ['frontline'],
  PRODUKSI: ['produksi'],
};

// Helper to check if user has any of the allowed roles
export function hasAnyRole(user, allowedRoles) {
  if (!user) return false;
  const userRole = user.roleCode || user.role;
  return allowedRoles.some(role => role === userRole);
}

// Helper to check if user is admin
export function isAdminUser(user) {
  return hasAnyRole(user, ROLES.ADMIN);
}

// Helper to check if user is frontliner
export function isFrontlinerUser(user) {
  return hasAnyRole(user, ROLES.FRONTLINER);
}

// Helper to check if user is produksi
export function isProduksiUser(user) {
  return hasAnyRole(user, ROLES.PRODUKSI);
}

// Helper to check if user can view reports
export function canViewReports(user) {
  return isAdminUser(user);
}

// Screen access matrix - defines which roles can access which screens
export const SCREEN_ACCESS = {
  // Admin ONLY screens
  ADMIN_ONLY: [
    'manajemen_user',
    'manajemen_outlet',
    'manajemen_layanan',
    'admin_target',
    'admin_target_detail',
    'admin_period_close',
    'admin_segmentasi',
    'birthday',
    'error_dashboard',
    'admin_stok',
    'admin_inventory',
    'admin_promo',
    'admin_promo_sla',
    'approval',
  ],

  // Produksi ONLY screens
  PRODUKSI_ONLY: [
    'notifikasi_produksi',
    'detail_item_produksi',
    'foto_kondisi',
    'produksi_qr_scan',
  ],
};

// Check if screen is accessible by user role
export function canAccessScreen(screen, user) {
  if (!user) return false;

  const userRole = user.roleCode || user.role;

  // Check admin-only screens
  if (SCREEN_ACCESS.ADMIN_ONLY.includes(screen)) {
    return isAdminUser(user);
  }

  // Check produksi-only screens
  if (SCREEN_ACCESS.PRODUKSI_ONLY.includes(screen)) {
    return isProduksiUser(user);
  }

  // Default: allow access (shared screens like dashboard, profil, settings, kasir screens, etc.)
  return true;
}

// Get redirect screen for unauthorized access
export function getUnauthorizedRedirect(user) {
  if (!user) return 'login';

  if (isAdminUser(user)) return 'dashboard';
  if (isProduksiUser(user)) return 'dashboard';
  if (isFrontlinerUser(user)) return 'dashboard';

  return 'dashboard';
}
