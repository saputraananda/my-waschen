import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar } from '../../components/ui';

const STATUS_META = {
  draft:            { label: 'Draft',      color: '#64748B', bg: '#F1F5F9', icon: '📝' },
  pending:          { label: 'Menunggu',   color: '#2563EB', bg: '#EFF6FF', icon: '⏳' },
  process:          { label: 'Diproses',   color: '#D97706', bg: '#FFFBEB', icon: '🔄' },
  ready_for_pickup: { label: 'Siap Ambil', color: '#059669', bg: '#ECFDF5', icon: '✅' },
  ready_for_delivery: { label: 'Diantar', color: '#7C3AED', bg: '#F5F3FF', icon: '🚚' },
  completed:        { label: 'Selesai',    color: '#166534', bg: '#F0FDF4', icon: '✔️' },
};

const FILTER_TABS = [
  { key: 'active',           label: 'Aktif' },
  { key: 'process',          label: 'Proses' },
  { key: 'ready_for_pickup', label: 'Siap Ambil' },
  { key: 'all',              label: 'Semua' },
];

const fmtTime = (v) => {
  if (!v) return '-';
  return new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
};

const msElapsed = (v) => {
  if (!v) return null;
  const ms = Date.now() - new Date(v).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}h ${h % 24}j`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
};

export default function KasirAntrianPage({ navigate, goBack }) {
  const [tab, setTab] = useState('active');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/transactions?limit=80&sortBy=created_at&sortDir=desc';
      if (tab === 'active') url += '&status=draft,pending,process';
      else if (tab === 'process') url += '&status=process';
      else if (tab === 'ready_for_pickup') url += '&status=ready_for_pickup';
      const res = await axios.get(url);
      setOrders(res?.data?.data?.transactions || res?.data?.data || []);
    } catch { setOrders([]); } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const markReady = async (tx) => {
    setUpdating(tx.id);
    try {
      await axios.patch(`/api/transactions/${tx.id}/status`, { status: 'ready_for_pickup' });
      showToast(`${tx.transactionNo || tx.id} ditandai Siap Ambil ✅`);
      fetchOrders();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Gagal update status', false);
    } finally { setUpdating(null); }
  };

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (o.transactionNo || o.id || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Antrian Order" subtitle="Status order aktif hari ini" onBack={goBack} />

      {/* Search */}
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama customer atau no. nota…"
            style={{ width: '100%', height: 42, borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 13, paddingLeft: 36, paddingRight: 12, boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto' }}>
        {FILTER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(''); }}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 999, fontFamily: 'Poppins', fontSize: 12, fontWeight: tab === t.key ? 700 : 500, background: tab === t.key ? C.primary : C.white, color: tab === t.key ? 'white' : C.n600, border: `1.5px solid ${tab === t.key ? C.primary : C.n200}`, cursor: 'pointer' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 28, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat antrian…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ background: C.white, borderRadius: 14, padding: 28, textAlign: 'center', marginTop: 8 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700 }}>Tidak ada order {tab === 'active' ? 'aktif' : 'di status ini'}</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 4 }}>Semua order sudah ditangani</div>
          </div>
        )}

        {!loading && filtered.map((tx) => {
          const sm = STATUS_META[tx.status] || STATUS_META.pending;
          const elapsed = msElapsed(tx.createdAt);
          const isUpdating = updating === tx.id;
          const canMarkReady = tx.status === 'process';

          return (
            <div key={tx.id} style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 6px rgba(15,23,42,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Status icon */}
                <div style={{ width: 40, height: 40, borderRadius: 12, background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                  {sm.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{tx.transactionNo || tx.id}</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>{rp(tx.total)}</span>
                  </div>

                  <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800, marginTop: 2 }}>{tx.customerName}</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: sm.color, background: sm.bg, padding: '2px 8px', borderRadius: 999 }}>{sm.label}</span>
                    {tx.isExpress && <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '2px 6px', borderRadius: 999 }}>⚡ Express</span>}
                    <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{fmtTime(tx.createdAt)}</span>
                    {elapsed && <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n400 }}>· {elapsed} lalu</span>}
                  </div>
                </div>
              </div>

              {/* Actions row */}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.n100}` }}>
                <button
                  onClick={() => navigate('detail_transaksi', tx)}
                  style={{ flex: 1, height: 34, borderRadius: 8, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, cursor: 'pointer' }}
                >
                  Lihat Detail
                </button>
                {canMarkReady && (
                  <button
                    onClick={() => markReady(tx)}
                    disabled={isUpdating}
                    style={{ flex: 1, height: 34, borderRadius: 8, border: 'none', background: isUpdating ? C.n200 : C.success, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: 'white', cursor: isUpdating ? 'default' : 'pointer' }}
                  >
                    {isUpdating ? 'Memproses…' : '✓ Siap Ambil'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: 16, right: 16, background: toast.ok ? '#166534' : C.danger, color: 'white', borderRadius: 12, padding: '12px 16px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', textAlign: 'center' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
