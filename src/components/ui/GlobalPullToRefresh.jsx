import { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../../utils/theme';

/**
 * GlobalPullToRefresh — wraps the entire app screen content area.
 * Saat user tarik dari atas, dispatch event `app:refresh` ke window.
 * Page yang ingin support refresh tinggal subscribe:
 *
 *   useEffect(() => {
 *     const handler = () => fetchData();
 *     window.addEventListener('app:refresh', handler);
 *     return () => window.removeEventListener('app:refresh', handler);
 *   }, [fetchData]);
 */
export const GlobalPullToRefresh = ({ children, threshold = 70 }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef(null);

  // Helper: find inner scrollable element (kebanyakan page punya overflow: auto child)
  const getScrollEl = () => {
    if (!containerRef.current) return null;
    // Cari child pertama yang scrollable
    const all = containerRef.current.querySelectorAll('[style*="overflowY"], [style*="overflow-y"]');
    for (const el of all) {
      const styles = getComputedStyle(el);
      if ((styles.overflowY === 'auto' || styles.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        return el;
      }
    }
    return containerRef.current;
  };

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl || scrollEl.scrollTop > 5) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling.current || refreshing) return;
    const scrollEl = getScrollEl();
    if (!scrollEl || scrollEl.scrollTop > 5) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      const distance = Math.min(delta * 0.45, threshold * 1.5);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  }, [refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold);

      // Dispatch event — pages subscribe to this
      window.dispatchEvent(new CustomEvent('app:refresh'));

      // Min spinner duration agar terasa
      await new Promise(r => setTimeout(r, 600));
      setRefreshing(false);
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing]);

  const isMobile = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  if (!isMobile) {
    return children;
  }

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 5 || refreshing;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {showIndicator && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: pullDistance,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'none',
            transition: refreshing ? 'none' : isPulling.current ? 'none' : 'height 0.25s ease',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 19,
            background: 'white',
            boxShadow: '0 4px 12px rgba(15,23,42,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: refreshing ? 'none' : `rotate(${progress * 360}deg) scale(${0.7 + progress * 0.3})`,
            transition: refreshing ? 'none' : 'transform 0.1s linear',
          }}>
            {refreshing ? (
              <div style={{
                width: 18, height: 18,
                border: `2.5px solid ${C.n200}`,
                borderTopColor: C.primary,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : (
              <svg
                width="18" height="18" viewBox="0 0 24 24"
                fill="none"
                stroke={progress >= 1 ? C.primary : C.n400}
                strokeWidth="2.5" strokeLinecap="round"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            )}
          </div>
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transform: `translateY(${pullDistance}px)`,
        transition: refreshing || isPulling.current ? 'none' : 'transform 0.25s ease',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Hook untuk subscribe ke event refresh global.
 * Pakai di page yang mau support pull-to-refresh:
 *
 *   useAppRefresh(() => {
 *     fetchData();
 *   }, [outletId]);
 */
export const useAppRefresh = (handler, deps = []) => {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrapped = () => handlerRef.current?.();
    window.addEventListener('app:refresh', wrapped);
    return () => window.removeEventListener('app:refresh', wrapped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
