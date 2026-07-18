import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { TopBar, Btn, Chip, Select, DateTimeInput } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowOrb, Sparkle, FloatingBubble } from '../../components/ui/PremiumAnimations';

const METHOD_LABEL = { cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', deposit: 'Deposit', ovo: 'OVO', gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay' };
const METHOD_ICON = { cash: '💵', transfer: '🏦', qris: '📱', deposit: '💰', ovo: '🟣', gopay: '🟢', dana: '🔵', shopeepay: '🟠' };
const METHOD_COLOR = { cash: C.success, transfer: C.info, qris: C.primary, deposit: C.warning, ovo: C.primaryTint, gopay: C.success, dana: C.info, shopeepay: C.warning };
const STATUS_LABEL = { draft: 'Draft', pending: 'Pending', process: 'Proses', ready_for_pickup: 'Siap Ambil', ready_for_delivery: 'Siap Antar', completed: 'Selesai', cancelled: 'Batal' };
const STATUS_COLOR = { draft: C.n500, pending: C.info, process: C.warning, ready_for_pickup: C.success, ready_for_delivery: C.info, completed: C.success, cancelled: C.danger };
const STATUS_BG = { draft: C.n100, pending: `${C.info}20`, process: `${C.warning}20`, ready_for_pickup: `${C.success}20`, ready_for_delivery: `${C.info}20`, completed: `${C.success}20`, cancelled: `${C.danger}20` };

const F = { fontFamily: 'Poppins' };

// Premium card style
const premiumCard = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

// Premium gradient header
const premiumHeader = {
  background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
  position: 'relative',
  overflow: 'hidden',
};

const fmtDate = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch { return String(v); }
};
const fmtDateOnly = (v) => {
  if (!v) return '-';
  try { return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }); } catch { return String(v); }
};

