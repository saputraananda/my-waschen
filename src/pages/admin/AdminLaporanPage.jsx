import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip } from '../../components/ui';

const METHOD_LABEL = {
  cash: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  deposit: 'Deposit',
  mixed: 'Campuran',
};

const BarChart = memo(function BarChartInner({ points, valueKey = 'revenue', labelKey = 'label', maxBars = 14 }) {
  const arr = [...(points || [])];
  const sliced = arr.length <= maxBars ? arr : arr.slice(-maxBars);

  if (!sliced.length) return null;
  const maxVal = Math.max(...sliced.map((p) => Number(p[valueKey]) || 0), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 96, padding: '4px 2px 0' }}>
      {sliced.map((p, i) => {
        const v = Number(p[valueKey]) || 0;
        const h = Math.max((v / maxVal) * 100, 4);
        const isLast = i === sliced.length - 1;
        return (
          <div key={`${p[labelKey]}-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
            <div
              title={rp(v)}
              style={{
                width: '100%',
                maxWidth: 22,
                height: `${h}%`,
                minHeight: 4,
                borderRadius: '5px 5px 2px 2px',
                background: isLast
                  ? `linear-gradient(180deg, ${C.primary}, ${C.primaryDark || C.primary})`
                  : `linear-gradient(180deg, ${C.primaryLight}, #94A3B855)`,
              }}
            />
            <span style={{ fontFamily: 'Poppins', fontSize: 8, color: C.n500, textAlign: 'center', lineHeight: 1.1, wordBreak: 'break-all' }}>
              {String(p[labelKey]).replace(/^\d{4}-/, '')}
            </span>
          </div>
        );
      })}
    </div>
  );
});

export default function AdminLaporanPage({ navigate, goBack }) {
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [preset, setPreset] = useState('30d');
  const [groupBy, setGroupBy] = useState('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const applyPreset = (key) => {
    const end = new Date();
    const start = new Date();
    if (key === '7d') start.setDate(end.getDate() - 6);
    else if (key === '30d') start.setDate(end.getDate() - 29);
    else if (key === 'month') {
      start.setDate(1);
    } else {
      start.setMonth(end.getMonth() - 5);
      start.setDate(1);
    }
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPreset(key);
  };

  useEffect(() => {
    applyPreset('30d');
    (async () => {
      try {
        const res = await axios.get('/api/master/outlets');
        setOutlets(res?.data?.data || []);
      } catch {
        setOutlets([]);
      }
    })();
  }, []);

  const fetchReport = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      let url = `/api/finance/report?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy === 'month' ? 'month' : 'day'}`;
      if (outletId) url += `&outletId=${outletId}`;
      const res = await axios.get(url);
      if (res?.data?.data) setReport(res.data.data);
    } catch (e) {
      console.error(e);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, outletId, groupBy]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const chartPoints = useMemo(() => {
    if (!report) return [];
    if (report.groupBy === 'month' && report.monthly?.length) {
      return [...report.monthly].map((m) => ({
        label: m.period,
        revenue: m.revenue,
        txCount: m.txCount,
      }));
    }
    return [...(report.daily || [])]
      .map((d) => ({
        label: d.date,
        revenue: d.revenue,
        txCount: d.txCount,
      }))
      .reverse();
  }, [report]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Laporan pusat" subtitle="Ringkasan omset & transaksi · filter outlet & periode" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600, marginBottom: 12, lineHeight: 1.45 }}>
          Halaman ini khusus <strong>analitik terpusat</strong> (bukan pembuatan nota). Angka omset mengacu pada total nilai nota per transaksi tercatat, bukan arus kas real-time.
        </div>

        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>Outlet</div>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            style={{
              width: '100%',
              height: 46,
              borderRadius: 10,
              border: `1.5px solid ${C.n300}`,
              fontFamily: 'Poppins',
              fontSize: 14,
              padding: '0 12px',
              background: C.white,
            }}
          >
            <option value="">Semua outlet</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>Periode cepat</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { key: '7d', label: '7 hari' },
              { key: '30d', label: '30 hari' },
              { key: 'month', label: 'Bulan ini' },
              { key: '6m', label: '6 bulan' },
            ].map((p) => (
              <Chip key={p.key} label={p.label} active={preset === p.key} onClick={() => applyPreset(p.key)} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <label style={{ flex: 1, fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
              Mulai
              <input type="date" value={startDate} onChange={(e) => { setPreset(''); setStartDate(e.target.value); }} style={{ display: 'block', width: '100%', marginTop: 4, height: 42, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 8px' }} />
            </label>
            <label style={{ flex: 1, fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
              Sampai
              <input type="date" value={endDate} onChange={(e) => { setPreset(''); setEndDate(e.target.value); }} style={{ display: 'block', width: '100%', marginTop: 4, height: 42, borderRadius: 8, border: `1.5px solid ${C.n300}`, fontFamily: 'Poppins', fontSize: 13, padding: '0 8px' }} />
            </label>
          </div>
        </div>

        <div style={{ background: C.white, borderRadius: 14, padding: '12px 14px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n600, marginBottom: 8 }}>Kelompok grafik</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip label="Per hari" active={groupBy === 'day'} onClick={() => setGroupBy('day')} />
            <Chip label="Per bulan" active={groupBy === 'month'} onClick={() => setGroupBy('month')} />
          </div>
          <Btn variant="secondary" fullWidth style={{ marginTop: 12 }} onClick={fetchReport} loading={loading}>
            Muat ulang data
          </Btn>
        </div>

        {report && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ background: C.white, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Total omset (range)</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 17, fontWeight: 700, color: C.primary, marginTop: 4 }}>{rp(report.summary?.totalRevenue || 0)}</div>
              </div>
              <div style={{ background: C.white, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>Jumlah transaksi</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 17, fontWeight: 700, color: C.n900, marginTop: 4 }}>{report.summary?.totalTx ?? 0}</div>
              </div>
            </div>

            <div style={{ background: C.white, borderRadius: 14, padding: '14px 14px 10px', marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 8 }}>
                Grafik {report.groupBy === 'month' ? 'bulanan' : 'harian'}
              </div>
              <BarChart points={chartPoints} maxBars={report.groupBy === 'month' ? 12 : 14} />
            </div>

            <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 10 }}>Per outlet</div>
              {(report.byOutlet || []).map((row) => (
                <div key={row.outletName || '—'} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.n100}` }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800 }}>{row.outletName || '—'}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>{rp(row.revenue)} · {row.txCount} trx</span>
                </div>
              ))}
              {(!report.byOutlet || report.byOutlet.length === 0) && (
                <div style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Tidak ada data di periode ini.</div>
              )}
            </div>

            <div style={{ background: C.white, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 10 }}>Metode pembayaran (utama)</div>
              {(report.byMethod || []).map((row) => (
                <div key={row.method || '—'} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.n100}` }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n800 }}>{METHOD_LABEL[row.method] || row.method || '—'}</span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600 }}>{rp(row.revenue)} · {row.txCount} trx</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
