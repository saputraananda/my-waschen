import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Select, SkeletonList } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const F = { fontFamily: 'Poppins' };

const fmtMonth = (v) => {
  if (!v || !/^\d{4}-\d{2}$/.test(v)) return v;
  const [y, m] = v.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
  return `${months[parseInt(m) - 1]} '${y.slice(2)}`;
};

const ConfidenceBadge = ({ level }) => {
  const cfg = {
    tinggi: { bg: '#DCFCE7', color: '#166534', label: '✓ Akurasi Tinggi' },
    sedang: { bg: '#FEF3C7', color: '#92400E', label: '⚠ Akurasi Sedang' },
    rendah: { bg: '#FEE2E2', color: '#991B1B', label: '✗ Akurasi Rendah' },
  }[level] || { bg: C.n100, color: C.n600, label: level };
  return (
    <span style={{ ...F, fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
};

export default function ForecastPage({ goBack }) {
  const { adminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(adminOutletId && adminOutletId !== '_all' ? adminOutletId : '');
  const [histMonths, setHistMonths] = useState('6');
  const [forecastMonths, setForecastMonths] = useState('3');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get('/api/master/outlets').then(r => setOutlets(r?.data?.data || [])).catch(() => {});
  }, []);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ months: histMonths, forecastMonths });
      if (outletId) params.set('outletId', outletId);
      const res = await axios.get(`/api/reports/forecast?${params.toString()}`);
      setData(res?.data?.data || null);
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [outletId, histMonths, forecastMonths]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  // Merge historical + forecast for chart
  const chartData = data ? [
    ...data.historical.map(h => ({
      month: h.month,
      actual: h.revenue,
      trend: h.trend,
      low: null,
      high: null,
      isForecast: false,
    })),
    ...data.forecast.map(f => ({
      month: f.month,
      actual: null,
      trend: f.predicted,
      low: f.low,
      high: f.high,
      isForecast: true,
    })),
  ] : [];

  const lastHistMonth = data?.historical?.[data.historical.length - 1]?.month;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Forecast Omset" subtitle="Prediksi berbasis data historis" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Filter */}
        <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Select label="Outlet" value={outletId} onChange={setOutletId}
              options={[{ value: '', label: '🏪 Semua' }, ...outlets.map(o => ({ value: o.id, label: o.name }))]} />
            <Select label="Data Historis" value={histMonths} onChange={setHistMonths}
              options={[
                { value: '3', label: '3 bulan' },
                { value: '6', label: '6 bulan' },
                { value: '9', label: '9 bulan' },
                { value: '12', label: '12 bulan' },
              ]} />
            <Select label="Prediksi" value={forecastMonths} onChange={setForecastMonths}
              options={[
                { value: '1', label: '1 bulan' },
                { value: '2', label: '2 bulan' },
                { value: '3', label: '3 bulan' },
                { value: '6', label: '6 bulan' },
              ]} />
          </div>
        </div>

        {loading && <SkeletonList count={3} lines={2} />}

        {!loading && data && (
          <>
            {/* Model info */}
            {data.model && (
              <div style={{ background: C.white, borderRadius: 14, padding: '12px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ ...F, fontSize: 12, fontWeight: 700, color: C.n900 }}>Model Prediksi: Linear Regression</div>
                  <div style={{ ...F, fontSize: 11, color: C.n500, marginTop: 2 }}>
                    Tren: <b style={{ color: data.model.trend === 'naik' ? C.success : data.model.trend === 'turun' ? C.danger : C.n600 }}>
                      {data.model.trend === 'naik' ? '↑' : data.model.trend === 'turun' ? '↓' : '→'} {data.model.trend}
                    </b>
                    {data.model.trendPct !== 0 && ` (${data.model.trendPct > 0 ? '+' : ''}${data.model.trendPct}% selama periode historis)`}
                    {' · '}R² = {data.model.r2}
                  </div>
                </div>
                <ConfidenceBadge level={data.model.confidence} />
              </div>
            )}

            {/* Chart */}
            <div style={{ background: C.white, borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900, marginBottom: 12 }}>
                Historis + Prediksi
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.n100} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => v >= 1e6 ? `${(v/1e6).toFixed(1)}jt` : v >= 1e3 ? `${(v/1e3).toFixed(0)}rb` : v}
                    tick={{ fontFamily: 'Poppins', fontSize: 9, fill: C.n500 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    formatter={(val, name) => val != null ? [`Rp ${Number(val).toLocaleString('id-ID')}`, name] : ['-', name]}
                    labelFormatter={fmtMonth}
                    contentStyle={{ fontFamily: 'Poppins', fontSize: 11, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontFamily: 'Poppins', fontSize: 11 }} />
                  {lastHistMonth && (
                    <ReferenceLine x={lastHistMonth} stroke={C.n400} strokeDasharray="4 2"
                      label={{ value: 'Sekarang', position: 'top', fontSize: 9, fill: C.n500, fontFamily: 'Poppins' }} />
                  )}
                  <Area type="monotone" dataKey="actual" name="Aktual" stroke={C.primary} strokeWidth={2.5} fill="url(#gradActual)" dot={{ r: 3, fill: C.primary }} connectNulls={false} />
                  <Area type="monotone" dataKey="trend" name="Prediksi" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 3" fill="url(#gradForecast)" dot={false} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Forecast table */}
            {data.forecast.length > 0 && (
              <div style={{ background: C.white, borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900, marginBottom: 12 }}>Detail Prediksi</div>
                {data.forecast.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < data.forecast.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                    <div>
                      <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900 }}>{fmtMonth(f.month)}</div>
                      <div style={{ ...F, fontSize: 10, color: C.n500 }}>Range: {rp(f.low)} – {rp(f.high)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...F, fontSize: 16, fontWeight: 800, color: '#F59E0B' }}>{rp(f.predicted)}</div>
                      <div style={{ ...F, fontSize: 9, color: C.n500 }}>prediksi</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div style={{ background: '#FEF3C7', borderRadius: 12, padding: '10px 14px', border: '1px solid #FDE68A' }}>
              <div style={{ ...F, fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
                ⚠️ <b>Catatan:</b> Prediksi ini menggunakan linear regression sederhana berdasarkan tren historis.
                Faktor eksternal (musim, promosi, kompetitor) tidak diperhitungkan.
                Gunakan sebagai panduan, bukan kepastian.
              </div>
            </div>
          </>
        )}

        {!loading && data?.message && (
          <div style={{ textAlign: 'center', padding: 40, ...F, fontSize: 13, color: C.n500 }}>
            {data.message}
          </div>
        )}
      </div>
    </div>
  );
}
