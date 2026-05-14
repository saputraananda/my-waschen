import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip } from '../../components/ui';

const METHOD_LABEL = { cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', deposit: 'Deposit', ovo: 'OVO', gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay' };
const METHOD_ICON = { cash: '💵', transfer: '🏦', qris: '📱', deposit: '💰', ovo: '🟣', gopay: '🟢', dana: '🔵', shopeepay: '🟠' };
const STATUS_LABEL = { draft: 'Draft', pending: 'Pending', process: 'Proses', ready_for_pickup: 'Siap Ambil', completed: 'Selesai', cancelled: 'Batal' };
const STATUS_COLOR = { draft: '#64748B', pending: '#2563EB', process: '#D97706', ready_for_pickup: '#059669', completed: '#166534', cancelled: '#DC2626' };

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch { return String(v); }
};

const PER_PAGE_OPTIONS = [5, 10, 25, 50];

export default function RekapPendapatanPage({ navigate, goBack }) {
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [perPage, setPerPage] = useState(5);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // Init dates: last 30 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));

    (async () => {
      try {
        const res = await axios.get('/api/master/outlets');
        setOutlets(res?.data?.data || []);
      } catch { setOutlets([]); }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      let url = `/api/finance/revenue-recap?startDate=${startDate}&endDate=${endDate}&page=${page}&limit=${perPage}`;
      if (outletId) url += `&outletId=${outletId}`;
      const res = await axios.get(url);
      setData(res?.data?.data || null);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, outletId, page, perPage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyPreset = (key) => {
    const end = new Date();
    const start = new Date();
    if (key === '7d') start.setDate(end.getDate() - 6);
    else if (key === '30d') start.setDate(end.getDate() - 29);
    else if (key === 'month') start.setDate(1);
    else { start.setMonth(end.getMonth() - 2); start.setDate(1); }
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPage(1);
  };

  const pag = data?.pagination;
  const summary = data?.summary;
  const transactions = data?.transactions || [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Rekap Pendapatan" subtitle="Detail transaksi · filter outlet & periode" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>

        {/* ── Filter Outlet ── */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 10, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 6 }}>Outlet</div>
          <select
            value={outletId}
            onChange={(e) => { setOutletId(e.target.value); setPage(1); }}
            style={{ width: '100%', height: 44, borderRadius: 10, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 12px', background: C.white }}
          >
            <option value="">Semua outlet</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        {/* ── Filter Periode ── */}
        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 10, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 6 }}>Periode</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {[{ key: '7d', label: '7 hari' }, { key: '30d', label: '30 hari' }, { key: 'month', label: 'Bulan ini' }, { key: '3m', label: '3 bulan' }].map((p) => (
              <Chip key={p.key} label={p.label} onClick={() => applyPreset(p.key)} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
              Dari
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} style={{ display: 'block', width: '100%', marginTop: 4, height: 40, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: '0 8px', boxSizing: 'border-box' }} />
            </label>
            <label style={{ flex: 1, fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
              Sampai
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} style={{ display: 'block', width: '100%', marginTop: 4, height: 40, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 12, padding: '0 8px', boxSizing: 'border-box' }} />
            </label>
          </div>
        </div>

        {/* ── Summary Cards ── */}
        {summary && (
          <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900, marginBottom: 10 }}>Ringkasan Keseluruhan</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 16, fontWeight: 800, color: '#166534' }}>{rp(summary.grandTotal)}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#15803D' }}>Total Pendapatan</div>
              </div>
              <div style={{ background: '#F0F9FF', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: '#0C4A6E' }}>{summary.totalTx}</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: '#0369A1' }}>Total Transaksi</div>
              </div>
            </div>
            {/* Per-method summary */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                { label: 'Tunai', val: summary.totalCash, icon: '💵' },
                { label: 'Transfer', val: summary.totalTransfer, icon: '🏦' },
                { label: 'QRIS', val: summary.totalQris, icon: '📱' },
                { label: 'Deposit', val: summary.totalDeposit, icon: '💰' },
              ].filter((m) => m.val > 0).map((m) => (
                <div key={m.label} style={{ background: C.n50, borderRadius: 8, padding: '6px 10px', fontFamily: 'Poppins', fontSize: 11 }}>
                  <span>{m.icon} {m.label}: </span>
                  <strong>{rp(m.val)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Per-page selector ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>
            {pag ? `${pag.totalRecords} transaksi ditemukan` : 'Memuat...'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>Per halaman:</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
              style={{ height: 30, borderRadius: 6, border: `1px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 11, padding: '0 4px' }}
            >
              {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* ── Transaction List ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Memuat data...</div>
        )}

        {!loading && transactions.length === 0 && (
          <div style={{ background: C.white, borderRadius: 14, padding: 24, textAlign: 'center', fontFamily: 'Poppins', fontSize: 13, color: C.n500, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
            Tidak ada transaksi pada periode ini.
          </div>
        )}

        {!loading && transactions.map((tx, idx) => {
          const isExpanded = expandedId === tx.id;
          const globalIdx = ((pag?.page || 1) - 1) * perPage + idx + 1;
          const statusColor = STATUS_COLOR[tx.status] || C.n600;
          return (
            <div key={tx.id} style={{ background: C.white, borderRadius: 14, marginBottom: 8, boxShadow: '0 2px 8px rgba(15,23,42,0.06)', overflow: 'hidden' }}>
              {/* Row header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 14, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.white }}>{globalIdx}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.primary }}>{tx.transactionNo || tx.id}</span>
                    {tx.isExpress && <span style={{ fontFamily: 'Poppins', fontSize: 9, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 999 }}>⚡ Express</span>}
                  </div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 1 }}>
                    {tx.customerName} · {fmtDate(tx.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n900 }}>{rp(tx.total)}</div>
                  <span style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: statusColor }}>{STATUS_LABEL[tx.status] || tx.status}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.n400} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.n100}` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10, marginBottom: 10 }}>
                    {[
                      ['Outlet', tx.outletName || '-'],
                      ['Kasir', tx.cashierName || '-'],
                      ['Customer', tx.customerName],
                      ['Telepon', tx.customerPhone || '-'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{label}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Price breakdown */}
                  <div style={{ background: '#FAFAFA', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    {[
                      ['Subtotal', rp(tx.subtotal)],
                      tx.discount > 0 ? ['Diskon', `- ${rp(tx.discount)}`] : null,
                      tx.deliveryFee > 0 ? ['Ongkir', rp(tx.deliveryFee)] : null,
                    ].filter(Boolean).map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontFamily: 'Poppins', fontSize: 12 }}>
                        <span style={{ color: C.n600 }}>{label}</span>
                        <span style={{ color: C.n900 }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', borderTop: `1.5px solid ${C.n200}`, marginTop: 4, fontFamily: 'Poppins', fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: C.n900 }}>Total</span>
                      <span style={{ fontWeight: 800, color: C.primary }}>{rp(tx.total)}</span>
                    </div>
                  </div>

                  {/* Payment methods */}
                  {tx.payments && tx.payments.length > 0 && (
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, marginBottom: 4 }}>Metode Pembayaran</div>
                      {tx.payments.map((p) => (
                        <div key={p.method} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontFamily: 'Poppins', fontSize: 12 }}>
                          <span>{METHOD_ICON[p.method] || '💳'}</span>
                          <span style={{ flex: 1, color: C.n800 }}>{METHOD_LABEL[p.method] || p.method}</span>
                          <strong style={{ color: C.n900 }}>{rp(p.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  {(!tx.payments || tx.payments.length === 0) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>
                      <span>{METHOD_ICON[tx.payMethod] || '💳'}</span>
                      <span>{METHOD_LABEL[tx.payMethod] || tx.payMethod || '-'}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 600, color: C.n900 }}>{rp(tx.total)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Pagination ── */}
        {pag && pag.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingBottom: 12 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              style={{ ...paginBtnStyle, opacity: page <= 1 ? 0.4 : 1 }}
            >«</button>
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              style={{ ...paginBtnStyle, opacity: page <= 1 ? 0.4 : 1 }}
            >‹</button>

            {getPageNumbers(page, pag.totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`dot-${i}`} style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n400, padding: '0 2px' }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    ...paginBtnStyle,
                    background: p === page ? C.primary : C.white,
                    color: p === page ? C.white : C.n700,
                    fontWeight: p === page ? 700 : 500,
                    border: p === page ? `1.5px solid ${C.primary}` : `1.5px solid ${C.n200}`,
                  }}
                >{p}</button>
              )
            )}

            <button
              disabled={page >= pag.totalPages}
              onClick={() => setPage(page + 1)}
              style={{ ...paginBtnStyle, opacity: page >= pag.totalPages ? 0.4 : 1 }}
            >›</button>
            <button
              disabled={page >= pag.totalPages}
              onClick={() => setPage(pag.totalPages)}
              style={{ ...paginBtnStyle, opacity: page >= pag.totalPages ? 0.4 : 1 }}
            >»</button>
          </div>
        )}

        {pag && (
          <div style={{ textAlign: 'center', fontFamily: 'Poppins', fontSize: 11, color: C.n500, paddingBottom: 8 }}>
            Halaman {pag.page} dari {pag.totalPages} · {pag.totalRecords} record
          </div>
        )}
      </div>
    </div>
  );
}

const paginBtnStyle = {
  width: 32, height: 32, borderRadius: 8,
  border: `1.5px solid ${C.n200}`, background: C.white,
  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
  color: C.n700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function getPageNumbers(current, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
