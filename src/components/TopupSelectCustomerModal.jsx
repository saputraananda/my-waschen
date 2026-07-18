// ─────────────────────────────────────────────────────────────────────────────
// TopupSelectCustomerModal - Bottom sheet customer selection for Top Up
// Flow: Dashboard → Click Top Up → Modal appears → Select Customer → Navigate to TopupDepositPage
// Features: Quick filters, lazy loading, debounced search, cached results
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C } from '../utils/theme';
import { SearchBar, ProfileAvatar } from './ui';
import { useDebounce, useResponsive } from '../utils/hooks';
import { useScrollLock } from '../utils/useScrollLock';
import { Users, User, X, Filter, Zap, Crown } from 'lucide-react';

const PRESET_COLORS = {
  primaryDark: '#3B0B47',
  primaryMid: '#5C1A6B',
  magenta: '#C0247D',
  magentaSoft: '#E85AA8',
  mint: '#5FD9AE',
  mintDeep: '#1F9E75',
  coral: '#F0466B',
  coralDeep: '#B82848',
  glassBg: '#F3EEF7',
  glassStrong: 'rgba(255, 255, 255, 0.92)',
  ink: '#2B1130',
  inkSoft: '#7A6584',
};

// Quick filter options - simplified, hanya filter yang bisa dilakukan langsung
const QUICK_FILTERS = [
  { key: 'all', label: 'Semua', icon: Users },
  { key: 'member', label: 'Member', icon: Crown, color: '#F59E0B' },
  { key: 'non_member', label: 'Non-Member', icon: User, color: '#6B7280' },
];

const PAGE_SIZE = 20;

const GLASS_STYLES = `
  .glass-card {
    background: var(--glass-strong);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 16px;
    box-shadow:
      0 8px 24px -6px rgba(59, 11, 71, 0.15),
      0 4px 12px rgba(59, 11, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .clay-avatar {
    border-radius: 14px;
    background: linear-gradient(145deg, #FFFFFF, #E9D3F2);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.7),
      5px 6px 14px rgba(59, 11, 71, 0.25),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .customer-card {
    background: linear-gradient(145deg, rgba(255,255,255,0.95), rgba(243,238,247,0.8));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 14px;
    box-shadow:
      0 4px 16px -4px rgba(59, 11, 71, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .customer-card:hover {
    transform: translateY(-2px);
    box-shadow:
      0 8px 24px -6px rgba(59, 11, 71, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    border-color: rgba(110, 46, 120, 0.15);
  }

  .customer-card:active {
    transform: translateY(0);
  }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 20px;
    font-family: 'Poppins', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: 1.5px solid rgba(59, 11, 71, 0.1);
    background: white;
    color: #5C1A6B;
    white-space: nowrap;
  }

  .filter-pill:hover {
    background: rgba(91, 0, 95, 0.05);
  }

  .filter-pill.active {
    background: linear-gradient(135deg, #5C1A6B, #3B0B47);
    color: white;
    border-color: transparent;
    box-shadow: 0 2px 8px rgba(91, 0, 95, 0.3);
  }

  .balance-chip {
    font-family: 'Poppins', sans-serif;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, #E0F2F1, #B2DFDB);
    color: #00695C;
    border: 1px solid rgba(0, 150, 136, 0.2);
  }

  .premium-badge {
    font-family: 'Poppins', sans-serif;
    font-size: 8px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    letter-spacing: 0.3px;
    background: linear-gradient(135deg, #FFD700, #FFA500);
    color: #5D3A00;
    box-shadow: 0 2px 6px rgba(255,215,0,0.3);
  }
`;

function useModalStyles() {
  useEffect(() => {
    const styleId = 'topup-customer-modal-styles-v2';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = GLASS_STYLES;
      document.head.appendChild(style);
    }
    return () => {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    };
  }, []);
}

// Customer Avatar Component
function CustomerAvatar({ customer, size = 44 }) {
  useModalStyles();

  return (
    <div
      className="clay-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        padding: 0,
      }}
    >
      <ProfileAvatar
        user={{
          ...customer,
          type: 'customer',
          photo: customer?.photo,
        }}
        size={size}
        showBorder={false}
        style={{
          borderRadius: 14,
          width: size,
          height: size,
        }}
      />
    </div>
  );
}

