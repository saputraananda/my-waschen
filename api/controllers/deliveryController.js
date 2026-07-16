// ─────────────────────────────────────────────────────────────────────────────
// deliveryController.js — Driver/Delivery management
// FIXED: Uses tr_logistic_order instead of non-existent 'deliveries' table
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';
import logger from '../utils/logger.js';

// ── Helper: Build address string ─────────────────────────────────────────────
function buildAddress(logistic, customer) {
  if (logistic.manual_address) return logistic.manual_address;
  if (logistic.address_id && logistic.customer_address) {
    return logistic.customer_address;
  }
  return customer?.address || '-';
}

// ── Get tasks for a courier/driver ─────────────────────────────────────────
export async function getDriverTasks(req, res) {
  try {
    const { courierId } = req.query;
    const user = req.user;

    // If courierId not provided, use current user's id
    const targetCourierId = courierId || user.id;

    // Get all active logistic orders assigned to this courier
    const [orders] = await db.query(`
      SELECT
        lo.id,
        lo.transaction_id,
        lo.type,
        lo.status,
        lo.scheduled_at,
        lo.delivery_fee,
        lo.notes,
        lo.created_at,
        t.order_code,
        t.total,
        t.payment_status,
        t.created_at as order_date,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        o.name as outlet_name,
        u.name as courier_name
      FROM tr_logistic_order lo
      JOIN tr_transaction t ON lo.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      JOIN mst_outlet o ON t.outlet_id = o.id
      LEFT JOIN mst_user u ON lo.courier_id = u.id
      WHERE lo.courier_id = ?
        AND lo.status NOT IN ('done', 'cancelled', 'failed')
      ORDER BY
        CASE lo.type
          WHEN 'pickup' THEN 1
          WHEN 'delivery' THEN 2
        END,
        lo.scheduled_at ASC
    `, [targetCourierId]);

    // Get item counts for each order
    const tasks = await Promise.all(orders.map(async (order) => {
      const [items] = await db.query(`
        SELECT COUNT(*) as count, SUM(qty) as total_qty
        FROM tr_transaction_item
        WHERE transaction_id = ?
      `, [order.transaction_id]);

      // Build address based on type
      const address = order.type === 'pickup'
        ? `${order.outlet_name} (Ambil dari Outlet)`
        : order.customer_address || '-';

      return {
        id: order.id,
        orderId: order.transaction_id,
        orderCode: order.order_code,
        type: order.type,
        status: order.status,
        customerName: order.customer_name,
        phone: order.customer_phone,
        address: address,
        outletName: order.outlet_name,
        itemCount: items[0]?.count || 0,
        qty: items[0]?.total_qty || 0,
        totalAmount: order.total,
        paymentStatus: order.payment_status,
        scheduledAt: order.scheduled_at,
        deliveryFee: order.delivery_fee,
        notes: order.notes,
        createdAt: order.created_at,
      };
    }));

    return res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('Get courier tasks failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat tugas' });
  }
}

// ── Get completed orders for courier ────────────────────────────────────────
export async function getDriverHistory(req, res) {
  try {
    const { courierId, limit = 50, offset = 0 } = req.query;
    const user = req.user;

    const targetCourierId = courierId || user.id;

    const [orders] = await db.query(`
      SELECT
        lo.id,
        lo.transaction_id,
        lo.type,
        lo.status,
        lo.done_at,
        lo.delivery_fee,
        t.order_code,
        t.total,
        c.name as customer_name,
        o.name as outlet_name
      FROM tr_logistic_order lo
      JOIN tr_transaction t ON lo.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      JOIN mst_outlet o ON t.outlet_id = o.id
      WHERE lo.courier_id = ?
        AND lo.status IN ('done', 'cancelled', 'failed')
      ORDER BY lo.done_at DESC
      LIMIT ? OFFSET ?
    `, [targetCourierId, parseInt(limit), parseInt(offset)]);

    return res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Get courier history failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat' });
  }
}

