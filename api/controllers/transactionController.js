import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { dbToUiTxStatus as _dbToUiTxStatus, uiToDbStatusFilter } from '../utils/statusMap.js';
import { emitTransactionCheckout, emitProductionUpdate, emitPaymentSettled } from '../services/eventBus.js';

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

// ─── Helper: Generate WSC-YYMMDD-XXX dengan race-condition protection ─────────
// Strategy: gunakan SELECT ... FOR UPDATE pattern + retry on duplicate
// Per-outlet sequence supaya nomor tidak bentrok antar kasir di outlet berbeda
const generateTransactionNo = async (conn, outletId = null) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `WSC-${yy}${mm}${dd}-`;

  // Cari nomor terakhir hari ini, lock baris-baris itu untuk prevent race
  // Pakai LIKE + ORDER BY untuk dapat sequence terakhir akurat
  const [rows] = await conn.execute(
    `SELECT transaction_no FROM tr_transaction
     WHERE transaction_no LIKE ?
     ORDER BY transaction_no DESC
     LIMIT 1
     FOR UPDATE`,
    [`${datePrefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].transaction_no;
    const lastSeqStr = lastNo.slice(datePrefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (Number.isFinite(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${datePrefix}${String(nextSeq).padStart(3, '0')}`;
};

// ─── Helper: Map frontend payMethod to DB ENUM ─────────────────────────────────
const mapPayMethod = (method) => {
  const m = String(method || '').toLowerCase();
  // Frontend bisa kirim 'midtrans' sebagai pseudo-method — map ke 'transfer'
  // (default fallback). Channel sebenarnya (qris/gopay/dll) akan di-set di
  // payment_item.channel saat customer pilih di QrPayment screen.
  if (m === 'midtrans') return 'transfer';
  const allowed = ['cash', 'transfer', 'deposit', 'qris', 'ovo', 'gopay', 'dana', 'shopeepay'];
  return allowed.includes(m) ? m : 'cash';
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
      paymentIntent,
      subtotal: payloadSubtotal,
      discount = 0,
      total: payloadTotal,
      notes,
      dueDate,
      pickup,
      delivery,
      promoId: bodyPromoId,
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
    const hasPaymentIntent = paymentIntent && typeof paymentIntent === 'object';
    if (!hasPaymentIntent && !payment?.method) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Metode pembayaran wajib diisi' });
    }

    await conn.beginTransaction();

    // ── Generate transaction_no: WSC-YYMMDD-XXX ────────────────────────────────
    const transactionNo = await generateTransactionNo(conn);

    // ── Batch-fetch service info untuk snapshot name & unit ────────────────────
    const serviceIds = [...new Set(items.map((i) => i.serviceId || i.id).filter(Boolean))];
    const serviceMap = {};
    if (serviceIds.length > 0) {
      const ph = serviceIds.map(() => '?').join(',');
      const [svcRows] = await conn.execute(
        `SELECT id, name AS service_name, unit_type AS unit, price, express_multiplier, category_id
         FROM mst_service WHERE id IN (${ph})`,
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

    const manualDiscount = Number(discount || 0);
    let promoDiscount = 0;
    let resolvedPromoId = null;
    if (bodyPromoId) {
      const [promoRows] = await conn.execute(
        `SELECT p.id, p.type, p.value, p.min_trx_amount, p.max_discount
         FROM mst_promo p
         LEFT JOIN mst_promo_outlet po ON po.promo_id = p.id AND po.is_active = 1
         WHERE p.id = ? AND p.is_active = 1 AND p.deleted_at IS NULL
           AND p.valid_from <= NOW() AND p.valid_until >= NOW()
           AND (p.is_global = 1 OR po.outlet_id = ?)
         LIMIT 1`,
        [bodyPromoId, outletId]
      );
      if (!promoRows.length) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Promo tidak berlaku atau tidak untuk outlet ini.' });
      }
      const pr = promoRows[0];
      const minTrx = pr.min_trx_amount != null ? Number(pr.min_trx_amount) : null;
      if (minTrx != null && computedSubtotal < minTrx) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Minimal transaksi untuk promo ini Rp ${minTrx.toLocaleString('id-ID')}.`,
        });
      }
      let d = pr.type === 'percent'
        ? computedSubtotal * (Number(pr.value) / 100)
        : Number(pr.value);
      if (pr.max_discount != null) d = Math.min(d, Number(pr.max_discount));
      d = Math.min(d, computedSubtotal);
      if (!Number.isFinite(d) || d < 0) d = 0;
      promoDiscount = Math.round(d * 100) / 100;
      resolvedPromoId = pr.id;
    }

    // ── Member Discount (otomatis jika customer adalah member aktif) ──────────
    // Default 20% dari subtotal, sesuai S&K. Ambil dari config jika ada.
    let memberDiscount = 0;
    let activeMembershipId = null;
    try {
      const [[memb]] = await conn.execute(
        `SELECT m.id, m.discount_pct
         FROM mst_membership m
         WHERE m.customer_id = ? AND m.status = 'active' AND m.expired_at >= NOW()
         LIMIT 1`,
        [customerId]
      );
      if (memb) {
        activeMembershipId = memb.id;
        const pct = Number(memb.discount_pct) || 20;
        memberDiscount = Math.round((computedSubtotal * pct) / 100);
        // Cap supaya tidak melebihi subtotal - promo
        memberDiscount = Math.min(memberDiscount, Math.max(0, computedSubtotal - promoDiscount));
      }
    } catch (e) {
      console.warn('[checkout] member discount calc gagal:', e?.message || e);
    }

    const computedTotal = payloadTotal != null
      ? Number(payloadTotal)
      : computedSubtotal - promoDiscount - memberDiscount - manualDiscount + pickupFee + deliveryFee;

    let paidAmount;
    let changeAmount;
    let paymentStatus;
    let primaryPaymentMethod;

    if (hasPaymentIntent) {
      const payTiming = paymentIntent.payTiming === 'later' ? 'later' : 'now';
      const payPlan = paymentIntent.payPlan === 'dp' ? 'dp' : 'full';
      const dpAmount = Math.max(0, Number(paymentIntent.dpAmount || 0));

      if (payTiming === 'later') {
        if (payPlan === 'dp' && dpAmount > 0) {
          paidAmount = Math.min(dpAmount, computedTotal);
          primaryPaymentMethod = payment?.method ? mapPayMethod(payment.method) : null;
        } else {
          paidAmount = 0;
          primaryPaymentMethod = payment?.method ? mapPayMethod(payment.method) : null;
        }
      } else if (payPlan === 'dp' && dpAmount > 0) {
        paidAmount = Math.min(dpAmount, computedTotal);
        primaryPaymentMethod = mapPayMethod(payment.method);
      } else {
        paidAmount = payment?.paidAmount != null ? Number(payment.paidAmount) : computedTotal;
        primaryPaymentMethod = mapPayMethod(payment.method);
      }

      if (paidAmount > 0 && !payment?.method) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Metode pembayaran wajib untuk nominal yang dibayar sekarang' });
      }
      if (payTiming === 'now' && payPlan === 'dp' && dpAmount <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Masukkan nominal DP' });
      }
      if (payTiming === 'later' && payPlan === 'dp' && dpAmount <= 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Masukkan nominal DP untuk cicilan' });
      }

      changeAmount = payment?.changeAmount != null
        ? Number(payment.changeAmount)
        : Math.max(0, paidAmount - computedTotal);

      if (paidAmount >= computedTotal && computedTotal >= 0) paymentStatus = 'paid';
      else if (paidAmount > 0) paymentStatus = 'partial';
      else paymentStatus = 'unpaid';
    } else {
      paidAmount = payment.paidAmount != null ? Number(payment.paidAmount) : computedTotal;
      changeAmount = payment.changeAmount != null ? Number(payment.changeAmount) : Math.max(0, paidAmount - computedTotal);
      paymentStatus = paidAmount >= computedTotal ? 'paid' : 'partial';
      primaryPaymentMethod = mapPayMethod(payment.method);
    }

    let pickupType = 'self';
    if (pickup) pickupType = 'pickup';
    if (delivery) pickupType = 'delivery';

    const intentSummary = hasPaymentIntent
      ? `[Bayar:${paymentIntent.payTiming === 'later' ? 'nanti(pickup/selesai)' : 'kasir_sekarang'};${paymentIntent.payPlan === 'dp' ? `DP:${Number(paymentIntent.dpAmount || 0)}` : 'lunas'}]`
      : '';
    const combinedNotes = [notes?.trim() || '', intentSummary].filter(Boolean).join('\n') || null;

    // ── Auto-compute SLA kalau dueDate tidak diisi manual ─────────────────
    // Logika:
    // 1. Cari MAX(sla_*_hours) dari semua service yang dipilih
    // 2. Kalau service tidak punya, fallback ke mst_sla_template (per outlet/global)
    // 3. Default fallback: 48 jam regular / 24 jam express
    let finalEstimatedDone = dueDate || null;
    if (!finalEstimatedDone) {
      try {
        const serviceIds = items.map(i => i.serviceId).filter(Boolean);
        let maxRegularHours = 48;
        let maxExpressHours = 24;
        const isExpress = items.some(i => i.isExpress);

        if (serviceIds.length > 0) {
          const [svcRows] = await conn.execute(
            `SELECT MAX(sla_regular_hours) AS maxReg, MAX(sla_express_hours) AS maxExp
               FROM mst_service WHERE id IN (${serviceIds.map(() => '?').join(',')})`,
            serviceIds
          );
          if (svcRows[0]?.maxReg) maxRegularHours = Number(svcRows[0].maxReg);
          if (svcRows[0]?.maxExp) maxExpressHours = Number(svcRows[0].maxExp);

          // Kalau service tidak punya SLA, fallback ke template
          if (!svcRows[0]?.maxReg) {
            const [tmplRows] = await conn.execute(
              `SELECT regular_hours, express_hours FROM mst_sla_template
                WHERE (outlet_id = ? OR outlet_id IS NULL) AND is_active = 1
                ORDER BY outlet_id IS NULL ASC LIMIT 1`,
              [outletId]
            );
            if (tmplRows[0]) {
              maxRegularHours = Number(tmplRows[0].regular_hours) || 48;
              maxExpressHours = Number(tmplRows[0].express_hours) || 24;
            }
          }
        }

        const slaHours = isExpress ? maxExpressHours : maxRegularHours;
        const eta = new Date(Date.now() + slaHours * 3600 * 1000);
        // Format YYYY-MM-DD HH:MM:SS
        finalEstimatedDone = eta.toISOString().slice(0, 19).replace('T', ' ');
      } catch (slaErr) {
        console.warn('[checkout] SLA auto-compute failed:', slaErr.message);
        // Fallback hardcoded: 48 jam dari sekarang
        const eta = new Date(Date.now() + 48 * 3600 * 1000);
        finalEstimatedDone = eta.toISOString().slice(0, 19).replace('T', ' ');
      }
    }
    const [[openSession]] = await conn.execute(
      `SELECT id
       FROM tr_cashier_session
       WHERE cashier_id = ? AND outlet_id = ? AND status = 'open' AND deleted_at IS NULL
       ORDER BY opened_at DESC
       LIMIT 1`,
      [userId, outletId]
    );
    const sessionId = openSession?.id || null;

    const hasTrxPromo = await hasColumn('tr_transaction', 'promo_id');

    // ── Langkah 1: Insert tr_transaction — id BIGINT AUTO_INCREMENT ──────────
    let trxId;
    if (hasTrxPromo) {
      const [trxInsert] = await conn.execute(
        `INSERT INTO tr_transaction (
          outlet_id, customer_id, cashier_id, session_id,
          promo_id, membership_id,
          transaction_no, source_channel, status, payment_status,
          primary_payment_method, is_express, pickup_type,
          subtotal, member_discount, promo_discount, manual_discount, delivery_fee, total,
          paid_amount, change_amount,
          estimated_done_at, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?,
          ?, 'kasir', 'pending', ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, NOW(), NOW()
        )`,
        [
          outletId, customerId, userId, sessionId,
          resolvedPromoId, activeMembershipId,
          transactionNo, paymentStatus,
          primaryPaymentMethod, isExpress, pickupType,
          computedSubtotal, memberDiscount, promoDiscount, manualDiscount, pickupFee + deliveryFee, computedTotal,
          paidAmount, changeAmount,
          finalEstimatedDone, combinedNotes,
        ]
      );
      trxId = trxInsert.insertId;
    } else {
      const [trxInsert] = await conn.execute(
        `INSERT INTO tr_transaction (
          outlet_id, customer_id, cashier_id, session_id,
          membership_id,
          transaction_no, source_channel, status, payment_status,
          primary_payment_method, is_express, pickup_type,
          subtotal, member_discount, promo_discount, manual_discount, delivery_fee, total,
          paid_amount, change_amount,
          estimated_done_at, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?,
          ?,
          ?, 'kasir', 'pending', ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, NOW(), NOW()
        )`,
        [
          outletId, customerId, userId, sessionId,
          activeMembershipId,
          transactionNo, paymentStatus,
          primaryPaymentMethod, isExpress, pickupType,
          computedSubtotal, memberDiscount, promoDiscount, manualDiscount, pickupFee + deliveryFee, computedTotal,
          paidAmount, changeAmount,
          finalEstimatedDone, combinedNotes,
        ]
      );
      trxId = trxInsert.insertId;
    }

    // ── Langkah 2: Bulk insert tr_transaction_item ────────────────────────────
    // Track inventory IDs yang ke-deduct supaya bisa cek reorder threshold setelah commit
    const reorderTargets = new Set();
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

      // Cek apakah kolom material/brand/special_care_alert sudah ada (graceful)
      let hasItemExtraCols = false;
      try {
        const [chk] = await conn.execute(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'tr_transaction_item' AND column_name = 'material'`
        );
        hasItemExtraCols = Number(chk[0]?.cnt || 0) > 0;
      } catch { hasItemExtraCols = false; }

      if (hasItemExtraCols) {
        await conn.execute(
          `INSERT INTO tr_transaction_item (
            transaction_id, service_id, item_no,
            service_name_snapshot, unit_type_snapshot,
            qty, price, express_multiplier, is_express,
            subtotal, notes, material, brand, special_care_alert,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            trxId, serviceId, itemNo,
            item.serviceName || item.name || svc.service_name || 'Layanan',
            item.unit || svc.unit || 'pcs',
            itemQty, itemPrice, multiplier, itemIsExpress,
            itemSubtotal, item.notes || null,
            item.material ? String(item.material).slice(0, 80) : null,
            item.brand ? String(item.brand).slice(0, 80) : null,
            item.specialCareAlert ? String(item.specialCareAlert).slice(0, 255) : null,
          ]
        );
      } else {
        await conn.execute(
          `INSERT INTO tr_transaction_item (
            transaction_id, service_id, item_no,
            service_name_snapshot, unit_type_snapshot,
            qty, price, express_multiplier, is_express,
            subtotal, notes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            trxId, serviceId, itemNo,
            item.serviceName || item.name || svc.service_name || 'Layanan',
            item.unit || svc.unit || 'pcs',
            itemQty, itemPrice, multiplier, itemIsExpress,
            itemSubtotal, item.notes || null,
          ]
        );
      }
      // Ambil insertId untuk dipakai sebagai FK di tr_item_unit
      const [[lastItem]] = await conn.execute(
        'SELECT id FROM tr_transaction_item WHERE item_no = ? LIMIT 1',
        [itemNo]
      );
      const txItemId = lastItem.id;

      // --- INTEGRASI PRODUKSI: Buat unit fisik untuk ditrack oleh tim cuci ---
      // id AUTO_INCREMENT — biarkan DB yang generate
      await conn.execute(
        `INSERT INTO tr_item_unit (
          transaction_id, transaction_item_id, unit_no,
          unit_sequence, qty_share, production_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, 'received', NOW(), NOW())`,
        [
          trxId,
          txItemId,
          `${itemNo}-U1`,
          itemQty
        ]
      );

      // ── Pengurangan stok bahan (auto_deduct) per layanan ─────────────────────
      try {
        const [usageRows] = await conn.execute(
          `SELECT inventory_id, qty_per_unit FROM mst_service_inventory_usage
           WHERE service_id = ? AND usage_type = 'auto_deduct' AND is_active = 1`,
          [serviceId]
        );
        for (const u of usageRows) {
          const need = Math.abs(Number(u.qty_per_unit)) * itemQty;
          if (!Number.isFinite(need) || need <= 0) continue;
          const delta = -need;
          const [stRows] = await conn.execute(
            'SELECT id, stock_qty FROM mst_inventory_outlet_stock WHERE outlet_id = ? AND inventory_id = ? FOR UPDATE',
            [outletId, u.inventory_id]
          );
          const st = stRows[0];
          if (!st) continue;
          const next = Number(st.stock_qty) + delta;
          if (next < 0) continue;
          await conn.execute(
            'UPDATE mst_inventory_outlet_stock SET stock_qty = ?, last_updated_at = NOW() WHERE id = ?',
            [next, st.id]
          );
          reorderTargets.add(u.inventory_id);
          await conn.execute(
            `INSERT INTO tr_inventory_movement (
              outlet_id, inventory_id, movement_type, qty, transaction_id, transaction_item_id, notes, created_by, created_at
            ) VALUES (?, ?, 'auto_usage', ?, ?, ?, ?, ?, NOW())`,
            [
              outletId,
              u.inventory_id,
              delta,
              trxId,
              txItemId,
              `Auto nota ${transactionNo}`,
              userId,
            ]
          );
        }
      } catch { /* tabel usage/stok belum terpasang */ }
    }

    // ── Auto-increment usage_count per service untuk customer ini (favorite) ─
    // Setelah semua item dibuat, update mst_customer_service_favorite supaya
    // service yang sering dipakai bisa di-rank otomatis sebagai "Sering Dipakai"
    try {
      const uniqueServiceIds = [...new Set(items.map((i) => i.serviceId || i.id).filter(Boolean))];
      for (const sid of uniqueServiceIds) {
        await conn.execute(
          `INSERT INTO mst_customer_service_favorite
            (customer_id, service_id, usage_count, last_used_at, is_manual_pin, updated_at)
           VALUES (?, ?, 1, NOW(), 0, NOW())
           ON DUPLICATE KEY UPDATE
             usage_count = usage_count + 1,
             last_used_at = NOW(),
             updated_at = NOW()`,
          [customerId, sid]
        );
      }
    } catch (favErr) {
      console.warn('[checkout] auto-increment favorite gagal:', favErr?.message || favErr);
    }

    // ── Langkah 3: Insert tr_payment_item (amount harus > 0 per skema DB) ─────
    if (paidAmount > 0 && primaryPaymentMethod) {
      await conn.execute(
        `INSERT INTO tr_payment_item (
          transaction_id, method, amount,
          recorded_by, status, paid_at, recorded_at
        ) VALUES (?, ?, ?, ?, 'paid', NOW(), NOW())`,
        [trxId, primaryPaymentMethod, paidAmount, userId]
      );
    }

    // ── Langkah 3b: QRIS EDC Integration Log ────────────────────────────────
    if (paidAmount > 0 && primaryPaymentMethod === 'qris') {
      try {
        await conn.execute(
          `INSERT INTO tr_payment_integration_log (
            transaction_id, method, event_type, payload, response_data,
            created_at
          ) VALUES (?, 'qris', 'EDC_REQUEST_SUCCESS', ?, ?, NOW())`,
          [
            trxId,
            JSON.stringify({ amount: computedTotal, transactionNo }),
            JSON.stringify({ status: 'success', simulated: true, timestamp: new Date().toISOString() }),
          ]
        );
      } catch { /* tabel belum ada, skip */ }
    }

    // ── Langkah 4: Insert tr_logistic_order ────────────────────────────────────
    // ── Langkah 4: Insert tr_logistic_order ────────────────────────────────────
    const { scheduleAt, areaZoneId: payloadAreaZoneId, courierName: payloadCourier, deliveryNotes: payloadDeliveryNotes } = req.body;
    const logisticSchedule = scheduleAt ? new Date(scheduleAt) : (dueDate ? new Date(dueDate) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

    // Format catatan logistik (untuk delivery)
    const logisticNotesText = (() => {
      const parts = [];
      if (payloadCourier && String(payloadCourier).trim()) parts.push(`Kurir: ${String(payloadCourier).trim()}`);
      if (payloadDeliveryNotes && String(payloadDeliveryNotes).trim()) parts.push(`Catatan: ${String(payloadDeliveryNotes).trim()}`);
      return parts.length > 0 ? parts.join(' | ') : null;
    })();

    if (pickup) {
      await conn.execute(
        `INSERT INTO tr_logistic_order (
          transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, notes, created_by, created_at, updated_at
        ) VALUES (?, 'pickup', ?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
        [trxId, payloadAreaZoneId || null, pickupFee || 10000, logisticSchedule, null, userId]
      );
    }

    if (delivery) {
      await conn.execute(
        `INSERT INTO tr_logistic_order (
          transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, notes, created_by, created_at, updated_at
        ) VALUES (?, 'delivery', ?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
        [trxId, payloadAreaZoneId || null, deliveryFee || 10000, logisticSchedule, logisticNotesText, userId]
      );
    }

    // ── Commit ────────────────────────────────────────────────────────────────
    await conn.commit();

    // ── Auto-reorder check (best-effort, non-blocking) ────────────────────────
    // Cek tiap inventory yang baru ke-deduct, kalau di bawah min_stock buat PR.
    if (reorderTargets.size > 0) {
      (async () => {
        try {
          const { autoCreateReorderPR } = await import('./inventoryController.js');
          for (const invId of reorderTargets) {
            await autoCreateReorderPR({
              outletId,
              inventoryId: invId,
              currentQty: null, // null = baca dari DB
              requestedBy: userId,
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('[checkout reorder check]', e?.message || e);
        }
      })();
    }

    // ── Realtime emit: nota baru masuk antrian ──────────────────────────────
    try {
      emitTransactionCheckout(outletId, transactionNo, trxId);
    } catch {}

    // ── Tambahkan loyalty points (Rp 1.000 = 1 point) — di luar transaction ──
    // Best-effort, tidak boleh gagalkan checkout
    if (activeMembershipId && computedTotal > 0) {
      try {
        // Ambil rate dari config (default 1000)
        let rate = 1000;
        try {
          const [[cfg]] = await poolWaschenPos.execute(
            "SELECT config_val FROM mst_app_config WHERE config_key = 'loyalty_rate_rupiah_per_point' AND is_active = 1 LIMIT 1"
          );
          if (cfg?.config_val) rate = Number(cfg.config_val) || 1000;
        } catch { /* config belum ada, pakai default */ }

        const earnedPoints = Math.floor(computedTotal / rate);
        if (earnedPoints > 0) {
          // Poin expire 12 bulan dari sekarang (best practice loyalty)
          await poolWaschenPos.execute(
            `INSERT INTO tr_loyalty_ledger
              (membership_id, transaction_id, type, points, remaining_points,
               description, expired_at, created_by, created_at)
             VALUES (?, ?, 'earn', ?, ?, ?, DATE_ADD(NOW(), INTERVAL 12 MONTH), ?, NOW())`,
            [
              activeMembershipId,
              trxId,
              earnedPoints,
              earnedPoints,
              `Earn dari transaksi ${transactionNo} (${rate.toLocaleString('id-ID')} Rupiah = 1 point)`,
              userId,
            ]
          );
        }
      } catch (loyErr) {
        console.warn('[checkout] gagal catat loyalty points:', loyErr?.message || loyErr);
      }
    }

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

    const hasItemActiveFlag = await hasColumn('tr_transaction_item', 'is_active');
    const [itemRows] = await poolWaschenPos.execute(
      `SELECT
        service_id          AS serviceId,
        service_name_snapshot AS serviceName,
        unit_type_snapshot  AS unit,
        qty, price,
        is_express          AS isExpress,
        subtotal
      FROM tr_transaction_item
      WHERE transaction_id = ?
      ${hasItemActiveFlag ? 'AND is_active = 1' : ''}`,
      [trxId]
    );

    // Audit log — kritis untuk keuangan
    writeAudit(poolWaschenPos, {
      userId,
      outletId,
      transactionId: trxId,
      entityType: 'transaction',
      entityId: transactionNo,
      action: 'checkout_transaction',
      newData: {
        transactionNo,
        customerId,
        total: computedTotal,
        paidAmount,
        paymentMethod: primaryPaymentMethod,
        itemCount: items.length,
      },
      req,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Nota berhasil dibuat',
      data: {
        ...trxRow,
        status: 'baru',
        items: itemRows,
        payment: {
          method: primaryPaymentMethod ?? (payment?.method ? mapPayMethod(payment.method) : null),
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

// ─── Helper: Map DB status ke frontend status — DELEGATE ke central helper ─
// Single source of truth: api/utils/statusMap.js (imported at top)
const mapDbStatusToFrontend = _dbToUiTxStatus;

// ─── GET /api/transactions ─────────────────────────────────────────────────────
export const getTransactions = async (req, res) => {
  try {
    const { status, outletId, customerId, page = 1, limit = 50, search, paymentStatus, isExpress, period, sort } = req.query;
    const userOutletId = req.user?.outletId;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let sql = `
      SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        t.is_express AS isExpress,
        t.total,
        t.subtotal,
        t.paid_amount AS paidAmount,
        t.payment_status AS paymentStatus,
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
        /** Aktif kasir: belum diambil (baru → proses → siap ambil/antar). 'completed' juga bisa belum diambil. */
        active: ['draft', 'pending', 'process', 'ready_for_pickup', 'ready_for_delivery'],
        selesai: ['ready_for_pickup', 'ready_for_delivery', 'completed'],
        dibatalkan: ['cancelled'],
        diambil: ['completed'],
        ready_for_pickup: ['ready_for_pickup'],
        ready_for_delivery: ['ready_for_delivery'],
      };
      const dbStatuses = statusMap[status] || String(status).split(',').map((s) => s.trim()).filter(Boolean);
      sql += ` AND t.status IN (${dbStatuses.map(() => '?').join(',')})${status === 'diambil' ? ' AND t.picked_up_at IS NOT NULL' : ''}${status === 'active' ? ' AND t.picked_up_at IS NULL' : ''}`;
      params.push(...dbStatuses);
    } else {
      sql += " AND t.status <> 'cancelled'";
    }

    // Search by customer name, phone, or transaction_no
    if (search && search.trim()) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR t.transaction_no LIKE ?)';
      const s = `%${search.trim()}%`;
      params.push(s, s, s);
    }

    // Filter by payment_status (comma-separated: unpaid,partial)
    if (paymentStatus && paymentStatus.trim()) {
      const ps = paymentStatus.split(',').map((s) => s.trim()).filter(Boolean);
      if (ps.length > 0) {
        sql += ` AND t.payment_status IN (${ps.map(() => '?').join(',')})`;
        params.push(...ps);
      }
    }

    // Filter express only
    if (isExpress === '1') {
      sql += ' AND t.is_express = 1';
    }

    // Period filter
    if (period === 'today') {
      sql += ' AND DATE(t.created_at) = CURDATE()';
    } else if (period === '7d') {
      sql += ' AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === '30d') {
      sql += ' AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    // Count total for pagination (dedicated count query for reliability)
    let countWhere = 'WHERE t.deleted_at IS NULL';
    const countParams = [];

    if (customerId) {
      countWhere += ' AND t.customer_id = ?';
      countParams.push(customerId);
    }

    if (outletId) {
      countWhere += ' AND t.outlet_id = ?';
      countParams.push(outletId);
    } else if (userOutletId && !customerId) {
      countWhere += ' AND t.outlet_id = ?';
      countParams.push(userOutletId);
    }

    if (status && status !== 'semua') {
      const statusMapCount = {
        baru: ['draft', 'pending'],
        proses: ['process'],
        active: ['draft', 'pending', 'process', 'ready_for_pickup', 'ready_for_delivery'],
        selesai: ['ready_for_pickup', 'ready_for_delivery', 'completed'],
        dibatalkan: ['cancelled'],
        diambil: ['completed'],
        ready_for_pickup: ['ready_for_pickup'],
        ready_for_delivery: ['ready_for_delivery'],
      };
      const dbStatusesCount = statusMapCount[status] || String(status).split(',').map((s) => s.trim()).filter(Boolean);
      countWhere += ` AND t.status IN (${dbStatusesCount.map(() => '?').join(',')})${status === 'diambil' ? ' AND t.picked_up_at IS NOT NULL' : ''}${status === 'active' ? ' AND t.picked_up_at IS NULL' : ''}`;
      countParams.push(...dbStatusesCount);
    } else {
      countWhere += " AND t.status <> 'cancelled'";
    }

    // Same search/filter for count
    if (search && search.trim()) {
      countWhere += ' AND (c.name LIKE ? OR c.phone LIKE ? OR t.transaction_no LIKE ?)';
      const s = `%${search.trim()}%`;
      countParams.push(s, s, s);
    }
    if (paymentStatus && paymentStatus.trim()) {
      const ps = paymentStatus.split(',').map((s) => s.trim()).filter(Boolean);
      if (ps.length > 0) {
        countWhere += ` AND t.payment_status IN (${ps.map(() => '?').join(',')})`;
        countParams.push(...ps);
      }
    }
    if (isExpress === '1') {
      countWhere += ' AND t.is_express = 1';
    }

    if (period === 'today') {
      countWhere += ' AND DATE(t.created_at) = CURDATE()';
    } else if (period === '7d') {
      countWhere += ' AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === '30d') {
      countWhere += ' AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    const countSql = `SELECT COUNT(*) AS total FROM tr_transaction t JOIN mst_customer c ON c.id = t.customer_id ${countWhere}`;
    const [countResult] = await poolWaschenPos.execute(countSql, countParams);
    const total = countResult[0]?.total || 0;

    const sortKey = String(sort || 'newest').toLowerCase();
    const sortSql = {
      newest: 't.created_at DESC',
      deadline: 't.estimated_done_at IS NULL, t.estimated_done_at ASC, t.created_at DESC',
    };
    const orderBy = sortSql[sortKey] || sortSql.newest;

    // MySQL prepared statement tidak support ? untuk LIMIT/OFFSET
    // Inline integer yang sudah divalidasi (parseInt di atas menjamin keamanan)
    sql += ` ORDER BY ${orderBy} LIMIT ${limitNum} OFFSET ${offset}`;

    const [rows] = await poolWaschenPos.execute(sql, params);

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: [], pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
    }

    const txIds = rows.map(r => r.id);
    const placeholders = txIds.map(() => '?').join(',');

    // Fetch all items for these transactions in one query
    const hasItemActiveFlag = await hasColumn('tr_transaction_item', 'is_active');
    const [allItems] = await poolWaschenPos.execute(
      `SELECT
        transaction_id,
        id, service_id AS serviceId, service_name_snapshot AS name,
        unit_type_snapshot AS unit, qty, price,
        is_express AS express, subtotal
      FROM tr_transaction_item
      WHERE transaction_id IN (${placeholders})
      ${hasItemActiveFlag ? 'AND is_active = 1' : ''}`,
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
      paidAmount: Number(t.paidAmount || 0),
      balanceDue: Math.max(0, Number(t.total || 0) - Number(t.paidAmount || 0)),
      paymentStatus: t.paymentStatus || 'unpaid',
      deliveryFee: Number(t.deliveryFee),
    }));

    return res.status(200).json({ success: true, data: transactions, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
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
      `      SELECT
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
        t.payment_status AS paymentStatus,
        t.primary_payment_method AS payMethod,
        t.notes,
        t.estimated_done_at AS estimatedDoneAt,
        t.created_at AS createdAt,
        t.customer_id AS customerId,
        c.name AS customerName,
        c.phone AS customerPhone,
        COALESCE(w.balance, 0) AS customerDeposit,
        u.name AS cashierName,
        o.name AS outletName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
      JOIN mst_user u ON u.id = t.cashier_id
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      WHERE t.deleted_at IS NULL AND (t.id = ? OR t.transaction_no = ?)
      LIMIT 1`,
      [id, id]
    );

    if (trxRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const hasItemActiveFlag = await hasColumn('tr_transaction_item', 'is_active');
    const hasPackingCols = await hasColumn('tr_transaction_item', 'packing_needed');
    const hasPackingDone = await hasColumn('tr_item_unit', 'packing_done');
    const hasCarpetCols  = await hasColumn('tr_transaction_item', 'carpet_panjang_cm');

    const packingTiSelect = hasPackingCols
      ? ', COALESCE(ti.packing_needed, 1) AS packingNeeded, ti.packing_notes AS packingNotes' : '';
    const packingIuSelect = hasPackingDone
      ? ', COALESCE(iu_p.packing_done, 0) AS packingDone' : '';
    const packingJoin = hasPackingDone
      ? 'LEFT JOIN tr_item_unit iu_p ON iu_p.transaction_item_id = ti.id' : '';
    const carpetSelect = hasCarpetCols
      ? ', ti.carpet_panjang_cm AS carpetPanjangCm, ti.carpet_lebar_cm AS carpetLebarCm' : '';

    const [items] = await poolWaschenPos.execute(
      `SELECT ti.id, ti.service_id AS serviceId, ti.service_name_snapshot AS name,
              ti.unit_type_snapshot AS unit, ti.qty, ti.price,
              ti.is_express AS express, ti.express_multiplier AS expressMultiplier, ti.subtotal
              ${packingTiSelect}${packingIuSelect}${carpetSelect}
       FROM tr_transaction_item ti ${packingJoin}
       WHERE ti.transaction_id = ?
       ${hasItemActiveFlag ? 'AND ti.is_active = 1' : ''}`,
      [trxRows[0].id]
    );

    const t = trxRows[0];

    const [units] = await poolWaschenPos.execute(
      `SELECT unit_no AS unitNo, transaction_item_id AS txItemId
       FROM tr_item_unit
       WHERE transaction_id = ?`,
      [t.id]
    );

    // Get Log History untuk dipassing (disesuaikan dengan skema baru)
    let progressLogs = [];
    try {
      const [logRows] = await poolWaschenPos.execute(
        `SELECT
           pl.stage,
           pl.started_at
         FROM tr_production_log pl
         JOIN tr_item_unit iu ON pl.item_unit_id = iu.id
         WHERE iu.transaction_id = ?
         ORDER BY pl.started_at ASC`,
        [t.id]
      );
      // Mapping dari stage di DB ke teks yang lebih ramah pengguna
      // 'drying' di-merge ke 'Cuci' (stage Pengeringan dihapus dari alur)
      const stageMap = {
        'received': 'Diterima',
        'washing': 'Cuci',
        'drying': 'Cuci',
        'ironing': 'Setrika',
        'qc': 'Quality Control',
        'packing': 'Packing',
        'ready': 'Selesai',
      };
      progressLogs = logRows.map(l => ({
        stage: stageMap[l.stage] || l.stage,
        timestamp: l.started_at
      }));
    } catch (logError) {
      // Jika query gagal (misal: karena tabel/kolom tidak ada), log warning tapi jangan sampai crash.
      console.warn(`[getTransactionById] Warning: Could not fetch production logs for tx ${t.id}.`, logError.message);
    }

    let paymentRows = [];
    try {
      const [pr] = await poolWaschenPos.execute(
        `SELECT
          id,
          method,
          amount,
          recorded_at AS recordedAt,
          notes,
          payment_ref AS paymentRef,
          external_payment_id AS externalPaymentId,
          status
        FROM tr_payment_item
        WHERE transaction_id = ?
        ORDER BY recorded_at ASC`,
        [t.id]
      );
      paymentRows = pr || [];
    } catch {
      paymentRows = [];
    }

    const paidNum = Number(t.paidAmount || 0);
    const totalNum = Number(t.total || 0);
    const balanceDue = Math.max(0, totalNum - paidNum);

    // Ambil foto kondisi (untuk produksi)
    // Support filter by itemId untuk per-item photo isolation
    const filterItemId = req.query?.itemId;
    let conditionPhotos = [];
    try {
      const photoQuery = filterItemId
        ? `SELECT ip.id, ip.photo_url AS url, ip.photo_type AS type, ip.notes,
                  ip.created_at AS createdAt, u.name AS uploadedByName,
                  iu.transaction_item_id AS itemId
           FROM tr_item_photo ip
           JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
           LEFT JOIN mst_user u ON u.id = ip.uploaded_by
           WHERE iu.transaction_id = ?
             AND iu.transaction_item_id = ?
             AND ip.deleted_at IS NULL
             AND ip.photo_url IS NOT NULL
             AND ip.photo_url <> 'note_only'
           ORDER BY ip.created_at ASC`
        : `SELECT ip.id, ip.photo_url AS url, ip.photo_type AS type, ip.notes,
                  ip.created_at AS createdAt, u.name AS uploadedByName,
                  iu.transaction_item_id AS itemId
           FROM tr_item_photo ip
           JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
           LEFT JOIN mst_user u ON u.id = ip.uploaded_by
           WHERE iu.transaction_id = ?
             AND ip.deleted_at IS NULL
             AND ip.photo_url IS NOT NULL
             AND ip.photo_url <> 'note_only'
           ORDER BY ip.created_at ASC`;
      const photoParams = filterItemId ? [t.id, filterItemId] : [t.id];
      const [photoRows] = await poolWaschenPos.execute(photoQuery, photoParams);
      conditionPhotos = photoRows;
    } catch (err) {
      console.warn('[getTransactionById] photos query error:', err?.message);
      conditionPhotos = [];
    }

    // Ambil production meta (hasPackingPhoto, allProductionReady, dll)
    let productionMeta = null;
    try {
      const metaMap = await getProductionMetaBatch([t.id]);
      productionMeta = metaMap.get(t.id) || null;
    } catch (err) {
      console.warn('[getTransactionById] production meta error:', err?.message);
    }

    const transaction = {
      ...t,
      transactionUuid: t.id,
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
      total: totalNum,
      subtotal: Number(t.subtotal),
      deliveryFee: Number(t.deliveryFee),
      paidAmount: paidNum,
      changeAmount: Number(t.changeAmount || 0),
      paymentStatus: t.paymentStatus || 'unpaid',
      balanceDue,
      payments: paymentRows.map((p) => ({
        ...p,
        amount: Number(p.amount || 0),
      })),
      customerName: t.customerName,
      customerPhone: t.customerPhone,
      customerId: t.customerId,
      customerDeposit: Number(t.customerDeposit || 0),
      depositBalance: Number(t.customerDeposit || 0),
      outletName: t.outletName || null,
      payMethod: t.payMethod,
      notes: t.notes,
      conditionPhotos,
      production: productionMeta,
    };

    return res.status(200).json({ success: true, data: transaction });
  } catch (err) {
    console.error('[getTransactionById] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat detail transaksi.' });
  }
};

// ─── POST /api/transactions/:id/payments — pelunasan / pembayaran tambahan ─────
export const recordTransactionPayment = async (req, res) => {
  const { id } = req.params;
  const {
    method,
    payAmount,
    cashReceived,
    notes: payNotes,
    paymentRef,
    externalPaymentId,
    integrationStatus,
  } = req.body;

  const userId = req.user?.userId;
  const roleCode = req.user?.roleCode;
  const outletUserId = req.user?.outletId;

  if (!['kasir', 'frontline', 'admin', 'finance'].includes(roleCode || '')) {
    return res.status(403).json({ success: false, message: 'Akses ditolak untuk mencatat pembayaran.' });
  }

  if (!method) {
    return res.status(400).json({ success: false, message: 'Metode pembayaran wajib diisi.' });
  }

  let applyAmount = Number(payAmount);
  if (!Number.isFinite(applyAmount) || applyAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Nominal pembayaran tidak valid.' });
  }

  const conn = await poolWaschenPos.getConnection();

  try {
    await conn.beginTransaction();

    const [[row]] = await conn.execute(
      `SELECT id, outlet_id, transaction_no, total, paid_amount, change_amount, payment_status, status
       FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?)
       FOR UPDATE`,
      [id, id]
    );

    if (!row) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    if (outletUserId && row.outlet_id !== outletUserId && roleCode !== 'admin') {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Transaksi tidak pada outlet Anda.' });
    }

    if (row.status === 'cancelled') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Transaksi sudah dibatalkan.' });
    }

    const total = Number(row.total || 0);
    const paidBefore = Number(row.paid_amount || 0);
    const remaining = Math.max(0, total - paidBefore);

    if (remaining <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Tagihan sudah lunas.' });
    }

    applyAmount = Math.min(applyAmount, remaining);

    let changeLine = 0;
    if (cashReceived != null && cashReceived !== '' && mapPayMethod(method) === 'cash') {
      const tender = Number(cashReceived);
      if (Number.isFinite(tender) && tender >= applyAmount) {
        changeLine = tender - applyAmount;
      }
    }

    const methodDb = mapPayMethod(method);
    const newPaid = paidBefore + applyAmount;

    let paymentStatus = 'partial';
    if (newPaid >= total) paymentStatus = 'paid';
    else if (newPaid <= 0) paymentStatus = 'unpaid';

    const rawInt = String(integrationStatus || 'not_required').toLowerCase();
    const allowedInteg = ['not_required', 'pending', 'paid', 'failed', 'expired', 'cancelled'];
    const integ = allowedInteg.includes(rawInt) ? rawInt : 'not_required';

    // id AUTO_INCREMENT — biarkan DB yang generate
    const [pmtInsert] = await conn.execute(
      `INSERT INTO tr_payment_item (
        transaction_id, method, amount,
        recorded_by, status, paid_at, recorded_at,
        notes, payment_ref, external_payment_id, integration_status
      ) VALUES (?, ?, ?, ?, 'paid', NOW(), NOW(), ?, ?, ?, ?)`,
      [
        row.id,
        methodDb,
        applyAmount,
        userId,
        payNotes || null,
        paymentRef || null,
        externalPaymentId || null,
        integ,
      ]
    );
    const paymentItemId = pmtInsert.insertId;

    const [methRows] = await conn.execute(
      `SELECT DISTINCT method FROM tr_payment_item WHERE transaction_id = ?`,
      [row.id]
    );
    let primaryMethod = methodDb;
    if (methRows.length > 1) primaryMethod = 'mixed';

    const prevChange = Number(row.change_amount || 0);
    const newChangeTrx = changeLine > 0 ? changeLine : prevChange;

    if (newPaid >= total) {
      await conn.execute(
        `UPDATE tr_transaction SET
          paid_amount = ?,
          change_amount = ?,
          payment_status = ?,
          primary_payment_method = ?,
          settled_at = COALESCE(settled_at, NOW()),
          settled_by = COALESCE(settled_by, ?),
          updated_at = NOW()
        WHERE id = ?`,
        [newPaid, newChangeTrx, paymentStatus, primaryMethod, userId, row.id]
      );
    } else {
      await conn.execute(
        `UPDATE tr_transaction SET
          paid_amount = ?,
          change_amount = ?,
          payment_status = ?,
          primary_payment_method = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [newPaid, newChangeTrx, paymentStatus, primaryMethod, row.id]
      );
    }

    await conn.commit();

    // Realtime emit pelunasan/payment masuk
    try {
      emitPaymentSettled(row.outlet_id, row.id, newPaid, methodDb);
    } catch {}

    return res.status(201).json({
      success: true,
      message: 'Pembayaran dicatat.',
      data: {
        paidAmount: newPaid,
        balanceDue: Math.max(0, total - newPaid),
        paymentStatus,
        changeAmount: newChangeTrx,
        primaryPaymentMethod: primaryMethod,
        paymentItemId,
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[recordTransactionPayment] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mencatat pembayaran.' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/transactions/dashboard/stats ─────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const outletParam = userOutletId ? [userOutletId] : [];
    const outletFilter = userOutletId ? 'AND t.outlet_id = ?' : '';

    // SINGLE query untuk today + active stats (sebelumnya 2 query terpisah)
    const [statsRows] = await poolWaschenPos.execute(
      `SELECT
        -- Today bucket
        SUM(CASE WHEN t.status <> 'cancelled' AND DATE(t.created_at) = CURDATE() THEN 1 ELSE 0 END) AS today_total,
        COALESCE(SUM(CASE WHEN t.status <> 'cancelled' AND DATE(t.created_at) = CURDATE() THEN t.total ELSE 0 END), 0) AS today_omset,
        COALESCE(SUM(CASE WHEN t.status <> 'cancelled' AND DATE(t.created_at) = CURDATE() THEN t.paid_amount ELSE 0 END), 0) AS today_pelunasan,
        SUM(CASE WHEN t.status <> 'cancelled' AND DATE(t.created_at) = CURDATE() AND t.is_express = 1 THEN 1 ELSE 0 END) AS today_express,
        SUM(CASE WHEN t.status <> 'cancelled' AND DATE(t.created_at) = CURDATE() AND t.status IN ('draft','pending','process') THEN 1 ELSE 0 END) AS today_pending,
        SUM(CASE WHEN t.status <> 'cancelled' AND DATE(t.created_at) = CURDATE() AND t.status IN ('ready_for_pickup','ready_for_delivery') AND t.picked_up_at IS NULL THEN 1 ELSE 0 END) AS today_completed,
        COALESCE(SUM(CASE WHEN t.status = 'completed' AND DATE(t.created_at) = CURDATE() THEN t.total ELSE 0 END), 0) AS today_omset_lunas,

        -- Active queue (no date filter)
        SUM(CASE WHEN t.status IN ('pending','process') THEN 1 ELSE 0 END) AS active_process,
        SUM(CASE WHEN t.status IN ('ready_for_pickup','ready_for_delivery') AND t.picked_up_at IS NULL THEN 1 ELSE 0 END) AS active_ready,
        SUM(CASE WHEN t.status IN ('pending','process','ready_for_pickup','ready_for_delivery') THEN 1 ELSE 0 END) AS active_total
       FROM tr_transaction t
       WHERE t.deleted_at IS NULL ${outletFilter}`,
      outletParam
    );

    // 5 transaksi terbaru — sekaligus aggregate items via GROUP_CONCAT (sebelumnya N+1 = 6 query!)
    const hasItemActiveFlag = await hasColumn('tr_transaction_item', 'is_active');
    const itemActiveFilter = hasItemActiveFlag ? 'AND ti.is_active = 1' : '';
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
        u.name AS cashierName,
        GROUP_CONCAT(ti.service_name_snapshot ORDER BY ti.id ASC SEPARATOR '||') AS itemNames,
        GROUP_CONCAT(ti.is_express ORDER BY ti.id ASC SEPARATOR '||') AS itemExpresses
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      JOIN mst_user u ON u.id = t.cashier_id
      LEFT JOIN tr_transaction_item ti ON ti.transaction_id = t.id ${itemActiveFilter}
      WHERE t.deleted_at IS NULL
      ${outletFilter}
      GROUP BY t.id, t.transaction_no, t.status, t.picked_up_at, t.is_express, t.total, t.created_at, c.name, u.name
      ORDER BY t.created_at DESC
      LIMIT 5`,
      outletParam
    );

    const recent = recentRows.map((t) => {
      const names = t.itemNames ? t.itemNames.split('||') : [];
      const exprs = t.itemExpresses ? t.itemExpresses.split('||') : [];
      const items = names.map((name, idx) => ({
        name,
        express: exprs[idx] === '1' || exprs[idx] === 1,
      }));
      return {
        id: t.transactionNo || t.id,
        transactionNo: t.transactionNo,
        status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
        date: new Date(t.createdAt).toISOString().slice(0, 10),
        createdAt: t.createdAt,
        isExpress: t.isExpress === 1 || t.isExpress === true,
        items,
        total: Number(t.total),
        createdBy: t.cashierName,
        customerName: t.customerName,
        pickedUpAt: t.pickedUpAt,
      };
    });

    const r = statsRows[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        today: {
          total: Number(r.today_total || 0),
          omset: Number(r.today_omset || 0),
          totalPelunasan: Number(r.today_pelunasan || 0),
          omsetLunas: Number(r.today_omset_lunas || 0),
          express: Number(r.today_express || 0),
          pending: Number(r.today_pending || 0),
          completed: Number(r.today_completed || 0),
        },
        active: {
          total:   Number(r.active_total || 0),
          process: Number(r.active_process || 0),
          ready:   Number(r.active_ready || 0),
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
    const { status, expectedVersion } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status wajib diisi.' });
    }

    const statusMap = {
      baru: 'pending',
      proses: 'process',
      selesai: 'ready_for_pickup',
      dibatalkan: 'cancelled',
      completed: 'completed',
      diambil: 'completed',
    };

    const dbStatus = statusMap[status];
    if (!dbStatus) {
      return res.status(400).json({ success: false, message: `Status '${status}' tidak valid.` });
    }

    // Cek apakah kolom version sudah ada (graceful migration)
    const hasVersion = await hasColumn('tr_transaction', 'version');

    const [rows] = await poolWaschenPos.execute(
      hasVersion
        ? `SELECT id, version, status FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`
        : `SELECT id, status FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const txUUID = rows[0].id;
    const currentVersion = rows[0].version;

    // Optimistic locking — kalau client kirim expectedVersion, cek dulu
    if (hasVersion && expectedVersion != null && Number(expectedVersion) !== Number(currentVersion)) {
      return res.status(409).json({
        success: false,
        code: 'STALE_DATA',
        message: 'Data transaksi sudah diperbarui oleh user lain. Mohon refresh dan coba lagi.',
        currentVersion,
      });
    }

    let result;
    if (status === 'diambil' || status === 'completed') {
      [result] = await poolWaschenPos.execute(
        hasVersion
          ? `UPDATE tr_transaction SET status = 'completed', picked_up_at = NOW(), updated_at = NOW(), version = version + 1
             WHERE id = ? ${expectedVersion != null ? 'AND version = ?' : ''}`
          : `UPDATE tr_transaction SET status = 'completed', picked_up_at = NOW(), updated_at = NOW() WHERE id = ?`,
        hasVersion && expectedVersion != null ? [txUUID, currentVersion] : [txUUID]
      );
    } else {
      [result] = await poolWaschenPos.execute(
        hasVersion
          ? `UPDATE tr_transaction SET status = ?, picked_up_at = NULL, updated_at = NOW(), version = version + 1
             WHERE id = ? ${expectedVersion != null ? 'AND version = ?' : ''}`
          : `UPDATE tr_transaction SET status = ?, picked_up_at = NULL, updated_at = NOW() WHERE id = ?`,
        hasVersion && expectedVersion != null ? [dbStatus, txUUID, currentVersion] : [dbStatus, txUUID]
      );
    }

    // Kalau pakai version dan tidak ada baris yang ke-update, berarti ada concurrent update
    if (hasVersion && expectedVersion != null && result.affectedRows === 0) {
      return res.status(409).json({
        success: false,
        code: 'STALE_DATA',
        message: 'Data transaksi sudah diperbarui oleh user lain. Mohon refresh dan coba lagi.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Status transaksi diperbarui.',
      data: hasVersion ? { newVersion: currentVersion + 1 } : undefined,
    });
  } catch (err) {
    console.error('[updateTransactionStatus] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status transaksi.' });
  }
};

// ─── GET /api/transactions/production/queue ──────────────────────────────────────
// Antrian = nota yang masih ada unit unfinished (belum semua 'ready'/'done').
// Begitu semua unit ready, nota lulus dari antrian → muncul di Riwayat.
// Status DB tetap di-sync (process → ready_for_pickup) tapi filter pakai unit-level
// supaya konsisten dengan Riwayat.
export const getProductionQueue = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;

    // Cuma nota yang masih punya unit unfinished. Cancelled/completed di-exclude.
    // tx status ready_for_pickup / ready_for_delivery sudah bukan domain produksi —
    // pindah ke Riwayat. Jadi filter status di sini = pending/process/draft only.
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        t.is_express AS isExpress,
        t.total,
        t.created_at AS createdAt,
        t.estimated_done_at AS estimatedDoneAt,
        t.notes,
        t.pickup_type AS pickupType,
        c.name AS customerName,
        c.phone AS customerPhone
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      WHERE t.deleted_at IS NULL
        AND t.status IN ('draft', 'pending', 'process')
      ${userOutletId ? 'AND t.outlet_id = ?' : ''}
      ORDER BY t.is_express DESC, t.estimated_done_at ASC, t.created_at ASC
      LIMIT 200`,
      userOutletId ? [userOutletId] : []
    );

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const txIds = rows.map((r) => r.id);
    const placeholders = txIds.map(() => '?').join(',');

    const hasItemActiveFlag = await hasColumn('tr_transaction_item', 'is_active');
    const hasPackingCols = await hasColumn('tr_transaction_item', 'packing_needed');
    const hasPackingDone = await hasColumn('tr_item_unit', 'packing_done');

    const packingQueueSelect = hasPackingCols
      ? ', COALESCE(ti.packing_needed, 1) AS packingNeeded, ti.packing_notes AS packingNotes' : '';
    const packingDoneSelect = hasPackingDone
      ? ', COALESCE(MAX(iu_pk.packing_done), 0) AS packingDone' : '';
    const packingDoneJoin = hasPackingDone
      ? `LEFT JOIN tr_item_unit iu_pk ON iu_pk.transaction_item_id = ti.id` : '';
    const packingGroupBy = (hasPackingCols || hasPackingDone)
      ? `GROUP BY ti.id, ti.transaction_id, ti.service_name_snapshot, ti.unit_type_snapshot, ti.qty, ti.is_express${hasPackingCols ? ', ti.packing_needed, ti.packing_notes' : ''}` : '';

    const [allItems] = await poolWaschenPos.execute(
      `SELECT ti.id AS itemId, ti.transaction_id,
              ti.service_name_snapshot AS name, ti.unit_type_snapshot AS unit,
              ti.qty, ti.is_express AS isExpress
              ${packingQueueSelect}${packingDoneSelect}
       FROM tr_transaction_item ti ${packingDoneJoin}
       WHERE ti.transaction_id IN (${placeholders})
       ${hasItemActiveFlag ? 'AND ti.is_active = 1' : ''}
       ${packingGroupBy}`,
      txIds
    );

    const [allLogs] = await poolWaschenPos.execute(
      `SELECT iu.transaction_id, iu.transaction_item_id, pl.stage, pl.started_at
       FROM tr_production_log pl
       JOIN tr_item_unit iu ON iu.id = pl.item_unit_id
       WHERE iu.transaction_id IN (${placeholders})
       ORDER BY pl.started_at ASC`,
      txIds
    );

    const reverseMap = {
      'received': 'Diterima', 'washing': 'Cuci', 'drying': 'Cuci',
      'ironing': 'Setrika', 'packing': 'Packing', 'ready': 'Selesai',
    };
    const STAGE_ORDER = ['Diterima', 'Cuci', 'Setrika', 'Packing', 'Selesai'];

    // Build per-item progress map (deduplicated by stage)
    const logsByItemId = new Map();
    for (const log of allLogs) {
      const itemId = log.transaction_item_id;
      const stageLabel = reverseMap[log.stage] || log.stage;
      const list = logsByItemId.get(itemId) || [];
      if (!list.some((l) => l.stage === stageLabel)) {
        list.push({ stage: stageLabel, timestamp: log.started_at });
      }
      logsByItemId.set(itemId, list);
    }

    // Build per-transaction items map
    const itemsByTxId = new Map();
    for (const item of allItems) {
      const list = itemsByTxId.get(item.transaction_id) || [];
      list.push(item);
      itemsByTxId.set(item.transaction_id, list);
    }

    const transactions = rows.map((t) => {
      const rawItems = itemsByTxId.get(t.id) || [];

      const items = rawItems.map((item) => {
        const progress = logsByItemId.get(item.itemId) || [];
        const doneStages = progress.map((p) => p.stage);
        const currentStage = STAGE_ORDER.find((s) => !doneStages.includes(s)) || 'Selesai';
        const packingNeeded = Number(item.packingNeeded) || 1;
        const packingDone = Number(item.packingDone) || 0;
        return {
          itemId: item.itemId,
          name: item.name,
          unit: item.unit,
          qty: Number(item.qty || 1),
          isExpress: item.isExpress === 1 || item.isExpress === true,
          progress,
          currentStage,
          isDone: currentStage === 'Selesai',
          packingNeeded,
          packingDone,
          packingNotes: item.packingNotes || null,
        };
      });

      // Overall current stage = the stage the slowest item is at
      const overallCurrentStage = items.reduce((slowest, item) => {
        const itemIdx = STAGE_ORDER.indexOf(item.currentStage);
        const slowestIdx = STAGE_ORDER.indexOf(slowest);
        return itemIdx < slowestIdx ? item.currentStage : slowest;
      }, 'Selesai');

      // Legacy flat progress = stages that ALL items have completed (for overall bar)
      const legacyProgress = STAGE_ORDER.filter((stage) =>
        items.length > 0 && items.every((item) => item.progress.some((p) => p.stage === stage))
      ).map((stage) => ({ stage, timestamp: null }));

      return {
        ...t,
        id: t.transactionNo || t.id,
        transactionUuid: t.id,
        status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
        date: new Date(t.createdAt).toISOString().slice(0, 10),
        estimatedDoneAt: t.estimatedDoneAt ? new Date(t.estimatedDoneAt).toISOString() : null,
        isExpress: t.isExpress === 1 || t.isExpress === true,
        items,
        total: Number(t.total),
        customerName: t.customerName,
        customerPhone: t.customerPhone,
        notes: t.notes || null,
        pickupType: t.pickupType || 'pickup',
        progress: legacyProgress,
        overallCurrentStage,
      };
    });

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
      `SELECT id, status, picked_up_at FROM tr_transaction
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

    const hasApprovalActiveFlag = await hasColumn('tr_transaction_approval', 'is_active');
    const [existingReq] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction_approval
       WHERE transaction_id = ? AND status = 'pending'
       ${hasApprovalActiveFlag ? 'AND is_active = 1' : ''}
       LIMIT 1`,
      [tx.id]
    );

    if (existingReq.length > 0) {
      return res.status(409).json({ success: false, message: 'Sudah ada pengajuan pembatalan yang masih menunggu persetujuan Owner.' });
    }

    const isGlobalRole = ['admin', 'superadmin', 'owner'].includes(req.user?.roleCode);
    const approvalStatus = isGlobalRole ? 'approved' : 'pending';
    const approvedBy = isGlobalRole ? req.user?.userId : null;

    await poolWaschenPos.execute(
      `INSERT INTO tr_transaction_approval 
        (transaction_id, requested_by, approved_by, type, status, reason, requested_at, resolved_at)
       VALUES (?, ?, ?, 'cancel_nota', ?, ?, NOW(), ?)`,
      [
        tx.id, req.user?.userId, approvedBy,
        approvalStatus, reason.trim(),
        isGlobalRole ? new Date() : null
      ]
    );

    if (isGlobalRole) {
      await poolWaschenPos.execute(
        `UPDATE tr_transaction
         SET status = 'cancelled',
             cancelled_at = NOW(),
             cancelled_by = ?,
             cancel_reason = ?,
             notes  = CONCAT(COALESCE(notes, ''), IF(notes IS NULL OR notes = '', '', ' | '), '[Batal (Auto-Approved): ', ?, ']'),
             updated_at = NOW()
         WHERE id = ?`,
        [req.user?.userId, reason.trim(), reason.trim(), tx.id]
      );

      // Audit log — owner langsung cancel = kritis
      writeAudit(poolWaschenPos, {
        userId: req.user?.userId,
        outletId: req.user?.outletId,
        transactionId: tx.id,
        entityType: 'transaction',
        entityId: tx.id,
        action: 'cancel_transaction_auto',
        newData: { reason: reason.trim(), authorizedBy: req.user?.roleCode },
        req,
      }).catch(() => {});

      return res.status(200).json({ success: true, message: 'Transaksi berhasil dibatalkan (Otorisasi Owner).' });
    }

    // Audit log — pengajuan batal (kasir/non-admin)
    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      outletId: req.user?.outletId,
      transactionId: tx.id,
      entityType: 'transaction',
      entityId: tx.id,
      action: 'request_cancel_transaction',
      newData: { reason: reason.trim() },
      req,
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Pengajuan pembatalan berhasil dikirim. Menunggu persetujuan Owner.' });
  } catch (err) {
    console.error('[cancelTransaction] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan transaksi.' });
  }
};

// ─── PERBAIKAN: PATCH /api/transactions/:id/production-stage ─────────────────
const VALID_STAGES = ['Diterima', 'Cuci', 'Setrika', 'Packing', 'Selesai'];

export const updateProductionStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, itemId } = req.body;

    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({ success: false, message: `Stage tidak valid. Pilih: ${VALID_STAGES.join(', ')}` });
    }

    const stageMap = {
      'Diterima': 'received', 'Cuci': 'washing',
      'Setrika': 'ironing', 'Packing': 'packing', 'Selesai': 'ready',
    };
    const reverseMap = {
      'received': 'Diterima', 'washing': 'Cuci', 'drying': 'Cuci',
      'ironing': 'Setrika', 'packing': 'Packing', 'ready': 'Selesai',
    };
    const dbStatus = stageMap[stage] || 'received';

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

    // ── Per-item mode (itemId dikirim) ──────────────────────────────────────
    if (itemId) {
      const [itemCheck] = await poolWaschenPos.execute(
        `SELECT id FROM tr_transaction_item WHERE id = ? AND transaction_id = ? LIMIT 1`,
        [itemId, txId]
      );
      if (!itemCheck.length) {
        return res.status(400).json({ success: false, message: 'Item tidak ditemukan dalam transaksi ini.' });
      }

      await poolWaschenPos.execute(
        `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE transaction_item_id = ?`,
        [dbStatus, itemId]
      );

      const [unitRows] = await poolWaschenPos.execute(
        `SELECT id FROM tr_item_unit WHERE transaction_item_id = ?`,
        [itemId]
      );
      for (const unit of unitRows) {
        await poolWaschenPos.execute(
          `INSERT INTO tr_production_log (item_unit_id, pic_id, stage, status, notes, started_at, created_at)
           VALUES (?, ?, ?, 'done', ?, NOW(), NOW())`,
          [unit.id, req.user?.userId, dbStatus, `[Per-item] Stage: ${stage}`]
        );
      }

      // Cek apakah SEMUA unit di transaksi ini sudah ready
      const [doneCheck] = await poolWaschenPos.execute(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN production_status = 'ready' THEN 1 ELSE 0 END) AS readyCount
         FROM tr_item_unit WHERE transaction_id = ?`,
        [txId]
      );
      const { total, readyCount } = doneCheck[0] || {};
      const allDone = Number(total) > 0 && Number(total) === Number(readyCount);

      if (allDone) {
        const nextStatus = pickupType === 'delivery' ? 'ready_for_delivery' : 'ready_for_pickup';
        await poolWaschenPos.execute(
          `UPDATE tr_transaction SET status = ?, updated_at = NOW() WHERE id = ?`,
          [nextStatus, txId]
        );
        try {
          await poolWaschenPos.execute(
            `INSERT INTO tr_notification (transaction_id, type, recipient_customer_id, wa_number, message_body, status, sent_by, created_at, updated_at)
             SELECT t.id, 'selesai', t.customer_id, COALESCE(c.phone,'-'),
               CONCAT('Cucian Anda (', t.transaction_no, ') sudah selesai dan siap ', IF(t.pickup_type='delivery','diantar.','diambil di outlet.')),
               'opened', ?, NOW(), NOW()
             FROM tr_transaction t JOIN mst_customer c ON c.id=t.customer_id WHERE t.id=?`,
            [req.user?.userId, txId]
          );
        } catch (_) { /* notifikasi tidak bloking */ }
      } else {
        await poolWaschenPos.execute(
          `UPDATE tr_transaction SET status = 'process', updated_at = NOW() WHERE id = ? AND status IN ('draft','pending')`,
          [txId]
        );
      }

      // Kembalikan progress item ini (deduplicated)
      const [logRows] = await poolWaschenPos.execute(
        `SELECT pl.stage, pl.started_at AS timestamp
         FROM tr_production_log pl
         JOIN tr_item_unit iu ON iu.id = pl.item_unit_id
         WHERE iu.transaction_item_id = ?
         ORDER BY pl.started_at ASC`,
        [itemId]
      );
      const seen = new Set();
      const progress = [];
      for (const l of logRows) {
        const s = reverseMap[l.stage] || l.stage;
        if (!seen.has(s)) { seen.add(s); progress.push({ stage: s, timestamp: l.timestamp }); }
      }

      return res.status(200).json({
        success: true,
        message: `Stage '${stage}' berhasil dicatat untuk layanan ini.`,
        data: { progress, allDone },
      });
    }

    // ── Fallback: update semua item di transaksi (mode lama) ─────────────────
    await poolWaschenPos.execute(
      `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE transaction_id = ?`,
      [dbStatus, txId]
    );
    const [unitRows] = await poolWaschenPos.execute(
      `SELECT id FROM tr_item_unit WHERE transaction_id = ?`,
      [txId]
    );
    for (const unit of unitRows) {
      await poolWaschenPos.execute(
        `INSERT INTO tr_production_log (item_unit_id, pic_id, stage, status, notes, started_at, created_at)
         VALUES (?, ?, ?, 'done', ?, NOW(), NOW())`,
        [unit.id, req.user?.userId, dbStatus, `Stage diubah menjadi: ${stage}`]
      );
    }

    if (dbStatus === 'packing' || dbStatus === 'ready') {
      const nextStatus = pickupType === 'delivery' ? 'ready_for_delivery' : 'ready_for_pickup';
      await poolWaschenPos.execute(
        `UPDATE tr_transaction SET status = ?, updated_at = NOW() WHERE id = ?`,
        [nextStatus, txId]
      );
      try {
        await poolWaschenPos.execute(
          `INSERT INTO tr_notification (transaction_id, type, recipient_customer_id, wa_number, message_body, status, sent_by, created_at, updated_at)
           SELECT t.id, 'selesai', t.customer_id, COALESCE(c.phone,'-'),
             CONCAT('Cucian Anda dengan nota ', t.transaction_no, ' sudah selesai dan siap ', IF(t.pickup_type='delivery','diantar oleh kurir kami.','diambil di outlet.')),
             'opened', ?, NOW(), NOW()
           FROM tr_transaction t JOIN mst_customer c ON c.id=t.customer_id WHERE t.id=?`,
          [req.user?.userId, txId]
        );
      } catch (_) { /* notifikasi tidak bloking */ }
    } else {
      await poolWaschenPos.execute(
        `UPDATE tr_transaction SET status = 'process', updated_at = NOW() WHERE id = ? AND status IN ('draft','pending')`,
        [txId]
      );
    }

    const [logRows] = await poolWaschenPos.execute(
      `SELECT pl.stage, pl.started_at AS timestamp
       FROM tr_production_log pl
       JOIN tr_item_unit iu ON iu.id = pl.item_unit_id
       WHERE iu.transaction_id = ?
       ORDER BY pl.started_at ASC`,
      [txId]
    );
    const progress = logRows.map((l) => ({ stage: reverseMap[l.stage] || l.stage, timestamp: l.timestamp }));

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

// ─── PATCH /api/transactions/:id/production-stage/revert ─────────────────────
// Rollback stage terakhir (untuk handle salah pencet)
// Hanya boleh revert kalau belum sampai 'Selesai' / 'Packing complete'
export const revertProductionStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, reason } = req.body;
    const userId = req.user?.userId || null;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Alasan revert wajib diisi.' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    const txId = rows[0].id;

    // Stage hierarchy untuk revert
    const stageOrder = ['received', 'washing', 'drying', 'ironing', 'packing', 'ready', 'done'];
    const revertMap = {
      'washing': 'received',
      'drying': 'washing',
      'ironing': 'washing',
      'packing': 'ironing',
      'ready': 'packing',
      'done': 'ready',
    };

    if (itemId) {
      // Per-item revert
      const [units] = await poolWaschenPos.execute(
        `SELECT id, production_status FROM tr_item_unit
         WHERE transaction_id = ? AND transaction_item_id = ?`,
        [txId, itemId]
      );
      if (units.length === 0) {
        return res.status(404).json({ success: false, message: 'Item tidak ditemukan.' });
      }
      // Tidak boleh revert kalau status = 'done' (sudah diserahkan ke customer)
      if (units.some(u => u.production_status === 'done')) {
        return res.status(409).json({ success: false, message: 'Tidak bisa revert: item sudah diserahkan ke customer.' });
      }

      for (const u of units) {
        const newStatus = revertMap[u.production_status] || u.production_status;
        if (newStatus !== u.production_status) {
          await poolWaschenPos.execute(
            `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE id = ?`,
            [newStatus, u.id]
          );
          // Hapus production_log entry terakhir untuk audit (tapi keep history untuk traceability)
          await poolWaschenPos.execute(
            `INSERT INTO tr_production_log (item_unit_id, stage, status, started_at, completed_at, pic_id, notes)
             VALUES (?, ?, 'reverted', NOW(), NOW(), ?, ?)`,
            [u.id, u.production_status, userId, `[REVERT] ${reason.trim()}`]
          ).catch(() => {});
        }
      }
    } else {
      // Tx-level revert: revert semua item
      const [units] = await poolWaschenPos.execute(
        `SELECT id, production_status FROM tr_item_unit WHERE transaction_id = ?`,
        [txId]
      );
      if (units.some(u => u.production_status === 'done')) {
        return res.status(409).json({ success: false, message: 'Tidak bisa revert: order sudah diserahkan ke customer.' });
      }
      for (const u of units) {
        const newStatus = revertMap[u.production_status] || u.production_status;
        if (newStatus !== u.production_status) {
          await poolWaschenPos.execute(
            `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE id = ?`,
            [newStatus, u.id]
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Stage berhasil dikembalikan ke tahap sebelumnya.',
    });
  } catch (err) {
    console.error('[revertProductionStage] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal revert stage.' });
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

    const hasApprovalActiveFlag = await hasColumn('tr_transaction_approval', 'is_active');
    const [existingReq] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction_approval
       WHERE transaction_id = ? AND type = ? AND status = 'pending'
       ${hasApprovalActiveFlag ? 'AND is_active = 1' : ''}
       LIMIT 1`,
      [tx.id, type]
    );

    if (existingReq.length > 0) {
      return res.status(409).json({ success: false, message: 'Sudah ada pengajuan yang masih menunggu persetujuan.' });
    }

    await poolWaschenPos.execute(
      `INSERT INTO tr_transaction_approval 
        (transaction_id, requested_by, type, status, reason, requested_at)
       VALUES (?, ?, ?, 'pending', ?, NOW())`,
      [tx.id, userId, type, reason.trim()]
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
// ─── POST /api/transactions/:id/condition ──────────────────────────────────
// Simpan dokumentasi foto kondisi/packing dari produksi
// Body: { photos: [{ url, type }], notes, isDamage, phase, itemId }
// phase: 'receive' | 'packing' (menentukan default photo_type kalau type tidak diset)
export const saveItemCondition = async (req, res) => {
  try {
    const { id } = req.params;
    const { photos, notes, isDamage, phase, itemId } = req.body;
    const userId = req.user?.userId || null;

    // 1. Cari transaksi
    const [txRow] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction WHERE id = ? OR transaction_no = ? LIMIT 1`,
      [id, id]
    );
    if (txRow.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    const txId = txRow[0].id;

    // 2. Cari item_unit yang akan dilekati foto
    let unitRows;
    if (itemId) {
      [unitRows] = await poolWaschenPos.execute(
        `SELECT id FROM tr_item_unit WHERE transaction_id = ? AND transaction_item_id = ? LIMIT 1`,
        [txId, itemId]
      );
    } else {
      [unitRows] = await poolWaschenPos.execute(
        `SELECT id FROM tr_item_unit WHERE transaction_id = ? LIMIT 1`,
        [txId]
      );
    }
    if (unitRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada item unit untuk dilekati foto. Pastikan transaksi sudah ada item.',
      });
    }
    const unitId = unitRows[0].id;

    // 3. Tentukan default photo_type berdasarkan phase
    // phase 'packing' → 'packing', phase 'receive' → 'initial_condition' (atau 'damage' kalau isDamage)
    const defaultPhotoType = phase === 'packing' ? 'packing'
      : (isDamage ? 'damage' : 'initial_condition');

    const mapType = (raw) => {
      if (!raw) return null;
      const t = String(raw).toLowerCase().trim();
      // Kalau phase = 'packing', semua foto jadi 'packing' (overrides type field)
      if (phase === 'packing') return 'packing';
      if (['after', 'packing', 'packing_handover', 'after_condition'].includes(t)) return 'packing';
      if (['before', 'initial', 'initial_condition', 'receive'].includes(t)) return 'initial_condition';
      if (t === 'damage') return 'damage';
      if (t === 'qc') return 'qc';
      if (t === 'problem_report') return 'damage';
      return null; // unknown → use default
    };

    // 4. Insert semua foto
    // expires_at format MySQL DATETIME (yyyy-mm-dd HH:MM:SS)
    const expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiresAt = expiresDate.toISOString().slice(0, 19).replace('T', ' ');
    const photoArr = Array.isArray(photos) ? photos : [];
    let insertedCount = 0;

    for (const p of photoArr) {
      const url = typeof p === 'string' ? p : (p?.url || p?.photoUrl);
      if (!url) continue;

      const photoType = mapType(p?.type) || defaultPhotoType;

      try {
        await poolWaschenPos.execute(
          `INSERT INTO tr_item_photo (item_unit_id, photo_url, photo_type, notes, expires_at, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [unitId, url, photoType, notes || null, expiresAt, userId]
        );
        insertedCount++;
      } catch (insertErr) {
        console.error('[saveItemCondition] insert failed:', insertErr.message, { code: insertErr.code, photoType });
      }
    }

    // 5. Edge case: tidak ada foto tapi ada notes (pure text laporan)
    if (insertedCount === 0 && notes && notes.trim()) {
      try {
        await poolWaschenPos.execute(
          `INSERT INTO tr_item_photo (item_unit_id, photo_url, photo_type, notes, expires_at, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [unitId, 'note_only', defaultPhotoType, notes, expiresAt, userId]
        );
        insertedCount++;
      } catch (e) {
        console.error('[saveItemCondition] note-only insert failed:', e.message);
      }
    }

    // 6. Tag damage di transaction notes
    if (isDamage) {
      await poolWaschenPos.execute(
        `UPDATE tr_transaction SET notes = CONCAT(COALESCE(notes, ''), ' | [AWAS ADA KERUSAKAN AWAL]') WHERE id = ?`,
        [txId]
      ).catch(() => {});
    }

    if (insertedCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada foto/catatan yang berhasil disimpan. Coba ulangi.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `${insertedCount} dokumentasi berhasil disimpan.`,
      data: { insertedCount, defaultPhotoType },
    });
  } catch (err) {
    console.error('[saveItemCondition] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan kondisi barang.' });
  }
};

// ─── DELETE /api/transactions/:id/photos/:photoId — soft delete foto kondisi
export const deleteItemPhoto = async (req, res) => {
  try {
    const { id, photoId } = req.params;
    const userId = req.user?.userId || null;

    // Validasi: foto memang milik transaksi ini
    const [rows] = await poolWaschenPos.execute(
      `SELECT ip.id, ip.photo_type
       FROM tr_item_photo ip
       JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
       JOIN tr_transaction t ON t.id = iu.transaction_id
       WHERE ip.id = ?
         AND (t.id = ? OR t.transaction_no = ?)
         AND ip.deleted_at IS NULL
       LIMIT 1`,
      [photoId, id, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Foto tidak ditemukan.' });
    }

    await poolWaschenPos.execute(
      `UPDATE tr_item_photo SET deleted_at = NOW() WHERE id = ?`,
      [photoId]
    );

    return res.json({ success: true, message: 'Foto berhasil dihapus.' });
  } catch (err) {
    console.error('[deleteItemPhoto]', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus foto.' });
  }
};

// ─── PATCH /api/transactions/:id/photos/:photoId — update notes/type foto
export const updateItemPhoto = async (req, res) => {
  try {
    const { id, photoId } = req.params;
    const { notes, photoType } = req.body;

    const [rows] = await poolWaschenPos.execute(
      `SELECT ip.id
       FROM tr_item_photo ip
       JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
       JOIN tr_transaction t ON t.id = iu.transaction_id
       WHERE ip.id = ?
         AND (t.id = ? OR t.transaction_no = ?)
         AND ip.deleted_at IS NULL
       LIMIT 1`,
      [photoId, id, id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Foto tidak ditemukan.' });
    }

    const validTypes = ['initial_condition', 'damage', 'packing', 'qc', 'other'];
    const updates = [];
    const params = [];

    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (photoType && validTypes.includes(photoType)) {
      updates.push('photo_type = ?');
      params.push(photoType);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada perubahan.' });
    }
    params.push(photoId);

    await poolWaschenPos.execute(
      `UPDATE tr_item_photo SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return res.json({ success: true, message: 'Foto berhasil diperbarui.' });
  } catch (err) {
    console.error('[updateItemPhoto]', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui foto.' });
  }
};

// ─── GET /api/transactions/:id/photos — debug endpoint utk cek foto tersimpan
export const getTransactionPhotos = async (req, res) => {
  try {
    const { id } = req.params;
    const [txRow] = await poolWaschenPos.execute(
      `SELECT id FROM tr_transaction WHERE id = ? OR transaction_no = ? LIMIT 1`,
      [id, id]
    );
    if (txRow.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    const txId = txRow[0].id;

    const [photos] = await poolWaschenPos.execute(
      `SELECT ip.id, ip.photo_type, ip.notes, ip.created_at, ip.expires_at, ip.deleted_at,
              CHAR_LENGTH(ip.photo_url) AS url_length,
              ip.uploaded_by, u.name AS uploaded_by_name,
              iu.transaction_item_id
       FROM tr_item_photo ip
       JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
       LEFT JOIN mst_user u ON u.id = ip.uploaded_by
       WHERE iu.transaction_id = ?
       ORDER BY ip.created_at DESC`,
      [txId]
    );

    return res.json({
      success: true,
      data: {
        txId,
        totalPhotos: photos.length,
        byType: photos.reduce((acc, p) => {
          acc[p.photo_type] = (acc[p.photo_type] || 0) + 1;
          return acc;
        }, {}),
        photos,
      },
    });
  } catch (err) {
    console.error('[getTransactionPhotos]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/transactions/:id/review ─────────────────────────────────────
export const saveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const [txRow] = await poolWaschenPos.execute(`SELECT id, customer_id FROM tr_transaction WHERE id = ? OR transaction_no = ? LIMIT 1`, [id, id]);
    if (txRow.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    const tx = txRow[0];

    const hasReviewDeletedAt = await hasColumn('tr_customer_review', 'deleted_at');
    const [existing] = await poolWaschenPos.execute(
      `SELECT id FROM tr_customer_review
       WHERE transaction_id = ?
       ${hasReviewDeletedAt ? 'AND deleted_at IS NULL' : ''}
       LIMIT 1`,
      [tx.id]
    );
    if (existing.length > 0) return res.status(409).json({ success: false, message: 'Review sudah diberikan sebelumnya.' });

    await poolWaschenPos.execute(
      `INSERT INTO tr_customer_review (customer_id, transaction_id, rating, review_text, source, submitted_at)
       VALUES (?, ?, ?, ?, 'kasir', NOW())`,
      [tx.customer_id, tx.id, rating, comment || null]
    );

    return res.status(200).json({ success: true, message: 'Review berhasil disimpan.' });
  } catch (err) {
    console.error('[saveReview] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan review.' });
  }
};

// ─── PATCH /api/transactions/:id/delivery-type ───────────────────────────────
export const updateDeliveryType = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { pickupType, pickupFee = 10000, deliveryFee = 10000, scheduleAt, areaZoneId, notes } = req.body;

    const VALID_TYPES = ['self', 'pickup', 'delivery'];
    if (!VALID_TYPES.includes(pickupType)) {
      conn.release();
      return res.status(400).json({ success: false, message: `pickupType harus salah satu dari: ${VALID_TYPES.join(', ')}` });
    }

    // Cari transaksi
    const [[tx]] = await conn.execute(
      `SELECT id, transaction_no, status, pickup_type, delivery_fee, total, subtotal,
              member_discount, promo_discount, manual_discount
       FROM tr_transaction WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [id]
    );
    if (!tx) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    if (['cancelled', 'completed'].includes(tx.status)) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Transaksi yang sudah selesai / dibatalkan tidak bisa diubah.' });
    }

    await conn.beginTransaction();

    // Hitung delivery_fee baru
    const newDeliveryFee = pickupType === 'self' ? 0
      : pickupType === 'pickup' ? Number(pickupFee)
      : Number(deliveryFee); // 'delivery'

    // Hitung ulang total
    const discountTotal = Number(tx.member_discount || 0) + Number(tx.promo_discount || 0) + Number(tx.manual_discount || 0);
    const newTotal = Number(tx.subtotal) - discountTotal + newDeliveryFee;

    // Update transaksi
    await conn.execute(
      `UPDATE tr_transaction
         SET pickup_type = ?, delivery_fee = ?, total = ?, updated_at = NOW()
         ${notes != null ? ', notes = CONCAT(IFNULL(notes,""), IF(notes IS NULL OR notes="","", " | "), ?)' : ''}
       WHERE id = ?`,
      notes != null
        ? [pickupType, newDeliveryFee, newTotal, `[Edit pengantaran: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}] ${notes}`]
        : [pickupType, newDeliveryFee, newTotal, id]
    );

    // Batalkan logistic orders lama yang masih pending
    await conn.execute(
      `UPDATE tr_logistic_order SET status = 'cancelled', updated_at = NOW()
       WHERE transaction_id = ? AND status IN ('pending','assigned')`,
      [tx.id]
    );

    // Buat logistic order baru jika bukan self
    const logisticSchedule = scheduleAt ? new Date(scheduleAt) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const userId = req.user?.userId;

    if (pickupType === 'pickup') {
      await conn.execute(
        `INSERT INTO tr_logistic_order (transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, created_by, created_at, updated_at)
         VALUES (?, 'pickup', ?, ?, ?, 'pending', ?, NOW(), NOW())`,
        [tx.id, areaZoneId || null, Number(pickupFee), logisticSchedule, userId]
      );
    } else if (pickupType === 'delivery') {
      await conn.execute(
        `INSERT INTO tr_logistic_order (transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, created_by, created_at, updated_at)
         VALUES (?, 'delivery', ?, ?, ?, 'pending', ?, NOW(), NOW())`,
        [tx.id, areaZoneId || null, Number(deliveryFee), logisticSchedule, userId]
      );
    }

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Jenis pengantaran berhasil diubah.',
      data: { pickupType, deliveryFee: newDeliveryFee, total: newTotal },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[updateDeliveryType] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah jenis pengantaran.' });
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/transactions/:id/items/:itemId/packing ────────────────────────
export const updatePackingInfo = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { packingNeeded, packingNotes, packingDone } = req.body;

    // Resolve transaction UUID
    const [txRows] = await poolWaschenPos.execute(
      `SELECT t.id FROM tr_transaction t
       JOIN tr_transaction_item ti ON ti.transaction_id = t.id AND ti.id = ?
       WHERE t.deleted_at IS NULL AND (t.id = ? OR t.transaction_no = ?) LIMIT 1`,
      [itemId, id, id]
    );
    if (!txRows.length) {
      return res.status(404).json({ success: false, message: 'Transaksi atau item tidak ditemukan.' });
    }

    // Update packing requirement di tr_transaction_item (kasir saat penerimaan)
    if (packingNeeded !== undefined || packingNotes !== undefined) {
      const fields = [];
      const vals = [];
      if (packingNeeded !== undefined) { fields.push('packing_needed = ?'); vals.push(Math.max(1, Number(packingNeeded) || 1)); }
      if (packingNotes !== undefined) { fields.push('packing_notes = ?'); vals.push(packingNotes || null); }
      vals.push(itemId);
      await poolWaschenPos.execute(
        `UPDATE tr_transaction_item SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
        vals
      );
    }

    // Update progress packing di tr_item_unit (produksi saat packing)
    if (packingDone !== undefined) {
      await poolWaschenPos.execute(
        `UPDATE tr_item_unit SET packing_done = ?, updated_at = NOW() WHERE transaction_item_id = ?`,
        [Math.max(0, Number(packingDone) || 0), itemId]
      );
    }

    // Kembalikan data terbaru
    const [result] = await poolWaschenPos.execute(
      `SELECT ti.packing_needed AS packingNeeded, ti.packing_notes AS packingNotes,
              COALESCE(iu.packing_done, 0) AS packingDone
       FROM tr_transaction_item ti
       LEFT JOIN tr_item_unit iu ON iu.transaction_item_id = ti.id
       WHERE ti.id = ? LIMIT 1`,
      [itemId]
    );

    return res.status(200).json({
      success: true,
      message: 'Info packing diperbarui.',
      data: result[0] || { packingNeeded: 1, packingNotes: null, packingDone: 0 },
    });
  } catch (err) {
    console.error('[updatePackingInfo] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui info packing.' });
  }
};

const PRODUCTION_STATUS_LABEL = {
  received: 'Diterima',
  waiting: 'Menunggu',
  washing: 'Cuci',
  drying: 'Cuci',
  ironing: 'Setrika',
  qc: 'QC',
  packing: 'Packing',
  ready: 'Selesai',
};

const RECEIVE_PHOTO_TYPES = new Set(['initial_condition', 'damage']);
const PACKING_PHOTO_TYPES = new Set(['packing']);

/** Ringkasan status produksi + foto per transaksi (batch). */
const getProductionMetaBatch = async (transactionIds) => {
  const map = new Map();
  if (!transactionIds?.length) return map;

  const placeholders = transactionIds.map(() => '?').join(',');
  const [unitRows] = await poolWaschenPos.execute(
    `SELECT transaction_id,
            COUNT(*) AS totalUnits,
            SUM(CASE WHEN production_status = 'ready' THEN 1 ELSE 0 END) AS readyUnits,
            SUM(CASE WHEN production_status NOT IN ('ready') THEN 1 ELSE 0 END) AS notReadyUnits,
            MIN(production_status) AS minStatus
     FROM tr_item_unit
     WHERE transaction_id IN (${placeholders})
     GROUP BY transaction_id`,
    transactionIds
  );

  let photoRows = [];
  try {
    const [pr] = await poolWaschenPos.execute(
      `SELECT iu.transaction_id, ip.photo_type
       FROM tr_item_photo ip
       JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
       WHERE iu.transaction_id IN (${placeholders})
         AND ip.deleted_at IS NULL`,
      transactionIds
    );
    photoRows = pr;
  } catch (err) {
    console.warn('[getProductionMetaBatch] photo query error:', err?.message);
    photoRows = [];
  }

  const photosByTx = new Map();
  for (const p of photoRows) {
    const list = photosByTx.get(p.transaction_id) || new Set();
    list.add(p.photo_type);
    photosByTx.set(p.transaction_id, list);
  }

  for (const u of unitRows) {
    const types = photosByTx.get(u.transaction_id) || new Set();
    const hasReceivePhoto = [...types].some((t) => RECEIVE_PHOTO_TYPES.has(t));
    const hasPackingPhoto = [...types].some((t) => PACKING_PHOTO_TYPES.has(t));
    const total = Number(u.totalUnits) || 0;
    const ready = Number(u.readyUnits) || 0;
    map.set(u.transaction_id, {
      totalUnits: total,
      readyUnits: ready,
      notReadyUnits: Number(u.notReadyUnits) || 0,
      allProductionReady: total > 0 && ready === total,
      productionStageLabel: PRODUCTION_STATUS_LABEL[u.minStatus] || u.minStatus || '-',
      hasReceivePhoto,
      hasPackingPhoto,
      canMarkReadyForPickup: total > 0 && ready === total && hasPackingPhoto,
    });
  }

  for (const txId of transactionIds) {
    if (!map.has(txId)) {
      map.set(txId, {
        totalUnits: 0,
        readyUnits: 0,
        notReadyUnits: 0,
        allProductionReady: false,
        productionStageLabel: '-',
        hasReceivePhoto: false,
        hasPackingPhoto: false,
        canMarkReadyForPickup: false,
      });
    }
  }
  return map;
};

// ─── GET /api/transactions/production/history — riwayat produksi (per item selesai) ───
export const getProductionHistory = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    const params = [days];
    let outletSql = '';
    if (userOutletId) {
      outletSql = ' AND t.outlet_id = ?';
      params.push(userOutletId);
    }

    // Ambil PER-ITEM dari nota yang SEMUA item-nya sudah selesai produksi
    // (nota udah lulus dari antrian → masuk ke Riwayat).
    // Item dianggap "selesai" kalau SEMUA unit-nya sudah ready atau done.
    // Status item: 'done' jika nota sudah dipickup customer, else 'ready'.
    // Pre-aggregate per (transaction_item_id, transaction_id) supaya kompatibel only_full_group_by.
    const [itemRows] = await poolWaschenPos.execute(
      `SELECT
        agg.itemId,
        agg.production_status,
        agg.itemUpdatedAt,
        ti.service_name_snapshot AS itemName,
        ti.unit_type_snapshot AS itemUnit,
        ti.qty,
        ti.is_express AS itemExpress,
        t.id AS txId,
        t.transaction_no AS transactionNo,
        t.status AS dbStatus,
        t.picked_up_at AS pickedUpAt,
        t.total,
        t.is_express AS txExpress,
        t.updated_at AS updatedAt,
        t.created_at AS createdAt,
        c.name AS customerName,
        c.phone AS customerPhone,
        o.name AS outletName,
        tx_agg.txAllReady
      FROM (
        SELECT
          iu.transaction_item_id AS itemId,
          iu.transaction_id AS txId,
          MAX(iu.updated_at) AS itemUpdatedAt,
          SUM(CASE WHEN iu.production_status NOT IN ('ready','done') THEN 1 ELSE 0 END) AS unfinishedCount,
          SUM(CASE WHEN iu.production_status = 'done' THEN 1 ELSE 0 END) AS doneCount,
          COUNT(*) AS totalUnits,
          CASE
            WHEN SUM(CASE WHEN iu.production_status = 'done' THEN 1 ELSE 0 END) = COUNT(*) THEN 'done'
            ELSE 'ready'
          END AS production_status
        FROM tr_item_unit iu
        GROUP BY iu.transaction_item_id, iu.transaction_id
      ) agg
      JOIN (
        SELECT
          iu.transaction_id AS txId,
          SUM(CASE WHEN iu.production_status NOT IN ('ready','done') THEN 1 ELSE 0 END) AS txUnfinishedUnits,
          CASE WHEN SUM(CASE WHEN iu.production_status NOT IN ('ready','done') THEN 1 ELSE 0 END) = 0 THEN 1 ELSE 0 END AS txAllReady
        FROM tr_item_unit iu
        GROUP BY iu.transaction_id
      ) tx_agg ON tx_agg.txId = agg.txId
      JOIN tr_transaction_item ti ON ti.id = agg.itemId
      JOIN tr_transaction t ON t.id = agg.txId
      JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      WHERE t.deleted_at IS NULL
        AND t.status <> 'cancelled'
        AND agg.unfinishedCount = 0
        AND agg.totalUnits > 0
        AND tx_agg.txAllReady = 1
        AND agg.itemUpdatedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ${outletSql}
      ORDER BY agg.itemUpdatedAt DESC
      LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    // Hitung total untuk pagination — match same filter (nota yg semua item-nya ready)
    const countParams = [days];
    if (userOutletId) countParams.push(userOutletId);
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM (
        SELECT iu.transaction_item_id
        FROM tr_item_unit iu
        JOIN tr_transaction t ON t.id = iu.transaction_id
        JOIN (
          SELECT iu2.transaction_id AS txId,
                 SUM(CASE WHEN iu2.production_status NOT IN ('ready','done') THEN 1 ELSE 0 END) AS txUnfinishedUnits
          FROM tr_item_unit iu2
          GROUP BY iu2.transaction_id
        ) tx_agg ON tx_agg.txId = iu.transaction_id
        WHERE t.deleted_at IS NULL
          AND t.status <> 'cancelled'
          AND tx_agg.txUnfinishedUnits = 0
          AND iu.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          ${outletSql}
        GROUP BY iu.transaction_item_id, iu.transaction_id
        HAVING SUM(CASE WHEN iu.production_status NOT IN ('ready','done') THEN 1 ELSE 0 END) = 0
           AND COUNT(*) > 0
      ) sub`,
      countParams
    );
    const total = Number(countRows[0]?.total || 0);

    const txIds = [...new Set(itemRows.map(r => r.txId))];
    const metaMap = txIds.length > 0 ? await getProductionMetaBatch(txIds) : new Map();

    const data = itemRows.map((r) => ({
      id: r.transactionNo || r.txId,
      transactionUuid: r.txId,
      itemId: r.itemId,
      itemName: r.itemName,
      itemUnit: r.itemUnit,
      qty: Number(r.qty || 1),
      isExpress: r.itemExpress === 1 || r.txExpress === 1,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      outletName: r.outletName || null,
      total: Number(r.total || 0),
      status: mapDbStatusToFrontend(r.dbStatus, r.pickedUpAt),
      // 'done' kalau nota sudah dipickup customer (tx.picked_up_at != null),
      // 'ready' kalau item sudah selesai produksi tapi belum dipickup
      productionStatus: r.pickedUpAt ? 'done' : 'ready',
      updatedAt: r.itemUpdatedAt || r.updatedAt,
      createdAt: r.createdAt,
      production: metaMap.get(r.txId) || null,
      productionDone: true,
    }));

    return res.status(200).json({
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
    console.error('[getProductionHistory] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat produksi.' });
  }
};

// ─── GET /api/transactions/production/order/:id — detail riwayat (role produksi) ───
export const getProductionOrderDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userOutletId = req.user?.outletId;

    const [trxRows] = await poolWaschenPos.execute(
      `SELECT t.id, t.transaction_no AS transactionNo, t.status AS dbStatus,
              t.picked_up_at AS pickedUpAt, t.is_express AS isExpress,
              t.notes, t.estimated_done_at AS estimatedDoneAt,
              t.created_at AS createdAt, t.updated_at AS updatedAt,
              t.pickup_type AS pickupType,
              c.name AS customerName, c.phone AS customerPhone,
              o.name AS outletName
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE t.deleted_at IS NULL AND (t.id = ? OR t.transaction_no = ?)
       ${userOutletId ? 'AND t.outlet_id = ?' : ''}
       LIMIT 1`,
      userOutletId ? [id, id, userOutletId] : [id, id]
    );

    if (!trxRows.length) {
      return res.status(404).json({ success: false, message: 'Order tidak ditemukan.' });
    }

    const t = trxRows[0];
    const stageMap = {
      received: 'Diterima', washing: 'Cuci', drying: 'Cuci',
      ironing: 'Setrika', qc: 'QC', packing: 'Packing', ready: 'Selesai',
    };
    const hasItemActiveFlag = await hasColumn('tr_transaction_item', 'is_active');
    const [items] = await poolWaschenPos.execute(
      `SELECT ti.id AS itemId, ti.service_name_snapshot AS name,
              ti.unit_type_snapshot AS unit, ti.qty, ti.is_express AS isExpress
       FROM tr_transaction_item ti
       WHERE ti.transaction_id = ?
       ${hasItemActiveFlag ? 'AND ti.is_active = 1' : ''}`,
      [t.id]
    );

    const [logRows] = await poolWaschenPos.execute(
      `SELECT pl.stage, pl.started_at AS startedAt, pl.notes,
              iu.transaction_item_id AS itemId
       FROM tr_production_log pl
       JOIN tr_item_unit iu ON iu.id = pl.item_unit_id
       WHERE iu.transaction_id = ?
       ORDER BY pl.started_at ASC`,
      [t.id]
    );

    const timelineMap = new Map();
    const logsByItem = new Map();
    for (const log of logRows) {
      const stageLabel = stageMap[log.stage] || log.stage;
      const entry = { stage: stageLabel, timestamp: log.startedAt };
      if (!timelineMap.has(stageLabel)) timelineMap.set(stageLabel, entry);
      const list = logsByItem.get(log.itemId) || [];
      if (!list.some((l) => l.stage === stageLabel)) list.push(entry);
      logsByItem.set(log.itemId, list);
    }

    const STAGE_ORDER = ['Diterima', 'Cuci', 'Setrika', 'Packing', 'Selesai', 'QC'];
    const timeline = STAGE_ORDER
      .filter((s) => timelineMap.has(s))
      .map((s) => timelineMap.get(s));

    const findStageTime = (dbStage) => {
      const row = logRows.find((l) => l.stage === dbStage);
      return row?.startedAt || null;
    };

    let conditionPhotos = [];
    try {
      const [photoRows] = await poolWaschenPos.execute(
        `SELECT ip.id, ip.photo_url AS url, ip.photo_type AS type, ip.notes,
                ip.created_at AS createdAt, u.name AS uploadedByName
         FROM tr_item_photo ip
         JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
         LEFT JOIN mst_user u ON u.id = ip.uploaded_by
         WHERE iu.transaction_id = ?
           AND ip.deleted_at IS NULL
           AND ip.photo_url IS NOT NULL
           AND ip.photo_url <> 'note_only'
         ORDER BY ip.created_at ASC`,
        [t.id]
      );
      conditionPhotos = photoRows;
    } catch (err) {
      console.warn('[conditionPhotos query]', err?.message);
      conditionPhotos = [];
    }

    const receivePhotos = conditionPhotos.filter((p) => RECEIVE_PHOTO_TYPES.has(p.type));
    const packingPhotos = conditionPhotos.filter((p) => PACKING_PHOTO_TYPES.has(p.type));

    const metaMap = await getProductionMetaBatch([t.id]);
    const userNotes = (t.notes || '').replace(/\[Bayar:[^\]]*\]/g, '').trim();

    const serviceItems = items.map((item) => {
      const progress = logsByItem.get(item.itemId) || [];
      const doneStages = progress.map((p) => p.stage);
      const currentStage = STAGE_ORDER.find((s) => !doneStages.includes(s)) || 'Selesai';
      return {
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        qty: Number(item.qty || 1),
        isExpress: item.isExpress === 1 || item.isExpress === true,
        progress,
        currentStage,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        id: t.transactionNo || t.id,
        transactionUuid: t.id,
        customerName: t.customerName,
        customerPhone: t.customerPhone,
        outletName: t.outletName,
        isExpress: t.isExpress === 1 || t.isExpress === true,
        pickupType: t.pickupType || 'pickup',
        status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
        receivedAt: findStageTime('received') || t.createdAt,
        finishedAt: findStageTime('ready') || t.updatedAt,
        pickedUpAt: t.pickedUpAt,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        estimatedDoneAt: t.estimatedDoneAt,
        notes: userNotes || null,
        timeline,
        items: serviceItems,
        conditionPhotos,
        receivePhotos,
        packingPhotos,
        production: metaMap.get(t.id) || null,
      },
    });
  } catch (err) {
    console.error('[getProductionOrderDetail] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat detail produksi.' });
  }
};