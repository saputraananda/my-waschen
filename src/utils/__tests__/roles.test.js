/**
 * Session 1 — Test: roles.js
 * Centralized role helpers — all pure functions, no DOM needed.
 * Role system: admin, frontline, produksi (3 roles only)
 */
import { describe, it, expect } from 'vitest';
import {
  hasRole, hasAnyRole,
  isAdmin, isFrontliner, isProduksi,
  getDashboardForRole, getRoleLabel,
  ADMIN_ROLES, FRONTLINER_ROLES, PRODUKSI_ROLES,
  ROLE_ADMIN, ROLE_FRONTLINER, ROLE_PRODUKSI,
  canApprove,
} from '../roles';

// ── Test fixtures ───────────────────────────────────────────────────────────
const u = (roleCode, role) => ({ roleCode, role });

// ── Role constants ──────────────────────────────────────────────────────────
describe('Role Constants', () => {
  it('exports ROLE_ADMIN', () => {
    expect(ROLE_ADMIN).toBe('admin');
  });

  it('exports ROLE_FRONTLINER', () => {
    expect(ROLE_FRONTLINER).toBe('frontline');
  });

  it('exports ROLE_PRODUKSI', () => {
    expect(ROLE_PRODUKSI).toBe('produksi');
  });

  it('ADMIN_ROLES contains only admin', () => {
    expect(ADMIN_ROLES).toEqual(new Set(['admin']));
  });

  it('FRONTLINER_ROLES contains only frontline', () => {
    expect(FRONTLINER_ROLES).toEqual(new Set(['frontline']));
  });

  it('PRODUKSI_ROLES contains only produksi', () => {
    expect(PRODUKSI_ROLES).toEqual(new Set(['produksi']));
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

  it('returns false for non-matching role', () => {
    expect(hasRole(u('frontline'), 'admin')).toBe(false);
  });

  it('returns false for null/undefined user', () => {
    expect(hasRole(null, 'admin')).toBe(false);
    expect(hasRole(undefined, 'admin')).toBe(false);
  });

  it('handles empty role gracefully', () => {
    expect(hasRole(u('', ''), 'admin')).toBe(false);
  });

  it('is case-insensitive (roles are lowercase internally)', () => {
    expect(hasRole(u('Admin'), 'admin')).toBe(true);
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

  it('returns false for frontline in ADMIN_ROLES', () => {
    expect(hasAnyRole(u('frontline'), ADMIN_ROLES)).toBe(false);
  });

  it('returns false for null user', () => {
    expect(hasAnyRole(null, ADMIN_ROLES)).toBe(false);
  });
});

// ── Individual role checks ──────────────────────────────────────────────────
describe('isAdmin()', () => {
  it('returns true for admin', () => expect(isAdmin(u('admin'))).toBe(true));
  it('returns false for frontline', () => expect(isAdmin(u('frontline'))).toBe(false));
  it('returns false for produksi', () => expect(isAdmin(u('produksi'))).toBe(false));
  it('returns false for null', () => expect(isAdmin(null)).toBe(false));
});

describe('isFrontliner()', () => {
  it('returns true for frontline', () => expect(isFrontliner(u('frontline'))).toBe(true));
  it('returns false for admin', () => expect(isFrontliner(u('admin'))).toBe(false));
  it('returns false for produksi', () => expect(isFrontliner(u('produksi'))).toBe(false));
});

describe('isProduksi()', () => {
  it('returns true for produksi', () => expect(isProduksi(u('produksi'))).toBe(true));
  it('returns false for frontline', () => expect(isProduksi(u('frontline'))).toBe(false));
  it('returns false for admin', () => expect(isProduksi(u('admin'))).toBe(false));
});

// ── canApprove ─────────────────────────────────────────────────────────────
describe('canApprove()', () => {
  it('returns true for admin', () => expect(canApprove(u('admin'))).toBe(true));
  it('returns true for frontline', () => expect(canApprove(u('frontline'))).toBe(true));
  it('returns false for produksi', () => expect(canApprove(u('produksi'))).toBe(false));
});

// ── getDashboardForRole ─────────────────────────────────────────────────────
describe('getDashboardForRole()', () => {
  it('returns admin_dashboard for admin', () => {
    expect(getDashboardForRole(u('admin'))).toBe('admin_dashboard');
  });

  it('returns produksi_dashboard for produksi', () => {
    expect(getDashboardForRole(u('produksi'))).toBe('produksi_dashboard');
  });

  it('returns kasir_dashboard for frontline (default)', () => {
    expect(getDashboardForRole(u('frontline'))).toBe('kasir_dashboard');
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
  it('returns "Frontliner" for frontline', () => expect(getRoleLabel(u('frontline'))).toBe('Frontliner'));
  it('returns "Produksi" for produksi', () => expect(getRoleLabel(u('produksi'))).toBe('Produksi'));
  it('returns "Unknown" for unknown', () => expect(getRoleLabel(u('xyz'))).toBe('Unknown'));
  it('returns "Unknown" for null', () => expect(getRoleLabel(null)).toBe('Unknown'));
});

// ── Backward compat: roleCode preferred over role ───────────────────────────
describe('Backward compatibility', () => {
  it('prefers roleCode over role when both present', () => {
    expect(isAdmin(u('admin', 'frontline'))).toBe(true);
  });

  it('falls back to role when roleCode is null', () => {
    expect(isAdmin(u(null, 'admin'))).toBe(true);
  });

  it('handles legacy user objects with only role field', () => {
    expect(isFrontliner({ role: 'frontline' })).toBe(true);
  });
});
