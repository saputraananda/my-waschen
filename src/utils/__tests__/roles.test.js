/**
 * Session 1 — Test: roles.js
 * Centralized role helpers — all pure functions, no DOM needed.
 */
import { describe, it, expect } from 'vitest';
import {
  hasRole, hasAnyRole,
  isAdmin, isKasir, isFinance, isProduksi, isDelivery,
  isOwner, isSuperadmin, isGA, isDataAnalyst, isManagement, canAccessReports,
  getDashboardForRole, getRoleLabel,
  ADMIN_ROLES, FINANCE_ROLES, MANAGEMENT_ROLES,
  ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_KASIR, ROLE_FINANCE,
  ROLE_PRODUKSI, ROLE_DELIVERY, ROLE_OWNER, ROLE_GA, ROLE_DATA_ANALYST,
} from '../roles';

// ── Test fixtures ───────────────────────────────────────────────────────────
const u = (roleCode, role) => ({ roleCode, role });

// ── Role constants ──────────────────────────────────────────────────────────
describe('Role Constants', () => {
  it('exports all expected role constants', () => {
    expect(ROLE_SUPERADMIN).toBe('superadmin');
    expect(ROLE_ADMIN).toBe('admin');
    expect(ROLE_KASIR).toBe('kasir');
    expect(ROLE_FINANCE).toBe('finance');
    expect(ROLE_PRODUKSI).toBe('produksi');
    expect(ROLE_DELIVERY).toBe('delivery');
    expect(ROLE_OWNER).toBe('owner');
    expect(ROLE_GA).toBe('ga');
    expect(ROLE_DATA_ANALYST).toBe('data_analyst');
  });

  it('ADMIN_ROLES contains superadmin, admin, owner, ga', () => {
    expect(ADMIN_ROLES).toEqual(new Set(['superadmin', 'admin', 'owner', 'ga']));
  });

  it('MANAGEMENT_ROLES contains superadmin, admin, owner', () => {
    expect(MANAGEMENT_ROLES).toEqual(new Set(['superadmin', 'admin', 'owner']));
  });
});

// ── hasRole ─────────────────────────────────────────────────────────────────
describe('hasRole()', () => {
  it('matches when roleCode matches', () => {
    expect(hasRole(u('admin'), 'admin')).toBe(true);
  });

  it('matches when role matches (fallback)', () => {
    expect(hasRole(u(null, 'admin'), 'admin')).toBe(true);
  });

  it('matches one of multiple codes', () => {
    expect(hasRole(u('admin'), 'kasir', 'admin')).toBe(true);
  });

  it('returns false for non-matching role', () => {
    expect(hasRole(u('kasir'), 'admin')).toBe(false);
  });

  it('returns false for null/undefined user', () => {
    expect(hasRole(null, 'admin')).toBe(false);
    expect(hasRole(undefined, 'admin')).toBe(false);
  });

  it('handles empty role gracefully', () => {
    expect(hasRole(u('', ''), 'admin')).toBe(false);
  });

  it('is case-sensitive (roles are lowercase)', () => {
    expect(hasRole(u('Admin'), 'admin')).toBe(true); // lowercased internally
  });

  it('handles whitespace in roleCode', () => {
    expect(hasRole(u(' admin '), 'admin')).toBe(true);
  });
});

// ── hasAnyRole ──────────────────────────────────────────────────────────────
describe('hasAnyRole()', () => {
  it('returns true when user is in the set', () => {
    expect(hasAnyRole(u('admin'), ADMIN_ROLES)).toBe(true);
  });

  it('returns true for superadmin in ADMIN_ROLES', () => {
    expect(hasAnyRole(u('superadmin'), ADMIN_ROLES)).toBe(true);
  });

  it('returns false for kasir in ADMIN_ROLES', () => {
    expect(hasAnyRole(u('kasir'), ADMIN_ROLES)).toBe(false);
  });

  it('returns false for null user', () => {
    expect(hasAnyRole(null, ADMIN_ROLES)).toBe(false);
  });
});

// ── Individual role checks ──────────────────────────────────────────────────
describe('isAdmin()', () => {
  it('returns true for admin', () => expect(isAdmin(u('admin'))).toBe(true));
  it('returns true for superadmin', () => expect(isAdmin(u('superadmin'))).toBe(true));
  it('returns true for owner', () => expect(isAdmin(u('owner'))).toBe(true));
  it('returns true for ga', () => expect(isAdmin(u('ga'))).toBe(true));
  it('returns false for kasir', () => expect(isAdmin(u('kasir'))).toBe(false));
  it('returns false for finance', () => expect(isAdmin(u('finance'))).toBe(false));
  it('returns false for null', () => expect(isAdmin(null)).toBe(false));
});

describe('isKasir()', () => {
  it('returns true for kasir', () => expect(isKasir(u('kasir'))).toBe(true));
  it('returns false for admin', () => expect(isKasir(u('admin'))).toBe(false));
});

describe('isFinance()', () => {
  it('returns true for finance', () => expect(isFinance(u('finance'))).toBe(true));
  it('returns false for admin', () => expect(isFinance(u('admin'))).toBe(false));
});

describe('canAccessReports()', () => {
  it('returns true for admin', () => expect(canAccessReports(u('admin'))).toBe(true));
  it('returns true for finance', () => expect(canAccessReports(u('finance'))).toBe(true));
  it('returns true for data_analyst', () => expect(canAccessReports(u('data_analyst'))).toBe(true));
  it('returns false for kasir', () => expect(canAccessReports(u('kasir'))).toBe(false));
});

