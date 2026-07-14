/**
 * DashboardAdminTemplate.jsx
 *
 * Template untuk Dashboard Admin dengan Compact UI System v2.0
 *
 * @description
 * Template penggunaan komponen compact untuk dashboard admin.
 * 8 stat cards (2 rows x 4 columns) + 4 charts + alerts
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

// Icons
import {
  DollarSign,
  FileText,
  Users,
  TrendingUp,
  Target,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Package,
  BarChart3,
  PieChart,
  Trophy,
  Bell,
  Building2,
} from 'lucide-react';

// Helper format currency
const formatCurrency = (num) => {
  if (num >= 1000000000) {
    return `Rp ${(num / 1000000000).toFixed(1)}M`;
  }
  if (num >= 1000000) {
    return `Rp ${(num / 1000000).toFixed(1)}Jt`;
  }
  if (num >= 1000) {
    return `Rp ${(num / 1000).toFixed(0)}K`;
  }
  return `Rp ${num}`;
};

// ─── TEMPLATE COMPONENT ─────────────────────────────────────────────────────────
export default function DashboardAdminTemplate({
  // User
  user = {},
  navigate = () => {},

  // Filter props
  selectedOutlets = [],
  onOutletChange = () => {},
  dateRange = { start: null, end: null },
  onDateChange = () => {},
  outlets = [],

  // Stats (8 cards)
  stats = {
    totalOmset: 0,
    totalNota: 0,
    selesaiRate: 0,
    targetMTD: 0,
    memberAktif: 0,
    lunasRate: 0,
    topUpBaru: 0,
    alertStok: 0,
  },

  // Chart data
  outletPerformance = [],
  paymentMethods = [],
  revenueTrend = [],
  customerSegments = [],

  // Alerts
  alerts = [],

  // Top performer
  topPerformer = null,

  // Loading
  loading = false,
}) {
  // ─── Responsive hook ────────────────────────────────────────────
  const [isMobile, setIsMobile] = React.useState(false);
  const [isTablet, setIsTablet] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 640);
      setIsTablet(w >= 640 && w < 1024);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // ─── Computed values ───────────────────────────────────────────
  const completionRate = stats.totalNota > 0
    ? Math.round((stats.selesaiRate / stats.totalNota) * 100)
    : 0;

  // ─── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        {/* Filter skeleton */}
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap'
        }}>
          <div className="skeleton" style={{ width: 160, height: 44, borderRadius: 10 }} />
          <div className="skeleton" style={{ width: 140, height: 44, borderRadius: 10 }} />
          <div className="skeleton" style={{ flex: 1, height: 44, borderRadius: 10 }} />
        </div>

        {/* Stats skeleton */}
        <StatCardGrid columns={isMobile ? 2 : 4} gap={12}>
          {[...Array(8)].map((_, i) => (
            <StatCardSkeleton key={i} compact={isMobile} />
          ))}
        </StatCardGrid>

        {/* Charts skeleton */}
        <ChartCardGrid columns={2} gap={12} style={{ marginTop: 16 }}>
          <ChartSkeleton height={240} />
          <ChartSkeleton height={240} />
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
        title="Dashboard Intelligence"
        subtitle={`${user.name || 'Admin'} • ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        compact={isMobile}
        actions={
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
            <Bell size={18} color="#374151" />
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
        }
      />

      {/* ══════════════════════════════════════════════════════════
          FILTER BAR
          ══════════════════════════════════════════════════════════ */}
      <div style={{ marginBottom: isMobile ? 12 : 16 }}>
        <FilterBar
          showDate={true}
          dateRange={dateRange}
          onDateChange={onDateChange}
          showOutlet={true}
          outlets={outlets}
          selectedOutlets={selectedOutlets}
          onOutletChange={onOutletChange}
          showSearch={false}
          showStatus={false}
          onExport={() => {}}
          showExport={true}
          compact={isMobile}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════
          STAT CARDS ROW 1 (4 columns)
          ══════════════════════════════════════════════════════════ */}
      <StatCardGrid columns={isMobile ? 2 : 4} gap={isMobile ? 8 : 12}>
        {/* Total Omset */}
        <StatCard
          label="Total Omset"
          value={formatCurrency(stats.totalOmset)}
          trend={{ value: 8, direction: 'up' }}
          icon={<DollarSign size={16} />}
          iconColor="#6e2e78"
          compact={isMobile}
        />

        {/* Total Nota */}
        <StatCard
          label="Total Nota"
          value={`${stats.totalNota}`}
          sub="nota"
          icon={<FileText size={16} />}
          iconColor="#8B5CF6"
          compact={isMobile}
        />

        {/* Selesai */}
        <StatCard
          label="Selesai"
          value={`${completionRate}%`}
          sub={`${stats.selesaiRate} nota`}
          icon={<CheckCircle size={16} />}
          iconColor="#10B981"
          compact={isMobile}
        />

        {/* Target MTD */}
        <StatCard
          label="Target MTD"
          value={`${stats.targetMTD}%`}
          progress={stats.targetMTD}
          icon={<Target size={16} />}
          iconColor={stats.targetMTD >= 80 ? '#10B981' : '#F59E0B'}
          compact={isMobile}
        />
      </StatCardGrid>

      {/* ══════════════════════════════════════════════════════════
          STAT CARDS ROW 2 (4 columns)
          ══════════════════════════════════════════════════════════ */}
      <StatCardGrid columns={isMobile ? 2 : 4} gap={isMobile ? 8 : 12} style={{ marginTop: isMobile ? 8 : 12 }}>
        {/* Member Aktif */}
        <StatCard
          label="Member Aktif"
          value={`${stats.memberAktif.toLocaleString()}`}
          sub="+23 baru"
          icon={<Users size={16} />}
          iconColor="#3B82F6"
          compact={isMobile}
        />

        {/* Lunas Rate */}
        <StatCard
          label="Lunas Rate"
          value={`${stats.lunasRate}%`}
          icon={<CreditCard size={16} />}
          iconColor="#10B981"
          compact={isMobile}
        />

        {/* Top Up Baru */}
        <StatCard
          label="Top Up Baru"
          value={formatCurrency(stats.topUpBaru)}
          icon={<TrendingUp size={16} />}
          iconColor="#8B5CF6"
          compact={isMobile}
        />

        {/* Alert Stok */}
        <StatCard
          label="Alert Stok"
          value={`${stats.alertStok}`}
          sub="item"
          icon={<AlertTriangle size={16} />}
          iconColor={stats.alertStok > 0 ? '#EF4444' : '#10B981'}
          compact={isMobile}
          onClick={() => navigate('inventory')}
        />
      </StatCardGrid>

      {/* ══════════════════════════════════════════════════════════
          CHARTS GRID (2 rows x 2 columns)
          ══════════════════════════════════════════════════════════ */}
      <ChartCardGrid columns={2} gap={isMobile ? 8 : 12} style={{ marginTop: isMobile ? 12 : 16 }}>
        {/* Outlet Performance */}
        <ChartCard
          title="Outlet Performance"
          subtitle="Perbandingan Revenue"
          icon={<BarChart3 size={18} />}
          compact={isMobile}
        >
          {/* Replace dengan Bar Chart */}
          <div style={{
            height: 220,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            padding: '0 8px',
          }}>
            {outletPerformance.slice(0, 6).map((outlet, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}>
                <div style={{
                  width: 32,
                  height: `${(outlet.revenue / Math.max(...outletPerformance.map(o => o.revenue)) * 180}px`,
                  background: `linear-gradient(180deg, #8B5CF6, #6e2e78)`,
                  borderRadius: '4px 4px 0 0',
                  minHeight: 20,
                }} />
                <span style={{
                  fontFamily: 'Poppins',
                  fontSize: 9,
                  color: '#6B7280',
                  textAlign: 'center',
                  maxWidth: 50,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {outlet.name?.split(' ')[0] || 'Outlet'}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Payment Methods */}
        <ChartCard
          title="Metode Pembayaran"
          icon={<PieChart size={18} />}
          compact={isMobile}
        >
          {/* Replace dengan Pie/Donut Chart */}
          <div style={{
            height: 220,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            {/* Simple donut representation */}
            <div style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '24px solid #8B5CF6',
              borderTopColor: '#10B981',
              borderRightColor: '#F59E0B',
              borderBottomColor: '#3B82F6',
            }} />
            <div style={{ flex: 1 }}>
              {paymentMethods.map((method, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6'][i % 4],
                  }} />
                  <span style={{
                    fontFamily: 'Poppins',
                    fontSize: 12,
                    color: '#374151',
                    flex: 1,
                  }}>
                    {method.name}
                  </span>
                  <span style={{
                    fontFamily: 'Poppins',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#111827',
                  }}>
                    {method.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Revenue Trend */}
        <ChartCard
          title="Revenue Trend"
          subtitle="30 Hari Terakhir"
          icon={<TrendingUp size={18} />}
          compact={isMobile}
        >
          {/* Replace dengan Area/Line Chart */}
          <div style={{
            height: 220,
            position: 'relative',
          }}>
            <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6e2e78" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6e2e78" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Simple trend line */}
              <path
                d="M0,180 Q50,160 100,140 T200,120 T300,100 T400,80"
                fill="none"
                stroke="#6e2e78"
                strokeWidth="3"
              />
              <path
                d="M0,180 Q50,160 100,140 T200,120 T300,100 T400,80 L400,200 L0,200 Z"
                fill="url(#areaGradient)"
              />
            </svg>
          </div>
        </ChartCard>

        {/* Customer Segments */}
        <ChartCard
          title="Customer Segments"
          icon={<Users size={18} />}
          compact={isMobile}
        >
          {/* Replace dengan Pie Chart */}
          <div style={{
            height: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
          }}>
            {customerSegments.map((segment, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  background: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'][i % 4],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: 14,
                }}>
                  {segment.percentage}%
                </div>
                <span style={{
                  fontFamily: 'Poppins',
                  fontSize: 11,
                  color: '#6B7280',
                  textAlign: 'center',
                }}>
                  {segment.name}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </ChartCardGrid>

      {/* ══════════════════════════════════════════════════════════
          LOW STOCK ALERTS
          ══════════════════════════════════════════════════════════ */}
      {alerts.length > 0 && (
        <AlertCardGroup
          title="⚠️ Low Stock Alerts"
          severity="critical"
          count={alerts.length}
          collapsible
          defaultExpanded={true}
          style={{ marginTop: isMobile ? 12 : 16 }}
        >
          {alerts.slice(0, 5).map((alert) => (
            <AlertCard
              key={alert.id}
              title={alert.itemName}
              subtitle={`Outlet: ${alert.outletName}`}
              severity={alert.severity}
              stock={{
                current: alert.currentStock,
                minimum: alert.minStock,
                unit: alert.unit || 'pcs',
              }}
              actions={[
                {
                  label: 'Detail',
                  onClick: () => navigate('inventory_detail', alert.id),
                  variant: 'ghost',
                },
              ]}
              compact={isMobile}
            />
          ))}
        </AlertCardGroup>
      )}

      {/* ══════════════════════════════════════════════════════════
          TOP PERFORMER
          ══════════════════════════════════════════════════════════ */}
      {topPerformer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: isMobile ? 12 : 16,
            background: 'linear-gradient(135deg, #8B5CF6, #6e2e78)',
            borderRadius: 16,
            padding: isMobile ? 16 : 20,
            color: '#FFFFFF',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Trophy size={24} color="#FFD700" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 14,
                fontWeight: 700,
              }}>
                🏆 Top Performer: {topPerformer.name}
              </div>
              <div style={{
                fontFamily: 'Poppins',
                fontSize: 12,
                opacity: 0.9,
                marginTop: 2,
              }}>
                Revenue: {formatCurrency(topPerformer.revenue)} • Target: {topPerformer.targetAchievement}% • Growth: +{topPerformer.growth}%
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── USAGE EXAMPLE ──────────────────────────────────────────────────────────────
/**
 * CARA INTEGRATE KE HALAMAN ADMIN YANG SUDAH ADA:
 *
 * 1. Import komponen baru:
 *    import {
 *      StatCard, StatCardGrid,
 *      ChartCard, ChartCardGrid,
 *      AlertCard, AlertCardGroup,
 *      FilterBar,
 *      PageHeader,
 *    } from '@/components/ui';
 *
 * 2. Wrap dengan FilterBar:
 *    <FilterBar
 *      dateRange={dateRange}
 *      onDateChange={setDateRange}
 *      outlets={outlets}
 *      selectedOutlets={selectedOutlets}
 *      onOutletChange={setSelectedOutlets}
 *    />
 *
 * 3. 8 Stats (2 rows x 4):
 *    <StatCardGrid columns={4} gap={12}>
 *      <StatCard label="Omset" value="Rp 15.2Jt" />
 *      <StatCard label="Nota" value="285 nota" />
 *      ... (total 8)
 *    </StatCardGrid>
 *
 * 4. 4 Charts (2 rows x 2):
 *    <ChartCardGrid columns={2} gap={12}>
 *      <ChartCard title="Outlet Performance">...</ChartCard>
 *      <ChartCard title="Metode Bayar">...</ChartCard>
 *      <ChartCard title="Revenue Trend">...</ChartCard>
 *      <ChartCard title="Customer Segments">...</ChartCard>
 *    </ChartCardGrid>
 *
 * 5. Alerts:
 *    {alerts.length > 0 && (
 *      <AlertCardGroup title="Low Stock" count={alerts.length}>
 *        {alerts.map(a => <AlertCard ... />)}
 *      </AlertCardGroup>
 *    )}
 */