// ── Update order status ───────────────────────────────────────────────────────
export async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, failureReason } = req.body;
    const user = req.user;

    // Validate status transition
    const validTransitions = {
      pending: ['assigned'],
      assigned: ['on_progress'],
      on_progress: ['done', 'failed'],
      // done and cancelled are terminal states
    };

    // Get current order
    const [orders] = await db.query(`
      SELECT lo.*, t.customer_id
      FROM tr_logistic_order lo
      JOIN tr_transaction t ON lo.transaction_id = t.id
      WHERE lo.id = ?
    `, [id]);

    if (!orders.length) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }

    const order = orders[0];

    // Check if user is authorized (courier assigned or admin)
    if (order.courier_id !== user.id && !user.roleCode !== 'admin') {
      return res.status(403).json({ success: false, message: 'Tidak memiliki akses' });
    }

    // Validate transition
    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Tidak dapat mengubah status dari ${order.status} ke ${status}`
      });
    }

    // Update order
    const updateData = { status };
    if (notes) updateData.notes = notes;
    if (failureReason && status === 'failed') updateData.failure_reason = failureReason;
    if (status === 'done') updateData.done_at = new Date();

    await db.query(
      'UPDATE tr_logistic_order SET ? WHERE id = ?',
      [updateData, id]
    );

    // If done, send WhatsApp notification to customer
    if (status === 'done') {
      const [tx] = await db.query(`
        SELECT t.*, c.name as customer_name, c.phone as customer_phone
        FROM tr_transaction t
        JOIN mst_customer c ON t.customer_id = c.id
        WHERE t.id = ?
      `, [order.transaction_id]);

      if (tx.length && tx[0].customer_phone) {
        // TODO: Send WhatsApp notification
        // [Delivery] Sending completion notification
      }
    }

    return res.json({ success: true, message: 'Status berhasil diperbarui' });
  } catch (error) {
    logger.error('Update order status failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status' });
  }
}

// ── Assign courier to order ───────────────────────────────────────────────────
export async function assignDriver(req, res) {
  try {
    const { id } = req.params;
    const { courierId } = req.body;
    const user = req.user;

    // Only admin can assign couriers
    if (!user.roleCode !== 'admin') {
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat mengassign courier' });
    }

    // Check if order exists
    const [orders] = await db.query('SELECT * FROM tr_logistic_order WHERE id = ?', [id]);
    if (!orders.length) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }

    // Check if courier exists (role: delivery)
    if (courierId) {
      const [couriers] = await db.query(
        'SELECT * FROM mst_user WHERE id = ? AND role_code = ?',
        [courierId, 'delivery']
      );
      if (!couriers.length) {
        return res.status(400).json({ success: false, message: 'Courier tidak ditemukan' });
      }
    }

    // Update courier assignment
    const updateData = { courier_id: courierId || null };
    if (courierId && orders[0].status === 'pending') {
      updateData.status = 'assigned';
    }

    await db.query(
      'UPDATE tr_logistic_order SET ? WHERE id = ?',
      [updateData, id]
    );

    return res.json({ success: true, message: 'Courier berhasil diassign' });
  } catch (error) {
    logger.error('Assign courier failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal mengassign courier' });
  }
}

// ── Create logistic order ─────────────────────────────────────────────────────
export async function createDelivery(req, res) {
  try {
    const {
      transactionId,
      type,
      addressId,
      manualAddress,
      courierId,
      scheduledAt,
      deliveryFee,
      notes
    } = req.body;
    const user = req.user;

    // Validate transaction exists
    const [transactions] = await db.query(
      'SELECT * FROM tr_transaction WHERE id = ?',
      [transactionId]
    );
    if (!transactions.length) {
      return res.status(400).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    // Calculate delivery fee if not provided
    let calculatedFee = deliveryFee || 0;
    if (calculatedFee === 0 && addressId) {
      const [zone] = await db.query(`
        SELECT delivery_fee FROM mst_customer_address ca
        JOIN mst_area_zone az ON ca.area_zone_id = az.id
        WHERE ca.id = ?
      `, [addressId]);
      if (zone.length) {
        calculatedFee = zone[0].delivery_fee;
      }
    }

    const order = {
      transaction_id: transactionId,
      type, // 'pickup' or 'delivery'
      status: courierId ? 'assigned' : 'pending',
      address_id: addressId || null,
      manual_address: manualAddress || null,
      courier_id: courierId || null,
      scheduled_at: scheduledAt || new Date(),
      delivery_fee: calculatedFee,
      notes: notes || null,
      created_by: user.id,
      created_at: new Date(),
    };

    const [result] = await db.query('INSERT INTO tr_logistic_order SET ?', order);

    return res.json({
      success: true,
      message: 'Order berhasil dibuat',
      data: { id: result.insertId, ...order }
    });
  } catch (error) {
    logger.error('Create order failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal membuat order' });
  }
}

// ── Get all orders (admin) ────────────────────────────────────────────────────
export async function getAllDeliveries(req, res) {
  try {
    const { status, courierId, outletId, type, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        lo.*,
        t.order_code,
        t.total,
        c.name as customer_name,
        c.phone as customer_phone,
        o.name as outlet_name,
        u.name as courier_name
      FROM tr_logistic_order lo
      JOIN tr_transaction t ON lo.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      JOIN mst_outlet o ON t.outlet_id = o.id
      LEFT JOIN mst_user u ON lo.courier_id = u.id
      WHERE lo.deleted_at IS NULL
    `;

    const params = [];

    if (status) {
      query += ' AND lo.status = ?';
      params.push(status);
    }
    if (courierId) {
      query += ' AND lo.courier_id = ?';
      params.push(courierId);
    }
    if (outletId) {
      query += ' AND t.outlet_id = ?';
      params.push(outletId);
    }
    if (type) {
      query += ' AND lo.type = ?';
      params.push(type);
    }

    query += ' ORDER BY lo.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [orders] = await db.query(query, params);

    return res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Get all orders failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data' });
  }
}