describe('isProduksi()', () => {
  it('returns true for produksi', () => expect(isProduksi(u('produksi'))).toBe(true));
  it('returns false for kasir', () => expect(isProduksi(u('kasir'))).toBe(false));
});

describe('isDelivery()', () => {
  it('returns true for delivery', () => expect(isDelivery(u('delivery'))).toBe(true));
  it('returns false for kasir', () => expect(isDelivery(u('kasir'))).toBe(false));
});

describe('isOwner()', () => {
  it('returns true for owner', () => expect(isOwner(u('owner'))).toBe(true));
  it('returns false for admin', () => expect(isOwner(u('admin'))).toBe(false));
});

describe('isSuperadmin()', () => {
  it('returns true for superadmin', () => expect(isSuperadmin(u('superadmin'))).toBe(true));
  it('returns false for admin', () => expect(isSuperadmin(u('admin'))).toBe(false));
});

describe('isGA()', () => {
  it('returns true for ga', () => expect(isGA(u('ga'))).toBe(true));
  it('returns false for admin', () => expect(isGA(u('admin'))).toBe(false));
});

describe('isDataAnalyst()', () => {
  it('returns true for data_analyst', () => expect(isDataAnalyst(u('data_analyst'))).toBe(true));
  it('returns false for kasir', () => expect(isDataAnalyst(u('kasir'))).toBe(false));
});

describe('isManagement()', () => {
  it('returns true for admin', () => expect(isManagement(u('admin'))).toBe(true));
  it('returns true for superadmin', () => expect(isManagement(u('superadmin'))).toBe(true));
  it('returns true for owner', () => expect(isManagement(u('owner'))).toBe(true));
  it('returns false for kasir', () => expect(isManagement(u('kasir'))).toBe(false));
  it('returns false for ga', () => expect(isManagement(u('ga'))).toBe(false));
});

// ── getDashboardForRole ─────────────────────────────────────────────────────
describe('getDashboardForRole()', () => {
  it('returns admin_dashboard for admin', () => {
    expect(getDashboardForRole(u('admin'))).toBe('admin_dashboard');
  });
  it('returns admin_dashboard for superadmin', () => {
    expect(getDashboardForRole(u('superadmin'))).toBe('admin_dashboard');
  });
  it('returns admin_dashboard for owner', () => {
    expect(getDashboardForRole(u('owner'))).toBe('admin_dashboard');
  });
  it('returns finance_dashboard for finance', () => {
    expect(getDashboardForRole(u('finance'))).toBe('finance_dashboard');
  });
  it('returns produksi_dashboard for produksi', () => {
    expect(getDashboardForRole(u('produksi'))).toBe('produksi_dashboard');
  });
  it('returns delivery_dashboard for delivery', () => {
    expect(getDashboardForRole(u('delivery'))).toBe('delivery_dashboard');
  });
  it('returns kasir_dashboard for kasir (default)', () => {
    expect(getDashboardForRole(u('kasir'))).toBe('kasir_dashboard');
  });
  it('returns kasir_dashboard for unknown role', () => {
    expect(getDashboardForRole(u('xyz'))).toBe('kasir_dashboard');
  });
  it('returns kasir_dashboard for null user', () => {
    expect(getDashboardForRole(null)).toBe('kasir_dashboard');
  });
});

// ── getRoleLabel ────────────────────────────────────────────────────────────
describe('getRoleLabel()', () => {
  it('returns "Admin" for admin', () => expect(getRoleLabel(u('admin'))).toBe('Admin'));
  it('returns "Kasir" for kasir', () => expect(getRoleLabel(u('kasir'))).toBe('Kasir'));
  it('returns "Finance" for finance', () => expect(getRoleLabel(u('finance'))).toBe('Finance'));
  it('returns "Produksi" for produksi', () => expect(getRoleLabel(u('produksi'))).toBe('Produksi'));
  it('returns "Delivery" for delivery', () => expect(getRoleLabel(u('delivery'))).toBe('Delivery'));
  it('returns "Owner" for owner', () => expect(getRoleLabel(u('owner'))).toBe('Owner'));
  it('returns "GA" for ga', () => expect(getRoleLabel(u('ga'))).toBe('GA'));
  it('returns "Data Analyst" for data_analyst', () => expect(getRoleLabel(u('data_analyst'))).toBe('Data Analyst'));
  it('returns "Super Admin" for superadmin', () => expect(getRoleLabel(u('superadmin'))).toBe('Super Admin'));
  it('returns "Unknown" for unknown', () => expect(getRoleLabel(u('xyz'))).toBe('Unknown'));
  it('returns "Unknown" for null', () => expect(getRoleLabel(null)).toBe('Unknown'));
});

// ── Backward compat: roleCode preferred over role ───────────────────────────
describe('Backward compatibility', () => {
  it('prefers roleCode over role when both present', () => {
    expect(isAdmin(u('admin', 'kasir'))).toBe(true);
  });

  it('falls back to role when roleCode is null', () => {
    expect(isAdmin(u(null, 'admin'))).toBe(true);
  });

  it('handles legacy user objects with only role field', () => {
    expect(isKasir({ role: 'kasir' })).toBe(true);
  });
});
