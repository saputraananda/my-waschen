import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/approvals ────────────────────────────────────────────────────────
export const getApprovals = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        a.id,
        a.type,
        a.description,
        a.amount,
        a.status,
        a.created_at AS date,
        a.resolved_at AS resolvedAt,
        u.name AS requester,
        u.id   AS requesterId,
        r.name AS resolvedByName
      FROM tr_transaction_approval a
      JOIN mst_user u ON u.id = a.requested_by
      LEFT JOIN mst_user r ON r.id = a.resolved_by
      ORDER BY
        FIELD(a.status, 'pending', 'approved', 'rejected'),
        a.created_at DESC`
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

    const [check] = await poolWaschenPos.execute(
      'SELECT id, status FROM tr_transaction_approval WHERE id = ? LIMIT 1',
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
       SET status = ?, resolved_by = ?, resolved_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [status, resolvedBy, id]
    );

    return res.status(200).json({
      success: true,
      message: status === 'approved' ? 'Approval disetujui.' : 'Approval ditolak.',
    });
  } catch (err) {
    console.error('[resolveApproval] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses approval.' });
  }
};
