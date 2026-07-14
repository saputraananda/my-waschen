import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Select, DateInput, RevenueAreaChart, TxBarChart, PaymentPieChart, OutletBarChart, SearchFilterHeader, FilterModal, FilterSection, DatePresets, StatMini } from '../../components/ui';
import { useIsMobile, useResponsive, useWindowSize } from '../../utils/hooks';
import { useApp } from '../../context/AppContext';
import { exportToExcel, exportToPDF, fmtCurrency, fmtDate } from '../../utils/exportReport';
import { getDateRangePreset } from '../../utils/filterPresets';

const METHOD_LABEL = {
  cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', deposit: 'Deposit',
  ovo: 'OVO', gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay', mixed: 'Campuran',
};
const METHOD_ICON = {
  cash: '💵', transfer: '🏦', qris: '📱', deposit: '💰',
  ovo: '🟣', gopay: '🟢', dana: '🔵', shopeepay: '🟠', mixed: '🔀',
};
const METHOD_COLOR = {
  cash: C.success, transfer: C.info, qris: C.primary, deposit: C.warning,
  ovo: '#6e2e78', gopay: '#22C55E', dana: '#3B82F6', shopeepay: '#F97316', mixed: '#EC4899',
};

const F = { fontFamily: 'Poppins' };

const PAGE_STYLES = `
  .lap-content { padding: 12px 16px 24px; max-width: 960px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .lap-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lap-kpi-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; margin-bottom: 12px; }
  .lap-filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .lap-date-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 14px; }
  .lap-date-col { flex: 1; min-width: 0; }
  .lap-date-arrow { flex-shrink: 0; padding-bottom: 12px; color: ${C.n800}; font-size: 14px; }
  .lap-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  .lap-section-title { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
  .lap-section-title h3 { font-family: Poppins; font-size: 13px; font-weight: 700; color: ${C.n900}; margin: 0; line-height: 1.35; }
  .lap-section-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; flex-wrap: wrap; flex-shrink: 0; }
  .lap-export-pill { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 999px; border: none; cursor: pointer; font-family: Poppins; font-size: 10px; font-weight: 600; white-space: nowrap; line-height: 1; }
  .lap-export-pill--muted { color: ${C.n800}; background: ${C.n100}; }
  .lap-export-pill--excel { color: ${C.successDark}; background: ${C.successBg}; }
  .lap-export-pill--pdf { color: ${C.dangerDark}; background: ${C.dangerBg}; }
  .lap-payment-grid { display: grid; grid-template-columns: 1fr; gap: 14px; align-items: center; }
  .lap-quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
  @media (max-width: 520px) {
    .lap-hero-grid { grid-template-columns: 1fr; }
    .lap-filter-grid { grid-template-columns: 1fr; }
    .lap-section-head { flex-direction: column; align-items: stretch; }
    .lap-section-actions { justify-content: flex-start; width: 100%; }
  }
  @media (min-width: 640px) {
    .lap-kpi-grid { grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 10px; }
    .lap-payment-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
  }
  @media (max-width: 360px) {
    .lap-date-row { flex-direction: column; align-items: stretch; }
    .lap-date-arrow { display: none; }
  }
`;

const DualBarChart = memo(function DualBarChartInner({ points, labelKey = 'label', maxBars = 14, height = 160 }) {
  const arr = [...(points || [])];
  const sliced = arr.length <= maxBars ? arr : arr.slice(-maxBars);
  if (!sliced.length) return <div style={{ ...F, fontSize: 12, color: C.n800, textAlign: 'center', padding: '24px 0' }}>Belum ada data</div>;
  const maxVal = Math.max(...sliced.flatMap((p) => [Number(p.revenue) || 0, Number(p.pelunasan) || 0]), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.primary }} />
          <span style={{ ...F, fontSize: 10, fontWeight: 500, color: C.n800 }}>Total Transaksi</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: C.success }} />
          <span style={{ ...F, fontSize: 10, fontWeight: 500, color: C.n800 }}>Total Pelunasan</span>
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
                    background: isLast ? `linear-gradient(180deg, ${C.success}, ${C.successDark})` : `${C.success}88`,
                    transition: 'height 0.3s' }}
                />
              </div>
              <span style={{ ...F, fontSize: 8, color: C.n800, textAlign: 'center', lineHeight: 1.1, wordBreak: 'break-all' }}>{lbl}</span>
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
    minWidth: 0,
  }}>
    <div style={{ position: 'absolute', top: -12, right: -12, width: 64, height: 64, borderRadius: 32, background: 'rgba(255,255,255,0.12)' }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, position: 'relative' }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <span style={{ ...F, fontSize: 10, fontWeight: 600, opacity: 0.92, letterSpacing: 0.3, lineHeight: 1.3 }}>{title}</span>
    </div>
    <div style={{ ...F, fontSize: 'clamp(18px, 4.5vw, 22px)', fontWeight: 600, lineHeight: 1.15, position: 'relative', wordBreak: 'break-word' }}>{value}</div>
    {delta != null && (
      <div style={{ ...F, fontSize: 10, opacity: 0.9, marginTop: 6, position: 'relative', lineHeight: 1.4 }}>{delta}</div>
    )}
  </div>
);

