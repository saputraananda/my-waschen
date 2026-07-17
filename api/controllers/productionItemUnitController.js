// ─────────────────────────────────────────────────────────────────────────────
// productionItemUnitController.js — Production Item Unit Status Update with Role Permission
// Phase 5: Dual Role System for Production Team
// Task 29.2: Update production status workflow with Role A permission
// Task 31.1: Auto-notification when production status = 'packed'
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';
import { canUpdateProductionStatus, PRODUCTION_ROLES } from '../utils/productionRolePermission.js';
import { sendProductionReadyNotification } from '../services/whatsappService.js';
import { emitTransactionCheckout, emitProductionUpdate } from '../services/eventBus.js';
import logger from '../utils/logger.js';

// Production stage order — simplified (washing/drying/ironing trimmed per user request)
const STAGE_ORDER = ['received', 'packing', 'ready', 'delivered'];

// Helper: Mask phone number for privacy (PDP Law No. 27/2022)
function maskPhone(phone) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length < 8) return '****';
  return clean.slice(0, 4) + '****' + clean.slice(-3);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/production/item-unit/:id/status
// Update production status for a single item unit
// ─────────────────────────────────────────────────────────────────────────────
export async function updateItemUnitStatus(req, res) {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const { status, notes, action } = req.body;
    const userId = req.user?.userId || req.user?.id;
    const user = req.user;

    // ── Permission Check ──────────────────────────────────────────────────────
    if (!canUpdateProductionStatus(user)) {
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk update status produksi. Hubungi admin.',
      });
    }

    // ── Validation ──────────────────────────────────────────────────────────
    if (!id) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Item Unit ID wajib diisi.',
      });
    }

    if (!status) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Status produksi wajib diisi.',
      });
    }

    // Validate status value
    if (!STAGE_ORDER.includes(status)) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: `Status tidak valid. Pilih: ${STAGE_ORDER.join(', ')}`,
      });
    }

    await conn.beginTransaction();

    // ── Get current item unit ────────────────────────────────────────────────
    const [[itemUnit]] = await conn.execute(`
      SELECT
        iu.*,
        ti.service_name_snapshot,
        t.transaction_no,
        t.customer_id,
        t.outlet_id,
        c.name as customer_name
      FROM tr_item_unit iu
      JOIN tr_transaction_item ti ON iu.transaction_item_id = ti.id
      JOIN tr_transaction t ON iu.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      WHERE iu.id = ?
      LIMIT 1 FOR UPDATE
    `, [id]);

    if (!itemUnit) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Item unit tidak ditemukan.',
      });
    }

    // ── Outlet-Scoped Authorization (IDOR Fix) ─────────────────────
    // Pastikan user hanya bisa akses item unit dari outlet mereka sendiri
    const userOutletId = String(req.user?.outletId || '');
    const itemOutletId = String(itemUnit.outlet_id || '');
    const isAdmin = req.user?.roleCode === 'admin';

    if (!isAdmin && userOutletId && itemOutletId && userOutletId !== itemOutletId) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda hanya bisa mengakses data outlet Anda sendiri.',
      });
    }

    const oldStatus = itemUnit.production_status;

    // ── Validate stage progression ──────────────────────────────────────────────
    // Hanya role 'produksi' yang boleh update, tidak boleh mundur stage
    const isProduksi = user.roleCode === 'produksi';
    const oldIndex = STAGE_ORDER.indexOf(oldStatus);
    const newIndex = STAGE_ORDER.indexOf(status);

    // Packing team TIDAK boleh mundur stage (hanya maju)
    if (isProduksi && newIndex < oldIndex) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat mundur tahap produksi. Hubungi admin untuk koreksi.',
      });
    }

    // ── Update item unit status ──────────────────────────────────────────────
    const now = new Date();
    let updateFields = 'production_status = ?, updated_at = NOW()';
    let updateParams = [status];

    // Set timestamps based on status
    if (status === 'ready') {
      updateFields += ', ready_at = ?';
      updateParams.push(now);
    } else if (status === 'delivered') {
      updateFields += ', delivered_at = ?';
      updateParams.push(now);
    }

    updateParams.push(id);

    await conn.execute(`
      UPDATE tr_item_unit SET ${updateFields} WHERE id = ?
    `, updateParams);

    // ── Create production log ────────────────────────────────────────────────
    await conn.execute(`
      INSERT INTO tr_production_log (
        item_unit_id, pic_id, stage, status,
        notes, started_at, created_at
      ) VALUES (?, ?, ?, 'done', ?, NOW(), NOW())
    `, [id, userId, status, notes || null]);

    // ── Check if transaction is fully ready ────────────────────────────────
    const [[statusCheck]] = await conn.execute(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN production_status IN ('ready', 'delivered') THEN 1 ELSE 0 END) as ready_count
      FROM tr_item_unit
      WHERE transaction_id = ?
      FOR UPDATE
    `, [itemUnit.transaction_id]);

    const isFullyReady = statusCheck[0].total === statusCheck[0].ready_count;

    // ── Auto-notification when all items are ready (status = 'ready') ────────
    // Only send notification when status changes TO 'ready' AND all items are ready
    if (status === 'ready' && oldStatus !== 'ready' && isFullyReady) {
      // Get transaction and customer info for notification
      const [[txInfo]] = await conn.execute(`
        SELECT
          t.id as transaction_id,
          t.transaction_no,
          t.pickup_type,
          t.pickup_schedule_at,
          t.customer_id,
          c.name as customer_name,
          c.phone as customer_phone
        FROM tr_transaction t
        JOIN mst_customer c ON t.customer_id = c.id
        WHERE t.id = ?
        LIMIT 1
      `, [itemUnit.transaction_id]);

      if (txInfo && txInfo.customer_phone) {
        // Send WhatsApp notification to customer
        try {
          const notifResult = await sendProductionReadyNotification({
            customerPhone: txInfo.customer_phone,
            customerName: txInfo.customer_name,
            transactionNo: txInfo.transaction_no,
            transactionId: txInfo.transaction_id,
            customerId: txInfo.customer_id,
            outletId: itemUnit.outlet_id,
            pickupType: txInfo.pickup_type,
            pickupScheduleAt: txInfo.pickup_schedule_at,
            sentBy: userId,
          });

          // [Production] Ready notification sent
        } catch (notifErr) {
          // Don't fail the status update if notification fails
          logger.error('Gagal mengirim notifikasi ready', { error: notifErr.message });
        }
      }
    }

    await conn.commit();

    // ── Emit events for real-time updates ───────────────────────────────────
    // Emit production update event (FIX: add outletId to scope to relevant outlet only)
    emitProductionUpdate({
      type: 'status_change',
      outletId: itemUnit.outlet_id, // FIX: scope event to correct outlet
      itemUnitId: id,
      unitNo: itemUnit.unit_no,
      transactionId: itemUnit.transaction_id,
      oldStatus,
      newStatus: status,
      isFullyReady,
      updatedBy: userId,
    });

    // Emit transaction update if fully ready (FIX: use positional args)
    if (isFullyReady) {
      emitTransactionCheckout(itemUnit.outlet_id, itemUnit.transaction_no, itemUnit.transaction_id);
    }

    return res.json({
      success: true,
      message: `Status berhasil diupdate ke ${status}.`,
      data: {
        itemUnitId: id,
        unitNo: itemUnit.unit_no,
        oldStatus,
        newStatus: status,
        transactionFullyReady: isFullyReady,
        updatedBy: userId,
        updatedAt: now,
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('Gagal update status produksi', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal update status produksi.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/production/item-unit/:id
// Get single item unit detail
// ─────────────────────────────────────────────────────────────────────────────
export async function getItemUnitDetail(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await db.execute(`
      SELECT
        iu.*,
        ti.service_name_snapshot,
        ti.unit_type_snapshot,
        ti.qty,
        t.transaction_no,
        t.customer_id,
        t.outlet_id,
        c.name as customer_name,
        c.phone as customer_phone
      FROM tr_item_unit iu
      JOIN tr_transaction_item ti ON iu.transaction_item_id = ti.id
      JOIN tr_transaction t ON iu.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      WHERE iu.id = ?
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item unit tidak ditemukan.',
      });
    }

    const item = rows[0];

    // ── Outlet-Scoped Authorization (IDOR Fix) ─────────────────────
    const userOutletId = String(req.user?.outletId || '');
    const itemOutletId = String(item.outlet_id || '');
    const isAdmin = req.user?.roleCode === 'admin';

    if (!isAdmin && userOutletId && itemOutletId && userOutletId !== itemOutletId) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda hanya bisa mengakses data outlet Anda sendiri.',
      });
    }

    // Get production history
    const [history] = await db.execute(`
      SELECT
        pl.*,
        u.name as pic_name
      FROM tr_production_log pl
      LEFT JOIN mst_user u ON pl.pic_id = u.id
      WHERE pl.item_unit_id = ?
      ORDER BY pl.started_at DESC
    `, [id]);

    return res.json({
      success: true,
      data: {
        id: item.id,
        unitNo: item.unit_no,
        labelCode: item.label_code,
        transactionNo: item.transaction_no,
        customerName: item.customer_name,
        customerPhone: maskPhone(item.customer_phone),
        serviceName: item.service_name_snapshot,
        unitType: item.unit_type_snapshot,
        qty: Number(item.qty_share),
        status: item.production_status,
        packingDone: item.packing_done === 1,
        readyAt: item.ready_at,
        deliveredAt: item.delivered_at,
        history: history.map(h => ({
          id: h.id,
          stage: h.stage,
          status: h.status,
          picName: h.pic_name,
          notes: h.notes,
          startedAt: h.started_at,
          completedAt: h.completed_at,
        })),
      },
    });

  } catch (error) {
    logger.error('Gagal mengambil detail item unit', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail item unit.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/production/item-unit/:id/photo
// Upload photo for item unit (PAP - Photo After Packing)
// ─────────────────────────────────────────────────────────────────────────────
export async function uploadItemUnitPhoto(req, res) {
  const conn = await db.getConnection();

  try {
    const { id } = req.params;
    const { photoUrl, photoType = 'packing', notes } = req.body;
    const userId = req.user?.userId || req.user?.id;

    // Permission check - need production access
    if (!canUpdateProductionStatus(req.user)) {
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk upload foto.',
      });
    }

    if (!photoUrl) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Photo URL wajib diisi.',
      });
    }

    await conn.beginTransaction();

    // Verify item unit exists
    const [[itemUnit]] = await conn.execute(
      'SELECT id FROM tr_item_unit WHERE id = ? LIMIT 1',
      [id]
    );

    if (!itemUnit) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Item unit tidak ditemukan.',
      });
    }

    // Calculate expiry (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [result] = await conn.execute(`
      INSERT INTO tr_item_photo (
        item_unit_id, photo_url, photo_type, notes,
        expires_at, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [id, photoUrl, photoType, notes || null, expiresAt, userId]);

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Foto berhasil diupload.',
      data: {
        photoId: result.insertId,
        itemUnitId: id,
        photoType,
        expiresAt,
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('Gagal upload foto', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal upload foto.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}
