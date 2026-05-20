// ─────────────────────────────────────────────────────────────────────────────
// Keyboard Shortcuts — global handler for power users (admin/kasir on iPad)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

/**
 * useKeyboardShortcuts — register global keyboard shortcuts.
 *
 * @param {object} shortcuts - Map of key combo → handler
 *   Key format: 'ctrl+n', 'ctrl+shift+f', 'escape', 'f5'
 *
 * Usage:
 *   useKeyboardShortcuts({
 *     'ctrl+n': () => navigate('nota_step1'),
 *     'ctrl+f': () => focusSearch(),
 *     'escape': () => goBack(),
 *   });
 */
export function useKeyboardShortcuts(shortcuts) {
  useEffect(() => {
    const handler = (e) => {
      // Guard: some events don't have e.key (modifier-only, dead keys)
      if (!e.key) return;

      // Build key combo string
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');
      parts.push(e.key.toLowerCase());
      const combo = parts.join('+');

      const fn = shortcuts[combo];
      if (fn) {
        // Don't trigger when typing in input/textarea
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        fn(e);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

/**
 * WASCHEN_SHORTCUTS — default shortcuts for the app.
 * Pass navigate function to get the handlers.
 */
export function getDefaultShortcuts(navigate, goBack) {
  return {
    // Kasir shortcuts
    'ctrl+n':       () => navigate('nota_step1'),           // New nota
    'ctrl+shift+c': () => navigate('customer'),             // Customer list
    'ctrl+shift+t': () => navigate('transaksi'),            // Transaction list
    'ctrl+shift+a': () => navigate('antrian'),              // Queue

    // Admin shortcuts
    'ctrl+shift+d': () => navigate('dashboard'),            // Dashboard
    'ctrl+shift+r': () => navigate('admin_laporan'),        // Reports
    'ctrl+shift+u': () => navigate('manajemen_user'),       // Users

    // Navigation
    'escape':       () => goBack(),                         // Go back
    'f5':           () => window.location.reload(),         // Refresh
  };
}
