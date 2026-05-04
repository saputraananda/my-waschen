import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Badge, Avatar } from '../../components/ui';

export default function MonitoringPage({ transactions, navigate }) {
  const byStatus = {
    baru: transactions.filter((t) => t.status === 'baru'),
    proses: transactions.filter((t) => t.status === 'proses'),
    selesai: transactions.filter((t) => t.status === 'selesai'),
    diambil: transactions.filter((t) => t.status === 'diambil'),
  };

  const COLS = [
    { key: 'baru', label: 'Baru', color: '#0EA5E9' },
    { key: 'proses', label: 'Proses', color: C.warning },
    { key: 'selesai', label: 'Selesai', color: C.success },
    { key: 'diambil', label: 'Diambil', color: C.primary },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Monitoring" subtitle="Real-time status laundry" onBack={() => navigate('dashboard')} />

      {/* Summary bar */}
      <div style={{ display: 'flex', padding: '12px 16px', gap: 10, background: C.white, borderBottom: `1px solid ${C.n100}` }}>
        {COLS.map((col) => (
          <div key={col.key} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 20, fontWeight: 700, color: col.color }}>{byStatus[col.key].length}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600 }}>{col.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
        {COLS.map((col) => (
          <div key={col.key} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{col.label} ({byStatus[col.key].length})</div>
            </div>

            {byStatus[col.key].length === 0 && (
              <div style={{ background: C.white, borderRadius: 12, padding: '16px', textAlign: 'center', borderStyle: 'dashed', borderWidth: 1.5, borderColor: C.n200 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Tidak ada</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byStatus[col.key].map((tx) => (
                <div key={tx.id} onClick={() => navigate('detail_transaksi', tx)} style={{ background: C.white, borderRadius: 12, padding: '10px 12px', boxShadow: '0 2px 6px rgba(15,23,42,0.05)', cursor: 'pointer', borderLeft: `3px solid ${col.color}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar initials={tx.customerName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{tx.customerName}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{tx.id}</span>
                      {tx.items?.some((i) => i.express) && <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.warning }}>⚡ Express</span>}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(tx.total)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
