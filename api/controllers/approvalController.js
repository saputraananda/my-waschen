import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';

const schemaColumnCache = new Map();
const hasColumn = async (tableName, columnName) => {
  const key = `${tableName}.${columnName}`;
  if (schemaColumnCache.has(key)) return schemaColumnCache.get(key);
  const [rows] = await poolWaschenPos.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  const exists = rows.length > 0;
  schemaColumnCache.set(key, exists);
  return exists;
};

// ─── GET /api/approvals ────────────────────────────────────────────────────────
export const getApprovals = async (req, res) => {
  try {
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;
    const statusFilter = String(req.query.status || '').trim();

    const hasApprovalActiveFlag = await hasColumn('tr_transaction_approval', 'is_active');

    const wheres = [];
    if (hasApprovalActiveFlag) wheres.push('a.is_active = 1');
    if (['pending', 'approved', 'rejected'].includes(statusFilter)) {
      wheres.push(`a.status = '${statusFilter}'`);
    }
    const whereSql = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';

    // Total count
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM tr_transaction_approval a ${whereSql}`
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        a.id,
        a.type,
        a.reason AS description,
        t.total AS amount,
        a.status,
        a.requested_at AS date,
        a.resolved_at AS resolvedAt,
        u.name AS requester,
        u.id   AS requesterId,
        r.name AS resolvedByName
      FROM tr_transaction_approval a
      JOIN mst_user u ON u.id = a.requested_by
      LEFT JOIN mst_user r ON r.id = a.approved_by
      LEFT JOIN tr_transaction t ON t.id = a.transaction_id
      ${whereSql}
      ORDER BY
        FIELD(a.status, 'pending', 'approved', 'rejected'),
        a.requested_at DESC
      LIMIT ${limitNum} OFFSET ${offset}`
    );

    const data = rows.map((a) => ({
      ...a,
      date: a.date ? new Date(a.date).toISOString().slice(0, 10) : null,
      amount: a.amount ? Number(a.amount) : null,
    }));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    console.error('[getApprovals] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data approval.' });
  }
};

