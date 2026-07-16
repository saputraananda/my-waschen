/**
 * DashboardKasirTemplate.jsx
 *
 * Template untuk Dashboard Kasir dengan Compact UI System v2.0
 *
 * @description
 * Template penggunaan komponen compact untuk dashboard kasir.
 * Copy-paste pattern ini ke DashboardPage.jsx yang sudah ada.
 *
 * @how-to-use
 * 1. Import komponen baru dari '@/components/ui'
 * 2. Copy struktur JSX di bawah
 * 3. Sesuaikan dengan data state yang sudah ada
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  // Komponen baru
  StatCard,
  StatCardGrid,
  StatCardSkeleton,
  ChartCard,
  ChartCardGrid,
  ChartSkeleton,
  ListCard,
  ListCardGroup,
  ListCardSkeleton,
  AlertCard,
  AlertCardGroup,
  AlertCardSkeleton,
  FilterBar,
  PageHeader,
  EmptyState,
} from '../../components/ui';

// Icons (pakai lucide atau svg inline)
import {
  DollarSign,
  FileText,
  CheckCircle,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bell,
  ChevronRight,
  Calendar,
  Search,
  Filter,
  Download,
} from 'lucide-react';

// Helper format currency
const formatCurrency = (num) => {
  if (num >= 1000000) {
    return `Rp ${(num / 1000000).toFixed(1)}Jt`;
  }
  if (num >= 1000) {
    return `Rp ${(num / 1000).toFixed(0)}K`;
  }
  return `Rp ${num}`;
};

// ─── TEMPLATE COMPONENT ─────────────────────────────────────────────────────────
export default function DashboardKasirTemplate({
  // Data dari props/state
  user = {},
  navigate = () => {},

  // Stats
  stats = { total: 0, omset: 0, totalPelunasan: 0, express: 0, pending: 0, completed: 0 },
  target = null,
  shift = null,

  // Recent transactions
  recent = [],

  // Alerts
  alerts = [],

  // Chart data
  chartData = [],

  // Loading states
  loading = false,
}) {
  // ─── Responsive hook ────────────────────────────────────────────
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── Computed values ───────────────────────────────────────────
  const completionRate = stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  const targetProgress = target
    ? Math.round((stats.omset / target.amount) * 100)
    : 0;

  // ─── Icon components ───────────────────────────────────────────
  const MoneyIcon = () => <DollarSign size={16} />;
  const FileIcon = () => <FileText size={16} />;
  const CheckIcon = () => <CheckCircle size={16} />;
  const TargetIcon = () => <Target size={16} />;
  const AlertIcon = () => <AlertTriangle size={16} />;
  const BellIcon = () => <Bell size={16} />;

  // ─── Trend calculation ──────────────────────────────────────────
  // Contoh: bandingkan dengan kemarin
  const trend = {
    omset: { value: 12, direction: 'up' }, // 12% naik
    nota: { value: 0, direction: 'neutral' }, // sama
    selesai: { value: 8, direction: 'up' }, // 8% naik
  };

  // ─── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <PageHeaderSkeleton compact />
        <StatCardGrid columns={isMobile ? 2 : 4} gap={12}>
          <StatCardSkeleton compact={isMobile} />
          <StatCardSkeleton compact={isMobile} />
          <StatCardSkeleton compact={isMobile} />
          <StatCardSkeleton compact={isMobile} />
        </StatCardGrid>
        <ChartCardGrid columns={2} gap={12} style={{ marginTop: 16 }}>
          <ChartCardSkeleton height={200} />
          <ChartCardSkeleton height={200} />
        </ChartCardGrid>
      </div>
    );
  }

  // ─── Main Template ────────────────────────────────────────────
  return (
    <div style={{
      padding: isMobile ? 12 : 16,
      maxWidth: 1440,
      margin: '0 auto',
    }}>
      {/* ══════════════════════════════════════════════════════════
          PAGE HEADER
          ══════════════════════════════════════════════════════════ */}
      <PageHeader
        title={`Selamat Pagi, ${user.name || 'Kasir'}`}
        subtitle={`${shift?.outletName || 'Outlet'} • Shift ${shift?.shiftLabel || 'Pagi'}`}
        compact={isMobile}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('notifikasi')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <BellIcon />
              {alerts.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {alerts.length}
                </span>
              )}
            </motion.button>
          </div>
        }
      />

      {/* ══════════════════════════════════════════════════════════
          STAT CARDS GRID (4 columns desktop, 2 columns mobile)
          ══════════════════════════════════════════════════════════ */}
      <StatCardGrid columns={isMobile ? 2 : 4} gap={isMobile ? 8 : 12}>
        {/* Omset Hari Ini */}
        <StatCard
          label="Omset Hari Ini"
          value={formatCurrency(stats.omset)}
          trend={trend.omset}
          icon={<MoneyIcon />}
          iconColor="#5B005F"
          compact={isMobile}
          onClick={() => navigate('laporan')}
        />

        {/* Total Nota */}
        <StatCard
          label="Nota"
          value={`${stats.total} nota`}
          sub={`${completionRate}% selesai`}
          trend={trend.nota}
          icon={<FileIcon />}
          iconColor="#8B5CF6"
          compact={isMobile}
          onClick={() => navigate('transaksi')}
        />

        {/* Selesai */}
        <StatCard
          label="Selesai"
          value={`${stats.completed} nota`}
          trend={trend.selesai}
          icon={<CheckIcon />}
          iconColor="#10B981"
          compact={isMobile}
        />

        {/* Target */}
        <StatCard
          label="Target"
          value={`${targetProgress}%`}
          progress={targetProgress}
          icon={<TargetIcon />}
          iconColor={targetProgress >= 100 ? '#10B981' : '#F59E0B'}
          compact={isMobile}
        />
      </StatCardGrid>

      {/* ══════════════════════════════════════════════════════════
          CHARTS GRID (2 columns desktop, 1 column mobile)
          ══════════════════════════════════════════════════════════ */}
      <ChartCardGrid columns={2} gap={isMobile ? 8 : 12} style={{ marginTop: isMobile ? 12 : 16 }}>
        {/* Tren Omset */}
        <ChartCard
          title="Tren Omset"
          subtitle="7 Hari Terakhir"
          icon={<TrendingUp size={18} />}
          compact={isMobile}
        >
          {/* Replace dengan actual chart component */}
          <div style={{
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9CA3AF',
            fontSize: 13,
          }}>
            [Line Chart Component Here]
          </div>
        </ChartCard>

        {/* Metode Pembayaran */}
        <ChartCard
          title="Metode Pembayaran"
          icon={<DollarSign size={18} />}
          compact={isMobile}
        >
          {/* Replace dengan actual chart component */}
          <div style={{
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9CA3AF',
            fontSize: 13,
          }}>
            [Pie/Donut Chart Here]
          </div>
        </ChartCard>
      </ChartCardGrid>

      {/* ══════════════════════════════════════════════════════════
          ALERTS SECTION (Low Stock, Reminders)
          ══════════════════════════════════════════════════════════ */}
      {alerts.length > 0 && (
        <AlertCardGroup
          title="⚠️ Alerts"
          severity="warning"
          count={alerts.length}
          collapsible
          style={{ marginTop: isMobile ? 12 : 16 }}
        >
          {alerts.slice(0, 3).map((alert) => (
            <AlertCard
              key={alert.id}
              title={alert.title}
              subtitle={alert.subtitle}
              severity={alert.severity}
              stock={alert.stock}
              actions={[
                {
                  label: 'Ajukan PR',
                  onClick: () => navigate('purchase_request'),
                  icon: '📝',
                },
              ]}
              compact={isMobile}
            />
          ))}
        </AlertCardGroup>
      )}

      {/* ══════════════════════════════════════════════════════════
          RECENT TRANSACTIONS
          ══════════════════════════════════════════════════════════ */}
      <ListCardGroup
        title="📋 Transaksi Terakhir"
        style={{ marginTop: isMobile ? 12 : 16 }}
      >
        {recent.length === 0 ? (
          <EmptyState
            type="transactions"
            compact
          />
        ) : (
          recent.slice(0, 5).map((tx) => (
            <ListCard
              key={tx.id}
              title={tx.no || tx.transactionNo}
              subtitle={tx.customerName}
              meta={tx.time || tx.createdAt}
              value={formatCurrency(tx.total)}
              secondary={tx.items?.length ? `${tx.items.length} item` : ''}
              status={tx.paymentStatus}
              statusType="payment"
              onClick={() => navigate('transaksi_detail', tx.id)}
              compact={isMobile}
            />
          ))
        )}
      </ListCardGroup>

      {/* View All Link */}
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('transaksi')}
          style={{
            background: 'transparent',
            border: 'none',
            fontFamily: 'Poppins',
            fontSize: 13,
            fontWeight: 600,
            color: '#5B005F',
            cursor: 'pointer',
            padding: '8px 16px',
          }}
        >
          Lihat Semua Transaksi →
        </motion.button>
      </div>
    </div>
  );
}

