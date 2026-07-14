// ─────────────────────────────────────────────────────────────────────────────
// customerSegmentationController.js — Customer Segmentation Analytics
// Phase 5-7: Customer Segmentation with Pareto Analysis
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import logger from '../utils/logger.js';

// ─── LOYALTY TIER DEFINITIONS ─────────────────────────────────────────────────
// Based on transaction frequency and recency
const LOYALTY_TIERS = {
  VIP: {
    label: 'VIP',
    description: 'Pelanggan premium dengan transaksi & spending tertinggi',
    minTransactions: 30,
    minSpending: 5000000,
    color: '#F59E0B',
    bg: '#FEF3C7',
    icon: '👑',
    badge: 'VIP',
    tier: 'vip',
  },
  RETAIN_LOYAL: {
    label: 'Loyal Dimelihara',
    description: 'Pelanggan loyal yang sudah lama aktif (>10 transaksi)',
    minTransactions: 10,
    minSpending: 1000000,
    color: '#10B981',
    bg: '#D1FAE5',
    icon: '💎',
    badge: 'Loyal',
    tier: 'retain',
  },
  NEW_LOYAL: {
    label: 'Loyal Baru',
    description: 'Pelanggan yang mulai sering transaksi (5-9 transaksi)',
    minTransactions: 5,
    minSpending: 300000,
    color: '#8B5CF6',
    bg: '#EDE9FE',
    icon: '⭐',
    badge: 'New Loyal',
    tier: 'new',
  },
  REGULAR: {
    label: 'Regular',
    description: 'Pelanggan dengan aktivitas sesekali (2-4 transaksi)',
    minTransactions: 2,
    minSpending: 0,
    color: '#6366F1',
    bg: '#E0E7FF',
    icon: '📅',
    badge: 'Regular',
    tier: 'regular',
  },
  ONE_TIME: {
    label: 'One-Time',
    description: 'Pelanggan yang hanya transaksi sekali',
    minTransactions: 1,
    minSpending: 0,
    color: '#9CA3AF',
    bg: '#F3F4F6',
    icon: '🔰',
    badge: 'Baru',
    tier: 'one_time',
  },
  AT_RISK: {
    label: 'At Risk',
    description: 'Pelanggan yang mulai jarang transaksi (31-60 hari)',
    minTransactions: 0,
    minSpending: 0,
    color: '#EF4444',
    bg: '#FEE2E2',
    icon: '⚠️',
    badge: 'Risiko',
    tier: 'at_risk',
  },
  CHURNED: {
    label: 'Churned',
    description: 'Pelanggan tidak aktif lebih dari 60 hari',
    minTransactions: 0,
    minSpending: 0,
    color: '#6B7280',
    bg: '#F9FAFB',
    icon: '💤',
    badge: 'Churned',
    tier: 'churned',
  },
};

// ─── MEMBERSHIP BADGES (Separate from Loyalty) ─────────────────────────────────
// Membership = WPC tier (Gold/Diamond) - berdasarkan deposit
const MEMBERSHIP_TIERS = {
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

// ─── Helper: Calculate customer loyalty tier ────────────────────────────────────────
function calculateLoyaltyTier(txCount, totalSpending, lastTxDate) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);

  const lastTx = lastTxDate ? new Date(lastTxDate) : null;

  // Churned: tidak ada transaksi >60 hari
  if (!lastTx || lastTx < sixtyDaysAgo) {
    return { ...LOYALTY_TIERS.CHURNED, key: 'CHURNED' };
  }

  // At Risk: terakhir 31-60 hari lalu
  if (lastTx >= sixtyDaysAgo && lastTx < thirtyDaysAgo) {
    return { ...LOYALTY_TIERS.AT_RISK, key: 'AT_RISK' };
  }

  // VIP: 30+ transaksi & spending >= 5M
  if (txCount >= LOYALTY_TIERS.VIP.minTransactions && totalSpending >= LOYALTY_TIERS.VIP.minSpending) {
    return { ...LOYALTY_TIERS.VIP, key: 'VIP' };
  }

  // Retain Loyal: 10+ transaksi & spending >= 1M
  if (txCount >= LOYALTY_TIERS.RETAIN_LOYAL.minTransactions && totalSpending >= LOYALTY_TIERS.RETAIN_LOYAL.minSpending) {
    return { ...LOYALTY_TIERS.RETAIN_LOYAL, key: 'RETAIN_LOYAL' };
  }

  // New Loyal: 5-9 transaksi
  if (txCount >= LOYALTY_TIERS.NEW_LOYAL.minTransactions) {
    return { ...LOYALTY_TIERS.NEW_LOYAL, key: 'NEW_LOYAL' };
  }

  // Regular: 2-4 transaksi
  if (txCount >= LOYALTY_TIERS.REGULAR.minTransactions) {
    return { ...LOYALTY_TIERS.REGULAR, key: 'REGULAR' };
  }

  // One-Time: hanya 1 transaksi
  return { ...LOYALTY_TIERS.ONE_TIME, key: 'ONE_TIME' };
}

