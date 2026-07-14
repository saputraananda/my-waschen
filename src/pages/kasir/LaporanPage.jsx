import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { C, SHADOW } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Avatar, Select, useAppRefresh } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { useResponsive, useWindowSize } from '../../utils/hooks';
import { exportLaporanRevenue } from '../../utils/excelExport';

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
const PERIODS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week',  label: '7 Hari' },
  { key: 'month', label: '30 Hari' },
];

const PAYMENT_LABELS = {
  cash:      { label: 'Tunai',     icon: 'cash', color: C.success },
  transfer:  { label: 'Transfer',  icon: 'transfer', color: C.info },
  qris:      { label: 'QRIS',      icon: 'qris', color: C.primary },
  ovo:       { label: 'OVO',       icon: 'ovo', color: C.primary },
  gopay:     { label: 'GoPay',     icon: 'gopay', color: C.success },
  dana:      { label: 'DANA',      icon: 'dana', color: C.info },
  shopeepay: { label: 'ShopeePay', icon: 'shopeepay', color: C.warning },
  deposit:   { label: 'Deposit',   icon: 'deposit', color: C.warning },
  mixed:     { label: 'Mixed',     icon: 'mixed', color: C.n600 },
  unknown:   { label: 'Lainnya',   icon: 'unknown', color: C.n600 },
};

const formatGrowth = (pct) => {
  if (pct === 0) return { text: '0%', color: C.n600, icon: '-' };
  if (pct > 0)  return { text: `+${pct}%`, color: C.success, icon: '+' };
  return { text: `${pct}%`, color: C.danger, icon: '-' };
};

const formatNumber = (n) => Number(n || 0).toLocaleString('id-ID');

// ════════════════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════════════════

