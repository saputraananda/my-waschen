// ─────────────────────────────────────────────────────────────────────────────
// useInfiniteList — generic hook untuk paginated list dengan infinite scroll
// ─────────────────────────────────────────────────────────────────────────────
// Cara pakai:
//   const list = useInfiniteList({
//     fetchPage: async ({ page, pageSize, signal }) => {
//       const res = await axios.get('/api/customers', { params: { page, limit: pageSize }, signal });
//       return { items: res.data.data, total: res.data.pagination?.total };
//     },
//     pageSize: 30,
//     deps: [search, filter], // reset list kalau dep berubah
//   });
//
//   list.items, list.loading, list.hasMore, list.refresh(), list.loadMore(),
//   list.sentinelRef // <div ref={list.sentinelRef} />  — auto-load saat scroll mendekati
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';

function isAbortError(err) {
  return (
    err?.name === 'AbortError'
    || err?.name === 'CanceledError'
    || err?.code === 'ERR_CANCELED'
    || err?.message === 'canceled'
  );
}

export function useInfiniteList({
  fetchPage,
  pageSize = 30,
  deps = [],
  initialPage = 1,
  enabled = true,
} = {}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const abortRef = useRef(null);
  const generationRef = useRef(0);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  const loadPage = useCallback(async (pageToLoad, isReset = false, requestGen = generationRef.current) => {
    if (!enabled) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isReset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      let lastErr;
      for (let attempt = 0; attempt <= 2; attempt += 1) {
        try {
          const result = await fetchPageRef.current({
            page: pageToLoad,
            pageSize,
            signal: controller.signal,
          });

          if (requestGen !== generationRef.current) return;

          const newItems = Array.isArray(result?.items) ? result.items : [];
          const newTotal = typeof result?.total === 'number' ? result.total : null;

          setItems((prev) => {
            const merged = isReset ? newItems : [...prev, ...newItems];
            if (newItems.length < pageSize) {
              setHasMore(false);
            } else if (newTotal !== null) {
              setHasMore(merged.length < newTotal);
            } else {
              setHasMore(true);
            }
            return merged;
          });
          setTotal(newTotal);
          return;
        } catch (err) {
          lastErr = err;
          if (requestGen !== generationRef.current) return;
          if (isAbortError(err)) return;
          if (err?.response?.status === 429 && attempt < 2) {
            const retryAfterSec = Number(err?.response?.headers?.['retry-after'] || 1);
            await new Promise((r) => setTimeout(r, Math.max(retryAfterSec * 1000, 800)));
            if (requestGen !== generationRef.current) return;
            continue;
          }
          throw err;
        }
      }
      if (lastErr) throw lastErr;
    } catch (err) {
      if (requestGen !== generationRef.current) return;
      if (!isAbortError(err)) {
        setError(err?.response?.data?.message || err.message || 'Gagal memuat data.');
        setHasMore(false);
      }
    } finally {
      if (requestGen === generationRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [pageSize, enabled]);

  // Reset & load page 1 saat deps / enabled berubah
  useEffect(() => {
    if (!enabled) return undefined;

    const requestGen = ++generationRef.current;
    setPage(initialPage);
    setItems([]);
    setTotal(null);
    setHasMore(true);
    setError(null);
    loadPage(initialPage, true, requestGen);

    return () => {
      generationRef.current += 1;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore || error) return;
    const next = page + 1;
    setPage(next);
    loadPage(next, false, generationRef.current);
  }, [hasMore, loading, loadingMore, page, loadPage, error]);

  const refresh = useCallback(() => {
    const requestGen = ++generationRef.current;
    setPage(initialPage);
    setHasMore(true);
    setError(null);
    loadPage(initialPage, true, requestGen);
  }, [initialPage, loadPage]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !error) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore, loadMore, error]);

  return {
    items,
    page,
    total,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    sentinelRef,
    setItems,
  };
}

export default useInfiniteList;
