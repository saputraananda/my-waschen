import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { C, T, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Btn, Chip, Select, DateTimeInput, ErrorBoundary } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { exportToExcel, exportToPDF } from '../../utils/exportReport';

const F = { fontFamily: 'Poppins' };

const METHOD_LABEL = {
  cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS', ovo: 'OVO',
  gopay: 'GoPay', dana: 'DANA', shopeepay: 'ShopeePay', deposit: 'Deposit',
};
const METHOD_ICON = {
  cash: '💵', transfer: '🏦', qris: '📱', ovo: '🟣',
  gopay: '🟢', dana: '🔵', shopeepay: '🟠', deposit: '💰',
};

function fmtDt(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return String(v); }
}

function fmtTime(v) {
  if (!v) return '—';
  try { return new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

const hoursSince = (v) => {
  if (!v) return 0;
  const ms = Date.now() - new Date(v).getTime();
  return Number.isFinite(ms) ? ms / 3600000 : 0;
};

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const pctChange = (current, prev) => {
  const c = Number(current || 0);
  const p = Number(prev || 0);
  if (p === 0 && c === 0) return 0;
  if (p === 0) return 100;
  return ((c - p) / p) * 100;
};

const trendVisual = (current, prev, reverseGood = false) => {
  const delta = pctChange(current, prev);
  const up = delta > 0;
  const down = delta < 0;
  const good = reverseGood ? down : up;
  return {
    delta, arrow: up ? '↑' : down ? '↓' : '→',
    color: up || down ? (good ? C.success : C.danger) : C.n700,
    label: `${up ? '+' : ''}${delta.toFixed(1)}%`,
  };
};

const Card = ({ children, style = {}, accentColor }) => (
  <div style={{
    background: C.white, borderRadius: 14, padding: 14,
    boxShadow: SHADOW.sm,
    borderLeft: accentColor ? `4px solid ${accentColor}` : undefined,
    ...style,
  }}>{children}</div>
);

const SectionHeader = ({ icon, title, subtitle, action }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10, padding: '16px 4px 10px',
    marginBottom: 4,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 10,
      background: `${C.primary}14`, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
    }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900 }}>{title}</div>
      {subtitle && <div style={{ ...F, fontSize: 10, color: C.n700, marginTop: 1 }}>{subtitle}</div>}
    </div>
    {action}
  </div>
);

const Pill = ({ children, color = C.n100, textColor = C.n700 }) => (
  <span style={{
    ...F, fontSize: 9, fontWeight: 600, padding: '3px 9px', borderRadius: 999,
    background: color, color: textColor, letterSpacing: 0.3, whiteSpace: 'nowrap',
  }}>{children}</span>
);

