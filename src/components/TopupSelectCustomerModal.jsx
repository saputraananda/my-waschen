// ─────────────────────────────────────────────────────────────────────────────
// TopupSelectCustomerModal - Bottom sheet customer selection for Top Up
// Flow: Dashboard → Click Top Up → Modal appears → Select Customer → Navigate to TopupDepositPage
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { C } from '../utils/theme';
import { SearchBar, ProfileAvatar } from './ui';
import { useDebounce, useResponsive } from '../utils/hooks';
import { Users, X } from 'lucide-react';

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

  .loyalty-badge {
    font-family: 'Poppins', sans-serif;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    letter-spacing: 0.3px;
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
    const styleId = 'topup-customer-modal-styles';
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

// Loyalty badge config
const LOYALTY_META = {
  loyal: { label: 'Loyal', bg: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#5D3A00', border: '1px solid rgba(255,215,0,0.4)' },
  regular: { label: 'Reguler', bg: 'linear-gradient(135deg, #E8E0F0, #D0C0E8)', color: '#4A2063', border: '1px solid rgba(180,140,220,0.3)' },
  one_time: { label: 'Baru', bg: 'linear-gradient(135deg, #C8F7DC, #8DE4B0)', color: '#1F6B4A', border: '1px solid rgba(100,220,150,0.3)' },
  churn: { label: 'Churn', bg: 'linear-gradient(135deg, #FFE0E0, #FFB8B8)', color: '#8B2020', border: '1px solid rgba(255,120,120,0.3)' },
};

// Customer Card Component
function CustomerCard({ customer, onClick, isMobile }) {
  const isPremium = customer.isPremium || customer.is_member === 1;
  const loyaltyCategory = customer.loyaltyCategory || customer.segment;
  const balance = customer.deposit || customer.balance || 0;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          <div style={{
            fontFamily: 'Poppins',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            color: PRESET_COLORS.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: isMobile ? 120 : 180,
          }}>
            {customer.name}
          </div>

          {isPremium && (
            <span className="premium-badge">PREMIUM</span>
          )}

          {!isPremium && loyaltyCategory && loyaltyCategory !== 'new' && LOYALTY_META[loyaltyCategory] && (
            <span className="loyalty-badge" style={{
              background: LOYALTY_META[loyaltyCategory].bg,
              color: LOYALTY_META[loyaltyCategory].color,
              border: LOYALTY_META[loyaltyCategory].border,
            }}>
              {LOYALTY_META[loyaltyCategory].label}
            </span>
          )}
        </div>

        {/* Phone */}
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: PRESET_COLORS.inkSoft, marginBottom: 4 }}>
          {customer.phone}
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Total Spend */}
          <div style={{
            fontFamily: 'Poppins',
            fontSize: 12,
            fontWeight: 800,
            color: PRESET_COLORS.magenta,
            lineHeight: 1.2,
          }}>
            Rp {(customer.totalSpendAmount || 0).toLocaleString('id-ID')}
          </div>

          {/* Jumlah Transaksi */}
          <span style={{
            fontFamily: 'Poppins',
            fontSize: 9,
            fontWeight: 600,
            color: PRESET_COLORS.inkSoft,
            background: 'rgba(59,11,71,0.08)',
            padding: '2px 6px',
            borderRadius: 999,
          }}>
            {customer.totalTx || customer.total_transactions || 0}x
          </span>

          {/* Saldo Deposit */}
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
}

// Skeleton loading for customer list
function CustomerSkeleton({ isMobile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
      {[1, 2, 3, 4].map((i) => (
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

// Main Modal Component
export default function TopupSelectCustomerModal({
  visible,
  onClose,
  onSelectCustomer,
}) {
  const { isMobile } = useResponsive();
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 250);

  // Fetch recent customers on mount
  useEffect(() => {
    if (visible) {
      const fetchRecent = async () => {
        setRecentLoading(true);
        try {
          const res = await axios.get('/api/customers?recent=true&limit=5');
          if (res?.data?.success) {
            setRecentCustomers(res.data.data || []);
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

  // Fetch customers with search
  useEffect(() => {
    let cancelled = false;
    const fetchCustomers = async () => {
      setLoading(true);
      try {
        const url = debouncedQuery.trim()
          ? `/api/customers?search=${encodeURIComponent(debouncedQuery.trim())}&limit=50`
          : `/api/customers?limit=50`;
        const res = await axios.get(url);
        if (!cancelled) {
          setCustomers(res?.data?.data || []);
        }
      } catch {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCustomers();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const handleSelectCustomer = (customer) => {
    onSelectCustomer(customer);
    onClose();
    // Reset state for next open
    setQuery('');
    setCustomers([]);
  };

  const handleClose = () => {
    setQuery('');
    setCustomers([]);
    setRecentCustomers([]);
    onClose();
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
                  <Users size={18} color={C.success} />
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

            {/* Customer List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? '0 12px 12px' : '0 16px 16px',
              paddingTop: 0,
            }}>
              {/* Recent Customers (only show when no search) */}
              {!query && recentCustomers.length > 0 && (
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
                    Customer Terakhir
                  </div>
                  {recentLoading ? (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                      {[1, 2, 3].map((i) => (
                        <div key={i} style={{
                          flexShrink: 0,
                          width: 100,
                          padding: '12px 10px',
                          background: 'white',
                          borderRadius: 14,
                          border: '1px solid rgba(59, 11, 71, 0.08)',
                        }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            background: 'linear-gradient(90deg, #E9D3F2 25%, #F3EEF7 50%, #E9D3F2 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                            margin: '0 auto 8px',
                          }} />
                          <div style={{
                            width: '70%',
                            height: 10,
                            borderRadius: 4,
                            background: '#E9D3F2',
                            margin: '0 auto 4px',
                          }} />
                          <div style={{
                            width: '40%',
                            height: 8,
                            borderRadius: 4,
                            background: '#E9D3F2',
                            margin: '0 auto',
                          }} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {recentCustomers.map((c) => (
                        <motion.div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            flexShrink: 0,
                            width: isMobile ? 100 : 110,
                            padding: isMobile ? '10px 10px' : '12px 10px',
                            background: 'white',
                            borderRadius: 14,
                            border: '1px solid rgba(59, 11, 71, 0.08)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <CustomerAvatar customer={c} size={isMobile ? 36 : 40} />
                          <div style={{
                            fontFamily: 'Poppins',
                            fontSize: isMobile ? 10 : 11,
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
                            fontSize: 9,
                            color: PRESET_COLORS.inkSoft,
                            textAlign: 'center',
                          }}>
                            {c.phone?.slice(-4)}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )})}
                </div>
              )}

              {/* All Customers / Search Results */}
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: PRESET_COLORS.inkSoft, marginBottom: isMobile ? 8 : 10 }}>
                {query ? `Hasil pencarian "${query}"` : 'Semua Customer'}
              </div>

              {loading ? (
                <CustomerSkeleton isMobile={isMobile} />
              ) : customers.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: isMobile ? '24px 12px' : '32px 16px',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
                  {customers.map((c) => (
                    <CustomerCard
                      key={c.id}
                      customer={c}
                      onClick={handleSelectCustomer}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
