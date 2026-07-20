import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, SearchBar, Btn, EmptyState, SkeletonList, Modal, Chip, useAppRefresh, ProfileAvatar } from '../../components/ui';
import { AnimatedListItem } from '../../components/AnimatedList';
import { useDebounce } from '../../utils/hooks';
import { useApp } from '../../context/AppContext';
import { motion } from 'framer-motion';
import { buildWaMeLink } from '../../utils/helpers';

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
    --glass: rgba(255, 255, 255, 0.7);
    --glass-strong: rgba(255, 255, 255, 0.85);
    --ink: #2B1130;
    --ink-soft: #7A6584;
  }

  .glass-card {
    background: var(--glass-strong);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    box-shadow:
      0 20px 40px -12px rgba(59, 11, 71, 0.22),
      0 4px 12px rgba(59, 11, 71, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .clay-avatar {
    border-radius: 18px;
    background: linear-gradient(145deg, #FFFFFF, #E9D3F2);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.7),
      5px 6px 14px rgba(59, 11, 71, 0.25),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .clay-btn-success {
    border-radius: 14px;
    background: linear-gradient(145deg, #5FD9AE 0%, #1F9E75 100%);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.6),
      5px 6px 14px rgba(31, 158, 117, 0.4),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .clay-btn-add {
    border-radius: 14px;
    background: linear-gradient(145deg, #7B3D99 0%, #5C1A6B 100%);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.5),
      5px 6px 14px rgba(59, 11, 71, 0.3),
      inset 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  .clay-btn-primary {
    border-radius: 14px;
    background: linear-gradient(145deg, #6B2D7E, #4A1A59);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.4),
      5px 6px 14px rgba(59, 11, 71, 0.35),
      inset 0 1px 1px rgba(255, 255, 255, 0.3);
  }

  .clay-btn-secondary {
    border-radius: 14px;
    background: linear-gradient(145deg, #F5E9FB, #E9D3F2);
    box-shadow:
      -4px -4px 10px rgba(255, 255, 255, 0.6),
      5px 6px 14px rgba(59, 11, 71, 0.2),
      inset 0 1px 1px rgba(255, 255, 255, 0.5);
  }

  .loyalty-badge {
    font-family: 'Poppins', sans-serif;
    font-size: 9px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
    letter-spacing: 0.3px;
  }

  .tag-housing {
    font-family: 'Poppins', sans-serif;
    font-size: 10px;
    fontWeight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(59, 11, 71, 0.1);
  }

  /* Header gradient with blobs */
  .tx-header {
    background:
      radial-gradient(circle at 85% -10%, rgba(232,90,168,0.55) 0%, transparent 55%),
      radial-gradient(circle at -10% 20%, rgba(95,217,174,0.25) 0%, transparent 45%),
      linear-gradient(155deg, var(--purple-deep) 0%, var(--purple-mid) 55%, #4A1259 100%);
    position: relative;
    overflow: hidden;
  }

  .blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    filter: blur(18px);
  }

  .tx-blob-1 {
    width: 180px;
    height: 180px;
    background: radial-gradient(circle, rgba(232,90,168,0.55) 0%, transparent 70%);
    top: -60px;
    right: -40px;
    animation: floatB 11s ease-in-out infinite;
  }

  .tx-blob-2 {
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(95,217,174,0.35) 0%, transparent 70%);
    bottom: 20px;
    left: -50px;
    animation: floatC 16s ease-in-out infinite;
  }

  .tx-blob-3 {
    width: 90px;
    height: 90px;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    top: 40px;
    left: 55%;
    animation: floatA 9s ease-in-out infinite;
  }

  @keyframes floatA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-14px, 16px) scale(1.08); } }
  @keyframes floatB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(18px, -12px) scale(1.1); } }
  @keyframes floatC { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(16px, 10px) scale(0.95); } }

  @media (prefers-reduced-motion: reduce) { .tx-blob-1, .tx-blob-2, .tx-blob-3 { animation: none; } }
`;

// Inject styles on mount
function useGlassStyles() {
  useEffect(() => {
    const styleId = 'glass-tx-styles';
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

// Customer avatar with clay style + gender-based defaults
function CustomerAvatar({ customer, size = 50 }) {
  useGlassStyles();

  return (
    <div
      className="clay-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: 18,
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
          borderRadius: 18,
          width: size,
          height: size,
        }}
      />
    </div>
  );
}

// Loyalty category metadata with glass aesthetic
const LOYALTY_META = {
  loyal: { label: 'Loyal', bg: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#5D3A00', border: '1px solid rgba(255,215,0,0.4)' },
  regular: { label: 'Regular', bg: 'linear-gradient(135deg, #E8E0F0, #D0C0E8)', color: '#4A2063', border: '1px solid rgba(180,140,220,0.3)' },
  one_time: { label: 'Baru', bg: 'linear-gradient(135deg, #C8F7DC, #8DE4B0)', color: '#1F6B4A', border: '1px solid rgba(100,220,150,0.3)' },
  churn: { label: 'Churn', bg: 'linear-gradient(135deg, #FFE0E0, #FFB8B8)', color: '#8B2020', border: '1px solid rgba(255,120,120,0.3)' },
};


export default function CustomerListPage({ navigate }) {
  const { user } = useApp();
  const globalRoles = ['admin'];
  const isAdmin = globalRoles.includes(user?.roleCode || user?.role);
  const [customers, setCustomers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [outletFilter, setOutletFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState('name_asc');
  const [memberFilter, setMemberFilter] = useState('all');
  const [loyaltyFilter, setLoyaltyFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 250);
  const scrollRef = useRef(null);
  const pageRef = useRef(1);
  const PAGE_SIZE = 30;
  const SORTS = useMemo(() => ([
    { value: 'name_asc', label: 'Nama A-Z' },
    { value: 'newest', label: 'Terbaru' },
    { value: 'frequent', label: 'Paling sering datang' },
  ]), []);

  // Fetch outlets list (semua role — biar bisa filter customer per outlet asal)
  useEffect(() => {
    axios.get('/api/master/outlets')
      .then((r) => setOutlets(r?.data?.data || []))
      .catch(() => setOutlets([]));
  }, []);

  const fetchCustomers = useCallback(async (pageToLoad, append = false) => {
    setError(null);
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = {
        search: debouncedQuery.trim() || undefined,
        page: pageToLoad,
        limit: PAGE_SIZE,
        sort: sortBy,
        member: memberFilter !== 'all' ? memberFilter : undefined,
        loyalty: loyaltyFilter !== 'all' ? loyaltyFilter : undefined,
        outletId: outletFilter !== 'all' ? outletFilter : undefined,
      };
      const res = await axios.get('/api/customers', { params });
      const data = res?.data?.data || [];
      const pagination = res?.data?.pagination || {};
      setHasMore((pagination.page || pageToLoad) < (pagination.totalPages || 1));
      pageRef.current = pagination.page || pageToLoad;
      setPage(pageRef.current);
      setCustomers((prev) => (append ? [...prev, ...data] : data));
    } catch (error) {
      setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedQuery, sortBy, memberFilter, loyaltyFilter, isAdmin, outletFilter]);

  useEffect(() => {
    pageRef.current = 1;
    setPage(1);
    setHasMore(true);
    fetchCustomers(1, false);
  }, [fetchCustomers]);

  // Pull-to-refresh
  useAppRefresh(() => fetchCustomers(1, false), [fetchCustomers]);

  const activeFilterCount = [
    sortBy !== 'name_asc',
    memberFilter !== 'all',
    loyaltyFilter !== 'all',
    outletFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', overflow: 'hidden' }}>
      {/* Glass header with gradient */}
      <div className="tx-header" style={{
        position: 'relative',
        padding: '16px 16px 20px',
        overflow: 'hidden',
      }}>
        {/* Atmospheric blobs */}
        <div className="blob tx-blob-1" />
        <div className="blob tx-blob-2" />
        <div className="blob tx-blob-3" />

        {/* Header content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 24, fontWeight: 800, color: C.white, textShadow: '0 2px 8px rgba(59,11,71,0.3)' }}>Customer</div>
          <div style={{ fontFamily: 'Poppins', fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>{customers.length} total</div>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (loading || loadingMore || !hasMore) return;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
            fetchCustomers(pageRef.current + 1, true);
          }
        }}
        style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}
      >
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--glass-bg)', padding: '12px 0 8px' }}>
          {/* Glass search bar */}
          <div className="glass-card" style={{
            padding: '4px 4px 4px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, HP, atau alamat..."
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontFamily: 'Poppins',
                fontSize: 13,
                color: 'var(--ink)',
                background: 'transparent',
                padding: '10px 0',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => setFilterOpen(true)}
              aria-label="Filter"
              className="clay-avatar"
              style={{
                padding: '8px 10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--purple-mid)',
                position: 'relative',
                height: 40,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="14" y2="6" />
                <line x1="20" y1="6" x2="18" y2="6" />
                <circle cx="16" cy="6" r="2" />
                <line x1="4" y1="12" x2="6" y2="12" />
                <line x1="20" y1="12" x2="10" y2="12" />
                <circle cx="8" cy="12" r="2" />
                <line x1="4" y1="18" x2="12" y2="18" />
                <line x1="20" y1="18" x2="16" y2="18" />
                <circle cx="14" cy="18" r="2" />
              </svg>
              {activeFilterCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0,
                  width: 18, height: 18, borderRadius: 9,
                  background: 'var(--coral)', color: '#FFF',
                  fontFamily: 'Poppins', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{activeFilterCount}</span>
              )}
            </button>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--ink-soft)' }}>Scroll untuk memuat lebih banyak</div>
          </div>
        </div>

        {loading ? (
          <SkeletonList count={5} avatar lines={2} />
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: C.validationErrorBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Gagal Memuat Data</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{error}</div>
            <Btn variant="primary" onClick={() => fetchCustomers(1, false)} style={{ marginTop: 8 }}>Coba Lagi</Btn>
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            type="customers"
            title="Customer tidak ditemukan"
            message="Coba ubah kata kunci pencarian atau tambahkan customer baru"
            action={{
              label: "+ Tambah Customer",
              onClick: () => navigate('tambah_customer')
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customers.map((c, idx) => {
              // Format nomor HP untuk WhatsApp (hapus semua non-digit, tambahkan 62 jika dimulai 0)
              const waHref = buildWaMeLink(c.phone);

              return (
                <AnimatedListItem
                  key={c.id}
                  delay={idx}
                  index={idx}
                  onClick={() => navigate('detail_customer', c)}
                >
                  <div className="glass-card" style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    {/* Decorative blob accent */}
                    <div style={{
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(232,90,168,0.12) 0%, transparent 70%)',
                      pointerEvents: 'none',
                    }} />

                    <CustomerAvatar customer={c} size={52} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name + Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        {c.isPremium && <span className="loyalty-badge" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#5D3A00' }}>PREMIUM</span>}
                        {!c.isPremium && c.membershipTier && c.membershipTier !== 'regular' && (
                          <span className="loyalty-badge" style={{
                            background: 'linear-gradient(135deg, #E8E0F0, #D0C0E8)',
                            color: '#4A2063',
                            border: '1px solid rgba(180,140,220,0.3)',
                          }}>
                            {c.membershipTier.toUpperCase()}
                          </span>
                        )}
                        {!c.isPremium && c.loyaltyCategory && c.loyaltyCategory !== 'new' && LOYALTY_META[c.loyaltyCategory] && (
                          <span className="loyalty-badge" style={{
                            background: LOYALTY_META[c.loyaltyCategory].bg,
                            color: LOYALTY_META[c.loyaltyCategory].color,
                            border: LOYALTY_META[c.loyaltyCategory].border,
                          }}>
                            {LOYALTY_META[c.loyaltyCategory].label}
                          </span>
                        )}
                      </div>
                      {/* Phone */}
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{c.phone}</div>
                      {/* Address */}
                      {(c.addressHousing || c.addressBlock || c.addressNo) && (() => {
                        const block = String(c.addressBlock || '').trim();
                        const blockHasPrefix = /^(blok|cluster|blk|kav)\b/i.test(block);
                        const blockDisplay = block ? (blockHasPrefix ? block : `Blok ${block}`) : null;
                        return (
                          <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--ink-soft)', marginTop: 3, display: 'flex', alignItems: 'flex-start', gap: 4, lineHeight: 1.35 }}>
                            <span>📍</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[c.addressHousing, blockDisplay, c.addressNo && `No.${c.addressNo}`]
                                .filter(Boolean).join(' · ')}
                            </span>
                          </div>
                        );
                      })()}
                      {/* Info row */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500 }}>{c.totalTx || 0} transaksi</span>
                        {/* Saldo pill - selalu tampil */}
                        <span style={{
                          fontFamily: 'Poppins',
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: c.deposit > 0
                            ? 'linear-gradient(135deg, #5FD9AE, #1F9E75)'
                            : 'rgba(255, 255, 255, 0.7)',
                          color: c.deposit > 0 ? '#FFFFFF' : '#B0A0B8',
                          boxShadow: c.deposit > 0
                            ? '0 2px 8px rgba(31, 158, 117, 0.35)'
                            : '0 1px 4px rgba(59, 11, 71, 0.08)',
                        }}>
                          💰 Saldo Rp {(c.deposit || 0).toLocaleString('id-ID')}
                        </span>
                        {typeof c.totalSpend === 'number' && c.totalSpend > 0 && (
                          <span style={{ fontFamily: 'Poppins', fontSize: 11, color: 'var(--magenta)', fontWeight: 600 }}>Total Rp {c.totalSpend.toLocaleString('id-ID')}</span>
                        )}
                      </div>
                      {/* Bottom row */}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {c.lastSpendDate && (
                          <span style={{ fontFamily: 'Poppins', fontSize: 10, color: 'var(--ink-soft)', background: 'rgba(59,11,71,0.06)', padding: '2px 8px', borderRadius: 999 }}>
                            Terakhir {new Date(c.lastSpendDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                        {c.registeredOutletName && (
                          <span className="tag-housing" style={{ color: 'var(--ink)' }}>
                            🏪 {c.registeredOutletName.replace(/^Waschen Laundry\s+/i, '')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons with clay style - vertical layout */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      {/* Add Nota button - TOP */}
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('nota_step1', { preCustomer: c }); }}
                        className="clay-btn-add"
                        style={{
                          width: 38, height: 38,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: C.white,
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      </button>
                      {/* WhatsApp button - BOTTOM */}
                      <a
                        href={waHref || '#'}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => { if (!waHref) { e.preventDefault(); return; } e.stopPropagation(); }}
                        title={waHref ? `Hubungi ${c.name} via WhatsApp` : 'Nomor tidak tersedia'}
                        className="clay-btn-success"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 38, height: 38,
                          borderRadius: 12,
                          border: 'none',
                          cursor: waHref ? 'pointer' : 'not-allowed',
                          textDecoration: 'none',
                          opacity: waHref ? 1 : 0.4,
                          pointerEvents: waHref ? 'auto' : 'none',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFFFFF">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.022 6.988 2.824a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.394-5.775c-.14-.05-.677-.334-1.006-.371-.328-.037-.53-.056-.77-.056-.24 0-.48.019-.69.056-.321.074-.752.27-.99.6-.241.335-.396.744-.44.95-.046.208.019.482.21.948.18.436.331.93.357 1.05.037.17.113.33.25.47.135.144.3.306.516.487.22.188.392.342.532.46.143.12.286.23.408.34.135.119.273.24.403.346.13.108.259.216.387.322.128.106.25.212.371.319.123.108.242.217.357.327.15.146.296.298.432.453z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </AnimatedListItem>
              );
            })}
          </div>
        )}

        {loadingMore && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', color: C.n600, fontFamily: 'Poppins', fontSize: 12 }}>
            Memuat data berikutnya...
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--glass-bg)', borderTop: '1px solid rgba(255,255,255,0.5)' }}>
        <button
          onClick={() => navigate('tambah_customer')}
          className="clay-btn-primary"
          style={{
            width: '100%',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.white }}>Tambah Customer</span>
        </button>
      </div>

      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)}>
        <div style={{ padding: '8px 0 16px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '0 18px' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Filter & Urutan</div>
            <button
              onClick={() => setFilterOpen(false)}
              style={{
                width: 36, height: 36, borderRadius: 18, border: 'none',
                background: 'linear-gradient(135deg, #6B2D7E20, #4A1A5920)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#5B005F',
                boxShadow: '0 2px 8px rgba(91, 0, 95, 0.15)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Outlet filter */}
          {outlets.length > 0 && (
            <>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8, padding: '0 18px' }}>🏪 Outlet Asal Customer</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '0 18px' }}>
                <button
                  onClick={() => setOutletFilter('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Poppins',
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                    background: outletFilter === 'all'
                      ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                      : 'rgba(255, 255, 255, 0.7)',
                    color: outletFilter === 'all' ? '#FFFFFF' : '#7A6584',
                    boxShadow: outletFilter === 'all'
                      ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                      : '0 2px 8px rgba(59, 11, 71, 0.08)',
                  }}
                >
                  Semua Outlet
                </button>
                {outlets.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOutletFilter(o.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'Poppins',
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                      background: String(outletFilter) === String(o.id)
                        ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                        : 'rgba(255, 255, 255, 0.7)',
                      color: String(outletFilter) === String(o.id) ? '#FFFFFF' : '#7A6584',
                      boxShadow: String(outletFilter) === String(o.id)
                        ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                        : '0 2px 8px rgba(59, 11, 71, 0.08)',
                    }}
                  >
                    {o.name.replace(/^Waschen Laundry\s+/i, '')}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Status Member */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8, padding: '0 18px' }}>⭐ Status Member</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '0 18px' }}>
            {[
              { value: 'all', label: 'Semua' },
              { value: 'premium', label: 'Premium' },
              { value: 'regular', label: 'Regular' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setMemberFilter(f.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  background: memberFilter === f.value
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: memberFilter === f.value ? '#FFFFFF' : '#7A6584',
                  boxShadow: memberFilter === f.value
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Kategori Loyalitas */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8, padding: '0 18px' }}>💎 Kategori Loyalitas</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '0 18px' }}>
            {[
              { value: 'all', label: 'Semua' },
              { value: 'loyal', label: 'Loyal' },
              { value: 'regular', label: 'Reguler' },
              { value: 'one_time', label: 'Satu Kali' },
              { value: 'churn', label: 'Churn' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setLoyaltyFilter(f.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  background: loyaltyFilter === f.value
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: loyaltyFilter === f.value ? '#FFFFFF' : '#7A6584',
                  boxShadow: loyaltyFilter === f.value
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Urutkan */}
          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8, padding: '0 18px' }}>🔄 Urutkan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '0 18px' }}>
            {SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSortBy(s.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  background: sortBy === s.value
                    ? 'linear-gradient(135deg, #6B2D7E, #4A1A59)'
                    : 'rgba(255, 255, 255, 0.7)',
                  color: sortBy === s.value ? '#FFFFFF' : '#7A6584',
                  boxShadow: sortBy === s.value
                    ? '0 4px 12px rgba(59, 11, 71, 0.25)'
                    : '0 2px 8px rgba(59, 11, 71, 0.08)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, padding: '0 18px' }}>
            <button
              onClick={() => {
                setMemberFilter('all');
                setLoyaltyFilter('all');
                setSortBy('name_asc');
                setOutletFilter('all');
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                border: '1.5px solid rgba(255, 255, 255, 0.6)',
                background: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'Poppins',
                fontSize: 13,
                fontWeight: 600,
                color: '#7A6584',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
            <button
              onClick={() => setFilterOpen(false)}
              style={{
                flex: 2,
                height: 44,
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #6B2D7E, #4A1A59)',
                fontFamily: 'Poppins',
                fontSize: 13,
                fontWeight: 600,
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 11, 71, 0.25)',
              }}
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
