// ─────────────────────────────────────────────────────────────────────────────
// productionRolePermission.js — Production Role Permission Helpers
// Phase 5: Dual Role System for Production Team
// Task 29.1: Create role-based permissions for production
// ─────────────────────────────────────────────────────────────────────────────
// Role A (Packing Updates): Can update production_status only
// Role B (Inventory Checking): Can view stock, cannot create purchase requests
// ─────────────────────────────────────────────────────────────────────────────

// Production role constants
export const PRODUCTION_ROLES = {
  PACKING_ONLY: 'packing_only',    // Role A - can update status
  INVENTORY_CHECK: 'inventory_check', // Role B - read-only stock
};

// Check if user has packing role (can update production status)
export function canUpdateProductionStatus(user) {
  if (!user) return false;

  // Admin always has access
  if (['admin', 'superadmin'].includes(user.roleCode)) return true;

  // Check user-level override first
  if (user.productionPicRole === PRODUCTION_ROLES.PACKING_ONLY) return true;

  // Check role-level default
  if (user.productionRole === PRODUCTION_ROLES.PACKING_ONLY) return true;

  return false;
}

// Check if user has inventory check role (read-only)
export function canCheckInventory(user) {
  if (!user) return false;

  // Admin always has access
  if (['admin', 'superadmin'].includes(user.roleCode)) return true;

  // Both roles can view inventory
  if (user.productionPicRole === PRODUCTION_ROLES.PACKING_ONLY) return true;
  if (user.productionPicRole === PRODUCTION_ROLES.INVENTORY_CHECK) return true;

  if (user.productionRole === PRODUCTION_ROLES.PACKING_ONLY) return true;
  if (user.productionRole === PRODUCTION_ROLES.INVENTORY_CHECK) return true;

  // Default: check if role is produksi
  if (user.roleCode === 'produksi') return true;

  return false;
}

// Check if user can create purchase requests
export function canCreatePurchaseRequest(user) {
  if (!user) return false;

  // Admin always has access
  if (['admin', 'superadmin'].includes(user.roleCode)) return true;

  // Frontliner always can create
  if (['kasir', 'frontline'].includes(user.roleCode)) return true;

  // Production role B cannot create
  if (user.productionPicRole === PRODUCTION_ROLES.INVENTORY_CHECK) return false;
  if (user.productionRole === PRODUCTION_ROLES.INVENTORY_CHECK) return false;

  // Role A (packing) can create purchase requests
  if (user.productionPicRole === PRODUCTION_ROLES.PACKING_ONLY) return true;
  if (user.productionRole === PRODUCTION_ROLES.PACKING_ONLY) return true;

  return false;
}

// Check if user can send low-stock alert
export function canSendLowStockAlert(user) {
  if (!user) return false;

  // Admin always has access
  if (['admin', 'superadmin'].includes(user.roleCode)) return true;

  // Both production roles can send alerts
  if (user.productionPicRole) return true;
  if (user.productionRole) return true;

  // Produksi role can send alerts
  if (user.roleCode === 'produksi') return true;

  return false;
}

// Get production role display info
export function getProductionRoleInfo(user) {
  const role = user?.productionPicRole || user?.productionRole;

  if (role === PRODUCTION_ROLES.PACKING_ONLY) {
    return {
      code: 'packing_only',
      name: 'Role A: Packing Updates',
      description: 'Can update production status',
      canUpdateStatus: true,
      canCheckInventory: true,
      canCreatePurchaseRequest: false,
      canSendAlert: true,
    };
  }

  if (role === PRODUCTION_ROLES.INVENTORY_CHECK) {
    return {
      code: 'inventory_check',
      name: 'Role B: Inventory Checking',
      description: 'Can view stock and send alerts',
      canUpdateStatus: false,
      canCheckInventory: true,
      canCreatePurchaseRequest: false,
      canSendAlert: true,
    };
  }

  // Default or non-production role
  return {
    code: null,
    name: 'Full Access',
    description: 'All production permissions',
    canUpdateStatus: true,
    canCheckInventory: true,
    canCreatePurchaseRequest: true,
    canSendAlert: true,
  };
}

// Middleware helper for production status update
export function requireProductionStatusPermission(req, res, next) {
  if (canUpdateProductionStatus(req.user)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Anda tidak memiliki akses untuk update status produksi. Hubungi admin.',
  });
}

// Middleware helper for inventory check
export function requireInventoryCheckPermission(req, res, next) {
  if (canCheckInventory(req.user)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Anda tidak memiliki akses untuk melihat inventory. Hubungi admin.',
  });
}

// Middleware helper for purchase request creation
export function requirePurchaseRequestPermission(req, res, next) {
  if (canCreatePurchaseRequest(req.user)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Hanya frontliner yang dapat membuat pengajuan pembelian. Hubungi admin.',
  });
}
