import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Chip, Btn } from '../../components/ui';
import OutletDropdown from '../../components/ui/OutletDropdown';

const PERIOD_OPTIONS = [
  { key: '7d',  label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: '90d', label: '3 Bulan' },
];

// ── Mini Chart Component ─────────────────────────────────────────────────────
const DailyChart = ({ data, maxDays = 14 }) => {
  const sliced = (data || []).slice(0, maxDays).reverse();
  if (sliced.length === 0) return null;
  const maxVal = Math.max(...sliced.map((d) => d.revenue), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, padding: '0 2px' }}>
      {sliced.map((d, i) => {
        const h = Math.max((d.revenue / maxVal) * 100, 3);
        const isLast = i === sliced.length - 1;
        return (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div
              style={{
                width: '100%', maxWidth: 24, height: `${h}%`,
                borderRadius: '4px 4px 1px 1px', minHeight: 3,
                background: isLast
                  ? `linear-gradient(180deg, ${C.primary}, ${C.primarySoft})`
                  : `linear-gradient(180deg, ${C.primaryLight}, ${C.secondary}55)`,
                transition: 'height 0.5s ease',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

// ── Payment Method Bar ───────────────────────────────────────────────────────
const METHOD_COLORS = {
  cash: { bg: '#10B981', label: 'Tunai', icon: '💵' },
  transfer: { bg: '#2563EB', label: 'Transfer', icon: '🏦' },
  qris: { bg: '#7C3AED', label: 'QRIS', icon: '📱' },
  deposit: { bg: '#F59E0B', label: 'Deposit', icon: '💳' },
};

export default function LaporanKeuanganPage({ navigate, goBack }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [outletId, setOutletId] = useState('');
  const [outlets, setOutlets] = useState([]);

  const getDateRange = (p) => {
    const end = new Date().toISOString().slice(0, 10);
    const days = p === '7d' ? 7 : p === '90d' ? 90 : 30;
    const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return { start, end };
  };

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(period);
      let url = `/api/finance/report?startDate=${start}&endDate=${end}`;
      if (outletId) url += `&outletId=${outletId}`;
      const res = await axios.get(url);
      if (res?.data?.data) {
        setReport(res.data.data);
      }
      // fetch outlets for filter
      try {
        const statsRes = await axios.get('/api/finance/stats');
        if (statsRes?.data?.data?.outlets) setOutlets(statsRes.data.data.outlets);
      } catch { /* ignore */ }
    } catch (err) {
      console.error('[LaporanKeuangan] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [period, outletId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!report?.daily?.length) return;

    const headers = ['Tanggal', 'Jumlah Transaksi', 'Revenue', 'Tunai', 'Transfer', 'QRIS', 'Deposit'];
    const rows = report.daily.map((d) => [
      d.date,
      d.txCount,
      d.revenue,
      d.cashRevenue || 0,
      d.transferRevenue || 0,
      d.qrisRevenue || 0,
      d.depositRevenue || 0,
    ]);

    // Add summary row
    rows.push([]);
    rows.push(['TOTAL', report.summary.totalTx, report.summary.totalRevenue]);

    // Add outlet breakdown
    if (report.byOutlet?.length > 0) {
      rows.push([]);
      rows.push(['PER OUTLET']);
      rows.push(['Outlet', 'Transaksi', 'Revenue']);
      report.byOutlet.forEach((o) => {
        rows.push([o.outletName || 'Unknown', o.txCount, o.revenue]);
      });
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Keuangan_${report.period.start}_${report.period.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const avgDaily = report?.daily?.length > 0
    ? Math.round(report.summary.totalRevenue / report.daily.length)
    : 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Laporan Keuangan"
        subtitle={report?.period ? `${report.period.start} s/d ${report.period.end}` : ''}
        onBack={goBack}
        rightAction={report?.daily?.length > 0 ? exportCSV : undefined}
        rightIcon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        }
      />

      {/* Filters */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {PERIOD_OPTIONS.map((p) => (
            <Chip key={p.key} label={p.label} active={period === p.key} onClick={() => setPeriod(p.key)} />
          ))}
          {/* Export button inline */}
          {report?.daily?.length > 0 && (
            <Chip label="📥 Export" active={false} onClick={exportCSV} color="#0EA5E9" />
          )}
        </div>
        {outlets.length > 1 && (
          <OutletDropdown value={outletId} onChange={setOutletId} outlets={outlets} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: C.white, borderRadius: 16, padding: 16, height: 80, animation: 'pulse 1.5s infinite', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }} />
            ))}
          </div>
        ) : !report ? (
          <div style={{ textAlign: 'center', padding: 40, fontFamily: 'Poppins', fontSize: 13, color: C.n500 }}>Tidak ada data</div>
        ) : (
          <>
            {/* ── Summary Card ───────────────────────────────────────── */}
            <div style={{
              background: `linear-gradient(135deg, ${C.primary}, #1E3A5F)`,
              borderRadius: 16, padding: 20, marginBottom: 14, color: 'white',
            }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                Total Revenue
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
                {rp(report.summary.totalRevenue)}
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700 }}>{report.summary.totalTx}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Total Transaksi</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 700 }}>{rp(avgDaily)}</div>
                  <div style={{ fontFamily: 'Poppins', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Rata-rata / Hari</div>
                </div>
              </div>
            </div>

            {/* ── Chart ──────────────────────────────────────────────── */}
            {report.daily?.length > 0 && (
              <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 12 }}>
                  📊 Grafik Revenue Harian
                </div>
                <DailyChart data={report.daily} maxDays={period === '7d' ? 7 : 14} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>
                    {report.daily[report.daily.length - 1]?.date ? new Date(report.daily[report.daily.length - 1].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                  <span style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>
                    {report.daily[0]?.date ? new Date(report.daily[0].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}
                  </span>
                </div>
              </div>
            )}

            {/* ── By Payment Method ──────────────────────────────────── */}
            <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 14 }}>Per Metode Pembayaran</div>

              {/* Stacked bar visualization */}
              {report.summary.totalRevenue > 0 && (
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
                  {report.byMethod.map((m) => {
                    const pct = Math.max((m.revenue / report.summary.totalRevenue) * 100, 0);
                    const mc = METHOD_COLORS[m.method] || { bg: C.n300, label: m.method };
                    return <div key={m.method} style={{ width: `${pct}%`, background: mc.bg, transition: 'width 0.5s ease' }} />;
                  })}
                </div>
              )}

              {report.byMethod.map((m) => {
                const pct = report.summary.totalRevenue > 0 ? Math.round((m.revenue / report.summary.totalRevenue) * 100) : 0;
                const mc = METHOD_COLORS[m.method] || { bg: C.n300, label: m.method, icon: '💰' };
                return (
                  <div key={m.method} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 10px', background: C.n50, borderRadius: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${mc.bg}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{mc.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900 }}>{mc.label}</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: mc.bg }}>{rp(m.revenue)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{m.txCount} transaksi</span>
                        <span style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{pct}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── By Outlet ──────────────────────────────────────────── */}
            {report.byOutlet.length > 0 && (
              <div style={{ background: C.white, borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900, marginBottom: 14 }}>🏪 Per Outlet</div>
                {report.byOutlet.map((o, i) => {
                  const pct = report.summary.totalRevenue > 0 ? Math.round((o.revenue / report.summary.totalRevenue) * 100) : 0;
                  return (
                    <div key={o.outletName || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < report.byOutlet.length - 1 ? `1px solid ${C.n100}` : 'none' }}>
                      <div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>{o.outletName || 'Unknown'}</div>
                        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 2 }}>{o.txCount} transaksi · {pct}%</div>
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.primary }}>{rp(o.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Daily breakdown ─────────────────────────────────────── */}
            <div style={{ background: C.white, borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n900 }}>📅 Detail Harian</div>
                <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{report.daily.length} hari</div>
              </div>
              {report.daily.slice(0, 21).map((d, i) => (
                <div key={d.date} style={{ padding: '10px 0', borderBottom: i < Math.min(report.daily.length, 21) - 1 ? `1px solid ${C.n50}` : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 500, color: C.n900 }}>
                        {new Date(d.date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </div>
                      <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500 }}>{d.txCount} transaksi</div>
                    </div>
                    <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, color: C.n900 }}>{rp(d.revenue)}</div>
                  </div>
                  {/* Mini method breakdown */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {d.cashRevenue > 0 && <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#10B981', background: '#DCFCE7', padding: '1px 6px', borderRadius: 999 }}>💵 {rp(d.cashRevenue)}</span>}
                    {d.transferRevenue > 0 && <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#2563EB', background: '#DBEAFE', padding: '1px 6px', borderRadius: 999 }}>🏦 {rp(d.transferRevenue)}</span>}
                    {d.qrisRevenue > 0 && <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#7C3AED', background: '#EDE9FE', padding: '1px 6px', borderRadius: 999 }}>📱 {rp(d.qrisRevenue)}</span>}
                    {d.depositRevenue > 0 && <span style={{ fontFamily: 'Poppins', fontSize: 9, color: '#B45309', background: '#FEF3C7', padding: '1px 6px', borderRadius: 999 }}>💳 {rp(d.depositRevenue)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
