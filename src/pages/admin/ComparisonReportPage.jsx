import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Chip, Select, DateTimeInput, ComparisonLineChart, SkeletonStatGrid } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { getDateRangePreset, DATE_PRESETS } from '../../utils/filterPresets';

const F = { fontFamily: 'Poppins' };

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
    <div style={{ background: C.white, borderRadius: 14, padding: '14px 16px', boxShadow: SHADOW.sm }}>
      <div style={{ ...F, fontSize: 10, color: C.n700, fontWeight: 600, letterSpacing: 0.3, marginBottom: 6 }}>{label}</div>
      <div style={{ ...F, fontSize: 20, fontWeight: 600, color, lineHeight: 1.1 }}>{fmt(currentVal)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        <span style={{ ...F, fontSize: 10, color: C.n700 }}>vs {fmt(prevVal)}</span>
        <Delta value={delta} />
      </div>
    </div>
  );
};

export default function ComparisonReportPage({ goBack }) {
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
    } catch (e) {
      console.error(e);
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Comparison Mode" subtitle="Bandingkan 2 periode side-by-side" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Filter */}
        <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: SHADOW.md }}>
          <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8 }}>Periode A (Saat Ini)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {DATE_PRESETS.slice(0, 6).map(p => (
              <Chip key={p.key} label={p.label} active={preset === p.key} onClick={() => applyPreset(p.key)} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
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
              <div style={{ background: `${C.primary}12`, borderRadius: 10, padding: '8px 12px', borderLeft: `3px solid ${C.primary}` }}>
                <div style={{ ...F, fontSize: 9, fontWeight: 600, color: C.primary, letterSpacing: 0.5 }}>PERIODE A</div>
                <div style={{ ...F, fontSize: 11, color: C.n700, marginTop: 2 }}>{data.periodA.start} → {data.periodA.end}</div>
              </div>
              <div style={{ background: `${C.n700}12`, borderRadius: 10, padding: '8px 12px', borderLeft: `3px solid ${C.n700}` }}>
                <div style={{ ...F, fontSize: 9, fontWeight: 600, color: C.n700, letterSpacing: 0.5 }}>PERIODE B</div>
                <div style={{ ...F, fontSize: 11, color: C.n700, marginTop: 2 }}>{data.periodB.start} → {data.periodB.end}</div>
              </div>
            </div>

            {/* KPI Comparison Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <MetricCard label="OMSET" currentVal={cur.revenue} prevVal={prev.revenue} delta={changes.revenue} format="currency" color={C.primary} />
              <MetricCard label="TRANSAKSI" currentVal={cur.txCount} prevVal={prev.txCount} delta={changes.txCount} color={C.info} />
              <MetricCard label="PELUNASAN" currentVal={cur.pelunasan} prevVal={prev.pelunasan} delta={changes.pelunasan} format="currency" color={C.success} />
              <MetricCard label="CUSTOMER UNIK" currentVal={cur.uniqueCustomers} prevVal={prev.uniqueCustomers} delta={changes.uniqueCustomers} color={C.primary} />
            </div>

            {/* Avg per transaction */}
            <div style={{ background: C.white, borderRadius: 14, padding: '12px 16px', marginBottom: 14, boxShadow: SHADOW.md }}>
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
            </div>

            {/* Comparison Chart */}
            <div style={{ background: C.white, borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>Tren Perbandingan</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ key: 'revenue', label: 'Omset' }, { key: 'txCount', label: 'Transaksi' }].map(m => (
                    <button key={m.key} onClick={() => setMetric(m.key)} style={{
                      ...F, fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                      background: metric === m.key ? C.primary : C.n100,
                      color: metric === m.key ? C.white : C.n700,
                    }}>{m.label}</button>
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
            </div>

            {/* Summary insight */}
            <div style={{ background: changes.revenue >= 0 ? C.successBg : C.dangerBg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${changes.revenue >= 0 ? C.successBg : C.dangerBg}`, marginBottom: 14 }}>
              <div style={{ ...F, fontSize: 13, fontWeight: 600, color: changes.revenue >= 0 ? C.success : C.danger, marginBottom: 4 }}>
                {changes.revenue >= 0 ? '📈 Performa Meningkat' : '📉 Performa Menurun'}
              </div>
              <div style={{ ...F, fontSize: 12, color: changes.revenue >= 0 ? C.successDark : C.dangerDark, lineHeight: 1.6 }}>
                Omset periode A {changes.revenue >= 0 ? 'lebih tinggi' : 'lebih rendah'} {Math.abs(changes.revenue)}% dibanding periode B.
                Transaksi {changes.txCount >= 0 ? 'naik' : 'turun'} {Math.abs(changes.txCount)}%,
                customer unik {changes.uniqueCustomers >= 0 ? 'naik' : 'turun'} {Math.abs(changes.uniqueCustomers)}%.
              </div>
            </div>
          </>
        )}

        {!loading && !data && (
          <div style={{ textAlign: 'center', padding: 40, ...F, fontSize: 13, color: C.n700 }}>
            Pilih periode untuk mulai membandingkan.
          </div>
        )}
      </div>
    </div>
  );
}
