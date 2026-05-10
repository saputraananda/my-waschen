import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';

// ─── POST /api/logistics ────────────────────────────────────────────────────
// Buat logistic order (dipanggil otomatis saat checkout atau manual)
export const createLogisticOrder = async (req, res) => {
  try {
    const { transactionId, type, scheduledAt, areaZoneId, manualAddress, notes } = req.body;
    const userId = req.user?.userId;

    if (!transactionId || !type || !scheduledAt) {
      return res.status(400).json({ success: false, message: 'transactionId, type, dan scheduledAt wajib diisi.' });
    }

    if (!['pickup', 'delivery'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type harus pickup atau delivery.' });
    }

    // Cek transaksi exists
    const [txRows] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [transactionId]
    );
    if (txRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    // Hitung delivery_fee berdasar area zone (jika ada)
    let deliveryFee = 10000; // default
    let areaZoneSnapshot = null;
    if (areaZoneId) {
      try {
        const [zoneRows] = await poolWaschenPos.execute(
          `SELECT name, delivery_fee FROM mst_area_zone WHERE id = ? AND is_active = 1 LIMIT 1`,
          [areaZoneId]
        );
        if (zoneRows.length > 0) {
          deliveryFee = Number(zoneRows[0].delivery_fee) || 10000;
          areaZoneSnapshot = zoneRows[0].name;
        }
      } catch { /* tabel mst_area_zone belum ada, pakai default */ }
    }

    const orderId = randomUUID();
    await poolWaschenPos.execute(
      `INSERT INTO tr_logistic_order (
        id, transaction_id, type, area_zone_id, area_zone_snapshot,
        manual_address, delivery_fee, scheduled_at, status, notes, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
      [orderId, transactionId, type, areaZoneId || null, areaZoneSnapshot, manualAddress || null, deliveryFee, scheduledAt, notes || null, userId]
    );

    return res.status(201).json({
      success: true,
      message: `Order logistik (${type}) berhasil dibuat.`,
      data: { id: orderId, type, deliveryFee, scheduledAt, status: 'pending' },
    });
  } catch (err) {
    console.error('[createLogisticOrder] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat order logistik.' });
  }
};

// ─── GET /api/logistics?transactionId=xxx ───────────────────────────────────
// Ambil logistic orders untuk sebuah transaksi
export const getLogisticOrders = async (req, res) => {
  try {
    const { transactionId } = req.query;

    let sql = `SELECT
      lo.id, lo.transaction_id AS transactionId, lo.type, lo.status,
      lo.delivery_fee AS deliveryFee, lo.scheduled_at AS scheduledAt,
      lo.area_zone_snapshot AS areaZone, lo.manual_address AS address,
      lo.done_at AS doneAt, lo.notes,
      lo.created_at AS createdAt,
      t.transaction_no AS transactionNo,
      c.name AS customerName, c.phone AS customerPhone
    FROM tr_logistic_order lo
    JOIN tr_transaction t ON t.id = lo.transaction_id
    JOIN mst_customer c ON c.id = t.customer_id
    WHERE 1=1`;
    const params = [];

    if (transactionId) {
      sql += ' AND (lo.transaction_id = ? OR t.transaction_no = ?)';
      params.push(transactionId, transactionId);
    }

    sql += ' ORDER BY lo.scheduled_at DESC LIMIT 100';

    const [rows] = await poolWaschenPos.execute(sql, params);

    const data = rows.map((r) => ({
      ...r,
      deliveryFee: Number(r.deliveryFee),
      scheduledAt: r.scheduledAt ? new Date(r.scheduledAt).toISOString() : null,
      doneAt: r.doneAt ? new Date(r.doneAt).toISOString() : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[getLogisticOrders] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data logistik.' });
  }
};

// ─── POST /api/logistics/:id/reschedule ─────────────────────────────────────
export const rescheduleLogistic = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_scheduled_at, reason } = req.body;
    const userId = req.user?.userId;

    if (!new_scheduled_at) {
      return res.status(400).json({ success: false, message: 'Jadwal baru (new_scheduled_at) wajib diisi.' });
    }

    // Cek logistic order
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, scheduled_at, status FROM tr_logistic_order WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order logistik tidak ditemukan.' });
    }

    const order = rows[0];
    if (['done', 'cancelled', 'failed'].includes(order.status)) {
      return res.status(409).json({ success: false, message: `Order sudah ${order.status}, tidak bisa di-reschedule.` });
    }

    const oldScheduledAt = order.scheduled_at;

    // Insert ke tr_logistic_reschedule
    await poolWaschenPos.execute(
      `INSERT INTO tr_logistic_reschedule (
        id, logistic_order_id, old_scheduled_at, new_scheduled_at, reason, rescheduled_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [randomUUID(), id, oldScheduledAt, new_scheduled_at, reason || null, userId]
    );

    // Update scheduled_at di tr_logistic_order
    await poolWaschenPos.execute(
      `UPDATE tr_logistic_order SET scheduled_at = ?, updated_at = NOW() WHERE id = ?`,
      [new_scheduled_at, id]
    );

    return res.json({
      success: true,
      message: 'Jadwal berhasil diubah.',
      data: { id, oldScheduledAt, newScheduledAt: new_scheduled_at },
    });
  } catch (err) {
    console.error('[rescheduleLogistic] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah jadwal.' });
  }
};

// ─── GET /api/logistics/area-zones ──────────────────────────────────────────
// Daftar area zone untuk dropdown frontend
export const getAreaZones = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, name, delivery_fee AS fee FROM mst_area_zone WHERE is_active = 1 ORDER BY name`
    );
    return res.json({ success: true, data: rows.map((r) => ({ ...r, fee: Number(r.fee) })) });
  } catch (err) {
    // Jika tabel belum ada, return default zones
    return res.json({
      success: true,
      data: [
        { id: 'zone-1', name: 'Zona 1 (0-3 km)', fee: 10000 },
        { id: 'zone-2', name: 'Zona 2 (3-7 km)', fee: 15000 },
        { id: 'zone-3', name: 'Zona 3 (7-12 km)', fee: 25000 },
        { id: 'zone-4', name: 'Zona 4 (>12 km)', fee: 35000 },
      ],
    });
  }
};