const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function RekapPendapatanPage({ navigate, goBack }) {
  const isMobile = useIsMobile();
  const { adminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(adminOutletId && adminOutletId !== '_all' ? adminOutletId : '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [preset, setPreset] = useState('30d');

  useEffect(() => {
    applyPreset('30d');
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
    else if (key === '3m') { start.setMonth(end.getMonth() - 2); start.setDate(1); }
    else { start.setMonth(end.getMonth() - 5); start.setDate(1); }
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPage(1);
    setPreset(key);
  };

  const pag = data?.pagination;
  const summary = data?.summary;
  const transactions = data?.transactions || [];

  const methodSummary = useMemo(() => {
    if (!summary) return [];
    return [
      { method: 'cash', amount: Number(summary.totalCash || 0) },
      { method: 'transfer', amount: Number(summary.totalTransfer || 0) },
      { method: 'qris', amount: Number(summary.totalQris || 0) },
      { method: 'deposit', amount: Number(summary.totalDeposit || 0) },
    ].filter(m => m.amount > 0);
  }, [summary]);

  const methodTotal = methodSummary.reduce((s, m) => s + m.amount, 0) || 1;
  const totalDays = startDate && endDate ? Math.max(1, Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000) + 1) : 1;
  const avgPerDay = summary?.grandTotal ? Math.round(Number(summary.grandTotal) / totalDays) : 0;
  const avgPerTx = summary?.totalTx > 0 ? Math.round(Number(summary.grandTotal) / Number(summary.totalTx)) : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 480px) {
          .rekap-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .rekap-payment-grid { grid-template-columns: 1fr !important; }
          .rekap-method-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .rekap-expanded-grid { grid-template-columns: 1fr !important; }
          .rekap-filter-row { flex-direction: column !important; gap: 8px !important; }
          .rekap-filter-row > * { width: 100% !important; }
          .rekap-tx-header { flex-direction: column !important; gap: 8px !important; }
          .rekap-tx-header > * { width: 100% !important; }
          .rekap-tx-row { flex-direction: column !important; gap: 8px !important; }
          .rekap-pagination { flex-wrap: wrap !important; justify-content: center !important; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>

      {/* Premium Header with GlowOrb and Sparkle */}
      <div style={{ ...premiumHeader, padding: '0 16px' }}>
        <GlowOrb color="rgba(255,255,255,0.08)" size={200} top="-80px" right="-60px" />
        <GlowOrb color="rgba(255,200,255,0.06)" size={150} bottom="-40px" left="-40px" />
        <FloatingBubble size={40} top="20%" left="15%" delay={0} />
        <FloatingBubble size={25} top="60%" right="10%" delay={1.5} />
        <Sparkle color="rgba(255,255,255,0.6)" style={{ position: 'absolute', top: 20, right: 80 }} />
        <Sparkle color="rgba(255,255,255,0.4)" style={{ position: 'absolute', top: 35, right: 120 }} size={10} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <motion.button
            onClick={goBack}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 12,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </motion.button>
          <div>
            <h1 style={{ ...F, fontSize: 18, fontWeight: 700, color: 'white', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>Rekap Pendapatan</h1>
            <p style={{ ...F, fontSize: 11, color: 'rgba(255,255,255,0.85)', margin: 0 }}>Detail transaksi tercatat per periode</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ ...premiumCard, padding: 12, marginBottom: 12 }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {[
              { key: '7d', label: '7 hari' },
              { key: '30d', label: '30 hari' },
              { key: 'month', label: 'Bulan ini' },
              { key: '3m', label: '3 bulan' },
            ].map((p) => (
              <Chip key={p.key} label={p.label} active={preset === p.key} onClick={() => applyPreset(p.key)} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <DateTimeInput label="Dari" value={startDate ? `${startDate}T00:00:00` : ''} onChange={(v) => { setStartDate(v ? v.slice(0, 10) : ''); setPage(1); setPreset(''); }} timeOptional />
            <DateTimeInput label="Sampai" value={endDate ? `${endDate}T00:00:00` : ''} onChange={(v) => { setEndDate(v ? v.slice(0, 10) : ''); setPage(1); setPreset(''); }} timeOptional />
          </div>
          <Select label="Outlet" value={outletId} onChange={(val) => { setOutletId(val); setPage(1); }}
            options={[{ value: '', label: '🏪 Semua outlet' }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]} />
        </motion.div>

        {/* Summary */}
        {summary && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{
                background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                borderRadius: 18, padding: '16px 18px', color: C.white, marginBottom: 12,
                boxShadow: '0 8px 24px rgba(91,0,95,0.25)', position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: 40, background: 'rgba(255,255,255,0.1)' }} />
              <GlowOrb color="rgba(255,255,255,0.06)" size={120} top="-40px" right="20%" />
              <div style={{ ...F, fontSize: 11, fontWeight: 600, opacity: 0.92, marginBottom: 4, letterSpacing: 0.5 }}>💎 PENDAPATAN PERIODE</div>
              <div style={{ ...F, fontSize: 26, fontWeight: 600, lineHeight: 1.1, marginBottom: 6 }}>{rp(summary.grandTotal)}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, ...F, opacity: 0.95 }}>
                <span>📋 {summary.totalTx} transaksi</span>
                <span>📅 {totalDays} hari</span>
                <span>⚡ {rp(avgPerTx)}/trx</span>
                <span>📈 {rp(avgPerDay)}/hari</span>
              </div>
            </motion.div>

            {/* Payment Distribution */}
            {methodSummary.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                style={{ ...premiumCard, padding: 14, marginBottom: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>💳</span>
                  <h3 style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900, margin: 0 }}>Komposisi Pembayaran</h3>
                </div>

                <div style={{ display: 'flex', height: 24, borderRadius: 8, overflow: 'hidden', marginBottom: 12, background: C.n100 }} className="rekap-payment-grid">
                  {methodSummary.map((m) => {
                    const pct = (m.amount / methodTotal) * 100;
                    return (
                      <div key={m.method} title={`${METHOD_LABEL[m.method]}: ${pct.toFixed(1)}%`}
                        style={{ width: `${pct}%`, background: METHOD_COLOR[m.method] || C.n700 }} />
                    );
                  })}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }} className="rekap-method-grid">
                  {methodSummary.map((m) => {
                    const pct = (m.amount / methodTotal) * 100;
                    return (
                      <motion.div
                        key={m.method}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 }}
                        style={{
                          background: `${METHOD_COLOR[m.method]}10`, borderRadius: 10, padding: '10px 12px',
                          borderLeft: `3px solid ${METHOD_COLOR[m.method]}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 14 }}>{METHOD_ICON[m.method]}</span>
                          <span style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n700 }}>{METHOD_LABEL[m.method]}</span>
                          <span style={{ ...F, fontSize: 10, fontWeight: 600, color: METHOD_COLOR[m.method], marginLeft: 'auto' }}>{pct.toFixed(1)}%</span>
                        </div>
                        <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900 }}>{rp(m.amount)}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* Transactions Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            ...premiumCard, padding: '10px 14px', marginBottom: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <div>
              <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>Daftar Transaksi</div>
              <div style={{ ...F, fontSize: 10, color: C.n700 }}>
                {pag ? `${pag.totalRecords.toLocaleString('id-ID')} transaksi ditemukan` : 'Memuat...'}
              </div>
            </div>
          </div>
          <div style={{ minWidth: 90 }}>
            <Select value={String(perPage)} onChange={(val) => { setPerPage(Number(val)); setPage(1); }}
              options={PER_PAGE_OPTIONS.map((n) => ({ value: String(n), label: `${n}/hal` }))} />
          </div>
        </motion.div>

        {/* Transactions List */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 32, ...F, fontSize: 13, color: C.n700 }}>
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 24, height: 24, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', margin: '0 auto 8px' }}
            />
            Memuat transaksi...
          </div>
        )}

        {!loading && transactions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ ...premiumCard, padding: 32, textAlign: 'center', ...F, fontSize: 13, color: C.n700 }}
          >
            <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.4 }}>📭</div>
            Tidak ada transaksi pada periode ini.
          </motion.div>
        )}

        {!loading && transactions.map((tx, idx) => {
          const isExpanded = expandedId === tx.id;
          const globalIdx = ((pag?.page || 1) - 1) * perPage + idx + 1;
          const statusBg = STATUS_BG[tx.status] || C.n100;
          const statusColor = STATUS_COLOR[tx.status] || C.n700;
          const isCancelled = tx.status === 'cancelled';

          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              style={{
                background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
                boxShadow: '8px 8px 20px rgba(110, 46, 120, 0.08), -4px -4px 12px rgba(255, 255, 255, 0.95)',
                borderRadius: 14, marginBottom: 10,
                overflow: 'hidden', borderLeft: `4px solid ${statusColor}`,
                opacity: isCancelled ? 0.7 : 1,
              }}
            >
              <motion.button
                onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 16, background: `${statusColor}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  ...F, fontSize: 10, fontWeight: 600, color: statusColor,
                }}>#{globalIdx}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>{tx.customerName || 'Tanpa nama'}</span>
                    {tx.isExpress && (
                      <span style={{ ...F, fontSize: 9, fontWeight: 600, background: `${C.warning}20`, color: C.warning, padding: '1px 6px', borderRadius: 999 }}>⚡ Express</span>
                    )}
                  </div>
                  <div style={{ ...F, fontSize: 10, color: C.n700, marginTop: 2 }}>
                    {tx.transactionNo} · {fmtDate(tx.createdAt)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900 }}>{rp(tx.total)}</div>
                  <span style={{
                    ...F, fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                    background: statusBg, color: statusColor, display: 'inline-block', marginTop: 3,
                  }}>{STATUS_LABEL[tx.status] || tx.status}</span>
                </div>
                <motion.svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n700} strokeWidth="2" strokeLinecap="round"
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </motion.svg>
              </motion.button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.n100}`, background: `${C.n50}80` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 12, marginBottom: 12 }} className="rekap-expanded-grid">
                        {[
                          ['🏪 Outlet', tx.outletName || '—'],
                          ['👤 Kasir', tx.cashierName || '—'],
                          ['📞 Telepon', tx.customerPhone || '—'],
                          ['📦 Pickup', tx.pickupType || 'self'],
                        ].map(([label, val]) => (
                          <div key={label} style={{ background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)', padding: '8px 10px', borderRadius: 10, boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.05), -2px -2px 6px rgba(255, 255, 255, 0.9)' }}>
                            <div style={{ ...F, fontSize: 9, color: C.n700, fontWeight: 600 }}>{label}</div>
                            <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n900, marginTop: 2 }}>{val}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)', borderRadius: 10, padding: 12, marginBottom: 8, boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.05), -2px -2px 6px rgba(255, 255, 255, 0.9)' }}>
                        <div style={{ ...F, fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 6, letterSpacing: 0.3 }}>💰 RINCIAN HARGA</div>
                        {[
                          ['Subtotal', rp(tx.subtotal)],
                          tx.discount > 0 ? ['Diskon', `- ${rp(tx.discount)}`] : null,
                          tx.deliveryFee > 0 ? ['Ongkir', rp(tx.deliveryFee)] : null,
                        ].filter(Boolean).map(([label, val]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', ...F, fontSize: 12 }}>
                            <span style={{ color: C.n700 }}>{label}</span>
                            <span style={{ color: C.n900 }}>{val}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', borderTop: `1.5px solid ${C.n200}`, marginTop: 6, ...F, fontSize: 13 }}>
                          <span style={{ fontWeight: 600, color: C.n900 }}>Total</span>
                          <span style={{ fontWeight: 600, color: C.primary, fontSize: 15 }}>{rp(tx.total)}</span>
                        </div>
                      </div>

                      {tx.payments && tx.payments.length > 0 ? (
                        <div style={{ background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)', borderRadius: 10, padding: 12, boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.05), -2px -2px 6px rgba(255, 255, 255, 0.9)' }}>
                          <div style={{ ...F, fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 6, letterSpacing: 0.3 }}>💳 METODE PEMBAYARAN</div>
                          {tx.payments.map((p, i) => (
                            <div key={`${p.method}-${i}`} style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                              background: `${METHOD_COLOR[p.method] || C.n700}10`, borderRadius: 8, marginBottom: 4,
                            }}>
                              <span style={{ fontSize: 14 }}>{METHOD_ICON[p.method] || '💳'}</span>
                              <span style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n800, flex: 1 }}>{METHOD_LABEL[p.method] || p.method}</span>
                              <strong style={{ ...F, fontSize: 12, color: C.n900 }}>{rp(p.amount)}</strong>
                            </div>
                          ))}
                        </div>
                      ) : tx.payMethod && (
                        <div style={{ background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '4px 4px 10px rgba(110, 46, 120, 0.05), -2px -2px 6px rgba(255, 255, 255, 0.9)' }}>
                          <span style={{ fontSize: 14 }}>{METHOD_ICON[tx.payMethod] || '💳'}</span>
                          <span style={{ ...F, fontSize: 12, color: C.n800, flex: 1 }}>{METHOD_LABEL[tx.payMethod] || tx.payMethod}</span>
                          <strong style={{ ...F, fontSize: 12, color: C.n900 }}>{rp(tx.total)}</strong>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {/* Pagination */}
        {pag && pag.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ ...premiumCard, padding: 12, marginTop: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
              <motion.button
                disabled={page <= 1}
                onClick={() => setPage(1)}
                whileTap={{ scale: page <= 1 ? 1 : 0.95 }}
                style={{ ...paginBtnStyle, opacity: page <= 1 ? 0.4 : 1 }}
              >«</motion.button>
              <motion.button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                whileTap={{ scale: page <= 1 ? 1 : 0.95 }}
                style={{ ...paginBtnStyle, opacity: page <= 1 ? 0.4 : 1 }}
              >‹</motion.button>
              {getPageNumbers(page, pag.totalPages).map((p, i) =>
                p === '...' ? (
                  <span key={`dot-${i}`} style={{ ...F, fontSize: 12, color: C.n700, padding: '0 4px' }}>…</span>
                ) : (
                  <motion.button
                    key={p}
                    onClick={() => setPage(p)}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      ...paginBtnStyle,
                      background: p === page ? C.primary : C.white,
                      color: p === page ? C.white : C.n700,
                      fontWeight: p === page ? 700 : 500,
                      border: p === page ? `1.5px solid ${C.primary}` : `1.5px solid ${C.n200}`,
                    }}
                  >{p}</motion.button>
                )
              )}
              <motion.button
                disabled={page >= pag.totalPages}
                onClick={() => setPage(page + 1)}
                whileTap={{ scale: page >= pag.totalPages ? 1 : 0.95 }}
                style={{ ...paginBtnStyle, opacity: page >= pag.totalPages ? 0.4 : 1 }}
              >›</motion.button>
              <motion.button
                disabled={page >= pag.totalPages}
                onClick={() => setPage(pag.totalPages)}
                whileTap={{ scale: page >= pag.totalPages ? 1 : 0.95 }}
                style={{ ...paginBtnStyle, opacity: page >= pag.totalPages ? 0.4 : 1 }}
              >»</motion.button>
            </div>
            <div style={{ textAlign: 'center', ...F, fontSize: 10, color: C.n700, marginTop: 8 }}>
              Halaman {pag.page} dari {pag.totalPages} · {pag.totalRecords.toLocaleString('id-ID')} record
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

const paginBtnStyle = {
  width: 32, height: 32, borderRadius: 8,
  border: `1.5px solid ${C.n200}`, background: C.white,
  ...F, fontSize: 12, fontWeight: 600,
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