// ── Get order by ID ──────────────────────────────────────────────────────────
export async function getDeliveryById(req, res) {
  try {
    const { id } = req.params;
    const user = req.user;

    const [orders] = await db.query(`
      SELECT
        lo.*,
        t.order_code,
        t.total,
        t.payment_status,
        c.name as customer_name,
        c.phone as customer_phone,
        c.address as customer_address,
        o.name as outlet_name,
        u.name as courier_name
      FROM tr_logistic_order lo
      JOIN tr_transaction t ON lo.transaction_id = t.id
      JOIN mst_customer c ON t.customer_id = c.id
      JOIN mst_outlet o ON t.outlet_id = o.id
      LEFT JOIN mst_user u ON lo.courier_id = u.id
      WHERE lo.id = ? AND lo.deleted_at IS NULL
    `, [id]);

    if (!orders.length) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }

    // Get transaction items
    const [items] = await db.query(`
      SELECT ti.*, s.name as service_name
      FROM tr_transaction_item ti
      JOIN mst_service s ON ti.service_id = s.id
      WHERE ti.transaction_id = ?
    `, [orders[0].transaction_id]);

    return res.json({
      success: true,
      data: {
        ...orders[0],
        items
      }
    });
  } catch (error) {
    logger.error('Get order by ID failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data' });
  }
}

// ── Cancel order ─────────────────────────────────────────────────────────────
export async function cancelOrder(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;

    // Check order exists
    const [orders] = await db.query('SELECT * FROM tr_logistic_order WHERE id = ?', [id]);
    if (!orders.length) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }

    // Check authorization (courier assigned, creator, or admin)
    const order = orders[0];
    if (
      order.courier_id !== user.id &&
      order.created_by !== user.id &&
      !user.roleCode !== 'admin'
    ) {
      return res.status(403).json({ success: false, message: 'Tidak memiliki akses' });
    }

    // Cannot cancel if already done
    if (order.status === 'done') {
      return res.status(400).json({ success: false, message: 'Order sudah selesai, tidak dapat dibatalkan' });
    }

    await db.query(
      'UPDATE tr_logistic_order SET status = ?, failure_reason = ?, deleted_by = ? WHERE id = ?',
      ['cancelled', reason || 'Dibatalkan oleh pengguna', user.id, id]
    );

    return res.json({ success: true, message: 'Order berhasil dibatalkan' });
  } catch (error) {
    logger.error('Cancel order failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal membatalkan order' });
  }
}

// ── Reschedule order ─────────────────────────────────────────────────────────
export async function rescheduleOrder(req, res) {
  try {
    const { id } = req.params;
    const { newScheduledAt, reason } = req.body;
    const user = req.user;

    // Check order exists
    const [orders] = await db.query('SELECT * FROM tr_logistic_order WHERE id = ?', [id]);
    if (!orders.length) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
    }

    const order = orders[0];

    // Cannot reschedule if already done or cancelled
    if (['done', 'cancelled', 'failed'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order sudah selesai atau dibatalkan' });
    }

    // Create reschedule history
    await db.query(
      'INSERT INTO tr_logistic_reschedule (logistic_order_id, old_scheduled_at, new_scheduled_at, reason, rescheduled_by) VALUES (?, ?, ?, ?, ?)',
      [id, order.scheduled_at, newScheduledAt, reason || null, user.id]
    );

    // Update scheduled_at
    await db.query(
      'UPDATE tr_logistic_order SET scheduled_at = ? WHERE id = ?',
      [newScheduledAt, id]
    );

    return res.json({ success: true, message: 'Jadwal berhasil diubah' });
  } catch (error) {
    logger.error('Reschedule order failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal mengubah jadwal' });
  }
}

// ── Get order stats ──────────────────────────────────────────────────────────
export async function getStats(req, res) {
  try {
    const { courierId, outletId } = req.query;

    let query = `
      SELECT
        lo.status,
        COUNT(*) as count
      FROM tr_logistic_order lo
      JOIN tr_transaction t ON lo.transaction_id = t.id
      WHERE lo.deleted_at IS NULL
    `;

    const params = [];

    if (courierId) {
      query += ' AND lo.courier_id = ?';
      params.push(courierId);
    }
    if (outletId) {
      query += ' AND t.outlet_id = ?';
      params.push(outletId);
    }

    query += ' GROUP BY lo.status';

    const [stats] = await db.query(query, params);

    // Format response
    const result = {
      pending: 0,
      assigned: 0,
      on_progress: 0,
      done: 0,
      cancelled: 0,
      failed: 0,
      total: 0,
    };

    stats.forEach(s => {
      if (result[s.status] !== undefined) {
        result[s.status] = parseInt(s.count);
      }
      result.total += parseInt(s.count);
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get order stats failed', { error: error.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik' });
  }
}
