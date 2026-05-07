import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';

// ─── Helper: Generate WSC-YYMMDD-XXX inside active connection ──────────────────
const generateTransactionNo = async (conn) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const [[{ cnt }]] = await conn.execute(
    "SELECT COUNT(*) AS cnt FROM tr_transaction WHERE DATE(created_at) = CURDATE()"
  );
  const seq = String((cnt || 0) + 1).padStart(3, '0');
  return `WSC-${yy}${mm}${dd}-${seq}`;
};

// ─── Helper: Map frontend payMethod to DB ENUM ─────────────────────────────────
const mapPayMethod = (method) => {
  const map = {
    cash: 'cash',
    transfer: 'transfer',
    deposit: 'deposit',
    qris: 'qris',
  };
  return map[method?.toLowerCase()] || 'cash';
};

// ─── POST /api/transactions/checkout ──────────────────────────────────────────
export const checkoutTransaction = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const {
      customerId,
      outletId: payloadOutletId,
      items,
      payment,
      subtotal: payloadSubtotal,
      discount = 0,
      total: payloadTotal,
      notes,
      dueDate,
      pickup,
      delivery,
    } = req.body;

    const { userId, outletId: tokenOutletId } = req.user;
    let outletId = tokenOutletId || payloadOutletId;

    // --- AUTO-ASSIGN OUTLET FOR ADMIN TESTING ---
    if (!outletId) {
      const [outlets] = await poolWaschenPos.execute('SELECT id FROM mst_outlet WHERE is_active = 1 LIMIT 1');
      if (outlets.length > 0) {
        outletId = outlets[0].id;
      }
    }

    // ── Validasi ───────────────────────────────────────────────────────────────
    if (!customerId || !Array.isArray(items) || items.length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Customer dan minimal 1 item wajib diisi' });
    }
    if (!outletId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Outlet ID tidak ditemukan pada sistem.' });
    }
    if (!payment?.method) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Metode pembayaran wajib diisi' });
    }

    await conn.beginTransaction();

    // ── Generate transaction_no: WSC-YYMMDD-XXX ────────────────────────────────
    const transactionNo = await generateTransactionNo(conn);
    const trxId = randomUUID();

    // ── Batch-fetch service info untuk snapshot name & unit ────────────────────
    const serviceIds = [...new Set(items.map((i) => i.serviceId || i.id).filter(Boolean))];
    const serviceMap = {};
    if (serviceIds.length > 0) {
      const ph = serviceIds.map(() => '?').join(',');
      const [svcRows] = await conn.execute(
        `SELECT id, name AS service_name, unit_type AS unit, price, express_multiplier FROM mst_service WHERE id IN (${ph})`,
        serviceIds
      );
      svcRows.forEach((s) => { serviceMap[s.id] = s; });
    }

    // ── Hitung amounts ─────────────────────────────────────────────────────────
    const isExpress = items.some((i) => i.isExpress || i.express);
    const pickupFee = pickup ? 10000 : 0;
    const deliveryFee = delivery ? 10000 : 0;

    const computedSubtotal = payloadSubtotal != null
      ? Number(payloadSubtotal)
      : items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);

    const computedTotal = payloadTotal != null
      ? Number(payloadTotal)
      : computedSubtotal - Number(discount || 0) + pickupFee + deliveryFee;

    const paidAmount = payment.paidAmount != null ? Number(payment.paidAmount) : computedTotal;
    const changeAmount = payment.changeAmount != null ? Number(payment.changeAmount) : Math.max(0, paidAmount - computedTotal);
    const paymentStatus = paidAmount >= computedTotal ? 'paid' : 'partial';

    let pickupType = 'self';
    if (pickup) pickupType = 'pickup';
    if (delivery) pickupType = 'delivery';

    // ── Langkah 1: Insert tr_transaction ──────────────────────────────────────
    await conn.execute(
      `INSERT INTO tr_transaction (
        id, outlet_id, customer_id, cashier_id, session_id,
        transaction_no, source_channel, status, payment_status,
        primary_payment_method, is_express, pickup_type,
        subtotal, member_discount, promo_discount, manual_discount, delivery_fee, total,
        paid_amount, change_amount,
        estimated_done_at, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, NULL,
        ?, 'kasir', 'pending', ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, NOW(), NOW()
      )`,
      [
        trxId, outletId, customerId, userId,
        transactionNo, paymentStatus,
        mapPayMethod(payment.method), isExpress, pickupType,
        computedSubtotal, 0, 0, Number(discount || 0), pickupFee + deliveryFee, computedTotal,
        paidAmount, changeAmount,
        dueDate || null, notes || null,
      ]
    );

    // ── Langkah 2: Bulk insert tr_transaction_item ────────────────────────────
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const serviceId = item.serviceId || item.id;
      const svc = serviceMap[serviceId] || {};

      const itemNo = `${transactionNo}-${String(i + 1).padStart(3, '0')}`;
      const itemIsExpress = !!(item.isExpress || item.express);
      const itemPrice = Number(item.price || 0);
      const itemQty = Number(item.qty || 1);
      const itemSubtotal = item.subtotal != null
        ? Number(item.subtotal)
        : itemPrice * itemQty;

      // Multiplier: jika express, gunakan express_multiplier dari DB
      let multiplier = 1.0;
      if (itemIsExpress && svc.express_multiplier) {
        multiplier = Number(svc.express_multiplier) || 1.0;
      }

      const txItemId = randomUUID();

      await conn.execute(
        `INSERT INTO tr_transaction_item (
          id, transaction_id, service_id, item_no,
          service_name_snapshot, unit_type_snapshot,
          qty, price, express_multiplier, is_express,
          subtotal, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          txItemId,
          trxId,
          serviceId,
          itemNo,
          item.serviceName || item.name || svc.service_name || 'Layanan',
          item.unit || svc.unit || 'pcs',
          itemQty,
          itemPrice,
          multiplier,
          itemIsExpress,
          itemSubtotal,
          item.notes || null,
        ]
      );

      // --- INTEGRASI PRODUKSI: Buat unit fisik untuk ditrack oleh tim cuci ---
      await conn.execute(
        `INSERT INTO tr_item_unit (
          id, transaction_id, transaction_item_id, unit_no,
          unit_sequence, qty_share, production_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, 'received', NOW(), NOW())`,
        [
          randomUUID(),
          trxId,
          txItemId,
          `${itemNo}-U1`,
          itemQty
        ]
      );
    }

    // ── Langkah 3: Insert tr_payment_item ─────────────────────────────────────
    await conn.execute(
      `INSERT INTO tr_payment_item (
        id, transaction_id, method, amount,
        recorded_by, status, paid_at, recorded_at
      ) VALUES (?, ?, ?, ?, ?, 'paid', NOW(), NOW())`,
      [randomUUID(), trxId, mapPayMethod(payment.method), paidAmount, userId]
    );

    // ── Langkah 3b: QRIS EDC Integration Log ────────────────────────────────
    if (mapPayMethod(payment.method) === 'qris') {
      try {
        await conn.execute(
          `INSERT INTO tr_payment_integration_log (
            id, transaction_id, method, event_type, payload, response_data,
            created_at
          ) VALUES (?, ?, 'qris', 'EDC_REQUEST_SUCCESS', ?, ?, NOW())`,
          [
            randomUUID(), trxId,
            JSON.stringify({ amount: computedTotal, transactionNo }),
            JSON.stringify({ status: 'success', simulated: true, timestamp: new Date().toISOString() }),
          ]
        );
      } catch { /* tabel belum ada, skip */ }
    }

    // ── Langkah 4: Insert tr_logistic_order ────────────────────────────────────
    const { scheduleAt, areaZoneId: payloadAreaZoneId } = req.body;
    const logisticSchedule = scheduleAt ? new Date(scheduleAt) : (dueDate ? new Date(dueDate) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

    if (pickup) {
      await conn.execute(
        `INSERT INTO tr_logistic_order (
          id, transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, created_by, created_at, updated_at
        ) VALUES (?, ?, 'pickup', ?, ?, ?, 'pending', ?, NOW(), NOW())`,
        [randomUUID(), trxId, payloadAreaZoneId || null, pickupFee || 10000, logisticSchedule, userId]
      );
    }

    if (delivery) {
      await conn.execute(
        `INSERT INTO tr_logistic_order (
          id, transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, created_by, created_at, updated_at
        ) VALUES (?, ?, 'delivery', ?, ?, ?, 'pending', ?, NOW(), NOW())`,
        [randomUUID(), trxId, payloadAreaZoneId || null, deliveryFee || 10000, logisticSchedule, userId]
      );
    }

    // ── Commit ────────────────────────────────────────────────────────────────
    await conn.commit();

    // Fetch hasil untuk response
    const [[trxRow]] = await poolWaschenPos.execute(
      `SELECT
        t.transaction_no AS transactionNo,
        t.total,
        t.subtotal,
        (t.member_discount + t.promo_discount + t.manual_discount) AS discount,
        t.paid_amount    AS paidAmount,
        t.change_amount  AS changeAmount,
        t.delivery_fee   AS deliveryFee,
        t.pickup_type    AS pickupType,
        t.is_express     AS isExpress,
        t.notes,
        t.estimated_done_at AS estimatedDoneAt,
        t.created_at        AS createdAt,
        c.name  AS customerName,
        c.phone AS customerPhone
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      WHERE t.id = ?`,
      [trxId]
    );

    const [itemRows] = await poolWaschenPos.execute(
      `SELECT
        service_id          AS serviceId,
        service_name_snapshot AS serviceName,
        unit_type_snapshot  AS unit,
        qty, price,
        is_express          AS isExpress,
        subtotal
      FROM tr_transaction_item
      WHERE transaction_id = ?`,
      [trxId]
    );

    return res.status(201).json({
      success: true,
      message: 'Nota berhasil dibuat',
      data: {
        ...trxRow,
        status: 'baru',
        items: itemRows,
        payment: {
          method: mapPayMethod(payment.method),
          amount: computedTotal,
          paidAmount,
          changeAmount,
        },
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[checkoutTransaction] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat nota. Transaksi dibatalkan.',
    });
  } finally {
    conn.release();
  }
};

// ─── Helper: Map DB status ke frontend status ──────────────────────────────────
const mapDbStatusToFrontend = (status, pickedUpAt) => {
  if (status === 'cancelled') return 'dibatalkan';
  if (pickedUpAt) return 'diambil';
  if (status === 'completed' || status === 'ready_for_pickup' || status === 'ready_for_delivery') return 'selesai';
  if (status === 'process') return 'proses';
  return 'baru'; // draft, pending
};

// ─── GET /api/transactions ─────────────────────────────────────────────────────
export const getTransactions = async (req, res) => {
  try {
    const { status, outletId, customerId } = req.query;
    const userOutletId = req.user?.outletId;

    let sql = `
      SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        t.is_express AS isExpress,
        t.total,
        t.subtotal,
        t.delivery_fee AS deliveryFee,
        t.primary_payment_method AS payMethod,
        t.notes,
        t.estimated_done_at AS estimatedDoneAt,
        t.created_at AS createdAt,
        c.name AS customerName,
        c.phone AS customerPhone,
        u.name AS cashierName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      JOIN mst_user u ON u.id = t.cashier_id
      WHERE t.deleted_at IS NULL
    `;
    const params = [];

    if (customerId) {
      sql += ' AND t.customer_id = ?';
      params.push(customerId);
    }

    if (outletId) {
      sql += ' AND t.outlet_id = ?';
      params.push(outletId);
    } else if (userOutletId && !customerId) {
      sql += ' AND t.outlet_id = ?';
      params.push(userOutletId);
    }

    if (status && status !== 'semua') {
      const statusMap = {
        baru: ['draft', 'pending'],
        proses: ['process'],
        selesai: ['ready_for_pickup', 'ready_for_delivery', 'completed'],
        dibatalkan: ['cancelled'],
        diambil: ['completed'],
      };
      const dbStatuses = statusMap[status];
      if (dbStatuses) {
        sql += ` AND t.status IN (${dbStatuses.map(() => '?').join(',')})${status === 'diambil' ? ' AND t.picked_up_at IS NOT NULL' : ''}`;
        params.push(...dbStatuses);
      }
    } else {
      sql += " AND t.status <> 'cancelled'";
    }

    sql += ' ORDER BY t.created_at DESC LIMIT 200';

    const [rows] = await poolWaschenPos.execute(sql, params);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const txIds = rows.map(r => r.id);
    const placeholders = txIds.map(() => '?').join(',');

    // Fetch all items for these transactions in one query
    const [allItems] = await poolWaschenPos.execute(
      `SELECT
        transaction_id,
        id, service_id AS serviceId, service_name_snapshot AS name,
        unit_type_snapshot AS unit, qty, price,
        is_express AS express, subtotal
      FROM tr_transaction_item
      WHERE transaction_id IN (${placeholders})`,
      txIds
    );

    // Group items by transaction_id
    const itemsMap = {};
    for (const item of allItems) {
      if (!itemsMap[item.transaction_id]) itemsMap[item.transaction_id] = [];
      itemsMap[item.transaction_id].push(item);
    }

    const transactions = rows.map((t) => ({
      ...t,
      id: t.transactionNo || t.id,
      status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
      date: new Date(t.createdAt).toISOString().slice(0, 10),
      dueDate: t.estimatedDoneAt
        ? new Date(t.estimatedDoneAt).toISOString().slice(0, 10)
        : null,
      items: itemsMap[t.id] || [],
      createdBy: t.cashierName,
      total: Number(t.total),
      subtotal: Number(t.subtotal),
      deliveryFee: Number(t.deliveryFee),
    }));

    return res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    console.error('[getTransactions] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat transaksi.' });
  }
};

// ─── GET /api/transactions/:id ─────────────────────────────────────────────────
export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [trxRows] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        t.is_express AS isExpress,
        t.total,
        t.subtotal,
        t.delivery_fee AS deliveryFee,
        t.paid_amount AS paidAmount,
        t.change_amount AS changeAmount,
        t.primary_payment_method AS payMethod,
        t.notes,
        t.estimated_done_at AS estimatedDoneAt,
        t.created_at AS createdAt,
        c.name AS customerName,
        c.phone AS customerPhone,
        u.name AS cashierName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      JOIN mst_user u ON u.id = t.cashier_id
      WHERE t.deleted_at IS NULL AND (t.id = ? OR t.transaction_no = ?)
      LIMIT 1`,
      [id, id]
    );

    if (trxRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const [items] = await poolWaschenPos.execute(
      `SELECT
        id, service_id AS serviceId, service_name_snapshot AS name,
        unit_type_snapshot AS unit, qty, price,
        is_express AS express, express_multiplier AS expressMultiplier, subtotal
      FROM tr_transaction_item
      WHERE transaction_id = ?`,
      [trxRows[0].id]
    );

    const t = trxRows[0];

    const [units] = await poolWaschenPos.execute(
      `SELECT unit_no AS unitNo, transaction_item_id AS txItemId
       FROM tr_item_unit
       WHERE transaction_id = ?`,
      [t.id]
    );

    // Get Log History untuk dipassing
    const [logRows] = await poolWaschenPos.execute(
      `SELECT production_status, created_at FROM tr_production_log
       WHERE transaction_id = ? ORDER BY created_at ASC`,
      [t.id]
    );
    const reverseMap = { 'received': 'Diterima', 'washing': 'Cuci', 'drying': 'Pengeringan', 'ironing': 'Setrika', 'packing': 'Packing', 'ready': 'Selesai' };
    const progressLogs = logRows.map(l => ({ stage: reverseMap[l.production_status] || l.production_status, timestamp: l.created_at }));

    const transaction = {
      ...t,
      id: t.transactionNo || t.id,
      status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
      date: new Date(t.createdAt).toISOString().slice(0, 10),
      dueDate: t.estimatedDoneAt ? new Date(t.estimatedDoneAt).toISOString().slice(0, 10) : null,
      items: items.map((item) => ({
        ...item,
        express: item.express === 1 || item.express === true,
        expressExtra: item.express && item.expressMultiplier > 1
          ? Math.round(item.price * (item.expressMultiplier - 1))
          : 0,
      })),
      units,
      progress: progressLogs,
      createdBy: t.cashierName,
      total: Number(t.total),
      subtotal: Number(t.subtotal),
      deliveryFee: Number(t.deliveryFee),
      paidAmount: Number(t.paidAmount || 0),
      changeAmount: Number(t.changeAmount || 0),
      customerName: t.customerName,
      customerPhone: t.customerPhone,
      payMethod: t.payMethod,
      notes: t.notes,
    };

    return res.status(200).json({ success: true, data: transaction });
  } catch (err) {
    console.error('[getTransactionById] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat detail transaksi.' });
  }
};