// ─── Helper: Get segment filter SQL ─────────────────────────────────────────────
function getSegmentFilterSQL(segmentKey) {
  switch (segmentKey) {
    case 'VIP':
      return 'tx.tx_count >= 30 AND tx.total_spending >= 5000000';
    case 'RETAIN_LOYAL':
      return 'tx.tx_count >= 10 AND tx.total_spending >= 1000000';
    case 'NEW_LOYAL':
      return 'tx.tx_count >= 5';
    case 'REGULAR':
      return 'tx.tx_count >= 2 AND tx.tx_count < 5';
    case 'ONE_TIME':
      return 'tx.tx_count = 1';
    case 'AT_RISK':
      return 'tx.last_tx_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND tx.last_tx_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    case 'CHURNED':
      return '(tx.last_tx_date IS NULL OR tx.last_tx_date < DATE_SUB(CURDATE(), INTERVAL 60 DAY))';
    default:
      return '';
  }
}

// ─── Helper: Calculate Pareto (80/20 rule) ────────────────────────────────────────
function calculateParetoAnalysis(customerRevenue) {
  // Sort customers by revenue descending
  const sorted = [...customerRevenue].sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = sorted.reduce((sum, c) => sum + c.totalRevenue, 0);
  const totalCustomers = sorted.length;

  if (totalCustomers === 0 || totalRevenue === 0) {
    return {
      top20Percent: { customerCount: 0, customerPercentage: 0, revenuePercentage: 0, revenue: 0 },
      bottom80Percent: { customerCount: 0, customerPercentage: 0, revenuePercentage: 0, revenue: 0 },
      totalRevenue: 0,
      totalCustomers: 0,
    };
  }

  let cumSum = 0;
  let cumCount = 0;

  // Find the point where 80% of revenue is achieved
  const paretoThreshold = totalRevenue * 0.8;

  for (const customer of sorted) {
    cumSum += customer.totalRevenue;
    cumCount++;
    if (cumSum >= paretoThreshold) {
      break;
    }
  }

  return {
    top20Percent: {
      customerCount: cumCount,
      customerPercentage: Math.round((cumCount / totalCustomers) * 100),
      revenuePercentage: 80,
      revenue: cumSum,
    },
    bottom80Percent: {
      customerCount: totalCustomers - cumCount,
      customerPercentage: Math.round(((totalCustomers - cumCount) / totalCustomers) * 100),
      revenuePercentage: 20,
      revenue: totalRevenue - cumSum,
    },
    totalRevenue,
    totalCustomers,
  };
}

// ─── EXPORT CONSTANTS FOR FRONTEND USE ────────────────────────────────────────
export { LOYALTY_TIERS, MEMBERSHIP_TIERS };

// ─── GET /api/segmentation/tiers ─────────────────────────────────────────────
// Returns loyalty tiers and membership tiers for frontend use
export const getSegmentationTiers = async (req, res) => {
  return res.json({
    success: true,
    data: {
      loyalty: LOYALTY_TIERS,
      membership: MEMBERSHIP_TIERS,
    },
  });
};

