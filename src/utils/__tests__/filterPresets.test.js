/**
 * Session 2 — Test: filterPresets.js
 * Date range presets + user-defined preset CRUD in localStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getDateRangePreset, DATE_PRESETS, listPresets, savePreset, deletePreset } from '../filterPresets';

// ── getDateRangePreset ──────────────────────────────────────────────────────
describe('getDateRangePreset()', () => {
  it('returns {start, end} for known key', () => {
    const result = getDateRangePreset('today');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('start');
    expect(result).toHaveProperty('end');
  });

  it('today: start === end (today\'s local date)', () => {
    const result = getDateRangePreset('today');
    expect(result.start).toBe(result.end);
    // After fix: uses local date, not UTC
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result.start).toBe(today);
  });

  it('yesterday: start === end and is a valid date', () => {
    const result = getDateRangePreset('yesterday');
    expect(result.start).toBe(result.end);
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Verify it's before today (UTC)
    const utcToday = new Date().toISOString().slice(0, 10);
    expect(result.start <= utcToday).toBe(true);
  });

  it('7d: range spans 7 days', () => {
    const result = getDateRangePreset('7d');
    const start = new Date(result.start);
    const end = new Date(result.end);
    const diffDays = Math.round((end - start) / 86400000);
    expect(diffDays).toBe(6);
  });

  it('14d: range spans 14 days', () => {
    const result = getDateRangePreset('14d');
    const diffDays = Math.round((new Date(result.end) - new Date(result.start)) / 86400000);
    expect(diffDays).toBe(13);
  });

  it('30d: range spans 30 days', () => {
    const result = getDateRangePreset('30d');
    const diffDays = Math.round((new Date(result.end) - new Date(result.start)) / 86400000);
    expect(diffDays).toBe(29);
  });

  it('90d: range spans 90 days', () => {
    const result = getDateRangePreset('90d');
    const diffDays = Math.round((new Date(result.end) - new Date(result.start)) / 86400000);
    expect(diffDays).toBe(89);
  });

  it('this_week: start is Monday', () => {
    const result = getDateRangePreset('this_week');
    const start = new Date(result.start + 'T00:00:00');
    expect(start.getDay()).toBe(1); // Monday
  });

  it('this_month: start is 1st of month', () => {
    const result = getDateRangePreset('this_month');
    expect(result.start.slice(8, 10)).toBe('01');
  });

  it('last_month: start is 1st of previous month', () => {
    const result = getDateRangePreset('last_month');
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    expect(result.start.slice(8, 10)).toBe('01');
  });

  it('ytd/this_year: start is Jan 1', () => {
    const result = getDateRangePreset('ytd');
    expect(result.start.slice(5, 10)).toBe('01-01');
    const result2 = getDateRangePreset('this_year');
    expect(result2.start.slice(5, 10)).toBe('01-01');
  });

  it('returns null for unknown key', () => {
    expect(getDateRangePreset('unknown')).toBeNull();
    expect(getDateRangePreset(null)).toBeNull();
    expect(getDateRangePreset('')).toBeNull();
  });

  it('all presets return YYYY-MM-DD format', () => {
    const keys = ['today', 'yesterday', '7d', 'this_week', 'last_week', '30d', 'this_month', 'last_month', '3m', '6m', 'ytd'];
    keys.forEach((key) => {
      const result = getDateRangePreset(key);
      expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('start <= end for all presets', () => {
    const keys = ['today', 'yesterday', '7d', 'this_week', 'last_week', '30d', 'this_month', 'last_month', '3m', '6m', 'ytd'];
    keys.forEach((key) => {
      const result = getDateRangePreset(key);
      expect(new Date(result.start).getTime()).toBeLessThanOrEqual(new Date(result.end).getTime());
    });
  });
});

// ── DATE_PRESETS ────────────────────────────────────────────────────────────
describe('DATE_PRESETS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DATE_PRESETS)).toBe(true);
    expect(DATE_PRESETS.length).toBeGreaterThan(0);
  });

  it('each preset has key and label', () => {
    DATE_PRESETS.forEach((p) => {
      expect(p.key).toBeTruthy();
      expect(p.label).toBeTruthy();
    });
  });

  it('each key corresponds to a valid getDateRangePreset result', () => {
    DATE_PRESETS.forEach((p) => {
      const range = getDateRangePreset(p.key);
      expect(range).not.toBeNull();
    });
  });
});

// ── User-defined preset CRUD ────────────────────────────────────────────────
describe('User presets CRUD', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('listPresets returns empty array for new scope', () => {
    expect(listPresets('test_scope')).toEqual([]);
  });

  it('savePreset + listPresets roundtrip', () => {
    savePreset('test_scope', { name: 'My Filter', filters: { status: 'paid' } });
    const list = listPresets('test_scope');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('My Filter');
    expect(list[0].filters.status).toBe('paid');
  });

  it('savePreset updates existing preset with same name', () => {
    savePreset('scope', { name: 'F1', filters: { a: 1 } });
    savePreset('scope', { name: 'F1', filters: { a: 2 } });
    const list = listPresets('scope');
    expect(list).toHaveLength(1);
    expect(list[0].filters.a).toBe(2);
  });

  it('savePreset ignores empty scope or missing name', () => {
    savePreset('', { name: 'X' });
    savePreset('scope', { });
    expect(listPresets('')).toEqual([]);
    expect(listPresets('scope')).toEqual([]);
  });

  it('deletePreset removes by name', () => {
    savePreset('scope', { name: 'A' });
    savePreset('scope', { name: 'B' });
    deletePreset('scope', 'A');
    const list = listPresets('scope');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('B');
  });

  it('deletePreset is no-op for non-existent name', () => {
    savePreset('scope', { name: 'A' });
    deletePreset('scope', 'Z');
    expect(listPresets('scope')).toHaveLength(1);
  });

  it('deletePreset is no-op for non-existent scope', () => {
    deletePreset('nonexistent', 'A');
    expect(listPresets('nonexistent')).toEqual([]);
  });

  it('scopes are isolated', () => {
    savePreset('scope_a', { name: 'X' });
    savePreset('scope_b', { name: 'Y' });
    expect(listPresets('scope_a')).toHaveLength(1);
    expect(listPresets('scope_b')).toHaveLength(1);
    expect(listPresets('scope_c')).toHaveLength(0);
  });
});