// Hero stat — revenue card besar dengan trend
function HeroRevenueCard({ data }) {
  const g = formatGrowth(data?.growth?.revenue || 0);
  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryTint} 50%, ${C.info} 100%)`,
      borderRadius: 20,
      padding: '20px',
      color: 'white',
      boxShadow: '0 12px 28px rgba(110,46,120,0.25)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blur */}
      <div style={{
        position: 'absolute', top: -30, right: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        filter: 'blur(15px)',
      }} />

      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.85, fontWeight: 600, letterSpacing: 0.4 }}>
          💰 PENDAPATAN TOTAL
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 30, fontWeight: 800, marginTop: 4, lineHeight: 1.1 }}>
          {rp(data?.summary?.revenue || 0)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.2)',
            padding: '3px 10px', borderRadius: 999,
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 600,
          }}>
            <span>{g.icon}</span> {g.text}
          </div>
          <span style={{ fontFamily: 'Poppins', fontSize: 11, opacity: 0.8 }}>
            vs periode sebelumnya
          </span>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.75 }}>SUDAH DIBAYAR</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              {rp(data?.summary?.pelunasan || 0)}
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.75 }}>BELUM LUNAS</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 600, marginTop: 2 }}>
              {rp(data?.summary?.balanceDue || 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Target progress card (bulan ini)
function TargetCard({ target, achievement }) {
  if (!target) {
    return (
      <div style={{
        background: 'white', borderRadius: 16, padding: '14px 16px',
        border: `1px dashed ${C.n300}`,
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 13, fontWeight: 600, color: C.n600 }}>
          🎯 Target Belum Diset
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600, marginTop: 3 }}>
          Hubungi admin untuk set target bulanan outlet ini.
        </div>
      </div>
    );
  }

  const isAchieved = achievement?.isAchieved;
  const isSurplus = achievement?.isSurplus;
  const pct = achievement?.pct || 0;
  const accent = isSurplus ? C.success : isAchieved ? C.success : pct >= 70 ? C.warning : C.danger;

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      padding: '14px 16px',
      boxShadow: SHADOW.md,
      border: `1px solid ${isSurplus ? C.successBg : C.n100}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {isSurplus && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'linear-gradient(135deg, C.success, C.success)',
          color: 'white', padding: '2px 10px', borderRadius: 999,
          fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
          letterSpacing: 0.4, boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
        }}>
          🏆 SURPLUS
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.4 }}>
          TARGET BULAN INI
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, color: accent }}>
          {pct}%
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n600 }}>
          {rp(achievement?.achieved || 0)} / {rp(target.amount)}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 10, background: C.n100, borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, pct)}%`,
          background: `linear-gradient(90deg, ${accent}, ${accent}DD)`,
          borderRadius: 5,
          transition: 'width 0.5s',
        }} />
        {pct > 100 && (
          <div style={{
            position: 'absolute', top: 0, left: '100%',
            transform: 'translateX(-2px)',
            height: '100%', width: 3, background: C.success,
          }} />
        )}
      </div>

      {/* Status text */}
      <div style={{
        marginTop: 10,
        padding: '8px 10px',
        background: isSurplus ? C.successBg : isAchieved ? C.successBg : pct >= 70 ? C.warningBg : C.dangerBg,
        borderRadius: 10,
        fontFamily: 'Poppins', fontSize: 11,
        color: accent, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {isSurplus ? (
          <>🎉 <strong>Surplus {rp(achievement.surplus)}</strong> · Lampaui target {rp(target.amount)}!</>
        ) : isAchieved ? (
          <>✅ Target tercapai!</>
        ) : (
          <>📊 Kurang {rp(achievement?.shortfall || 0)} untuk capai target</>
        )}
      </div>
    </div>
  );
}

// Stat tile compact
function StatTile({ icon, label, value, sublabel, color = C.primary, growth }) {
  const g = typeof growth === 'number' ? formatGrowth(growth) : null;
  return (
    <div style={{
      background: 'white', borderRadius: 14,
      padding: '12px 14px',
      boxShadow: SHADOW.sm,
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: `${color}14`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15,
        }}>
          {icon}
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 600, color: C.n600, letterSpacing: 0.3 }}>
          {label}
        </div>
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.n900, lineHeight: 1.1 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n600, marginTop: 2 }}>
          {sublabel}
        </div>
      )}
      {g && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          marginTop: 4, padding: '1px 6px', borderRadius: 999,
          background: `${g.color}14`, color: g.color,
          fontFamily: 'Poppins', fontSize: 9, fontWeight: 600,
        }}>
          {g.icon} {g.text}
        </div>
      )}
    </div>
  );
}

// Daily revenue mini chart (sparkline-ish)
function DailyChart({ daily }) {
  if (!daily || daily.length === 0) return null;
  const max = Math.max(...daily.map(d => d.revenue), 1);
  const showLastN = daily.slice(-14); // tampilkan 14 terakhir biar muat

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      padding: '14px 16px',
      boxShadow: SHADOW.sm,
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.4 }}>
          📈 GRAFIK PENDAPATAN HARIAN
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600 }}>
          {showLastN.length} hari terakhir
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 4,
        height: 80, paddingBottom: 18, position: 'relative',
      }}>
        {showLastN.map((d, i) => {
          const h = max > 0 ? Math.max(2, (d.revenue / max) * 70) : 2;
          const dt = new Date(d.date);
          const dayLabel = dt.toLocaleDateString('id-ID', { day: '2-digit' });
          const isToday = dt.toDateString() === new Date().toDateString();
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div
                title={`${dt.toLocaleDateString('id-ID')}: ${rp(d.revenue)} (${d.txCount} tx)`}
                style={{
                  width: '100%',
                  height: h,
                  background: isToday
                    ? `linear-gradient(180deg, ${C.primaryTint}, ${C.primary})`
                    : `linear-gradient(180deg, ${C.primary}AA, ${C.primary}55)`,
                  borderRadius: '4px 4px 0 0',
                  transition: 'opacity 0.2s',
                  cursor: 'pointer',
                }}
              />
              <div style={{
                fontFamily: 'Poppins', fontSize: 8,
                color: isToday ? C.primary : C.n600,
                fontWeight: isToday ? 700 : 500,
                position: 'absolute', bottom: -16,
              }}>
                {dayLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Payment mix
function PaymentMixCard({ paymentMix }) {
  if (!paymentMix || paymentMix.length === 0) return null;
  return (
    <div style={{
      background: 'white', borderRadius: 16,
      padding: '14px 16px',
      boxShadow: SHADOW.sm,
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.4, marginBottom: 12 }}>
        💳 METODE PEMBAYARAN
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paymentMix.map((p) => {
          const meta = PAYMENT_LABELS[p.method] || PAYMENT_LABELS.unknown;
          return (
            <div key={p.method}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{meta.icon}</span>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n800, flex: 1 }}>
                  {meta.label}
                </div>
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                  {rp(p.amount)}
                </div>
              </div>
              <div style={{ height: 6, background: C.n100, borderRadius: 3, overflow: 'hidden', marginLeft: 22 }}>
                <div style={{
                  height: '100%', width: `${p.pct}%`,
                  background: meta.color, borderRadius: 3,
                  transition: 'width 0.4s',
                }} />
              </div>
              <div style={{
                fontFamily: 'Poppins', fontSize: 9, color: C.n600,
                marginTop: 2, marginLeft: 22,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{p.count} transaksi</span>
                <span>{p.pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Top services
function TopServicesCard({ topServices }) {
  if (!topServices || topServices.length === 0) return null;
  const maxRev = Math.max(...topServices.map(s => s.revenue), 1);
  return (
    <div style={{
      background: 'white', borderRadius: 16,
      padding: '14px 16px',
      boxShadow: SHADOW.sm,
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 600, color: C.n600, letterSpacing: 0.4, marginBottom: 12 }}>
        🏆 TOP 5 LAYANAN
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topServices.map((s, i) => (
          <div key={s.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: i === 0 ? C.warningBg : i === 1 ? C.n200 : i === 2 ? C.warningBg : C.n50,
                color: i === 0 ? C.warning : C.n600,
                fontFamily: 'Poppins', fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </div>
              <div style={{
                fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n800,
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {s.name}
              </div>
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 600, color: C.n900 }}>
                {rp(s.revenue)}
              </div>
            </div>
            <div style={{ height: 4, background: C.n100, borderRadius: 2, overflow: 'hidden', marginLeft: 30 }}>
              <div style={{
                height: '100%', width: `${(s.revenue / maxRev) * 100}%`,
                background: i === 0 ? C.warning : C.primary,
                borderRadius: 2,
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n600, marginTop: 2, marginLeft: 30 }}>
              {s.orderCount} kali dipesan
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════════════════
export default function KasirLaporanPage({ navigate, goBack }) {
  const { user, adminOutletId } = useApp();
  const { isMobile } = useResponsive();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Responsive grid columns
  const statGridCols = isMobile ? '1fr' : '1fr 1fr';
  const exportGridCols = isMobile ? '1fr' : '1fr 1fr';

  // Admin / finance / owner — bisa pilih outlet
  const isGlobalRole = ['admin', 'superadmin', 'finance', 'owner', 'ga'].includes(user?.originalRoleCode || user?.roleCode || user?.role);
  const [outlets, setOutlets] = useState([]);
  const initialOutletId = isGlobalRole && adminOutletId && adminOutletId !== '_all'
    ? adminOutletId
    : (user?.outletId || '');
  const [selectedOutletId, setSelectedOutletId] = useState(initialOutletId);

  useEffect(() => {
    if (!isGlobalRole) return;
    if (adminOutletId && adminOutletId !== '_all') {
      setSelectedOutletId(adminOutletId);
    }
  }, [isGlobalRole, adminOutletId]);

  useEffect(() => {
    if (!isGlobalRole) return;
    axios.get('/api/outlets')
      .then((r) => {
        const list = r?.data?.data || [];
        setOutlets(list);
        if (!selectedOutletId && list.length > 0) {
          setSelectedOutletId(list[0].id);
        }
      })
      .catch(() => setOutlets([]));
  }, [isGlobalRole]);

  const fetchSummary = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const params = { period };
      const oid = isGlobalRole ? selectedOutletId : user?.outletId;
      if (oid) params.outletId = oid;
      const res = await axios.get('/api/reports/outlet-summary', { params });
      setData(res?.data?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }, [period, selectedOutletId, user?.outletId, isGlobalRole]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Pull-to-refresh
  useAppRefresh(() => fetchSummary(), [fetchSummary]);

  const headerSubtitle = useMemo(() => {
    if (!data?.period) return '';
    const { startDate, endDate } = data.period;
    if (startDate === endDate) {
      return new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    const s = new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    const e = new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }, [data]);

  const handleExportPDF = useCallback(async () => {
    if (!data) return;
    try {
      const { jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageW = doc.internal.pageSize.getWidth();
      let y = 15;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('LAPORAN OUTLET', pageW / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(data.outlet?.name || user?.outletName || 'Outlet', pageW / 2, y, { align: 'center' });
      y += 5;
      doc.setFontSize(9);
      doc.text(`Periode: ${headerSubtitle}`, pageW / 2, y, { align: 'center' });
      y += 10;

      // Summary table
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Ringkasan', 14, y);
      y += 2;

      autoTable(doc, {
        startY: y,
        head: [['Metrik', 'Nilai']],
        body: [
          ['Pendapatan Total', rp(data.summary.revenue)],
          ['Sudah Dibayar', rp(data.summary.pelunasan)],
          ['Belum Lunas', rp(data.summary.balanceDue)],
          ['Jumlah Transaksi', String(data.summary.txCount)],
          ['Customer Unik', String(data.summary.uniqueCustomers)],
          ['Customer Baru', String(data.summary.newCustomers)],
          ['Transaksi Express', String(data.summary.expressCount)],
          ['Rata-rata per Transaksi', rp(data.summary.avgPerTx)],
          ['Rata-rata Harian', rp(data.summary.avgPerDay)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [91, 0, 95], fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      y = doc.lastAutoTable.finalY + 10;

      // Target
      if (data.target) {
        doc.setFont('helvetica', 'bold');
        doc.text('Target Bulan Ini', 14, y);
        y += 2;
        const tAch = data.targetAchievement;
        autoTable(doc, {
          startY: y,
          head: [['Target', 'Tercapai', 'Persentase', 'Status']],
          body: [[
            rp(data.target.amount),
            rp(tAch?.achieved || 0),
            `${tAch?.pct || 0}%`,
            tAch?.isSurplus ? `Surplus ${rp(tAch.surplus)}` : tAch?.isAchieved ? 'Tercapai' : `Kurang ${rp(tAch?.shortfall || 0)}`,
          ]],
          theme: 'grid',
          headStyles: { fillColor: [22, 163, 74], fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // Payment mix
      if (data.paymentMix?.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Metode Pembayaran', 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [['Metode', 'Jumlah', 'Transaksi', '%']],
          body: data.paymentMix.map((p) => [
            p.method || '-',
            rp(p.amount),
            String(p.count),
            `${p.pct}%`,
          ]),
          theme: 'grid',
          headStyles: { fillColor: [124, 58, 237], fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;
      }

      // Top services
      if (data.topServices?.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Top 5 Layanan', 14, y);
        y += 2;
        autoTable(doc, {
          startY: y,
          head: [['#', 'Layanan', 'Dipesan', 'Pendapatan']],
          body: data.topServices.map((s, i) => [
            String(i + 1),
            s.name,
            `${s.orderCount}x`,
            rp(s.revenue),
          ]),
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11], fontSize: 9 },
          bodyStyles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
      }

      // Footer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150);
      doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')} · Waschen POS`, pageW / 2, pageH - 8, { align: 'center' });

      // Save
      const outletSlug = (data.outlet?.name || 'outlet').replace(/\s+/g, '_').toLowerCase();
      const periodLabel = PERIODS.find(p => p.key === period)?.label || period;
      doc.save(`Laporan_${outletSlug}_${periodLabel}.pdf`);
    } catch (err) {
    }
  }, [data, period, headerSubtitle, user]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.n50, overflow: 'hidden' }}>
      <TopBar
        title="Laporan Outlet"
        subtitle={data?.outlet?.name || user?.outletName || user?.outlet?.name || 'Memuat...'}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Period selector */}
        <div style={{ padding: '12px 16px 8px', position: 'sticky', top: 0, background: C.n50, zIndex: 5 }}>
          {/* Admin outlet picker — dropdown */}
          {isGlobalRole && outlets.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <Select
                value={selectedOutletId}
                onChange={setSelectedOutletId}
                options={outlets.map((o) => ({ value: o.id, label: `🏪 ${o.name}` }))}
              />
            </div>
          )}

          <div style={{
            display: 'flex', gap: 6,
            background: 'white', borderRadius: 12,
            padding: 4, border: `1px solid ${C.n100}`,
          }}>
            {PERIODS.map(p => {
              const isActive = period === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: 9,
                    border: 'none',
                    background: isActive ? `linear-gradient(135deg, ${C.primaryTint}, ${C.primary})` : 'transparent',
                    color: isActive ? 'white' : C.n600,
                    fontFamily: 'Poppins', fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? '0 2px 8px rgba(91,0,95,0.25)' : 'none',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {headerSubtitle && (
            <div style={{
              fontFamily: 'Poppins', fontSize: 10, color: C.n600,
              marginTop: 6, textAlign: 'center',
            }}>
              📅 {headerSubtitle}
            </div>
          )}
        </div>

        <div style={{ padding: '6px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{
                width: 36, height: 36, border: `3.5px solid ${C.n200}`, borderTopColor: C.primary,
                borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px',
              }} />
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n600 }}>Memuat laporan…</span>
            </div>
          )}

          {!loading && error && (
            <div style={{
              background: C.dangerBg, border: '1px solid C.danger',
              borderRadius: 12, padding: '14px 16px',
              fontFamily: 'Poppins', fontSize: 12, color: C.danger,
              textAlign: 'center',
            }}>
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Hero revenue */}
              <HeroRevenueCard data={data} />

              {/* Target progress */}
              <TargetCard target={data.target} achievement={data.targetAchievement} />

              {/* Stat grid 2 columns */}
              <div style={{ display: 'grid', gridTemplateColumns: statGridCols, gap: 10 }}>
                <StatTile
                  icon="🧾"
                  label="TRANSAKSI"
                  value={formatNumber(data.summary.txCount)}
                  sublabel={`Avg ${rp(data.summary.avgPerTx)} / tx`}
                  color="C.info"
                  growth={data.growth.txCount}
                />
                <StatTile
                  icon="👥"
                  label="CUSTOMER"
                  value={formatNumber(data.summary.uniqueCustomers)}
                  sublabel={`${data.summary.newCustomers} baru`}
                  color="C.info"
                />
                <StatTile
                  icon="⚡"
                  label="EXPRESS"
                  value={formatNumber(data.summary.expressCount)}
                  sublabel={data.summary.txCount > 0
                    ? `${Math.round((data.summary.expressCount / data.summary.txCount) * 100)}% dari total`
                    : '—'}
                  color="C.warning"
                />
                <StatTile
                  icon="📅"
                  label="RATA-RATA HARIAN"
                  value={rp(data.summary.avgPerDay)}
                  sublabel={`${data.period.days} hari`}
                  color="C.success"
                />
              </div>

              {/* Daily chart */}
              <DailyChart daily={data.daily} />

              {/* Payment mix */}
              <PaymentMixCard paymentMix={data.paymentMix} />

              {/* Top services */}
              <TopServicesCard topServices={data.topServices} />

              {/* Export buttons — PDF & Excel */}
              <div style={{ display: 'grid', gridTemplateColumns: exportGridCols, gap: 8, marginBottom: isMobile ? 80 : 0 }}>
                <button
                  onClick={handleExportPDF}
                  style={{
                    height: 44, borderRadius: 12,
                    border: `1.5px solid ${C.danger}`,
                    background: `${C.danger}08`,
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                    color: C.danger, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={() => {
                    exportLaporanRevenue(data, `laporan-outlet-${data.period?.startDate || 'data'}`);
                  }}
                  style={{
                    height: 44, borderRadius: 12,
                    border: `1.5px solid C.success`,
                    background: C.successBg,
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                    color: C.success, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  📊 Export Excel
                </button>
              </div>

              {/* Footer info */}
              <div style={{
                textAlign: 'center', fontFamily: 'Poppins', fontSize: 10,
                color: C.n600, padding: '8px 0',
                marginBottom: isMobile ? 80 : 0,
              }}>
                Data diperbarui realtime · Tap periode di atas untuk ganti rentang
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
