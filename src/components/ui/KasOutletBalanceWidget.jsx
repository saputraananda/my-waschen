// ─────────────────────────────────────────────────────────────────────────────
// KasOutletBalanceWidget.jsx — Real-time Outlet Cash Position Display
// Shows current cash position with breakdown for full accounting visibility
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { C } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { IconCash, IconTrendUp, IconTrendDown, IconClock, IconWarning } from './StatusIcons';
import PaymentBreakdownCard from './PaymentBreakdownCard';

/**
 * KasOutletBalanceWidget — Shows real-time cash position
 *
 * @param {Object} props
 * @param {boolean} props.compact - Compact mode for dashboard
 * @param {Function} props.onRefresh - Callback when data refreshes
 * @param {boolean} props.showPayments - Show payment breakdown
 * @param {number} props.refreshInterval - Auto-refresh interval in ms (default: 30000)
 */
export default function KasOutletBalanceWidget({
  compact = false,
  onRefresh,
  showPayments = false,
  refreshInterval = 30000,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setError(null);

      // Parallel fetch for better performance
      const [shiftStatus, shiftSummary, setorSummary] = await Promise.all([
        axios.get('/api/shifts/status').catch(() => ({ data: null })),
        axios.get('/api/shifts/current-summary').catch(() => ({ data: null })),
        axios.get('/api/cash-deposits/summary').catch(() => ({ data: null })),
      ]);

      const shiftData = shiftStatus.data;
      const summaryData = shiftSummary.data?.data;
      const setorData = setorSummary.data?.data;

      // Calculate cash position
      const openingCash = summaryData?.openingCash || 0;
      const cashSales = (summaryData?.paymentSummary || [])
        .filter(p => p.method === 'cash')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      // Expenses from shift
      const expenses = 0; // Would need cash drawer API

      // Approved and pending setor
      const approvedSetor = setorData?.totalApproved || 0;
      const pendingSetor = setorData?.totalPending || 0;

      // Current position
      const currentPosition = openingCash + cashSales - expenses - approvedSetor;

      const result = {
        isOpen: shiftData?.isOpen || false,
        bypass: shiftData?.bypass || false,
        session: shiftData?.session,
        shiftSummary: summaryData,
        setor: {
          approved: approvedSetor,
          pending: pendingSetor,
        },
        cashPosition: {
          opening: openingCash,
          sales: cashSales,
          expenses,
          approvedSetor,
          pendingSetor,
          current: currentPosition,
        },
        paymentBreakdown: summaryData?.paymentSummary || [],
      };

      setData(result);
      setLastUpdated(new Date());
      onRefresh?.(result);

    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat data kas');
    } finally {
      setLoading(false);
    }
  };

  // Initial load + auto refresh
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // ── Render compact mode ────────────────────────────────────────────────────
  if (compact) {
    if (loading) {
      return (
        <div style={{
          background: 'white',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: C.n100,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: C.n400 }}>Memuat...</div>
          </div>
        </div>
      );
    }

    if (error || !data?.isOpen) {
      return (
        <div style={{
          background: C.warningBg,
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <IconWarning size={24} color={C.warning} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.warning }}>Shift Belum Aktif</div>
            <div style={{ fontSize: 10, color: C.n500 }}>Buka shift untuk melihat posisi kas</div>
          </div>
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(145deg, ' + C.primaryTint + ', white)',
          borderRadius: 12,
          padding: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid ' + C.primary + '20',
        }}
      >
        {/* Cash icon */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: C.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <IconCash size={20} color="white" />
        </div>

        {/* Position info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: C.primary, fontWeight: 600 }}>POSISI KAS</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.n800 }}>
            {rp(data.cashPosition.current)}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: C.n500 }}>
            <span style={{ color: C.success }}>+{rp(data.cashPosition.sales)}</span>
          </div>
          {data.cashPosition.pendingSetor > 0 && (
            <div style={{ fontSize: 10, color: C.warning }}>
              Setor: {rp(data.cashPosition.pendingSetor)}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Full mode ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.n600 }}>Memuat posisi kas...</div>
      </div>
    );
  }

  if (error || !data?.isOpen) {
    return (
      <div style={{
        background: C.warningBg,
        borderRadius: 20,
        padding: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
        <IconWarning size={48} color={C.warning} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: C.warning }}>Shift Belum Aktif</div>
        <div style={{ fontSize: 12, color: C.n500, marginTop: 4 }}>
          Buka shift untuk melihat posisi kas outlet
        </div>
      </div>
    );
  }

  const { cashPosition, setor, paymentBreakdown, shiftSummary } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'white',
        borderRadius: 20,
        padding: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Posisi Kas Sekarang
          </div>
          {lastUpdated && (
            <div style={{ fontSize: 10, color: C.n400, marginTop: 2 }}>
              Update {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={loadData}
          style={{
            background: C.n50,
            border: 'none',
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <IconClock size={14} color={C.n500} />
          <span style={{ fontSize: 10, color: C.n500 }}>Refresh</span>
        </motion.button>
      </div>

      {/* Main position display */}
      <div style={{
        background: 'linear-gradient(145deg, ' + C.primaryTint + ', white)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        border: '1px solid ' + C.primary + '15',
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.primary,
          marginBottom: 4,
        }}>
          SALDO KAS SAAT INI
        </div>
        <div style={{
          fontSize: 28,
          fontWeight: 800,
          color: C.n800,
          letterSpacing: '-0.5px',
        }}>
          {rp(cashPosition.current)}
        </div>

        {/* Breakdown */}
        <div style={{
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          <BreakdownItem
            label="Modal Awal"
            value={cashPosition.opening}
            icon={<IconCash size={12} color={C.n500} />}
            color={C.n600}
          />
          <BreakdownItem
            label="Penjualan Cash"
            value={cashPosition.sales}
            icon={<IconTrendUp size={12} color={C.success} />}
            color={C.success}
            prefix="+"
          />
          <BreakdownItem
            label="Pengeluaran"
            value={cashPosition.expenses}
            icon={<IconTrendDown size={12} color={C.danger} />}
            color={C.danger}
            prefix="-"
          />
          <BreakdownItem
            label="Setoran"
            value={cashPosition.approvedSetor}
            icon={<IconTrendDown size={12} color={C.warning} />}
            color={C.warning}
            prefix="-"
          />
        </div>
      </div>

      {/* Pending setor warning */}
      {setor.pending > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{
            background: C.warningBg,
            borderRadius: 10,
            padding: 10,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconWarning size={18} color={C.warning} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.warning }}>
              {setor.pending} Setoran Pending
            </div>
            <div style={{ fontSize: 10, color: C.n600 }}>
              Total: {rp(setor.pending)} - menunggu approval admin
            </div>
          </div>
        </motion.div>
      )}

      {/* Transaction summary */}
      {shiftSummary && (
        <div style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
        }}>
          <StatBadge
            label="Transaksi"
            value={shiftSummary.totalTransactions || 0}
            suffix="nota"
            color={C.primary}
          />
          <StatBadge
            label="Omset"
            value={shiftSummary.totalOmset || 0}
            color={C.success}
          />
        </div>
      )}

      {/* Payment breakdown */}
      {showPayments && paymentBreakdown.length > 0 && (
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.n600,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}>
            Pembayaran per Metode
          </div>
          <PaymentBreakdownCard
            payments={paymentBreakdown}
            title=""
            compact={true}
          />
        </div>
      )}
    </motion.div>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────

function BreakdownItem({ label, value, icon, color, prefix = '' }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.03)',
      borderRadius: 8,
      padding: '8px 10px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
      }}>
        {icon}
        <span style={{ fontSize: 10, color: C.n500 }}>{label}</span>
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 700,
        color: color,
      }}>
        {prefix}{rp(value)}
      </div>
    </div>
  );
}

function StatBadge({ label, value, suffix, color }) {
  return (
    <div style={{
      flex: 1,
      background: color + '10',
      borderRadius: 10,
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 10, color: C.n500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color }}>
        {rp(value)}
        {suffix && <span style={{ fontSize: 10, fontWeight: 500 }}> {suffix}</span>}
      </div>
    </div>
  );
}
