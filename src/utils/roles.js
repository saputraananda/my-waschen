/**
 * roles.js — Centralized role helpers.
 * Simple role system: Admin, Frontline, Produksi
 */

// ── Role constants ─────────────────────────────────────────────────────────
export const ROLE_ADMIN    = 'admin';
export const ROLE_FRONTLINER = 'frontline';
export const ROLE_PRODUKSI = 'produksi';
export const ROLE_FINANCE = 'finance';
export const ROLE_DELIVERY = 'courier';
export const ROLE_DATAANALYST = 'data_analyst';

// ── Role groups ────────────────────────────────────────────────────────────
export const ADMIN_ROLES = new Set([ROLE_ADMIN]);
export const FRONTLINER_ROLES = new Set([ROLE_FRONTLINER]);
export const PRODUKSI_ROLES = new Set([ROLE_PRODUKSI]);
export const FINANCE_ROLES = new Set([ROLE_FINANCE]);

// ── Helper: resolve the effective role code from user object ────────────────
function resolveRole(user) {
  if (!user) return '';
  return (user.roleCode || user.role || '').toLowerCase().trim();
}

// ── Individual role checks ──────────────────────────────────────────────────

export function hasRole(user, roleCode) {
  const r = resolveRole(user);
  return r === roleCode.toLowerCase();
}

export function hasAnyRole(user, roleSet) {
  const r = resolveRole(user);
  return roleSet.has(r);
}

export function isAdmin(user)      { return hasRole(user, ROLE_ADMIN); }
export function isFrontliner(user) { return hasAnyRole(user, FRONTLINER_ROLES); }
export function isProduksi(user)   { return hasAnyRole(user, PRODUKSI_ROLES); }
export function isFinance(user) { return hasRole(user, ROLE_FINANCE); }
export function isDelivery(user) { return hasRole(user, ROLE_DELIVERY); }
export function isDataAnalyst(user) { return hasRole(user, ROLE_DATAANALYST); }

/** Admin + Frontliner bisa approve */
export function canApprove(user) {
  return isAdmin(user) || isFrontliner(user);
}

/** Get human-readable role label */
export function getRoleLabel(user) {
  const labels = {
    admin: 'Admin',
    frontline: 'Frontliner',
    produksi: 'Produksi',
  };
  return labels[resolveRole(user)] || 'Unknown';
}

/** Get dashboard for role */
export function getDashboardForRole(user) {
  const r = resolveRole(user);
  if (r === ROLE_ADMIN) return 'admin_dashboard';
  if (r === ROLE_PRODUKSI) return 'produksi_dashboard';
  return 'kasir_dashboard'; // frontline uses kasir dashboard
}
