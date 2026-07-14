// ─────────────────────────────────────────────────────────────────────────────
// SegmentasiPage.jsx — Customer Segmentation Page (Admin)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, Modal, SearchBar, Chip, EmptyState, Avatar } from '../../components/ui';
import { getSegmentationOverview, getSegmentedCustomers, SEGMENT_OPTIONS, SEGMENT_LABELS } from '../../utils/segmentationApi';
import { alertError } from '../../utils/alert';

const PAGE_SIZE = 50;

export default function SegmentasiPage({ goBack }) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilter, setShowFilter] = useState(false);

  // Selected customer for detail
  const [selectedCustomer, setSelectedCustomer] = useState(null);

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
      setPagination(result.pagination);
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

  // Render segment badge
  const renderSegmentBadge = (segmentKey) => {
    const meta = getSegmentMeta(segmentKey);
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 20,
        background: meta.bg, color: meta.color,
        fontSize: 11, fontWeight: 600,
      }}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </div>
    );
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 480px) {
          .seg-overview-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .seg-segment-row { min-width: 60px !important; font-size: 7px !important; }
          .seg-customer-row { flex-direction: column !important; gap: 8px !important; }
          .seg-modal-grid { grid-template-columns: 1fr !important; }
          .seg-search-row { flex-direction: column !important; }
          .seg-search-row > * { width: 100% !important; }
        }
      `}</style>
      <TopBar title="Segmentasi Pelanggan" subtitle="Analisis pelanggan berdasarkan segment" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Overview Cards */}
        {overview && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10
            }} className="seg-overview-grid">
              <div style={{
                background: C.white, borderRadius: 12, padding: 12,
                textAlign: 'center', boxShadow: SHADOW.sm,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>
                  {overview.activitySummary?.total || 0}
                </div>
                <div style={{ fontSize: 10, color: C.n600 }}>Total</div>
              </div>
              <div style={{
                background: C.successBg, borderRadius: 12, padding: 12,
                textAlign: 'center', boxShadow: SHADOW.sm,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.success }}>
                  {overview.activitySummary?.active || 0}
                </div>
                <div style={{ fontSize: 10, color: C.n600 }}>Aktif</div>
              </div>
              <div style={{
                background: C.validationWarningBg, borderRadius: 12, padding: 12,
                textAlign: 'center', boxShadow: SHADOW.sm,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.warning }}>
                  {overview.activitySummary?.at_risk || 0}
                </div>
                <div style={{ fontSize: 10, color: C.n600 }}>At Risk</div>
              </div>
            </div>

            {/* Segment Distribution */}
            <div style={{
              background: C.white, borderRadius: 12, padding: 12,
              boxShadow: SHADOW.sm, overflowX: 'auto',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 10 }}>
                Distribusi Segment
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }} className="seg-segment-row">
                {overview.segments?.map(seg => {
                  const meta = getSegmentMeta(seg.key);
                  return (
                    <div key={seg.key} style={{
                      minWidth: 70, padding: '8px 6px',
                      background: meta.bg, borderRadius: 10, textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>
                        {seg.customerCount || 0}
                      </div>
                      <div style={{ fontSize: 8, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }} className="seg-search-row">
            <div style={{ flex: 1 }}>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Cari nama atau HP..."
              />
            </div>
            <Btn
              variant={showFilter ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowFilter(!showFilter)}
            >
              ⚙️ Filter
            </Btn>
          </div>

          {showFilter && (
            <div style={{
              background: C.white, borderRadius: 12, padding: 12,
              boxShadow: SHADOW.sm, marginBottom: 8,
            }}>
              {/* Segment Filter */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 6 }}>Segment</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SEGMENT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSegmentFilter(opt.value)}
                      style={{
                        padding: '6px 12px', borderRadius: 20,
                        border: `1.5px solid ${segmentFilter === opt.value ? C.primary : C.n200}`,
                        background: segmentFilter === opt.value ? `${C.primary}15` : C.white,
                        color: segmentFilter === opt.value ? C.primary : C.n700,
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 6 }}>Urutkan</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { value: 'recent', label: 'Terbaru' },
                    { value: 'high_value', label: 'Paling Banyak Belanja' },
                    { value: 'frequent', label: 'Paling Sering' },
                    { value: 'name', label: 'Nama A-Z' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      style={{
                        padding: '6px 12px', borderRadius: 20,
                        border: `1.5px solid ${sortBy === opt.value ? C.primary : C.n200}`,
                        background: sortBy === opt.value ? `${C.primary}15` : C.white,
                        color: sortBy === opt.value ? C.primary : C.n700,
                        fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Customer List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.n600 }}>
            Memuat...
          </div>
        ) : customers.length === 0 ? (
          <EmptyState type="no-data" title="Belum ada pelanggan" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map((customer, idx) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                style={{
                  background: C.white, borderRadius: 12, padding: 14,
                  boxShadow: SHADOW.sm, cursor: 'pointer',
                  transition: 'all 0.15s',
                  className: 'seg-customer-row',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                  <Avatar name={customer.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.n900 }}>
                        {customer.name}
                      </div>
                      {renderSegmentBadge(customer.loyaltySegment?.key)}
                    </div>
                    <div style={{ fontSize: 11, color: C.n600, marginBottom: 6 }}>
                      {customer.phone}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                      <div>
                        <span style={{ color: C.n600 }}>Transaksi: </span>
                        <span style={{ fontWeight: 600, color: C.n900 }}>{customer.transactionCount || 0}x</span>
                      </div>
                      <div>
                        <span style={{ color: C.n600 }}>Total: </span>
                        <span style={{ fontWeight: 600, color: C.success }}>{rp(customer.totalSpending || 0)}</span>
                      </div>
                    </div>
                    {customer.lastTransactionDate && (
                      <div style={{ fontSize: 10, color: C.n500, marginTop: 4 }}>
                        Terakhir: {formatDate(customer.lastTransactionDate)}
                      </div>
                    )}
                  </div>
                  {customer.isMember && (
                    <div style={{
                      background: C.primaryTint2, borderRadius: 6,
                      padding: '4px 8px', fontSize: 9, fontWeight: 600, color: C.primary,
                    }}>
                      WPC
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <Btn variant="secondary" size="sm" loading={loadingMore} onClick={handleLoadMore}>
                  Lihat Lebih Banyak
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      <Modal visible={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title="Detail Pelanggan">
        {selectedCustomer && (
          <div style={{ padding: '8px 4px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Avatar name={selectedCustomer.name} size={64} />
              <div style={{ fontSize: 16, fontWeight: 700, color: C.n900, marginTop: 8 }}>
                {selectedCustomer.name}
              </div>
              <div style={{ fontSize: 12, color: C.n600 }}>{selectedCustomer.phone}</div>
              <div style={{ marginTop: 8 }}>
                {renderSegmentBadge(selectedCustomer.loyaltySegment?.key)}
              </div>
              {selectedCustomer.isMember && (
                <div style={{
                  display: 'inline-block', marginTop: 8,
                  background: C.primary, borderRadius: 20,
                  padding: '4px 12px', fontSize: 10, fontWeight: 600, color: C.white,
                }}>
                  WPC Member
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }} className="seg-modal-grid">
              <div style={{ background: C.n50, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.n900 }}>
                  {selectedCustomer.transactionCount || 0}
                </div>
                <div style={{ fontSize: 10, color: C.n600 }}>Transaksi</div>
              </div>
              <div style={{ background: C.successBg, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.success }}>
                  {rp(selectedCustomer.totalSpending || 0)}
                </div>
                <div style={{ fontSize: 10, color: C.n600 }}>Total Belanja</div>
              </div>
              <div style={{ background: C.infoBg, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.info }}>
                  {rp(selectedCustomer.avgTransactionValue || 0)}
                </div>
                <div style={{ fontSize: 10, color: C.n600 }}>Rata-rata</div>
              </div>
              <div style={{ background: C.validationWarningBg, borderRadius: 10, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.warning }}>
                  {selectedCustomer.depositBalance ? rp(selectedCustomer.depositBalance) : '-'}
                </div>
                <div style={{ fontSize: 10, color: C.n600 }}>Deposit</div>
              </div>
            </div>

            {selectedCustomer.lastTransactionDate && (
              <div style={{
                background: C.n50, borderRadius: 10, padding: 12,
                textAlign: 'center', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: C.n600 }}>Transaksi Terakhir</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.n900 }}>
                  {formatDate(selectedCustomer.lastTransactionDate)}
                </div>
              </div>
            )}

            {selectedCustomer.valueSegment && (
              <div style={{
                background: SEGMENT_LABELS[selectedCustomer.loyaltySegment?.key]?.bg || C.n50,
                borderRadius: 10, padding: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: C.n600, marginBottom: 4 }}>Segment Nilai</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.n900 }}>
                  {selectedCustomer.valueSegment.label || 'Medium Value'}
                </div>
              </div>
            )}

            <Btn variant="secondary" fullWidth onClick={() => setSelectedCustomer(null)}>
              Tutup
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}
