// ─────────────────────────────────────────────────────────────────────────────
// SegmentasiPage.jsx — Customer Segmentation Page (Kasir)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, SearchBar, ProfileAvatar } from '../../components/ui';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import { getSegmentationOverview, getSegmentedCustomers, SEGMENT_OPTIONS, SEGMENT_LABELS } from '../../utils/segmentationApi';
import { alertError } from '../../utils/alert';

const PAGE_SIZE = 30;

export default function SegmentasiPage({ goBack }) {
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilter, setShowFilter] = useState(false);

  // Fetch overview
  const fetchOverview = useCallback(async () => {
    try {
      const data = await getSegmentationOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

  // Fetch customers
  const fetchCustomers = useCallback(async (pageNum = 1, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const filters = {
        page: pageNum,
        limit: PAGE_SIZE,
        search: search || undefined,
        segment: segmentFilter !== 'all' ? segmentFilter : undefined,
        sort: sortBy,
      };
      const result = await getSegmentedCustomers(filters);

      if (append) {
        setCustomers(prev => [...prev, ...result.data]);
      } else {
        setCustomers(result.data);
      }
      setPage(result.pagination.page || 1);
      setHasMore((result.pagination.page || 1) < (result.pagination.totalPages || 1));
    } catch (err) {
      alertError('Gagal memuat data pelanggan.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, segmentFilter, sortBy]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchCustomers(1)]);
      setLoading(false);
    };
    load();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    setPage(1);
    fetchCustomers(1, false);
  }, [search, segmentFilter, sortBy, fetchCustomers]);

  // Load more
  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchCustomers(page + 1, true);
  };

  // Get segment meta
  const getSegmentMeta = (key) => SEGMENT_LABELS[key] || SEGMENT_LABELS.NEW;

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Segmentasi Pelanggan" subtitle="Analisis segment pelanggan" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: isMobile ? 80 : 16 }}>
        {/* Quick Stats */}
        {overview && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12
          }}>
            <div style={{ background: C.white, borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.primary }}>{overview.activitySummary?.total || 0}</div>
              <div style={{ fontSize: 9, color: C.n600 }}>Total</div>
            </div>
            <div style={{ background: C.successBg, borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.success }}>{overview.activitySummary?.active || 0}</div>
              <div style={{ fontSize: 9, color: C.n600 }}>Aktif</div>
            </div>
            <div style={{ background: C.validationWarningBg, borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.warning }}>{overview.activitySummary?.at_risk || 0}</div>
              <div style={{ fontSize: 9, color: C.n600 }}>At Risk</div>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Cari nama/HP..." />
          </div>
          <Btn variant={showFilter ? 'primary' : 'secondary'} size="sm" onClick={() => setShowFilter(!showFilter)}>
            ⚙️
          </Btn>
        </div>

        {showFilter && (
          <div style={{ background: C.white, borderRadius: 10, padding: 10, marginBottom: 10, boxShadow: SHADOW.sm }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 6 }}>Segment</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {SEGMENT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSegmentFilter(opt.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: `1.5px solid ${segmentFilter === opt.value ? C.primary : C.n200}`,
                    background: segmentFilter === opt.value ? `${C.primary}15` : C.white,
                    color: segmentFilter === opt.value ? C.primary : C.n700,
                    fontSize: 10, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.n600, marginBottom: 6 }}>Urutkan</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { value: 'recent', label: 'Terbaru' },
                { value: 'high_value', label: 'Terbesar' },
                { value: 'name', label: 'Nama' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: `1.5px solid ${sortBy === opt.value ? C.primary : C.n200}`,
                    background: sortBy === opt.value ? `${C.primary}15` : C.white,
                    color: sortBy === opt.value ? C.primary : C.n700,
                    fontSize: 10, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Customer List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.n600 }}>Memuat...</div>
        ) : customers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.n600 }}>Belum ada data</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customers.map(c => {
              const seg = getSegmentMeta(c.loyaltySegment?.key);
              return (
                <div key={c.id} style={{
                  background: C.white, borderRadius: 10, padding: 12,
                  boxShadow: SHADOW.sm, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <ProfileAvatar user={{ name: c.name, photo: c.photo, gender: c.gender, type: 'customer' }} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.n900 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: C.n600 }}>{c.phone}</div>
                    <div style={{ fontSize: 10, color: C.n500, marginTop: 2 }}>
                      {c.transactionCount || 0}x • {rp(c.totalSpending || 0)}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 8px', borderRadius: 12,
                    background: seg.bg, color: seg.color,
                    fontSize: 9, fontWeight: 600, textAlign: 'center',
                  }}>
                    {seg.icon} {seg.label}
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <div style={{ textAlign: 'center', padding: 8 }}>
                <Btn variant="secondary" size="sm" loading={loadingMore} onClick={handleLoadMore}>
                  Lihat Lebih Banyak
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