// Customer Card Component - Memoized for performance
const CustomerCard = React.memo(function CustomerCard({ customer, onClick, isMobile }) {
  const isPremium = customer.is_member === 1;
  const balance = customer.deposit || customer.balance || 0;
  const totalSpend = customer.totalSpend || 0;

  return (
    <motion.div
      className="customer-card"
      onClick={() => onClick(customer)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      style={{
        padding: isMobile ? '10px 12px' : '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <CustomerAvatar customer={customer} size={isMobile ? 40 : 44} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            color: PRESET_COLORS.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: isMobile ? 100 : 140,
          }}>
            {customer.name}
          </div>

          {isPremium && (
            <span className="premium-badge">WPC</span>
          )}
        </div>

        {/* Phone */}
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: PRESET_COLORS.inkSoft, marginBottom: 4 }}>
          {customer.phone}
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 800,
            color: totalSpend > 500000 ? PRESET_COLORS.magenta : PRESET_COLORS.inkSoft,
            lineHeight: 1.2,
          }}>
            Rp {totalSpend.toLocaleString('id-ID')}
          </div>

          <span style={{
            fontFamily: 'Poppins',
            fontSize: 9,
            fontWeight: 600,
            color: PRESET_COLORS.inkSoft,
            background: 'rgba(59,11,71,0.08)',
            padding: '2px 6px',
            borderRadius: 999,
          }}>
            {(customer.totalTx || 0)}x
          </span>

          {balance > 0 && (
            <span className="balance-chip">
              💰 {balance.toLocaleString('id-ID')}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: `linear-gradient(145deg, ${C.primary}, ${PRESET_COLORS.primaryDark})`,
        boxShadow: '0 3px 8px rgba(59, 11, 71, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </motion.div>
  );
});

// Skeleton loading for customer list
function CustomerSkeleton({ isMobile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            padding: isMobile ? '10px 12px' : '12px 14px',
            background: 'rgba(243,238,247,0.6)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{
            width: isMobile ? 40 : 44,
            height: isMobile ? 40 : 44,
            borderRadius: 14,
            background: 'linear-gradient(90deg, #E9D3F2 25%, #F3EEF7 50%, #E9D3F2 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
            flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              width: '60%',
              height: 12,
              borderRadius: 6,
              background: 'linear-gradient(90deg, #E9D3F2 25%, #F3EEF7 50%, #E9D3F2 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              marginBottom: 6,
            }} />
            <div style={{
              width: '40%',
              height: 10,
              borderRadius: 4,
              background: 'linear-gradient(90deg, #E9D3F2 25%, #F3EEF7 50%, #E9D3F2 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Intersection Observer for infinite scroll
function useIntersectionObserver(callback, options = {}) {
  const observer = useRef(null);
  const targetRef = useRef(null);

  useEffect(() => {
    if (observer.current) {
      observer.current.disconnect();
    }

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        callback();
      }
    }, { threshold: 0.1, ...options });

    if (targetRef.current) {
      observer.current.observe(targetRef.current);
    }

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [callback, options.threshold]);

  return targetRef;
}

