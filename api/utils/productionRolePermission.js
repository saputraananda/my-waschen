// ─────────────────────────────────────────────────────────────────────────────
// productionRolePermission.js — Production Role Permission Helpers
// Simple role system: admin, frontline, produksi
// ─────────────────────────────────────────────────────────────────────────────

// Roles that can update production status
export const PRODUCTION_ROLES = ['admin', 'frontline', 'produksi'];

// Check if user has packing role (can update production status)
export function canUpdateProductionStatus(user) {
  if (!user) return false;

  // Admin always has access
  if (user.roleCode === 'admin') return true;

  // Produksi can update status
  if (user.roleCode === 'produksi') return true;

  // Frontliner can update
  if (user.roleCode === 'frontline') return true;

  return false;
}

// Check if user has inventory check role (read-only)
export function canCheckInventory(user) {
  if (!user) return false;

  // Admin always has access
  if (user.roleCode === 'admin') return true;

  // Semua role bisa check inventory
  return true;
}

// Check if user can create purchase requests
export function canCreatePurchaseRequest(user) {
  if (!user) return false;

  // Admin always has access
  if (user.roleCode === 'admin') return true;

  // Frontliner always can create
  if (user.roleCode === 'frontline') return true;

  return false;
}

// Check if user can send low-stock alert
export function canSendLowStockAlert(user) {
  if (!user) return false;

  // Admin always has access
  if (user.roleCode === 'admin') return true;

  // Produksi can send alerts
  if (user.roleCode === 'produksi') return true;

  return false;
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
    message: 'Hanya frontline yang dapat membuat pengajuan pembelian. Hubungi admin.',
  });
}
