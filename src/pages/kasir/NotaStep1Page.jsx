import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, SearchBar, Avatar, Btn, EmptyState, SkeletonList } from '../../components/ui';
import { useDebounce, useResponsive } from '../../utils/hooks';
import { useApp } from '../../context/AppContext';
import { getAvatarSource } from '../../utils/avatar';

// Glass card CSS class - injected once
const GLASS_STYLES = `
  :root {
    --purple-deep: #3B0B47;
    --purple-mid: #5C1A6B;
    --magenta: #C0247D;
    --magenta-soft: #E85AA8;
    --mint: #5FD9AE;
    --mint-deep: #1F9E75;
    --coral: #F0466B;
    --coral-deep: #B82848;
    --glass-bg: #F3EEF7;
    --glass-strong: rgba(255, 255, 255, 0.92);
    --ink: #2B1130;
    --ink-soft: #7A6584;
  }

  .glass-card {
    background: var(--glass-strong);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 20px;
    box-shadow:
      0 12px 32px -8px rgba(59, 11, 71, 0.18),
      0 4px 12px rgba(59, 11, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .clay-avatar {
    border-radius: 16px;
    background: linear-gradient(145deg, #FFFFFF, #E9D3F2);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.7),
      5px 6px 14px rgba(59, 11, 71, 0.25),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .loyalty-badge {
    font-family: 'Poppins', sans-serif;
    font-size: 9px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    letter-spacing: 0.3px;
  }

  .tag-housing {
    font-family: 'Poppins', sans-serif;
    font-size: 9px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(59, 11, 71, 0.1);
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

  .last-spend-chip {
    font-family: 'Poppins', sans-serif;
    font-size: 10px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(95, 217, 174, 0.15);
    color: #1F9E75;
    border: 1px solid rgba(95, 217, 174, 0.2);
  }
`;

