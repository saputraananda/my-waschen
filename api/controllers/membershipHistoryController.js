// ─────────────────────────────────────────────────────────────────────────────
// membershipHistoryController.js — Membership History Tracking
// Records all membership actions for audit and history
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';
import logger from '../utils/logger.js';

/**
 * Record a membership history entry
 * @param {Object} conn - Database connection (for transaction)
 * @param {Object} params - History params
 */
export async function recordMembershipHistory(conn, params) {
  const {
    customerId,
    membershipId = null,
    action,
    oldTier = null,
    newTier = null,
    oldExpiredAt = null,
    newExpiredAt = null,
    oldStatus = null,
    newStatus = null,
    amount = null,
    bonus = null,
    notes = null,
    createdBy = null,
    picId = null,
    picName = null,
  } = params;

  try {
    const [result] = await conn.execute(
      `INSERT INTO tr_membership_history
        (customer_id, membership_id, action, old_tier, new_tier,
         old_expired_at, new_expired_at, old_status, new_status,
         amount, bonus, notes, created_by, pic_id, pic_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        membershipId,
        action,
        oldTier,
        newTier,
        oldExpiredAt,
        newExpiredAt,
        oldStatus,
        newStatus,
        amount,
        bonus,
        notes,
        createdBy,
        picId,
        picName,
      ]
    );
    logger.info('[membershipHistory]', 'Recorded', { action, customerId, newTier });
    return result.insertId;
  } catch (err) {
    logger.error('Failed to record', { error: err.message, action, customerId });
    // Don't throw - history recording should not block main operations
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/membership-history/:customerId
// Get membership history for a customer
// ─────────────────────────────────────────────────────────────────────────────
export async function getCustomerHistory(req, res) {
  try {
    const { customerId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [rows] = await db.execute(
      `SELECT
        h.id,
        h.action,
        h.old_tier AS oldTier,
        h.new_tier AS newTier,
        h.old_expired_at AS oldExpiredAt,
        h.new_expired_at AS newExpiredAt,
        h.old_status AS oldStatus,
        h.new_status AS newStatus,
        h.amount,
        h.bonus,
        h.notes,
        h.created_at AS createdAt,
        h.pic_id AS picId,
        h.pic_name AS picName,
        u.name AS createdByName
       FROM tr_membership_history h
       LEFT JOIN mst_user u ON u.id = h.created_by
       WHERE h.customer_id = ?
       ORDER BY h.created_at DESC
       LIMIT ? OFFSET ?`,
      [customerId, Math.min(Number(limit), 100), Number(offset)]
    );

    // Get total count
    const [[countRow]] = await db.execute(
      'SELECT COUNT(*) AS total FROM tr_membership_history WHERE customer_id = ?',
      [customerId]
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        amount: r.amount != null ? Number(r.amount) : null,
        bonus: r.bonus != null ? Number(r.bonus) : null,
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: Number(countRow?.total || 0),
      },
    });
  } catch (err) {
    logger.error('Failed to get history', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat membership.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/membership-history
// Get all membership history (admin)
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllHistory(req, res) {
  try {
    const userRole = req.user?.roleCode;
    const isAdmin = userRole !== 'admin';

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Hanya admin yang bisa melihat semua riwayat.' });
    }

    const { limit = 50, offset = 0, action, customerId, startDate, endDate } = req.query;

    let where = '1=1';
    const params = [];

    if (action) {
      where += ' AND h.action = ?';
      params.push(action);
    }
    if (customerId) {
      where += ' AND h.customer_id = ?';
      params.push(Number(customerId));
    }
    if (startDate) {
      where += ' AND DATE(h.created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND DATE(h.created_at) <= ?';
      params.push(endDate);
    }

    const [rows] = await db.execute(
      `SELECT
        h.id,
        h.customer_id AS customerId,
        c.name AS customerName,
        c.phone AS customerPhone,
        h.action,
        h.old_tier AS oldTier,
        h.new_tier AS newTier,
        h.old_expired_at AS oldExpiredAt,
        h.new_expired_at AS newExpiredAt,
        h.old_status AS oldStatus,
        h.new_status AS newStatus,
        h.amount,
        h.bonus,
        h.notes,
        h.created_at AS createdAt,
        h.pic_id AS picId,
        h.pic_name AS picName,
        u.name AS createdByName
       FROM tr_membership_history h
       LEFT JOIN mst_customer c ON c.id = h.customer_id
       LEFT JOIN mst_user u ON u.id = h.created_by
       WHERE ${where}
       ORDER BY h.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(Number(limit), 100), Number(offset)]
    );

    const [[countRow]] = await db.execute(
      `SELECT COUNT(*) AS total FROM tr_membership_history h WHERE ${where}`,
      params
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        amount: r.amount != null ? Number(r.amount) : null,
        bonus: r.bonus != null ? Number(r.bonus) : null,
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: Number(countRow?.total || 0),
      },
    });
  } catch (err) {
    logger.error('Failed to get all history', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat membership.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/membership-history/stats
// Get membership history statistics
// ─────────────────────────────────────────────────────────────────────────────
export async function getHistoryStats(req, res) {
  try {
    const userRole = req.user?.roleCode;
    const isAdmin = userRole !== 'admin';

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Hanya admin.' });
    }

    const [rows] = await db.execute(
      `SELECT
        action,
        COUNT(*) AS count,
        SUM(COALESCE(amount, 0)) AS totalAmount,
        SUM(COALESCE(bonus, 0)) AS totalBonus
       FROM tr_membership_history
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY action`
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        action: r.action,
        count: Number(r.count),
        totalAmount: Number(r.totalAmount || 0),
        totalBonus: Number(r.totalBonus || 0),
      })),
    });
  } catch (err) {
    logger.error('Failed to get stats', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik.' });
  }
}
