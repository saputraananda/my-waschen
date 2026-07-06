// ─────────────────────────────────────────────────────────────────────────────
// PaymentBreakdownCard.jsx — Full Accounting Payment Summary
// Shows breakdown by payment method with counts and amounts
// ─────────────────────────────────────────────────────────────────────────────
import { C, T } from '../../utils/theme';
import { rp } from '../../utils/helpers';
import { IconCash, IconQris, IconTransfer, IconEdc, IconDeposit, IconWallet } from './StatusIcons';
import { motion } from 'framer-motion';

/**
 * Payment Method Configuration
 * Maps API method names to display config
 */
const PAYMENT_METHODS = {
  cash: {
    label: 'Cash',
    shortLabel: 'Tunai',
    icon: IconCash,
    color: '#10B981',
    bgColor: '#ECFDF5',
  },
  qris: {
    label: 'QRIS',
    shortLabel: 'QRIS',
    icon: IconQris,
    color: '#6366F1',
    bgColor: '#EEF2FF',
  },
  transfer: {
    label: 'Transfer',
    shortLabel: 'Transfer',
    icon: IconTransfer,
    color: '#3B82F6',
    bgColor: '#DBEAFE',
  },
  edc: {
    label: 'EDC',
    shortLabel: 'EDC',
    icon: IconEdc,
    color: '#8B5CF6',
    bgColor: '#F3E8FF',
  },
  ovo: {
    label: 'OVO',
    shortLabel: 'OVO',
    icon: IconWallet,
    color: '#EC4899',
    bgColor: '#FCE7F3',
  },
  gopay: {
    label: 'GoPay',
    shortLabel: 'GoPay',
    icon: IconWallet,
    color: '#10B981',
    bgColor: '#ECFDF5',
  },
  dana: {
    label: 'DANA',
    shortLabel: 'DANA',
    icon: IconWallet,
    color: '#3B82F6',
    bgColor: '#DBEAFE',
  },
  shopeepay: {
    label: 'ShopeePay',
    shortLabel: 'Shoope',
    icon: IconWallet,
    color: '#F97316',
    bgColor: '#FFF7ED',
  },
  deposit: {
    label: 'Deposit',
    shortLabel: 'Deposit',
    icon: IconDeposit,
    color: '#F59E0B',
    bgColor: '#FEF3C7',
  },
  mixed: {
    label: 'Mixed',
    shortLabel: 'Campur',
    icon: IconWallet,
    color: '#6B7280',
    bgColor: '#F3F4F6',
  },
};

/**
 * Get payment method config by method key
 */
const getMethodConfig = (method) => {
  const key = method?.toLowerCase() || 'unknown';
  return PAYMENT_METHODS[key] || {
    label: method || 'Unknown',
    shortLabel: method || '?',
    icon: IconWallet,
    color: '#6B7280',
    bgColor: '#F3F4F6',
  };
};

/**
 * PaymentBreakdownCard — Shows payment summary with breakdown
 *
 * @param {Object} props
 * @param {Array} props.payments - Array of { method, amount, count }
 * @param {string} props.title - Card title
 * @param {boolean} props.showTotal - Show grand total row
 * @param {boolean} props.compact - Compact mode for widgets
 * @param {Function} props.onMethodClick - Click handler for method row
 * @param {Object} props.variance - { expected, actual, diff } for reconciliation
 */
