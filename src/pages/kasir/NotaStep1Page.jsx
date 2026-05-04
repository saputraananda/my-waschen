import { useState } from 'react';
import { C } from '../../utils/theme';
import { TopBar, SearchBar, Avatar, Btn, EmptyState } from '../../components/ui';

export default function NotaStep1Page({ customers, navigate, setNotaCustomer }) {
  const [query, setQuery] = useState('');

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query)
  );

  const selectCustomer = (c) => {
    setNotaCustomer(c);
    navigate('nota_step2');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Buat Nota" subtitle="Langkah 1 dari 3 — Pilih Customer" onBack={() => navigate('dashboard')} />

      <div style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= 1 ? C.primary : C.n200 }} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama atau nomor HP..." />

        {filtered.length === 0 ? (
          <EmptyState title="Customer tidak ditemukan" subtitle="Tambah customer baru?" action={() => navigate('tambah_customer')} actionLabel="+ Tambah Customer" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCustomer(c)}
                style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <Avatar initials={c.avatar || c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{c.name}</div>
                    {c.isPremium && <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, fontFamily: 'Poppins' }}>PREMIUM</span>}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginTop: 2 }}>{c.phone}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.success, fontWeight: 600, marginTop: 2 }}>Deposit: Rp {(c.deposit || 0).toLocaleString('id-ID')}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: C.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', background: C.white, borderTop: `1px solid ${C.n100}` }}>
        <Btn variant="secondary" fullWidth onClick={() => navigate('tambah_customer')}>
          + Customer Baru
        </Btn>
      </div>
    </div>
  );
}
