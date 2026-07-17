// ─────────────────────────────────────────────────────────────────────────────
// Reusable React Hooks
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

/**
 * useWindowSize — returns current window dimensions.
 * Updates on resize.
 */
export function useWindowSize() {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  useEffect(() => {
    let timeout;
    const handle = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }, 100);
    };
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('resize', handle);
      clearTimeout(timeout);
    };
  }, []);

  return size;
}

/**
 * useOrientation — returns current orientation state.
 * Updates on resize (orientationchange event).
 *
 * Usage:
 *   const { isLandscape, isPortrait, orientation } = useOrientation();
 */
export function useOrientation() {
  const { width, height } = useWindowSize();

  const isLandscape = width > height;
  const isPortrait = height > width;
  const isSquare = width === height;

  // 'landscape-primary', 'landscape-secondary', 'portrait-primary', 'portrait-secondary', 'square'
  const orientation = isLandscape ? 'landscape' : isPortrait ? 'portrait' : 'square';

  return { isLandscape, isPortrait, isSquare, orientation, width, height };
}

/**
 * useResponsive — returns responsive breakpoints state.
 *
 * Usage:
 *   const { isMobile, isTablet, isDesktop, isLargeDesktop } = useResponsive();
 *   const padding = isMobile ? 12 : isTablet ? 16 : 24;
 */
export function useResponsive() {
  const { width, height } = useWindowSize();

  const isMobile = width < 640;       // Mobile S/M/L (< 640px)
  const isTablet = width >= 640 && width < 1024;  // Tablet (640-1023px)
  const isDesktop = width >= 1024 && width < 1280; // Desktop (1024-1279px)
  const isLargeDesktop = width >= 1280; // Large Desktop (>= 1280px)

  // Common breakpoints
  const sm = width >= 640;
  const md = width >= 768;
  const lg = width >= 1024;
  const xl = width >= 1280;

  // Grid columns
  const gridCols = isMobile ? 2 : isTablet ? 3 : isDesktop ? 4 : 6;

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    sm,
    md,
    lg,
    xl,
    gridCols,
    // Helper: get value based on breakpoint
    bp: (valueByBp) => {
      if (isMobile) return valueByBp.mobile ?? valueByBp.base ?? valueByBp.tablet ?? valueByBp.desktop;
      if (isTablet) return valueByBp.tablet ?? valueByBp.base ?? valueByBp.desktop;
      if (isDesktop) return valueByBp.desktop ?? valueByBp.base;
      return valueByBp.base;
    },
  };
}

/**
 * useIsMobile — compatibility helper for pages that only need the mobile flag.
 */
export function useIsMobile() {
  return useResponsive().isMobile;
}

/**
 * useSafeArea — returns safe area insets for notched devices.
 * Includes padding for notch, home indicator, etc.
 */
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const compute = () => {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(style.getPropertyValue('--sat') || '0') || 0,
        bottom: parseInt(style.getPropertyValue('--sab') || '0') || 0,
        left: parseInt(style.getPropertyValue('--sal') || '0') || 0,
        right: parseInt(style.getPropertyValue('--sar') || '0') || 0,
      });
    };
    compute();
    // Re-compute on resize (orientation change)
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return safeArea;
}

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