const InsightCard = ({ emoji, title, badge, badgeColor, accentColor, children }) => (
  <Card style={{ marginBottom: 0 }} accentColor={accentColor}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${badgeColor}18`, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
      }}>{emoji}</div>
      <div style={{ flex: 1, ...F, fontSize: 12, fontWeight: 600, color: C.n700, lineHeight: 1.3, letterSpacing: 0.2 }}>
        {title}
      </div>
      {badge && <Pill color={`${badgeColor}18`} textColor={badgeColor}>{badge}</Pill>}
    </div>
    {children}
  </Card>
);

const StatBlock = ({ label, value, color = C.n900, hint }) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ ...F, fontSize: 9, color: C.n700, fontWeight: 600, letterSpacing: 0.3 }}>{label}</div>
    <div style={{ ...F, fontSize: 16, fontWeight: 600, color, marginTop: 2, lineHeight: 1.1 }}>{value}</div>
    {hint && <div style={{ ...F, fontSize: 9, color: hint.color || C.n700, fontWeight: 600, marginTop: 2 }}>{hint.text}</div>}
  </div>
);

export function AdminShiftReportPageContent({ navigate, goBack }) {
  const { adminOutletId } = useApp();
  const [tab, setTab] = useState('sessions');
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState(adminOutletId && adminOutletId !== '_all' ? adminOutletId : '');
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState([]);
  const [prevSummary, setPrevSummary] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [expandedSession, setExpandedSession] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const disciplinedOutlet = summary
    .filter((o) => o.closedCount > 0 && o.avgAbsCashDiff != null)
    .slice().sort((a, b) => a.avgAbsCashDiff - b.avgAbsCashDiff || b.closedCount - a.closedCount)[0] || null;

  const problematicOutlet = summary
    .filter((o) => o.closedCount > 0)
    .slice().sort((a, b) => {
      const scoreA = (a.largeDiffCount * 10) + (a.avgAbsCashDiff || 0);
      const scoreB = (b.largeDiffCount * 10) + (b.avgAbsCashDiff || 0);
      return scoreB - scoreA;
    })[0] || null;

  const staleCashiers = sessions
    .filter((s) => s.status === 'open' && hoursSince(s.openedAt) >= 24)
    .slice().sort((a, b) => hoursSince(b.openedAt) - hoursSince(a.openedAt));

  const prevByOutlet = prevSummary.reduce((acc, o) => { acc[o.outletId] = o; return acc; }, {});

  const trendDiscipline = disciplinedOutlet
    ? trendVisual(disciplinedOutlet.avgAbsCashDiff || 0, prevByOutlet[disciplinedOutlet.outletId]?.avgAbsCashDiff || 0, true)
    : null;
  const trendProblem = problematicOutlet
    ? trendVisual(problematicOutlet.largeDiffCount || 0, prevByOutlet[problematicOutlet.outletId]?.largeDiffCount || 0, true)
    : null;
  const stalePrevTotal = prevSummary.reduce((n, o) => n + Number(o.staleOpenCount || 0), 0);
  const staleTrend = trendVisual(staleCashiers.length, stalePrevTotal, true);

  useEffect(() => {
    axios.get('/api/master/outlets').then((r) => setOutlets(r?.data?.data || [])).catch(() => setOutlets([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const q = new URLSearchParams({ dateFrom, dateTo });
      if (outletId) q.set('outletId', outletId);
      const dayCount = Math.max(1, Math.round((new Date(`${dateTo}T00:00:00`) - new Date(`${dateFrom}T00:00:00`)) / 86400000) + 1);
      const prevDateTo = addDays(dateFrom, -1);
      const prevDateFrom = addDays(prevDateTo, -(dayCount - 1));
      const [sRes, uRes, prevRes] = await Promise.all([
        axios.get(`/api/shifts/sessions?${q.toString()}`),
        axios.get(`/api/shifts/outlet-summary?dateFrom=${dateFrom}&dateTo=${dateTo}`),
        axios.get(`/api/shifts/outlet-summary?dateFrom=${prevDateFrom}&dateTo=${prevDateTo}`),
      ]);
      setSessions(sRes?.data?.data || []);
      setSummary(uRes?.data?.data || []);
      setPrevSummary(prevRes?.data?.data || []);
      setMeta(uRes?.data?.meta || null);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Gagal memuat data shift.');
      setSessions([]); setSummary([]); setPrevSummary([]);
    } finally { setLoading(false); }
  }, [outletId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filteredSessions = useMemo(() => {
    if (filterStatus === 'open') return sessions.filter(s => s.status === 'open');
    if (filterStatus === 'closed') return sessions.filter(s => s.status !== 'open');
    if (filterStatus === 'diff') return sessions.filter(s => s.cashDiff != null && Math.abs(s.cashDiff) > 10000);
    return sessions;
  }, [sessions, filterStatus]);

  const groupedSessions = useMemo(() => {
    const grouped = {};
    filteredSessions.forEach((s) => {
      const key = s.outletName || 'Outlet tidak diketahui';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });
    return grouped;
  }, [filteredSessions]);

  // Aggregate totals
  const aggregateTotals = useMemo(() => {
    let totalShift = 0, totalOpen = 0, totalClosed = 0, totalDiff = 0, totalBigDiff = 0, sumAbsDiff = 0;
    sessions.forEach(s => {
      totalShift++;
      if (s.status === 'open') totalOpen++;
      else totalClosed++;
      if (s.cashDiff != null) {
        totalDiff++;
        sumAbsDiff += Math.abs(s.cashDiff);
        if (Math.abs(s.cashDiff) >= 50000) totalBigDiff++;
      }
    });
    return {
      totalShift, totalOpen, totalClosed, totalBigDiff,
      avgAbsDiff: totalDiff > 0 ? sumAbsDiff / totalDiff : 0,
    };
  }, [sessions]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar title="Shift Kasir" subtitle="Monitoring buka/tutup shift & selisih kas" onBack={goBack} />

      {/* Filters — compact inline card */}
      <div style={{ padding: '12px 16px 0', background: C.n50 }}>
        <div style={{ background: C.white, borderRadius: 14, padding: '14px 16px', boxShadow: SHADOW.sm }}>
          {/* Date row — side by side, no arrow */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <DateTimeInput label="Dari" value={dateFrom ? `${dateFrom}T00:00:00` : ''} onChange={(v) => setDateFrom(v ? v.slice(0, 10) : '')} timeOptional />
            <DateTimeInput label="Sampai" value={dateTo ? `${dateTo}T00:00:00` : ''} onChange={(v) => setDateTo(v ? v.slice(0, 10) : '')} timeOptional />
          </div>
          {/* Outlet selector */}
          <Select label="Outlet" value={outletId} onChange={setOutletId}
            options={[{ value: '', label: '🏪 Semua outlet' }, ...outlets.map((o) => ({ value: o.id, label: o.name }))]} />
        </div>
      </div>

      {/* Export buttons */}
      <div style={{ padding: '0 16px 6px', display: 'flex', gap: 8 }}>
        <button
          onClick={async () => {
            try {
              const res = await axios.get('/api/shifts/export', { params: { outletId, dateFrom, dateTo } });
              const rows = (res?.data?.data || []).map(r => ({
                'Tanggal': r.sessionDate,
                'Outlet': r.outletName,
                'Kasir': r.cashierName,
                'Shift': r.shift,
                'Buka': r.openedAt?.slice(11, 16) || '',
                'Tutup': r.closedAt?.slice(11, 16) || '',
                'Modal Awal': r.openingCash,
                'Penjualan Tunai': r.cashSales,
                'Total Setor': r.totalSetor,
                'Kas Sistem': r.systemCash,
                'Uang Fisik': r.closingCash,
                'Selisih': r.cashDiff,
                'Status': r.status,
              }));
              await exportToExcel(rows, { filename: `shift-report-${dateFrom}-${dateTo}`, sheetName: 'Shift Report' });
            } catch { alert('Gagal export Excel.'); }
          }}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${C.success}`,
            background: `${C.success}10`, cursor: 'pointer',
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.success,
          }}
        >
          📊 Export Excel
        </button>
        <button
          onClick={async () => {
            try {
              const res = await axios.get('/api/shifts/export', { params: { outletId, dateFrom, dateTo } });
              const rows = (res?.data?.data || []).map(r => ({
                'Tanggal': r.sessionDate,
                'Outlet': r.outletName,
                'Kasir': r.cashierName,
                'Shift': r.shift,
                'Modal Awal': r.openingCash,
                'Penjualan Tunai': r.cashSales,
                'Total Setor': r.totalSetor,
                'Selisih': r.cashDiff,
                'Status': r.status,
              }));
              await exportToPDF(rows, { filename: `shift-report-${dateFrom}-${dateTo}`, title: 'Laporan Shift Kasir' });
            } catch { alert('Gagal export PDF.'); }
          }}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 10, border: `1.5px solid ${C.danger}`,
            background: `${C.danger}10`, cursor: 'pointer',
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.danger,
          }}
        >
          📄 Export PDF
        </button>
      </div>

      {/* Tabs — attached below filter */}
      <div style={{ padding: '12px 16px 6px', display: 'flex', gap: 8 }}>
        {[
          { key: 'sessions', label: 'Riwayat Shift', icon: '📋' },
          { key: 'outlet', label: 'Per Outlet', icon: '🏪' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: tab === t.key ? C.primary : C.white,
              color: tab === t.key ? 'white' : C.n700,
              fontFamily: 'Poppins', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              boxShadow: tab === t.key ? `0 4px 12px ${C.primary}30` : SHADOW.sm,
              transition: 'all 0.2s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div style={{ margin: '0 16px 8px', padding: 12, borderRadius: 12, background: C.dangerBg, color: C.danger, ...F, fontSize: 13 }}>
          ⚠️ {err}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 24px' }}>
        {/* ===== KPI Summary — Clean horizontal strip ===== */}
        <div style={{ background: C.white, borderRadius: 14, padding: '14px 16px', marginBottom: 14, boxShadow: SHADOW.sm }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, textAlign: 'center' }}>
            {[
              { label: 'Total', value: aggregateTotals.totalShift, color: C.n900 },
              { label: 'Tutup', value: aggregateTotals.totalClosed, color: C.success },
              { label: 'Buka', value: aggregateTotals.totalOpen, color: aggregateTotals.totalOpen > 0 ? C.warning : C.n700 },
              { label: '≥50rb', value: aggregateTotals.totalBigDiff, color: aggregateTotals.totalBigDiff > 0 ? C.danger : C.n700 },
            ].map((kpi, i) => (
              <div key={kpi.label} style={{ padding: '4px 0', borderRight: i < 3 ? `1px solid ${C.n100}` : 'none' }}>
                <div style={{ ...F, fontSize: 22, fontWeight: 600, color: kpi.color, lineHeight: 1.2 }}>{kpi.value}</div>
                <div style={{ ...F, fontSize: 10, color: C.n700, fontWeight: 500, marginTop: 2 }}>{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Insight Cards — Compact version ===== */}
        {(disciplinedOutlet || problematicOutlet || staleCashiers.length > 0) && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n700, marginBottom: 8, paddingLeft: 2 }}>Insight Periode Ini</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Outlet disiplin — compact row */}
              {disciplinedOutlet && (
                <div style={{ background: C.white, borderRadius: 12, padding: '12px 14px', boxShadow: SHADOW.sm, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏆</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...F, fontSize: 11, color: C.n700, fontWeight: 500 }}>Paling Disiplin</div>
                    <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900, marginTop: 1 }}>{disciplinedOutlet.outletName}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.success }}>{rp(disciplinedOutlet.avgAbsCashDiff || 0)}</div>
                    <div style={{ ...F, fontSize: 9, color: C.n700 }}>avg selisih</div>
                  </div>
                </div>
              )}

              {/* Outlet bermasalah — compact row */}
              {problematicOutlet && problematicOutlet.largeDiffCount > 0 && (
                <div style={{ background: C.white, borderRadius: 12, padding: '12px 14px', boxShadow: SHADOW.sm, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: C.warningBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>⚠️</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...F, fontSize: 11, color: C.n700, fontWeight: 500 }}>Sering Selisih</div>
                    <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900, marginTop: 1 }}>{problematicOutlet.outletName}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.danger }}>{problematicOutlet.largeDiffCount}x</div>
                    <div style={{ ...F, fontSize: 9, color: C.n700 }}>kasus ≥50rb</div>
                  </div>
                </div>
              )}

              {/* Shift terbuka terlalu lama — compact alert */}
              {staleCashiers.length > 0 && (
                <div style={{ background: C.dangerBg, borderRadius: 12, padding: '10px 14px', border: `1px solid ${C.dangerBg}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: staleCashiers.length > 1 ? 8 : 0 }}>
                    <span style={{ fontSize: 14 }}>🚨</span>
                    <span style={{ ...F, fontSize: 12, fontWeight: 600, color: C.danger }}>{staleCashiers.length} shift terbuka &gt;24 jam</span>
                  </div>
                  {staleCashiers.slice(0, 3).map((s) => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', ...F, fontSize: 11, color: C.dangerDark, padding: '3px 0' }}>
                      <span>{s.cashierName} · {s.outletName}</span>
                      <span style={{ fontWeight: 600 }}>{hoursSince(s.openedAt).toFixed(0)}j</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Tab: Sessions ===== */}
        {tab === 'sessions' && (
          <>
            <SectionHeader
              icon="📋"
              title="Riwayat Shift"
              subtitle={`${filteredSessions.length} shift dalam periode`}
              action={
                <div style={{ minWidth: 120 }}>
                  <Select value={filterStatus} onChange={setFilterStatus}
                    options={[
                      { value: 'all', label: '🔍 Semua' },
                      { value: 'open', label: '🟢 Buka' },
                      { value: 'closed', label: '⚫ Tutup' },
                      { value: 'diff', label: '⚠️ Selisih besar' },
                    ]} />
                </div>
              }
            />

            {loading ? (
              <div style={{ textAlign: 'center', padding: 32, ...F, fontSize: 13, color: C.n700 }}>
                <div style={{ width: 24, height: 24, border: `3px solid ${C.n200}`, borderTopColor: C.primary, borderRadius: '50%', margin: '0 auto 8px', animation: 'spin 0.8s linear infinite' }} />
                Memuat data shift...
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : filteredSessions.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 6, opacity: 0.4 }}>📭</div>
                <div style={{ ...F, fontSize: 13, color: C.n700 }}>Tidak ada data shift untuk filter ini.</div>
              </Card>
            ) : Object.entries(groupedSessions).map(([outletName, items]) => {
              const openCount = items.filter(x => x.status === 'open').length;
              const closedCount = items.filter(x => x.status !== 'open').length;
              const totalDiff = items.reduce((s, x) => s + Math.abs(Number(x.cashDiff || 0)), 0);

              return (
                <div key={outletName} style={{ marginBottom: 20 }}>
                  {/* Outlet Group Header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: C.white, borderRadius: 12,
                    boxShadow: SHADOW.sm, marginBottom: 8,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${C.primary}14`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                    }}>🏪</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>{outletName}</div>
                      <div style={{ ...F, fontSize: 10, color: C.n700, marginTop: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{items.length} shift</span>
                        {openCount > 0 && <span style={{ color: C.success, fontWeight: 600 }}>● {openCount} buka</span>}
                        {closedCount > 0 && <span>● {closedCount} tutup</span>}
                      </div>
                    </div>
                    {totalDiff > 0 && (
                      <Pill color={C.warningBg} textColor={C.warning}>|Σ| {rp(Math.round(totalDiff))}</Pill>
                    )}
                  </div>

                  {/* Session Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map((s) => {
                      const isOpen = s.status === 'open';
                      const hasDiff = s.cashDiff != null;
                      const bigDiff = hasDiff && Math.abs(s.cashDiff) >= 50000;
                      const mediumDiff = hasDiff && Math.abs(s.cashDiff) > 10000 && !bigDiff;
                      const accent = isOpen ? C.success : bigDiff ? C.danger : mediumDiff ? C.warning : C.n300;
                      const expanded = expandedSession === s.id;
                      const cashSales = s.systemCash != null ? Number(s.systemCash) - Number(s.openingCash || 0) : 0;

                      return (
                        <div key={s.id} style={{
                          background: C.white, borderRadius: 12, overflow: 'hidden',
                          boxShadow: SHADOW.sm, borderLeft: `4px solid ${accent}`,
                        }}>
                          <button onClick={() => setExpandedSession(expanded ? null : s.id)} style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '12px 14px', background: 'none', border: 'none',
                            cursor: 'pointer', textAlign: 'left',
                          }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: `${accent}14`, display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16,
                            }}>{isOpen ? '🟢' : bigDiff ? '🔴' : mediumDiff ? '🟡' : '⚫'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ ...F, fontSize: 13, fontWeight: 600, color: C.n900 }}>{s.cashierName}</div>
                              <div style={{ ...F, fontSize: 10, color: C.n700, marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <span>{(s.shift || '—').toUpperCase()}</span>
                                <span>·</span>
                                <span>{fmtTime(s.openedAt)} {isOpen ? `(${hoursSince(s.openedAt).toFixed(0)}j)` : `→ ${fmtTime(s.closedAt)}`}</span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <Pill color={isOpen ? C.successBg : C.n100} textColor={isOpen ? C.success : C.n700}>
                                {isOpen ? 'BUKA' : 'TUTUP'}
                              </Pill>
                              {!isOpen && hasDiff && (
                                <div style={{
                                  ...F, fontSize: 12, fontWeight: 600, marginTop: 4,
                                  color: bigDiff ? C.danger : mediumDiff ? C.warning : C.n700,
                                }}>
                                  {s.cashDiff >= 0 ? '+' : ''}{rp(s.cashDiff)}
                                </div>
                              )}
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.n700} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>

                          {expanded && (
                            <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.n100}`, background: C.n50 }}>
                              {/* Timeline */}
                              <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                                marginTop: 12, marginBottom: 10,
                              }}>
                                <div style={{ background: C.white, padding: '10px 12px', borderRadius: 10 }}>
                                  <div style={{ ...F, fontSize: 9, color: C.n700, fontWeight: 600, letterSpacing: 0.3 }}>🕐 BUKA SHIFT</div>
                                  <div style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n900, marginTop: 2 }}>{fmtDt(s.openedAt)}</div>
                                </div>
                                <div style={{ background: C.white, padding: '10px 12px', borderRadius: 10 }}>
                                  <div style={{ ...F, fontSize: 9, color: C.n700, fontWeight: 600, letterSpacing: 0.3 }}>🏁 TUTUP SHIFT</div>
                                  <div style={{ ...F, fontSize: 12, fontWeight: 600, color: isOpen ? C.warning : C.n900, marginTop: 2 }}>
                                    {isOpen ? '⏳ Belum tutup' : fmtDt(s.closedAt)}
                                  </div>
                                </div>
                              </div>

                              {/* Cash Reconciliation Section */}
                              <div style={{ background: C.white, padding: 12, borderRadius: 10, marginBottom: 8 }}>
                                <div style={{ ...F, fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 8, letterSpacing: 0.3 }}>💰 REKONSILIASI KAS</div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', ...F, fontSize: 12 }}>
                                  <tbody>
                                    <tr style={{ borderBottom: `1px solid ${C.n100}` }}>
                                      <td style={{ padding: '6px 0', color: C.n700 }}>Modal awal</td>
                                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: C.n900 }}>{rp(s.openingCash || 0)}</td>
                                    </tr>
                                    {!isOpen && (
                                      <>
                                        <tr style={{ borderBottom: `1px solid ${C.n100}` }}>
                                          <td style={{ padding: '6px 0', color: C.n700 }}>+ Penjualan tunai (sistem)</td>
                                          <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: C.success }}>{rp(cashSales)}</td>
                                        </tr>
                                        <tr style={{ borderBottom: `1.5px solid ${C.n300}` }}>
                                          <td style={{ padding: '6px 0', color: C.n700 }}>Hitung fisik akhir</td>
                                          <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, color: C.n900 }}>{s.closingCash != null ? rp(s.closingCash) : '—'}</td>
                                        </tr>
                                        {hasDiff && (
                                          <tr>
                                            <td style={{ padding: '8px 0 0', fontWeight: 600, color: C.n900 }}>SELISIH KAS</td>
                                            <td style={{
                                              padding: '8px 0 0', textAlign: 'right', fontWeight: 600,
                                              color: bigDiff ? C.danger : mediumDiff ? C.warning : C.success,
                                            }}>
                                              {s.cashDiff >= 0 ? '+' : ''}{rp(s.cashDiff)}
                                            </td>
                                          </tr>
                                        )}
                                      </>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Payment Summary */}
                              {Array.isArray(s.paymentSummary) && s.paymentSummary.length > 0 && (
                                <div style={{ background: C.white, padding: 12, borderRadius: 10, marginBottom: 8 }}>
                                  <div style={{ ...F, fontSize: 10, fontWeight: 600, color: C.n700, marginBottom: 8, letterSpacing: 0.3 }}>💳 METODE PEMBAYARAN</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {s.paymentSummary.map((p) => (
                                      <div key={`${s.id}-${p.method}`} style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '6px 8px', background: C.n50, borderRadius: 8,
                                      }}>
                                        <span style={{ fontSize: 14 }}>{METHOD_ICON[p.method] || '💳'}</span>
                                        <span style={{ ...F, fontSize: 12, color: C.n700, flex: 1, fontWeight: 600 }}>{METHOD_LABEL[p.method] || p.method}</span>
                                        <span style={{ ...F, fontSize: 10, color: C.n700 }}>{p.count}x</span>
                                        <span style={{ ...F, fontSize: 12, fontWeight: 600, color: C.n900 }}>{rp(p.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Notes */}
                              {s.notes && (
                                <div style={{
                                  padding: '10px 12px', background: C.warningBg, borderRadius: 10,
                                  borderLeft: `3px solid ${C.warning}`,
                                }}>
                                  <div style={{ ...F, fontSize: 10, fontWeight: 600, color: C.warning, marginBottom: 4, letterSpacing: 0.3 }}>💬 CATATAN KASIR</div>
                                  <div style={{ ...F, fontSize: 12, color: C.n800, fontStyle: 'italic', lineHeight: 1.5 }}>{s.notes}</div>
                                </div>
                              )}

                              {/* Foto bukti transaksi */}
                              {Array.isArray(s.closingPhotos) && s.closingPhotos.length > 0 && (
                                <div style={{
                                  padding: '10px 12px', background: C.infoBg, borderRadius: 10,
                                  borderLeft: `3px solid ${C.info}`, marginTop: 8,
                                }}>
                                  <div style={{ ...F, fontSize: 10, fontWeight: 600, color: C.info, marginBottom: 8, letterSpacing: 0.3 }}>
                                    📸 BUKTI TRANSAKSI ({s.closingPhotos.length})
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {s.closingPhotos.map((p, idx) => (
                                      <a
                                        key={idx}
                                        href={p.data}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ display: 'block', textDecoration: 'none' }}
                                      >
                                        <div style={{
                                          width: 70, height: 70, borderRadius: 10, overflow: 'hidden',
                                          border: `1px solid ${C.n200}`, position: 'relative', background: C.n50,
                                        }}>
                                          {p.data ? (
                                            <img src={p.data} alt={p.label || 'Bukti'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📄</div>
                                          )}
                                          <div style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: 'rgba(0,0,0,0.65)', padding: '2px 4px',
                                            ...F, fontSize: 8, color: 'white', textAlign: 'center',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                          }}>
                                            {p.label || 'Bukti'}
                                          </div>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ===== Tab: Per Outlet ===== */}
        {tab === 'outlet' && (
          <>
            <SectionHeader
              icon="🏪"
              title="Ringkasan Per Outlet"
              subtitle={meta ? `${meta.dateFrom} → ${meta.dateTo} · diurutkan dari selisih terkecil` : ''}
            />

            {summary.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 6, opacity: 0.4 }}>📭</div>
                <div style={{ ...F, fontSize: 13, color: C.n700 }}>Tidak ada data ringkasan outlet.</div>
              </Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summary.map((o, idx) => {
                  const prev = prevByOutlet[o.outletId];
                  const cashTrend = prev ? trendVisual(o.avgAbsCashDiff || 0, prev.avgAbsCashDiff || 0, true) : null;
                  const diffColor = (o.avgAbsCashDiff || 0) > 50000 ? C.danger : (o.avgAbsCashDiff || 0) > 10000 ? C.warning : C.success;
                  const rankColor = idx === 0 ? C.warning : idx === 1 ? C.n500 : idx === 2 ? '#CD7F32' : C.n700;

                  return (
                    <Card key={o.outletId} accentColor={diffColor}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 18, background: rankColor,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          ...F, fontSize: 13, fontWeight: 600, color: C.white, flexShrink: 0,
                        }}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...F, fontSize: 14, fontWeight: 600, color: C.n900 }}>{o.outletName}</div>
                          <div style={{ ...F, fontSize: 10, color: C.n700, marginTop: 1 }}>
                            {o.sessionCount} total shift periode ini
                          </div>
                        </div>
                        {o.staleOpenCount > 0 && (
                          <Pill color={C.warningBg} textColor={C.warningDark}>⏱ {o.staleOpenCount} &gt;24j</Pill>
                        )}
                      </div>

                      {/* Status counts */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                        <div style={{ background: C.n50, padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ ...F, fontSize: 16, fontWeight: 600, color: C.n900 }}>{o.sessionCount}</div>
                          <div style={{ ...F, fontSize: 9, color: C.n700, fontWeight: 600 }}>Total</div>
                        </div>
                        <div style={{ background: C.successBg, padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ ...F, fontSize: 16, fontWeight: 600, color: C.success }}>{o.closedCount}</div>
                          <div style={{ ...F, fontSize: 9, color: C.successDark, fontWeight: 600 }}>Tutup</div>
                        </div>
                        <div style={{ background: o.openCount > 0 ? C.warningBg : C.n50, padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                          <div style={{ ...F, fontSize: 16, fontWeight: 600, color: o.openCount > 0 ? C.warning : C.n700 }}>{o.openCount}</div>
                          <div style={{ ...F, fontSize: 9, color: o.openCount > 0 ? C.warningDark : C.n700, fontWeight: 600 }}>Buka</div>
                        </div>
                      </div>

                      {/* Discipline metrics */}
                      <table style={{ width: '100%', borderCollapse: 'collapse', ...F, fontSize: 12 }}>
                        <tbody>
                          <tr style={{ borderBottom: `1px solid ${C.n100}` }}>
                            <td style={{ padding: '8px 0', color: C.n700 }}>Rata-rata |selisih kas|</td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: diffColor }}>
                              {o.avgAbsCashDiff != null ? rp(o.avgAbsCashDiff) : '—'}
                              {cashTrend && (
                                <div style={{ ...F, fontSize: 10, color: cashTrend.color, fontWeight: 600 }}>
                                  {cashTrend.arrow} {cashTrend.label}
                                </div>
                              )}
                            </td>
                          </tr>
                          <tr style={{ borderBottom: o.notesCount > 0 ? `1px solid ${C.n100}` : 'none' }}>
                            <td style={{ padding: '8px 0', color: C.n700 }}>Kasus selisih ≥ 50rb</td>
                            <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: o.largeDiffCount > 0 ? C.danger : C.n900 }}>
                              {o.largeDiffCount > 0 ? `🔴 ${o.largeDiffCount}x` : '✓ Aman'}
                            </td>
                          </tr>
                          {o.notesCount > 0 && (
                            <tr>
                              <td style={{ padding: '8px 0', color: C.n700 }}>Catatan kasir</td>
                              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: C.n900 }}>
                                💬 {o.notesCount}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ErrorBoundary wrapper
export default function AdminShiftReportPage(props) {
  return (
    <ErrorBoundary>
      <AdminShiftReportPageContent {...props} />
    </ErrorBoundary>
  );
}
