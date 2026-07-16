// ─────────────────────────────────────────────────────────────────────────────
// refundController.js — Comprehensive Refund Workflow System
// Phase 5-7: Refund Workflows with Approval Flow
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { rp } from '../utils/helpers.js';
import logger from '../utils/logger.js';

// ─── Helper: Get config value ────────────────────────────────────────────────
async function getConfig(key, defaultValue = null) {
  try {
    const [[row]] = await poolWaschenPos.execute(
      'SELECT config_val FROM mst_app_config WHERE config_key = ? AND is_active = 1 LIMIT 1',
      [key]
    );
    return row?.config_val ?? defaultValue;
  } catch (err) {
    logger.warn('[getConfig]', key, err?.message);
    return defaultValue;
  }
}

// ─── Helper: Generate refund number ─────────────────────────────────────────────
async function generateRefundNo() {
  const prefix = 'REF';
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const [rows] = await poolWaschenPos.execute(
    `SELECT COUNT(*) as count FROM tr_refund_request WHERE DATE(created_at) = CURDATE() AND deleted_at IS NULL`
  );
  const seq = String((rows[0]?.count || 0) + 1).padStart(4, '0');
  return `${prefix}-${dateStr}-${seq}`;
}

// ─── STATUS & REASON MAPS ─────────────────────────────────────────────────────
const REFUND_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PROCESSED: 'processed',
  CANCELLED: 'cancelled',
};

const REFUND_REASONS = {
  'produk_rusak': 'Produk Rusak / Cacat',
  'salah_layanan': 'Salah Layanan',
  'tidak_sesuai': 'Tidak Sesuai Pesanan',
  'batal_order': 'Batal Order',
  'double_charge': 'Double Charge',
  'retur_barang': 'Retur Barang',
  'kompensasi': 'Kompensasi',
  'lainnya': 'Lainnya',
};

