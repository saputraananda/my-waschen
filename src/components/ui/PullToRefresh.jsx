import { useState, useRef, useEffect, useCallback } from 'react';
import { C } from '../../utils/theme';

/**
 * PullToRefresh — wrapper component untuk pull-to-refresh
 * Cara pakai:
 *   <PullToRefresh onRefresh={async () => await fetchData()}>
 *     <YourScrollableContent />
 *   </PullToRefresh>
 *
 * Behavior:
 * - User tarik dari atas saat scroll position di top
 * - Threshold default 70px
 * - Saat di-trigger, panggil onRefresh (async)
 * - Show loading indicator selama refresh
 */
export const PullToRefresh = ({ children, onRefresh, threshold = 70, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (disabled || refreshing) return;
    const container = containerRef.current;
    if (!container) return;
    // Hanya trigger kalau scroll di top
    if (container.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!isPulling.current || disabled || refreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const delta = currentY - startY.current;
    if (delta > 0) {
      // Apply elastic resistance
      const distance = Math.min(delta * 0.5, threshold * 1.5);
      setPullDistance(distance);
      // Prevent default scroll bounce only when actively pulling
      if (delta > 10 && e.cancelable) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [disabled, refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold); // snap to threshold
      try {
        await onRefresh();
      } catch (err) {
        // Silent fail - onRefresh errors should be handled by parent component
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, refreshing, onRefresh]);

  // Detect if mobile (touch device)
  const isMobile = typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  // Calculate indicator state
  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div
      ref={containerRef}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      style={{
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Pull indicator */}
      {showIndicator && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: pullDistance,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: refreshing ? `${C.primary}08` : 'transparent',
            transition: refreshing ? 'none' : pullDistance === 0 ? 'height 0.25s ease' : 'none',
            zIndex: 100,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 18,
            background: 'white',
            boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${progress * 360}deg)`,
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
                stroke={progress >= 1 ? C.primary : '#3a3a3a'}
                strokeWidth="2.5" strokeLinecap="round"
                style={{ transition: 'stroke 0.15s' }}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Content shifted by pull distance */}
      <div style={{
        transform: `translateY(${pullDistance}px)`,
        transition: refreshing || isPulling.current ? 'none' : 'transform 0.25s ease',
      }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Hook ringan untuk implementasi PTR di komponen yang sudah punya custom scroll container.
 * Returns: { isRefreshing, pullDistance, bind } — bind props ke container
 */
export const usePullToRefresh = (onRefresh, threshold = 70) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const elRef = useRef(null);

  const onTouchStart = (e) => {
    const el = elRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  };

  const onTouchMove = (e) => {
    if (!isPulling.current) return;
    const el = elRef.current;
    if (!el || el.scrollTop > 0) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      const distance = Math.min(delta * 0.5, threshold * 1.5);
      setPullDistance(distance);
      if (delta > 10 && e.cancelable) e.preventDefault();
    }
  };

  const onTouchEnd = async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= threshold && !isRefreshing) {
      setRefreshing(true);
      setPullDistance(threshold);
      try { await onRefresh(); } catch {}
      finally { setRefreshing(false); setPullDistance(0); }
    } else {
      setPullDistance(0);
    }
  };

  return {
    isRefreshing,
    pullDistance,
    bind: { ref: elRef, onTouchStart, onTouchMove, onTouchEnd },
  };
};