export default function PaymentBreakdownCard({
  payments = [],
  title = 'Ringkasan Pembayaran',
  showTotal = true,
  compact = false,
  onMethodClick,
  variance,
}) {
  // Calculate totals
  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalCount = payments.reduce((sum, p) => sum + (p.count || 0), 0);

  // Sort by amount descending
  const sortedPayments = [...payments].sort((a, b) => (b.amount || 0) - (a.amount || 0));

  if (compact) {
    return (
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        {/* Header */}
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.n600,
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {title}
        </div>

        {/* Payment rows */}
        {sortedPayments.length === 0 ? (
          <div style={{ fontSize: 12, color: C.n400, textAlign: 'center', padding: 12 }}>
            Belum ada pembayaran
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedPayments.map((payment) => {
              const config = getMethodConfig(payment.method);
              const Icon = config.icon;
              return (
                <div
                  key={payment.method}
                  onClick={() => onMethodClick?.(payment.method)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: config.bgColor,
                    cursor: onMethodClick ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} color={config.color} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: config.color }}>
                      {config.shortLabel}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.n800 }}>
                      {rp(payment.amount || 0)}
                    </div>
                    <div style={{ fontSize: 10, color: C.n500 }}>
                      {payment.count || 0} nota
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        {showTotal && sortedPayments.length > 0 && (
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid ' + C.n100,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.n700 }}>Total</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>
                {rp(totalAmount)}
              </div>
              <div style={{ fontSize: 10, color: C.n500 }}>{totalCount} nota</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div style={{
      background: 'white',
      borderRadius: 20,
      padding: 16,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <span style={{ fontFamily: 'Poppins', fontSize: 14, fontWeight: 700, color: C.n800 }}>
          {title}
        </span>
        {totalCount > 0 && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.primary,
            background: C.primaryTint,
            padding: '2px 8px',
            borderRadius: 999,
          }}>
            {totalCount} transaksi
          </span>
        )}
      </div>

      {/* Payment breakdown */}
      {sortedPayments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '24px 16px',
          background: C.n50,
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.n600 }}>
            Belum Ada Pembayaran
          </div>
          <div style={{ fontSize: 11, color: C.n400, marginTop: 4 }}>
            Transaksi akan muncul di sini
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedPayments.map((payment, index) => {
            const config = getMethodConfig(payment.method);
            const Icon = config.icon;
            const percentage = totalAmount > 0 ? ((payment.amount || 0) / totalAmount * 100).toFixed(0) : 0;

            return (
              <motion.div
                key={payment.method}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onMethodClick?.(payment.method)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: config.bgColor,
                  cursor: onMethodClick ? 'pointer' : 'default',
                  border: '1px solid ' + config.color + '20',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px ' + config.color + '30',
                }}>
                  <Icon size={20} color={config.color} />
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: config.color }}>
                      {config.label}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.n800 }}>
                      {rp(payment.amount || 0)}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 4,
                  }}>
                    <span style={{ fontSize: 11, color: C.n500 }}>
                      {payment.count || 0} nota
                    </span>
                    <span style={{ fontSize: 10, color: C.n400 }}>
                      {percentage}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{
                    marginTop: 6,
                    height: 4,
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: percentage + '%',
                      height: '100%',
                      background: config.color,
                      borderRadius: 2,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Variance display */}
      {variance && (
        <div style={{
          marginTop: 16,
          padding: 12,
          background: variance.diff === 0 ? C.successBg : C.warningBg,
          borderRadius: 10,
          border: '1px solid ' + (variance.diff === 0 ? C.success : C.warning) + '30',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: C.n600,
            marginBottom: 4,
          }}>
            <span>Kas Fisik</span>
            <span>{rp(variance.actual || 0)}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: C.n600,
            marginBottom: 4,
          }}>
            <span>Seharusnya</span>
            <span>{rp(variance.expected || 0)}</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            fontWeight: 700,
            color: variance.diff === 0 ? C.success : C.warning,
            paddingTop: 6,
            borderTop: '1px dashed ' + (variance.diff === 0 ? C.success : C.warning) + '40',
          }}>
            <span>Selisih</span>
            <span>
              {variance.diff === 0 ? '✓ Sesuai' :
                (variance.diff > 0 ? '+' : '') + rp(variance.diff)}
            </span>
          </div>
        </div>
      )}

      {/* Grand Total */}
      {showTotal && sortedPayments.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: '14px 16px',
          background: 'linear-gradient(145deg, ' + C.primaryTint + ', ' + C.primaryTint + '90)',
          borderRadius: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>TOTAL PEMBAYARAN</div>
            <div style={{ fontSize: 11, color: C.n500, marginTop: 2 }}>{totalCount} nota</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.primary }}>
            {rp(totalAmount)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline payment summary
 * For use in other cards/widgets
 */
export function InlinePaymentSummary({ payments = [], size = 'sm' }) {
  const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const count = payments.reduce((sum, p) => sum + (p.count || 0), 0);

  if (size === 'xs') {
    return (
      <span style={{ fontSize: 11, color: C.n600 }}>
        {count} nota · {rp(total)}
      </span>
    );
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      background: C.n50,
      borderRadius: 8,
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.n700 }}>{rp(total)}</span>
      <span style={{ fontSize: 10, color: C.n400 }}>({count})</span>
    </div>
  );
}
