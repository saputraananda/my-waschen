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
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  const sentinelRef = useRef(null);
  const observerRef = useRef(null);

  // Load page tertentu
  const loadPage = useCallback(async (pageToLoad, isReset = false) => {
    if (!enabled) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (isReset) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchPageRef.current({
        page: pageToLoad,
        pageSize,
        signal: controller.signal,
      });
      const newItems = Array.isArray(result?.items) ? result.items : [];
      const newTotal = typeof result?.total === 'number' ? result.total : null;

      setItems((prev) => isReset ? newItems : [...prev, ...newItems]);
      setTotal(newTotal);

      // hasMore: kalau jumlah item kurang dari pageSize, atau kita sudah punya total
      if (newItems.length < pageSize) {
        setHasMore(false);
      } else if (newTotal !== null) {
        const loaded = (isReset ? 0 : items.length) + newItems.length;
        setHasMore(loaded < newTotal);
      } else {
        setHasMore(true);
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('[useInfiniteList] fetch error:', err);
        setError(err?.response?.data?.message || err.message || 'Gagal memuat data.');
        // Stop infinite loop — kalau error, jangan tetap pretend hasMore
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, enabled]);

  // Reset & load page 1 saat deps berubah
  useEffect(() => {
    setPage(initialPage);
    setItems([]);
    setHasMore(true);
    loadPage(initialPage, true);
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Load next page
  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore || error) return;
    const next = page + 1;
    setPage(next);
    loadPage(next, false);
  }, [hasMore, loading, loadingMore, page, loadPage, error]);

  // Refresh dari awal (untuk pull-to-refresh) — sekaligus reset error
  const refresh = useCallback(() => {
    setPage(initialPage);
    setHasMore(true);
    setError(null);
    loadPage(initialPage, true);
  }, [initialPage, loadPage]);

  // IntersectionObserver auto-load
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Skip auto-load saat error untuk cegah loop request
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !error) {
          loadMore();
        }
      },
      { rootMargin: '200px' } // pre-load saat user 200px dari sentinel
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
    setItems, // expose untuk optimistic update
  };
}

export default useInfiniteList;
