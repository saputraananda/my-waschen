import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import logger from '../utils/logger.js';

const ADMIN_ROLES = ['admin'];
const assertAdmin = (req, res) => {
  if (!ADMIN_ROLES.includes(req.user?.roleCode)) {
    return res.status(403).json({ success: false, message: 'Hanya admin/finance/owner.' });
  }
  return true;
};

// ─── POST /api/cash-deposits ─────────────────────────────────────────────────
// Kasir submits setor tunai
export const submitDeposit = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;
    // ── PIC (Penanggung Jawab) ───────────────────────────────────────────────
    const { pic_id, pic_name } = req.body;
    const resolvedPicId = pic_id || userId;
    const resolvedPicName = pic_name || req.user?.name || req.user?.fullName || 'Unknown';

    const { deposit_amount, cash_sales_total, deposit_date, notes, proof_documents } = req.body;

    if (!outletId) return res.status(400).json({ success: false, message: 'User tidak terikat outlet.' });
    if (!deposit_amount || Number(deposit_amount) <= 0) return res.status(400).json({ success: false, message: 'Jumlah setor harus > 0.' });

    const date = deposit_date || new Date().toISOString().slice(0, 10);

    const [result] = await poolWaschenPos.execute(
      `INSERT INTO tr_cash_deposit (outlet_id, cashier_id, deposit_date, deposit_amount, cash_sales_total, proof_documents, notes, pic_id, pic_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [outletId, userId, date, Number(deposit_amount), Number(cash_sales_total || 0), proof_documents ? JSON.stringify(proof_documents) : null, notes || null, resolvedPicId, resolvedPicName]
    );

    await writeAudit(poolWaschenPos, {
      userId, entityType: 'cash_deposit', entityId: result.insertId,
      action: 'submit', newData: { deposit_amount, date }, req,
    }).catch(err => logger.error('[submitDeposit] writeAudit gagal:', err));

    return res.status(201).json({
      success: true,
      message: 'Setor tunai berhasil diajukan. Menunggu approval admin.',
      data: { id: result.insertId, status: 'pending' },
    });
  } catch (err) {
    logger.error('Submit deposit gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal submit setor.' });
  }
};

// ─── GET /api/cash-deposits ──────────────────────────────────────────────────
// Kasir: list own setor history
export const listMyDeposits = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { status, date_from, date_to, limit = 50 } = req.query;

    let sql = `
      SELECT cd.id, cd.deposit_date AS depositDate, cd.deposit_amount AS amount, cd.proof_documents AS proofDocuments,
             cd.notes, cd.status, cd.created_at AS createdAt, cd.approved_at AS approvedAt,
             cd.reject_reason AS rejectionReason,
             cd.pic_id AS picId, cd.pic_name AS picName,
             u.name AS approvedByName
      FROM tr_cash_deposit cd
      LEFT JOIN mst_user u ON u.id = cd.approved_by
      WHERE cd.cashier_id = ?
    `;
    const params = [userId];

    if (status) { sql += ' AND cd.status = ?'; params.push(status); }
    if (date_from) { sql += ' AND cd.deposit_date >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND cd.deposit_date <= ?'; params.push(date_to); }

    sql += ` ORDER BY cd.created_at DESC LIMIT ${Math.min(Number(limit), 200)}`;

    const [rows] = await poolWaschenPos.execute(sql, params);
    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, amount: Number(r.amount) })),
    });
  } catch (err) {
    logger.error('List my deposits gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat setor.' });
  }
};

// ─── GET /api/cash-deposits/pending ──────────────────────────────────────────
// Admin: list pending (or all) setor requests
export const listDepositRequests = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;

    const { status = 'pending', outlet_id, date_from, date_to, limit = 100 } = req.query;

    let sql = `
      SELECT cd.id, cd.outlet_id AS outletId, o.name AS outletName,
             cd.cashier_id AS cashierId, u.name AS cashierName,
             cd.deposit_date AS depositDate,
             cd.deposit_amount AS amount, cd.proof_documents AS proofDocuments,
             cd.notes, cd.status, cd.created_at AS createdAt,
             cd.approved_at AS approvedAt, cd.reject_reason AS rejectionReason,
             cd.pic_id AS picId, cd.pic_name AS picName,
             ap.name AS approvedByName
      FROM tr_cash_deposit cd
      JOIN mst_outlet o ON o.id = cd.outlet_id
      JOIN mst_user u ON u.id = cd.cashier_id
      LEFT JOIN mst_user ap ON ap.id = cd.approved_by
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') { sql += ' AND cd.status = ?'; params.push(status); }
    if (outlet_id) { sql += ' AND cd.outlet_id = ?'; params.push(outlet_id); }
    if (date_from) { sql += ' AND cd.deposit_date >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND cd.deposit_date <= ?'; params.push(date_to); }

    sql += ` ORDER BY cd.created_at DESC LIMIT ${Math.min(Number(limit), 500)}`;

    const [rows] = await poolWaschenPos.execute(sql, params);
    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, amount: Number(r.amount) })),
    });
  } catch (err) {
    logger.error('List deposit requests gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar setor.' });
  }
};