// ─── USAGE EXAMPLE ──────────────────────────────────────────────────────────────
/**
 * CARA INTEGRATE KE HALAMAN YANG SUDAH ADA:
 *
 * 1. Import komponen baru:
 *    import {
 *      StatCard, StatCardGrid,
 *      ChartCard, ChartCardGrid,
 *      ListCard, ListCardGroup,
 *      AlertCard, AlertCardGroup,
 *      PageHeader,
 *      EmptyState,
 *    } from '@/components/ui';
 *
 * 2. Ganti stat cards yang ada dengan:
 *    <StatCardGrid columns={4} gap={12}>
 *      <StatCard label="Omset" value="Rp 2.45Jt" ... />
 *      <StatCard label="Nota" value="45 nota" ... />
 *      <StatCard label="Selesai" value="38 nota" ... />
 *      <StatCard label="Target" value="75%" progress={75} ... />
 *    </StatCardGrid>
 *
 * 3. Ganti chart containers dengan:
 *    <ChartCardGrid columns={2} gap={12}>
 *      <ChartCard title="Tren Omset">
 *        <LineChart data={data} />
 *      </ChartCard>
 *      <ChartCard title="Metode Bayar">
 *        <PieChart data={data} />
 *      </ChartCard>
 *    </ChartCardGrid>
 *
 * 4. Ganti transaction list dengan:
 *    <ListCardGroup title="📋 Transaksi">
 *      {transactions.map(tx => (
 *        <ListCard
 *          title={tx.no}
 *          subtitle={tx.customer}
 *          value={rp(tx.total)}
 *          status={tx.status}
 *        />
 *      ))}
 *    </ListCardGroup>
 *
 * 5. Tambahkan alerts:
 *    {alerts.length > 0 && (
 *      <AlertCardGroup title="⚠️ Alerts">
 *        {alerts.map(alert => (
 *          <AlertCard title={alert.title} severity={alert.severity} />
 *        ))}
 *      </AlertCardGroup>
 *    )}
 */
