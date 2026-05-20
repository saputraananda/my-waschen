// ─────────────────────────────────────────────────────────────────────────────
// Reusable React Hooks
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useDebounce — returns a debounced value that only updates after `delay` ms of inactivity.
 *
 * Usage:
 *   const [search, setSearch] = useState('');
 *   const debouncedSearch = useDebounce(search, 300);
 *   useEffect(() => { fetchData(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * useDebouncedCallback — debounce a function call.
 *
 * Usage:
 *   const debouncedSearch = useDebouncedCallback((q) => fetchResults(q), 300);
 *   <input onChange={(e) => debouncedSearch(e.target.value)} />
 */
export function useDebouncedCallback(fn, delay = 300) {
  const timerRef = useRef(null);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  return useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
}

/**
 * useCachedFetch — fetch data dengan in-memory cache & TTL.
 * Master data (outlets, area zones, dll) jarang berubah — cache 5 menit.
 *
 * Usage:
 *   const { data, loading, refetch } = useCachedFetch('/api/master/outlets', { ttl: 5*60*1000 });
 */
const _cache = new Map(); // key → { data, timestamp }

export function useCachedFetch(url, { ttl = 5 * 60 * 1000, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: false, error: null });

  const fetchData = useCallback(async (force = false) => {
    if (!url || !enabled) return;
    const cached = _cache.get(url);
    if (!force && cached && Date.now() - cached.timestamp < ttl) {
      setState({ data: cached.data, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    try {
      const axios = (await import('axios')).default;
      const res = await axios.get(url);
      const data = res?.data?.data ?? res?.data;
      _cache.set(url, { data, timestamp: Date.now() });
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err });
    }
  }, [url, ttl, enabled]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  return { ...state, refetch: () => fetchData(true) };
}

/**
 * Invalidate cache — panggil setelah mutation untuk refresh data.
 */
export function invalidateCache(urlPrefix) {
  for (const key of _cache.keys()) {
    if (!urlPrefix || key.startsWith(urlPrefix)) _cache.delete(key);
  }
}

/**
 * useLocalStorage — sync state dengan localStorage. Auto-revive JSON.
 *
 * Usage:
 *   const [filter, setFilter] = useLocalStorage('myKey', { period: '7d' });
 */
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored != null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);

  return [value, setValue];
}

/**
 * useOnlineStatus — track network online/offline.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);
  return online;
}
