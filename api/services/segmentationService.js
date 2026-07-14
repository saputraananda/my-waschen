// ─────────────────────────────────────────────────────────────────────────────
// segmentationService.js — Customer Segmentation Service
// Handles automatic segmentation updates on transaction events
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';
import logger from '../utils/logger.js';

// Segment categories
export const SEGMENT_CATEGORIES = {
  NEW: 'new',
  ONE_TIME: 'one_time',
  REGULAR: 'regular',
  LOYAL: 'loyal',
  AT_RISK: 'at_risk',
  INACTIVE: 'inactive',
};

export const SEGMENT_LABELS = {
  new: '🆕 New Customer',
  one_time: '👁️ One Time',
  regular: '🔄 Regular',
  loyal: '⭐ Loyal',
  at_risk: '⚠️ At Risk',
  inactive: '😴 Inactive',
};

export const SEGMENT_COLORS = {
  new: '#6B7280',
  one_time: '#8B5CF6',
  regular: '#3B82F6',
  loyal: '#10B981',
  at_risk: '#F59E0B',
  inactive: '#6B7280',
};

// ─────────────────────────────────────────────────────────────────────────────
// Calculate segment for a customer based on transaction metrics
// ─────────────────────────────────────────────────────────────────────────────
export async function calculateCustomerSegment(customerId) {
  try {
    // Get transaction metrics
    const [rows] = await db.execute(`
      SELECT
        COUNT(DISTINCT t.id) AS tx_count,
        COALESCE(SUM(t.total_amount), 0) AS total_spending,
        MAX(DATE(t.created_at)) AS last_tx_date,
        MAX(t.created_at) AS last_tx_at
      FROM tr_transaction t
      WHERE t.customer_id = ?
        AND t.deleted_at IS NULL
        AND t.status != 'cancelled'
    `, [customerId]);

    const metrics = rows[0] || {};
    const txCount = Number(metrics.tx_count) || 0;
    const totalSpending = Number(metrics.total_spending) || 0;
    const lastTxDate = metrics.last_tx_date;
    const lastTxAt = metrics.last_tx_at;

    // Calculate average
    const avgAmount = txCount > 0 ? totalSpending / txCount : 0;

    // Calculate days since last transaction
    let daysSinceLastTx = 999;
    if (lastTxDate) {
      const lastDate = new Date(lastTxDate);
      const today = new Date();
      daysSinceLastTx = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
    }

    // Determine segment
    let segment = SEGMENT_CATEGORIES.NEW;
    if (txCount === 0) {
      segment = SEGMENT_CATEGORIES.NEW;
    } else if (txCount === 1) {
      segment = SEGMENT_CATEGORIES.ONE_TIME;
    } else if (txCount >= 2 && txCount <= 9 && daysSinceLastTx <= 60) {
      segment = SEGMENT_CATEGORIES.REGULAR;
    } else if (txCount >= 10 && daysSinceLastTx <= 30) {
      segment = SEGMENT_CATEGORIES.LOYAL;
    } else if (daysSinceLastTx > 60 && daysSinceLastTx <= 90) {
      segment = SEGMENT_CATEGORIES.AT_RISK;
    } else {
      segment = SEGMENT_CATEGORIES.INACTIVE;
    }

    return {
      txCount,
      totalSpending,
      avgAmount,
      lastTxDate,
      lastTxAt,
      daysSinceLastTx,
      segment,
    };
  } catch (err) {
    logger.error('Failed to calculate segment', { customerId, error: err.message, stack: err.stack });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update customer segmentation record
// Called after transaction checkout
// ─────────────────────────────────────────────────────────────────────────────
export async function updateCustomerSegmentation(customerId) {
  try {
    const metrics = await calculateCustomerSegment(customerId);

    await db.execute(`
      UPDATE mst_customer SET
        tx_count = ?,
        total_spending = ?,
        last_tx_date = ?,
        last_tx_at = ?,
        avg_tx_amount = ?,
        segment_category = ?,
        segment_updated_at = NOW()
      WHERE id = ?
    `, [
      metrics.txCount,
      metrics.totalSpending,
      metrics.lastTxDate,
      metrics.lastTxAt,
      metrics.avgAmount,
      metrics.segment,
      customerId,
    ]);

    logger.info('[segmentation]', 'Updated customer segment', {
      customerId,
      segment: metrics.segment,
      txCount: metrics.txCount,
    });

    return metrics;
  } catch (err) {
    logger.error('Failed to update customer segmentation', { customerId, error: err.message, stack: err.stack });
    // Don't throw - segmentation update is non-critical
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get customer segmentation summary
// ─────────────────────────────────────────────────────────────────────────────
export async function getSegmentationSummary() {
  try {
    const [rows] = await db.execute(`
      SELECT
        segment_category,
        COUNT(*) AS count,
        SUM(tx_count) AS total_transactions,
        SUM(total_spending) AS total_spending
      FROM mst_customer
      WHERE deleted_at IS NULL
      GROUP BY segment_category
      ORDER BY FIELD(segment_category, 'new', 'one_time', 'regular', 'loyal', 'at_risk', 'inactive')
    `);

    return rows.map(r => ({
      segment: r.segment_category,
      label: SEGMENT_LABELS[r.segment_category] || r.segment_category,
      color: SEGMENT_COLORS[r.segment_category] || '#6B7280',
      count: Number(r.count),
      totalTransactions: Number(r.total_transactions) || 0,
      totalSpending: Number(r.total_spending) || 0,
    }));
  } catch (err) {
    logger.error('Failed to get summary', { error: err.message, stack: err.stack });
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Get customers by segment
// ─────────────────────────────────────────────────────────────────────────────
export async function getCustomersBySegment(segment) {
  try {
    const [rows] = await db.execute(`
      SELECT
        c.id,
        c.name,
        c.phone,
        c.tx_count,
        c.total_spending,
        c.avg_tx_amount,
        c.last_tx_date,
        c.segment_category
      FROM mst_customer c
      WHERE c.deleted_at IS NULL
        AND c.segment_category = ?
      ORDER BY c.last_tx_date DESC
    `, [segment]);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      txCount: Number(r.tx_count),
      totalSpending: Number(r.total_spending),
      avgAmount: Number(r.avg_tx_amount),
      lastTxDate: r.last_tx_date,
      segment: r.segment_category,
    }));
  } catch (err) {
    logger.error('Failed to get customers by segment', { segment, error: err.message, stack: err.stack });
    return [];
  }
}
