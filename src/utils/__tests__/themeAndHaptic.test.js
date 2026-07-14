/**
 * Session 2 — Test: theme.js, haptic.js
 * Design tokens and haptic feedback — simple exports, no side effects.
 */
import { describe, it, expect, vi } from 'vitest';
import { C, T } from '../theme';
import {
  hapticLight, hapticMedium, hapticHeavy,
  hapticSuccess, hapticError, hapticWarning, hapticNotification,
} from '../haptic';

// ── theme.js ────────────────────────────────────────────────────────────────
describe('Theme Colors (C)', () => {
  it('exports primary color', () => {
    expect(C.primary).toBe('#6e2e78');
  });

  it('exports all semantic colors', () => {
    expect(C.success).toBeTruthy();
    expect(C.warning).toBeTruthy();
    expect(C.danger).toBeTruthy();
    expect(C.error).toBeTruthy();
    expect(C.info).toBeTruthy();
  });

  it('exports neutral scale n50–n900', () => {
    ['n50', 'n100', 'n200', 'n300', 'n400', 'n500', 'n600', 'n700', 'n800', 'n900'].forEach((k) => {
      expect(C[k]).toBeTruthy();
      expect(C[k]).toMatch(/^#/);
    });
  });

  it('exports white', () => {
    expect(C.white).toBe('#FFFFFF');
  });

  it('primaryDark is darker than primary (lower luminance)', () => {
    // Simple check: primaryDark hex value is smaller
    const hex = (s) => parseInt(s.slice(1), 16);
    expect(hex(C.primaryDark)).toBeLessThan(hex(C.primary));
  });

  it('danger === error (same value)', () => {
    expect(C.danger).toBe(C.error);
  });
});

describe('Theme Tokens (T)', () => {
  it('T.card has required properties', () => {
    expect(T.card.background).toBeTruthy();
    expect(T.card.borderRadius).toBe(16);
    expect(T.card.boxShadow).toBeTruthy();
    expect(T.card.padding).toBe(16);
  });

  it('T.cardSm has smaller radius and padding', () => {
    expect(T.cardSm.borderRadius).toBe(12);
    expect(T.cardSm.padding).toBe(12);
  });

  it('T.input has all required CSS properties', () => {
    expect(T.input.width).toBe('100%');
    expect(T.input.height).toBe(48);
    expect(T.input.borderRadius).toBe(10);
    expect(T.input.fontFamily).toBe('Poppins');
    expect(T.input.outline).toBe('none');
  });

  it('T.pageBody has flex and overflow', () => {
    expect(T.pageBody.flex).toBe(1);
    expect(T.pageBody.overflowY).toBe('auto');
  });
});

// ── haptic.js ───────────────────────────────────────────────────────────────
describe('Haptic Functions', () => {
  let vibrateSpy;

  beforeEach(() => {
    // jsdom doesn't have navigator.vibrate — define it for testing
    if (!navigator.vibrate) {
      Object.defineProperty(navigator, 'vibrate', {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });
    }
    vibrateSpy = vi.spyOn(navigator, 'vibrate').mockImplementation(() => true);
  });

  afterEach(() => {
    vibrateSpy.mockRestore();
  });

  it('hapticLight calls navigator.vibrate(10)', () => {
    hapticLight();
    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it('hapticMedium calls navigator.vibrate(25)', () => {
    hapticMedium();
    expect(vibrateSpy).toHaveBeenCalledWith(25);
  });

  it('hapticHeavy calls navigator.vibrate(50)', () => {
    hapticHeavy();
    expect(vibrateSpy).toHaveBeenCalledWith(50);
  });

  it('hapticSuccess calls navigator.vibrate with pattern', () => {
    hapticSuccess();
    expect(vibrateSpy).toHaveBeenCalledWith([15, 50, 15]);
  });

  it('hapticError calls navigator.vibrate with pattern', () => {
    hapticError();
    expect(vibrateSpy).toHaveBeenCalledWith([80, 30, 80]);
  });

  it('hapticWarning calls navigator.vibrate(40)', () => {
    hapticWarning();
    expect(vibrateSpy).toHaveBeenCalledWith(40);
  });

  it('hapticNotification calls navigator.vibrate with pattern', () => {
    hapticNotification();
    expect(vibrateSpy).toHaveBeenCalledWith([10, 30, 10, 30, 10]);
  });
});
