import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Select } from '../../components/ui';
import { alertError, alertSuccess } from '../../utils/alert';

const fmtTime = (v) => {
  if (!v) return '-';
  return new Date(v).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
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

const PAY_METHODS = [
  { value: 'cash',     label: '💵 Tunai' },
  { value: 'transfer', label: '🏦 Transfer' },
  { value: 'qris',     label: '📱 QRIS' },
  { value: 'deposit',  label: '💳 Deposit' },
];

const FILTER_OPTS = [
  { value: 'semua',    label: 'Semua' },
  { value: 'belum',    label: 'Belum Lunas' },
  { value: 'lunas',    label: 'Sudah Lunas' },
  { value: 'express',  label: '⚡ Express' },
];

const PAGE_SIZE = 10;

export default function SiapAmbilPage({ navigate, goBack }) {
  const [orders, setOrders]       = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('semua');
  const [page, setPage]           = useState(1);
  const debounceRef               = useRef(null);

  // Bottom sheet
  const [sheet, setSheet]         = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [cashInput, setCashInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async (q, f, p) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: 'ready_for_pickup',
        limit: PAGE_SIZE,
        page: p,
        sortBy: 'created_at',
        sortDir: 'asc',
      });
      if (q.trim()) params.set('search', q.trim());
      // filter payment
      if (f === 'belum')   params.set('paymentStatus', 'unpaid,partial');
      if (f === 'lunas')   params.set('paymentStatus', 'paid');
      if (f === 'express') params.set('isExpress', '1');

      const res = await axios.get(`/api/transactions?${params}`);
      const data = res?.data?.data;
      const list = Array.isArray(data) ? data : (data?.transactions || []);
      const tot  = res?.data?.pagination?.total ?? list.length;
      setOrders(list);
      setTotal(tot);
    } catch { setOrders([]); setTotal(0); }
    finally { setLoading(false); }
  }, []);

  // Debounce search, reset page on filter/search change
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOrders(search, filter, page), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, filter, page, fetchOrders]);

  const handleSearch = (v) => { setSearch(v); setPage(1); };
  const handleFilter = (v) => { setFilter(v); setPage(1); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Sheet helpers ──────────────────────────────────────────────────────────
  const openSheet = (tx) => {
    const needsPayment = tx.paymentStatus !== 'paid' && (tx.balanceDue || 0) > 0;
    setPayMethod('cash');
    setCashInput('');
    setSheet({ tx, step: needsPayment ? 'payment' : 'confirm' });
  };
  const closeSheet = () => setSheet(null);

  const confirmPickup = async (tx) => {
    setSubmitting(true);
    try {
      await axios.put(`/api/transactions/${tx.id}/status`, { status: 'diambil' });
      alertSuccess(`${tx.transactionNo || tx.id} sudah diambil ✓`);
      closeSheet();
      fetchOrders(search, filter, page);
    } catch (e) { alertError(e?.response?.data?.message || 'Gagal konfirmasi'); }
    finally { setSubmitting(false); }
  };

  const settleAndPickup = async (tx) => {
    const balanceDue = tx.balanceDue || 0;
    if (!payMethod) { alertError('Pilih metode pembayaran'); return; }
    const cashNum  = cashInput ? Number(String(cashInput).replace(/\D/g, '')) : balanceDue;
    if (cashNum <= 0) { alertError('Nominal tidak valid'); return; }
    setSubmitting(true);
    try {
      await axios.post(`/api/transactions/${tx.id}/payments`, {
        method: payMethod,
        payAmount: balanceDue,
        cashReceived: payMethod === 'cash' ? cashNum : undefined,
      });
      await axios.put(`/api/transactions/${tx.id}/status`, { status: 'diambil' });
      alertSuccess('Lunas & sudah diambil ✓');
      closeSheet();
      fetchOrders(search, filter, page);
    } catch (e) { alertError(e?.response?.data?.message || 'Gagal proses'); }
    finally { setSubmitting(false); }
  };

  const tx         = sheet?.tx;
  const balanceDue = tx?.balanceDue || 0;
  const cashNum    = cashInput ? Number(String(cashInput).replace(/\D/g, '')) : 0;
  const kembalian  = payMethod === 'cash' && cashNum > balanceDue ? cashNum - balanceDue : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Siap Diambil"
        subtitle={`${total} order menunggu customer`}
        onBack={goBack}
      />

      {/* ── Search + Filter bar ── */}
      <div style={{ padding: '10px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cari nama, no. nota, atau telepon…"
            style={{ width: '100%', height: 42, borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 13, paddingLeft: 36, paddingRight: 12, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {FILTER_OPTS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilter(f.value)}
              style={{
                flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 999,
                border: `1.5px solid ${filter === f.value ? C.primary : C.n200}`,
                background: filter === f.value ? C.primaryLight : C.white,
                fontFamily: 'Poppins', fontSize: 11, fontWeight: filter === f.value ? 700 : 500,
                color: filter === f.value ? C.primary : C.n600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Counter banner */}
      {!loading && total > 0 && (
        <div style={{ margin: '8px 16px 0', background: `${C.success}12`, border: `1.5px solid ${C.success}30`, borderRadius: 12, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.success }}>
            {total} order selesai dicuci — menunggu diambil
          </span>
        </div>
      )}

      {/* ── List ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 8px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 28, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat…</div>
        )}

        {!loading && orders.length === 0 && (
          <div style={{ background: C.white, borderRadius: 14, padding: 28, textAlign: 'center', marginTop: 4 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🧺</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700 }}>
              {search || filter !== 'semua' ? 'Tidak ada hasil' : 'Belum ada order siap ambil'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 4 }}>
              {search || filter !== 'semua' ? 'Coba ubah filter atau kata kunci' : 'Order yang sudah selesai dicuci akan muncul di sini'}
            </div>
          </div>
        )}

        {!loading && orders.map((tx) => {
          const elapsed      = msElapsed(tx.createdAt);
          const needsPayment = tx.paymentStatus !== 'paid' && (tx.balanceDue || 0) > 0;
          return (
            <div key={tx.id} style={{
              background: C.white, borderRadius: 14, padding: '13px 14px', marginBottom: 8,
              boxShadow: '0 1px 6px rgba(15,23,42,0.07)',
              borderLeft: `4px solid ${needsPayment ? C.warning : C.success}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: needsPayment ? '#FEF3C7' : '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {needsPayment
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.warning} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{tx.transactionNo || tx.id}</span>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{rp(tx.total)}</span>
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginTop: 2 }}>{tx.customerName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    {tx.customerPhone && <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>📞 {tx.customerPhone}</span>}
                    {needsPayment && <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '1px 7px', borderRadius: 999 }}>Sisa {rp(tx.balanceDue)}</span>}
                    {tx.isExpress && <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '1px 6px', borderRadius: 999 }}>⚡ Express</span>}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 3 }}>
                    Masuk {fmtTime(tx.createdAt)}{elapsed ? ` · ${elapsed} lalu` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 11, paddingTop: 11, borderTop: `1px solid ${C.n100}` }}>
                <button onClick={() => navigate('detail_transaksi', tx)} style={{ flex: 1, height: 36, borderRadius: 9, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n700, cursor: 'pointer' }}>
                  Lihat Nota
                </button>
                <button
                  onClick={() => openSheet(tx)}
                  style={{ flex: 2, height: 36, borderRadius: 9, border: 'none', background: needsPayment ? `linear-gradient(135deg, ${C.warning}, #D97706)` : C.success, fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: needsPayment ? '0 4px 12px rgba(245,158,11,0.4)' : `0 4px 12px ${C.success}40` }}
                >
                  {needsPayment ? '💳 Lunasi & Ambil' : '✓ Sudah Diambil'}
                </button>
              </div>
            </div>
          );
        })}

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0 4px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${C.n200}`, background: page === 1 ? C.n50 : C.white, cursor: page === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === 1 ? C.n300 : C.n700 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`e${i}`} style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n400, padding: '0 2px' }}>…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${page === p ? C.primary : C.n200}`, background: page === p ? C.primary : C.white, cursor: 'pointer', fontFamily: 'Poppins', fontSize: 12, fontWeight: page === p ? 700 : 500, color: page === p ? 'white' : C.n700 }}
                    >
                      {p}
                    </button>
                  )
              )
            }

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ width: 34, height: 34, borderRadius: 9, border: `1.5px solid ${C.n200}`, background: page === totalPages ? C.n50 : C.white, cursor: page === totalPages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: page === totalPages ? C.n300 : C.n700 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}

        {/* Page info */}
        {!loading && totalPages > 1 && (
          <div style={{ textAlign: 'center', fontFamily: 'Poppins', fontSize: 11, color: C.n400, paddingBottom: 16 }}>
            Halaman {page} dari {totalPages} · {total} order
          </div>
        )}
      </div>

      {/* ── Bottom Sheet ── */}
      {sheet && (
        <>
          <div onClick={closeSheet} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 200 }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.white, borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', boxShadow: '0 -8px 32px rgba(15,23,42,0.15)', zIndex: 201, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: C.n200, margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 700, color: C.n900, marginBottom: 4 }}>
              {sheet.step === 'payment' ? '💳 Pelunasan & Pengambilan' : '✓ Konfirmasi Pengambilan'}
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, color: C.n600, marginBottom: 16 }}>
              {sheet.step === 'payment'
                ? `Ada sisa tagihan untuk ${tx.customerName}. Selesaikan pembayaran sebelum barang diambil.`
                : `Pastikan ${tx.customerName} sudah mengambil laundry mereka.`}
            </div>

            {/* Info nota */}
            <div style={{ background: C.n50, borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: 4 }}>
                <span>No. Nota</span><strong>{tx.transactionNo || tx.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: sheet.step === 'payment' ? 4 : 0 }}>
                <span>Total</span><strong>{rp(tx.total)}</strong>
              </div>
              {sheet.step === 'payment' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 12, color: C.n700, marginBottom: 4 }}>
                    <span>Sudah dibayar</span><span style={{ color: C.success }}>{rp(tx.paidAmount || 0)}</span>
                  </div>
                  <div style={{ height: 1, background: C.n200, margin: '6px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Poppins', fontSize: 13, color: C.n900 }}>
                    <strong>Sisa tagihan</strong><strong style={{ color: C.danger }}>{rp(balanceDue)}</strong>
                  </div>
                </>
              )}
            </div>

            {/* Form pelunasan */}
            {sheet.step === 'payment' && (
              <>
                <Select label="Metode Pembayaran" value={payMethod} onChange={setPayMethod} options={PAY_METHODS} />
                {payMethod === 'cash' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n600, marginBottom: 6 }}>Uang Diterima (opsional)</div>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Poppins', fontSize: 14, color: C.n500, pointerEvents: 'none' }}>Rp</span>
                      <input type="text" inputMode="numeric"
                        value={cashInput ? Number(String(cashInput).replace(/\D/g, '')).toLocaleString('id-ID') : ''}
                        onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ''))}
                        placeholder={Number(balanceDue).toLocaleString('id-ID')}
                        style={{ width: '100%', height: 48, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 14, color: C.n900, background: C.white, outline: 'none', boxSizing: 'border-box', padding: '0 14px 0 36px' }}
                        onFocus={(e) => { e.target.style.borderColor = C.primary; e.target.style.borderWidth = '2px'; }}
                        onBlur={(e) => { e.target.style.borderColor = C.n300; e.target.style.borderWidth = '1.5px'; }}
                      />
                    </div>
                    {kembalian > 0 && <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.success, marginTop: 6, fontWeight: 600 }}>Kembalian: {rp(kembalian)}</div>}
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={closeSheet} style={{ flex: 1, height: 48, borderRadius: 12, border: `1.5px solid ${C.n200}`, background: C.white, fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n700, cursor: 'pointer' }}>Batal</button>
              <button
                onClick={() => sheet.step === 'payment' ? settleAndPickup(tx) : confirmPickup(tx)}
                disabled={submitting}
                style={{ flex: 2, height: 48, borderRadius: 12, border: 'none', background: sheet.step === 'payment' ? `linear-gradient(135deg, ${C.warning}, #D97706)` : C.success, fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: 'white', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, boxShadow: sheet.step === 'payment' ? '0 6px 16px rgba(245,158,11,0.4)' : `0 6px 16px ${C.success}45` }}
              >
                {submitting ? 'Memproses…' : sheet.step === 'payment' ? `✓ Lunasi ${rp(balanceDue)} & Ambil` : '✓ Ya, Sudah Diambil'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