// Inject styles on mount
function useGlassStyles() {
  useEffect(() => {
    const styleId = 'glass-nota-styles';
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

// Customer avatar component with clay style
function CustomerAvatar({ customer, size = 48 }) {
  useGlassStyles();
  const avatarSrc = useMemo(() => getAvatarSource(customer, 'customer'), [customer]);
  const initials = customer.avatar || customer.name?.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';

  const getAvatarBg = (name) => {
    if (!name) return 'linear-gradient(145deg, #E9D3F2, #D4B8E3)';
    const first = name.charAt(0).toUpperCase();
    const ranges = [
      { chars: 'ABCDE', gradient: 'linear-gradient(145deg, #E9D3F2, #C77DCB)' },
      { chars: 'FGHIJ', gradient: 'linear-gradient(145deg, #C8E6FF, #7BA7D4)' },
      { chars: 'KLMNO', gradient: 'linear-gradient(145deg, #FFE0B2, #E4A87C)' },
      { chars: 'PQRST', gradient: 'linear-gradient(145deg, #C8F7C5, #7DC97D)' },
      { chars: 'UVWXYZ', gradient: 'linear-gradient(145deg, #FFD1DC, #E07A8F)' },
    ];
    const found = ranges.find(r => r.chars.includes(first));
    return found?.gradient || 'linear-gradient(145deg, #E9D3F2, #D4B8E3)';
  };

  return (
    <div
      className="clay-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        position: 'relative',
        padding: 0,
      }}
    >
      {customer?.photo ? (
        <img
          src={customer.photo}
          alt={customer?.name || 'avatar'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 16,
          }}
        />
      ) : (
        <>
          <img
            src={avatarSrc}
            alt={customer?.name || 'avatar'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: 16,
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div
            style={{
              display: 'none',
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: getAvatarBg(customer?.name),
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Poppins',
              fontSize: size * 0.35,
              fontWeight: 700,
              color: '#3B0B47',
              textShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            {initials}
          </div>
        </>
      )}
    </div>
  );
}

// Loyalty category metadata with glass aesthetic
const LOYALTY_META = {
  loyal: { label: 'Loyal', bg: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#5D3A00', border: '1px solid rgba(255,215,0,0.4)' },
  regular: { label: 'Reguler', bg: 'linear-gradient(135deg, #E8E0F0, #D0C0E8)', color: '#4A2063', border: '1px solid rgba(180,140,220,0.3)' },
  one_time: { label: 'Baru', bg: 'linear-gradient(135deg, #C8F7DC, #8DE4B0)', color: '#1F6B4A', border: '1px solid rgba(100,220,150,0.3)' },
  churn: { label: 'Churn', bg: 'linear-gradient(135deg, #FFE0E0, #FFB8B8)', color: '#8B2020', border: '1px solid rgba(255,120,120,0.3)' },
};

export default function NotaStep1Page({ goBack }) {
  const { navigate, setNotaCustomer } = useApp();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 250);
  const [hasActiveSession, setHasActiveSession] = useState(null);
  const [sessionCheckError, setSessionCheckError] = useState(null);

  // Responsive hooks
  const { isMobile } = useResponsive();

  // Check for active shift session on mount
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const res = await axios.get('/api/shifts/status');
        if (res?.data) {
          const shift = res.data;
          const isOpen = shift?.isOpen || shift?.bypass;
          setHasActiveSession(!!isOpen);
          if (!isOpen) {
            setSessionCheckError('Anda belum memiliki shift aktif. Silakan buka shift terlebih dahulu untuk melanjutkan transaksi.');
          }
        } else {
          setHasActiveSession(false);
          setSessionCheckError('Gagal memeriksa status shift. Silakan coba lagi.');
        }
      } catch (error) {
        setHasActiveSession(false);
        setSessionCheckError('Tidak dapat memeriksa status shift. Pastikan Anda sudah login.');
      }
    };
    checkActiveSession();
  }, []);

  // Fetch with server-side search & pagination
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
      } catch (error) {
        if (!cancelled) setCustomers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCustomers();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const selectCustomer = (c) => {
    if (!hasActiveSession) {
      return;
    }
    setNotaCustomer(c);
    // Use replace=true: kita tidak mau nota_step1 di history stack
    // Saat user back dari nota_step2, langsung ke halaman sebelumnya (TransaksiList)
    navigate('nota_step2', null, { replace: true });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 1 dari 3 — Pilih Customer" onBack={goBack} />

      {/* Warning Banner - No Active Session */}
      {hasActiveSession === false && sessionCheckError && (
        <div style={{
          margin: isMobile ? '10px 12px 0' : '12px 16px 0',
          padding: '12px 14px',
          background: C.validationWarningBg,
          border: `1.5px solid ${C.validationWarningBorder}`,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10
        }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: C.validationWarningBorder,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.validationWarningText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 13,
              fontWeight: 600,
              color: C.validationWarningText,
              marginBottom: 4
            }}>
              Shift Belum Dibuka
            </div>
            <div style={{
              fontFamily: 'Poppins',
              fontSize: 12,
              color: C.validationWarningText,
              lineHeight: 1.4,
              opacity: 0.85
            }}>
              {sessionCheckError}
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: isMobile ? '6px 12px' : '8px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= 1 ? C.primary : C.n200 }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 12px' : '12px 16px' }}>
        <div style={{ marginBottom: isMobile ? 10 : 12 }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Cari nama atau nomor HP..." />
        </div>

        {/* Tambah Customer Button - Moved here for better UX */}
        <div style={{ marginBottom: isMobile ? 12 : 14 }}>
          <Btn
            variant="secondary"
            fullWidth
            onClick={() => navigate('tambah_customer')}
            disabled={hasActiveSession === false}
          >
            + Customer Baru
          </Btn>
        </div>

        {loading ? (
          <SkeletonList count={5} avatar lines={2} glass />
        ) : customers.length === 0 ? (
          <EmptyState
            type="customers"
            title="Customer tidak ditemukan"
            message="Tambahkan customer baru untuk memulai transaksi"
            action={{
              label: "+ Tambah Customer",
              onClick: () => navigate('tambah_customer')
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
            {customers.map((c) => (
              <div
                key={c.id}
                className="glass-card"
                onClick={() => selectCustomer(c)}
                style={{
                  padding: '12px 14px',
                  cursor: hasActiveSession === false ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: hasActiveSession === false ? 0.6 : 1,
                  pointerEvents: hasActiveSession === false ? 'none' : 'auto',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Avatar */}
                <CustomerAvatar customer={c} size={48} />

                {/* Customer Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {c.name}
                    </div>

                    {/* WPC Membership Badge */}
                    {c.isPremium && (
                      <span style={{
                        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                        color: '#5D3A00',
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontFamily: 'Poppins',
                        boxShadow: '0 2px 6px rgba(255,215,0,0.3)',
                      }}>
                        PREMIUM
                      </span>
                    )}

                    {/* Loyalty Badge */}
                    {!c.isPremium && c.loyaltyCategory && c.loyaltyCategory !== 'new' && LOYALTY_META[c.loyaltyCategory] && (
                      <span className="loyalty-badge" style={{
                        background: LOYALTY_META[c.loyaltyCategory].bg,
                        color: LOYALTY_META[c.loyaltyCategory].color,
                        border: LOYALTY_META[c.loyaltyCategory].border,
                      }}>
                        {LOYALTY_META[c.loyaltyCategory].label}
                      </span>
                    )}

                    {/* Outlet Tag */}
                    {c.registeredOutletName && (
                      <span className="tag-housing" style={{ color: 'var(--ink)' }}>
                        🏪 {c.registeredOutletName.replace(/^Waschen Laundry\s+/i, '')}
                      </span>
                    )}
                  </div>

                  {/* Phone */}
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
                    {c.phone}
                  </div>

                  {/* Stats Row - Total Spend | Transaksi | Deposit | Last Spend */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Total Spend */}
                    <div style={{
                      fontFamily: 'Poppins',
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--magenta)',
                      lineHeight: 1.2,
                    }}>
                      Rp {(c.totalSpendAmount || 0).toLocaleString('id-ID')}
                    </div>

                    {/* Jumlah Transaksi */}
                    <span style={{
                      fontFamily: 'Poppins',
                      fontSize: 10,
                      fontWeight: 600,
                      color: 'var(--ink-soft)',
                      background: 'rgba(59,11,71,0.08)',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}>
                      {c.totalTx || 0}x
                    </span>

                    {/* Saldo Deposit */}
                    {(c.deposit > 0) && (
                      <span className="balance-chip">
                        💰 {(c.deposit || 0).toLocaleString('id-ID')}
                      </span>
                    )}

                    {/* Last Transaction Date */}
                    {c.lastTxDate && (
                      <span className="last-spend-chip">
                        🕐 {new Date(c.lastTxDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow Button - White */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: 'linear-gradient(145deg, #6B2D7E, #4A1A59)',
                  boxShadow: '0 4px 12px rgba(59, 11, 71, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