// ─── PATCH /api/cash-deposits/:id/approve ────────────────────────────────────
export const approveDeposit = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;
    const { id } = req.params;
    const adminId = req.user?.userId;

    const [[existing]] = await poolWaschenPos.execute(
      `SELECT id, deposit_amount, cashier_id, outlet_id FROM tr_cash_deposit WHERE id = ? AND status = 'pending'`, [id]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Setor tidak ditemukan atau sudah diproses.' });

    await poolWaschenPos.execute(
      `UPDATE tr_cash_deposit SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [adminId, id]
    );

    await writeAudit(poolWaschenPos, {
      userId: adminId, entityType: 'cash_deposit', entityId: Number(id),
      action: 'approve', req,
    }).catch(err => logger.error('[approveDeposit] writeAudit gagal:', err));

    return res.json({ success: true, message: 'Setor disetujui.' });
  } catch (err) {
    logger.error('Approve deposit gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal approve setor.' });
  }
};

// ─── PATCH /api/cash-deposits/:id/reject ─────────────────────────────────────
export const rejectDeposit = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;
    const { id } = req.params;
    const adminId = req.user?.userId;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Alasan penolakan wajib diisi (min 3 karakter).' });
    }

    const [[existing]] = await poolWaschenPos.execute(
      `SELECT id FROM tr_cash_deposit WHERE id = ? AND status = 'pending'`, [id]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Setor tidak ditemukan atau sudah diproses.' });

    await poolWaschenPos.execute(
      `UPDATE tr_cash_deposit SET status = 'rejected', approved_by = ?, approved_at = NOW(), reject_reason = ? WHERE id = ?`,
      [adminId, reason.trim(), id]
    );

    await writeAudit(poolWaschenPos, {
      userId: adminId, entityType: 'cash_deposit', entityId: Number(id),
      action: 'reject', newData: { reason: reason.trim() }, req,
    }).catch(err => logger.error('[rejectDeposit] writeAudit gagal:', err));

    return res.json({ success: true, message: 'Setor ditolak.' });
  } catch (err) {
    logger.error('Reject deposit gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal reject setor.' });
  }
};

// ─── GET /api/cash-deposits/summary ──────────────────────────────────────────
// Get setor summary for current cashier (today or specific date)
export const getDepositSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'approved' THEN deposit_amount ELSE 0 END), 0) AS totalApproved,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN deposit_amount ELSE 0 END), 0) AS totalPending,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pendingCount,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approvedCount
       FROM tr_cash_deposit
       WHERE cashier_id = ? AND outlet_id = ? AND deposit_date = ?`,
      [userId, outletId, date]
    );

    return res.json({
      success: true,
      data: {
        totalApproved: Number(rows[0]?.totalApproved || 0),
        totalPending: Number(rows[0]?.totalPending || 0),
        pendingCount: Number(rows[0]?.pendingCount || 0),
        approvedCount: Number(rows[0]?.approvedCount || 0),
        hasPending: Number(rows[0]?.pendingCount || 0) > 0,
      },
    });
  } catch (err) {
    logger.error('Get deposit summary gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat ringkasan setor.' });
  }
};

