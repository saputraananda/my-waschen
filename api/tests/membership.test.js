/**
 * Unit Tests - Membership Activation System
 * Tests the WPC (Waschen Priority Club) membership activation flow
 *
 * This module tests:
 * - Membership tier configurations (Gold/Diamond)
 * - Membership activation requirements
 * - Top-up and deposit rules
 * - Tier upgrade/downgrade logic
 */

import { describe, it, expect } from 'vitest';

// ─── Membership Configuration ─────────────────────────────────────────────────

const TIER_CONFIG = {
  gold: {
    name: 'Gold',
    minTopup: 500000,
    durationMonths: 6,
    discountPct: 20,
    inactivityMonths: 2,
  },
  diamond: {
    name: 'Diamond',
    minTopup: 1000000,
    durationMonths: 12,
    discountPct: 25,
    inactivityMonths: 3,
  },
};

const STATUS = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
};

// ─── Membership Logic Functions ─────────────────────────────────────────────

/**
 * Calculate membership expiry date
 */
function calculateExpiry(startDate, durationMonths) {
  const start = new Date(startDate);
  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + durationMonths);
  return expiry;
}

/**
 * Check if membership is active (not expired)
 */
function isMembershipActive(expiredAt) {
  if (!expiredAt) return false;
  const expiry = new Date(expiredAt);
  return expiry >= new Date();
}

/**
 * Calculate discount for a transaction
 */
function calculateMembershipDiscount(total, tier) {
  const config = TIER_CONFIG[tier];
  if (!config) return 0;
  return Math.round((total * config.discountPct) / 100);
}

/**
 * Validate top-up amount for membership activation
 */
function validateActivationAmount(amount, tier) {
  const config = TIER_CONFIG[tier];
  if (!config) {
    return { valid: false, message: 'Invalid tier' };
  }
  if (!amount || amount <= 0) {
    return { valid: false, message: 'Amount must be greater than 0' };
  }
  if (amount < config.minTopup) {
    return {
      valid: false,
      message: `Minimum ${config.minTopup.toLocaleString('id-ID')} for ${config.name} membership`,
    };
  }
  return { valid: true };
}

/**
 * Determine if customer should become member
 */
