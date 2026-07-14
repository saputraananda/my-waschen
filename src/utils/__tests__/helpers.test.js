/**
 * Session 1 — Test: helpers.js
 * Pure utility functions: currency formatting, text transforms, status colors, etc.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rp, inPeriod, formatRupiah, parseRupiah,
  STAGES, STATUS_COLORS, txApiId, photoTypeLabel,
  titleCase, sentenceCase, formatAlamat,
  getCartUnitPrice, getCartLineSubtotal, getTransactionItemLineTotal,
} from '../helpers';

// ── rp (Rupiah formatter) ───────────────────────────────────────────────────
describe('rp()', () => {
  it('formats number to Rupiah', () => {
    expect(rp(100000)).toBe('Rp 100.000');
  });

  it('formats 0', () => {
    expect(rp(0)).toBe('Rp 0');
  });

  it('formats large numbers', () => {
    expect(rp(1234567890)).toMatch(/Rp/);
    expect(rp(1234567890)).toContain('1.234.567.890');
  });

  it('handles string input', () => {
    expect(rp('50000')).toBe('Rp 50.000');
  });

  it('handles negative numbers', () => {
    expect(rp(-5000)).toMatch(/Rp/);
  });
});

// ── inPeriod ────────────────────────────────────────────────────────────────
describe('inPeriod()', () => {
  it('returns true for "semua"', () => {
    expect(inPeriod('2020-01-01', 'semua')).toBe(true);
  });

  it('returns true for null/undefined period', () => {
    expect(inPeriod('2020-01-01', null)).toBe(true);
    expect(inPeriod('2020-01-01', undefined)).toBe(true);
  });

  it('returns true for today\'s date with "hari_ini"', () => {
    const today = new Date().toISOString();
    expect(inPeriod(today, 'hari_ini')).toBe(true);
  });

  it('returns false for yesterday with "hari_ini"', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(inPeriod(yesterday, 'hari_ini')).toBe(false);
  });

  it('handles "minggu_ini" correctly', () => {
    const today = new Date().toISOString();
    expect(inPeriod(today, 'minggu_ini')).toBe(true);
  });

  it('handles "bulan_ini" correctly', () => {
    const today = new Date().toISOString();
    expect(inPeriod(today, 'bulan_ini')).toBe(true);
  });

  it('returns false for old date in "bulan_ini"', () => {
    expect(inPeriod('2020-01-01', 'bulan_ini')).toBe(false);
  });

  it('returns true for invalid date with "semua"', () => {
    expect(inPeriod('invalid', 'semua')).toBe(true);
  });
});

// ── formatRupiah ────────────────────────────────────────────────────────────
describe('formatRupiah()', () => {
  it('formats number string with dots', () => {
    const result = formatRupiah('100000');
    expect(result).toContain('100.000');
  });

  it('returns empty string for null', () => {
    expect(formatRupiah(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatRupiah(undefined)).toBe('');
  });

  it('formats with prefix by default', () => {
    expect(formatRupiah('50000')).toContain('Rp');
  });

  it('formats without prefix when specified', () => {
    const result = formatRupiah('50000', '');
    expect(result).not.toContain('Rp');
    expect(result).toContain('50.000');
  });

  it('handles empty string', () => {
    expect(formatRupiah('')).toBe('');
  });

  it('strips non-numeric characters', () => {
    expect(formatRupiah('Rp 100.000')).toContain('100.000');
  });
});

// ── parseRupiah ─────────────────────────────────────────────────────────────
describe('parseRupiah()', () => {
  it('parses formatted Rupiah to number', () => {
    expect(parseRupiah('Rp 100.000')).toBe(100000);
  });

  it('parses plain number string', () => {
    expect(parseRupiah('50000')).toBe(50000);
  });

  it('returns 0 for empty/null/undefined', () => {
    expect(parseRupiah('')).toBe(0);
    expect(parseRupiah(null)).toBe(0);
    expect(parseRupiah(undefined)).toBe(0);
  });

  it('strips all non-numeric chars', () => {
    expect(parseRupiah('Rp 1.000.000,-')).toBe(1000000);
  });

  it('returns 0 for non-numeric string', () => {
    expect(parseRupiah('abc')).toBe(0);
  });
});

// ── formatRupiah ↔ parseRupiah roundtrip ────────────────────────────────────
describe('formatRupiah + parseRupiah roundtrip', () => {
  const cases = [0, 1000, 50000, 100000, 1234567890];
  cases.forEach((n) => {
    it(`roundtrips ${n}`, () => {
      const formatted = formatRupiah(String(n));
      expect(parseRupiah(formatted)).toBe(n);
    });
  });
});

// ── STAGES ──────────────────────────────────────────────────────────────────
describe('STAGES', () => {
  it('has 5 stages in correct order', () => {
    expect(STAGES).toEqual(['Diterima', 'Cuci', 'Setrika', 'Packing', 'Selesai']);
  });
});

// ── STATUS_COLORS ───────────────────────────────────────────────────────────
describe('STATUS_COLORS', () => {
  it('has bg and text for each transaction status', () => {
    ['baru', 'proses', 'selesai', 'diambil', 'dibatalkan'].forEach((s) => {
      expect(STATUS_COLORS[s]).toBeDefined();
      expect(STATUS_COLORS[s].bg).toBeDefined();
      expect(STATUS_COLORS[s].text).toBeDefined();
    });
  });

  it('has bg and text for payment statuses', () => {
    ['paid', 'partial', 'unpaid'].forEach((s) => {
      expect(STATUS_COLORS[s]).toBeDefined();
    });
  });

  it('has bg and text for approval statuses', () => {
    ['pending', 'approved', 'rejected'].forEach((s) => {
      expect(STATUS_COLORS[s]).toBeDefined();
    });
  });
});

// ── txApiId ─────────────────────────────────────────────────────────────────
describe('txApiId()', () => {
  it('prefers transactionUuid', () => {
    expect(txApiId({ transactionUuid: 'uuid1', transactionNo: 'no1', id: 1 })).toBe('uuid1');
  });

  it('falls back to transactionNo', () => {
    expect(txApiId({ transactionNo: 'WAS-001', id: 1 })).toBe('WAS-001');
  });

  it('falls back to id', () => {
    expect(txApiId({ id: 42 })).toBe(42);
  });

  it('handles null/undefined', () => {
    expect(txApiId(null)).toBeUndefined();
    expect(txApiId(undefined)).toBeUndefined();
  });

  it('handles empty object', () => {
    expect(txApiId({})).toBeUndefined();
  });
});

// ── photoTypeLabel ──────────────────────────────────────────────────────────
describe('photoTypeLabel()', () => {
  it('returns correct label for known types', () => {
    expect(photoTypeLabel('initial_condition')).toBe('Kondisi terima');
    expect(photoTypeLabel('damage')).toBe('Kerusakan / defect');
    expect(photoTypeLabel('packing_handover')).toBe('Packing / serah');
    expect(photoTypeLabel('after_condition')).toBe('Setelah cuci');
    expect(photoTypeLabel('before')).toBe('Sebelum');
    expect(photoTypeLabel('after')).toBe('Sesudah');
    expect(photoTypeLabel('note_only')).toBe('Catatan');
  });

  it('returns the input itself for unknown type', () => {
    expect(photoTypeLabel('custom_type')).toBe('custom_type');
  });

  it('returns "Foto" for null/undefined', () => {
    expect(photoTypeLabel(null)).toBe('Foto');
    expect(photoTypeLabel(undefined)).toBe('Foto');
    expect(photoTypeLabel('')).toBe('Foto');
  });
});

// ── titleCase ───────────────────────────────────────────────────────────────
describe('titleCase()', () => {
  it('capitalizes each word', () => {
    expect(titleCase('hello world')).toBe('Hello World');
  });

  it('handles single word', () => {
    expect(titleCase('hello')).toBe('Hello');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(titleCase(null)).toBe('');
    expect(titleCase(undefined)).toBe('');
    expect(titleCase('')).toBe('');
  });

  it('handles multiple spaces', () => {
    expect(titleCase('hello  world')).toBe('Hello  World');
  });

  it('already capitalized stays the same', () => {
    expect(titleCase('Hello World')).toBe('Hello World');
  });

  it('lowercases middle characters', () => {
    expect(titleCase('hELLO wORLD')).toBe('Hello World');
  });
});

// ── sentenceCase ────────────────────────────────────────────────────────────
describe('sentenceCase()', () => {
  it('capitalizes first character', () => {
    expect(sentenceCase('hello world')).toBe('Hello world');
  });

  it('returns empty string for null/undefined/empty', () => {
    expect(sentenceCase(null)).toBe('');
    expect(sentenceCase(undefined)).toBe('');
    expect(sentenceCase('')).toBe('');
  });

  it('handles single character', () => {
    expect(sentenceCase('a')).toBe('A');
  });
});

// ── formatAlamat ────────────────────────────────────────────────────────────
describe('formatAlamat()', () => {
  it('title cases and normalizes abbreviations', () => {
    expect(formatAlamat('jl. mawar no. 5')).toBe('Jl. Mawar No. 5');
  });

  it('normalizes Rt/Rw to uppercase', () => {
    // Fixed: dropped trailing \b after dot in regex
    expect(formatAlamat('rt. 03 rw. 05')).toBe('RT 03 RW 05');
  });

  it('handles Rt/Rw without dot', () => {
    expect(formatAlamat('rt 03 rw 05')).toBe('RT 03 RW 05');
  });

  it('returns empty for null/undefined', () => {
    expect(formatAlamat(null)).toBe('');
    expect(formatAlamat(undefined)).toBe('');
  });

  it('keeps Blok capitalized', () => {
    expect(formatAlamat('blok a no 10')).toBe('Blok A No 10');
  });
});

describe('getCartUnitPrice()', () => {
  it('returns base price when not express', () => {
    expect(getCartUnitPrice({ price: 7000, express: false })).toBe(7000);
  });

  it('doubles price for express (default 2×)', () => {
    expect(getCartUnitPrice({ price: 25000, express: true })).toBe(50000);
  });

  it('uses expressMultiplier when set', () => {
    expect(getCartUnitPrice({ price: 150000, express: true, expressMultiplier: 1.5 })).toBe(225000);
  });

  it('rounds to integer rupiah (no float artifacts)', () => {
    expect(getCartUnitPrice({ price: 25000, express: true, expressMultiplier: 2.00000012 })).toBe(50000);
  });
});

describe('getCartLineSubtotal()', () => {
  it('multiplies unit price by qty', () => {
    expect(getCartLineSubtotal({ price: 25000, express: true, expressMultiplier: 2, qty: 1 })).toBe(50000);
    expect(getCartLineSubtotal({ price: 7000, express: false, qty: 2 })).toBe(14000);
  });
});

describe('getTransactionItemLineTotal()', () => {
  it('prefers stored subtotal', () => {
    expect(getTransactionItemLineTotal({ price: 25000, qty: 1, subtotal: 50000 })).toBe(50000);
  });

  it('falls back to price × qty', () => {
    expect(getTransactionItemLineTotal({ price: 50000, qty: 2 })).toBe(100000);
  });
});
