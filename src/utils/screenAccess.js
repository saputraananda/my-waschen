// Role-based screen access control
// Ensures screens are only accessible by authorized roles

// Role definitions
export const ROLES = {
  KASIR: ['kasir', 'frontline'],
  ADMIN: ['admin', 'superadmin'],
  FINANCE: ['finance'],
  PRODUKSI: ['produksi'],
  DELIVERY: ['delivery'],
  DATA_ANALYST: ['data_analyst'],
  OWNER: ['owner'],
};

// Helper to check if user has any of the allowed roles
export function hasAnyRole(user, allowedRoles) {
  if (!user) return false;
  const userRole = user.roleCode || user.role;
  return allowedRoles.some(role => role === userRole);
}

// Helper to check if user is cashier/frontline
export function isKasir(user) {
  return hasAnyRole(user, ROLES.KASIR);
}

// Helper to check if user is admin/superadmin
export function isAdminUser(user) {
  return hasAnyRole(user, [...ROLES.ADMIN, ...ROLES.OWNER]);
}

// Helper to check if user is finance
export function isFinanceUser(user) {
  return hasAnyRole(user, ROLES.FINANCE);
}

// Helper to check if user is produksi
export function isProduksiUser(user) {
  return hasAnyRole(user, ROLES.PRODUKSI);
}

// Helper to check if user is delivery
export function isDeliveryUser(user) {
  return hasAnyRole(user, ROLES.DELIVERY);
}

// Helper to check if user can view reports
export function canViewReports(user) {
  return isAdminUser(user) || isFinanceUser(user) || hasAnyRole(user, ROLES.DATA_ANALYST);
}

// Screen access matrix - defines which roles can access which screens
export const SCREEN_ACCESS = {
  // Kasir/Frontline ONLY screens
  KASIR_ONLY: [
    'customer',
    'tambah_customer',
    'detail_customer',
    'nota_step1',
    'nota_step2',
    'nota_step3',
    'nota_berhasil',
    'topup',
    'membership_register',
  ],

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

  // Admin & Finance screens
  ADMIN_FINANCE: [
    'kas_approval',
    'approval_pengadaan_barang',
    'admin_purchase_requests',
    'admin_all_outlet_stocks',
    'admin_settings',
    'admin_cash_deposit',
    'admin_refund',
    'setor_approval',
  ],

  // Finance ONLY screens
  FINANCE_ONLY: [
    'verifikasi_payment',
    'laporan_keuangan',
  ],

  // Produksi ONLY screens
  PRODUKSI_ONLY: [
    'notifikasi_produksi',
    'detail_item_produksi',
    'foto_kondisi',
    'produksi_qr_scan',
  ],

  // Delivery ONLY screens
  DELIVERY_ONLY: [
    'delivery_tasks',
    'delivery_history',
  ],
};

// Check if screen is accessible by user role
export function canAccessScreen(screen, user) {
  if (!user) return false;

  const userRole = user.roleCode || user.role;

  // Check kasir-only screens
  if (SCREEN_ACCESS.KASIR_ONLY.includes(screen)) {
    return isKasir(user);
  }

  // Check admin-only screens
  if (SCREEN_ACCESS.ADMIN_ONLY.includes(screen)) {
    return isAdminUser(user);
  }

  // Check admin & finance screens
  if (SCREEN_ACCESS.ADMIN_FINANCE.includes(screen)) {
    return isAdminUser(user) || isFinanceUser(user);
  }

  // Check finance-only screens
  if (SCREEN_ACCESS.FINANCE_ONLY.includes(screen)) {
    return isFinanceUser(user);
  }

  // Check produksi-only screens
  if (SCREEN_ACCESS.PRODUKSI_ONLY.includes(screen)) {
    return isProduksiUser(user);
  }

  // Check delivery-only screens
  if (SCREEN_ACCESS.DELIVERY_ONLY.includes(screen)) {
    return isDeliveryUser(user);
  }

  // Default: allow access (shared screens like dashboard, profil, settings, etc.)
  return true;
}

// Get redirect screen for unauthorized access
export function getUnauthorizedRedirect(user) {
  if (!user) return 'login';

  if (isAdminUser(user)) return 'dashboard';
  if (isFinanceUser(user)) return 'dashboard';
  if (isProduksiUser(user)) return 'dashboard';
  if (isDeliveryUser(user)) return 'dashboard';
  if (isKasir(user)) return 'dashboard';

  return 'dashboard';
}