// ─── GET /api/segmentation/overview ─────────────────────────────────────────
export const getSegmentationOverview = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobal = ['admin'].includes(userRole);
    const outletFilter = isGlobal ? '' : 'AND t.outlet_id = ?';
    const params = isGlobal ? [] : [userOutletId];

    // Customer count by segment with updated tiers
    const [segmentCounts] = await poolWaschenPos.execute(
      `SELECT
         seg.segment,
         COUNT(DISTINCT seg.customer_id) as customerCount
       FROM (
         SELECT DISTINCT
           c.id as customer_id,
           CASE
             WHEN tx.tx_count >= 30 AND tx.total_spending >= 5000000 THEN 'VIP'
             WHEN tx.tx_count >= 10 AND tx.total_spending >= 1000000 THEN 'RETAIN_LOYAL'
             WHEN tx.tx_count >= 5 THEN 'NEW_LOYAL'
             WHEN tx.tx_count >= 2 THEN 'REGULAR'
             WHEN tx.tx_count = 1 THEN 'ONE_TIME'
             WHEN tx.last_tx_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) AND tx.last_tx_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 'AT_RISK'
             WHEN tx.last_tx_date IS NULL OR tx.last_tx_date < DATE_SUB(CURDATE(), INTERVAL 60 DAY) THEN 'CHURNED'
             ELSE 'ONE_TIME'
           END as segment
         FROM mst_customer c
         LEFT JOIN (
           SELECT
             customer_id,
             COUNT(*) as tx_count,
             COALESCE(SUM(total), 0) as total_spending,
             MAX(created_at) as last_tx_date
           FROM tr_transaction
           WHERE deleted_at IS NULL AND status != 'cancelled'
           GROUP BY customer_id
         ) tx ON tx.customer_id = c.id
         WHERE c.is_active = 1 AND c.deleted_at IS NULL
       ) seg
       GROUP BY seg.segment
       ORDER BY FIELD(seg.segment, 'VIP', 'RETAIN_LOYAL', 'NEW_LOYAL', 'REGULAR', 'ONE_TIME', 'AT_RISK', 'CHURNED')`,
      params
    );

    // Activity summary
    const [activityCounts] = await poolWaschenPos.execute(
      `SELECT
         CASE
           WHEN tx.tx_count IS NULL THEN 'inactive'
           WHEN tx.last_tx_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 'active'
           WHEN tx.last_tx_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) THEN 'at_risk'
           ELSE 'churned'
         END as activity_status,
         COUNT(*) as customer_count
       FROM mst_customer c
       LEFT JOIN (
         SELECT customer_id, COUNT(*) as tx_count, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1 AND c.deleted_at IS NULL
       GROUP BY activity_status`,
      params
    );

    // Revenue by segment
    const [revenueBySegment] = await poolWaschenPos.execute(
      `SELECT
         seg.segment,
         COUNT(DISTINCT seg.customer_id) as customer_count,
         SUM(seg.tx_count) as total_transactions,
         SUM(seg.total) as total_revenue
       FROM (
         SELECT
           c.id as customer_id,
           CASE
             WHEN tx.tx_count >= 30 AND tx.total_spending >= 5000000 THEN 'VIP'
             WHEN tx.tx_count >= 10 AND tx.total_spending >= 1000000 THEN 'RETAIN_LOYAL'
             WHEN tx.tx_count >= 5 THEN 'NEW_LOYAL'
             WHEN tx.tx_count >= 2 THEN 'REGULAR'
             WHEN tx.tx_count = 1 THEN 'ONE_TIME'
             ELSE 'CHURNED'
           END as segment,
           COALESCE(tx.tx_count, 0) as tx_count,
           COALESCE(tx.total, 0) as total
         FROM mst_customer c
         LEFT JOIN (
           SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total
           FROM tr_transaction
           WHERE deleted_at IS NULL AND status != 'cancelled'
           GROUP BY customer_id
         ) tx ON tx.customer_id = c.id
         WHERE c.is_active = 1 AND c.deleted_at IS NULL
       ) seg
       GROUP BY seg.segment
       ORDER BY FIELD(seg.segment, 'VIP', 'RETAIN_LOYAL', 'NEW_LOYAL', 'REGULAR', 'ONE_TIME', 'AT_RISK', 'CHURNED')`,
      params
    );

    // Build segment data
    const segmentKeys = ['VIP', 'RETAIN_LOYAL', 'NEW_LOYAL', 'REGULAR', 'ONE_TIME', 'AT_RISK', 'CHURNED'];
    const segments = segmentKeys.map(key => {
      const config = LOYALTY_TIERS[key];
      const count = segmentCounts.find(s => s.segment === key)?.customerCount || 0;
      const revenue = revenueBySegment.find(s => s.segment === key);
      return {
        key,
        ...config,
        customerCount: Number(count),
        totalTransactions: Number(revenue?.total_transactions || 0),
        totalRevenue: Number(revenue?.total_revenue || 0),
      };
    });

    // Activity summary
    const activitySummary = {
      active: Number(activityCounts.find(a => a.activity_status === 'active')?.customer_count || 0),
      at_risk: Number(activityCounts.find(a => a.activity_status === 'at_risk')?.customer_count || 0),
      churned: Number(activityCounts.find(a => a.activity_status === 'churned')?.customer_count || 0),
      inactive: Number(activityCounts.find(a => a.activity_status === 'inactive')?.customer_count || 0),
    };

    // Calculate total customers
    const totalCustomers = Object.values(activitySummary).reduce((a, b) => a + b, 0);

    // Add percentages
    const segmentsWithPct = segments.map(s => ({
      ...s,
      percentage: totalCustomers > 0 ? Math.round((s.customerCount / totalCustomers) * 100) : 0,
    }));

    // Pareto analysis
    const customerRevenueData = segments.map(s => ({
      customerCount: s.customerCount,
      totalRevenue: s.totalRevenue,
    }));
    const pareto = calculateParetoAnalysis(
      segments.flatMap(s => Array(s.customerCount).fill({ totalRevenue: s.totalRevenue / Math.max(s.customerCount, 1) }))
    );

    return res.json({
      success: true,
      data: {
        segments: segmentsWithPct,
        activitySummary: {
          ...activitySummary,
          total: totalCustomers,
          activeRate: totalCustomers > 0 ? Math.round((activitySummary.active / totalCustomers) * 100) : 0,
        },
        revenueSummary: {
          total: segmentsWithPct.reduce((s, seg) => s + seg.totalRevenue, 0),
          avgPerCustomer: totalCustomers > 0
            ? Math.round(segmentsWithPct.reduce((s, seg) => s + seg.totalRevenue, 0) / totalCustomers)
            : 0,
        },
        pareto,
        membership: MEMBERSHIP_TIERS,
      },
    });
  } catch (err) {
    logger.error('Get segmentation overview failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat segmentasi.' });
  }
};

