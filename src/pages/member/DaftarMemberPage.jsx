import { useState, useEffect } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, SearchBar, Avatar, Chip } from '../../components/ui';

export default function DaftarMemberPage({ navigate }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/customers');
        setCustomers(res?.data?.data || []);
      } catch (err) {
        console.error('[DaftarMember] Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = customers.filter((c) => {
    const matchQuery = (c.name || '').toLowerCase().includes(query.toLowerCase()) || (c.phone || '').includes(query);
    const matchFilter = filter === 'all' ? true : filter === 'premium' ? c.isPremium : !c.isPremium;
    return matchQuery && matchFilter;
  });

  // Stats
  const totalMembers = customers.length;
  const premiumCount = customers.filter((c) => c.isPremium).length;
  const totalDeposit = customers.reduce((s, c) => s + (c.deposit || 0), 0);
  const totalTx = customers.reduce((s, c) => s + (c.totalTx || 0), 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Daftar Member" subtitle={`${totalMembers} member terdaftar`} onBack={() => navigate('dashboard')} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

        {/* ── Stats Banner ────────────────────────────────────────── */}
        {!loading && customers.length > 0 && (
          <div style={{
            background: `linear-gradient(135deg, ${C.primary}, #1E3A5F)`,
            borderRadius: 16, padding: '16px 18px', marginBottom: 14, color: 'white',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700 }}>{totalMembers}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Total</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700, color: '#FDE68A' }}>{premiumCount}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Premium</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 700 }}>{totalTx}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Transaksi</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
              <div>
                <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: '#86EFAC' }}>{rp(totalDeposit)}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Total Deposit</div>
              </div>
            </div>
          </div>
        )}

        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama / no HP..." />

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Chip label={`Semua (${totalMembers})`} active={filter === 'all'} onClick={() => setFilter('all')} />
          <Chip label={`Premium (${premiumCount})`} active={filter === 'premium'} onClick={() => setFilter('premium')} color="#B45309" />
          <Chip label={`Regular (${totalMembers - premiumCount})`} active={filter === 'regular'} onClick={() => setFilter('regular')} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ background: C.white, borderRadius: 14, padding: 14, height: 70, animation: 'pulse 1.5s infinite', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: 36, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 32 }}>👥</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 600, color: C.n900 }}>
              {query ? 'Tidak ada hasil pencarian' : 'Belum ada data member'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
              {query ? 'Coba kata kunci lain' : 'Member akan muncul setelah data pelanggan ditambahkan'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate('detail_customer', c)}
                style={{
                  background: C.white, borderRadius: 14, padding: '12px 14px',
                  boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                  borderLeft: c.isPremium ? '3px solid #F59E0B' : `3px solid ${C.n100}`,
                  transition: 'transform 0.15s',
                }}
              >
                <Avatar initials={c.avatar || (c.name || '').split(' ').map((w) => w[0]).join('').slice(0, 2)} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    {c.isPremium && (
                      <span style={{
                        background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                        color: '#92400E', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 999,
                        display: 'inline-flex', alignItems: 'center', gap: 2,
                      }}>
                        ⭐ PREMIUM
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2 }}>{c.phone}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 5 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, display: 'flex', alignItems: 'center', gap: 3 }}>
                      📋 {c.totalTx || 0} tx
                    </span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.success, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                      💰 {rp(c.deposit || 0)}
                    </span>
                    {c.areaZoneName && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, display: 'flex', alignItems: 'center', gap: 3 }}>
                        📍 {c.areaZoneName}
                      </span>
                    )}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n300} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
