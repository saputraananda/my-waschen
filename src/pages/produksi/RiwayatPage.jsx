import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, SearchBar, Chip, Badge, Btn } from '../../components/ui';

const fmtDate = (v) => {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return String(v); }
};

const fmtDuration = (start, end) => {
  if (!start || !end) return '-';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '-';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}j ${m}m`;
  return `${m} menit`;
};

export default function ProduksiRiwayatPage({ navigate, goBack }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('all');

  const fetchHistory = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await axios.get('/api/transactions/production/queue');
      const all = res?.data?.data || [];
      const done = all.filter(t => t.status === 'selesai' || t.status === 'siap_diambil' || t.status === 'selesai_diambil');
      done.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      setTransactions(done);
    } catch (err) {
      console.error('[ProduksiRiwayat] Error:', err);
      setError('Gagal memuat riwayat produksi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const inPeriod = (dateValue) => {
    if (period === 'all') return true;
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    if (period === 'today') return d.toDateString() === now.toDateString();
    const diff = Math.floor((now - d) / 86400000);
    if (period === '7d') return diff <= 7;
    if (period === '30d') return diff <= 30;
    return true;
  };

  const filtered = transactions.filter(t => {
    const q = query.toLowerCase().trim();
    const matchQ = !q || (t.customerName || '').toLowerCase().includes(q) || (t.id || '').toLowerCase().includes(q);
    const matchP = inPeriod(t.updatedAt || t.createdAt);
    return matchQ && matchP;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Riwayat Produksi" subtitle={`${filtered.length} order selesai`} />

      <div style={{ padding: '12px 16px 0' }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Cari nama customer atau no nota..." />
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 8, paddingBottom: 10, scrollbarWidth: 'none' }}>
          {[
            { value: 'all', label: 'Semua' },
            { value: 'today', label: 'Hari Ini' },
            { value: '7d', label: '7 Hari' },
            { value: '30d', label: '30 Hari' },
          ].map(p => (
            <Chip key={p.value} label={p.label} active={period === p.value} onClick={() => setPeriod(p.value)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.n200}`, borderTop: `3px solid ${C.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat riwayat...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12, textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>Gagal Memuat</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>{error}</div>
            <Btn variant="primary" onClick={fetchHistory} style={{ marginTop: 8 }}>Coba Lagi</Btn>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 15, fontWeight: 700, color: C.n900, marginBottom: 4 }}>Belum ada riwayat</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Order yang sudah selesai dikerjakan akan muncul di sini.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(tx => {
              const stagesDone = (tx.progress || []).length;
              const totalItems = (tx.items || []).reduce((s, i) => s + (i.qty || 1), 0);
              const isExpress = tx.isExpress || tx.items?.some(i => i.express);

              return (
                <div
                  key={tx.id}
                  onClick={() => navigate('detail_item_produksi', tx)}
                  style={{
                    ...T.card, padding: '14px 16px', cursor: 'pointer',
                    borderLeft: `3px solid ${C.success}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, color: C.n900 }}>{tx.customerName}</span>
                        {isExpress && (
                          <span style={{ background: '#FEF3C7', color: '#92400E', fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>⚡ EXPRESS</span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 2 }}>{tx.id}</div>
                    </div>
                    <Badge status={tx.status} small />
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12 }}>📦</span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{totalItems} item</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12 }}>✅</span>
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{stagesDone} tahap selesai</span>
                    </div>
                    {tx.createdAt && tx.updatedAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 12 }}>⏱</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>{fmtDuration(tx.createdAt, tx.updatedAt)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.n100}` }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>
                      Selesai: {fmtDate(tx.updatedAt || tx.createdAt)}
                    </span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>{rp(tx.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