// ─── GET /api/refunds — List refund requests ──────────────────────────────────
export const listRefunds = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      search,
      fromDate,
      toDate,
      outletId,
    } = req.query;

    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobal = ['admin'].includes(userRole);

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let where = 'r.deleted_at IS NULL';
    const params = [];

    // Status filter
    if (status && Object.values(REFUND_STATUS).includes(status)) {
      where += ' AND r.status = ?';
      params.push(status);
    }

    // Outlet filter
    if (!isGlobal) {
      where += ' AND r.outlet_id = ?';
      params.push(userOutletId);
    } else if (outletId) {
      where += ' AND r.outlet_id = ?';
      params.push(outletId);
    }

    // Date range
    if (fromDate) {
      where += ' AND DATE(r.created_at) >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      where += ' AND DATE(r.created_at) <= ?';
      params.push(toDate);
    }

    // Search (refund no, transaction no, customer name)
    if (search && search.trim()) {
      where += ' AND (r.refund_no LIKE ? OR t.transaction_no LIKE ? OR c.name LIKE ?)';
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }

    // Count total
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total FROM tr_refund_request r
       LEFT JOIN tr_transaction t ON t.id = r.transaction_id
       LEFT JOIN mst_customer c ON c.id = r.customer_id
       WHERE ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Fetch refund requests
    const [rows] = await poolWaschenPos.execute(
      `SELECT r.*,
              t.transaction_no AS transactionNo,
              t.total AS transactionTotal,
              t.paid_amount AS paidAmount,
              c.name AS customerName,
              c.phone AS customerPhone,
              o.name AS outletName,
              req_user.name AS requestedByName,
              appr_user.name AS approvedByName,
              proc_user.name AS processedByName
       FROM tr_refund_request r
       LEFT JOIN tr_transaction t ON t.id = r.transaction_id
       LEFT JOIN mst_customer c ON c.id = r.customer_id
       LEFT JOIN mst_outlet o ON o.id = r.outlet_id
       LEFT JOIN mst_user req_user ON req_user.id = r.requested_by
       LEFT JOIN mst_user appr_user ON appr_user.id = r.approved_by
       LEFT JOIN mst_user proc_user ON proc_user.id = r.processed_by
       WHERE ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        refundAmount: Number(r.refund_amount || 0),
        transactionTotal: Number(r.transactionTotal || 0),
        paidAmount: Number(r.paidAmount || 0),
        reasonLabel: REFUND_REASONS[r.reason] || r.reason || 'Lainnya',
        statusLabel: r.status.charAt(0).toUpperCase() + r.status.slice(1),
        canApprove: r.status === REFUND_STATUS.PENDING,
        canProcess: r.status === REFUND_STATUS.APPROVED,
        canCancel: r.status === REFUND_STATUS.PENDING,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    logger.error('Gagal memuat daftar refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar refund.' });
  }
};

// ─── GET /api/refunds/:id — Get refund detail ─────────────────────────────────
export const getRefundById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await poolWaschenPos.execute(
      `SELECT r.*,
              t.transaction_no AS transactionNo,
              t.total AS transactionTotal,
              t.paid_amount AS paidAmount,
              t.payment_status AS paymentStatus,
              t.created_at AS transactionDate,
              c.name AS customerName,
              c.phone AS customerPhone,
              o.name AS outletName,
              req_user.name AS requestedByName,
              appr_user.name AS approvedByName,
              proc_user.name AS processedByName
       FROM tr_refund_request r
       LEFT JOIN tr_transaction t ON t.id = r.transaction_id
       LEFT JOIN mst_customer c ON c.id = r.customer_id
       LEFT JOIN mst_outlet o ON o.id = r.outlet_id
       LEFT JOIN mst_user req_user ON req_user.id = r.requested_by
       LEFT JOIN mst_user appr_user ON appr_user.id = r.approved_by
       LEFT JOIN mst_user proc_user ON proc_user.id = r.processed_by
       WHERE r.id = ? AND r.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Refund tidak ditemukan.' });
    }

    const r = rows[0];

    // Get refund items if any
    const [items] = await poolWaschenPos.execute(
      `SELECT ri.*, s.name AS serviceName
       FROM tr_refund_item ri
       LEFT JOIN mst_service s ON s.id = ri.service_id
       WHERE ri.refund_id = ?`,
      [id]
    );

    // Get transaction items
    const [txItems] = await poolWaschenPos.execute(
      `SELECT ti.*, s.name AS serviceName
       FROM tr_transaction_item ti
       LEFT JOIN mst_service s ON s.id = ti.service_id
       WHERE ti.transaction_id = ? AND ti.is_active = 1`,
      [r.transaction_id]
    );

    return res.json({
      success: true,
      data: {
        ...r,
        refundAmount: Number(r.refund_amount || 0),
        transactionTotal: Number(r.transactionTotal || 0),
        paidAmount: Number(r.paidAmount || 0),
        reasonLabel: REFUND_REASONS[r.reason] || r.reason || 'Lainnya',
        statusLabel: r.status.charAt(0).toUpperCase() + r.status.slice(1),
        items: items.map(i => ({
          ...i,
          amount: Number(i.amount || 0),
          refundQty: Number(i.refund_qty || 0),
        })),
        transactionItems: txItems.map(i => ({
          ...i,
          qty: Number(i.qty || 0),
          price: Number(i.price || 0),
          subtotal: Number(i.subtotal || 0),
        })),
        canApprove: r.status === REFUND_STATUS.PENDING,
        canProcess: r.status === REFUND_STATUS.APPROVED,
        canCancel: r.status === REFUND_STATUS.PENDING,
      },
    });
  } catch (err) {
    logger.error('Gagal memuat detail refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat detail refund.' });
  }
};

