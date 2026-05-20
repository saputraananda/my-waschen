import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { TopBar, SearchBar, Avatar, Btn, EmptyState, SkeletonList } from '../../components/ui';
import { useDebounce } from '../../utils/hooks';

export default function CustomerListPage({ navigate }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const debouncedQuery = useDebounce(query, 250);

  const fetchCustomers = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const url = debouncedQuery.trim()
        ? `/api/customers?search=${encodeURIComponent(debouncedQuery.trim())}&limit=100`
        : `/api/customers?limit=100`;
      const res = await axios.get(url);
      setCustomers(res?.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setError('Gagal memuat data. Tap untuk coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Customer" subtitle={`${customers.length} total`} rightAction={() => navigate('tambah_customer')} rightIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 16px' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama atau nomor HP..." />

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
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{c.totalTx} transaksi</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.success, fontWeight: 600 }}>Rp {(c.deposit || 0).toLocaleString('id-ID')}</span>
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
      </div>

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
        <Btn variant="primary" fullWidth onClick={() => navigate('tambah_customer')} icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}>
          Tambah Customer
        </Btn>
      </div>
    </div>
  );
}
