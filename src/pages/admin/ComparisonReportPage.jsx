import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Chip, Select, DateTimeInput, ComparisonLineChart, SkeletonStatGrid } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { getDateRangePreset, DATE_PRESETS } from '../../utils/filterPresets';
import { useResponsive } from '../../utils/hooks';
import { motion } from 'framer-motion';
import { GlowOrb, Sparkle } from '../../components/ui/PremiumAnimations';

const F = { fontFamily: 'Poppins' };

// Premium card style
const premiumCard = {
  background: 'linear-gradient(145deg, #FFFFFF, #F8F4FF)',
  boxShadow: '10px 10px 24px rgba(110, 46, 120, 0.1), -5px -5px 14px rgba(255, 255, 255, 0.95)',
  borderRadius: 18,
};

// Premium filter card
const premiumFilterCard = {
  ...premiumCard,
  padding: '14px 16px',
};

// Premium gradient header
const premiumHeader = {
  background: 'linear-gradient(135deg, #5B005F 0%, #4D0051 100%)',
  position: 'relative',
  overflow: 'hidden',
};

const Delta = ({ value, reverseGood = false }) => {
  if (value == null) return null;
  const up = value > 0;
  const good = reverseGood ? !up : up;
  const color = value === 0 ? C.n700 : good ? C.success : C.danger;
  return (
    <span style={{ ...F, fontSize: 11, fontWeight: 600, color, marginLeft: 4 }}>
      {up ? '↑' : value < 0 ? '↓' : '→'} {Math.abs(value)}%
    </span>
  );
};

const MetricCard = ({ label, currentVal, prevVal, delta, format = 'number', color = C.primary }) => {
  const fmt = (v) => format === 'currency' ? rp(v) : Number(v).toLocaleString('id-ID');
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        ...premiumCard,
        padding: '14px 16px',
      }}
    >
      <div style={{ ...F, fontSize: 10, color: C.n700, fontWeight: 600, letterSpacing: 0.3, marginBottom: 6 }}>{label}</div>
      <div style={{ ...F, fontSize: 20, fontWeight: 600, color, lineHeight: 1.1 }}>{fmt(currentVal)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <span style={{ ...F, fontSize: 10, color: C.n700 }}>vs {fmt(prevVal)}</span>
        <Delta value={delta} />
      </div>
    </motion.div>
  );
};