// ─── POST /api/refunds — Create refund request ───────────────────────────────
export const createRefund = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const {
      transactionId,
      refundAmount,
      reason,
      reasonDetail,
      items,
      notes,
    } = req.body;

    // Validation
    if (!transactionId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Transaction ID wajib diisi.' });
    }

    if (!refundAmount || Number(refundAmount) <= 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Jumlah refund wajib diisi.' });
    }

    if (!reason || !REFUND_REASONS[reason]) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Alasan refund wajib dipilih.' });
    }

    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;

    await conn.beginTransaction();

    // Get transaction
    const [txRows] = await conn.execute(
      `SELECT t.*, c.name AS customerName
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.id = ? AND t.deleted_at IS NULL`,
      [transactionId]
    );

    if (txRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const tx = txRows[0];

    // Check if refund already exists for this transaction
    const [existingRef] = await conn.execute(
      `SELECT id, status FROM tr_refund_request
       WHERE transaction_id = ? AND status NOT IN (?, ?)
       AND deleted_at IS NULL`,
      [transactionId, REFUND_STATUS.REJECTED, REFUND_STATUS.CANCELLED]
    );

    if (existingRef.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        success: false,
        message: `Sudah ada request refund untuk transaksi ini dengan status "${existingRef[0].status}".`
      });
    }

    // Check refund amount limit
    const maxRefundPct = Number(await getConfig('max_refund_percentage', 100));
    const maxAmount = (Number(tx.total) * maxRefundPct) / 100;
    if (Number(refundAmount) > maxAmount) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Maksimal refund adalah ${maxRefundPct}% dari total transaksi (${rp(maxAmount)}).`
      });
    }

    // Determine approval requirement
    const autoApproveThreshold = Number(await getConfig('auto_approve_refund_threshold', 50000));
    const needsApproval = Number(refundAmount) > autoApproveThreshold ||
      !userRole !== 'admin';

    const refundNo = await generateRefundNo();
    const status = needsApproval ? REFUND_STATUS.PENDING : REFUND_STATUS.APPROVED;

    // Create refund request
    const [result] = await conn.execute(
      `INSERT INTO tr_refund_request (
        refund_no, transaction_id, customer_id, outlet_id,
        refund_amount, reason, reason_detail, notes,
        status, requested_by, approved_by, processed_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        refundNo,
        transactionId,
        tx.customer_id,
        tx.outlet_id || userOutletId,
        Number(refundAmount),
        reason,
        reasonDetail || null,
        notes || null,
        status,
        userId,
        needsApproval ? null : userId, // Auto-approve if below threshold and has permission
        null,
      ]
    );

    const refundId = result.insertId;

    // Create refund items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await conn.execute(
          `INSERT INTO tr_refund_item (
            refund_id, transaction_item_id, service_id, service_name,
            qty, unit_price, amount, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            refundId,
            item.transactionItemId || null,
            item.serviceId || null,
            item.serviceName || 'Layanan',
            item.refundQty || 1,
            item.unitPrice || 0,
            item.amount || 0,
          ]
        );
      }
    }

    // If auto-approved, update transaction and process refund
    if (!needsApproval) {
      // Update transaction status
      await conn.execute(
        `UPDATE tr_transaction
         SET refund_status = 'refunded',
             refunded_amount = COALESCE(refunded_amount, 0) + ?,
             refunded_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [Number(refundAmount), transactionId]
      );

      // Update refund request to processed
      await conn.execute(
        `UPDATE tr_refund_request
         SET status = ?,
             processed_by = ?,
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [REFUND_STATUS.PROCESSED, userId, refundId]
      );

      // Log wallet refund if customer has wallet
      const [wallet] = await conn.execute(
        'SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1',
        [tx.customer_id]
      );
      if (wallet.length > 0) {
        await conn.execute(
          `UPDATE mst_customer_wallet
           SET balance = balance + ?, updated_at = NOW()
           WHERE customer_id = ?`,
          [Number(refundAmount), tx.customer_id]
        );
        await conn.execute(
          `INSERT INTO tr_wallet_ledger (
            customer_id, type, amount, balance_after, description, created_by, created_at
          ) VALUES (?, 'refund', ?, (SELECT balance FROM mst_customer_wallet WHERE customer_id = ?), ?, ?, NOW())`,
          [tx.customer_id, Number(refundAmount), tx.customer_id, `Refund ${refundNo}`, userId]
        );
      }
    }

    await conn.commit();

    // Audit log
    writeAudit(poolWaschenPos, {
      userId,
      outletId: tx.outlet_id || userOutletId,
      entityType: 'refund_request',
      entityId: refundId,
      action: 'create_refund',
      newData: { refundNo, refundAmount: Number(refundAmount), reason, status },
      req,
    }).catch(err => logger.error('[createRefund] writeAudit gagal:', err));

    return res.status(201).json({
      success: true,
      message: needsApproval
        ? `Request refund ${refundNo} berhasil. Menunggu persetujuan.`
        : `Refund ${refundNo} berhasil diproses. Dana sudah dikembalikan ke deposit customer.`,
      data: {
        id: refundId,
        refundNo,
        refundAmount: Number(refundAmount),
        status: needsApproval ? REFUND_STATUS.PENDING : REFUND_STATUS.PROCESSED,
        statusLabel: needsApproval ? 'Pending' : 'Processed',
        needsApproval,
      },
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Gagal membuat request refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal membuat request refund.' });
  } finally {
    conn.release();
  }
};

// ─── POST /api/refunds/:id/approve — Approve refund request ─────────────────
export const approveRefund = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { approvedAmount, notes } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    // Only admin/superadmin/owner can approve
    if (!['admin'].includes(userRole)) {
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat menyetujui refund.' });
    }

    await conn.beginTransaction();

    // Get refund request
    const [rows] = await conn.execute(
      `SELECT r.*, t.total AS transactionTotal, t.customer_id
       FROM tr_refund_request r
       JOIN tr_transaction t ON t.id = r.transaction_id
       WHERE r.id = ? AND r.deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Refund tidak ditemukan.' });
    }

    const refund = rows[0];

    if (refund.status !== REFUND_STATUS.PENDING) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Refund sudah berstatus "${refund.status}". Tidak dapat disetujui.`
      });
    }

    const finalAmount = approvedAmount !== undefined ? Number(approvedAmount) : Number(refund.refund_amount);

    // Validate approved amount
    if (finalAmount > Number(refund.transactionTotal)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Jumlah refund tidak boleh melebihi total transaksi.'
      });
    }

    // Update refund request
    await conn.execute(
      `UPDATE tr_refund_request
       SET status = ?,
           approved_by = ?,
           approved_amount = ?,
           notes = COALESCE(?, notes),
           updated_at = NOW()
       WHERE id = ?`,
      [REFUND_STATUS.APPROVED, userId, finalAmount, notes, id]
    );

    await conn.commit();

    // Audit log
    writeAudit(poolWaschenPos, {
      userId,
      outletId: refund.outlet_id,
      entityType: 'refund_request',
      entityId: id,
      action: 'approve_refund',
      newData: { refundNo: refund.refund_no, approvedAmount: finalAmount },
      req,
    }).catch(err => logger.error('[approveRefund] writeAudit gagal:', err));

    return res.json({
      success: true,
      message: `Refund ${refund.refund_no} berhasil disetujui.`,
      data: {
        id: refund.id,
        refundNo: refund.refund_no,
        approvedAmount: finalAmount,
        status: REFUND_STATUS.APPROVED,
      },
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Gagal menyetujui refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menyetujui refund.' });
  } finally {
    conn.release();
  }
};

// ─── POST /api/refunds/:id/reject — Reject refund request ────────────────────
export const rejectRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    if (!['admin'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat menolak refund.' });
    }

    // Get refund
    const [rows] = await poolWaschenPos.execute(
      `SELECT r.* FROM tr_refund_request r WHERE r.id = ? AND r.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Refund tidak ditemukan.' });
    }

    if (rows[0].status !== REFUND_STATUS.PENDING) {
      return res.status(400).json({ success: false, message: 'Hanya refund berstatus Pending yang dapat ditolak.' });
    }

    await poolWaschenPos.execute(
      `UPDATE tr_refund_request
       SET status = ?,
           rejection_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [REFUND_STATUS.REJECTED, reason || null, id]
    );

    writeAudit(poolWaschenPos, {
      userId,
      entityType: 'refund_request',
      entityId: id,
      action: 'reject_refund',
      newData: { refundNo: rows[0].refund_no, reason },
      req,
    }).catch(err => logger.error('[rejectRefund] writeAudit gagal:', err));

    return res.json({
      success: true,
      message: `Refund ${rows[0].refund_no} ditolak.`,
    });
  } catch (err) {
    logger.error('Gagal menolak refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menolak refund.' });
  }
};

// ─── POST /api/refunds/:id/process — Process approved refund ─────────────────
export const processRefund = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    if (!['admin'].includes(userRole)) {
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat memproses refund.' });
    }

    await conn.beginTransaction();

    // Get refund request
    const [rows] = await conn.execute(
      `SELECT r.*, t.customer_id
       FROM tr_refund_request r
       JOIN tr_transaction t ON t.id = r.transaction_id
       WHERE r.id = ? AND r.deleted_at IS NULL
       FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Refund tidak ditemukan.' });
    }

    const refund = rows[0];

    if (refund.status !== REFUND_STATUS.APPROVED) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Refund harus berstatus Approved sebelum diproses. Status saat ini: "${refund.status}"`
      });
    }

    const refundAmount = Number(refund.approved_amount || refund.refund_amount);

    // Update transaction
    await conn.execute(
      `UPDATE tr_transaction
       SET refund_status = 'refunded',
           refunded_amount = COALESCE(refunded_amount, 0) + ?,
           refunded_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [refundAmount, refund.transaction_id]
    );

    // Update refund request
    await conn.execute(
      `UPDATE tr_refund_request
       SET status = ?,
           processed_by = ?,
           processed_at = NOW(),
           notes = COALESCE(?, notes),
           updated_at = NOW()
       WHERE id = ?`,
      [REFUND_STATUS.PROCESSED, userId, notes, id]
    );

    // Refund to customer wallet
    const [wallet] = await conn.execute(
      'SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1',
      [refund.customer_id]
    );

    if (wallet.length > 0) {
      await conn.execute(
        `UPDATE mst_customer_wallet
         SET balance = balance + ?, updated_at = NOW()
         WHERE customer_id = ?`,
        [refundAmount, refund.customer_id]
      );

      await conn.execute(
        `INSERT INTO tr_wallet_ledger (
          customer_id, type, amount, balance_after, description, created_by, created_at
        ) VALUES (?, 'refund', ?, (SELECT balance FROM mst_customer_wallet WHERE customer_id = ?), ?, ?, NOW())`,
        [refund.customer_id, refundAmount, refund.customer_id, `Refund ${refund.refund_no}`, userId]
      );
    }

    await conn.commit();

    writeAudit(poolWaschenPos, {
      userId,
      outletId: refund.outlet_id,
      entityType: 'refund_request',
      entityId: id,
      action: 'process_refund',
      newData: { refundNo: refund.refund_no, amount: refundAmount },
      req,
    }).catch(err => logger.error('[processRefund] writeAudit gagal:', err));

    return res.json({
      success: true,
      message: `Refund ${refund.refund_no} berhasil diproses. Dana sudah dikembalikan ke deposit customer.`,
      data: {
        refundAmount,
        customerId: refund.customer_id,
        status: REFUND_STATUS.PROCESSED,
      },
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Gagal memproses refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memproses refund.' });
  } finally {
    conn.release();
  }
};

