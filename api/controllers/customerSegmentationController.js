// ─────────────────────────────────────────────────────────────────────────────
// customerSegmentationController.js — Customer Segmentation Analytics
// Phase 5-7: Customer Segmentation
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';

// ─── SEGMENTATION TYPES ─────────────────────────────────────────────────────
const SEGMENT_TYPES = {
  LOYALTY: 'loyalty',
  VALUE: 'value',
  BEHAVIOR: 'behavior',
  LIFECYCLE: 'lifecycle',
};

// Loyalty segments based on transaction frequency
const LOYALTY_SEGMENTS = {
  VIP: {
    label: 'VIP Customer',
    description: 'Pelanggan paling berharga dengan transaksi tertinggi',
    minTransactions: 50,
    minSpending: 5000000,
    color: '#F59E0B',
    bg: '#FEF3C7',
    icon: '👑',
    badge: 'VIP',
  },
  GOLD: {
    label: 'Gold Customer',
    description: 'Pelanggan setia dengan transaksi reguler',
    minTransactions: 20,
    minSpending: 2000000,
    color: '#D97706',
    bg: '#FFEDD5',
    icon: '⭐',
    badge: 'Gold',
  },
  SILVER: {
    label: 'Silver Customer',
    description: 'Pelanggan tetap dengan aktivitas moderat',
    minTransactions: 5,
    minSpending: 500000,
    color: '#6B7280',
    bg: '#F3F4F6',
    icon: '🥈',
    badge: 'Silver',
  },
  BRONZE: {
    label: 'Bronze Customer',
    description: 'Pelanggan baru dengan potensi pertumbuhan',
    minTransactions: 1,
    minSpending: 0,
    color: '#92400E',
    bg: '#FEF2F2',
    icon: '🥉',
    badge: 'Bronze',
  },
  NEW: {
    label: 'New Customer',
    description: 'Pelanggan yang baru pertama kali bertransaksi',
    minTransactions: 0,
    minSpending: 0,
    color: '#8B5CF6',
    bg: '#EDE9FE',
    icon: '🌱',
    badge: 'New',
  },
  AT_RISK: {
    label: 'At Risk',
    description: 'Pelanggan yang sudah lama tidak bertransaksi',
    minTransactions: 0,
    minSpending: 0,
    color: '#DC2626',
    bg: '#FEE2E2',
    icon: '⚠️',
    badge: 'At Risk',
  },
  CHURNED: {
    label: 'Churned',
    description: 'Pelanggan yang sudah tidak aktif',
    minTransactions: 0,
    minSpending: 0,
    color: '#9CA3AF',
    bg: '#F9FAFB',
    icon: '😔',
    badge: 'Churned',
  },
};

// Value segments based on average transaction value
const VALUE_SEGMENTS = {
  HIGH_VALUE: { label: 'High Value', minAvgTx: 500000, color: '#059669', bg: '#D1FAE5', icon: '💎' },
  MEDIUM_VALUE: { label: 'Medium Value', minAvgTx: 100000, color: '#6366F1', bg: '#E0E7FF', icon: '💰' },
  LOW_VALUE: { label: 'Low Value', minAvgTx: 0, color: '#9CA3AF', bg: '#F3F4F6', icon: '💵' },
};

// Lifecycle segments
const LIFECYCLE_SEGMENTS = {
  FIRST_TIME: { label: 'First Timer', color: '#8B5CF6', bg: '#EDE9FE', icon: '👋' },
  RETURNING: { label: 'Returning', color: '#10B981', bg: '#D1FAE5', icon: '🔄' },
  REGULAR: { label: 'Regular', color: '#0EA5E9', bg: '#E0F2FE', icon: '📅' },
  DORMANT: { label: 'Dormant', color: '#F59E0B', bg: '#FEF3C7', icon: '😴' },
  REACTIVATED: { label: 'Reactivated', color: '#EC4899', bg: '#FCE7F3', icon: '🔥' },
};