// ─── PUT /api/approvals/:id ────────────────────────────────────────────────────
export const resolveApproval = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const resolvedBy = req.user?.userId;

    if (!['approved', 'rejected'].includes(status)) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Status harus approved atau rejected',
      });
    }

    const hasApprovalActiveFlag = await hasColumn('tr_transaction_approval', 'is_active');
    const [check] = await conn.execute(
      `SELECT id, status, type, transaction_id
       FROM tr_transaction_approval
       WHERE id = ?
       ${hasApprovalActiveFlag ? 'AND is_active = 1' : ''}
       LIMIT 1`,
      [id]
    );

    if (check.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Approval tidak ditemukan.' });
    }

    if (check[0].status !== 'pending') {
      conn.release();
      return res.status(409).json({ success: false, message: 'Approval sudah diproses sebelumnya.' });
    }

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE tr_transaction_approval
       SET status = ?, approved_by = ?, resolved_at = NOW()
       WHERE id = ?`,
      [status, resolvedBy, id]
    );

    // --- APPLY THE EFFECT OF THE APPROVAL ---
    if (status === 'approved') {
      const approvalType = check[0].type;
      const txId = check[0].transaction_id;

      if (approvalType === 'cancel_nota' && txId) {
        await conn.execute(
          `UPDATE tr_transaction 
           SET status = 'cancelled', 
               cancelled_at = NOW(),
               cancelled_by = ?,
               cancel_reason = COALESCE(cancel_reason, 'Batal Disetujui Admin'),
               notes = CONCAT(COALESCE(notes, ''), ' | [Batal Disetujui Admin]'), 
               updated_at = NOW() 
           WHERE id = ?`,
          [resolvedBy, txId]
        );
      } else if (approvalType === 'delete_transaction' && txId) {
        // SOFT DELETE — data tetap ada di DB untuk audit/finance, tapi tidak tampil di UI
        await conn.execute(
          `UPDATE tr_transaction 
           SET deleted_at = NOW(),
               deleted_by = ?,
               delete_reason = COALESCE(delete_reason, 'Dihapus via Approval Admin'),
               notes = CONCAT(COALESCE(notes, ''), ' | [Dihapus via Approval Admin]'),
               updated_at = NOW() 
           WHERE id = ?`,
          [resolvedBy, txId]
        );
      }
    }

    await conn.commit();

    // Audit log — track siapa approve / reject
    writeAudit(poolWaschenPos, {
      userId: resolvedBy,
      outletId: req.user?.outletId,
      transactionId: check[0].transaction_id,
      entityType: 'approval',
      entityId: id,
      action: status === 'approved' ? `approved_${check[0].type}` : `rejected_${check[0].type}`,
      newData: { status, type: check[0].type },
      req,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: status === 'approved' ? 'Approval disetujui.' : 'Approval ditolak.',
    });
  } catch (err) {
    await conn.rollback();
    console.error('[resolveApproval] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses approval.' });
  } finally {
    conn.release();
  }
};

// ─── PUT /api/approvals/bulk ────────────────────────────────────────────────
// Bulk approve/reject — admin can process multiple approvals at once
export const bulkResolveApprovals = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { ids, status } = req.body;
    const resolvedBy = req.user?.userId;

    if (!Array.isArray(ids) || ids.length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'IDs wajib berupa array dan tidak kosong.' });
    }
    if (ids.length > 50) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Maksimal 50 approval per bulk operation.' });
    }
    if (!['approved', 'rejected'].includes(status)) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Status harus approved atau rejected.' });
    }

    const hasApprovalActiveFlag = await hasColumn('tr_transaction_approval', 'is_active');

    await conn.beginTransaction();

    const placeholders = ids.map(() => '?').join(',');
    const [pendingRows] = await conn.execute(
      `SELECT id, status, type, transaction_id
       FROM tr_transaction_approval
       WHERE id IN (${placeholders}) AND status = 'pending'
       ${hasApprovalActiveFlag ? 'AND is_active = 1' : ''}`,
      ids
    );

    if (pendingRows.length === 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Tidak ada approval yang masih pending dari list ini.' });
    }

    // Update all pending approvals
    const pendingIds = pendingRows.map(r => r.id);
    const ph = pendingIds.map(() => '?').join(',');
    await conn.execute(
      `UPDATE tr_transaction_approval
       SET status = ?, approved_by = ?, resolved_at = NOW()
       WHERE id IN (${ph})`,
      [status, resolvedBy, ...pendingIds]
    );

    // Apply effects for each approved/rejected
    if (status === 'approved') {
      const cancelTxIds = pendingRows.filter(r => r.type === 'cancel_nota' && r.transaction_id).map(r => r.transaction_id);
      const deleteTxIds = pendingRows.filter(r => r.type === 'delete_transaction' && r.transaction_id).map(r => r.transaction_id);

      if (cancelTxIds.length > 0) {
        const cancelPh = cancelTxIds.map(() => '?').join(',');
        await conn.execute(
          `UPDATE tr_transaction
           SET status = 'cancelled',
               cancelled_at = NOW(),
               cancelled_by = ?,
               cancel_reason = COALESCE(cancel_reason, 'Batal Disetujui Admin (Bulk)'),
               notes = CONCAT(COALESCE(notes, ''), ' | [Batal Disetujui Admin (Bulk)]'),
               updated_at = NOW()
           WHERE id IN (${cancelPh})`,
          [resolvedBy, ...cancelTxIds]
        );
      }
      if (deleteTxIds.length > 0) {
        const delPh = deleteTxIds.map(() => '?').join(',');
        await conn.execute(
          `UPDATE tr_transaction
           SET deleted_at = NOW(),
               deleted_by = ?,
               delete_reason = COALESCE(delete_reason, 'Dihapus via Approval Admin (Bulk)'),
               notes = CONCAT(COALESCE(notes, ''), ' | [Dihapus via Approval Admin (Bulk)]'),
               updated_at = NOW()
           WHERE id IN (${delPh})`,
          [resolvedBy, ...deleteTxIds]
        );
      }
    }

    await conn.commit();

    // Audit log
    pendingRows.forEach(row => {
      writeAudit(poolWaschenPos, {
        userId: resolvedBy,
        outletId: req.user?.outletId,
        transactionId: row.transaction_id,
        entityType: 'approval',
        entityId: row.id,
        action: status === 'approved' ? `bulk_approved_${row.type}` : `bulk_rejected_${row.type}`,
        newData: { status, type: row.type, isBulk: true },
        req,
      }).catch(() => {});
    });

    return res.json({
      success: true,
      message: `${pendingRows.length} approval berhasil di-${status === 'approved' ? 'setujui' : 'tolak'}.`,
      data: {
        processed: pendingRows.length,
        skipped: ids.length - pendingRows.length,
        ids: pendingIds,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[bulkResolveApprovals] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses approval (bulk).' });
  } finally {
    conn.release();
  }
};