// ─── GET /api/transactions/dashboard/stats ─────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;

    const [todayRows] = await poolWaschenPos.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN t.is_express = TRUE THEN 1 ELSE 0 END) AS expressCount,
        SUM(CASE WHEN t.status IN ('draft', 'pending', 'process') THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN t.status IN ('ready_for_pickup', 'ready_for_delivery', 'completed') THEN 1 ELSE 0 END) AS completedCount
      FROM tr_transaction t
      WHERE t.deleted_at IS NULL AND DATE(t.created_at) = CURDATE()
      ${userOutletId ? 'AND t.outlet_id = ?' : ''}`,
      userOutletId ? [userOutletId] : []
    );

    const [recentRows] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        t.is_express AS isExpress,
        t.total,
        t.created_at AS createdAt,
        c.name AS customerName,
        u.name AS cashierName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      JOIN mst_user u ON u.id = t.cashier_id
      WHERE t.deleted_at IS NULL
      ${userOutletId ? 'AND t.outlet_id = ?' : ''}
      ORDER BY t.created_at DESC
      LIMIT 5`,
      userOutletId ? [userOutletId] : []
    );

    const recent = await Promise.all(
      recentRows.map(async (t) => {
        const [items] = await poolWaschenPos.execute(
          `SELECT
            service_name_snapshot AS name, is_express AS express
          FROM tr_transaction_item
          WHERE transaction_id = ?`,
          [t.id]
        );
        return {
          ...t,
          id: t.transactionNo || t.id,
          status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
          date: new Date(t.createdAt).toISOString().slice(0, 10),
          items: items || [],
          total: Number(t.total),
          createdBy: t.cashierName,
          customerName: t.customerName,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        today: {
          total: todayRows[0]?.total || 0,
          express: todayRows[0]?.expressCount || 0,
          pending: todayRows[0]?.pendingCount || 0,
          completed: todayRows[0]?.completedCount || 0,
        },
        recent,
      },
    });
  } catch (err) {
    console.error('[getDashboardStats] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik.' });
  }
};

