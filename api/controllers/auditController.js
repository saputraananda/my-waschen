import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/audit-log ───────────────────────────────────────────────────────
// List audit log dengan filter & pagination. Hanya admin/owner/finance.
export const getAuditLog = async (req, res) => {
  try {
    const {
      userId,
      outletId,
      entityType,
      action,
      transactionId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let where = '1=1';
    const params = [];

    if (userId) { where += ' AND a.user_id = ?'; params.push(userId); }
    if (outletId) { where += ' AND a.outlet_id = ?'; params.push(outletId); }
    if (entityType) { where += ' AND a.entity_type = ?'; params.push(entityType); }
    if (action) { where += ' AND a.action LIKE ?'; params.push(`%${action}%`); }
    if (transactionId) { where += ' AND a.transaction_id = ?'; params.push(transactionId); }
    if (dateFrom) { where += ' AND DATE(a.created_at) >= ?'; params.push(dateFrom); }
    if (dateTo) { where += ' AND DATE(a.created_at) <= ?'; params.push(dateTo); }

    // Count total
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM tr_audit_log a WHERE ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    // Fetch rows
    const [rows] = await poolWaschenPos.execute(
      `SELECT
         a.id, a.user_id AS userId, u.name AS userName,
         a.outlet_id AS outletId, o.name AS outletName,
         a.transaction_id AS transactionId, a.entity_type AS entityType,
         a.entity_id AS entityId, a.action,
         a.old_data AS oldData, a.new_data AS newData,
         a.ip_address AS ipAddress, a.user_agent AS userAgent,
         a.created_at AS createdAt
       FROM tr_audit_log a
       LEFT JOIN mst_user u ON u.id = a.user_id
       LEFT JOIN mst_outlet o ON o.id = a.outlet_id
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    const data = rows.map((r) => ({
      ...r,
      oldData: r.oldData ? safeParse(r.oldData) : null,
      newData: r.newData ? safeParse(r.newData) : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    }));

    return res.json({
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
    console.error('[getAuditLog] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat audit log.' });
  }
};

function safeParse(jsonStr) {
  try { return JSON.parse(jsonStr); } catch { return jsonStr; }
}

// ─── GET /api/audit-log/actions ───────────────────────────────────────────────
// List jenis action yang sudah pernah dicatat (untuk filter dropdown)
export const getAuditActions = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT DISTINCT action FROM tr_audit_log ORDER BY action ASC LIMIT 100`
    );
    return res.json({ success: true, data: rows.map((r) => r.action) });
  } catch (err) {
    console.error('[getAuditActions] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar action.' });
  }
};