const KpiCard = ({ label, value, sub, icon, color = C.primary, accent }) => (
  <div style={{
    background: C.white, borderRadius: 14, padding: '10px 12px',
    boxShadow: SHADOW.sm, borderLeft: `4px solid ${color}`,
    display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0,
  }}>
    <div style={{
      width: 34, height: 34, borderRadius: 9, background: `${color}14`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16,
    }}>{icon}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ ...F, fontSize: 9, color: C.n800, fontWeight: 600, letterSpacing: 0.3, lineHeight: 1.2 }}>{label}</div>
      <div style={{ ...F, fontSize: 'clamp(13px, 3.5vw, 16px)', fontWeight: 600, color: C.n900, marginTop: 2, lineHeight: 1.2, wordBreak: 'break-word' }}>{value}</div>
      {sub && <div style={{ ...F, fontSize: 9, color: accent || C.n800, fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  </div>
);

const SectionCard = ({ icon, title, action, children }) => (
  <div style={{ background: C.white, borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: SHADOW.sm, minWidth: 0 }}>
    <div className="lap-section-head">
      <div className="lap-section-title">
        <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
        <h3>{title}</h3>
      </div>
      {action && <div className="lap-section-actions">{action}</div>}
    </div>
    {children}
  </div>
);

const ExportToolbar = ({ pointCount, onExcel, onPdf }) => (
  <>
    <span className="lap-export-pill lap-export-pill--muted">{pointCount} titik</span>
    <button type="button" className="lap-export-pill lap-export-pill--excel" onClick={onExcel}>
      <span aria-hidden>⬇</span> Excel
    </button>
    <button type="button" className="lap-export-pill lap-export-pill--pdf" onClick={onPdf}>
      <span aria-hidden>⬇</span> PDF
    </button>
  </>
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
  const [showFilter, setShowFilter] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Count active filters
  const filterActive = (preset !== '30d' || !!outletId || groupBy !== 'day');

  const applyPreset = (key) => {
    // Map display keys to getDateRangePreset keys
    const presetKey = key === 'month' ? 'this_month' : key;
    const range = getDateRangePreset(presetKey);
    if (!range) return;
    setStartDate(range.start);
    setEndDate(range.end);
    setPreset(key);
  };

  useEffect(() => {
    applyPreset('30d');
    (async () => {
      try {
        const res = await axios.get('/api/outlets');
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
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, outletId, groupBy]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Export handlers ──────────────────────────────────────
  const handleExportExcel = async () => {
    if (!report) return;
    try {
      const rows = (report.groupBy === 'month' ? report.monthly : report.daily) || [];
      await exportToExcel(rows, {
        filename: `laporan_${report.groupBy}_${startDate}_${endDate}`,
        sheetName: 'Laporan',
        title: `Laporan Keuangan Wäschen — ${startDate} s/d ${endDate}`,
        columns: [
          { key: report.groupBy === 'month' ? 'period' : 'date', header: 'Periode', width: 14 },
          { key: 'txCount', header: 'Jumlah Transaksi', width: 18 },
          { key: 'revenue', header: 'Total Omset (Rp)', width: 20 },
          { key: 'pelunasan', header: 'Total Pelunasan (Rp)', width: 22 },
          { key: 'cashRevenue', header: 'Tunai (Rp)', width: 16 },
          { key: 'transferRevenue', header: 'Transfer (Rp)', width: 16 },
          { key: 'qrisRevenue', header: 'QRIS (Rp)', width: 14 },
        ],
      });
    } catch (e) {
    }
  };

  const handleExportPDF = async () => {
    if (!report) return;
    try {
      const rows = (report.groupBy === 'month' ? report.monthly : report.daily) || [];
      const outletLabel = outletId ? outlets.find(o => o.id === outletId)?.name || 'Outlet' : 'Semua Outlet';
      await exportToPDF(rows, {
        filename: `laporan_${startDate}_${endDate}`,
        title: 'Laporan Keuangan Wäschen',
        subtitle: `${outletLabel} · ${startDate} s/d ${endDate}`,
        orientation: 'landscape',
        summary: [
          { label: 'Total Omset', value: fmtCurrency(totalRevenue) },
          { label: 'Total Pelunasan', value: fmtCurrency(totalPelunasan) },
          { label: 'Total Transaksi', value: totalTx.toLocaleString('id-ID') },
          { label: 'Rata-rata/Trx', value: fmtCurrency(avgPerTx) },
          { label: 'Rata-rata/Hari', value: fmtCurrency(avgPerDay) },
          { label: 'Piutang', value: fmtCurrency(piutang) },
        ],
        columns: [
          { key: report.groupBy === 'month' ? 'period' : 'date', header: 'Periode', width: 22 },
          { key: 'txCount', header: 'Trx', width: 12 },
          { key: 'revenue', header: 'Omset (Rp)', width: 28 },
          { key: 'pelunasan', header: 'Pelunasan (Rp)', width: 28 },
          { key: 'cashRevenue', header: 'Tunai (Rp)', width: 24 },
          { key: 'transferRevenue', header: 'Transfer (Rp)', width: 24 },
          { key: 'qrisRevenue', header: 'QRIS (Rp)', width: 22 },
        ],
      });
    } catch (e) {
    }
  };

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
      <style>{`
        ${PAGE_STYLES}
        @media (max-width: 480px) {
          .lap-stats-row { grid-template-columns: repeat(2, 1fr) !important; }
          .lap-hero-grid { grid-template-columns: 1fr !important; }
          .lap-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .lap-filter-row { flex-direction: column !important; }
          .lap-filter-row > * { width: 100% !important; }
        }
      `}</style>
      <TopBar title="Laporan Pusat" subtitle="Analitik omset & transaksi terpusat" onBack={goBack} />

      {/* Search & Filter Header */}
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: `1px solid ${C.n100}` }}>
        <SearchFilterHeader
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          onFilterClick={() => setShowFilter(true)}
          filterActive={filterActive}
          searchPlaceholder="Cari outlet..."
        />
      </div>

      <div className="lap-content" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 12,
        }}>
          <StatMini label="Periode" value={preset === '30d' ? '30 Hari' : preset === '7d' ? '7 Hari' : preset === 'month' ? 'Bulan Ini' : preset} />
          <StatMini label="Outlet" value={outletId ? '1 Outlet' : 'Semua'} />
          <StatMini label="Grup" value={groupBy === 'day' ? 'Per Hari' : 'Per Bulan'} />
          <StatMini label="Data" value={chartPoints.length} suffix="titik" />
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 32, ...F, fontSize: 13, color: C.n800 }}>
            <div style={{ width: 24, height: 24, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
            Memuat data laporan...
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && report && (
          <>
            {/* Hero — dual */}
            <div className="lap-hero-grid">
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
                icon={'💰'}
                gradient={`linear-gradient(135deg, ${C.success} 0%, ${C.successDark} 100%)`}
              />
            </div>

            {/* KPI Grid */}
            <div className="lap-kpi-grid">
              <KpiCard label="TRANSAKSI" value={totalTx.toLocaleString('id-ID')} sub={`${(totalTx / totalDays).toFixed(1)} per hari`} icon="🧾" color={C.info} />
              <KpiCard label="RATA-RATA/TRX" value={rp(avgPerTx)} icon="📊" color={C.success} />
              <KpiCard label="RATA-RATA/HARI" value={rp(avgPerDay)} icon="📅" color={C.warning} />
              <KpiCard label="OUTLET AKTIF" value={sortedByOutlet.length} sub={outletId ? 'Filter outlet aktif' : 'Semua outlet'} icon="🏪" color={C.materialSutra} />
              {piutang > 0 && (
                <KpiCard label="PIUTANG" value={rp(piutang)} sub="Belum terbayar" icon="⚠️" color={C.warning} accent={C.warning} />
              )}
            </div>

            {/* Trend Chart — Recharts AreaChart */}
            <SectionCard
              icon="📈"
              title={`Tren ${report.groupBy === 'month' ? 'Bulanan' : 'Harian'} — Omset vs Pelunasan`}
              action={
                <ExportToolbar
                  pointCount={chartPoints.length}
                  onExcel={handleExportExcel}
                  onPdf={handleExportPDF}
                />
              }
            >
              <RevenueAreaChart
                data={chartPoints.map(p => ({ date: p.label, revenue: p.revenue, pelunasan: p.pelunasan }))}
                height={200}
              />
            </SectionCard>

            {/* Payment Mix — Recharts PieChart */}
            {(report.byMethod || []).length > 0 && (
              <SectionCard icon="💳" title="Distribusi Metode Pembayaran">
                <div className="lap-payment-grid">
                  <div style={{ minWidth: 0, display: 'flex', justifyContent: 'center' }}>
                    <PaymentPieChart data={report.byMethod || []} height={180} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                    {(report.byMethod || []).map((m) => {
                      const pct = (Number(m.revenue) / methodTotalRevenue) * 100;
                      return (
                        <div key={m.method || '-'} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12 }}>{METHOD_ICON[m.method] || '💳'}</span>
                            <span style={{ ...F, fontSize: 11, color: C.n700 }}>{METHOD_LABEL[m.method] || m.method}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ ...F, fontSize: 11, fontWeight: 600, color: C.n900 }}>{rp(m.revenue)}</div>
                            <div style={{ ...F, fontSize: 9, color: C.n800 }}>{pct.toFixed(1)}% · {m.txCount} trx</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Outlet Leaderboard */}
            {sortedByOutlet.length > 0 && (
              <SectionCard icon="🏪" title="Performa Per Outlet" action={
                <span className="lap-export-pill lap-export-pill--muted">{sortedByOutlet.length} outlet</span>
              }>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sortedByOutlet.map((row, idx) => {
                    const pct = totalRevenue > 0 ? (Number(row.revenue) / totalRevenue) * 100 : 0;
                    const rankColor = idx === 0 ? C.warning : idx === 1 ? C.n400 : idx === 2 ? '#CD7F32' : C.n800;
                    return (
                      <div key={row.outletName || idx} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        background: idx === 0 ? C.warningBg : C.n50, borderRadius: 10,
                        border: `1px solid ${idx === 0 ? C.warning : 'transparent'}`,
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 16, background: rankColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...F, fontSize: 12, fontWeight: 600, color: C.white, flexShrink: 0,
                        }}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.outletName || '—'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, background: C.n200, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.primaryDark})`, transition: 'width 0.5s' }} />
                            </div>
                            <span style={{ ...F, fontSize: 10, fontWeight: 600, color: C.primary, minWidth: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>{rp(row.revenue)}</div>
                          <div style={{ ...F, fontSize: 10, color: C.n800 }}>{row.txCount} trx</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Quick navigation */}
            <SectionCard icon="🔗" title="Lihat Detail Lainnya">
              <div className="lap-quick-grid">
                <QuickLink icon="📋" label="General Report" onClick={() => navigate('general_report')} />
                <QuickLink icon="💰" label="Rekap Pendapatan" onClick={() => navigate('rekap_pendapatan')} />
                <QuickLink icon="🕐" label="Shift Kasir" onClick={() => navigate('admin_shift')} />
              </div>
            </SectionCard>
          </>
        )}

        {!loading && !report && (
          <div style={{ ...T.card, textAlign: 'center', padding: 24, ...F, color: C.n800, fontSize: 13 }}>
            Tidak ada data untuk periode ini.
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        title="Filter Laporan"
        onApply={() => {
          // Apply is automatic - values are already updated via state
        }}
        onReset={() => {
          applyPreset('30d');
          setOutletId('');
          setGroupBy('day');
        }}
      >
        <FilterSection title="Periode Waktu">
          <DatePresets
            selected={preset}
            onChange={(val) => {
              setPreset(val);
              applyPreset(val);
            }}
          />
        </FilterSection>

        <FilterSection title="Outlet">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => setOutletId('')}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: `1.5px solid ${!outletId ? C.primary : C.n200}`,
                background: !outletId ? `${C.primary}12` : 'white',
                cursor: 'pointer',
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: !outletId ? 600 : 500,
                color: !outletId ? C.primary : C.n700,
              }}
            >
              Semua Outlet
            </button>
            {outlets.slice(0, 6).map((o) => (
              <button
                key={o.id}
                onClick={() => setOutletId(o.id)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${outletId === o.id ? C.primary : C.n200}`,
                  background: outletId === o.id ? `${C.primary}12` : 'white',
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: 12,
                  fontWeight: outletId === o.id ? 600 : 500,
                  color: outletId === o.id ? C.primary : C.n700,
                }}
              >
                {o.name}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Pengelompokan">
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setGroupBy('day')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: `1.5px solid ${groupBy === 'day' ? C.primary : C.n200}`,
                background: groupBy === 'day' ? `${C.primary}12` : 'white',
                cursor: 'pointer',
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: groupBy === 'day' ? 600 : 500,
                color: groupBy === 'day' ? C.primary : C.n700,
              }}
            >
              Per Hari
            </button>
            <button
              onClick={() => setGroupBy('month')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 10,
                border: `1.5px solid ${groupBy === 'month' ? C.primary : C.n200}`,
                background: groupBy === 'month' ? `${C.primary}12` : 'white',
                cursor: 'pointer',
                fontFamily: 'Poppins',
                fontSize: 12,
                fontWeight: groupBy === 'month' ? 600 : 500,
                color: groupBy === 'month' ? C.primary : C.n700,
              }}
            >
              Per Bulan
            </button>
          </div>
        </FilterSection>
      </FilterModal>
    </div>
  );
}

const thStyle = { ...F, fontSize: 10, fontWeight: 600, color: C.n800, padding: '8px 6px', textAlign: 'left', letterSpacing: 0.3, whiteSpace: 'nowrap' };
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
