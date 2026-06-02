import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { TopBar, Avatar, useAppRefresh } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import PaymentGatewayPanel from '../../components/PaymentGatewayPanel';

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
const PERIODS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week',  label: '7 Hari' },
  { key: 'month', label: '30 Hari' },
];

const PAYMENT_LABELS = {
  cash:      { label: 'Tunai',     icon: '💵', color: '#16A34A' },
  transfer:  { label: 'Transfer',  icon: '🏦', color: '#2563EB' },
  qris:      { label: 'QRIS',      icon: '📱', color: '#7C3AED' },
  ovo:       { label: 'OVO',       icon: '💜', color: '#7C3AED' },
  gopay:     { label: 'GoPay',     icon: '💚', color: '#16A34A' },
  dana:      { label: 'DANA',      icon: '💙', color: '#0EA5E9' },
  shopeepay: { label: 'ShopeePay', icon: '🧡', color: '#EA580C' },
  deposit:   { label: 'Deposit',   icon: '💰', color: '#F59E0B' },
  mixed:     { label: 'Mixed',     icon: '🔀', color: '#64748B' },
  unknown:   { label: 'Lainnya',   icon: '❓', color: '#94A3B8' },
};

const formatGrowth = (pct) => {
  if (pct === 0) return { text: '0%', color: C.n500, icon: '→' };
  if (pct > 0)  return { text: `+${pct}%`, color: '#16A34A', icon: '▲' };
  return { text: `${pct}%`, color: '#DC2626', icon: '▼' };
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
      background: 'linear-gradient(135deg, #5B005F 0%, #7C3AED 50%, #2563EB 100%)',
      borderRadius: 20,
      padding: '20px',
      color: 'white',
      boxShadow: '0 12px 28px rgba(91,0,95,0.25)',
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
            fontFamily: 'Poppins', fontSize: 11, fontWeight: 700,
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
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, marginTop: 2 }}>
              {rp(data?.summary?.pelunasan || 0)}
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, opacity: 0.75 }}>BELUM LUNAS</div>
            <div style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, marginTop: 2 }}>
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
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500, marginTop: 3 }}>
          Hubungi admin untuk set target bulanan outlet ini.
        </div>
      </div>
    );
  }

  const isAchieved = achievement?.isAchieved;
  const isSurplus = achievement?.isSurplus;
  const pct = achievement?.pct || 0;
  const accent = isSurplus ? '#16A34A' : isAchieved ? '#16A34A' : pct >= 70 ? '#F59E0B' : '#DC2626';

  return (
    <div style={{
      background: 'white', borderRadius: 16,
      padding: '14px 16px',
      boxShadow: '0 2px 12px rgba(15,23,42,0.05)',
      border: `1px solid ${isSurplus ? '#86EFAC' : C.n100}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {isSurplus && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'linear-gradient(135deg, #16A34A, #15803D)',
          color: 'white', padding: '2px 10px', borderRadius: 999,
          fontFamily: 'Poppins', fontSize: 9, fontWeight: 800,
          letterSpacing: 0.4, boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
        }}>
          🏆 SURPLUS
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🎯</span>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, letterSpacing: 0.4 }}>
          TARGET BULAN INI
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 22, fontWeight: 800, color: accent }}>
          {pct}%
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, color: C.n500 }}>
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
            height: '100%', width: 3, background: '#15803D',
          }} />
        )}
      </div>

      {/* Status text */}
      <div style={{
        marginTop: 10,
        padding: '8px 10px',
        background: isSurplus ? '#F0FDF4' : isAchieved ? '#ECFDF5' : pct >= 70 ? '#FFFBEB' : '#FEF2F2',
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
      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
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
        <div style={{ fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, color: C.n500, letterSpacing: 0.3 }}>
          {label}
        </div>
      </div>
      <div style={{ fontFamily: 'Poppins', fontSize: 18, fontWeight: 800, color: C.n900, lineHeight: 1.1 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontFamily: 'Poppins', fontSize: 10, color: C.n500, marginTop: 2 }}>
          {sublabel}
        </div>
      )}
      {g && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          marginTop: 4, padding: '1px 6px', borderRadius: 999,
          background: `${g.color}14`, color: g.color,
          fontFamily: 'Poppins', fontSize: 9, fontWeight: 700,
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
      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, letterSpacing: 0.4 }}>
          📈 GRAFIK PENDAPATAN HARIAN
        </div>
        <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500 }}>
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
                    ? 'linear-gradient(180deg, #7C3AED, #5B005F)'
                    : `linear-gradient(180deg, ${C.primary}AA, ${C.primary}55)`,
                  borderRadius: '4px 4px 0 0',
                  transition: 'opacity 0.2s',
                  cursor: 'pointer',
                }}
              />
              <div style={{
                fontFamily: 'Poppins', fontSize: 8,
                color: isToday ? C.primary : C.n500,
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
      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, letterSpacing: 0.4, marginBottom: 12 }}>
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
                <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.n900 }}>
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
                fontFamily: 'Poppins', fontSize: 9, color: C.n500,
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
      boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
      border: `1px solid ${C.n100}`,
    }}>
      <div style={{ fontFamily: 'Poppins', fontSize: 11, fontWeight: 700, color: C.n600, letterSpacing: 0.4, marginBottom: 12 }}>
        🏆 TOP 5 LAYANAN
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topServices.map((s, i) => (
          <div key={s.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: i === 0 ? '#FEF3C7' : i === 1 ? '#E5E7EB' : i === 2 ? '#FED7AA' : C.n50,
                color: i === 0 ? '#92400E' : i === 1 ? '#374151' : i === 2 ? '#9A3412' : C.n600,
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
              <div style={{ fontFamily: 'Poppins', fontSize: 12, fontWeight: 700, color: C.primary }}>
                {rp(s.revenue)}
              </div>
            </div>
            <div style={{ height: 4, background: C.n100, borderRadius: 2, overflow: 'hidden', marginLeft: 30 }}>
              <div style={{
                height: '100%', width: `${(s.revenue / maxRev) * 100}%`,
                background: i === 0 ? '#F59E0B' : C.primary,
                borderRadius: 2,
                transition: 'width 0.4s',
              }} />
            </div>
            <div style={{ fontFamily: 'Poppins', fontSize: 9, color: C.n500, marginTop: 2, marginLeft: 30 }}>
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
  const { user } = useApp();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Admin outlet picker
  const isGlobalRole = ['admin', 'superadmin', 'finance', 'owner'].includes(user?.originalRoleCode || user?.roleCode || user?.role);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState(user?.outletId || '');

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
      console.error('[KasirLaporanPage]', err);
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
      console.error('[ExportPDF]', err);
    }
  }, [data, period, headerSubtitle, user]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F8FAFC', overflow: 'hidden' }}>
      <TopBar
        title="Laporan Outlet"
        subtitle={data?.outlet?.name || user?.outletName || user?.outlet?.name || 'Memuat...'}
        onBack={goBack}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Period selector */}
        <div style={{ padding: '12px 16px 8px', position: 'sticky', top: 0, background: '#F8FAFC', zIndex: 5 }}>
          {/* Admin outlet picker — dropdown */}
          {isGlobalRole && outlets.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                style={{
                  width: '100%', height: 40, borderRadius: 10,
                  border: `1.5px solid ${C.n200}`, background: 'white',
                  fontFamily: 'Poppins', fontSize: 12, fontWeight: 600,
                  color: C.n800, paddingLeft: 10, paddingRight: 10,
                  outline: 'none', cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>🏪 {o.name}</option>
                ))}
              </select>
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
                    background: isActive ? `linear-gradient(135deg, ${C.primary}, #7C3AED)` : 'transparent',
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
              fontFamily: 'Poppins', fontSize: 10, color: C.n500,
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
              <span style={{ fontFamily: 'Poppins', fontSize: 12, color: C.n500 }}>Memuat laporan…</span>
            </div>
          )}

          {!loading && error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              borderRadius: 12, padding: '14px 16px',
              fontFamily: 'Poppins', fontSize: 12, color: '#991B1B',
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatTile
                  icon="🧾"
                  label="TRANSAKSI"
                  value={formatNumber(data.summary.txCount)}
                  sublabel={`Avg ${rp(data.summary.avgPerTx)} / tx`}
                  color="#2563EB"
                  growth={data.growth.txCount}
                />
                <StatTile
                  icon="👥"
                  label="CUSTOMER"
                  value={formatNumber(data.summary.uniqueCustomers)}
                  sublabel={`${data.summary.newCustomers} baru`}
                  color="#0EA5E9"
                />
                <StatTile
                  icon="⚡"
                  label="EXPRESS"
                  value={formatNumber(data.summary.expressCount)}
                  sublabel={data.summary.txCount > 0
                    ? `${Math.round((data.summary.expressCount / data.summary.txCount) * 100)}% dari total`
                    : '—'}
                  color="#F59E0B"
                />
                <StatTile
                  icon="📅"
                  label="RATA-RATA HARIAN"
                  value={rp(data.summary.avgPerDay)}
                  sublabel={`${data.period.days} hari`}
                  color="#10B981"
                />
              </div>

              {/* Daily chart */}
              <DailyChart daily={data.daily} />

              {/* Payment mix */}
              <PaymentMixCard paymentMix={data.paymentMix} />

              {/* Payment Gateway report (Midtrans dst) */}
              <PaymentGatewayPanel
                startDate={data.period?.startDate}
                endDate={data.period?.endDate}
                outletId={selectedOutletId}
              />

              {/* Top services */}
              <TopServicesCard topServices={data.topServices} />

              {/* Export buttons — PDF & Excel */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={handleExportPDF}
                  style={{
                    height: 44, borderRadius: 12,
                    border: `1.5px solid ${C.danger}`,
                    background: `${C.danger}08`,
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
                    color: C.danger, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={async () => {
                    const { exportLaporanRevenue } = await import('../../utils/excelExport');
                    exportLaporanRevenue(data, `laporan-outlet-${data.period?.startDate || 'data'}`);
                  }}
                  style={{
                    height: 44, borderRadius: 12,
                    border: `1.5px solid #10B981`,
                    background: '#ECFDF5',
                    fontFamily: 'Poppins', fontSize: 12, fontWeight: 700,
                    color: '#15803D', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  📊 Export Excel
                </button>
              </div>

              {/* Footer info */}
              <div style={{
                textAlign: 'center', fontFamily: 'Poppins', fontSize: 10,
                color: C.n400, padding: '8px 0',
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