export default function ComparisonReportPage({ goBack }) {
  const { isMobile } = useResponsive();
  const { adminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(adminOutletId && adminOutletId !== '_all' ? adminOutletId : '');
  const [preset, setPreset] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [compareStart, setCompareStart] = useState('');
  const [compareEnd, setCompareEnd] = useState('');
  const [customCompare, setCustomCompare] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState('revenue'); // revenue | txCount

  useEffect(() => {
    const range = getDateRangePreset('30d');
    setStartDate(range.start);
    setEndDate(range.end);
    axios.get('/api/master/outlets').then(r => setOutlets(r?.data?.data || [])).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      if (outletId) params.set('outletId', outletId);
      if (customCompare && compareStart && compareEnd) {
        params.set('compareStart', compareStart);
        params.set('compareEnd', compareEnd);
      }
      const res = await axios.get(`/api/reports/comparison?${params.toString()}`);
      setData(res?.data?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, outletId, customCompare, compareStart, compareEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyPreset = (key) => {
    const range = getDateRangePreset(key);
    if (range) { setStartDate(range.start); setEndDate(range.end); setPreset(key); }
  };

  const cur = data?.current;
  const prev = data?.previous;
  const changes = data?.changes;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F3EEF7', overflow: 'hidden' }}>
      {/* Premium Header with GlowOrb and Sparkle */}
      <div style={{ ...premiumHeader, padding: '0 16px' }}>
        <GlowOrb color="rgba(255,255,255,0.08)" size={200} top="-80px" right="-60px" />
        <GlowOrb color="rgba(255,200,255,0.06)" size={150} bottom="-40px" left="-40px" />
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
            <h1 style={{ ...F, fontSize: 18, fontWeight: 700, color: 'white', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>Comparison Mode</h1>
            <p style={{ ...F, fontSize: 11, color: 'rgba(255,255,255,0.85)', margin: 0 }}>Bandingkan 2 periode side-by-side</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Filter */}
        <div style={{ ...premiumFilterCard, marginBottom: 14 }}>
          <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Periode A (Saat Ini)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {DATE_PRESETS.slice(0, 6).map(p => (
              <Chip key={p.key} label={p.label} active={preset === p.key} onClick={() => applyPreset(p.key)} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <DateTimeInput label="Dari" value={startDate ? `${startDate}T00:00:00` : ''} onChange={v => { setStartDate(v ? v.slice(0, 10) : ''); setPreset(''); }} timeOptional />
            <DateTimeInput label="Sampai" value={endDate ? `${endDate}T00:00:00` : ''} onChange={v => { setEndDate(v ? v.slice(0, 10) : ''); setPreset(''); }} timeOptional />
          </div>
          <Select label="Outlet" value={outletId} onChange={setOutletId}
            options={[{ value: '', label: '🏪 Semua outlet' }, ...outlets.map(o => ({ value: o.id, label: o.name }))]} />

          {/* Period B */}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.n100}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n700 }}>Periode B (Pembanding)</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={customCompare} onChange={e => setCustomCompare(e.target.checked)} />
                <span style={{ ...F, fontSize: 11, color: C.n700 }}>Custom</span>
              </label>
            </div>
            {customCompare ? (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                <DateTimeInput label="Dari" value={compareStart ? `${compareStart}T00:00:00` : ''} onChange={(v) => setCompareStart(v ? v.slice(0, 10) : '')} timeOptional />
                <DateTimeInput label="Sampai" value={compareEnd ? `${compareEnd}T00:00:00` : ''} onChange={(v) => setCompareEnd(v ? v.slice(0, 10) : '')} timeOptional />
              </div>
            ) : (
              <div style={{ ...F, fontSize: 11, color: C.n700, background: C.n50, padding: '8px 12px', borderRadius: 8 }}>
                Auto: periode sebelumnya dengan durasi yang sama
                {data?.periodB && ` (${data.periodB.start} → ${data.periodB.end})`}
              </div>
            )}
          </div>
        </div>

        {loading && <SkeletonStatGrid count={4} columns={2} />}

        {!loading && data && (
          <>
            {/* Period labels */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                style={{ background: `${C.primary}12`, borderRadius: 10, padding: '8px 12px', borderLeft: `3px solid ${C.primary}` }}
              >
                <div style={{ ...F, fontSize: 9, fontWeight: 600, color: C.primary, letterSpacing: 0.5 }}>PERIODE A</div>
                <div style={{ ...F, fontSize: 11, color: C.n700, marginTop: 2 }}>{data.periodA.start} → {data.periodA.end}</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                style={{ background: `${C.n700}12`, borderRadius: 10, padding: '8px 12px', borderLeft: `3px solid ${C.n700}` }}
              >
                <div style={{ ...F, fontSize: 9, fontWeight: 600, color: C.n700, letterSpacing: 0.5 }}>PERIODE B</div>
                <div style={{ ...F, fontSize: 11, color: C.n700, marginTop: 2 }}>{data.periodB.start} → {data.periodB.end}</div>
              </motion.div>
            </div>

            {/* KPI Comparison Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <MetricCard label="OMSET" currentVal={cur.revenue} prevVal={prev.revenue} delta={changes.revenue} format="currency" color={C.primary} />
              <MetricCard label="TRANSAKSI" currentVal={cur.txCount} prevVal={prev.txCount} delta={changes.txCount} color={C.info} />
              <MetricCard label="PELUNASAN" currentVal={cur.pelunasan} prevVal={prev.pelunasan} delta={changes.pelunasan} format="currency" color={C.success} />
              <MetricCard label="CUSTOMER UNIK" currentVal={cur.uniqueCustomers} prevVal={prev.uniqueCustomers} delta={changes.uniqueCustomers} color={C.primary} />
            </div>

            {/* Avg per transaction */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ ...premiumCard, padding: '12px 16px', marginBottom: 14 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ ...F, fontSize: 10, color: C.n700, fontWeight: 600 }}>RATA-RATA PER TRANSAKSI</div>
                  <div style={{ ...F, fontSize: 18, fontWeight: 600, color: C.n900, marginTop: 2 }}>{rp(cur.avgPerTx)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...F, fontSize: 10, color: C.n700 }}>Periode B</div>
                  <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n700 }}>{rp(prev.avgPerTx)}</div>
                  <Delta value={cur.avgPerTx > 0 && prev.avgPerTx > 0 ? Number((((cur.avgPerTx - prev.avgPerTx) / prev.avgPerTx) * 100).toFixed(1)) : null} />
                </div>
              </div>
            </motion.div>

            {/* Comparison Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              style={{ ...premiumCard, padding: '14px 16px', marginBottom: 14, overflowX: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>Tren Perbandingan</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ key: 'revenue', label: 'Omset' }, { key: 'txCount', label: 'Transaksi' }].map(m => (
                    <motion.button
                      key={m.key}
                      onClick={() => setMetric(m.key)}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        ...F, fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                        background: metric === m.key ? C.primary : C.n100,
                        color: metric === m.key ? C.white : C.n700,
                      }}
                    >{m.label}</motion.button>
                  ))}
                </div>
              </div>
              <ComparisonLineChart
                data={data.comparisonData.map(d => ({
                  date: `Hari ${d.day}`,
                  current: metric === 'revenue' ? d.current : d.currentTx,
                  previous: metric === 'revenue' ? d.previous : d.previousTx,
                }))}
                height={200}
                label1={`Periode A (${data.periodA.start})`}
                label2={`Periode B (${data.periodB.start})`}
              />
            </motion.div>

            {/* Summary insight */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                background: changes.revenue >= 0 ? `${C.success}15` : `${C.danger}15`,
                borderRadius: 18,
                padding: '14px 16px',
                border: `1px solid ${changes.revenue >= 0 ? `${C.success}30` : `${C.danger}30`}`,
                marginBottom: 14,
              }}
            >
              <div style={{ ...F, fontSize: 13, fontWeight: 600, color: changes.revenue >= 0 ? C.success : C.danger, marginBottom: 4 }}>
                {changes.revenue >= 0 ? '📈 Performa Meningkat' : '📉 Performa Menurun'}
              </div>
              <div style={{ ...F, fontSize: 12, color: C.n700, lineHeight: 1.6 }}>
                Omset periode A {changes.revenue >= 0 ? 'lebih tinggi' : 'lebih rendah'} {Math.abs(changes.revenue)}% dibanding periode B.
                Transaksi {changes.txCount >= 0 ? 'naik' : 'turun'} {Math.abs(changes.txCount)}%,
                customer unik {changes.uniqueCustomers >= 0 ? 'naik' : 'turun'} {Math.abs(changes.uniqueCustomers)}%.
              </div>
            </motion.div>
          </>
        )}

        {!loading && !data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: 40, ...F, fontSize: 13, color: C.n700 }}
          >
            Pilih periode untuk mulai membandingkan.
          </motion.div>
        )}
      </div>
    </div>
  );
}