// Main Modal Component
export default function TopupSelectCustomerModal({
  visible,
  onClose,
  onSelectCustomer,
  scrollContainerRef,
}) {
  const { isMobile } = useResponsive();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [customers, setCustomers] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const debouncedQuery = useDebounce(query, 200);
  const loadingRef = useRef(false);
  const cacheRef = useRef({});

  // ─── Scroll Lock ─────────────────
  useScrollLock(visible, scrollContainerRef);

  // ─── Build API URL with filters ─────────────────
  const buildApiUrl = useCallback((search, filter, pageNum, isReset = false) => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set('search', search.trim());
    }

    // Add filter params
    if (filter === 'member') {
      params.set('is_member', '1');
    } else if (filter === 'non_member') {
      params.set('is_member', '0');
    }

    // Pagination
    params.set('limit', PAGE_SIZE.toString());
    params.set('offset', ((pageNum - 1) * PAGE_SIZE).toString());

    return `/api/customers?${params.toString()}`;
  }, []);

  // ─── Fetch recent customers ─────────────────
  useEffect(() => {
    if (visible) {
      // Skip if we have cached recent customers
      if (cacheRef.current.recent) {
        setRecentCustomers(cacheRef.current.recent);
        return;
      }

      const fetchRecent = async () => {
        setRecentLoading(true);
        try {
          const res = await axios.get('/api/customers?recent=true&limit=6&fields=id,name,phone,photo,is_member,deposit');
          if (res?.data?.success) {
            setRecentCustomers(res.data.data || []);
            cacheRef.current.recent = res.data.data || [];
          }
        } catch {
          setRecentCustomers([]);
        } finally {
          setRecentLoading(false);
        }
      };
      fetchRecent();
    }
  }, [visible]);

  // ─── Fetch customers with lazy loading ─────────────────
  const fetchCustomers = useCallback(async (pageNum = 1, isReset = false) => {
    if (loadingRef.current && !isReset) return;
    if (!hasMore && !isReset && pageNum > 1) return;

    loadingRef.current = true;
    isReset ? setInitialLoading(true) : setLoading(true);

    try {
      const cacheKey = `${debouncedQuery}-${activeFilter}-${pageNum}`;

      // Check cache first
      if (cacheRef.current[cacheKey] && !isReset) {
        const cached = cacheRef.current[cacheKey];
        if (isReset) {
          setCustomers(cached.customers);
        } else {
          setCustomers(prev => [...prev, ...cached.customers]);
        }
        setHasMore(cached.hasMore);
        return;
      }

      const url = buildApiUrl(debouncedQuery, activeFilter, pageNum, isReset);
      const res = await axios.get(url);

      if (res?.data?.success) {
        const newCustomers = res.data.data || [];
        const total = res.data.total || newCustomers.length;
        const hasMoreData = newCustomers.length === PAGE_SIZE && (pageNum * PAGE_SIZE) < total;

        // Update cache
        cacheRef.current[cacheKey] = { customers: newCustomers, hasMore: hasMoreData };

        if (isReset) {
          setCustomers(newCustomers);
        } else {
          setCustomers(prev => pageNum === 1 ? newCustomers : [...prev, ...newCustomers]);
        }
        setHasMore(hasMoreData);
        setPage(pageNum);
      }
    } catch {
      if (isReset) setCustomers([]);
    } finally {
      loadingRef.current = false;
      isReset ? setInitialLoading(false) : setLoading(false);
    }
  }, [debouncedQuery, activeFilter, buildApiUrl, hasMore]);

  // Initial load & filter change
  useEffect(() => {
    if (visible) {
      fetchCustomers(1, true);
      setPage(1);
      setHasMore(true);
    }
  }, [visible, debouncedQuery, activeFilter]);

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMore) {
      fetchCustomers(page + 1);
    }
  }, [fetchCustomers, page, hasMore]);

  // Intersection observer for infinite scroll
  const loadMoreRef = useIntersectionObserver(loadMore);

  const handleSelectCustomer = (customer) => {
    onSelectCustomer(customer);
    onClose();
    setQuery('');
    setCustomers([]);
  };

  const handleClose = () => {
    setQuery('');
    setCustomers([]);
    setRecentCustomers([]);
    setActiveFilter('all');
    onClose();
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setPage(1);
    setHasMore(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <div
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 200,
            }}
          />

          {/* Bottom Sheet */}
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: PRESET_COLORS.glassStrong,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: '20px 20px 0 0',
              maxHeight: isMobile ? '85vh' : '75vh',
              zIndex: 201,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 -8px 40px rgba(59, 11, 71, 0.2)',
            }}
          >
            {/* Handle */}
            <div style={{
              paddingTop: 12,
              paddingBottom: 8,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'rgba(59, 11, 71, 0.2)',
              }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 16px 12px',
              borderBottom: '1px solid rgba(59, 11, 71, 0.08)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `linear-gradient(145deg, ${C.success}20, ${C.success}10)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Zap size={18} color={C.success} />
                </div>
                <div>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 15,
                    fontWeight: 700,
                    color: PRESET_COLORS.ink,
                  }}>
                    Top Up Deposit
                  </div>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    color: PRESET_COLORS.inkSoft,
                  }}>
                    Pilih customer untuk top up
                  </div>
                </div>
              </div>
              <motion.button
                onClick={handleClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  border: 'none',
                  background: 'rgba(59, 11, 71, 0.06)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: PRESET_COLORS.inkSoft,
                }}
              >
                <X size={18} />
              </motion.button>
            </div>

            {/* Search Bar */}
            <div style={{ padding: isMobile ? '10px 12px' : '12px 16px', flexShrink: 0 }}>
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Cari nama atau nomor HP..."
              />
            </div>

            {/* Quick Filters */}
            <div style={{
              padding: `0 ${isMobile ? 12 : 16}px 10px`,
              flexShrink: 0,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}>
              <div style={{
                display: 'flex',
                gap: 8,
                minWidth: 'max-content',
              }}>
                {QUICK_FILTERS.map((filter) => {
                  const Icon = filter.icon;
                  const isActive = activeFilter === filter.key;
                  return (
                    <motion.button
                      key={filter.key}
                      onClick={() => handleFilterChange(filter.key)}
                      className={`filter-pill ${isActive ? 'active' : ''}`}
                      whileTap={{ scale: 0.95 }}
                      style={isActive && filter.color ? {
                        background: `linear-gradient(135deg, ${filter.color}, ${filter.color}CC)`,
                      } : {}}
                    >
                      <Icon size={12} />
                      {filter.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Customer List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? '0 12px 12px' : '0 16px 16px',
            }}>
              {/* Recent Customers (only show when no search and all filter) */}
              {!query && activeFilter === 'all' && recentCustomers.length > 0 && (
                <div style={{ marginBottom: isMobile ? 12 : 14 }}>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    fontWeight: 600,
                    color: PRESET_COLORS.inkSoft,
                    marginBottom: isMobile ? 6 : 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Customer Terakhir Dilayani
                  </div>
                  {recentLoading ? (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} style={{
                          flexShrink: 0,
                          width: 90,
                          padding: '10px 8px',
                          background: 'white',
                          borderRadius: 12,
                          border: '1px solid rgba(59, 11, 71, 0.08)',
                        }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'linear-gradient(90deg, #E9D3F2 25%, #F3EEF7 50%, #E9D3F2 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                            margin: '0 auto 6px',
                          }} />
                          <div style={{
                            width: '70%',
                            height: 8,
                            borderRadius: 4,
                            background: '#E9D3F2',
                            margin: '0 auto 4px',
                          }} />
                          <div style={{
                            width: '50%',
                            height: 6,
                            borderRadius: 3,
                            background: '#E9D3F2',
                            margin: '0 auto',
                          }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {recentCustomers.slice(0, 6).map((c) => (
                        <motion.div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            flexShrink: 0,
                            width: isMobile ? 85 : 95,
                            padding: '10px 8px',
                            background: 'white',
                            borderRadius: 12,
                            border: '1px solid rgba(59, 11, 71, 0.08)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <CustomerAvatar customer={c} size={isMobile ? 32 : 36} />
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 10,
                            fontWeight: 600,
                            color: PRESET_COLORS.ink,
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            width: '100%',
                          }}>
                            {c.name?.split(' ')[0]}
                          </div>
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: 8,
                            color: PRESET_COLORS.inkSoft,
                            textAlign: 'center',
                          }}>
                            {c.phone?.slice(-4)}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section Label */}
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 11,
                fontWeight: 600,
                color: PRESET_COLORS.inkSoft,
                marginBottom: isMobile ? 8 : 10,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {query ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    Hasil pencarian "{query}"
                  </>
                ) : activeFilter === 'member' ? (
                  <>
                    <Crown size={12} color="#F59E0B" />
                    Customer Member
                  </>
                ) : activeFilter === 'non_member' ? (
                  <>
                    <User size={12} color="#6B7280" />
                    Customer Non-Member
                  </>
                ) : (
                  'Semua Customer'
                )}
                {customers.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: 'rgba(59,11,71,0.08)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 10,
                  }}>
                    {customers.length}{hasMore ? '+' : ''}
                  </span>
                )}
              </div>

              {/* Customer List / Loading */}
              {initialLoading ? (
                <CustomerSkeleton isMobile={isMobile} />
              ) : customers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: isMobile ? '24px 12px' : '32px 16px',
                }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>
                    {query ? '🔍' : activeFilter === 'member' ? '👑' : activeFilter === 'non_member' ? '👤' : '👥'}
                  </div>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 13,
                    fontWeight: 600,
                    color: PRESET_COLORS.inkSoft,
                    marginBottom: 4,
                  }}>
                    {query ? 'Customer tidak ditemukan' : 'Belum ada customer'}
                  </div>
                  <div style={{
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    color: PRESET_COLORS.inkSoft,
                  }}>
                    {query ? 'Coba kata kunci lain' : 'Customer akan muncul setelah ditambahkan'}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
                    {/* Filter out recent customers to avoid duplicate keys */}
                    {(() => {
                      const recentIds = new Set(recentCustomers.map(r => r.id));
                      const filteredCustomers = !query && activeFilter === 'all'
                        ? customers.filter(c => !recentIds.has(c.id))
                        : customers;
                      return filteredCustomers.map((c) => (
                        <CustomerCard
                          key={c.id}
                          customer={c}
                          onClick={handleSelectCustomer}
                          isMobile={isMobile}
                        />
                      ));
                    })()}
                  </div>

                  {/* Load More Trigger */}
                  {hasMore && (
                    <div
                      ref={loadMoreRef}
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        padding: '16px',
                      }}
                    >
                      {loading && (
                        <div style={{
                          width: 24,
                          height: 24,
                          border: '2px solid rgba(91, 0, 95, 0.2)',
                          borderTopColor: C.primary,
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }} />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
