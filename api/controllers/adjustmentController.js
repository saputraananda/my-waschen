import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { emitAdjustmentCreated, emitAdjustmentApproved, emitAdjustmentRejected } from '../services/eventBus.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Adjustment');

// ─── Adjustment Types ─────────────────────────────────────────────────────────────
const ADJUSTMENT_TYPES = {
  PRICE: 'price',
  QUANTITY: 'quantity',
  DISCOUNT: 'discount',
  CANCEL: 'cancel',
  PAYMENT: 'payment',
};

const ADJUSTMENT_ACTIONS = {
  CHARGE: 'charge',   // Pelanggan harus bayar tambahan
  REFUND: 'refund',   // Kasir harus refund
  NONE: 'none',        // Koreksi tanpa perubahan uang
};

// ─── Helper: Check if column exists ──────────────────────────────────────────
const hasColumn = async (tableName, columnName) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
       LIMIT 1`,
      [tableName, columnName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
};

// ─── Helper: Generate Adjustment ID ───────────────────────────────────────────
const generateAdjustmentNo = async (conn) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `ADJ-${yy}${mm}${dd}-`;

  const [rows] = await conn.execute(
    `SELECT adjustment_no FROM tr_transaction_adjustments
     WHERE adjustment_no LIKE ?
     ORDER BY adjustment_no DESC LIMIT 1 FOR UPDATE`,
    [`${datePrefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].adjustment_no;
    const lastSeqStr = lastNo.slice(datePrefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (Number.isFinite(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${datePrefix}${String(nextSeq).padStart(3, '0')}`;
};

// ─── POST /api/adjustments — Create Adjustment ─────────────────────────────────
export const createAdjustment = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const {
      transactionId,
      type,
      oldValue,
      newValue,
      reason,
      notes,
      action, // 'charge' | 'refund' | 'none'
      itemId, // optional, for item-level adjustments
    } = req.body;

    const { userId, outletId: tokenOutletId, name: userName } = req.user;

    // ── Validasi ─────────────────────────────────────────────────────────────
    if (!transactionId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Transaction ID wajib diisi' });
    }

    if (!type || !Object.values(ADJUSTMENT_TYPES).includes(type)) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Tipe adjustment tidak valid. Pilihan: price, quantity, discount, cancel, payment'
      });
    }

    if (oldValue === undefined || newValue === undefined) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Nilai lama dan baru wajib diisi' });
    }

    if (!reason || reason.trim().length < 5) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Alasan adjustment minimal 5 karakter' });
    }

    // Get transaction info
    const [txRows] = await conn.execute(
      `SELECT t.*, c.name as customer_name, c.phone as customer_phone,
              u.name as cashier_name, s.shift as shift_label
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       LEFT JOIN mst_user u ON t.cashier_id = u.id
       LEFT JOIN tr_cashier_session s ON t.session_id = s.id
       WHERE t.id = ?`,
      [transactionId]
    );

    if (txRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const tx = txRows[0];
    const outletId = tx.outlet_id || tokenOutletId;

    // Check if transaction belongs to user's outlet (boundary enforcement)
    if (tokenOutletId && tx.outlet_id && tx.outlet_id !== tokenOutletId) {
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Anda tidak dapat mengadjust transaksi dari outlet lain'
      });
    }

    // Check if transaction is not cancelled
    if (tx.status === 'cancelled') {
      conn.release();
      return res.status(400).json({ success: false, message: 'Transaksi sudah dibatalkan' });
    }

    // Calculate difference
    const difference = Number(newValue) - Number(oldValue);

    // Determine adjustment action if not provided
    let adjustmentAction = action;
    if (!adjustmentAction) {
      if (difference > 0) {
        adjustmentAction = ADJUSTMENT_ACTIONS.CHARGE;
      } else if (difference < 0) {
        adjustmentAction = ADJUSTMENT_ACTIONS.REFUND;
      } else {
        adjustmentAction = ADJUSTMENT_ACTIONS.NONE;
      }
    }

    // Generate adjustment number
    const adjustmentNo = await generateAdjustmentNo(conn);

    // Insert adjustment record
    const [insertResult] = await conn.execute(
      `INSERT INTO tr_transaction_adjustments (
        transaction_id, adjustment_no, type, old_value, new_value, difference,
        action, reason, notes, item_id,
        created_by, pic_name, outlet_id,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        transactionId,
        adjustmentNo,
        type,
        oldValue,
        newValue,
        difference,
        adjustmentAction,
        reason.trim(),
        notes?.trim() || null,
        itemId || null,
        userId,
        userName || 'Unknown',
        outletId,
      ]
    );

    const adjustmentId = insertResult.insertId;

    // Update transaction totals if adjustment affects pricing
    if (['price', 'quantity', 'discount'].includes(type)) {
      // Recalculate transaction total
      const newTotal = Math.max(0, Number(tx.total) + difference);
      await conn.execute(
        `UPDATE tr_transaction SET total = ?, updated_at = NOW() WHERE id = ?`,
        [newTotal, transactionId]
      );

      // Update paid_amount if needed based on action
      if (adjustmentAction === ADJUSTMENT_ACTIONS.CHARGE && tx.payment_status === 'paid') {
        // If was fully paid but now charges more, set to partial
        await conn.execute(
          `UPDATE tr_transaction SET payment_status = 'partial', updated_at = NOW() WHERE id = ?`,
          [transactionId]
        );
      } else if (adjustmentAction === ADJUSTMENT_ACTIONS.REFUND && tx.payment_status === 'paid') {
        // If refund on paid transaction, add to refund tracking
        await conn.execute(
          `UPDATE tr_transaction SET refund_amount = COALESCE(refund_amount, 0) + ? WHERE id = ?`,
          [Math.abs(difference), transactionId]
        );
      }
    }

    // If cancel type, mark transaction as pending cancellation
    if (type === ADJUSTMENT_TYPES.CANCEL) {
      await conn.execute(
        `UPDATE tr_transaction SET status = 'pending_cancellation', updated_at = NOW() WHERE id = ?`,
        [transactionId]
      );
    }

    await conn.commit();

    // Emit event
    emitAdjustmentCreated({
      adjustmentId,
      adjustmentNo,
      transactionId,
      transactionNo: tx.transaction_no,
      type,
      difference,
      action: adjustmentAction,
      createdBy: userName,
    });

    logger.info('[createAdjustment]', { adjustmentId, adjustmentNo, transactionId, type, difference });

    return res.status(201).json({
      success: true,
      message: 'Adjustment berhasil dibuat',
      data: {
        id: adjustmentId,
        adjustment_no: adjustmentNo,
        transaction_id: transactionId,
        type,
        old_value: oldValue,
        new_value: newValue,
        difference,
        action: adjustmentAction,
        reason,
        status: 'pending',
        created_by: userName,
        created_at: new Date().toISOString(),
      }
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[createAdjustment] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal membuat adjustment' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/adjustments ──────────────────────────────────────────────────────
export const getAdjustments = async (req, res) => {
  try {
    const { page = '1', limit = '20', outletId, status, type, dateFrom, dateTo, transactionNo } = req.query;
    const { userId, outletId: tokenOutletId, role } = req.user;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offsetNum = Math.max(0, (pageNum - 1) * limitNum);

    // Build WHERE clause
    const conditions = ['1=1'];
    const params = [];

    // Boundary: kasir can only see own outlet
    if (role === 'frontline') {
      if (tokenOutletId) {
        conditions.push('a.outlet_id = ?');
        params.push(tokenOutletId);
      }
    } else if (outletId) {
      conditions.push('a.outlet_id = ?');
      params.push(outletId);
    }

    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }

    if (type) {
      conditions.push('a.type = ?');
      params.push(type);
    }

    if (dateFrom) {
      conditions.push('DATE(a.created_at) >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('DATE(a.created_at) <= ?');
      params.push(dateTo);
    }

    if (transactionNo) {
      conditions.push('t.transaction_no LIKE ?');
      params.push(`%${transactionNo}%`);
    }

    const whereClause = conditions.join(' AND ');

    // Get adjustments with pagination
    // Use pool.query() instead of pool.execute() for LIMIT/OFFSET
    // MySQL prepared statements via execute() don't support ? placeholders for LIMIT/OFFSET
    const [rows] = await poolWaschenPos.query(
      `SELECT a.*, t.transaction_no, t.total as transaction_total,
              c.name as customer_name, u.name as created_by_name
       FROM tr_transaction_adjustments a
       JOIN tr_transaction t ON a.transaction_id = t.id
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       LEFT JOIN mst_user u ON a.created_by = u.id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ${limitNum} OFFSET ${offsetNum}`,
      params
    );

    // Get total count
    const [countResult] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total
       FROM tr_transaction_adjustments a
       WHERE ${whereClause}`,
      params
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limitNum),
      }
    });

  } catch (error) {
    logger.error('[getAdjustments] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data adjustment' });
  }
};

// ─── GET /api/adjustments/:id ────────────────────────────────────────────────
export const getAdjustmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, outletId: tokenOutletId, role } = req.user;

    const [rows] = await poolWaschenPos.execute(
      `SELECT a.*, t.transaction_no, t.total as transaction_total,
              t.paid_amount, t.payment_status, t.status as transaction_status,
              c.name as customer_name, c.phone as customer_phone,
              u.name as created_by_name,
              o.name as outlet_name
       FROM tr_transaction_adjustments a
       JOIN tr_transaction t ON a.transaction_id = t.id
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       LEFT JOIN mst_user u ON a.created_by = u.id
       LEFT JOIN mst_outlet o ON a.outlet_id = o.id
       WHERE a.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Adjustment tidak ditemukan' });
    }

    const adj = rows[0];

    // Boundary check
    if ((role === 'frontline') && tokenOutletId && adj.outlet_id !== tokenOutletId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    return res.json({ success: true, data: adj });

  } catch (error) {
    logger.error('[getAdjustmentById] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail adjustment' });
  }
};

// ─── GET /api/adjustments/transaction/:transactionId ──────────────────────────
export const getAdjustmentByTransactionId = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const [rows] = await poolWaschenPos.execute(
      `SELECT a.*, u.name as created_by_name
       FROM tr_transaction_adjustments a
       LEFT JOIN mst_user u ON a.created_by = u.id
       WHERE a.transaction_id = ?
       ORDER BY a.created_at DESC`,
      [transactionId]
    );

    return res.json({ success: true, data: rows });

  } catch (error) {
    logger.error('[getAdjustmentByTransactionId] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil adjustment' });
  }
};

