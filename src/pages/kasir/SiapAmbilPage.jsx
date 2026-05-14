import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar } from '../../components/ui';

const fmtTime = (v) => {
  if (!v) return '-';
  return new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
};

const msElapsed = (v) => {
  if (!v) return null;
  const ms = Date.now() - new Date(v).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)} hari`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
};

export default function SiapAmbilPage({ navigate, goBack }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [updating, setUpdating] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/transactions?status=ready_for_pickup&limit=100&sortBy=created_at&sortDir=asc');
      setOrders(res?.data?.data?.transactions || res?.data?.data || []);
    } catch { setOrders([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const confirmPickup = async (tx) => {
    setUpdating(tx.id);
    try {
      await axios.patch(`/api/transactions/${tx.id}/status`, { status: 'diambil' });
      showToast(`${tx.transactionNo || tx.id} — Sudah diambil customer ✅`);
      setConfirmed(null);
      fetchOrders();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Gagal konfirmasi', false);
    } finally { setUpdating(null); }
  };

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (o.transactionNo || o.id || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.customerPhone || '').includes(q)
    );
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Siap Diambil"
        subtitle={`${orders.length} order menunggu customer`}
        onBack={goBack}
      />

      {/* Search */}
      <div style={{ padding: '10px 16px 0' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, no. nota, atau telepon…"
            style={{ width: '100%', height: 42, borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 13, paddingLeft: 36, paddingRight: 12, boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Counter banner */}
      {!loading && orders.length > 0 && (
        <div style={{ margin: '10px 16px 0', background: `${C.success}12`, border: `1.5px solid ${C.success}30`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.success }}>
            {orders.length} order sudah selesai dicuci — menunggu diambil customer
          </span>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 28, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ background: C.white, borderRadius: 14, padding: 28, textAlign: 'center', marginTop: 4 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧺</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700 }}>
              {search ? 'Tidak ditemukan' : 'Belum ada order siap ambil'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 4 }}>
              {search ? 'Coba kata kunci lain' : 'Order yang sudah selesai dicuci akan muncul di sini'}
            </div>
          </div>
        )}

        {!loading && filtered.map((tx) => {
          const elapsed = msElapsed(tx.createdAt);
          const isUpdating = updating === tx.id;

          return (
            <div key={tx.id} style={{ background: C.white, borderRadius: 14, padding: '13px 14px', marginBottom: 8, boxShadow: '0 1px 6px rgba(15,23,42,0.07)', borderLeft: `4px solid ${C.success}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/* Icon */}
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{tx.transactionNo || tx.id}</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{rp(tx.total)}</span>
                  </div>

                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginTop: 2 }}>{tx.customerName}</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    {tx.customerPhone && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>📞 {tx.customerPhone}</span>
                    )}
                    {tx.isExpress && (
                      <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '1px 6px', borderRadius: 999 }}>⚡ Express</span>
                    )}
                  </div>

                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 3 }}>
                    Masuk {fmtTime(tx.createdAt)}{elapsed ? ` · ${elapsed} lalu` : ''}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 11, paddingTop: 11, borderTop: `1px solid ${C.n100}` }}>
                <button
                  onClick={() => navigate('detail_transaksi', tx)}
                  style={{ flex: 1, height: 36, borderRadius: 9, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, cursor: 'pointer' }}
                >
                  Lihat Nota
                </button>
                <button
                  onClick={() => setConfirmed(tx)}
                  disabled={isUpdating}
                  style={{ flex: 2, height: 36, borderRadius: 9, border: 'none', background: C.success, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: `0 4px 12px ${C.success}40` }}
                >
                  Konfirmasi Sudah Diambil
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmed && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', padding: '0 0 0' }}
          onClick={() => setConfirmed(null)}
        >
          <div
            style={{ width: '100%', background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', boxShadow: '0 -8px 32px rgba(15,23,42,0.15)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.n200, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, marginBottom: 4 }}>Konfirmasi Pengambilan</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, marginBottom: 16 }}>
              Pastikan customer <strong>{confirmed.customerName}</strong> sudah mengambil laundry mereka.
            </div>

            <div style={{ background: C.n50, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: 4 }}>
                <span>No. Nota</span><strong>{confirmed.transactionNo || confirmed.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 12, color: C.n700 }}>
                <span>Total</span><strong style={{ color: C.primary }}>{rp(confirmed.total)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmed(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={() => confirmPickup(confirmed)}
                disabled={!!updating}
                style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: C.success, fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: `0 6px 16px ${C.success}45` }}
              >
                {updating ? 'Memproses…' : '✓ Ya, Sudah Diambil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: 16, right: 16, background: toast.ok ? '#166534' : C.danger, color: 'white', borderRadius: 12, padding: '12px 16px', fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, zIndex: 999, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', textAlign: 'center' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