// ─── Helper: Calculate customer segment ────────────────────────────────────────
function calculateLoyaltySegment(txCount, totalSpending, lastTxDate) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const lastTx = lastTxDate ? new Date(lastTxDate) : null;
  const isRecent = lastTx && lastTx >= thirtyDaysAgo;
  const isAtRisk = lastTx && lastTx >= ninetyDaysAgo && lastTx < thirtyDaysAgo;

  if (txCount === 0) {
    return { ...LOYALTY_SEGMENTS.NEW, key: 'NEW' };
  }
  if (!isRecent && lastTx && lastTx < thirtyDaysAgo) {
    if (lastTx < sixtyDaysAgo) {
      return { ...LOYALTY_SEGMENTS.CHURNED, key: 'CHURNED' };
    }
    return { ...LOYALTY_SEGMENTS.AT_RISK, key: 'AT_RISK' };
  }
  if (txCount >= LOYALTY_SEGMENTS.VIP.minTransactions && totalSpending >= LOYALTY_SEGMENTS.VIP.minSpending) {
    return { ...LOYALTY_SEGMENTS.VIP, key: 'VIP' };
  }
  if (txCount >= LOYALTY_SEGMENTS.GOLD.minTransactions && totalSpending >= LOYALTY_SEGMENTS.GOLD.minSpending) {
    return { ...LOYALTY_SEGMENTS.GOLD, key: 'GOLD' };
  }
  if (txCount >= LOYALTY_SEGMENTS.SILVER.minTransactions) {
    return { ...LOYALTY_SEGMENTS.SILVER, key: 'SILVER' };
  }
  return { ...LOYALTY_SEGMENTS.BRONZE, key: 'BRONZE' };
}

function calculateValueSegment(avgTxValue) {
  if (avgTxValue >= VALUE_SEGMENTS.HIGH_VALUE.minAvgTx) {
    return { ...VALUE_SEGMENTS.HIGH_VALUE, key: 'HIGH_VALUE' };
  }
  if (avgTxValue >= VALUE_SEGMENTS.MEDIUM_VALUE.minAvgTx) {
    return { ...VALUE_SEGMENTS.MEDIUM_VALUE, key: 'MEDIUM_VALUE' };
  }
  return { ...VALUE_SEGMENTS.LOW_VALUE, key: 'LOW_VALUE' };
}