// ─── PUT /api/transactions/:id/status ─────────────────────────────────────────
export const updateTransactionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status wajib diisi.' });
    }

    const statusMap = {
      baru: 'pending',
      proses: 'process',
      selesai: 'ready_for_pickup',
      dibatalkan: 'cancelled',
    };

    const dbStatus = statusMap[status];
    if (!dbStatus) {
      return res.status(400).json({ success: false, message: `Status '${status}' tidak valid.` });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?)
       LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const txUUID = rows[0].id;

    if (status === 'diambil') {
      await poolWaschenPos.execute(
        `UPDATE tr_transaction SET status = 'completed', picked_up_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [txUUID]
      );
    } else {
      await poolWaschenPos.execute(
        `UPDATE tr_transaction SET status = ?, picked_up_at = NULL, updated_at = NOW() WHERE id = ?`,
        [dbStatus, txUUID]
      );
    }

    return res.status(200).json({ success: true, message: 'Status transaksi diperbarui.' });
  } catch (err) {
    console.error('[updateTransactionStatus] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status transaksi.' });
  }
};

// ─── GET /api/transactions/production/queue ──────────────────────────────────────
export const getProductionQueue = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        t.is_express AS isExpress,
        t.total,
        t.created_at AS createdAt,
        c.name AS customerName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      WHERE t.deleted_at IS NULL
      ${userOutletId ? 'AND t.outlet_id = ?' : ''}
      AND t.status IN ('draft', 'pending', 'process')
      ORDER BY t.is_express DESC, t.created_at ASC
      LIMIT 100`,
      userOutletId ? [userOutletId] : []
    );

    const transactions = await Promise.all(
      rows.map(async (t) => {
        const [items] = await poolWaschenPos.execute(
          `SELECT service_name_snapshot AS name, is_express AS express
           FROM tr_transaction_item WHERE transaction_id = ?`,
          [t.id]
        );

        // PERBAIKAN: Ambil riwayat urut dari tabel LOG (bukan dari tr_item_unit yang cuma 1 baris)
        const [logRows] = await poolWaschenPos.execute(
          `SELECT production_status, created_at FROM tr_production_log
           WHERE transaction_id = ? ORDER BY created_at ASC`,
          [t.id]
        );

        // Map status bahasa inggris (MySQL) kembali ke Frontend (Bahasa Indonesia)
        const reverseMap = {
          'received': 'Diterima',
          'washing': 'Cuci',
          'drying': 'Pengeringan',
          'ironing': 'Setrika',
          'packing': 'Packing',
          'ready': 'Selesai'
        };

        const progress = (logRows || []).map((l) => ({
          stage: reverseMap[l.production_status] || l.production_status,
          timestamp: l.created_at,
        }));

        return {
          ...t,
          id: t.transactionNo || t.id,
          status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
          date: new Date(t.createdAt).toISOString().slice(0, 10),
          items: items || [],
          total: Number(t.total),
          customerName: t.customerName,
          progress,
        };
      })
    );

    return res.status(200).json({ success: true, data: transactions });
  } catch (err) {
    console.error('[getProductionQueue] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat antrian produksi.' });
  }
};

