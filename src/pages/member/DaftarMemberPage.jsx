import { useState } from 'react';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, SearchBar, Avatar, Btn, Chip } from '../../components/ui';

export default function DaftarMemberPage({ customers, navigate }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = customers.filter((c) => {
    const matchQuery = c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query);
    const matchFilter = filter === 'all' ? true : filter === 'premium' ? c.isPremium : !c.isPremium;
    return matchQuery && matchFilter;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Daftar Member" subtitle={`${customers.length} member`} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari member..." />

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Chip label="Semua" active={filter === 'all'} onClick={() => setFilter('all')} />
          <Chip label="Premium" active={filter === 'premium'} onClick={() => setFilter('premium')} color="#B45309" />
          <Chip label="Regular" active={filter === 'regular'} onClick={() => setFilter('regular')} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate('detail_customer', c)}
              style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <Avatar initials={c.avatar || c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{c.name}</div>
                  {c.isPremium && <span style={{ background: '#FEF3C7', color: '#B45309', fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>✦ PREMIUM</span>}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2 }}>{c.phone}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>🧾 {c.totalTx} tx</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.success, fontWeight: 600 }}>💳 {rp(c.deposit || 0)}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.warning }}>⭐ {c.poin || 0} poin</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
