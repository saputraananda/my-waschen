/**
 * Session 2 — Test: hooks.js + savedFilters.js
 * React hooks — useDebounce, useDebouncedCallback, useLocalStorage, useOnlineStatus
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce, useDebouncedCallback, useLocalStorage, useOnlineStatus } from '../hooks';
import { useSavedFilter, clearAllSavedFilters } from '../savedFilters';

// ── useDebounce ─────────────────────────────────────────────────────────────
describe('useDebounce()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('debounces value update', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    expect(result.current).toBe('a');

    rerender({ value: 'b', delay: 300 });
    expect(result.current).toBe('a'); // still old value

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('b');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a'); // not yet

    rerender({ value: 'c' });
    act(() => vi.advanceTimersByTime(200));
    expect(result.current).toBe('a'); // still not, timer reset

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('c'); // now!
  });

  it('handles different delay values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'x', delay: 500 } }
    );

    rerender({ value: 'y', delay: 500 });
    act(() => vi.advanceTimersByTime(400));
    expect(result.current).toBe('x');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe('y');
  });
});

// ── useDebouncedCallback ────────────────────────────────────────────────────
describe('useDebouncedCallback()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces function call', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));

    act(() => result.current('a'));
    expect(fn).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels previous call on rapid invocations', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 300));

    act(() => result.current('a'));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current('b'));
    act(() => vi.advanceTimersByTime(300));

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('passes multiple arguments', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 100));

    act(() => result.current('arg1', 'arg2', 'arg3'));
    act(() => vi.advanceTimersByTime(100));

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
  });
});

// ── useLocalStorage ─────────────────────────────────────────────────────────
describe('useLocalStorage()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default value when nothing stored', () => {
    const { result } = renderHook(() => useLocalStorage('testKey', { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it('persists value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('testKey', 0));

    act(() => result.current[1](42));

    expect(result.current[0]).toBe(42);
    expect(JSON.parse(localStorage.getItem('testKey'))).toBe(42);
  });

  it('reads existing localStorage value on init', () => {
    localStorage.setItem('existingKey', JSON.stringify('stored_value'));
    const { result } = renderHook(() => useLocalStorage('existingKey', 'default'));
    expect(result.current[0]).toBe('stored_value');
  });

  it('handles object values', () => {
    const { result } = renderHook(() => useLocalStorage('objKey', { x: 1 }));
    act(() => result.current[1]({ x: 2, y: 3 }));
    expect(result.current[0]).toEqual({ x: 2, y: 3 });
    expect(JSON.parse(localStorage.getItem('objKey'))).toEqual({ x: 2, y: 3 });
  });

  it('returns default for corrupt localStorage data', () => {
    localStorage.setItem('corrupt', '{invalid json');
    const { result } = renderHook(() => useLocalStorage('corrupt', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('handles null default value', () => {
    const { result } = renderHook(() => useLocalStorage('nullKey', null));
    expect(result.current[0]).toBeNull();
  });
});

// ── useOnlineStatus ─────────────────────────────────────────────────────────
describe('useOnlineStatus()', () => {
  it('returns initial online status', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(typeof result.current).toBe('boolean');
  });

  it('responds to online event', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current).toBe(false);

    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(true);
  });

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});

// ── useSavedFilter ──────────────────────────────────────────────────────────
describe('useSavedFilter()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default value initially', () => {
    const { result } = renderHook(() =>
      useSavedFilter('test-page', { status: 'all', period: '7d' })
    );
    expect(result.current[0]).toEqual({ status: 'all', period: '7d' });
  });

  it('setFilter updates the value', () => {
    const { result } = renderHook(() =>
      useSavedFilter('test-page', { status: 'all' })
    );

    act(() => result.current[1]({ status: 'paid' }));
    expect(result.current[0]).toEqual({ status: 'paid' });
  });

  it('resetFilter restores default', () => {
    const { result } = renderHook(() =>
      useSavedFilter('test-page', { status: 'all' })
    );

    act(() => result.current[1]({ status: 'paid' }));
    expect(result.current[0]).toEqual({ status: 'paid' });

    act(() => result.current[2]()); // reset
    expect(result.current[0]).toEqual({ status: 'all' });
  });

  it('merges saved data with defaults (new fields added)', () => {
    // Simulate old saved data without new field
    localStorage.setItem(
      'mywaschen:filters:test-merge',
      JSON.stringify({ __v: 1, data: { status: 'paid' }, ts: Date.now() })
    );

    const { result } = renderHook(() =>
      useSavedFilter('test-merge', { status: 'all', period: '7d', search: '' })
    );

    // Should merge: saved status + default period and search
    expect(result.current[0].status).toBe('paid');
    expect(result.current[0].period).toBe('7d');
    expect(result.current[0].search).toBe('');
  });

  it('ignores data with wrong version', () => {
    localStorage.setItem(
      'mywaschen:filters:old-ver',
      JSON.stringify({ __v: 999, data: { status: 'paid' } })
    );

    const { result } = renderHook(() =>
      useSavedFilter('old-ver', { status: 'all' })
    );

    expect(result.current[0]).toEqual({ status: 'all' }); // default, not saved
  });
});

describe('clearAllSavedFilters()', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes all mywaschen:filters: keys', () => {
    localStorage.setItem('mywaschen:filters:a', '{}');
    localStorage.setItem('mywaschen:filters:b', '{}');
    localStorage.setItem('other:key', '{}');

    clearAllSavedFilters();

    expect(localStorage.getItem('mywaschen:filters:a')).toBeNull();
    expect(localStorage.getItem('mywaschen:filters:b')).toBeNull();
    expect(localStorage.getItem('other:key')).toBe('{}');
  });

  it('is safe to call when no filters exist', () => {
    expect(() => clearAllSavedFilters()).not.toThrow();
  });
});
