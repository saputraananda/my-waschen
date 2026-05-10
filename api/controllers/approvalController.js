import { poolWaschenPos } from '../db/connection.js';

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
    const hasApprovalActiveFlag = await hasColumn('tr_transaction_approval', 'is_active');
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
      ${hasApprovalActiveFlag ? 'WHERE a.is_active = 1' : ''}
      ORDER BY
        FIELD(a.status, 'pending', 'approved', 'rejected'),
        a.requested_at DESC`
    );

    const data = rows.map((a) => ({
      ...a,
      date: a.date ? new Date(a.date).toISOString().slice(0, 10) : null,
      amount: a.amount ? Number(a.amount) : null,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[getApprovals] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data approval.' });
  }
};

// ─── PUT /api/approvals/:id ────────────────────────────────────────────────────
export const resolveApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const resolvedBy = req.user?.userId;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status harus approved atau rejected',
      });
    }

    const hasApprovalActiveFlag = await hasColumn('tr_transaction_approval', 'is_active');
    const [check] = await poolWaschenPos.execute(
      `SELECT id, status, type, transaction_id
       FROM tr_transaction_approval
       WHERE id = ?
       ${hasApprovalActiveFlag ? 'AND is_active = 1' : ''}
       LIMIT 1`,
      [id]
    );

    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Approval tidak ditemukan.' });
    }

    if (check[0].status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Approval sudah diproses sebelumnya.' });
    }

    await poolWaschenPos.execute(
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
        await poolWaschenPos.execute(
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
        await poolWaschenPos.execute(
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

    return res.status(200).json({
      success: true,
      message: status === 'approved' ? 'Approval disetujui.' : 'Approval ditolak.',
    });
  } catch (err) {
    console.error('[resolveApproval] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses approval.' });
  }
};