// ─── GET /api/cash-deposits/pool-summary ─────────────────────────────────────
// Admin: pool kas tertahan per outlet (total cash belum disetor)
export const getCashPoolSummary = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        o.id AS outletId,
        o.name AS outletName,
        COALESCE(SUM(CASE WHEN cd.status = 'pending' THEN cd.deposit_amount ELSE 0 END), 0) AS pendingTotal,
        COUNT(CASE WHEN cd.status = 'pending' THEN 1 END) AS pendingCount,
        MAX(CASE WHEN cd.status = 'approved' THEN cd.approved_at END) AS lastApprovedAt,
        COALESCE(
          (SELECT SUM(pi.amount) FROM tr_payment_item pi
           JOIN tr_transaction t ON t.id = pi.transaction_id
           WHERE t.outlet_id = o.id AND t.deleted_at IS NULL
             AND t.status <> 'cancelled' AND pi.method = 'cash' AND pi.status = 'paid'
             AND COALESCE(pi.paid_at, pi.recorded_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0
        ) AS cashSales30d,
        COALESCE(
          (SELECT SUM(cd2.deposit_amount) FROM tr_cash_deposit cd2
           WHERE cd2.outlet_id = o.id AND cd2.status = 'approved'
             AND cd2.approved_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)), 0
        ) AS setorApproved30d
       FROM mst_outlet o
       LEFT JOIN tr_cash_deposit cd ON cd.outlet_id = o.id
       WHERE o.is_active = 1 AND o.deleted_at IS NULL
       GROUP BY o.id, o.name
       ORDER BY pendingTotal DESC`
    );

    const POOL_ALERT_THRESHOLD = 5_000_000;
    const DAYS_WITHOUT_SETOR_ALERT = 3;

    const data = rows.map(r => {
      const pending = Number(r.pendingTotal);
      const cashSales = Number(r.cashSales30d || 0);
      const setorApproved = Number(r.setorApproved30d || 0);
      const pool = cashSales - setorApproved;
      const lastApproved = r.lastApprovedAt ? new Date(r.lastApprovedAt) : null;
      const daysSinceLastSetor = lastApproved
        ? Math.floor((Date.now() - lastApproved.getTime()) / 86400000)
        : null;

      const alerts = [];
      if (pool > POOL_ALERT_THRESHOLD) {
        alerts.push({ type: 'high_pool', message: `Pool kas Rp ${pool.toLocaleString('id-ID')} (>Rp ${POOL_ALERT_THRESHOLD.toLocaleString('id-ID')})` });
      }
      if (daysSinceLastSetor !== null && daysSinceLastSetor > DAYS_WITHOUT_SETOR_ALERT) {
        alerts.push({ type: 'stale_setor', message: `Belum setor ${daysSinceLastSetor} hari` });
      }
      if (daysSinceLastSetor === null && cashSales > 0) {
        alerts.push({ type: 'never_setor', message: 'Belum pernah setor' });
      }

      return {
        outletId: r.outletId,
        outletName: r.outletName,
        pendingTotal: pending,
        pendingCount: Number(r.pendingCount || 0),
        pool30d: pool,
        cashSales30d: cashSales,
        setorApproved30d: setorApproved,
        lastApprovedAt: r.lastApprovedAt,
        daysSinceLastSetor,
        alerts,
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    logger.error('Get cash pool summary gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat pool kas.' });
  }
};