// ─── POST /api/refunds/:id/cancel — Cancel refund request ─────────────────────
export const cancelRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    // Get refund
    const [rows] = await poolWaschenPos.execute(
      `SELECT r.*, r.requested_by AS requesterId FROM tr_refund_request r WHERE r.id = ? AND r.deleted_at IS NULL`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Refund tidak ditemukan.' });
    }

    const refund = rows[0];

    if (refund.status !== REFUND_STATUS.PENDING) {
      return res.status(400).json({ success: false, message: 'Hanya refund Pending yang dapat dibatalkan.' });
    }

    // Only requester or admin can cancel
    const canCancel = String(refund.requesterId) === String(userId) || userRole === 'admin';
    if (!canCancel) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak untuk membatalkan refund ini.' });
    }

    await poolWaschenPos.execute(
      `UPDATE tr_refund_request
       SET status = ?,
           cancellation_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [REFUND_STATUS.CANCELLED, reason || null, id]
    );

    writeAudit(poolWaschenPos, {
      userId,
      entityType: 'refund_request',
      entityId: id,
      action: 'cancel_refund',
      newData: { refundNo: refund.refund_no, reason },
      req,
    }).catch(err => logger.error('[cancelRefund] writeAudit gagal:', err));

    return res.json({
      success: true,
      message: `Refund ${refund.refund_no} berhasil dibatalkan.`,
    });
  } catch (err) {
    logger.error('Gagal membatalkan refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal membatalkan refund.' });
  }
};

// ─── GET /api/refunds/stats — Refund statistics ───────────────────────────────
export const getRefundStats = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobal = ['admin'].includes(userRole);

    const outletFilter = isGlobal ? '' : 'AND r.outlet_id = ?';
    const params = isGlobal ? [] : [userOutletId];

    // Status counts
    const [statusCounts] = await poolWaschenPos.execute(
      `SELECT status, COUNT(*) as count
       FROM tr_refund_request
       WHERE deleted_at IS NULL ${outletFilter}
       GROUP BY status`,
      params
    );

    // Total refund amount
    const [amountStats] = await poolWaschenPos.execute(
      `SELECT
         COALESCE(SUM(refund_amount), 0) AS totalAmount,
         COALESCE(SUM(CASE WHEN status = 'processed' THEN refund_amount ELSE 0 END), 0) AS processedAmount,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN refund_amount ELSE 0 END), 0) AS pendingAmount,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN refund_amount ELSE 0 END), 0) AS approvedAmount
       FROM tr_refund_request
       WHERE deleted_at IS NULL ${outletFilter}
         AND YEAR(created_at) = YEAR(CURDATE())`,
      params
    );

    // Monthly trend (last 6 months)
    const [monthlyTrend] = await poolWaschenPos.execute(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS month,
         COUNT(*) AS count,
         COALESCE(SUM(refund_amount), 0) AS amount
       FROM tr_refund_request
       WHERE deleted_at IS NULL
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       ${outletFilter}
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC`,
      params
    );

    // Top refund reasons
    const [topReasons] = await poolWaschenPos.execute(
      `SELECT reason, COUNT(*) as count, COALESCE(SUM(refund_amount), 0) as amount
       FROM tr_refund_request
       WHERE deleted_at IS NULL ${outletFilter}
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 5`,
      params
    );

    const statusMap = {};
    statusCounts.forEach(s => { statusMap[s.status] = Number(s.count); });

    return res.json({
      success: true,
      data: {
        statusCounts: {
          pending: statusMap[REFUND_STATUS.PENDING] || 0,
          approved: statusMap[REFUND_STATUS.APPROVED] || 0,
          processed: statusMap[REFUND_STATUS.PROCESSED] || 0,
          rejected: statusMap[REFUND_STATUS.REJECTED] || 0,
          cancelled: statusMap[REFUND_STATUS.CANCELLED] || 0,
          total: Object.values(statusMap).reduce((a, b) => a + b, 0),
        },
        amounts: {
          total: Number(amountStats[0]?.totalAmount || 0),
          processed: Number(amountStats[0]?.processedAmount || 0),
          pending: Number(amountStats[0]?.pendingAmount || 0),
          approved: Number(amountStats[0]?.approvedAmount || 0),
        },
        monthlyTrend,
        topReasons: topReasons.map(r => ({
          reason: REFUND_REASONS[r.reason] || r.reason,
          count: Number(r.count),
          amount: Number(r.amount),
        })),
      },
    });
  } catch (err) {
    logger.error('Gagal memuat statistik refund', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik refund.' });
  }
};