// ─── PATCH /api/transactions/:id/cancel ──────────────────────────────────────
export const cancelTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Alasan pembatalan wajib diisi.' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, status FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const tx = rows[0];

    if (tx.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'Transaksi sudah dibatalkan.' });
    }
    if (tx.status === 'completed' && !rows[0].picked_up_at) {
      return res.status(409).json({ success: false, message: 'Transaksi sudah selesai, tidak bisa dibatalkan.' });
    }

    const [existingReq] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction_approval WHERE transaction_id = ? AND status = 'pending' LIMIT 1`,
      [tx.id]
    );

    if (existingReq.length > 0) {
      return res.status(409).json({ success: false, message: 'Sudah ada pengajuan pembatalan yang masih menunggu persetujuan Owner.' });
    }

    const isGlobalRole = ['admin', 'superadmin', 'owner'].includes(req.user?.roleCode);
    const approvalStatus = isGlobalRole ? 'approved' : 'pending';
    const approvedBy = isGlobalRole ? req.user?.id : null;

    await poolWaschenPos.execute(
      `INSERT INTO tr_transaction_approval 
        (id, transaction_id, requested_by, approved_by, type, status, reason, requested_at, resolved_at)
       VALUES (?, ?, ?, ?, 'cancel_nota', ?, ?, NOW(), ?)`,
      [
        randomUUID(), tx.id, req.user?.id, approvedBy,
        approvalStatus, reason.trim(),
        isGlobalRole ? new Date() : null
      ]
    );

    if (isGlobalRole) {
      await poolWaschenPos.execute(
        `UPDATE tr_transaction
         SET status = 'cancelled',
             notes  = CONCAT(COALESCE(notes, ''), IF(notes IS NULL OR notes = '', '', ' | '), '[Batal (Auto-Approved): ', ?, ']'),
             updated_at = NOW()
         WHERE id = ?`,
        [reason.trim(), tx.id]
      );
      return res.status(200).json({ success: true, message: 'Transaksi berhasil dibatalkan (Otorisasi Owner).' });
    }

    return res.status(200).json({ success: true, message: 'Pengajuan pembatalan berhasil dikirim. Menunggu persetujuan Owner.' });
  } catch (err) {
    console.error('[cancelTransaction] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan transaksi.' });
  }
};

// ─── PERBAIKAN: PATCH /api/transactions/:id/production-stage ─────────────────
const VALID_STAGES = ['Diterima', 'Cuci', 'Pengeringan', 'Setrika', 'Packing', 'Selesai'];

export const updateProductionStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    // Pastikan kata yang dikirim Frontend ada di daftar VALID_STAGES
    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({ success: false, message: `Stage tidak valid. Pilih: ${VALID_STAGES.join(', ')}` });
    }

    // 1. MAPPING DATA
    // Translate bahasa Frontend ke ENUM MySQL
    const stageMap = {
      'Diterima': 'received',
      'Cuci': 'washing',
      'Pengeringan': 'drying',
      'Setrika': 'ironing',
      'Packing': 'packing',
      'Selesai': 'ready'
    };

    const dbStatus = stageMap[stage] || 'received';

    // Cari transaksi
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, pickup_type FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const txId = rows[0].id;
    const pickupType = rows[0].pickup_type;

    // 2. JALANKAN UPDATE (Bukan Insert!)
    // Merubah status unit item di transaksi ini
    await poolWaschenPos.execute(
      `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE transaction_id = ?`,
      [dbStatus, txId]
    );

    // 3. JALANKAN INSERT LOG TIMELINE
    // Mencatat siapa yang mengerjakan ke dalam riwayat Log
    await poolWaschenPos.execute(
      `INSERT INTO tr_production_log (id, transaction_id, production_status, notes, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [randomUUID(), txId, dbStatus, `Stage diubah menjadi: ${stage}`]
    );

    // 4. SYNC TRANSAKSI DAN NOTIFIKASI
    if (dbStatus === 'packing' || dbStatus === 'ready') {
      const nextStatus = pickupType === 'delivery' ? 'ready_for_delivery' : 'ready_for_pickup';

      await poolWaschenPos.execute(
        `UPDATE tr_transaction SET status = ?, updated_at = NOW() WHERE id = ?`,
        [nextStatus, txId]
      );

      // --- OTOMATIS KIRIM NOTIFIKASI KE CUSTOMER ---
      try {
        const notifId = randomUUID();
        await poolWaschenPos.execute(
          `INSERT INTO tr_notification (id, customer_id, transaction_id, title, message, type, is_read, created_at)
           SELECT ?, customer_id, id, 'Cucian Selesai!', CONCAT('Cucian Anda dengan nota ', transaction_no, ' sudah selesai dipacking dan siap ', IF(pickup_type='delivery', 'diantar oleh kurir kami.', 'diambil di outlet.')), 'transaction', 0, NOW()
           FROM tr_transaction WHERE id = ?`,
          [notifId, txId]
        );
      } catch (err) { /* Abaikan jika notifikasi gagal, produksi tetap jalan */ }
    } else {
      await poolWaschenPos.execute(
        `UPDATE tr_transaction SET status = 'process', updated_at = NOW() WHERE id = ? AND status IN ('draft','pending','baru')`,
        [txId]
      );
    }

    // Ambil progress terbaru setelah diupdate dari tr_production_log
    const [logRows] = await poolWaschenPos.execute(
      `SELECT production_status AS stage, created_at AS timestamp
       FROM tr_production_log
       WHERE transaction_id = ?
       ORDER BY created_at ASC`,
      [txId]
    );

    const reverseMap = { 'received': 'Diterima', 'washing': 'Cuci', 'drying': 'Pengeringan', 'ironing': 'Setrika', 'packing': 'Packing', 'ready': 'Selesai' };
    const progress = logRows.map(l => ({ stage: reverseMap[l.stage] || l.stage, timestamp: l.timestamp }));

    return res.status(200).json({
      success: true,
      message: `Stage '${stage}' berhasil dicatat.`,
      data: { progress },
    });
  } catch (err) {
    console.error('[updateProductionStage] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mencatat progress produksi.' });
  }
};