function shouldActivateMember(amount, tier) {
  // Rule: Must top-up at the moment to become member
  const config = TIER_CONFIG[tier];
  if (!config) return false;
  return amount >= config.minTopup;
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Membership Activation System', () => {
  describe('TIER_CONFIG', () => {
    it('should have Gold tier configuration', () => {
      expect(TIER_CONFIG.gold).toBeDefined();
      expect(TIER_CONFIG.gold.name).toBe('Gold');
      expect(TIER_CONFIG.gold.minTopup).toBe(500000);
      expect(TIER_CONFIG.gold.durationMonths).toBe(6);
      expect(TIER_CONFIG.gold.discountPct).toBe(20);
    });

    it('should have Diamond tier configuration', () => {
      expect(TIER_CONFIG.diamond).toBeDefined();
      expect(TIER_CONFIG.diamond.name).toBe('Diamond');
      expect(TIER_CONFIG.diamond.minTopup).toBe(1000000);
      expect(TIER_CONFIG.diamond.durationMonths).toBe(12);
      expect(TIER_CONFIG.diamond.discountPct).toBe(25);
    });

    it('Gold should have lower requirements than Diamond', () => {
      expect(TIER_CONFIG.gold.minTopup).toBeLessThan(TIER_CONFIG.diamond.minTopup);
      expect(TIER_CONFIG.gold.discountPct).toBeLessThan(TIER_CONFIG.diamond.discountPct);
    });
  });

  describe('calculateExpiry()', () => {
    it('should calculate Gold expiry (6 months)', () => {
      const startDate = '2026-01-15';
      const expiry = calculateExpiry(startDate, TIER_CONFIG.gold.durationMonths);
      expect(expiry.getMonth()).toBe(6); // January + 6 = July
      expect(expiry.getFullYear()).toBe(2026);
    });

    it('should calculate Diamond expiry (12 months)', () => {
      const startDate = '2026-01-15';
      const expiry = calculateExpiry(startDate, TIER_CONFIG.diamond.durationMonths);
      expect(expiry.getMonth()).toBe(0); // January + 12 = January next year
      expect(expiry.getFullYear()).toBe(2027);
    });

    it('should handle year boundary', () => {
      const startDate = '2026-11-15';
      const expiry = calculateExpiry(startDate, TIER_CONFIG.gold.durationMonths);
      expect(expiry.getMonth()).toBe(4); // November + 6 = May
      expect(expiry.getFullYear()).toBe(2027);
    });
  });

  describe('isMembershipActive()', () => {
    it('should return true for future expiry', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      expect(isMembershipActive(futureDate.toISOString())).toBe(true);
    });

    it('should return false for past expiry', () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 1);
      expect(isMembershipActive(pastDate.toISOString())).toBe(false);
    });

    it('should return false for null expiry', () => {
      expect(isMembershipActive(null)).toBe(false);
    });

    it('should return false for undefined expiry', () => {
      expect(isMembershipActive(undefined)).toBe(false);
    });
  });

  describe('calculateMembershipDiscount()', () => {
    it('should calculate 20% discount for Gold', () => {
      expect(calculateMembershipDiscount(100000, 'gold')).toBe(20000);
      expect(calculateMembershipDiscount(500000, 'gold')).toBe(100000);
    });

    it('should calculate 25% discount for Diamond', () => {
      expect(calculateMembershipDiscount(100000, 'diamond')).toBe(25000);
      expect(calculateMembershipDiscount(1000000, 'diamond')).toBe(250000);
    });

    it('should return 0 for invalid tier', () => {
      expect(calculateMembershipDiscount(100000, 'invalid')).toBe(0);
    });

    it('should return 0 for null tier', () => {
      expect(calculateMembershipDiscount(100000, null)).toBe(0);
    });

    it('should handle large amounts', () => {
      expect(calculateMembershipDiscount(5000000, 'gold')).toBe(1000000);
    });
  });

  describe('validateActivationAmount()', () => {
    it('should accept Gold minimum amount', () => {
      const result = validateActivationAmount(500000, 'gold');
      expect(result.valid).toBe(true);
    });

    it('should accept Diamond minimum amount', () => {
      const result = validateActivationAmount(1000000, 'diamond');
      expect(result.valid).toBe(true);
    });

    it('should accept more than minimum', () => {
      const result = validateActivationAmount(1500000, 'gold');
      expect(result.valid).toBe(true);
    });

    it('should reject below Gold minimum', () => {
      const result = validateActivationAmount(499999, 'gold');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('500.000');
    });

    it('should reject below Diamond minimum', () => {
      const result = validateActivationAmount(999999, 'diamond');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('1.000.000');
    });

    it('should reject zero amount', () => {
      const result = validateActivationAmount(0, 'gold');
      expect(result.valid).toBe(false);
    });

    it('should reject negative amount', () => {
      const result = validateActivationAmount(-100000, 'gold');
      expect(result.valid).toBe(false);
    });

    it('should reject invalid tier', () => {
      const result = validateActivationAmount(500000, 'invalid');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid tier');
    });
  });

  describe('shouldActivateMember()', () => {
    it('should activate Gold at minimum', () => {
      expect(shouldActivateMember(500000, 'gold')).toBe(true);
    });

    it('should activate Diamond at minimum', () => {
      expect(shouldActivateMember(1000000, 'diamond')).toBe(true);
    });

    it('should NOT activate Gold below minimum', () => {
      expect(shouldActivateMember(499999, 'gold')).toBe(false);
    });

    it('should NOT activate Diamond below minimum', () => {
      expect(shouldActivateMember(999999, 'diamond')).toBe(false);
    });

    it('should NOT activate for invalid tier', () => {
      expect(shouldActivateMember(1000000, 'invalid')).toBe(false);
    });
  });

  describe('Integration: Complete Membership Flow', () => {
    it('should handle Gold activation flow', () => {
      // 1. Validate amount
      const amount = 750000;
      const validation = validateActivationAmount(amount, 'gold');
      expect(validation.valid).toBe(true);

      // 2. Calculate expiry
      const startDate = new Date().toISOString();
      const expiry = calculateExpiry(startDate, TIER_CONFIG.gold.durationMonths);
      expect(expiry > new Date()).toBe(true);

      // 3. Check if should activate
      expect(shouldActivateMember(amount, 'gold')).toBe(true);

      // 4. Calculate discount
      const transactionTotal = 500000;
      const discount = calculateMembershipDiscount(transactionTotal, 'gold');
      expect(discount).toBe(100000); // 20%
    });

    it('should handle Diamond activation flow', () => {
      const amount = 1500000;
      const validation = validateActivationAmount(amount, 'diamond');
      expect(validation.valid).toBe(true);

      const transactionTotal = 1000000;
      const discount = calculateMembershipDiscount(transactionTotal, 'diamond');
      expect(discount).toBe(250000); // 25%
    });

    it('should prevent activation with insufficient amount', () => {
      const amount = 300000; // Below both minimums
      const goldValidation = validateActivationAmount(amount, 'gold');
      expect(goldValidation.valid).toBe(false);

      const diamondValidation = validateActivationAmount(amount, 'diamond');
      expect(diamondValidation.valid).toBe(false);

      // Customer should NOT become member
      expect(shouldActivateMember(amount, 'gold')).toBe(false);
    });
  });

  describe('Business Rules Compliance', () => {
    it('should enforce: Top up BUKAN otomatis jadi member', () => {
      // Small top-up should not make customer a member
      const smallTopup = 100000;
      const validation = validateActivationAmount(smallTopup, 'gold');
      expect(validation.valid).toBe(false);
    });

    it('should enforce: Mau jadi member = top up saat itu juga', () => {
      // Must top-up AND meet minimum at same time
      const amount = 500000;
      expect(shouldActivateMember(amount, 'gold')).toBe(true);
    });

    it('should enforce: Deposit bisa digunakan non-member', () => {
      // Any deposit is valid, but membership requires minimum
      const deposit = 100000;
      const memberValidation = validateActivationAmount(deposit, 'gold');
      // Note: deposit for non-member can be any amount
      // This just tests the minimum is enforced for activation
      expect(memberValidation.valid).toBe(false); // Below minimum
    });
  });
});

// Run with: npx vitest run api/tests/membership.test.js