// ─── GET /api/adjustments/audit ──────────────────────────────────────────────
export const getAdjustmentAuditTrail = async (req, res) => {
  try {
    const { page = '1', limit = '50', outletId, dateFrom, dateTo, action } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const offsetNum = Math.max(0, (pageNum - 1) * limitNum);
    const conditions = ['1=1'];
    const params = [];

    if (outletId) {
      conditions.push('a.outlet_id = ?');
      params.push(outletId);
    }

    if (dateFrom) {
      conditions.push('DATE(a.created_at) >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('DATE(a.created_at) <= ?');
      params.push(dateTo);
    }

    if (action) {
      conditions.push('a.action = ?');
      params.push(action);
    }

    const whereClause = conditions.join(' AND ');

    // Use pool.query() instead of pool.execute() for LIMIT/OFFSET
    // MySQL prepared statements via execute() don't support ? placeholders for LIMIT/OFFSET
    const [rows] = await poolWaschenPos.query(
      `SELECT a.*, t.transaction_no, o.name as outlet_name,
              c.name as customer_name, u.name as created_by_name,
              au.name as approved_by_name
       FROM tr_transaction_adjustments a
       JOIN tr_transaction t ON a.transaction_id = t.id
       LEFT JOIN mst_outlet o ON a.outlet_id = o.id
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       LEFT JOIN mst_user u ON a.created_by = u.id
       LEFT JOIN mst_user au ON a.approved_by = au.id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ${limitNum} OFFSET ${offsetNum}`,
      params
    );

    const [countResult] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total FROM tr_transaction_adjustments a WHERE ${whereClause}`,
      params
    );

    // Calculate summary
    const [summary] = await poolWaschenPos.execute(
      `SELECT
        COUNT(*) as total_adjustments,
        SUM(CASE WHEN a.action = 'charge' THEN a.difference ELSE 0 END) as total_charge,
        SUM(CASE WHEN a.action = 'refund' THEN ABS(a.difference) ELSE 0 END) as total_refund,
        SUM(CASE WHEN a.status = 'approved' THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN a.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
       FROM tr_transaction_adjustments a
       WHERE ${whereClause}`,
      params
    );

    return res.json({
      success: true,
      data: rows,
      summary: summary[0],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limitNum),
      }
    });

  } catch (error) {
    logger.error('[getAdjustmentAuditTrail] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil audit trail' });
  }
};

// ─── PATCH /api/adjustments/:id/approve ──────────────────────────────────────
export const approveAdjustment = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { userId, name: userName } = req.user;

    // Get adjustment
    const [adjRows] = await conn.execute(
      `SELECT a.*, t.total as transaction_total, t.paid_amount, t.payment_status
       FROM tr_transaction_adjustments a
       JOIN tr_transaction t ON a.transaction_id = t.id
       WHERE a.id = ?`,
      [id]
    );

    if (adjRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Adjustment tidak ditemukan' });
    }

    const adj = adjRows[0];

    if (adj.status !== 'pending') {
      conn.release();
      return res.status(400).json({ success: false, message: 'Adjustment sudah diproses' });
    }

    // Update adjustment status
    await conn.execute(
      `UPDATE tr_transaction_adjustments
       SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [userId, id]
    );

    // If adjustment affects transaction totals, finalize the update
    if (adj.type !== 'cancel') {
      const newTotal = Math.max(0, Number(adj.transaction_total) + Number(adj.difference));
      await conn.execute(
        `UPDATE tr_transaction SET total = ?, updated_at = NOW() WHERE id = ?`,
        [newTotal, adj.transaction_id]
      );
    } else {
      // For cancel type, mark transaction as cancelled
      await conn.execute(
        `UPDATE tr_transaction SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
        [adj.transaction_id]
      );
    }

    await conn.commit();

    // Emit event
    emitAdjustmentApproved({
      adjustmentId: id,
      adjustmentNo: adj.adjustment_no,
      transactionId: adj.transaction_id,
      approvedBy: userName,
    });

    logger.info('[approveAdjustment]', { id, adjustmentNo: adj.adjustment_no, approvedBy: userName });

    return res.json({
      success: true,
      message: 'Adjustment berhasil diapprove',
      data: { id, status: 'approved', approved_by: userName, approved_at: new Date().toISOString() }
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[approveAdjustment] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal approve adjustment' });
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/adjustments/:id/reject ──────────────────────────────────────
export const rejectAdjustment = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { userId, name: userName } = req.user;
    const { reason } = req.body;

    // Get adjustment
    const [adjRows] = await conn.execute(
      `SELECT * FROM tr_transaction_adjustments WHERE id = ?`,
      [id]
    );

    if (adjRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Adjustment tidak ditemukan' });
    }

    const adj = adjRows[0];

    if (adj.status !== 'pending') {
      conn.release();
      return res.status(400).json({ success: false, message: 'Adjustment sudah diproses' });
    }

    // Update adjustment status
    await conn.execute(
      `UPDATE tr_transaction_adjustments
       SET status = 'rejected', approved_by = ?, approved_at = NOW(),
           notes = CONCAT(IFNULL(notes, ''), '\nRejected: ', ?),
           updated_at = NOW()
       WHERE id = ?`,
      [userId, reason || 'No reason provided', id]
    );

    await conn.commit();

    emitAdjustmentRejected({
      adjustmentId: id,
      adjustmentNo: adj.adjustment_no,
      transactionId: adj.transaction_id,
      rejectedBy: userName,
      reason,
    });

    logger.info('[rejectAdjustment]', { id, adjustmentNo: adj.adjustment_no, rejectedBy: userName });

    return res.json({
      success: true,
      message: 'Adjustment berhasil ditolak',
      data: { id, status: 'rejected', rejected_by: userName }
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[rejectAdjustment] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal reject adjustment' });
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/adjustments/:id/rollback ──────────────────────────────────────
export const rollbackAdjustment = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { userId, name: userName } = req.user;
    const { reason } = req.body;

    // Get adjustment
    const [adjRows] = await conn.execute(
      `SELECT a.*, t.total as transaction_total
       FROM tr_transaction_adjustments a
       JOIN tr_transaction t ON a.transaction_id = t.id
       WHERE a.id = ?`,
      [id]
    );

    if (adjRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Adjustment tidak ditemukan' });
    }

    const adj = adjRows[0];

    if (!adj.can_rollback) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Adjustment tidak dapat di-rollback' });
    }

    // Rollback: reverse the adjustment
    await conn.execute(
      `UPDATE tr_transaction
       SET total = total - ?, updated_at = NOW()
       WHERE id = ?`,
      [adj.difference, adj.transaction_id]
    );

    // Mark adjustment as rolled back
    await conn.execute(
      `UPDATE tr_transaction_adjustments
       SET status = 'rolled_back', rolled_back_at = NOW(),
           notes = CONCAT(IFNULL(notes, ''), '\nRolled back: ', ?),
           updated_at = NOW()
       WHERE id = ?`,
      [reason || `Rolled back by ${userName}`, id]
    );

    await conn.commit();

    logger.info('[rollbackAdjustment]', { id, adjustmentNo: adj.adjustment_no, rolledBackBy: userName });

    return res.json({
      success: true,
      message: 'Adjustment berhasil di-rollback',
      data: { id, status: 'rolled_back', rolled_back_at: new Date().toISOString() }
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[rollbackAdjustment] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal rollback adjustment' });
  } finally {
    conn.release();
  }
};
