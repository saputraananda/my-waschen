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
    const outletId = tokenOutletId || payloadOutletId;

    // ── Validasi ───────────────────────────────────────────────────────────────
    if (!customerId || !Array.isArray(items) || items.length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Customer dan minimal 1 item wajib diisi' });
    }
    if (!outletId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Outlet ID tidak ditemukan pada token user' });
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
        `SELECT id, service_name, unit, express_extra FROM mst_service WHERE id IN (${ph})`,
        serviceIds
      );
      svcRows.forEach((s) => { serviceMap[s.id] = s; });
    }

    // ── Hitung amounts ─────────────────────────────────────────────────────────
    const isExpress   = items.some((i) => i.isExpress || i.express);
    const pickupFee   = pickup   ? 10000 : 0;
    const deliveryFee = delivery ? 10000 : 0;

    const computedSubtotal = payloadSubtotal != null
      ? Number(payloadSubtotal)
      : items.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);

    const computedTotal = payloadTotal != null
      ? Number(payloadTotal)
      : computedSubtotal - Number(discount || 0) + pickupFee + deliveryFee;

    const paidAmount   = payment.paidAmount   != null ? Number(payment.paidAmount)   : computedTotal;
    const changeAmount = payment.changeAmount != null ? Number(payment.changeAmount) : Math.max(0, paidAmount - computedTotal);
    const paymentStatus = paidAmount >= computedTotal ? 'paid' : 'partial';

    let pickupType = 'self';
    if (pickup)   pickupType = 'pickup';
    if (delivery) pickupType = 'delivery';

    // ── Langkah 1: Insert tr_transaction ──────────────────────────────────────
    await conn.execute(
      `INSERT INTO tr_transaction (
        id, outlet_id, customer_id, cashier_id, session_id,
        transaction_no, source_channel, status, payment_status,
        primary_payment_method, is_express, pickup_type,
        subtotal, discount, delivery_fee, total,
        paid_amount, change_amount,
        estimated_done_at, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, NULL,
        ?, 'kasir', 'pending', ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, NOW(), NOW()
      )`,
      [
        trxId, outletId, customerId, userId,
        transactionNo, paymentStatus,
        mapPayMethod(payment.method), isExpress, pickupType,
        computedSubtotal, Number(discount || 0), pickupFee + deliveryFee, computedTotal,
        paidAmount, changeAmount,
        dueDate || null, notes || null,
      ]
    );

    // ── Langkah 2: Bulk insert tr_transaction_item ────────────────────────────
    for (let i = 0; i < items.length; i++) {
      const item      = items[i];
      const serviceId = item.serviceId || item.id;
      const svc       = serviceMap[serviceId] || {};

      const itemNo         = `${transactionNo}-${String(i + 1).padStart(3, '0')}`;
      const itemIsExpress  = !!(item.isExpress || item.express);
      const itemPrice      = Number(item.price  || 0);
      const itemQty        = Number(item.qty    || 1);
      const itemSubtotal   = item.subtotal != null
        ? Number(item.subtotal)
        : itemPrice * itemQty;

      // Multiplier: jika express dan service punya express_extra, hitung rasionya
      let multiplier = 1.0;
      if (itemIsExpress && svc.express_extra && itemPrice > 0) {
        const basePrice = itemPrice - Number(svc.express_extra);
        multiplier = basePrice > 0 ? Number((itemPrice / basePrice).toFixed(2)) : 1.0;
      }

      await conn.execute(
        `INSERT INTO tr_transaction_item (
          id, transaction_id, service_id, item_no,
          service_name_snapshot, unit_type_snapshot,
          qty, price, express_multiplier, is_express,
          subtotal, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          randomUUID(),
          trxId,
          serviceId,
          itemNo,
          item.serviceName || item.name || svc.service_name || 'Layanan',
          item.unit        || svc.unit  || 'pcs',
          itemQty,
          itemPrice,
          multiplier,
          itemIsExpress,
          itemSubtotal,
          item.notes || null,
        ]
      );
    }

    // ── Langkah 3: Insert tr_payment_item ─────────────────────────────────────
    await conn.execute(
      `INSERT INTO tr_payment_item (
        id, transaction_id, method, amount,
        recorded_by, status, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, 'paid', NOW(), NOW())`,
      [randomUUID(), trxId, mapPayMethod(payment.method), paidAmount, userId]
    );

    // ── Commit ────────────────────────────────────────────────────────────────
    await conn.commit();

    // Fetch hasil untuk response
    const [[trxRow]] = await poolWaschenPos.execute(
      `SELECT
        t.transaction_no AS transactionNo,
        t.total,
        t.subtotal,
        t.discount,
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
          method:       mapPayMethod(payment.method),
          amount:       computedTotal,
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
    const { status, outletId } = req.query;
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
      WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
    `;
    const params = [];

    if (outletId) {
      sql += ' AND t.outlet_id = ?';
      params.push(outletId);
    } else if (userOutletId) {
      sql += ' AND t.outlet_id = ?';
      params.push(userOutletId);
    }

    if (status && status !== 'semua') {
      const statusMap = {
        baru: ['draft', 'pending'],
        proses: ['process'],
        selesai: ['ready_for_pickup', 'ready_for_delivery', 'completed'],
        dibatalkan: ['cancelled'],
      };
      const dbStatuses = statusMap[status];
      if (dbStatuses) {
        sql += ` AND t.status IN (${dbStatuses.map(() => '?').join(',')})`;
        params.push(...dbStatuses);
      }
    }

    sql += ' ORDER BY t.created_at DESC LIMIT 200';

    const [rows] = await poolWaschenPos.execute(sql, params);

    // Fetch items for each transaction
    const transactions = await Promise.all(
      rows.map(async (t) => {
        const [items] = await poolWaschenPos.execute(
          `SELECT
            id, service_id AS serviceId, service_name_snapshot AS name,
            unit_type_snapshot AS unit, qty, price,
            is_express AS express, subtotal
          FROM tr_transaction_item
          WHERE transaction_id = ?`,
          [t.id]
        );
        return {
          ...t,
          id: t.transactionNo || t.id,
          status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
          date: new Date(t.createdAt).toISOString().slice(0, 10),
          dueDate: t.estimatedDoneAt
            ? new Date(t.estimatedDoneAt).toISOString().slice(0, 10)
            : null,
          items: items || [],
          createdBy: t.cashierName,
          total: Number(t.total),
          subtotal: Number(t.subtotal),
          deliveryFee: Number(t.deliveryFee),
        };
      })
    );

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
    const transaction = {
      ...t,
      id: t.transactionNo || t.id,
      status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
      date: new Date(t.createdAt).toISOString().slice(0, 10),
      dueDate: t.estimatedDoneAt
        ? new Date(t.estimatedDoneAt).toISOString().slice(0, 10)
        : null,
      items: items.map((item) => ({
        ...item,
        express: item.express === 1 || item.express === true,
        expressExtra: item.express && item.expressMultiplier > 1
          ? Math.round(item.price * (item.expressMultiplier - 1))
          : 0,
      })),
      createdBy: t.cashierName,
      total: Number(t.total),
      subtotal: Number(t.subtotal),
      deliveryFee: Number(t.deliveryFee),
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

    // Map frontend status ke DB ENUM
    const statusMap = {
      baru:       'pending',
      proses:     'process',
      selesai:    'ready_for_pickup',
      dibatalkan: 'cancelled',
    };

    const dbStatus = statusMap[status];
    if (!dbStatus) {
      return res.status(400).json({ success: false, message: `Status '${status}' tidak valid.` });
    }

    // Cari transaction berdasarkan transaction_no atau UUID id
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
    const pickedUpAt = status === 'diambil' ? 'NOW()' : null;

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
          `SELECT
            service_name_snapshot AS name, is_express AS express
          FROM tr_transaction_item
          WHERE transaction_id = ?`,
          [t.id]
        );

        // Get production progress from item_unit statuses
        const [unitRows] = await poolWaschenPos.execute(
          `SELECT production_status
           FROM tr_item_unit
           WHERE transaction_id = ?`,
          [t.id]
        );

        const progress = (unitRows || []).map((u) => ({
          stage: u.production_status,
          timestamp: new Date().toISOString(),
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
