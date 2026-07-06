import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { TopBar, SearchBar, Avatar, Btn, EmptyState, SkeletonList, Modal, Chip, useAppRefresh } from '../../components/ui';
import { useDebounce } from '../../utils/hooks';
import { useApp } from '../../context/AppContext';

// Loyalty category metadata
const LOYALTY_META = {
  bronze: { label: 'Bronze', bg: C.validationWarningBg, color: C.validationWarningText },
  silver: { label: 'Silver', bg: C.n200, color: C.n700 },
  gold: { label: 'Gold', bg: C.validationWarningBg, color: C.warningDark },
  platinum: { label: 'Platinum', bg: C.infoBg, color: C.infoDark },
  diamond: { label: 'Diamond', bg: C.badgeDiamondBg, color: C.primary },
};


export default function CustomerListPage({ navigate }) {
  const { user } = useApp();
  const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
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
      console.error('Failed to fetch customers:', error);
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Customer" subtitle={`${customers.length} total`} rightAction={() => navigate('tambah_customer')} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>} />

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (loading || loadingMore || !hasMore) return;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
            fetchCustomers(pageRef.current + 1, true);
          }
        }}
        style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 16px' }}
      >
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: C.n50, paddingBottom: 8 }}>
          <SearchBar value={query} onChange={setQuery} placeholder="Cari nama, HP, atau alamat..." />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => setFilterOpen(true)}
              aria-label="Filter"
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: C.primary,
                position: 'relative',
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
                  position: 'absolute', top: 2, right: 2,
                  width: 16, height: 16, borderRadius: 8,
                  background: C.primary, color: C.white,
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{activeFilterCount}</span>
              )}
            </button>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Scroll untuk memuat lebih banyak</div>
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
          <EmptyState title="Customer tidak ditemukan" subtitle="Coba ubah kata kunci pencarian" action={() => navigate('tambah_customer')} actionLabel="+ Tambah Customer" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map((c) => {
              // Format nomor HP untuk WhatsApp (hapus semua non-digit, tambahkan 62 jika dimulai 0)
              const waPhone = (() => {
                const raw = String(c.phone || '').replace(/\D/g, '');
                if (!raw) return null;
                return raw.startsWith('0') ? `62${raw.slice(1)}` : raw;
              })();
              const waHref = waPhone ? `https://wa.me/${waPhone}` : null;

              return (
              <div
                key={c.id}
                onClick={() => navigate('detail_customer', c)}
                style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: SHADOW.sm, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <Avatar initials={c.avatar || c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    {c.isPremium && <span style={{ background: C.validationWarningBg, color: C.validationWarningText, fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>PREMIUM</span>}
                    {!c.isPremium && c.loyaltyCategory && c.loyaltyCategory !== 'new' && (
                      <span style={{ background: LOYALTY_META[c.loyaltyCategory]?.bg || C.n100, color: LOYALTY_META[c.loyaltyCategory]?.color || C.n600, fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 999 }}>
                        {LOYALTY_META[c.loyaltyCategory]?.label || c.loyaltyCategory}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2 }}>{c.phone}</div>
                  {/* Address inline — smart "Blok" prefix (kasus dari cascading picker yang sudah punya prefix) */}
                  {(c.addressHousing || c.addressBlock || c.addressNo) && (() => {
                    const block = String(c.addressBlock || '').trim();
                    const blockHasPrefix = /^(blok|cluster|blk|kav)\b/i.test(block);
                    const blockDisplay = block ? (blockHasPrefix ? block : `Blok ${block}`) : null;
                    return (
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n700, marginTop: 3, display: 'flex', alignItems: 'flex-start', gap: 4, lineHeight: 1.35 }}>
                        <span style={{ flexShrink: 0 }}>📍</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[c.addressHousing, blockDisplay, c.addressNo && `No.${c.addressNo}`]
                            .filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{c.totalTx} transaksi</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n900, fontWeight: 600 }}>Rp {(c.deposit || 0).toLocaleString('id-ID')}</span>
                    {/* Outlet origin tag */}
                    {c.registeredOutletName && (
                      <span style={{ background: C.primaryTint, color: C.primaryDark, fontFamily: 'Poppins', fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999 }}>
                        🏪 {c.registeredOutletName.replace(/^Waschen Laundry\s+/i, '')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>

                  {/* WhatsApp button */}
                  <a
                    href={waHref || '#'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => { if (!waHref) { e.preventDefault(); return; } e.stopPropagation(); }}
                    title={waHref ? `Hubungi ${c.name} via WhatsApp` : 'Nomor tidak tersedia'}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 36, height: 36,
                      borderRadius: 10,
                      background: waHref ? '#25D366' : C.n200,
                      border: 'none',
                      cursor: waHref ? 'pointer' : 'not-allowed',
                      textDecoration: 'none',
                      boxShadow: waHref ? '0 2px 8px rgba(37,211,102,0.35)' : 'none',
                      opacity: waHref ? 1 : 0.5,
                      pointerEvents: waHref ? 'auto' : 'none',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={waHref ? C.white : C.n400}>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.022 6.988 2.824a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.394-5.775c-.14-.05-.677-.334-1.006-.371-.328-.037-.53-.056-.77-.056-.24 0-.48.019-.69.056-.321.074-.752.27-.99.6-.241.335-.396.744-.44.95-.046.208.019.482.21.948.18.436.331.93.357 1.05.037.17.113.33.25.47.135.144.3.306.516.487.22.188.392.342.532.46.143.12.286.23.408.34.135.119.273.24.403.346.13.108.259.216.387.322.128.106.25.212.371.319.123.108.242.217.357.327.15.146.296.298.432.453z"/>
                    </svg>
                  </a>

                  {/* Add Nota button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate('nota_step1', { preCustomer: c }); }}
                    style={{ width: 36, height: 36, borderRadius: 10, background: C.primaryLight, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </button>
                </div>
              </div>
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

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
        <Btn variant="primary" fullWidth onClick={() => navigate('tambah_customer')} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}>
          Tambah Customer
        </Btn>
      </div>

      <Modal visible={filterOpen} onClose={() => setFilterOpen(false)} title="Filter Customer">
        <div style={{ padding: '16px 18px' }}>
          {outlets.length > 0 && (
            <>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>🏪 Outlet Asal Customer</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Chip label="Semua Outlet" active={outletFilter === 'all'} onClick={() => setOutletFilter('all')} />
                {outlets.map((o) => (
                  <Chip
                    key={o.id}
                    label={o.name.replace(/^Waschen Laundry\s+/i, '')}
                    active={String(outletFilter) === String(o.id)}
                    onClick={() => setOutletFilter(o.id)}
                  />
                ))}
              </div>
            </>
          )}

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>Status Member</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { value: 'all', label: 'Semua' },
              { value: 'premium', label: 'Premium' },
              { value: 'regular', label: 'Regular' },
            ].map((f) => (
              <Chip key={f.value} label={f.label} active={memberFilter === f.value} onClick={() => setMemberFilter(f.value)} />
            ))}
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>Kategori Loyalitas</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { value: 'all', label: 'Semua' },
              { value: 'loyal', label: '💎 Loyal' },
              { value: 'regular', label: '⭐ Reguler' },
              { value: 'one_time', label: '📋 Satu Kali' },
              { value: 'churn', label: '⚠️ Churn' },
            ].map((f) => (
              <Chip key={f.value} label={f.label} active={loyaltyFilter === f.value} onClick={() => setLoyaltyFilter(f.value)} />
            ))}
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 8 }}>Urutkan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} active={sortBy === s.value} onClick={() => setSortBy(s.value)} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              onClick={() => {
                setMemberFilter('all');
                setLoyaltyFilter('all');
                setSortBy('name_asc');
                setOutletFilter('all');
              }}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: `1.5px solid ${C.n200}`,
                background: C.n50,
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 600,
                color: C.n600,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
            <button
              onClick={() => setFilterOpen(false)}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: 'none',
                background: C.primary,
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: 600,
                color: C.white,
                cursor: 'pointer',
              }}
            >
              Terapkan
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