// ─── POST /api/transactions/:id/request-approval ────────────────────────────
export const requestApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, reason } = req.body;
    const userId = req.user?.userId;

    if (!['cancel_nota', 'delete_transaction'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type harus cancel_nota atau delete_transaction.' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'Alasan wajib diisi.' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, status FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const tx = rows[0];

    if (tx.status === 'cancelled') {
      return res.status(409).json({ success: false, message: 'Transaksi sudah dibatalkan.' });
    }

    const [existingReq] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction_approval WHERE transaction_id = ? AND type = ? AND status = 'pending' LIMIT 1`,
      [tx.id, type]
    );

    if (existingReq.length > 0) {
      return res.status(409).json({ success: false, message: 'Sudah ada pengajuan yang masih menunggu persetujuan.' });
    }

    await poolWaschenPos.execute(
      `INSERT INTO tr_transaction_approval 
        (id, transaction_id, requested_by, type, status, reason, requested_at)
       VALUES (?, ?, ?, ?, 'pending', ?, NOW())`,
      [randomUUID(), tx.id, userId, type, reason.trim()]
    );

    return res.status(200).json({
      success: true,
      message: type === 'cancel_nota'
        ? 'Pengajuan pembatalan berhasil dikirim. Menunggu persetujuan Admin.'
        : 'Pengajuan penghapusan berhasil dikirim. Menunggu persetujuan Admin.',
    });
  } catch (err) {
    console.error('[requestApproval] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengajukan approval.' });
  }
};

// ─── POST /api/transactions/:id/condition ──────────────────────────────────
export const saveItemCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const { photos, notes, isDamage } = req.body;
    const userId = req.user?.id;

    const [txRow] = await poolWaschenPos.execute(`SELECT id FROM tr_transaction WHERE id = ? OR transaction_no = ? LIMIT 1`, [id, id]);
    if (txRow.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    const txId = txRow[0].id;

    const [unitRow] = await poolWaschenPos.execute(`SELECT id FROM tr_item_unit WHERE transaction_id = ? LIMIT 1`, [txId]);

    if (unitRow.length > 0) {
      const unitId = unitRow[0].id;
      const photoType = isDamage ? 'damage' : 'initial_condition';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await poolWaschenPos.execute(
        `INSERT INTO tr_item_photo (id, item_unit_id, photo_url, photo_type, notes, expires_at, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [randomUUID(), unitId, photos[0] || 'no_photo.jpg', photoType, notes || null, expiresAt, userId]
      );

      if (isDamage) {
        await poolWaschenPos.execute(
          `UPDATE tr_transaction SET notes = CONCAT(COALESCE(notes, ''), ' | [AWAS ADA KERUSAKAN AWAL]') WHERE id = ?`,
          [txId]
        );
      }
    }

    return res.status(200).json({ success: true, message: 'Kondisi barang berhasil disimpan.' });
  } catch (err) {
    console.error('[saveItemCondition] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan kondisi barang.' });
  }
};

// ─── POST /api/transactions/:id/review ─────────────────────────────────────
export const saveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const [txRow] = await poolWaschenPos.execute(`SELECT id, customer_id, outlet_id FROM tr_transaction WHERE id = ? OR transaction_no = ? LIMIT 1`, [id, id]);
    if (txRow.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    const tx = txRow[0];

    const [existing] = await poolWaschenPos.execute(`SELECT id FROM tr_customer_review WHERE transaction_id = ? LIMIT 1`, [tx.id]);
    if (existing.length > 0) return res.status(409).json({ success: false, message: 'Review sudah diberikan sebelumnya.' });

    await poolWaschenPos.execute(
      `INSERT INTO tr_customer_review (id, outlet_id, customer_id, transaction_id, rating, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [randomUUID(), tx.outlet_id, tx.customer_id, tx.id, rating, comment || null]
    );

    return res.status(200).json({ success: true, message: 'Review berhasil disimpan.' });
  } catch (err) {
    console.error('[saveReview] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan review.' });
  }
};