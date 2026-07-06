// ─────────────────────────────────────────────────────────────────────────────
// PaymentStatusBadge.jsx — Auto-detecting Payment Status Badge
// Phase: Payment Enhancement
//
// Features:
// - Auto-detects status based on total, paidAmount, and paidFullAmount
// - Shows Lunas, DP (Down Payment), or Bayar Nanti
// - Uses SVG icons instead of emoji
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ClayBadge } from '../design/ClayBadge';
import {
  IconPaid,
  IconPartial,
  IconUnpaid,
  IconClock,
} from './StatusIcons';

/**
 * PaymentStatusBadge — Auto-detecting payment status
 *
 * @param {number} total - Total transaction amount
 * @param {number} paidAmount - Amount already paid
 * @param {number} paidFullAmount - Amount paid in full payment (for DP tracking)
 * @param {string} customLabel - Optional custom label override
 * @param {string} size - Badge size: 'sm' | 'md' | 'lg'
 * @param {boolean} showAmount - Show amount difference
 * @param {object} style - Additional styles
 */
export function PaymentStatusBadge({
  total = 0,
  paidAmount = 0,
  paidFullAmount = 0,
  customLabel,
  size = 'md',
  showAmount = false,
  style,
}) {
  const totalNum = Number(total || 0);
  const paidNum = Number(paidAmount || 0);
  const dpNum = Number(paidFullAmount || 0); // DP amount

  // Determine payment status
  let status;
  let IconComponent;
  let label;
  let variant;
  let color;

  if (totalNum === 0) {
    // No transaction
    status = 'none';
    IconComponent = IconClock;
    label = 'Tanpa Tagihan';
    variant = 'secondary';
    color = '#64748B';
  } else if (paidNum >= totalNum) {
    // Fully paid - either full payment or DP completed
    const isDPCompleted = dpNum > 0 && dpNum < totalNum;
    status = 'lunas';
    IconComponent = IconPaid;
    label = 'Lunas';
    variant = 'success';
    color = '#059669';
  } else if (paidNum > 0) {
    // Has partial payment - this is DP (Down Payment)
    const dpPercentage = Math.round((paidNum / totalNum) * 100);
    status = 'dp';
    IconComponent = IconPartial;
    label = customLabel || `DP ${dpPercentage}%`;
    variant = 'warning';
    color = '#D97706';
  } else {
    // No payment yet - Bayar Nanti
    status = 'unpaid';
    IconComponent = showAmount ? IconUnpaid : IconClock;
    label = showAmount ? `Bayar ${formatCurrency(totalNum - paidNum)}` : 'Bayar Nanti';
    variant = 'danger';
    color = '#DC2626';
  }

  return (
    <ClayBadge
      variant={variant}
      size={size}
      icon={<IconComponent size={size === 'sm' ? 10 : size === 'lg' ? 16 : 12} color={color} />}
      style={style}
    >
      {label}
    </ClayBadge>
  );
}

/**
 * PaymentStatusBadgeSimple — Simple version with predefined status
 *
 * @param {string} status - 'lunas' | 'dp' | 'bayar_nanti' | 'partial'
 * @param {string} label - Custom label (optional)
 * @param {string} size - Badge size
 */
export function PaymentStatusBadgeSimple({
  status = 'unpaid',
  label,
  size = 'md',
  style,
}) {
  const configs = {
    lunas: {
      variant: 'success',
      color: '#059669',
      defaultLabel: 'Lunas',
      Icon: IconPaid,
    },
    paid: {
      variant: 'success',
      color: '#059669',
      defaultLabel: 'Lunas',
      Icon: IconPaid,
    },
    dp: {
      variant: 'warning',
      color: '#D97706',
      defaultLabel: 'DP',
      Icon: IconPartial,
    },
    partial: {
      variant: 'warning',
      color: '#D97706',
      defaultLabel: 'Sebagian',
      Icon: IconPartial,
    },
    sebagian: {
      variant: 'warning',
      color: '#D97706',
      defaultLabel: 'Sebagian',
      Icon: IconPartial,
    },
    unpaid: {
      variant: 'danger',
      color: '#DC2626',
      defaultLabel: 'Belum Bayar',
      Icon: IconUnpaid,
    },
    belum_lunas: {
      variant: 'danger',
      color: '#DC2626',
      defaultLabel: 'Belum Lunas',
      Icon: IconUnpaid,
    },
    bayar_nanti: {
      variant: 'danger',
      color: '#DC2626',
      defaultLabel: 'Bayar Nanti',
      Icon: IconClock,
    },
    none: {
      variant: 'secondary',
      color: '#64748B',
      defaultLabel: 'Tanpa Tagihan',
      Icon: IconClock,
    },
  };

  const config = configs[status] || configs.unpaid;
  const displayLabel = label || config.defaultLabel;
  const iconSize = size === 'sm' ? 10 : size === 'lg' ? 16 : 12;

  return (
    <ClayBadge
      variant={config.variant}
      size={size}
      icon={<config.Icon size={iconSize} color={config.color} />}
      style={style}
    >
      {displayLabel}
    </ClayBadge>
  );
}

/**
 * getPaymentStatus — Utility function to determine payment status
 *
 * @param {number} total - Total amount
 * @param {number} paid - Amount paid
 * @param {number} dpPaid - Amount paid as DP
 * @returns {object} { status, label, variant, color }
 */
export function getPaymentStatus(total, paid = 0, dpPaid = 0) {
  const totalNum = Number(total || 0);
  const paidNum = Number(paid || 0);
  const dpNum = Number(dpPaid || 0);

  if (totalNum === 0) {
    return { status: 'none', label: 'Tanpa Tagihan', variant: 'secondary', color: '#64748B' };
  }

  if (paidNum >= totalNum) {
    return { status: 'lunas', label: 'Lunas', variant: 'success', color: '#059669' };
  }

  if (paidNum > 0) {
    const percentage = Math.round((paidNum / totalNum) * 100);
    return {
      status: 'dp',
      label: `DP ${percentage}%`,
      variant: 'warning',
      color: '#D97706',
    };
  }

  return {
    status: 'unpaid',
    label: 'Bayar Nanti',
    variant: 'danger',
    color: '#DC2626',
  };
}

// Helper function
function formatCurrency(amount) {
  if (!amount && amount !== 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default PaymentStatusBadge;
