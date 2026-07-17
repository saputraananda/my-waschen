// ─────────────────────────────────────────────────────────────────────────────
// SegmentasiPage.jsx — Customer Segmentation Page (Admin)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, Modal, SearchBar, Chip, EmptyState, Avatar } from '../../components/ui';
import { getSegmentationOverview, getSegmentedCustomers, SEGMENT_OPTIONS, SEGMENT_LABELS } from '../../utils/segmentationApi';
import { alertError } from '../../utils/alert';
import { FloatingBubble, Sparkle, GlowOrb } from '../../components/ui/PremiumAnimations';
import bubbleIcon from '../../assets/Decorative icon/bubble-1.webp';
import bubble2Icon from '../../assets/Decorative icon/bubble-2.webp';

const PAGE_SIZE = 50;

const cardStyle = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

const shimmerKeyframes = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;

export default function SegmentasiPage({ goBack }) {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [showFilter, setShowFilter] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await getSegmentationOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchCustomers(1)]);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    setPage(1);
    fetchCustomers(1, false);
  }, [search, segmentFilter, sortBy, fetchCustomers]);

  const handleLoadMore = () => {
    if (!hasMore || loadingMore) return;
    fetchCustomers(page + 1, true);
  };

  const getSegmentMeta = (key) => SEGMENT_LABELS[key] || SEGMENT_LABELS.NEW;

  const renderSegmentBadge = (segmentKey) => {
    const meta = getSegmentMeta(segmentKey);
    return (
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px', borderRadius: 20,
          background: meta.bg, color: meta.color,
          fontSize: 11, fontWeight: 600,
        }}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </motion.div>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{shimmerKeyframes}</style>

      {/* Premium Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: 8,
        paddingBottom: 16,
      }}>
        <GlowOrb color="#E040FB" size={120} opacity={0.15} top="-20px" right="-20px" />
        <GlowOrb color="#FF6D00" size={80} opacity={0.1} bottom="-10px" left="20%" />
        <FloatingBubble src={bubbleIcon} size={28} top="12px" right="60px" />
        <FloatingBubble src={bubble2Icon} size={22} top="28px" right="20px" delay={0.5} />
        <Sparkle color="#FFD700" size={16} top="8px" left="40%" delay={0.2} />
        <Sparkle color="#FFFFFF" size={12} top="32px" left="25%" delay={0.8} />

        <TopBar title="Segmentasi Pelanggan" subtitle="Analisis pelanggan berdasarkan segment" onBack={goBack} isPremium />
      </div>

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

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Overview Cards */}
        {overview && (
          <div style={{ marginBottom: 16 }}>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10
              }}
              className="seg-overview-grid"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                style={{
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  borderRadius: 12, padding: 12,
                  textAlign: 'center',
                  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: '#5B005F' }}>
                  {overview.activitySummary?.total || 0}
                </div>
                <div style={{ fontSize: 10, color: '#9E9E9E' }}>Total</div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                style={{
                  background: 'linear-gradient(145deg, #E8F5E9, #F1F8E9)',
                  borderRadius: 12, padding: 12,
                  textAlign: 'center',
                  boxShadow: '10px 10px 24px rgba(46, 125, 50, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: '#2E7D32' }}>
                  {overview.activitySummary?.active || 0}
                </div>
                <div style={{ fontSize: 10, color: '#9E9E9E' }}>Aktif</div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.02 }}
                style={{
                  background: 'linear-gradient(145deg, #FFF3E0, #FFF8E1)',
                  borderRadius: 12, padding: 12,
                  textAlign: 'center',
                  boxShadow: '10px 10px 24px rgba(230, 81, 0, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 700, color: '#E65100' }}>
                  {overview.activitySummary?.at_risk || 0}
                </div>
                <div style={{ fontSize: 10, color: '#9E9E9E' }}>At Risk</div>
              </motion.div>
            </motion.div>

            {/* Segment Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                borderRadius: 12, padding: 12,
                boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
                overflowX: 'auto',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 10 }}>
                Distribusi Segment
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }} className="seg-segment-row">
                {overview.segments?.map((seg, idx) => {
                  const meta = getSegmentMeta(seg.key);
                  return (
                    <motion.div
                      key={seg.key}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      style={{
                        minWidth: 70, padding: '8px 6px',
                        background: meta.bg, borderRadius: 10, textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 700, color: meta.color }}>
                        {seg.customerCount || 0}
                      </div>
                      <div style={{ fontSize: 8, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
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
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowFilter(!showFilter)}
              style={{
                padding: '8px 16px', borderRadius: 12,
                border: showFilter ? 'none' : '1.5px solid #E8DDF0',
                background: showFilter ? 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)' : '#FFFFFF',
                color: showFilter ? '#FFFFFF' : '#5B005F',
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ⚙️ Filter
            </motion.button>
          </div>

          <AnimatePresence>
            {showFilter && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  borderRadius: 12, padding: 12,
                  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
                  marginBottom: 8,
                  overflow: 'hidden',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 6 }}>Segment</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {SEGMENT_OPTIONS.map(opt => (
                      <motion.button
                        key={opt.value}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSegmentFilter(opt.value)}
                        style={{
                          padding: '6px 12px', borderRadius: 20,
                          border: `1.5px solid ${segmentFilter === opt.value ? '#5B005F' : '#E8DDF0'}`,
                          background: segmentFilter === opt.value ? 'rgba(91, 0, 95, 0.1)' : '#FFFFFF',
                          color: segmentFilter === opt.value ? '#5B005F' : '#5B005F',
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#5B005F', marginBottom: 6 }}>Urutkan</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[
                      { value: 'recent', label: 'Terbaru' },
                      { value: 'high_value', label: 'Paling Banyak Belanja' },
                      { value: 'frequent', label: 'Paling Sering' },
                      { value: 'name', label: 'Nama A-Z' },
                    ].map(opt => (
                      <motion.button
                        key={opt.value}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSortBy(opt.value)}
                        style={{
                          padding: '6px 12px', borderRadius: 20,
                          border: `1.5px solid ${sortBy === opt.value ? '#5B005F' : '#E8DDF0'}`,
                          background: sortBy === opt.value ? 'rgba(91, 0, 95, 0.1)' : '#FFFFFF',
                          color: sortBy === opt.value ? '#5B005F' : '#5B005F',
                          fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Customer List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                style={{
                  ...cardStyle, padding: 14,
                  background: `linear-gradient(90deg, #F0E6F5 25%, #FFFFFF 50%, #F0E6F5 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E8DDF0' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '60%', height: 14, background: '#E8DDF0', borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ width: '40%', height: 12, background: '#F0E6F5', borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ width: 80, height: 12, background: '#F0E6F5', borderRadius: 4 }} />
                  <div style={{ width: 80, height: 12, background: '#F0E6F5', borderRadius: 4 }} />
                </div>
              </motion.div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ ...cardStyle, padding: 40, textAlign: 'center' }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: '#5B005F' }}>
              Belum ada pelanggan
            </div>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map((customer, idx) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => setSelectedCustomer(customer)}
                style={{
                  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                  borderRadius: 12, padding: 14,
                  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  className: 'seg-customer-row',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%' }}>
                  <Avatar name={customer.name} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                        {customer.name}
                      </div>
                      {renderSegmentBadge(customer.loyaltySegment?.key)}
                    </div>
                    <div style={{ fontSize: 11, color: '#757575', marginBottom: 6 }}>
                      {customer.phone}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                      <div>
                        <span style={{ color: '#757575' }}>Transaksi: </span>
                        <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{customer.transactionCount || 0}x</span>
                      </div>
                      <div>
                        <span style={{ color: '#757575' }}>Total: </span>
                        <span style={{ fontWeight: 600, color: '#2E7D32' }}>{rp(customer.totalSpending || 0)}</span>
                      </div>
                    </div>
                    {customer.lastTransactionDate && (
                      <div style={{ fontSize: 10, color: '#9E9E9E', marginTop: 4 }}>
                        Terakhir: {formatDate(customer.lastTransactionDate)}
                      </div>
                    )}
                  </div>
                  {customer.isMember && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        background: 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)',
                        borderRadius: 6, padding: '4px 8px', fontSize: 9, fontWeight: 600, color: '#FFFFFF',
                      }}
                    >
                      WPC
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}

            {hasMore && (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleLoadMore}
                  style={{
                    padding: '10px 24px', borderRadius: 12,
                    border: '1.5px solid #E8DDF0', background: '#FFFFFF',
                    fontFamily: 'Poppins', fontSize: 13, fontWeight: 600,
                    color: '#5B005F', cursor: 'pointer',
                  }}
                >
                  {loadingMore ? 'Memuat...' : 'Lihat Lebih Banyak'}
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer Detail Modal */}
      <AnimatePresence>
        {selectedCustomer && (
          <Modal visible={!!selectedCustomer} onClose={() => setSelectedCustomer(null)} title="Detail Pelanggan">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ padding: '8px 4px' }}
            >
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Avatar name={selectedCustomer.name} size={64} />
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', marginTop: 8 }}>
                  {selectedCustomer.name}
                </div>
                <div style={{ fontSize: 12, color: '#757575' }}>{selectedCustomer.phone}</div>
                <div style={{ marginTop: 8 }}>
                  {renderSegmentBadge(selectedCustomer.loyaltySegment?.key)}
                </div>
                {selectedCustomer.isMember && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      display: 'inline-block', marginTop: 8,
                      background: 'linear-gradient(135deg, #5B005F 0%, #7B0078 100%)',
                      borderRadius: 20, padding: '4px 12px', fontSize: 10, fontWeight: 600, color: '#FFFFFF',
                    }}
                  >
                    WPC Member
                  </motion.div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }} className="seg-modal-grid">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  style={{ background: '#F3EEF7', borderRadius: 10, padding: 12, textAlign: 'center' }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
                    {selectedCustomer.transactionCount || 0}
                  </div>
                  <div style={{ fontSize: 10, color: '#9E9E9E' }}>Transaksi</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  style={{ background: '#E8F5E9', borderRadius: 10, padding: 12, textAlign: 'center' }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#2E7D32' }}>
                    {rp(selectedCustomer.totalSpending || 0)}
                  </div>
                  <div style={{ fontSize: 10, color: '#9E9E9E' }}>Total Belanja</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  style={{ background: '#E3F2FD', borderRadius: 10, padding: 12, textAlign: 'center' }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1565C0' }}>
                    {rp(selectedCustomer.avgTransactionValue || 0)}
                  </div>
                  <div style={{ fontSize: 10, color: '#9E9E9E' }}>Rata-rata</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  style={{ background: '#FFF3E0', borderRadius: 10, padding: 12, textAlign: 'center' }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#E65100' }}>
                    {selectedCustomer.depositBalance ? rp(selectedCustomer.depositBalance) : '-'}
                  </div>
                  <div style={{ fontSize: 10, color: '#9E9E9E' }}>Deposit</div>
                </motion.div>
              </div>

              {selectedCustomer.lastTransactionDate && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  style={{
                    background: '#F3EEF7', borderRadius: 10, padding: 12,
                    textAlign: 'center', marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#9E9E9E' }}>Transaksi Terakhir</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                    {formatDate(selectedCustomer.lastTransactionDate)}
                  </div>
                </motion.div>
              )}

              {selectedCustomer.valueSegment && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  style={{
                    background: 'rgba(91, 0, 95, 0.1)', borderRadius: 10, padding: 12, marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 11, color: '#9E9E9E', marginBottom: 4 }}>Segment Nilai</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                    {selectedCustomer.valueSegment.label || 'Medium Value'}
                  </div>
                </motion.div>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedCustomer(null)}
                style={{
                  width: '100%', padding: '12px 20px', borderRadius: 12,
                  border: '1.5px solid #E8DDF0', background: '#FFFFFF',
                  fontFamily: 'Poppins', fontSize: 14, fontWeight: 600,
                  color: '#5B005F', cursor: 'pointer',
                }}
              >
                Tutup
              </motion.button>
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
