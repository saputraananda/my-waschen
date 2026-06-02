// ─────────────────────────────────────────────────────────────────────────────
// savedFilters — persist filter state per page ke localStorage
// ─────────────────────────────────────────────────────────────────────────────
// Pemakaian:
//   const [filter, setFilter] = useSavedFilter('transaksi-list', { status: 'all', date: 'today' });
//
// Otomatis save ke localStorage on change, restore on mount.
// Tidak mengubah UI/UX — hanya mempertahankan filter user antar session.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';

const PREFIX = 'mywaschen:filters:';
const VERSION = 1; // bump kalau struktur berubah supaya cache lama dibuang

function readKey(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.__v !== VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeKey(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ __v: VERSION, data, ts: Date.now() }));
  } catch {
    // localStorage full / disabled — ignore
  }
}

function clearKey(key) {
  try { localStorage.removeItem(PREFIX + key); } catch {}
}

/**
 * useSavedFilter — state hook yang otomatis sync dengan localStorage
 *
 * @param {string} key - identifier unik per page (e.g. 'transaksi-list', 'antrian-produksi')
 * @param {Object} defaultValue - filter default (digunakan kalau belum ada saved)
 * @returns {[filter, setFilter, resetFilter]}
 */
export function useSavedFilter(key, defaultValue) {
  const [filter, setFilter] = useState(() => {
    const saved = readKey(key);
    if (saved && typeof saved === 'object') {
      // Merge dengan default supaya field baru ga hilang
      return { ...defaultValue, ...saved };
    }
    return defaultValue;
  });

  // Pakai ref supaya effect ga trigger di mount awal (sebelum state stabil)
  const skipFirstRef = useRef(true);
  useEffect(() => {
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }
    writeKey(key, filter);
  }, [key, filter]);

  const reset = useCallback(() => {
    clearKey(key);
    setFilter(defaultValue);
  }, [key, defaultValue]);

  return [filter, setFilter, reset];
}

/**
 * Helper: clear semua saved filters (untuk logout)
 */
export function clearAllSavedFilters() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  } catch {}
}
