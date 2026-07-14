// ─────────────────────────────────────────────────────────────────────────────
// Purchase / Stock Request Controller — kasir request stok ke admin pusat
// ─────────────────────────────────────────────────────────────────────────────
// Alur:
//   1. Kasir submit request (item dari katalog atau free text). Status = pending.
//   2. Admin approve → stok outlet bertambah, status = approved.
//   3. Admin revise → status = revised + admin_note. Kasir bisa edit & resubmit.
//   4. Admin reject → status = rejected + admin_note (tidak bisa di-edit lagi).
//   5. Kasir resubmit (request status = revised) → status balik ke pending.
//
// Aturan validasi:
//   - Kasir hanya bisa lihat & ajukan untuk outlet-nya sendiri.
//   - Tidak bisa buat baru kalau ada pending/revised untuk item yang sama (per outlet).
//   - Qty > 0.
//   - Hanya admin yang boleh approve/revise/reject.
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import logger from '../utils/logger.js';

const URGENCIES = ['normal', 'urgent', 'critical'];
const STATUSES = ['pending', 'approved', 'rejected', 'revised', 'fulfilled', 'cancelled'];
const ADMIN_ROLES = ['admin'];
const FRONTLINER_ROLES = ['frontline'];

const isAdminRole = (role) => ADMIN_ROLES.includes(role);
const isKasirRole = (role) => FRONTLINER_ROLES.includes(role);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: tambah stok outlet + tulis ledger movement (1 trx, atomic)
// ─────────────────────────────────────────────────────────────────────────────
async function addStockOnApprove(conn, { outletId, inventoryId, qty, requestId, userId }) {
  if (!inventoryId || !qty || qty <= 0) return null;

  // Lock row stok outlet supaya tidak race kalau approve & adjust manual bersamaan
  const [[stockRow]] = await conn.execute(
    `SELECT id, stock_qty FROM mst_inventory_outlet_stock
      WHERE outlet_id = ? AND inventory_id = ? FOR UPDATE`,
    [outletId, inventoryId]
  );

  let newQty;
  if (stockRow) {
    newQty = Number(stockRow.stock_qty) + Number(qty);
    await conn.execute(
      `UPDATE mst_inventory_outlet_stock
         SET stock_qty = ?, last_updated_at = NOW()
       WHERE id = ?`,
      [newQty, stockRow.id]
    );
  } else {
    // Belum ada row — ambil min_stock_default dari item
    const [[item]] = await conn.execute(
      `SELECT min_stock_default FROM mst_inventory_item WHERE id = ? AND is_active = 1`,
      [inventoryId]
    );
    if (!item) throw new Error('Item katalog tidak ditemukan / nonaktif.');

    newQty = Number(qty);
    await conn.execute(
      `INSERT INTO mst_inventory_outlet_stock
        (outlet_id, inventory_id, stock_qty, min_stock, last_cost, last_updated_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [outletId, inventoryId, newQty, Number(item.min_stock_default || 0)]
    );
  }

  // Catat di ledger movement (audit trail tambahan)
  await conn.execute(
    `INSERT INTO tr_inventory_movement
      (outlet_id, inventory_id, movement_type, qty, unit_cost, notes, created_by, created_at)
     VALUES (?, ?, 'adjustment', ?, NULL, ?, ?, NOW())`,
    [outletId, inventoryId, Number(qty), `Approve PR #${requestId}`, userId]
  );

  return newQty;
}

// ════════════════════════════════════════════════════════════════════════════
// POST /api/purchase-requests — kasir submit
// Body: { inventoryId?, itemName, brand?, category?, qty, unit?, estimatedPrice?, urgency, reason, picId?, picName? }
// ════════════════════════════════════════════════════════════════════════════
export const submitRequest = async (req, res) => {
  try {
    const {
      inventoryId = null, itemName, brand = null, category = null,
      qty, unit = 'pcs', estimatedPrice = null,
      urgency = 'normal', reason,
      // ── PIC (Penanggung Jawab) ───────────────────────────────────────────────
      picId, picName,
    } = req.body || {};

    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const outletId = req.user?.outletId;

    // Fallback PIC to current user if not provided
    const resolvedPicId = picId || userId;
    const resolvedPicName = picName || req.user?.name || req.user?.fullName || 'Unknown';

    if (!userId) return res.status(401).json({ success: false, message: 'Auth required.' });
    if (!isKasirRole(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya kasir yang bisa request barang.' });
    }
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'User tidak terikat ke outlet.' });
    }

    // ── Validasi input ──
    if (!itemName || !String(itemName).trim()) {
      return res.status(400).json({ success: false, message: 'Nama barang wajib.' });
    }
    const numQty = Number(qty);
    if (!Number.isFinite(numQty) || numQty <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah harus lebih dari 0.' });
    }
    if (!URGENCIES.includes(urgency)) {
      return res.status(400).json({ success: false, message: `Urgensi tidak valid. Pilih: ${URGENCIES.join(', ')}` });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Alasan wajib.' });
    }

    // ── Cek duplicate pending/revised untuk item yang sama (per outlet) ──
    if (inventoryId) {
      const [dupRows] = await poolWaschenPos.execute(
        `SELECT id, status FROM tr_purchase_request
          WHERE deleted_at IS NULL
            AND outlet_id = ? AND inventory_id = ?
            AND status IN ('pending', 'revised')
          LIMIT 1`,
        [outletId, inventoryId]
      );
      if (dupRows.length) {
        return res.status(409).json({
          success: false,
          message: `Sudah ada pengajuan ${dupRows[0].status === 'pending' ? 'pending' : 'revisi'} untuk item ini. Selesaikan dulu sebelum buat baru.`,
          existingRequestId: dupRows[0].id,
        });
      }
    } else {
      // Untuk free-text, cek by nama item (case-insensitive) supaya tidak spam request sama
      const [dupRows] = await poolWaschenPos.execute(
        `SELECT id, status FROM tr_purchase_request
          WHERE deleted_at IS NULL
            AND outlet_id = ? AND inventory_id IS NULL
            AND LOWER(item_name) = LOWER(?)
            AND status IN ('pending', 'revised')
          LIMIT 1`,
        [outletId, String(itemName).trim()]
      );
      if (dupRows.length) {
        return res.status(409).json({
          success: false,
          message: `Sudah ada pengajuan ${dupRows[0].status === 'pending' ? 'pending' : 'revisi'} untuk barang dengan nama yang sama.`,
          existingRequestId: dupRows[0].id,
        });
      }
    }

    const [insertRes] = await poolWaschenPos.execute(
      `INSERT INTO tr_purchase_request
        (outlet_id, inventory_id, item_name, brand, category, qty, unit,
         estimated_price, urgency, reason, requested_by, pic_id, pic_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [outletId, inventoryId, String(itemName).trim(), brand, category,
       numQty, unit, estimatedPrice != null ? Number(estimatedPrice) : null,
       urgency, String(reason).trim(), userId, resolvedPicId, resolvedPicName]
    );

    await writeAudit(poolWaschenPos, {
      userId, outletId,
      entityType: 'purchase_request',
      entityId: insertRes.insertId,
      action: 'submit',
      newData: { itemName, qty: numQty, urgency, inventoryId },
      req,
      picId: resolvedPicId,
      picName: resolvedPicName,
    });

    return res.json({
      success: true,
      data: { requestId: insertRes.insertId, status: 'pending', urgency },
    });
  } catch (err) {
    logger.error('Gagal submit request', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal submit request.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/purchase-requests/:id/resubmit — kasir resubmit setelah revisi
// Body: { itemName?, brand?, qty?, unit?, urgency?, reason?, estimatedPrice? }
// Hanya request status='revised' yang bisa di-edit.
// ════════════════════════════════════════════════════════════════════════════
export const resubmitRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const outletId = req.user?.outletId;

    if (!isKasirRole(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya kasir yang boleh resubmit.' });
    }
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'User tidak terikat ke outlet.' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, outlet_id, status, requested_by, item_name, qty, unit, urgency, reason, estimated_price
         FROM tr_purchase_request WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Request tidak ditemukan.' });
    const cur = rows[0];

    if (Number(cur.outlet_id) !== Number(outletId)) {
      return res.status(403).json({ success: false, message: 'Hanya bisa resubmit request outlet sendiri.' });
    }
    if (cur.status !== 'revised') {
      return res.status(400).json({ success: false, message: 'Hanya request berstatus revisi yang bisa di-edit.' });
    }

    const body = req.body || {};
    const newItemName = body.itemName != null ? String(body.itemName).trim() : cur.item_name;
    const newBrand = body.brand != null ? String(body.brand).trim() || null : null;
    const newQty = body.qty != null ? Number(body.qty) : Number(cur.qty);
    const newUnit = body.unit != null ? String(body.unit).trim() : cur.unit;
    const newUrgency = body.urgency != null ? String(body.urgency) : cur.urgency;
    const newReason = body.reason != null ? String(body.reason).trim() : cur.reason;
    const newPrice = body.estimatedPrice != null ? Number(body.estimatedPrice) : cur.estimated_price;

    if (!newItemName) return res.status(400).json({ success: false, message: 'Nama barang wajib.' });
    if (!Number.isFinite(newQty) || newQty <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah harus lebih dari 0.' });
    }
    if (!URGENCIES.includes(newUrgency)) {
      return res.status(400).json({ success: false, message: 'Urgensi tidak valid.' });
    }
    if (!newReason) return res.status(400).json({ success: false, message: 'Alasan wajib.' });

    await poolWaschenPos.execute(
      `UPDATE tr_purchase_request
          SET item_name = ?, brand = ?, qty = ?, unit = ?, urgency = ?, reason = ?,
              estimated_price = ?, status = 'pending',
              admin_note = NULL,
              resubmitted_at = NOW()
        WHERE id = ?`,
      [newItemName, newBrand, newQty, newUnit, newUrgency, newReason, newPrice, id]
    );

    await writeAudit(poolWaschenPos, {
      userId, outletId,
      entityType: 'purchase_request',
      entityId: id,
      action: 'resubmit',
      oldData: { status: 'revised', qty: Number(cur.qty), itemName: cur.item_name },
      newData: { status: 'pending', qty: newQty, itemName: newItemName },
      req,
    });

    return res.json({ success: true, data: { id, status: 'pending' } });
  } catch (err) {
    logger.error('Gagal resubmit request', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal resubmit request.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/purchase-requests
// ════════════════════════════════════════════════════════════════════════════
export const getRequests = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobal = isAdminRole(userRole);

    const targetOutletId = isGlobal && req.query.outletId
      ? Number(req.query.outletId)
      : userOutletId;

    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    const params = [];
    let where = 'p.deleted_at IS NULL';
    if (targetOutletId) { where += ' AND p.outlet_id = ?'; params.push(targetOutletId); }
    if (req.query.status && STATUSES.includes(req.query.status)) {
      where += ' AND p.status = ?'; params.push(req.query.status);
    }
    if (req.query.urgency && URGENCIES.includes(req.query.urgency)) {
      where += ' AND p.urgency = ?'; params.push(req.query.urgency);
    }
    if (req.query.inventoryId) {
      where += ' AND p.inventory_id = ?'; params.push(Number(req.query.inventoryId));
    }

    const dateBasis = req.query.dateBasis === 'resolved' ? 'resolved' : 'created';
    const dateExpr = dateBasis === 'resolved'
      ? 'COALESCE(p.fulfilled_at, p.resolved_at, p.revised_at, p.created_at)'
      : 'p.created_at';
    if (req.query.startDate) {
      where += ` AND DATE(${dateExpr}) >= ?`;
      params.push(req.query.startDate);
    }
    if (req.query.endDate) {
      where += ` AND DATE(${dateExpr}) <= ?`;
      params.push(req.query.endDate);
    }

    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM tr_purchase_request p WHERE ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await poolWaschenPos.execute(
      `SELECT p.id, p.outlet_id AS outletId, p.inventory_id AS inventoryId,
              p.item_name AS itemName, p.brand, p.category, p.qty, p.unit,
              p.estimated_price AS estimatedPrice, p.urgency, p.status,
              p.reason, p.reject_reason AS rejectReason, p.admin_note AS adminNote,
              p.approved_qty AS approvedQty,
              p.fulfilled_amount AS fulfilledAmount, p.receipt_photo_url AS receiptPhotoUrl,
              p.created_at AS createdAt, p.resolved_at AS resolvedAt,
              p.fulfilled_at AS fulfilledAt, p.revised_at AS revisedAt,
              p.resubmitted_at AS resubmittedAt,
              p.pic_id AS picId, p.pic_name AS picName,
              o.name AS outletName,
              u.name AS requesterName,
              ru.name AS approverName,
              fu.name AS fulfillerName,
              i.item_code AS inventoryCode, i.name AS catalogName
         FROM tr_purchase_request p
         LEFT JOIN mst_outlet o ON o.id = p.outlet_id
         LEFT JOIN mst_user u ON u.id = p.requested_by
         LEFT JOIN mst_user ru ON ru.id = p.approved_by
         LEFT JOIN mst_user fu ON fu.id = p.fulfilled_by
         LEFT JOIN mst_inventory_item i ON i.id = p.inventory_id
        WHERE ${where}
        ORDER BY
          FIELD(p.status, 'pending', 'revised', 'approved', 'fulfilled', 'rejected', 'cancelled'),
          FIELD(p.urgency, 'critical', 'urgent', 'normal'),
          p.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        qty: Number(r.qty),
        approvedQty: r.approvedQty != null ? Number(r.approvedQty) : null,
        estimatedPrice: r.estimatedPrice != null ? Number(r.estimatedPrice) : null,
        fulfilledAmount: r.fulfilledAmount != null ? Number(r.fulfilledAmount) : null,
      })),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (err) {
    logger.error('Gagal memuat request', {
      error: err.message,
      code: err.code,
      sqlMessage: err.sqlMessage,
      sqlState: err.sqlState
    });
    return res.status(500).json({ success: false, message: 'Gagal memuat request.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/purchase-requests/:id — admin approve/revise/reject/fulfill/cancel
// Body: { action, adminNote?, approvedQty?, fulfilledAmount?, receiptPhotoUrl? }
// ════════════════════════════════════════════════════════════════════════════
export const resolveRequest = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const {
      action,
      adminNote = null,
      approvedQty = null,
      fulfilledAmount = null,
      receiptPhotoUrl = null,
    } = req.body || {};
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    if (!isAdminRole(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya admin/finance yang bisa proses request.' });
    }
    if (!['approve', 'reject', 'revise', 'fulfill', 'cancel'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action tidak valid.' });
    }

    // Revise & reject WAJIB ada catatan
    if ((action === 'revise' || action === 'reject') && (!adminNote || !String(adminNote).trim())) {
      return res.status(400).json({
        success: false,
        message: action === 'revise'
          ? 'Catatan wajib diisi saat minta revisi.'
          : 'Alasan tolak wajib diisi.',
      });
    }

    await conn.beginTransaction();

    const [rows] = await conn.execute(
      `SELECT id, outlet_id, inventory_id, qty, status
         FROM tr_purchase_request WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Request tidak ditemukan.' });
    }
    const cur = rows[0];

    if (action === 'approve') {
      if (cur.status !== 'pending') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Hanya request pending yang bisa di-approve.' });
      }
      // Qty yang di-approve bisa beda dari yang diminta
      const finalQty = approvedQty != null && Number(approvedQty) > 0
        ? Number(approvedQty)
        : Number(cur.qty);

      // Tambah stok kalau request item dari katalog
      let newStockQty = null;
      if (cur.inventory_id) {
        newStockQty = await addStockOnApprove(conn, {
          outletId: cur.outlet_id,
          inventoryId: cur.inventory_id,
          qty: finalQty,
          requestId: cur.id,
          userId,
        });
      }

      await conn.execute(
        `UPDATE tr_purchase_request
            SET status = 'approved', approved_by = ?, approved_qty = ?,
                admin_note = ?, resolved_at = NOW()
          WHERE id = ?`,
        [userId, finalQty, adminNote ? String(adminNote).trim() : null, id]
      );

      await writeAudit(conn, {
        userId, outletId: cur.outlet_id,
        entityType: 'purchase_request',
        entityId: id,
        action: 'approve',
        oldData: { status: 'pending' },
        newData: { status: 'approved', approvedQty: finalQty, newStockQty },
        req,
      });

      await conn.commit();
      return res.json({
        success: true,
        data: { id, status: 'approved', approvedQty: finalQty, newStockQty },
      });
    }

    if (action === 'reject') {
      if (cur.status !== 'pending') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Hanya request pending yang bisa di-reject.' });
      }
      await conn.execute(
        `UPDATE tr_purchase_request
            SET status = 'rejected', approved_by = ?, resolved_at = NOW(),
                reject_reason = ?, admin_note = ?
          WHERE id = ?`,
        [userId, String(adminNote).trim(), String(adminNote).trim(), id]
      );

      await writeAudit(conn, {
        userId, outletId: cur.outlet_id,
        entityType: 'purchase_request', entityId: id,
        action: 'reject',
        oldData: { status: 'pending' },
        newData: { status: 'rejected', adminNote },
        req,
      });

      await conn.commit();
      return res.json({ success: true, data: { id, status: 'rejected' } });
    }

    if (action === 'revise') {
      if (cur.status !== 'pending') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Hanya request pending yang bisa diminta revisi.' });
      }
      await conn.execute(
        `UPDATE tr_purchase_request
            SET status = 'revised', approved_by = ?, admin_note = ?, revised_at = NOW()
          WHERE id = ?`,
        [userId, String(adminNote).trim(), id]
      );

      await writeAudit(conn, {
        userId, outletId: cur.outlet_id,
        entityType: 'purchase_request', entityId: id,
        action: 'revise',
        oldData: { status: 'pending' },
        newData: { status: 'revised', adminNote },
        req,
      });

      await conn.commit();
      return res.json({ success: true, data: { id, status: 'revised' } });
    }

    if (action === 'fulfill') {
      if (cur.status !== 'approved') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Hanya request approved yang bisa di-fulfill.' });
      }
      await conn.execute(
        `UPDATE tr_purchase_request
            SET status = 'fulfilled', fulfilled_by = ?, fulfilled_at = NOW(),
                fulfilled_amount = ?, receipt_photo_url = ?
          WHERE id = ?`,
        [userId, fulfilledAmount != null ? Number(fulfilledAmount) : null, receiptPhotoUrl, id]
      );
      await conn.commit();
      return res.json({ success: true, data: { id, status: 'fulfilled' } });
    }

    if (action === 'cancel') {
      await conn.execute(
        `UPDATE tr_purchase_request SET status = 'cancelled', resolved_at = NOW() WHERE id = ?`,
        [id]
      );
      await conn.commit();
      return res.json({ success: true, data: { id, status: 'cancelled' } });
    }

    await conn.rollback();
    return res.status(400).json({ success: false, message: 'Action tidak dikenal.' });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    logger.error('Gagal proses request', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal proses request.' });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/purchase-requests/summary — counter pending per outlet (admin)
// ════════════════════════════════════════════════════════════════════════════
export const getSummary = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    if (!isAdminRole(userRole)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT
          p.outlet_id AS outletId,
          o.name AS outletName,
          SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END) AS pendingCount,
          SUM(CASE WHEN p.status = 'revised' THEN 1 ELSE 0 END) AS revisedCount,
          SUM(CASE WHEN p.urgency = 'critical' AND p.status = 'pending' THEN 1 ELSE 0 END) AS criticalCount,
          SUM(CASE WHEN p.urgency = 'urgent' AND p.status = 'pending' THEN 1 ELSE 0 END) AS urgentCount
        FROM tr_purchase_request p
        LEFT JOIN mst_outlet o ON o.id = p.outlet_id
        WHERE p.deleted_at IS NULL
        GROUP BY p.outlet_id, o.name
        ORDER BY criticalCount DESC, urgentCount DESC, pendingCount DESC`
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        ...r,
        pendingCount: Number(r.pendingCount || 0),
        revisedCount: Number(r.revisedCount || 0),
        criticalCount: Number(r.criticalCount || 0),
        urgentCount: Number(r.urgentCount || 0),
      })),
    });
  } catch (err) {
    logger.error('Gagal memuat summary', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat summary.' });
  }
};