// ─── GET /api/segmentation/overview ─────────────────────────────────────────
export const getSegmentationOverview = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);
    const outletFilter = isGlobal ? '' : 'AND t.outlet_id = ?';
    const params = isGlobal ? [] : [userOutletId];

    // Customer count by segment
    const [segmentCounts] = await poolWaschenPos.execute(
      `SELECT
         seg.category,
         seg.segment,
         COUNT(DISTINCT seg.customer_id) as customerCount
       FROM (
         SELECT DISTINCT
           c.id as customer_id,
           'loyalty' as category,
           CASE
             WHEN tx.tx_count >= 50 AND tx.total_spending >= 5000000 THEN 'VIP'
             WHEN tx.tx_count >= 20 AND tx.total_spending >= 2000000 THEN 'GOLD'
             WHEN tx.tx_count >= 5 THEN 'SILVER'
             WHEN tx.tx_count >= 1 THEN 'BRONZE'
             ELSE 'NEW'
           END as segment
         FROM mst_customer c
         LEFT JOIN (
           SELECT
             customer_id,
             COUNT(*) as tx_count,
             SUM(total) as total_spending,
             MAX(created_at) as last_tx_date
           FROM tr_transaction
           WHERE deleted_at IS NULL AND status != 'cancelled'
           GROUP BY customer_id
         ) tx ON tx.customer_id = c.id
         WHERE c.is_active = 1 AND c.deleted_at IS NULL
       ) seg
       GROUP BY seg.category, seg.segment
       ORDER BY FIELD(seg.segment, 'VIP', 'GOLD', 'SILVER', 'BRONZE', 'NEW', 'AT_RISK', 'CHURNED')`,
      params
    );

    // Customer by activity status
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
         SUM(seg.total) as total_revenue,
         AVG(seg.total) as avg_revenue_per_customer
       FROM (
         SELECT
           c.id as customer_id,
           CASE
             WHEN tx.tx_count >= 50 AND tx.total_spending >= 5000000 THEN 'VIP'
             WHEN tx.tx_count >= 20 AND tx.total_spending >= 2000000 THEN 'GOLD'
             WHEN tx.tx_count >= 5 THEN 'SILVER'
             WHEN tx.tx_count >= 1 THEN 'BRONZE'
             ELSE 'NEW'
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
       ORDER BY FIELD(seg.segment, 'VIP', 'GOLD', 'SILVER', 'BRONZE', 'NEW')`,
      params
    );

    // Build segment data
    const segments = ['VIP', 'GOLD', 'SILVER', 'BRONZE', 'NEW', 'AT_RISK', 'CHURNED'].map(key => {
      const config = LOYALTY_SEGMENTS[key];
      const count = segmentCounts.find(s => s.segment === key)?.customerCount || 0;
      const revenue = revenueBySegment.find(s => s.segment === key);
      return {
        key,
        ...config,
        customerCount: Number(count),
        totalTransactions: Number(revenue?.total_transactions || 0),
        totalRevenue: Number(revenue?.total_revenue || 0),
        avgRevenuePerCustomer: Number(revenue?.avg_revenue_per_customer || 0),
      };
    });

    // Activity summary
    const activitySummary = {
      active: Number(activityCounts.find(a => a.activity_status === 'active')?.customer_count || 0),
      at_risk: Number(activityCounts.find(a => a.activity_status === 'at_risk')?.customer_count || 0),
      churned: Number(activityCounts.find(a => a.activity_status === 'churned')?.customer_count || 0),
      inactive: Number(activityCounts.find(a => a.activity_status === 'inactive')?.customer_count || 0),
    };

    // Calculate percentages
    const totalCustomers = Object.values(activitySummary).reduce((a, b) => a + b, 0);
    const segmentsWithPct = segments.map(s => ({
      ...s,
      percentage: totalCustomers > 0 ? Math.round((s.customerCount / totalCustomers) * 100) : 0,
    }));

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
      },
    });
  } catch (err) {
    console.error('[getSegmentationOverview] Error:', err);
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
    if (segment && Object.keys(LOYALTY_SEGMENTS).includes(segment.toUpperCase())) {
      const segKey = segment.toUpperCase();
      const seg = LOYALTY_SEGMENTS[segKey];

      if (segKey === 'VIP') {
        segmentFilter = `AND tx.tx_count >= ${seg.minTransactions} AND tx.total_spending >= ${seg.minSpending}`;
      } else if (segKey === 'GOLD') {
        segmentFilter = `AND tx.tx_count >= ${seg.minTransactions} AND tx.total_spending >= ${seg.minSpending}`;
      } else if (segKey === 'SILVER') {
        segmentFilter = `AND tx.tx_count >= ${seg.minTransactions}`;
      } else if (segKey === 'BRONZE') {
        segmentFilter = `AND tx.tx_count >= 1`;
      } else if (segKey === 'NEW') {
        segmentFilter = `AND (tx.tx_count IS NULL OR tx.tx_count = 0)`;
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
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1 AND c.deleted_at IS NULL
       ${segmentFilter} ${searchFilter}`,
      searchParams
    );
    const total = Number(countRows[0]?.total || 0);

    // Fetch customers
    const [rows] = await poolWaschenPos.execute(
      `SELECT
         c.id, c.name, c.phone, c.is_member,
         tx.tx_count as transactionCount,
         tx.total_spending as totalSpending,
         tx.last_tx_date as lastTransactionDate,
         tx.avg_tx_value as avgTransactionValue,
         w.balance as depositBalance,
         o.name as outletName
       FROM mst_customer c
       LEFT JOIN (
         SELECT
           customer_id,
           COUNT(*) as tx_count,
           SUM(total) as total_spending,
           AVG(total) as avg_tx_value,
           MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
       ) tx ON tx.customer_id = c.id
       LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
       LEFT JOIN mst_outlet o ON o.id = c.registered_outlet_id
       WHERE c.is_active = 1 AND c.deleted_at IS NULL
       ${segmentFilter} ${searchFilter}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...searchParams, limitNum, offset]
    );

    // Calculate segments for each customer
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const customers = rows.map(c => {
      const txCount = Number(c.transactionCount || 0);
      const totalSpending = Number(c.totalSpending || 0);
      const avgTx = Number(c.avgTransactionValue || 0);
      const lastTx = c.lastTransactionDate ? new Date(c.lastTransactionDate) : null;
      const loyalty = calculateLoyaltySegment(txCount, totalSpending, lastTx);
      const value = calculateValueSegment(avgTx);

      // Calculate days since last transaction
      let daysSinceTx = null;
      if (lastTx) {
        daysSinceTx = Math.ceil((Date.now() - lastTx.getTime()) / (1000 * 60 * 60 * 24));
      }

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
        valueSegment: value,
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
    console.error('[getSegmentedCustomers] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data pelanggan.' });
  }
};

// ─── GET /api/segmentation/vip-insights ──────────────────────────────────────
export const getVIPInsights = async (req, res) => {
  try {
    // Top 10 VIP customers by spending
    const [topVIPs] = await poolWaschenPos.execute(
      `SELECT
         c.id, c.name, c.phone,
         tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING tx_count >= 20 AND total_spending >= 2000000
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.total_spending DESC
       LIMIT 10`
    );

    // At-risk customers (last transaction 30-60 days ago)
    const [atRiskCustomers] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone,
              tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING tx_count >= 1 AND last_tx_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                  AND last_tx_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.total_spending DESC
       LIMIT 10`
    );

    // Customers who never came back (churned)
    const [churnedCustomers] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone,
              tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING last_tx_date < DATE_SUB(CURDATE(), INTERVAL 90 DAY)
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.total_spending DESC
       LIMIT 10`
    );

    // Potential VIPs (high-value single transaction customers)
    const [potentialVIPs] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone,
              tx.tx_count, tx.total_spending, tx.last_tx_date
       FROM mst_customer c
       JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
         HAVING tx_count BETWEEN 10 AND 19
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
       ORDER BY tx.total_spending DESC
       LIMIT 10`
    );

    return res.json({
      success: true,
      data: {
        topVIPs: topVIPs.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          transactionCount: Number(c.tx_count || 0),
          totalSpending: Number(c.total_spending || 0),
          lastTransactionDate: c.last_tx_date,
        })),
        atRisk: atRiskCustomers.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          transactionCount: Number(c.tx_count || 0),
          totalSpending: Number(c.total_spending || 0),
          daysSinceTransaction: Math.ceil((Date.now() - new Date(c.last_tx_date).getTime()) / (1000 * 60 * 60 * 24)),
        })),
        churned: churnedCustomers.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          transactionCount: Number(c.tx_count || 0),
          totalSpending: Number(c.total_spending || 0),
          daysSinceTransaction: Math.ceil((Date.now() - new Date(c.last_tx_date).getTime()) / (1000 * 60 * 60 * 24)),
        })),
        potentialVIPs: potentialVIPs.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          transactionCount: Number(c.tx_count || 0),
          totalSpending: Number(c.total_spending || 0),
          lastTransactionDate: c.last_tx_date,
        })),
      },
    });
  } catch (err) {
    console.error('[getVIPInsights] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat insights.' });
  }
};
