/**
 * Unit Tests - Payment Auto-Detect System
 * Tests the payment status auto-detection logic
 *
 * This module tests:
 * - paidAmount = 0 → bayar_nanti
 * - paidAmount > 0 AND < total → dp
 * - paidAmount >= total → lunas
 * - Edge cases (negative, overflow)
 */

import { describe, it, expect } from 'vitest';

// ─── Payment Status Detection Logic (mirrors frontend/backend) ─────────────────

/**
 * Auto-detect payment status based on paidAmount vs total
 * @param {number} paidAmount - Amount customer paid
 * @param {number} total - Total transaction amount
 * @returns {'lunas' | 'dp' | 'bayar_nanti'}
 */
function detectPaymentStatus(paidAmount, total) {
  if (!paidAmount || paidAmount <= 0) return 'bayar_nanti';
  if (paidAmount >= total) return 'lunas';
  return 'dp';
}

/**
 * Calculate effective paid (capped at total)
 */
function getEffectivePaid(paidAmount, total) {
  return Math.min(Math.max(0, paidAmount), total);
}

/**
 * Calculate remaining balance
 */
function getRemainingBalance(paidAmount, total) {
  return Math.max(0, total - paidAmount);
}

/**
 * Calculate change/kembalian for lunas transactions
 */
function getChange(paidAmount, total) {
  if (paidAmount < total) return 0;
  return paidAmount - total;
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('Payment Auto-Detect System', () => {
  describe('detectPaymentStatus()', () => {
    // Test: paidAmount = 0 → bayar_nanti
    it('should return "bayar_nanti" when paidAmount is 0', () => {
      expect(detectPaymentStatus(0, 100000)).toBe('bayar_nanti');
    });

    it('should return "bayar_nanti" when paidAmount is null', () => {
      expect(detectPaymentStatus(null, 100000)).toBe('bayar_nanti');
    });

    it('should return "bayar_nanti" when paidAmount is undefined', () => {
      expect(detectPaymentStatus(undefined, 100000)).toBe('bayar_nanti');
    });

    it('should return "bayar_nanti" when paidAmount is negative', () => {
      expect(detectPaymentStatus(-50000, 100000)).toBe('bayar_nanti');
    });

    // Test: paidAmount > 0 AND < total → dp
    it('should return "dp" when paidAmount is less than total', () => {
      expect(detectPaymentStatus(50000, 100000)).toBe('dp');
    });

    it('should return "dp" when paidAmount is 1 (minimum partial)', () => {
      expect(detectPaymentStatus(1, 100000)).toBe('dp');
    });

    it('should return "dp" when paidAmount is just under total', () => {
      expect(detectPaymentStatus(99999, 100000)).toBe('dp');
    });

    // Test: paidAmount >= total → lunas
    it('should return "lunas" when paidAmount equals total', () => {
      expect(detectPaymentStatus(100000, 100000)).toBe('lunas');
    });

    it('should return "lunas" when paidAmount exceeds total', () => {
      expect(detectPaymentStatus(150000, 100000)).toBe('lunas');
    });

    it('should return "lunas" when paidAmount is significantly more', () => {
      expect(detectPaymentStatus(500000, 100000)).toBe('lunas');
    });

    // Edge cases
    it('should handle zero total (free transaction)', () => {
      expect(detectPaymentStatus(0, 0)).toBe('bayar_nanti');
      expect(detectPaymentStatus(100, 0)).toBe('lunas');
    });

    it('should handle very large amounts (overflow protection)', () => {
      expect(detectPaymentStatus(999999999999, 100000)).toBe('lunas');
    });

    it('should handle decimal amounts correctly', () => {
      expect(detectPaymentStatus(50000.50, 100000)).toBe('dp');
      expect(detectPaymentStatus(100000.00, 100000)).toBe('lunas');
    });
  });

  describe('getEffectivePaid()', () => {
    it('should return paidAmount when less than total', () => {
      expect(getEffectivePaid(50000, 100000)).toBe(50000);
    });

    it('should return total when paidAmount exceeds total', () => {
      expect(getEffectivePaid(150000, 100000)).toBe(100000);
    });

    it('should return 0 for negative paidAmount', () => {
      expect(getEffectivePaid(-50000, 100000)).toBe(0);
    });

    it('should return 0 for null/undefined paidAmount', () => {
      expect(getEffectivePaid(null, 100000)).toBe(0);
    });
  });

  describe('getRemainingBalance()', () => {
    it('should return total - paidAmount when partial payment', () => {
      expect(getRemainingBalance(50000, 100000)).toBe(50000);
    });

    it('should return 0 when fully paid (lunas)', () => {
      expect(getRemainingBalance(100000, 100000)).toBe(0);
    });

    it('should return 0 when overpaid', () => {
      expect(getRemainingBalance(150000, 100000)).toBe(0);
    });

    it('should return total when nothing paid', () => {
      expect(getRemainingBalance(0, 100000)).toBe(100000);
    });
  });

  describe('getChange()', () => {
    it('should return 0 when partial payment', () => {
      expect(getChange(50000, 100000)).toBe(0);
    });

    it('should return 0 when nothing paid', () => {
      expect(getChange(0, 100000)).toBe(0);
    });

    it('should return change when overpaid', () => {
      expect(getChange(150000, 100000)).toBe(50000);
    });

    it('should return 0 when exact amount', () => {
      expect(getChange(100000, 100000)).toBe(0);
    });
  });

  describe('Integration: Full Payment Flow', () => {
    it('should correctly process a LUNAS cash transaction', () => {
      const total = 115000;
      const paidAmount = 150000;

      const status = detectPaymentStatus(paidAmount, total);
      const effectivePaid = getEffectivePaid(paidAmount, total);
      const remaining = getRemainingBalance(paidAmount, total);
      const change = getChange(paidAmount, total);

      expect(status).toBe('lunas');
      expect(effectivePaid).toBe(115000);
      expect(remaining).toBe(0);
      expect(change).toBe(35000);
    });

    it('should correctly process a DP (Uang Muka) transaction', () => {
      const total = 115000;
      const paidAmount = 50000;

      const status = detectPaymentStatus(paidAmount, total);
      const effectivePaid = getEffectivePaid(paidAmount, total);
      const remaining = getRemainingBalance(paidAmount, total);
      const change = getChange(paidAmount, total);

      expect(status).toBe('dp');
      expect(effectivePaid).toBe(50000);
      expect(remaining).toBe(65000);
      expect(change).toBe(0);
    });

    it('should correctly process a BAYAR NANTI transaction', () => {
      const total = 115000;
      const paidAmount = 0;

      const status = detectPaymentStatus(paidAmount, total);
      const effectivePaid = getEffectivePaid(paidAmount, total);
      const remaining = getRemainingBalance(paidAmount, total);
      const change = getChange(paidAmount, total);

      expect(status).toBe('bayar_nanti');
      expect(effectivePaid).toBe(0);
      expect(remaining).toBe(115000);
      expect(change).toBe(0);
    });
  });
});

// Run with: npx vitest run api/tests/paymentAutoDetect.test.js
