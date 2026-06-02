import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, SearchBar, Avatar, Btn, EmptyState, SkeletonList, Modal, Chip, useAppRefresh } from '../../components/ui';
import { useDebounce } from '../../utils/hooks';
import { useApp } from '../../context/AppContext';


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
  }, [debouncedQuery, sortBy, memberFilter, isAdmin, outletFilter]);

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
                color: '#7C3AED',
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
                  background: '#7C3AED', color: 'white',
                  fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{activeFilterCount}</span>
              )}
            </button>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Scroll untuk memuat lebih banyak</div>
          </div>
        </div>

        {loading ? (
          <SkeletonList count={5} avatar lines={2} />
        ) : error ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Gagal Memuat Data</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{error}</div>
            <Btn variant="primary" onClick={fetchCustomers} style={{ marginTop: 8 }}>Coba Lagi</Btn>
          </div>
        ) : loading ? (
          <SkeletonList count={5} avatar lines={2} />
        ) : customers.length === 0 ? (
          <EmptyState title="Customer tidak ditemukan" subtitle="Coba ubah kata kunci pencarian" action={() => navigate('tambah_customer')} actionLabel="+ Tambah Customer" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {customers.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate('detail_customer', c)}
                style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <Avatar initials={c.avatar || c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    {c.isPremium && <span style={{ background: '#FEF3C7', color: '#B45309', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>PREMIUM</span>}
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
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.success, fontWeight: 600 }}>Rp {(c.deposit || 0).toLocaleString('id-ID')}</span>
                    {/* Outlet origin tag */}
                    {c.registeredOutletName && (
                      <span style={{ background: '#EDE9FE', color: '#6D28D9', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>
                        🏪 {c.registeredOutletName.replace(/^Waschen Laundry\s+/i, '')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('nota_step1', { preCustomer: c }); }}
                  style={{ width: 36, height: 36, borderRadius: 10, background: C.primaryLight, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {loadingMore && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 0', color: C.n500, fontFamily: 'Poppins', fontSize: 12 }}>
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
              <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>🏪 Outlet Asal Customer</div>
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

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>Status Member</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { value: 'all', label: 'Semua' },
              { value: 'premium', label: 'Premium' },
              { value: 'regular', label: 'Regular' },
            ].map((f) => (
              <Chip key={f.value} label={f.label} active={memberFilter === f.value} onClick={() => setMemberFilter(f.value)} />
            ))}
          </div>

          <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, marginBottom: 8 }}>Urutkan</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SORTS.map((s) => (
              <Chip key={s.value} label={s.label} active={sortBy === s.value} onClick={() => setSortBy(s.value)} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              onClick={() => {
                setMemberFilter('all');
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
                fontWeight: 700,
                color: 'white',
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
