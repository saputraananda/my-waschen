import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import axios from 'axios';
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip, Select, DateInput } from '../../components/ui';
import { useApp } from '../../context/AppContext';

const METHOD_LABEL = {
  cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', deposit: 'Deposit',
  ovo: 'OVO', gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay', mixed: 'Campuran',
};
const METHOD_ICON = {
  cash: '💵', transfer: '🏦', qris: '📱', deposit: '💰',
  ovo: '🟣', gopay: '🟢', dana: '🔵', shopeepay: '🟠', mixed: '🔀',
};
const METHOD_COLOR = {
  cash: '#10B981', transfer: '#0EA5E9', qris: '#8B5CF6', deposit: '#F59E0B',
  ovo: '#7C3AED', gopay: '#22C55E', dana: '#3B82F6', shopeepay: '#F97316', mixed: '#EC4899',
};

const F = { fontFamily: 'Poppins' };

const DualBarChart = memo(function DualBarChartInner({ points, labelKey = 'label', maxBars = 14, height = 160 }) {
  const arr = [...(points || [])];
  const sliced = arr.length <= maxBars ? arr : arr.slice(-maxBars);
  if (!sliced.length) return <div style={{ ...F, fontSize: 12, color: C.n400, textAlign: 'center', padding: '24px 0' }}>Belum ada data</div>;
  const maxVal = Math.max(...sliced.flatMap((p) => [Number(p.revenue) || 0, Number(p.pelunasan) || 0]), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.primary }} />
          <span style={{ ...F, fontSize: 10, fontWeight: 600, color: C.n600 }}>Total Transaksi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.success }} />
          <span style={{ ...F, fontSize: 10, fontWeight: 600, color: C.n600 }}>Total Pelunasan</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, padding: '8px 0 0' }}>
        {sliced.map((p, i) => {
          const rv = Number(p.revenue) || 0;
          const pv = Number(p.pelunasan) || 0;
          const rh = Math.max((rv / maxVal) * 100, 3);
          const ph = Math.max((pv / maxVal) * 100, 3);
          const isLast = i === sliced.length - 1;
          const lbl = String(p[labelKey] || '').replace(/^\d{4}-/, '');
          return (
            <div key={`${lbl}-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, width: '100%', justifyContent: 'center' }}>
                <div
                  title={`Transaksi: ${rp(rv)}`}
                  style={{ flex: 1, maxWidth: 18, height: `${rh}%`, minHeight: 4, borderRadius: '4px 4px 1px 1px',
                    background: isLast ? `linear-gradient(180deg, ${C.primary}, ${C.primaryDark})` : `${C.primary}88`,
                    transition: 'height 0.3s' }}
                />
                <div
                  title={`Pelunasan: ${rp(pv)}`}
                  style={{ flex: 1, maxWidth: 18, height: `${ph}%`, minHeight: 4, borderRadius: '4px 4px 1px 1px',
                    background: isLast ? `linear-gradient(180deg, ${C.success}, #059669)` : `${C.success}88`,
                    transition: 'height 0.3s' }}
                />
              </div>
              <span style={{ ...F, fontSize: 8, color: C.n500, textAlign: 'center', lineHeight: 1.1, wordBreak: 'break-all' }}>{lbl}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const HeroCard = ({ title, value, delta, icon, gradient }) => (
  <div style={{
    background: gradient, borderRadius: 16, padding: '14px 16px', color: C.white,
    boxShadow: '0 4px 16px rgba(91,0,95,0.18)', position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: -12, right: -12, width: 64, height: 64, borderRadius: 32, background: 'rgba(255,255,255,0.12)' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, position: 'relative' }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ ...F, fontSize: 11, fontWeight: 600, opacity: 0.92, letterSpacing: 0.3 }}>{title}</span>
    </div>
    <div style={{ ...F, fontSize: 22, fontWeight: 800, lineHeight: 1.1, position: 'relative' }}>{value}</div>
    {delta != null && (
      <div style={{ ...F, fontSize: 10, opacity: 0.9, marginTop: 4, position: 'relative' }}>{delta}</div>
    )}
  </div>
);

const KpiCard = ({ label, value, sub, icon, color = C.primary, accent }) => (
  <div style={{
    background: C.white, borderRadius: 14, padding: '12px 14px',
    boxShadow: '0 2px 8px rgba(15,23,42,0.06)', borderLeft: `4px solid ${color}`,
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <div style={{
      width: 38, height: 38, borderRadius: 10, background: `${color}14`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18,
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...F, fontSize: 10, color: C.n500, fontWeight: 600, letterSpacing: 0.3 }}>{label}</div>
      <div style={{ ...F, fontSize: 16, fontWeight: 800, color: C.n900, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ ...F, fontSize: 10, color: accent || C.n500, fontWeight: 600, marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const SectionCard = ({ icon, title, action, children }) => (
  <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h3 style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900, margin: 0, flex: 1 }}>{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

export default function AdminLaporanPage({ navigate, goBack }) {
  const { adminOutletId } = useApp();
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(adminOutletId && adminOutletId !== '_all' ? adminOutletId : '');
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
    else if (key === 'month') start.setDate(1);
    else if (key === '3m') { start.setMonth(end.getMonth() - 2); start.setDate(1); }
    else { start.setMonth(end.getMonth() - 5); start.setDate(1); }
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
      } catch { setOutlets([]); }
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

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const chartPoints = useMemo(() => {
    if (!report) return [];
    if (report.groupBy === 'month' && report.monthly?.length) {
      return [...report.monthly].map((m) => ({ label: m.period, revenue: m.revenue, pelunasan: m.pelunasan || 0, txCount: m.txCount }));
    }
    return [...(report.daily || [])].map((d) => ({ label: d.date, revenue: d.revenue, pelunasan: d.pelunasan || 0, txCount: d.txCount })).reverse();
  }, [report]);

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    return Math.max(1, Math.round((new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`)) / 86400000) + 1);
  }, [startDate, endDate]);

  const totalRevenue = Number(report?.summary?.totalRevenue || 0);
  const totalPelunasan = Number(report?.summary?.totalPelunasan || 0);
  const totalTx = Number(report?.summary?.totalTx || 0);
  const piutang = Math.max(0, totalRevenue - totalPelunasan);
  const avgPerTx = totalTx > 0 ? Math.round(totalRevenue / totalTx) : 0;
  const avgPerDay = Math.round(totalRevenue / totalDays);

  const sortedByOutlet = useMemo(() => {
    return [...(report?.byOutlet || [])].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  }, [report]);

  const methodTotalRevenue = useMemo(() => {
    return (report?.byMethod || []).reduce((s, r) => s + Number(r.revenue || 0), 0) || 1;
  }, [report]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Laporan Pusat" subtitle="Analitik omset & transaksi terpusat" onBack={goBack} />

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {/* Filter Bar - Sticky */}
        <div style={{
          background: C.white, borderRadius: 14, padding: 12, marginBottom: 12,
          boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {[
              { key: '7d', label: '7 hari' },
              { key: '30d', label: '30 hari' },
              { key: 'month', label: 'Bulan ini' },
              { key: '3m', label: '3 bulan' },
              { key: '6m', label: '6 bulan' },
            ].map((p) => (
              <Chip key={p.key} label={p.label} active={preset === p.key} onClick={() => applyPreset(p.key)} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
            <DateInput label="Dari" value={startDate} onChange={(v) => { setPreset(''); setStartDate(v); }} />
            <DateInput label="Sampai" value={endDate} onChange={(v) => { setPreset(''); setEndDate(v); }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            <Select label="Outlet" value={outletId} onChange={setOutletId}
              options={[{ value: '', label: '🏪 Semua outlet' }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]} />
            <Select label="Grafik" value={groupBy} onChange={setGroupBy}
              options={[{ value: 'day', label: '📅 Per hari' }, { value: 'month', label: '📆 Per bulan' }]} />
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 32, ...F, fontSize: 13, color: C.n500 }}>
            <div style={{ width: 24, height: 24, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
            Memuat data laporan...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && report && (
          <>
            {/* Hero — dual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <HeroCard
                title="TOTAL TRANSAKSI"
                value={rp(totalRevenue)}
                delta={`Nilai semua nota · ${totalTx} trx`}
                icon="🧾"
                gradient={`linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`}
              />
              <HeroCard
                title="TOTAL PELUNASAN"
                value={rp(totalPelunasan)}
                delta={`Uang diterima${piutang > 0 ? ` · piutang ${rp(piutang)}` : ' · lunas semua'}`}
                icon="�"
                gradient={`linear-gradient(135deg, #059669 0%, #047857 100%)`}
              />
            </div>

            {/* KPI Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12, marginBottom: 12 }}>
              <KpiCard label="TRANSAKSI" value={totalTx.toLocaleString('id-ID')} sub={`${(totalTx / totalDays).toFixed(1)} per hari`} icon="🧾" color={C.info} />
              <KpiCard label="RATA-RATA/TRX" value={rp(avgPerTx)} icon="📊" color={C.success} />
              <KpiCard label="RATA-RATA/HARI" value={rp(avgPerDay)} icon="📅" color="#F59E0B" />
              <KpiCard label="OUTLET AKTIF" value={sortedByOutlet.length} sub={outletId ? 'Filter outlet aktif' : 'Semua outlet'} icon="🏪" color="#EC4899" />
              {piutang > 0 && (
                <KpiCard label="PIUTANG" value={rp(piutang)} sub="Belum terbayar" icon="⚠️" color={C.warning} accent={C.warning} />
              )}
            </div>

            {/* Trend Chart */}
            <SectionCard
              icon="📈"
              title={`Tren ${report.groupBy === 'month' ? 'Bulanan' : 'Harian'} — Transaksi vs Pelunasan`}
              action={<span style={{ ...F, fontSize: 10, color: C.n500, background: C.n100, padding: '3px 8px', borderRadius: 999, fontWeight: 600 }}>{chartPoints.length} titik data</span>}
            >
              <DualBarChart points={chartPoints} labelKey="label" maxBars={report.groupBy === 'month' ? 12 : 14} height={160} />
            </SectionCard>

            {/* Payment Mix */}
            {(report.byMethod || []).length > 0 && (
              <SectionCard icon="💳" title="Distribusi Metode Pembayaran">
                {/* Stacked horizontal bar */}
                <div style={{ display: 'flex', height: 28, borderRadius: 10, overflow: 'hidden', marginBottom: 12, background: C.n100 }}>
                  {(report.byMethod || []).map((m) => {
                    const pct = (Number(m.revenue) / methodTotalRevenue) * 100;
                    return (
                      <div key={m.method} title={`${METHOD_LABEL[m.method] || m.method}: ${pct.toFixed(1)}%`}
                        style={{ width: `${pct}%`, background: METHOD_COLOR[m.method] || C.n400 }} />
                    );
                  })}
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', ...F, fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1.5px solid ${C.n200}` }}>
                        <th style={thStyle}>Metode</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Trx</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Omset</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>% Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.byMethod || []).map((m) => {
                        const pct = (Number(m.revenue) / methodTotalRevenue) * 100;
                        return (
                          <tr key={m.method || '-'} style={{ borderBottom: `1px solid ${C.n100}` }}>
                            <td style={tdStyle}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 4, background: METHOD_COLOR[m.method] || C.n400, flexShrink: 0 }} />
                                <span>{METHOD_ICON[m.method] || '💳'} {METHOD_LABEL[m.method] || m.method || '—'}</span>
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{m.txCount}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{rp(m.revenue)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <span style={{
                                ...F, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                                background: `${METHOD_COLOR[m.method] || C.n400}18`, color: METHOD_COLOR[m.method] || C.n600,
                              }}>{pct.toFixed(1)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* Outlet Leaderboard */}
            {sortedByOutlet.length > 0 && (
              <SectionCard icon="🏪" title="Performa Per Outlet" action={
                <span style={{ ...F, fontSize: 10, color: C.n500 }}>{sortedByOutlet.length} outlet</span>
              }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sortedByOutlet.map((row, idx) => {
                    const pct = totalRevenue > 0 ? (Number(row.revenue) / totalRevenue) * 100 : 0;
                    const rankColor = idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#CD7F32' : C.n400;
                    return (
                      <div key={row.outletName || idx} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        background: idx === 0 ? '#FFFBEB' : C.n50, borderRadius: 10,
                        border: `1px solid ${idx === 0 ? '#FCD34D' : 'transparent'}`,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 16, background: rankColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...F, fontSize: 12, fontWeight: 800, color: C.white, flexShrink: 0,
                        }}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...F, fontSize: 13, fontWeight: 700, color: C.n900, marginBottom: 4 }}>{row.outletName || '—'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: C.n200, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, transition: 'width 0.5s' }} />
                            </div>
                            <span style={{ ...F, fontSize: 10, fontWeight: 700, color: C.primary, minWidth: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ ...F, fontSize: 13, fontWeight: 800, color: C.n900 }}>{rp(row.revenue)}</div>
                          <div style={{ ...F, fontSize: 10, color: C.n500 }}>{row.txCount} trx</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Quick navigation */}
            <SectionCard icon="🔗" title="Lihat Detail Lainnya">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                <QuickLink icon="📋" label="General Report" onClick={() => navigate('general_report')} />
                <QuickLink icon="💰" label="Rekap Pendapatan" onClick={() => navigate('rekap_pendapatan')} />
                <QuickLink icon="🕐" label="Shift Kasir" onClick={() => navigate('admin_shift')} />
              </div>
            </SectionCard>
          </>
        )}

        {!loading && !report && (
          <div style={{ ...T.card, textAlign: 'center', padding: 24, ...F, color: C.n500, fontSize: 13 }}>
            Tidak ada data untuk periode ini.
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = { ...F, fontSize: 10, fontWeight: 700, color: C.n500, padding: '8px 6px', textAlign: 'left', letterSpacing: 0.3, whiteSpace: 'nowrap' };
const tdStyle = { ...F, fontSize: 12, color: C.n800, padding: '10px 6px', whiteSpace: 'nowrap' };

const QuickLink = ({ icon, label, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    background: C.n50, border: `1px solid ${C.n100}`, borderRadius: 10,
    cursor: 'pointer', textAlign: 'left',
  }}>
    <span style={{ fontSize: 16 }}>{icon}</span>
    <span style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n900 }}>{label}</span>
  </button>
);
