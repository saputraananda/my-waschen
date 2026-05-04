import { useState } from 'react';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, SearchBar, Badge, Chip, Avatar, EmptyState } from '../../components/ui';

const FILTERS = ['semua', 'baru', 'proses', 'selesai', 'diambil', 'dibatalkan'];

export default function TransaksiListPage({ transactions, navigate, historyOnly }) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('semua');

  const list = transactions.filter((t) => {
    const matchQuery =
      t.customerName.toLowerCase().includes(query.toLowerCase()) ||
      t.id.toLowerCase().includes(query.toLowerCase());
    const matchFilter = activeFilter === 'semua' ? true : t.status === activeFilter;
    const matchHistory = historyOnly ? t.status === 'selesai' || t.status === 'diambil' : true;
    return matchQuery && matchFilter && matchHistory;
  });

  const title = historyOnly ? 'Riwayat Produksi' : 'Transaksi';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title={title} subtitle={`${transactions.length} total`} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama atau no nota..." />

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none', marginBottom: 4 }}>
          {FILTERS.map((f) => (
            <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={activeFilter === f} onClick={() => setActiveFilter(f)} />
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState title="Tidak ada transaksi" subtitle="Belum ada transaksi yang sesuai filter" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((tx) => (
              <div
                key={tx.id}
                onClick={() => navigate('detail_transaksi', tx)}
                style={{ background: C.white, borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 8px rgba(15,23,42,0.05)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Avatar initials={tx.customerName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={40} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>
                      <Badge status={tx.status} small />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{tx.id}</span>
                      {tx.items?.some((i) => i.express) && (
                        <span style={{ background: '#FEF3C7', color: C.warning, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡ Express</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>📅 {tx.date}</span>
                        {tx.dueDate && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>⏰ {tx.dueDate}</span>}
                      </div>
                      <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{rp(tx.total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
