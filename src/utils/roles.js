/**
 * roles.js — Centralized role helpers.
 * Single source of truth for all role-based checks in the frontend.
 *
 * Usage:
 *   import { hasRole, isAdmin, isKasir, isProduksi, isFinance } from '../utils/roles';
 *   if (isAdmin(user)) { ... }
 */

// ── Role constants ─────────────────────────────────────────────────────────
export const ROLE_SUPERADMIN = 'superadmin';
export const ROLE_ADMIN      = 'admin';
export const ROLE_KASIR      = 'kasir';
export const ROLE_FINANCE    = 'finance';
export const ROLE_PRODUKSI   = 'produksi';
export const ROLE_DELIVERY   = 'delivery';
export const ROLE_OWNER      = 'owner';
export const ROLE_GA         = 'ga';
export const ROLE_DATA_ANALYST = 'data_analyst';

// ── Role groups ────────────────────────────────────────────────────────────
export const ADMIN_ROLES = new Set([ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_OWNER, ROLE_GA]);
export const FINANCE_ROLES = new Set([ROLE_FINANCE]);
export const PRODUKSI_ROLES = new Set([ROLE_PRODUKSI]);
export const KASIR_ROLES = new Set([ROLE_KASIR]);
export const DELIVERY_ROLES = new Set([ROLE_DELIVERY]);

/** All roles that can manage (CRUD) master data */
export const MANAGEMENT_ROLES = new Set([ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_OWNER]);

// ── Helper: resolve the effective role code from user object ────────────────
// Handles both `user.roleCode` and `user.role` for backward compat.
function resolveRole(user) {
  if (!user) return '';
  return (user.roleCode || user.role || '').toLowerCase().trim();
}

// ── Individual role checks ──────────────────────────────────────────────────

/** Check if user has a specific role code */
export function hasRole(user, ...roleCodes) {
  const r = resolveRole(user);
  return roleCodes.some(code => code.toLowerCase() === r);
}

/** Check if user belongs to any role in a Set */
export function hasAnyRole(user, roleSet) {
  const r = resolveRole(user);
  return roleSet.has(r);
}

export function isAdmin(user)       { return hasAnyRole(user, ADMIN_ROLES); }
export function isKasir(user)       { return hasRole(user, ROLE_KASIR); }
export function isFinance(user)     { return hasRole(user, ROLE_FINANCE); }
export function isProduksi(user)    { return hasRole(user, ROLE_PRODUKSI); }
export function isDelivery(user)    { return hasRole(user, ROLE_DELIVERY); }
export function isOwner(user)       { return hasRole(user, ROLE_OWNER); }
export function isSuperadmin(user)  { return hasRole(user, ROLE_SUPERADMIN); }
export function isGA(user)          { return hasRole(user, ROLE_GA); }
export function isDataAnalyst(user) { return hasRole(user, ROLE_DATA_ANALYST); }
export function isManagement(user)  { return hasAnyRole(user, MANAGEMENT_ROLES); }

/** Admin + finance + data analyst — akses modul laporan & analitik */
export function canAccessReports(user) {
  return isAdmin(user) || isFinance(user) || isDataAnalyst(user);
}

/**
 * Get the dashboard route for a user based on their role.
 * Returns the screen name string.
 */
export function getDashboardForRole(user) {
  const r = resolveRole(user);
  if (ADMIN_ROLES.has(r))       return 'admin_dashboard';
  if (r === ROLE_FINANCE)       return 'finance_dashboard';
  if (r === ROLE_PRODUKSI)      return 'produksi_dashboard';
  if (r === ROLE_DELIVERY)      return 'delivery_dashboard';
  return 'kasir_dashboard';
}

/**
 * Get human-readable role label.
 */
export function getRoleLabel(user) {
  const labels = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    kasir: 'Kasir',
    finance: 'Finance',
    produksi: 'Produksi',
    delivery: 'Delivery',
    owner: 'Owner',
    ga: 'GA',
    data_analyst: 'Data Analyst',
  };
  return labels[resolveRole(user)] || 'Unknown';
}
