// ─────────────────────────────────────────────────────────────────────────────
// Segmentation API helpers
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

// ── Tiers (Loyalty & Membership definitions) ─────────────────────────────────
export async function getSegmentationTiers() {
  const res = await axios.get('/api/segmentation/tiers');
  return res?.data?.data;
}

// ── Overview ───────────────────────────────────────────────────────────────────
export async function getSegmentationOverview() {
  const res = await axios.get('/api/segmentation/overview');
  return res?.data?.data;
}

// ── Customers by segment ───────────────────────────────────────────────────────
export async function getSegmentedCustomers(filters = {}) {
  const res = await axios.get('/api/segmentation/customers', { params: filters });
  return {
    data: res?.data?.data || [],
    pagination: res?.data?.pagination || {},
  };
}

// ── VIP Insights ───────────────────────────────────────────────────────────────
export async function getVIPInsights() {
  const res = await axios.get('/api/segmentation/vip-insights');
  return res?.data?.data;
}

// ── Loyalty Tier Labels & Colors ───────────────────────────────────────────────────
// Based on transaction frequency and recency
export const LOYALTY_TIERS = {
  VIP: {
    label: 'VIP',
    description: 'Pelanggan premium',
    color: '#F59E0B',
    bg: '#FEF3C7',
    icon: '👑',
    badge: 'VIP',
  },
  RETAIN_LOYAL: {
    label: 'Loyal Dimelihara',
    description: 'Pelanggan loyal >10 transaksi',
    color: '#10B981',
    bg: '#D1FAE5',
    icon: '💎',
    badge: 'Loyal',
  },
  NEW_LOYAL: {
    label: 'Loyal Baru',
    description: 'Pelanggan 5-9 transaksi',
    color: '#8B5CF6',
    bg: '#EDE9FE',
    icon: '⭐',
    badge: 'New Loyal',
  },
  REGULAR: {
    label: 'Regular',
    description: 'Pelanggan 2-4 transaksi',
    color: '#6366F1',
    bg: '#E0E7FF',
    icon: '📅',
    badge: 'Regular',
  },
  ONE_TIME: {
    label: 'One-Time',
    description: 'Pelanggan 1 transaksi',
    color: '#9CA3AF',
    bg: '#F3F4F6',
    icon: '🔰',
    badge: 'Baru',
  },
  AT_RISK: {
    label: 'At Risk',
    description: '31-60 hari tidak transaksi',
    color: '#EF4444',
    bg: '#FEE2E2',
    icon: '⚠️',
    badge: 'Risiko',
  },
  CHURNED: {
    label: 'Churned',
    description: '>60 hari tidak aktif',
    color: '#6B7280',
    bg: '#F9FAFB',
    icon: '💤',
    badge: 'Churned',
  },
};

// ── Membership Tier Labels & Colors ───────────────────────────────────────────────────
// WPC membership (Gold/Diamond) - based on deposit
export const MEMBERSHIP_TIERS = {
  diamond: {
    label: 'Diamond',
    description: 'Member premium WPC',
    color: '#06B6D4',
    bg: '#CFFAFE',
    icon: '💠',
    badge: 'Diamond',
  },
  gold: {
    label: 'Gold',
    description: 'Member WPC',
    color: '#F59E0B',
    bg: '#FEF3C7',
    icon: '🥇',
    badge: 'Gold',
  },
};

// ── Legacy mappings for backward compatibility ─────────────────────────────────
export const SEGMENT_LABELS = LOYALTY_TIERS;

export const SEGMENT_OPTIONS = [
  { value: 'all', label: 'Semua' },
  { value: 'VIP', label: '👑 VIP' },
  { value: 'RETAIN_LOYAL', label: '💎 Loyal' },
  { value: 'NEW_LOYAL', label: '⭐ Loyal Baru' },
  { value: 'REGULAR', label: '📅 Regular' },
  { value: 'ONE_TIME', label: '🔰 One-Time' },
  { value: 'AT_RISK', label: '⚠️ At Risk' },
  { value: 'CHURNED', label: '💤 Churned' },
];

// ── Helper: Get tier info ───────────────────────────────────────────────────
export function getTierInfo(tierKey, tierType = 'loyalty') {
  if (tierType === 'membership') {
    return MEMBERSHIP_TIERS[tierKey] || null;
  }
  return LOYALTY_TIERS[tierKey] || LOYALTY_TIERS.ONE_TIME;
}

// ── Helper: Check if customer is VIP ────────────────────────────────────────
export function isVipCustomer(customer) {
  return customer.loyaltySegment?.key === 'VIP';
}

// ── Helper: Check if customer needs retention ─────────────────────────────────
export function needsRetention(customer) {
  const { key } = customer.loyaltySegment || {};
  return key === 'AT_RISK' || key === 'REGULAR';
}

// ── Helper: Format customer badges ───────────────────────────────────────────
export function getCustomerBadges(customer) {
  const badges = [];

  // Loyalty badge
  if (customer.loyaltySegment) {
    badges.push({
      type: 'loyalty',
      ...customer.loyaltySegment,
    });
  }

  // Membership badge (if any)
  if (customer.membershipTier) {
    badges.push({
      type: 'membership',
      ...customer.membershipTier,
    });
  }

  return badges;
}