// ─── GET /api/segmentation/customers ────────────────────────────────────────
export const getSegmentedCustomers = async (req, res) => {
  try {
    const {
      segment,
      page = 1,
      limit = 50,
      search,
      sort = 'recent',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    // Build segment filter
    let segmentFilter = '';
    if (segment && Object.keys(LOYALTY_TIERS).includes(segment.toUpperCase())) {
      const segKey = segment.toUpperCase();
      const segFilter = getSegmentFilterSQL(segKey);
      if (segFilter) {
        segmentFilter = `AND (${segFilter})`;
      }
    }

    // Build sort
    let orderBy = 'tx.last_tx_date DESC';
    if (sort === 'high_value') orderBy = 'tx.total_spending DESC';
    else if (sort === 'frequent') orderBy = 'tx.tx_count DESC';
    else if (sort === 'recent') orderBy = 'tx.last_tx_date DESC';
    else if (sort === 'name') orderBy = 'c.name ASC';

    // Search
    let searchFilter = '';
    const searchParams = [];
    if (search && search.trim()) {
      searchFilter = 'AND (c.name LIKE ? OR c.phone LIKE ?)';
      const q = `%${search.trim()}%`;
      searchParams.push(q, q);
    }

    // Count total
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(DISTINCT c.id) as total
       FROM mst_customer c
       LEFT JOIN (
         SELECT customer_id, COUNT(*) as tx_count, COALESCE(SUM(total), 0) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1 AND c.deleted_at IS NULL
       ${segmentFilter} ${searchFilter}`,
      searchParams
    );
    const total = Number(countRows[0]?.total || 0);

    // LIMIT/OFFSET must be integers for mysql2 execute()
    const safeLimit = Math.max(1, Math.min(limitNum, 200));
    const safeOffset = Math.max(0, offset);

    // Fetch customers with membership info
    const [rows] = await poolWaschenPos.execute(
      `SELECT
         c.id, c.name, c.phone, c.is_member,
         tx.tx_count as transactionCount,
         tx.total_spending as totalSpending,
         tx.last_tx_date as lastTransactionDate,
         tx.avg_tx_value as avgTransactionValue,
         w.balance as depositBalance,
         m.tier as memberTier,
         o.name as outletName
       FROM mst_customer c
       LEFT JOIN (
         SELECT
           customer_id,
           COUNT(*) as tx_count,
           COALESCE(SUM(total), 0) as total_spending,
           COALESCE(AVG(total), 0) as avg_tx_value,
           MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
       ) tx ON tx.customer_id = c.id
       LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
       LEFT JOIN mst_membership m ON m.customer_id = c.id AND m.status = 'active'
       LEFT JOIN mst_outlet o ON o.id = c.registered_outlet_id
       WHERE c.is_active = 1 AND c.deleted_at IS NULL
       ${segmentFilter} ${searchFilter}
       ORDER BY ${orderBy}
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      searchParams
    );

    // Calculate segments for each customer
    const customers = rows.map(c => {
      const txCount = Number(c.transactionCount || 0);
      const totalSpending = Number(c.totalSpending || 0);
      const avgTx = Number(c.avgTransactionValue || 0);
      const lastTx = c.lastTransactionDate ? new Date(c.lastTransactionDate) : null;
      const loyalty = calculateLoyaltyTier(txCount, totalSpending, lastTx);

      // Calculate days since last transaction
      let daysSinceTx = null;
      if (lastTx) {
        daysSinceTx = Math.ceil((Date.now() - lastTx.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Get membership info
      const membership = c.memberTier ? MEMBERSHIP_TIERS[c.memberTier.toLowerCase()] : null;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        isMember: c.is_member === 1,
        transactionCount: txCount,
        totalSpending,
        avgTransactionValue: avgTx,
        lastTransactionDate: c.lastTransactionDate,
        daysSinceTransaction: daysSinceTx,
        depositBalance: Number(c.depositBalance || 0),
        outletName: c.outletName,
        loyaltySegment: loyalty,
        membershipTier: membership ? { ...membership, key: c.memberTier.toLowerCase() } : null,
      };
    });

    return res.json({
      success: true,
      data: customers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    logger.error('Get segmented customers failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data pelanggan.' });
  }
};

// ─── GET /api/segmentation/vip-insights ──────────────────────────────────────
export const getVIPInsights = async (req, res) => {
  try {
    // Top VIPs (30+ transaksi & >= 5M spending)
    const [topVIPs] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.is_member,
              tx.tx_count, tx.total_spending, tx.last_tx_date,
              m.tier as memberTier
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING tx_count >= 30 AND total_spending >= 5000000
       ) tx ON tx.customer_id = c.id
       LEFT JOIN mst_membership m ON m.customer_id = c.id AND m.status = 'active'
       WHERE c.is_active = 1
       ORDER BY tx.total_spending DESC
       LIMIT 10`
    );

    // Retain Loyal (10+ transaksi & >= 1M)
    const [retainLoyals] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.is_member,
              tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING tx_count >= 10 AND total_spending >= 1000000
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.tx_count DESC
       LIMIT 10`
    );

    // New Loyal (5-9 transaksi)
    const [newLoyals] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.is_member,
              tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING tx_count BETWEEN 5 AND 9
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.tx_count DESC
       LIMIT 10`
    );

    // At-Risk (31-60 hari tidak transaksi)
    const [atRiskCustomers] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone,
              tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING last_tx_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
                  AND last_tx_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.last_tx_date ASC
       LIMIT 10`
    );

    // Churned (>60 hari tidak transaksi)
    const [churnedCustomers] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone,
              tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING last_tx_date < DATE_SUB(CURDATE(), INTERVAL 60 DAY)
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.last_tx_date ASC
       LIMIT 10`
    );

    const mapCustomer = (c, loyaltyKey = null) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      isMember: c.is_member === 1,
      memberTier: c.memberTier ? MEMBERSHIP_TIERS[c.memberTier.toLowerCase()] : null,
      transactionCount: Number(c.tx_count || 0),
      totalSpending: Number(c.total_spending || 0),
      lastTransactionDate: c.last_tx_date,
      daysSinceTransaction: c.last_tx_date
        ? Math.ceil((Date.now() - new Date(c.last_tx_date).getTime()) / (1000 * 60 * 60 * 24))
        : null,
    });

    return res.json({
      success: true,
      data: {
        vips: topVIPs.map(c => mapCustomer(c, 'VIP')),
        retainLoyals: retainLoyals.map(mapCustomer),
        newLoyals: newLoyals.map(mapCustomer),
        atRisk: atRiskCustomers.map(mapCustomer),
        churned: churnedCustomers.map(mapCustomer),
      },
    });
  } catch (err) {
    logger.error('Get VIP insights failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat insights.' });
  }
};
