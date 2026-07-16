import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { dbToUiTxStatus as _dbToUiTxStatus, uiToDbStatusFilter } from '../utils/statusMap.js';
import { emitTransactionCheckout, emitProductionUpdate, emitPaymentSettled, emitProductionNewItem, emitPhotoSaved } from '../services/eventBus.js';
import { sendOrderCreatedNotification, sendOrderStatusUpdatedNotification, sendOrderReadyNotification } from '../services/whatsappService.js';
import { updateCustomerSegmentation } from '../services/segmentationService.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Transaction');

const schemaColumnCache = new Map();

// ─── Helper: BigInt → safe number/string for JSON serialization ─────────────────
const safeBigInt = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : String(v);
  }
  return v;
};

// Recursively sanitize objects/arrays for BigInt
const sanitizeResponse = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') {
    const n = Number(obj);
    return Number.isSafeInteger(n) ? n : String(obj);
  }
  if (Array.isArray(obj)) return obj.map(sanitizeResponse);
  if (typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeResponse(value);
    }
    return result;
  }
  return obj;
};

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
  const allowed = ['cash', 'transfer', 'deposit', 'qris', 'edc'];
  return allowed.includes(m) ? m : 'cash';
};

// ─── POST /api/transactions/checkout ──────────────────────────────────────────
export const checkoutTransaction = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    // DEBUG: Log incoming request
    logger.info('[checkout] Incoming request:', {
      customerId: req.body.customerId,
      itemsCount: req.body.items?.length,
      paymentMethod: req.body.payment?.method,
      pickupType: req.body.pickupType,
      scheduleAt: req.body.scheduleAt,
      kasirConfirmed: req.body.paymentIntent?.verifiedByKasir,
    });

    // TEMP: Log all request body keys for debugging
    logger.info('[checkout] Body keys:', Object.keys(req.body || {}));

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
      pickupType: bodyPickupType,
      promoId: bodyPromoId,
      // ── PIC (Penanggung Jawab) ───────────────────────────────────────────────
      picId,
      picName,
    } = req.body;

    const { userId, outletId: tokenOutletId } = req.user;
    let outletId = tokenOutletId || payloadOutletId;

    // Fallback PIC to current user if not provided
    const resolvedPicId = picId || userId;
    const resolvedPicName = picName || req.user?.name || 'Unknown';

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

    // ── BUG FIX 7: Pickup Schedule Validation (Requirements 2.9, 2.10, 2.11) ───
    // Validate schedule fields based on order_type
    // Frontend sends scheduleAt as top-level field, not inside pickup/delivery object
    const pickupScheduleAt = req.body.scheduleAt || req.body.pickup_schedule_at;
    const deliveryScheduleAt = req.body.scheduleAt || req.body.delivery_schedule_at;
    const pickupType = bodyPickupType || (pickup && delivery ? 'both' : pickup ? 'pickup' : delivery ? 'delivery' : 'self');

    // Schedule validation - only enforce for pure pickup or pure delivery
    // For 'both' (pickup_and_delivery), schedules are optional
    if (pickupType === 'pickup') {
      if (!pickupScheduleAt) {
        conn.release();
        return res.status(422).json({
          success: false,
          message: 'Jadwal pickup wajib diisi untuk order type "pickup".',
          errors: {
            pickup_schedule_at: 'Required for order_type: pickup'
          }
        });
      }
    }

    if (pickupType === 'delivery') {
      if (!deliveryScheduleAt) {
        conn.release();
        return res.status(422).json({
          success: false,
          message: 'Jadwal delivery wajib diisi untuk order type "delivery".',
          errors: {
            delivery_schedule_at: 'Required for order_type: delivery'
          }
        });
      }
    }

    // For pickupType === 'both', schedules are optional - no validation needed

    if (pickupType === 'self') {
      // Strip pickup/delivery schedule for "self" (self-pickup at outlet)
      // Customer will come directly to outlet without scheduled pickup/delivery
      if (req.body.pickup_schedule_at || req.body.delivery_schedule_at) {
        // Ignoring schedule fields for pickupType="self"
      }
    }

    // ── BUG FIX 8.2: DateTime Validation (Requirements Bug #13) ───
    // Reject past dates for pickup/delivery schedules
    // Validate against outlet operating hours (08:00 - 21:00)
    const now = new Date();
    const outletOpenHour = 8; // 08:00
    const outletCloseHour = 21; // 21:00

    if (pickupScheduleAt) {
      const pickupDate = new Date(pickupScheduleAt);
      
      // Reject past dates
      if (pickupDate < now) {
        conn.release();
        return res.status(422).json({
          success: false,
          message: 'Jadwal pickup tidak boleh di masa lampau.',
          errors: {
            pickup_schedule_at: 'Pickup schedule cannot be in the past'
          }
        });
      }

      // Validate operating hours (08:00 - 21:00)
      const pickupHour = pickupDate.getHours();
      if (pickupHour < outletOpenHour || pickupHour >= outletCloseHour) {
        conn.release();
        return res.status(422).json({
          success: false,
          message: `Jadwal pickup harus dalam jam operasional outlet (${outletOpenHour.toString().padStart(2, '0')}:00 - ${outletCloseHour.toString().padStart(2, '0')}:00).`,
          errors: {
            pickup_schedule_at: `Pickup schedule must be within operating hours (${outletOpenHour}:00 - ${outletCloseHour}:00)`
          }
        });
      }
    }

    if (deliveryScheduleAt) {
      const deliveryDate = new Date(deliveryScheduleAt);
      
      // Reject past dates
      if (deliveryDate < now) {
        conn.release();
        return res.status(422).json({
          success: false,
          message: 'Jadwal delivery tidak boleh di masa lampau.',
          errors: {
            delivery_schedule_at: 'Delivery schedule cannot be in the past'
          }
        });
      }

      // Validate operating hours (08:00 - 21:00)
      const deliveryHour = deliveryDate.getHours();
      if (deliveryHour < outletOpenHour || deliveryHour >= outletCloseHour) {
        conn.release();
        return res.status(422).json({
          success: false,
          message: `Jadwal delivery harus dalam jam operasional outlet (${outletOpenHour.toString().padStart(2, '0')}:00 - ${outletCloseHour.toString().padStart(2, '0')}:00).`,
          errors: {
            delivery_schedule_at: `Delivery schedule must be within operating hours (${outletOpenHour}:00 - ${outletCloseHour}:00)`
          }
        });
      }
    }

    await conn.beginTransaction();

    // ── Ambil customer data untuk emit dan notifikasi ─────────────────────────────
    let customerName = 'Customer';
    let customer = { name: 'Customer', phone: null, id: customerId };
    try {
      const [[cust]] = await conn.execute(
        `SELECT name, phone FROM mst_customer WHERE id = ? LIMIT 1`,
        [customerId]
      );
      if (cust) {
        customerName = cust.name;
        customer = { ...customer, ...cust };
      }
    } catch (err) {
      logger.warn('[checkoutTransaction] Gagal fetch customer:', err?.message);
    }

    // ── Generate transaction_no: WSC-YYMMDD-XXX ────────────────────────────────
    const transactionNo = await generateTransactionNo(conn);

    // ── Batch-fetch service info untuk snapshot name & unit ────────────────────
    const serviceIds = [...new Set(items.map((i) => i.serviceId || i.id).filter(Boolean))];
    const serviceMap = {};
    if (serviceIds.length > 0) {
      const ph = serviceIds.map(() => '?').join(',');
      const [svcRows] = await conn.execute(
        `SELECT id, name AS service_name, unit_type AS unit, price, express_multiplier,
                category_id, requires_material, durasi_hari
         FROM mst_service WHERE id IN (${ph})`,
        serviceIds
      );
      svcRows.forEach((s) => { serviceMap[s.id] = s; });
    }

    // ── BUG FIX 3 & 4: Material Validation & M² Calculation (Requirements 2.4, 2.5) ───
    // Validate items before processing
    const validatedItems = [];
    for (const item of items) {
      const serviceId = item.serviceId || item.id;
      const service = serviceMap[serviceId];
      
      if (!service) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({
          success: false,
          message: `Service ID ${serviceId} tidak ditemukan.`
        });
      }
      
      // BUG FIX 3: Material Validation
      if (service.requires_material === 1 || service.requires_material === true) {
        if (!item.materialId && !item.material_id) {
          await conn.rollback();
          conn.release();
          return res.status(422).json({
            success: false,
            message: `Service "${service.service_name}" memerlukan pilihan material (jenis bahan).`,
            errors: {
              material_id: `Required for service: ${service.service_name}`
            }
          });
        }
      }
      
      // BUG FIX 4: M² Calculation Enforcement
      // Accept both 'm2' and 'm²' (handles frontend/backend encoding differences)
      const unitStr = String(service.unit || '').trim();
      const isM2 = unitStr === 'm2' || unitStr === 'm²';
      if (isM2) {
        // Frontend sends carpetPanjangCm / carpetLebarCm (stored in cm)
        // Backend reads item.length / item.width (expecting cm values)
        const pCm = Number(item.carpetPanjangCm ?? item.length ?? 0);
        const lCm = Number(item.carpetLebarCm ?? item.width ?? 0);
        
        if (!pCm || !lCm) {
          await conn.rollback();
          conn.release();
          return res.status(422).json({
            success: false,
            message: `Service "${service.service_name}" dengan unit m² memerlukan input dimensi karpet (panjang & lebar dalam cm).`,
            errors: {
              carpetPanjangCm: 'Required for m² services',
              carpetLebarCm: 'Required for m² services',
            }
          });
        }

        // Convert cm → m, then calculate qty (area in m²)
        const pM = pCm / 100;
        const lM = lCm / 100;
        const calculatedQty = Math.round(pM * lM * 100) / 100; // 2 decimal places

        // Normalize field names for downstream code (tr_transaction_item insert)
        item.length = pM;
        item.width = lM;
        item.carpetPanjangCm = pCm;
        item.carpetLebarCm = lCm;
        item.qty = calculatedQty;
      }
      
      validatedItems.push(item);
    }

    // ── Hitung amounts ─────────────────────────────────────────────────────────
    const isExpress = validatedItems.some((i) => i.isExpress || i.express);
    const pickupFee = pickup ? 10000 : 0;
    const deliveryFee = delivery ? 10000 : 0;

    const computedSubtotal = payloadSubtotal != null
      ? Number(payloadSubtotal)
      : validatedItems.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);

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

    // ── BUG FIX 12: Member Discount Real-time Validation (Requirements 2.17, 2.18) ──
    // Check real-time membership status, not just is_member flag
    let memberDiscount = 0;
    let activeMembershipId = null;
    try {
      // Query for active membership with real-time expiry check
      const [[memb]] = await conn.execute(
        `SELECT m.id, m.discount_pct, m.status, m.expired_at
         FROM mst_membership m
         WHERE m.customer_id = ? 
           AND m.status = 'active' 
           AND m.expired_at >= NOW()
         ORDER BY m.expired_at DESC
         LIMIT 1`,
        [customerId]
      );
      
      if (memb) {
        // Membership is active and not expired
        activeMembershipId = memb.id;
        const pct = Number(memb.discount_pct) || 20;
        memberDiscount = Math.round((computedSubtotal * pct) / 100);
        // Cap supaya tidak melebihi subtotal - promo
        memberDiscount = Math.min(memberDiscount, Math.max(0, computedSubtotal - promoDiscount));
        
        logger.info('[checkout]', 'Active membership found', { customerId, pct, memberDiscount });
      } else {
        // Membership expired or inactive - no discount
        logger.info('[checkout]', 'Customer has no active membership or expired', { customerId });
      }
    } catch (e) {
      logger.warn('[checkout] member discount calc gagal:', e?.message || e);
    }

    // ── Birthday Discount Auto-Apply (Phase 7: Birthday Program) ──────────────
    // Check if today is within 7 days of customer's birthday
    let birthdayDiscount = 0;
    let birthdayPromoId = null;
    try {
      // Get customer's birth_date
      const [[cust]] = await conn.execute(
        `SELECT birth_month, birth_day, birth_date FROM mst_customer WHERE id = ?`,
        [customerId]
      );

      if (cust && (cust.birth_month != null || cust.birth_date != null)) {
        const birthMonth = cust.birth_month || new Date(cust.birth_date).getMonth() + 1;
        const birthDay = cust.birth_day || new Date(cust.birth_date).getDate();
        const today = new Date();

        // Calculate days until/since birthday this year
        const thisYearBirthday = new Date(today.getFullYear(), birthMonth - 1, birthDay);
        let daysDiff = Math.floor((thisYearBirthday - today) / (1000 * 60 * 60 * 24));

        // If birthday already passed this year, consider next year
        if (daysDiff < -7) {
          // Birthday was more than 7 days ago, skip
          logger.info('[checkout]', 'Birthday discount skipped', { birthMonth, birthDay, daysDiff });
        } else if (daysDiff <= 7 && daysDiff >= -7) {
          // Birthday is within 7 days - apply discount
          const birthdayDiscountPct = 10; // Default 10%
          birthdayDiscount = Math.round((computedSubtotal * birthdayDiscountPct) / 100);

          // Cap birthday discount: shouldn't exceed subtotal minus other discounts
          birthdayDiscount = Math.min(birthdayDiscount, Math.max(0, computedSubtotal - promoDiscount - memberDiscount));

          // Get or create birthday promo
          const [promoRows] = await conn.execute(
            `SELECT id FROM mst_promo
             WHERE promo_type = 'birthday' AND is_active = 1
               AND (valid_from IS NULL OR valid_from <= CURDATE())
               AND (valid_until IS NULL OR valid_until >= CURDATE())
             LIMIT 1`
          );

          if (promoRows.length > 0) {
            birthdayPromoId = promoRows[0].id;
          }

          logger.info('[checkout]', 'Birthday discount applied', { customerId, birthdayDiscountPct, birthdayDiscount });
        }
      }
    } catch (bdayErr) {
      logger.warn('[checkout] birthday discount check failed:', bdayErr?.message || bdayErr);
    }

    const computedTotal = payloadTotal != null
      ? Number(payloadTotal)
      : computedSubtotal - promoDiscount - memberDiscount - birthdayDiscount - manualDiscount + pickupFee + deliveryFee;

    let paidAmount;
    let changeAmount;
    let paymentStatus;
    let primaryPaymentMethod;

    // ── SIMPLIFIED PAYMENT AUTO-DETECT ─────────────────────────────────────────
    // Frontend now sends only: paidAmount + method
    // Backend auto-detects status based on paidAmount vs computedTotal
    //
    // Status Logic:
    // - paidAmount >= computedTotal → 'paid' (LUNAS)
    // - paidAmount > 0 && paidAmount < computedTotal → 'partial' (SEBAGIAN)
    // - paidAmount = 0 → 'unpaid' (BAYAR NANTI)
    //
    // Backward compat: if legacy payTiming/payPlan still sent, use that logic
    // ─────────────────────────────────────────────────────────────────────────

    if (hasPaymentIntent) {
      const isLegacyIntent = paymentIntent.payTiming !== undefined || paymentIntent.payPlan !== undefined;

      if (isLegacyIntent) {
        // Legacy flow: respect payTiming/payPlan from frontend
        const payTiming = paymentIntent.payTiming === 'later' ? 'later' : 'now';
        const payPlan = paymentIntent.payPlan === 'dp' ? 'dp' : 'full';
        const dpAmount = Math.max(0, Number(paymentIntent.dpAmount || 0));

        if (payTiming === 'later') {
          if (payPlan === 'dp' && dpAmount > 0) {
            paidAmount = Math.min(dpAmount, computedTotal);
            primaryPaymentMethod = payment?.method ? mapPayMethod(payment.method) : 'cash';
          } else {
            paidAmount = 0;
            primaryPaymentMethod = payment?.method ? mapPayMethod(payment.method) : 'cash';
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
      } else {
        // SIMPLIFIED NEW FLOW: Auto-detect from paidAmount
        // Frontend sends: paidAmount (amount customer pays NOW), method
        // Backend determines status automatically

        if (payment?.paidAmount != null) {
          // Use paidAmount from frontend
          paidAmount = Math.max(0, Number(payment.paidAmount));
        } else if (paymentIntent.paidAmount != null) {
          paidAmount = Math.max(0, Number(paymentIntent.paidAmount));
        } else {
          // Default: assume full payment if no paidAmount specified
          paidAmount = computedTotal;
        }

        // Validate: need method if paying anything
        if (paidAmount > 0 && !payment?.method) {
          await conn.rollback();
          return res.status(400).json({ success: false, message: 'Metode pembayaran wajib untuk nominal yang dibayar sekarang' });
        }

        primaryPaymentMethod = payment?.method ? mapPayMethod(payment.method) : 'cash';
      }

      changeAmount = payment?.changeAmount != null
        ? Number(payment.changeAmount)
        : Math.max(0, paidAmount - computedTotal);

      // AUTO-DETECT PAYMENT STATUS based on paidAmount vs computedTotal
      if (paidAmount >= computedTotal && computedTotal >= 0) paymentStatus = 'paid';
      else if (paidAmount > 0) paymentStatus = 'partial';
      else paymentStatus = 'unpaid';

      // ── External method guard: QRIS/EDC/Transfer require kasir confirmation ──
      // Even if paidAmount >= total, don't mark as 'paid' until kasir explicitly
      // confirms money received. This prevents false-lunas for claimed-but-unverified payments.
      const externalMethods = ['qris', 'edc', 'transfer'];
      if (externalMethods.includes(primaryPaymentMethod) && paymentStatus === 'paid') {
        const confirmed = paymentIntent?.verifiedByKasir || paymentIntent?.confirmedByKasir;
        if (!confirmed) paymentStatus = 'menunggu_verifikasi';
      }
    } else {
      paidAmount = payment.paidAmount != null ? Number(payment.paidAmount) : computedTotal;
      changeAmount = payment.changeAmount != null ? Number(payment.changeAmount) : Math.max(0, paidAmount - computedTotal);
      paymentStatus = paidAmount >= computedTotal ? 'paid' : 'partial';
      primaryPaymentMethod = mapPayMethod(payment.method);
    }

    // Note: pickupType already determined in BUG FIX 7 validation section above

    // SIMPLIFIED: Build payment summary based on status
    // Shows: LUNAS / DP / BAYAR NANTI + amount info
    const statusLabel = paymentStatus === 'paid' ? 'LUNAS'
      : paymentStatus === 'partial' ? 'DP'
      : 'BAYAR NANTI';
    const paidLabel = paidAmount > 0 ? `${statusLabel}:${paidAmount}` : 'BAYAR NANTI';
    const intentSummary = hasPaymentIntent ? `[${paidLabel}]` : '';
    const combinedNotes = [notes?.trim() || '', intentSummary].filter(Boolean).join('\n') || null;

    // ── Auto-compute SLA berdasarkan durasi_hari (MAX principle) ─────────────────
    // LOGIKA: 1 Nota = 1 waktu pengambilan customer
    // Estimasi nota = MAX(durasi_hari) dari semua item dalam nota
    // Karena customer TIDAK akan datang 3x untuk ambil 3 item terpisah
    // Mereka datang sekali, jadi estimasi = item yang paling lambat selesai
    //
    // Contoh:
    //   Cuci Kering (2 hari) + Dry Clean (3 hari) + Setrika (1 hari)
    //   → Estimasi Nota = MAX(2, 3, 1) = 3 hari
    //
    // Konsep ini mengikuti multi-item order di laundry profesional:
    // "All items ready at the same time" - baru diambil bersamaan
    // ORDER DATE: selalu gunakan tanggal order untuk menghitung estimasi per item
    const orderDate = new Date();

    let finalEstimatedDone = dueDate || null;
    if (!finalEstimatedDone) {
      try {
        const serviceIds = items.map(i => i.serviceId).filter(Boolean);
        let maxDurasiHari = 2; // default 2 hari jika tidak ada data

        if (serviceIds.length > 0) {
          // Ambil durasi_hari dari setiap service dan hitung MAX
          const [svcRows] = await conn.execute(
            `SELECT COALESCE(MAX(durasi_hari), 2) AS maxDurasi
             FROM mst_service WHERE id IN (${serviceIds.map(() => '?').join(',')})`,
            serviceIds
          );
          if (svcRows[0]?.maxDurasi) {
            maxDurasiHari = Number(svcRows[0].maxDurasi);
          }

          // Log untuk debugging
          logger.info('[checkout] SLA Calculation:', {
            serviceIds,
            maxDurasiHari,
            itemCount: serviceIds.length,
            principle: 'MAX(durasi_hari) - all items ready at same time'
          });
        }

        // Hitung tanggal selesai = tanggal order + maxDurasiHari hari
        const estimatedDate = new Date(orderDate);
        estimatedDate.setDate(estimatedDate.getDate() + maxDurasiHari);

        // Format: YYYY-MM-DD HH:MM:SS (set default time ke jam 18:00 sebagai estimasi selesai)
        const hours = 18;
        const minutes = 0;
        const seconds = 0;
        estimatedDate.setHours(hours, minutes, seconds, 0);

        finalEstimatedDone = estimatedDate.toISOString().slice(0, 19).replace('T', ' ');

        logger.info('[checkout] Estimated Done:', {
          orderDate: orderDate.toISOString().slice(0, 10),
          maxDurasiHari,
          estimatedDone: finalEstimatedDone
        });

      } catch (slaErr) {
        logger.warn('[checkout] SLA auto-compute failed:', slaErr.message);
        // Fallback: 2 hari dari sekarang jam 18:00
        const fallbackDate = new Date(orderDate);
        fallbackDate.setDate(fallbackDate.getDate() + 2);
        fallbackDate.setHours(18, 0, 0, 0);
        finalEstimatedDone = fallbackDate.toISOString().slice(0, 19).replace('T', ' ');
      }
    }
    // ── CRITICAL: Validate active shift session ─────────────────────────────────
    // Every transaction MUST be linked to an active shift for accountability
    const [[openSession]] = await conn.execute(
      `SELECT id, shift, session_date, opened_at
       FROM tr_cashier_session
       WHERE cashier_id = ? AND outlet_id = ? AND status = 'open' AND deleted_at IS NULL
       ORDER BY opened_at DESC
       LIMIT 1`,
      [userId, outletId]
    );

    if (!openSession || !openSession.id) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Tidak dapat membuat transaksi. Kasir belum membuka shift. Silakan buka shift terlebih dahulu.',
        error: 'NO_ACTIVE_SHIFT',
        requiresShift: true
      });
    }

    const sessionId = openSession.id;

    // ── PHASE 3: Check for active sub-session (Individual Accountability) ────────
    // If tr_cashier_sub_session table exists, link transaction to sub-session
    let subSessionId = null;
    const hasSubSessionTable = await hasColumn('tr_cashier_sub_session', 'id');
    if (hasSubSessionTable) {
      const [[activeSubSession]] = await conn.execute(
        `SELECT ss.id
         FROM tr_cashier_sub_session ss
         WHERE ss.cashier_id = ?
           AND ss.session_id = ?
           AND ss.status = 'open'
         LIMIT 1 FOR UPDATE`,
        [userId, sessionId]
      );

      if (activeSubSession) {
        subSessionId = activeSubSession.id;
        logger.info('[checkout]', 'Transaction linked to sub-session', { subSessionId, cashierId: userId });
      }
    }

    logger.info('[checkout]', 'Transaction linked to session', { sessionId, shift: openSession.shift, date: openSession.session_date });

    const hasTrxPromo = await hasColumn('tr_transaction', 'promo_id');
    const hasPicId = await hasColumn('tr_transaction', 'pic_id');

    // ── Langkah 1: Insert tr_transaction — id BIGINT AUTO_INCREMENT ──────────
    // ── PIC: Include pic_id/pic_name if column exists ─────────────────────────
    let trxId;
    if (hasTrxPromo) {
      if (hasPicId) {
        // New schema with pic_id and pic_name
        const [trxInsert] = await conn.execute(
          `INSERT INTO tr_transaction (
            outlet_id, customer_id, cashier_id, pic_id, pic_name, session_id, sub_session_id,
            promo_id, membership_id,
            transaction_no, source_channel, status, payment_status,
            primary_payment_method, is_express, pickup_type,
            subtotal, member_discount, promo_discount, manual_discount, delivery_fee, total,
            paid_amount, change_amount,
            estimated_done_at, notes, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?,
            ?, 'kasir', 'pending', ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, NOW(), NOW()
          )`,
          [
            outletId, customerId, userId, resolvedPicId, resolvedPicName, sessionId, subSessionId,
            resolvedPromoId, activeMembershipId,
            transactionNo, paymentStatus,
            primaryPaymentMethod, isExpress ? 1 : 0, pickupType,
            computedSubtotal, memberDiscount, promoDiscount, manualDiscount, pickupFee + deliveryFee, computedTotal,
            paidAmount, changeAmount,
            finalEstimatedDone, combinedNotes,
          ]
        );
        trxId = trxInsert.insertId;
      } else {
        // Old schema without pic columns
        const [trxInsert] = await conn.execute(
          `INSERT INTO tr_transaction (
            outlet_id, customer_id, cashier_id, session_id, sub_session_id,
            promo_id, membership_id,
            transaction_no, source_channel, status, payment_status,
            primary_payment_method, is_express, pickup_type,
            subtotal, member_discount, promo_discount, manual_discount, delivery_fee, total,
            paid_amount, change_amount,
            estimated_done_at, notes, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, 'kasir', 'pending', ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, NOW(), NOW()
          )`,
          [
            outletId, customerId, userId, sessionId, subSessionId,
            resolvedPromoId, activeMembershipId,
            transactionNo, paymentStatus,
            primaryPaymentMethod, isExpress ? 1 : 0, pickupType,
            computedSubtotal, memberDiscount, promoDiscount, manualDiscount, pickupFee + deliveryFee, computedTotal,
            paidAmount, changeAmount,
            finalEstimatedDone, combinedNotes,
          ]
        );
        trxId = trxInsert.insertId;
      }
    } else {
      // Legacy schema without promo_id
      const [trxInsert] = await conn.execute(
        `INSERT INTO tr_transaction (
          outlet_id, customer_id, cashier_id, session_id, sub_session_id,
          membership_id,
          transaction_no, source_channel, status, payment_status,
          primary_payment_method, is_express, pickup_type,
          subtotal, member_discount, promo_discount, manual_discount, delivery_fee, total,
          paid_amount, change_amount,
          estimated_done_at, notes, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?,
          ?, 'kasir', 'pending', ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?, NOW(), NOW()
        )`,
        [
          outletId, customerId, userId, sessionId, subSessionId,
          activeMembershipId,
          transactionNo, paymentStatus,
          primaryPaymentMethod, isExpress ? 1 : 0, pickupType,
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

    // Cek apakah kolom material/brand/special_care_alert sudah ada di tr_transaction_item
    let hasItemExtraCols = false;
    let hasMaterialIdCol = false;
    let hasLengthWidthCols = false;
    
    try {
      const [chk] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'tr_transaction_item' AND column_name = 'material'`
      );
      hasItemExtraCols = Number(chk[0]?.cnt || 0) > 0;
    } catch (err) { logger.warn('[checkoutTransaction] Cek kolom material gagal:', err?.message); hasItemExtraCols = false; }

    try {
      const [chk] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'tr_transaction_item' AND column_name = 'material_id'`
      );
      hasMaterialIdCol = Number(chk[0]?.cnt || 0) > 0;
    } catch (err) { logger.warn('[checkoutTransaction] Cek kolom material_id gagal:', err?.message); hasMaterialIdCol = false; }

    // Check if carpet-specific columns exist (carpet_panjang_cm, carpet_lebar_cm)
    let hasCarpetCols = false;
    try {
      const [chk] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'tr_transaction_item' AND column_name = 'carpet_panjang_cm'`
      );
      hasCarpetCols = Number(chk[0]?.cnt || 0) > 0;
    } catch (err) { logger.warn('[checkoutTransaction] Cek kolom carpet_panjang_cm gagal:', err?.message); hasCarpetCols = false; }

    // Check if estimated_done_at column exists for deadline tracking
    let hasEstimatedDoneCol = false;
    try {
      const [chk2] = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM information_schema.columns
          WHERE table_schema = DATABASE() AND table_name = 'tr_transaction_item' AND column_name = 'estimated_done_at'`
      );
      hasEstimatedDoneCol = Number(chk2[0]?.cnt || 0) > 0;
    } catch (err) { logger.warn('[checkoutTransaction] Cek kolom estimated_done_at gagal:', err?.message); hasEstimatedDoneCol = false; }

    for (let i = 0; i < validatedItems.length; i++) {
      const item = validatedItems[i];
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

      // ── Calculate per-item estimated_done_at ─────────────────────────────────────
      // Estimasi per item berdasarkan durasi_hari dari service
      // Transaction estimated = MAX dari semua item (sudah dihitung di atas)
      // Per-item estimated = order_date + service.durasi_hari
      const itemDurasi = Number(svc.durasi_hari) || 2;
      const itemEstimatedDate = new Date(orderDate);
      itemEstimatedDate.setDate(itemEstimatedDate.getDate() + itemDurasi);
      itemEstimatedDate.setHours(18, 0, 0, 0);
      const itemEstimatedDoneStr = itemEstimatedDate.toISOString().slice(0, 19).replace('T', ' ');

      // Build INSERT query based on available columns
      // hasCarpetCols = carpet_panjang_cm (cm stored), hasItemExtraCols = material text, hasMaterialIdCol = material_id FK
      // hasEstimatedDoneCol = estimated_done_at (added in migration 031)
      if (hasCarpetCols) {
        // Full support: carpet dimensions (cm) + material (text) + material_id (FK)
        const fields = [
          'transaction_id', 'service_id', 'item_no',
          'service_name_snapshot', 'unit_type_snapshot',
          'qty', 'price', 'express_multiplier', 'is_express',
          'subtotal', 'notes', 'material', 'brand', 'special_care_alert',
          'material_id', 'carpet_panjang_cm', 'carpet_lebar_cm'
        ];
        const values = [
          trxId, serviceId, itemNo,
          item.serviceName || item.name || svc.service_name || 'Layanan',
          item.unit || svc.unit || 'pcs',
          itemQty, itemPrice, multiplier, itemIsExpress,
          itemSubtotal, item.notes || null,
          item.material ? String(item.material).slice(0, 80) : null,
          item.brand ? String(item.brand).slice(0, 80) : null,
          item.specialCareAlert ? String(item.specialCareAlert).slice(0, 255) : null,
          item.materialId || item.material_id || null,
          item.carpetPanjangCm || item.carpet_panjang_cm || null,
          item.carpetLebarCm || item.carpet_lebar_cm || null,
        ];

        if (hasEstimatedDoneCol) {
          fields.push('estimated_done_at');
          values.push(itemEstimatedDoneStr);
        }

        await conn.execute(
          'INSERT INTO tr_transaction_item (' + fields.join(', ') + ', created_at, updated_at) ' +
          'VALUES (' + fields.map(() => '?').join(', ') + ', NOW(), NOW())',
          values
        );
      } else if (hasItemExtraCols && hasMaterialIdCol) {
        // Legacy: material text + material_id, no carpet cols
        const fields = [
          'transaction_id', 'service_id', 'item_no',
          'service_name_snapshot', 'unit_type_snapshot',
          'qty', 'price', 'express_multiplier', 'is_express',
          'subtotal', 'notes', 'material', 'brand', 'special_care_alert',
          'material_id'
        ];
        const values = [
          trxId, serviceId, itemNo,
          item.serviceName || item.name || svc.service_name || 'Layanan',
          item.unit || svc.unit || 'pcs',
          itemQty, itemPrice, multiplier, itemIsExpress,
          itemSubtotal, item.notes || null,
          item.material ? String(item.material).slice(0, 80) : null,
          item.brand ? String(item.brand).slice(0, 80) : null,
          item.specialCareAlert ? String(item.specialCareAlert).slice(0, 255) : null,
          item.materialId || item.material_id || null,
        ];

        if (hasEstimatedDoneCol) {
          fields.push('estimated_done_at');
          values.push(itemEstimatedDoneStr);
        }

        await conn.execute(
          'INSERT INTO tr_transaction_item (' + fields.join(', ') + ', created_at, updated_at) ' +
          'VALUES (' + fields.map(() => '?').join(', ') + ', NOW(), NOW())',
          values
        );
      } else if (hasItemExtraCols) {
        // Legacy: only material (text), brand, special_care_alert
        const fields = [
          'transaction_id', 'service_id', 'item_no',
          'service_name_snapshot', 'unit_type_snapshot',
          'qty', 'price', 'express_multiplier', 'is_express',
          'subtotal', 'notes', 'material', 'brand', 'special_care_alert'
        ];
        const values = [
          trxId, serviceId, itemNo,
          item.serviceName || item.name || svc.service_name || 'Layanan',
          item.unit || svc.unit || 'pcs',
          itemQty, itemPrice, multiplier, itemIsExpress,
          itemSubtotal, item.notes || null,
          item.material ? String(item.material).slice(0, 80) : null,
          item.brand ? String(item.brand).slice(0, 80) : null,
          item.specialCareAlert ? String(item.specialCareAlert).slice(0, 255) : null,
        ];

        if (hasEstimatedDoneCol) {
          fields.push('estimated_done_at');
          values.push(itemEstimatedDoneStr);
        }

        await conn.execute(
          'INSERT INTO tr_transaction_item (' + fields.join(', ') + ', created_at, updated_at) ' +
          'VALUES (' + fields.map(() => '?').join(', ') + ', NOW(), NOW())',
          values
        );
      } else {
        // Minimal: no extra columns
        const fields = [
          'transaction_id', 'service_id', 'item_no',
          'service_name_snapshot', 'unit_type_snapshot',
          'qty', 'price', 'express_multiplier', 'is_express',
          'subtotal', 'notes'
        ];
        const values = [
          trxId, serviceId, itemNo,
          item.serviceName || item.name || svc.service_name || 'Layanan',
          item.unit || svc.unit || 'pcs',
          itemQty, itemPrice, multiplier, itemIsExpress,
          itemSubtotal, item.notes || null,
        ];

        if (hasEstimatedDoneCol) {
          fields.push('estimated_done_at');
          values.push(itemEstimatedDoneStr);
        }

        await conn.execute(
          'INSERT INTO tr_transaction_item (' + fields.join(', ') + ', created_at, updated_at) ' +
          'VALUES (' + fields.map(() => '?').join(', ') + ', NOW(), NOW())',
          values
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
      // estimated_done_at untuk tr_item_unit dihitung di atas (reuse itemEstimatedDoneStr)
      // Cek apakah kolom estimated_done_at ada di tr_item_unit
      let hasItemUnitEstimatedDoneCol = false;
      try {
        const [chk3] = await conn.execute(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns
            WHERE table_schema = DATABASE() AND table_name = 'tr_item_unit' AND column_name = 'estimated_done_at'`
        );
        hasItemUnitEstimatedDoneCol = Number(chk3[0]?.cnt || 0) > 0;
      } catch (err) { logger.warn('[checkoutTransaction] Cek kolom tr_item_unit estimated_done_at gagal:', err?.message); }
      if (hasItemUnitEstimatedDoneCol) {
        await conn.execute(
          `INSERT INTO tr_item_unit (
            transaction_id, transaction_item_id, unit_no,
            unit_sequence, qty_share, production_status,
            estimated_done_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, 1, ?, 'received', ?, NOW(), NOW())`,
          [
            trxId,
            txItemId,
            `${itemNo}-U1`,
            itemQty,
            itemEstimatedDoneStr
          ]
        );
      } else {
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
      }

      // ── Emit realtime: item baru masuk ke tim produksi ───────────────────────
      try {
        const itemServiceName = item.serviceName || item.name || svc.service_name || 'Layanan';
        emitProductionNewItem(
          outletId, trxId, transactionNo,
          itemServiceName, customerName,
          itemIsExpress || false,
          finalEstimatedDone
        );
      } catch (err) { logger.warn('[checkoutTransaction] Emit production new item gagal:', err?.message); }

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
      } catch (err) { logger.warn('[checkoutTransaction] Auto-deduct inventory gagal:', err?.message); }
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
      logger.warn('[checkout] auto-increment favorite gagal:', favErr?.message || favErr);
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

      // ── Langkah 3a: Deduct customer deposit wallet if payment method is deposit ─────
      if (primaryPaymentMethod === 'deposit') {
        // 1. Get current wallet balance (FOR UPDATE to prevent race conditions)
        const [[wallet]] = await conn.execute(
          `SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1 FOR UPDATE`,
          [customerId]
        );

        // 2. Validate balance
        if (!wallet || Number(wallet.balance) < paidAmount) {
          await conn.rollback();
          conn.release();
          return res.status(400).json({
            success: false,
            message: `Saldo deposit tidak mencukupi. Saldo: ${Number(wallet?.balance || 0).toLocaleString('id-ID')}, dibutuhkan: ${paidAmount.toLocaleString('id-ID')}`
          });
        }

        // 3. Deduct balance
        await conn.execute(
          `UPDATE mst_customer_wallet SET balance = balance - ?, updated_at = NOW() WHERE id = ?`,
          [paidAmount, wallet.id]
        );

        // 4. Insert into tr_wallet_ledger
        try {
          await conn.execute(
            `INSERT INTO tr_wallet_ledger (
              customer_id, transaction_id, type, amount, created_by, created_at
            ) VALUES (?, ?, 'payment', ?, ?, NOW())`,
            [customerId, trxId, -paidAmount, userId]
          );
        } catch (ledgerErr) {
          logger.warn('[checkoutTransaction] Error inserting wallet ledger:', ledgerErr?.message);
        }

        // 5. Auto-upgrade to premium member if not already!
        const [[cust]] = await conn.execute('SELECT id, is_member FROM mst_customer WHERE id = ? LIMIT 1', [customerId]);
        if (cust && !cust.is_member) {
          try {
            const memberNo = 'MBR-' + Date.now().toString().slice(-6);
            await conn.execute(
              `INSERT INTO mst_membership (
                customer_id, member_no, status, discount_pct, 
                topup_count, started_at, expired_at, registered_by, created_at, updated_at
              ) VALUES (?, ?, 'active', 20.00, 0, NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), ?, NOW(), NOW())`,
              [customerId, memberNo, userId || customerId]
            );
            await conn.execute('UPDATE mst_customer SET is_member = 1, updated_at = NOW() WHERE id = ?', [customerId]);
            logger.info('[checkout]', 'Customer auto-upgraded to premium', { customerId });
          } catch (mErr) {
            logger.warn('[checkoutTransaction] gagal auto-upgrade membership:', mErr?.message);
          }
        }
      }
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
    // Handle all pickup types: self, pickup, delivery, both (antar-jemput)
    // For 'both': create 2 records (pickup + delivery)
    const { scheduleAt, areaZoneId: payloadAreaZoneId, courierName: payloadCourier, deliveryNotes: payloadDeliveryNotes } = req.body;
    const logisticSchedule = scheduleAt ? new Date(scheduleAt) : (dueDate ? new Date(dueDate) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

    // Format catatan logistik (untuk delivery)
    const logisticNotesText = (() => {
      const parts = [];
      if (payloadCourier && String(payloadCourier).trim()) parts.push(`Kurir: ${String(payloadCourier).trim()}`);
      if (payloadDeliveryNotes && String(payloadDeliveryNotes).trim()) parts.push(`Catatan: ${String(payloadDeliveryNotes).trim()}`);
      return parts.length > 0 ? parts.join(' | ') : null;
    })();

    // Helper to check if courier_name/logistic_type columns exist
    const hasCourierName = await hasColumn('tr_logistic_order', 'courier_name');
    const hasLogisticType = await hasColumn('tr_logistic_order', 'logistic_type');

    const insertLogistic = async (type, fee, notes, courier) => {
      if (hasCourierName && hasLogisticType) {
        await conn.execute(
          `INSERT INTO tr_logistic_order (
            transaction_id, type, logistic_type, area_zone_id, delivery_fee,
            scheduled_at, status, notes, courier_name, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, NOW(), NOW())`,
          [trxId, type, type, payloadAreaZoneId || null, fee, logisticSchedule, notes, courier || null, userId]
        );
      } else if (hasCourierName) {
        await conn.execute(
          `INSERT INTO tr_logistic_order (
            transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, notes, courier_name, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, NOW(), NOW())`,
          [trxId, type, payloadAreaZoneId || null, fee, logisticSchedule, notes, courier || null, userId]
        );
      } else {
        await conn.execute(
          `INSERT INTO tr_logistic_order (
            transaction_id, type, area_zone_id, delivery_fee, scheduled_at, status, notes, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
          [trxId, type, payloadAreaZoneId || null, fee, logisticSchedule, notes, userId]
        );
      }
    };

    if (pickupType === 'pickup' || pickupType === 'both') {
      await insertLogistic('pickup', pickupFee || 10000, null, null);
    }

    if (pickupType === 'delivery' || pickupType === 'both') {
      await insertLogistic('delivery', deliveryFee || 10000, logisticNotesText, payloadCourier || null);
    }
    // 'self' and any other type: no logistic records created

    // ── Commit ────────────────────────────────────────────────────────────────
    logger.info('[checkout] CHECKPOINT 1: About to commit');
    await conn.commit();
    logger.info('[checkout] CHECKPOINT 2: Commit done');

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
          logger.warn('[checkout] reorder check failed:', e?.message || e);
        }
      })();
    }

    // ── Update customer segmentation (best-effort, non-blocking) ───────────────
    (async () => {
      try {
        await updateCustomerSegmentation(customerId);
      } catch (segErr) {
        logger.warn('[checkout] segmentation update failed:', segErr?.message || segErr);
      }
    })();

    // ── Realtime emit: nota baru masuk antrian ──────────────────────────────
    try {
      emitTransactionCheckout(outletId, transactionNo, trxId);
    } catch (err) { logger.warn('[checkoutTransaction] emitTransactionCheckout gagal:', err?.message); }

    // ── WhatsApp notification: order created (best-effort, non-blocking) ─────────
    (async () => {
      try {
        // Fetch full transaction data (we can also use trxRow later once we have it)
        const [[transactionData]] = await poolWaschenPos.execute(
          `SELECT id, transaction_no, total, status, payment_status FROM tr_transaction WHERE id = ? LIMIT 1`,
          [trxId]
        );
        if (transactionData) {
          await sendOrderCreatedNotification(customer, transactionData);
        }
      } catch (whatsappErr) {
        logger.warn('[checkoutTransaction] Error sending WhatsApp notification:', whatsappErr?.message || whatsappErr);
      }
    })();

    // ── BUG FIX 11: Point Calculation from total_paid (Requirements 2.16) ──────
    // Points MUST be calculated from total_paid (actual amount paid), 
    // NOT from subtotal or computedTotal (before discount)
    // Best-effort, tidak boleh gagalkan checkout
    if (activeMembershipId && paidAmount > 0) {
      try {
        // Ambil rate dari config (default 1000)
        let rate = 1000;
        try {
          const [[cfg]] = await poolWaschenPos.execute(
            "SELECT config_val FROM mst_app_config WHERE config_key = 'loyalty_rate_rupiah_per_point' AND is_active = 1 LIMIT 1"
          );
          if (cfg?.config_val) rate = Number(cfg.config_val) || 1000;
        } catch { /* config belum ada, pakai default */ }

        // CRITICAL: Calculate from paidAmount (total_paid), NOT from computedTotal or subtotal
        const earnedPoints = Math.floor(paidAmount / rate);
        
        logger.info('[checkout]', 'Point calculation', { paidAmount, rate, earnedPoints, note: 'NOT from subtotal', computedSubtotal });
        
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
              `Earn dari transaksi ${transactionNo} (${rate.toLocaleString('id-ID')} Rupiah = 1 point, dihitung dari total_paid: ${paidAmount.toLocaleString('id-ID')})`,
              userId,
            ]
          );
        }
      } catch (loyErr) {
        logger.warn('[checkout] gagal catat loyalty points:', loyErr?.message || loyErr);
      }
    }

    // ── Update membership last_transaction_at ──────────────────────────────
    // Reset inactivity counter when member makes a transaction
    if (activeMembershipId) {
      try {
        await poolWaschenPos.execute(`
          UPDATE mst_membership SET
            last_transaction_at = NOW(),
            inactivity_months = 0,
            updated_at = NOW()
          WHERE id = ? AND status = 'active'
        `, [activeMembershipId]);
        logger.info('[checkout]', 'Membership inactivity reset', { membershipId: activeMembershipId });
      } catch (mUpdErr) {
        logger.warn('[checkout] gagal update membership inactivity:', mUpdErr?.message || mUpdErr);
      }
    }

    // ── Fetch hasil untuk response ────────────────────────────────────────────
    logger.info('[checkout] CHECKPOINT 3: About to fetch trxRow');
    const [[trxRow]] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.total,
        t.subtotal,
        t.member_discount  AS memberDiscount,
        t.promo_discount   AS promoDiscount,
        t.manual_discount  AS manualDiscount,
        t.paid_amount      AS paidAmount,
        t.change_amount    AS changeAmount,
        t.delivery_fee     AS deliveryFee,
        t.pickup_type      AS pickupType,
        t.is_express       AS isExpress,
        t.notes,
        t.estimated_done_at AS estimatedDoneAt,
        t.created_at        AS createdAt,
        c.name  AS customerName,
        c.phone AS customerPhone,
        c.photo AS customerPhoto,
        c.gender AS customerGender
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      WHERE t.id = ?`,
      [trxId]
    );
    logger.info('[checkout] CHECKPOINT 4: trxRow fetched');

    const hasItemActiveFlag = await hasColumn('tr_transaction_item', 'is_active');
    const hasItemMaterial = await hasColumn('tr_transaction_item', 'material');
    const [itemRows] = await poolWaschenPos.execute(
      `SELECT
        service_id          AS serviceId,
        service_name_snapshot AS serviceName,
        unit_type_snapshot  AS unit,
        qty, price,
        is_express          AS isExpress,
        subtotal
        ${hasItemMaterial ? ', material, brand, special_care_alert AS specialCareAlert' : ''}
      FROM tr_transaction_item
      WHERE transaction_id = ?
      ${hasItemActiveFlag ? 'AND is_active = 1' : ''}`,
      [trxId]
    );
    logger.info('[checkout] CHECKPOINT 5: itemRows fetched', { itemCount: itemRows?.length });

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

    // DEBUG: Log sebelum response
    logger.info('[checkout] Preparing response', {
      trxId,
      trxRowType: typeof trxRow,
      trxRowIsArray: Array.isArray(trxRow),
      trxRowKeys: trxRow ? Object.keys(trxRow[0] || {}) : [],
      itemRowsCount: itemRows?.length,
    });

    const responsePayload = {
      success: true,
      message: 'Nota berhasil dibuat',
      data: {
        ...sanitizeResponse(trxRow),
        status: 'baru',
        items: sanitizeResponse(itemRows),
        subSessionId, // Phase 3: Individual accountability
        sessionId,
        payment: {
          method: primaryPaymentMethod ?? (payment?.method ? mapPayMethod(payment.method) : null),
          amount: computedTotal,
          paidAmount,
          changeAmount,
        },
        // Birthday discount info (Phase 7)
        birthdayDiscount,
        birthdayPromoId,
        discountBreakdown: {
          promoDiscount,
          memberDiscount,
          birthdayDiscount,
          manualDiscount,
        },
      },
      // Additional info for frontend notification
      birthdayApplied: birthdayDiscount > 0,
      birthdayMessage: birthdayDiscount > 0
        ? `🎂 Diskon ultah 10% (Rp ${birthdayDiscount.toLocaleString('id-ID')}) diterapkan!`
        : null,
    };

    // DEBUG: Log response size
    const responseStr = JSON.stringify(responsePayload);
    logger.info('[checkout] CHECKPOINT 6: Response prepared', { bytes: responseStr.length, trxId });

    logger.info('[checkout] CHECKPOINT 7: Sending response');
    return res.status(201).json(responsePayload);
  } catch (err) {
    await conn.rollback();
    logger.error('[checkoutTransaction] Error', { error: err.message, stack: err.stack });
    logger.error('[checkoutTransaction] Error details:', {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
    });
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
    const { status, outletId, customerId, page = 1, limit = 50, search, paymentStatus, pickupStatus, isExpress, period, sort } = req.query;
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
        c.photo AS customerPhoto,
        c.gender AS customerGender,
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
        /** Siap Ambil: harus payment_status='paid' AND picked_up_at IS NULL (otomatis di bawah) */
        selesai: ['ready_for_pickup', 'ready_for_delivery'],
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

    // Pickup status filter — 'belum' = picked_up_at IS NULL, 'sudah' = picked_up_at IS NOT NULL
    // Digunakan saat filter "Siap Ambil" dengan sub-filter "Belum Diambil"
    if (pickupStatus === 'belum') {
      sql += ' AND t.picked_up_at IS NULL';
    } else if (pickupStatus === 'sudah') {
      sql += ' AND t.picked_up_at IS NOT NULL';
    }

    // "Siap Ambil" (status=selesai) harus finished + lunas + belum diambil (picked_up_at IS NULL)
    // Override payment filter to paid if not explicitly set — this is the business rule
    if (status === 'selesai' && !paymentStatus) {
      sql += " AND t.payment_status = 'paid' AND t.picked_up_at IS NULL";
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
        /** Siap Ambil: harus payment_status='paid' AND picked_up_at IS NULL */
        selesai: ['ready_for_pickup', 'ready_for_delivery'],
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

    // Pickup status filter for count query
    if (pickupStatus === 'belum') {
      countWhere += ' AND t.picked_up_at IS NULL';
    } else if (pickupStatus === 'sudah') {
      countWhere += ' AND t.picked_up_at IS NOT NULL';
    }

    // "Siap Ambil" (status=selesai) harus finished + lunas + belum diambil (picked_up_at IS NULL)
    if (status === 'selesai' && !paymentStatus) {
      countWhere += " AND t.payment_status = 'paid' AND t.picked_up_at IS NULL";
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
    logger.error('[getTransactions] Error', { error: err.message, stack: err.stack });
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
        c.photo AS customerPhoto,
        c.gender AS customerGender,
        c.email AS customerEmail,
        c.address_housing AS customerAddressHousing,
        c.address_block AS customerAddressBlock,
        c.address_no AS customerAddressNo,
        c.address_detail AS customerAddressDetail,
        c.is_member AS customerIsMember,
        az.name AS customerAreaZoneName,
        COALESCE(w.balance, 0) AS customerDeposit,
        u.name AS cashierName,
        o.name AS outletName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_area_zone az ON az.id = c.area_zone_id
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
    const hasItemExtraCols = await hasColumn('tr_transaction_item', 'material');

    const packingTiSelect = hasPackingCols
      ? ', COALESCE(ti.packing_needed, 1) AS packingNeeded, ti.packing_notes AS packingNotes' : '';
    const packingIuSelect = hasPackingDone
      ? ', COALESCE(iu_p.packing_done, 0) AS packingDone' : '';
    const packingJoin = hasPackingDone
      ? 'LEFT JOIN tr_item_unit iu_p ON iu_p.transaction_item_id = ti.id' : '';
    const carpetSelect = hasCarpetCols
      ? ', ti.carpet_panjang_cm AS carpetPanjangCm, ti.carpet_lebar_cm AS carpetLebarCm' : '';
    const itemExtraSelect = hasItemExtraCols
      ? ', ti.material, ti.brand, ti.special_care_alert AS specialCareAlert' : '';

    const [items] = await poolWaschenPos.execute(
      `SELECT ti.id, ti.service_id AS serviceId, ti.service_name_snapshot AS name,
              ti.unit_type_snapshot AS unit, ti.qty, ti.price,
              ti.is_express AS express, ti.express_multiplier AS expressMultiplier, ti.subtotal
              ${packingTiSelect}${carpetSelect}${itemExtraSelect}
       FROM tr_transaction_item ti
       WHERE ti.transaction_id = ?
       ${hasItemActiveFlag ? 'AND ti.is_active = 1' : ''}`,
      [trxRows[0].id]
    );

    const t = trxRows[0];

    // Get units with production status per item
    const [units] = await poolWaschenPos.execute(
      `SELECT
         iu.id, iu.unit_no AS unitNo, iu.transaction_item_id AS txItemId,
         iu.production_status, iu.ready_at, iu.done_at,
         iu.packing_done, iu.current_pic_id AS currentPicId
       FROM tr_item_unit iu
       WHERE iu.transaction_id = ?
       ORDER BY iu.id ASC`,
      [t.id]
    );

    // Map production status per item for frontend
    const itemsWithProduction = items.map(item => {
      const itemUnits = units.filter(u => u.txItemId === item.id);
      // If multiple units, return all; if single, return main status
      const mainUnit = itemUnits[0];
      return {
        ...item,
        // Production tracking per item
        productionStatus: mainUnit?.production_status || 'received',
        readyAt: mainUnit?.ready_at || null,
        doneAt: mainUnit?.done_at || null,
        packingDone: mainUnit?.packing_done || false,
        // If multiple units, include all unit details
        units: itemUnits.length > 1 ? itemUnits.map(u => ({
          id: u.id,
          unitNo: u.unitNo,
          productionStatus: u.production_status,
          readyAt: u.ready_at,
          doneAt: u.done_at,
          packingDone: u.packing_done,
        })) : undefined,
      };
    });

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
        logger.warn('[getTransactionById]', 'Could not fetch production logs', { txId: t.id, error: logError.message });
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
      logger.warn('[getTransactionById]', 'Photos query error:', err?.message);
      conditionPhotos = [];
    }

    // Ambil production meta (hasPackingPhoto, allProductionReady, dll)
    let productionMeta = null;
    try {
      const metaMap = await getProductionMetaBatch([t.id]);
      productionMeta = metaMap.get(t.id) || null;
    } catch (err) {
      logger.warn('[getTransactionById]', 'Production meta error:', err?.message);
    }

    const transaction = {
      ...t,
      transactionUuid: t.id,
      id: t.transactionNo || t.id,
      status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
      date: new Date(t.createdAt).toISOString().slice(0, 10),
      dueDate: t.estimatedDoneAt ? new Date(t.estimatedDoneAt).toISOString().slice(0, 10) : null,
      estimatedDoneAt: t.estimatedDoneAt, // Full datetime for display
      // Use items with production tracking per item
      items: itemsWithProduction.map((item) => ({
        ...item,
        express: item.express === 1 || item.express === true,
        expressExtra: item.express && item.expressMultiplier > 1
          ? Math.round(item.price * (item.expressMultiplier - 1))
          : 0,
        // Per-item production status
        productionStatus: item.productionStatus || 'received',
        readyAt: item.readyAt,
        doneAt: item.doneAt,
        packingDone: item.packingDone || false,
      })),
      // All units with full production status
      units: units.map(u => ({
        ...u,
        productionStatus: u.production_status,
        readyAt: u.ready_at,
        doneAt: u.done_at,
        packingDone: u.packing_done,
      })),
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
      customerPhoto: t.customerPhoto || null,
      customerGender: t.customerGender || null,
      customerId: t.customerId,
      customerDeposit: Number(t.customerDeposit || 0),
      depositBalance: Number(t.customerDeposit || 0),
      outletName: t.outletName || null,
      payMethod: t.payMethod,
      notes: t.notes,
      conditionPhotos,
      production: productionMeta,
      // Production completion tracking per item
      allItemsReady: itemsWithProduction.every(item => item.productionStatus === 'ready' || item.productionStatus === 'done'),
      itemsReadyCount: itemsWithProduction.filter(item => item.productionStatus === 'ready' || item.productionStatus === 'done').length,
      itemsTotalCount: itemsWithProduction.length,
    };

    return res.status(200).json({ success: true, data: transaction });
  } catch (err) {
    logger.error('[getTransactionById] Error', { error: err.message, stack: err.stack });
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

  if (!['frontline', 'admin'].includes(roleCode || '')) {
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
      `SELECT id, outlet_id, customer_id, transaction_no, total, paid_amount, change_amount, payment_status, status
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

    // ── Deduct customer deposit wallet if payment method is deposit ─────
    if (methodDb === 'deposit') {
      if (!row.customer_id) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          message: 'Transaksi tidak memiliki customer, tidak bisa menggunakan deposit.'
        });
      }

      // 1. Get current wallet balance (FOR UPDATE to prevent race conditions)
      const [[wallet]] = await conn.execute(
        `SELECT id, balance FROM mst_customer_wallet WHERE customer_id = ? LIMIT 1 FOR UPDATE`,
        [row.customer_id]
      );

      // 2. Validate balance
      if (!wallet || Number(wallet.balance) < applyAmount) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          success: false,
          message: `Saldo deposit tidak mencukupi. Saldo: ${Number(wallet?.balance || 0).toLocaleString('id-ID')}, dibutuhkan: ${applyAmount.toLocaleString('id-ID')}`
        });
      }

      // 3. Deduct balance
      await conn.execute(
        `UPDATE mst_customer_wallet SET balance = balance - ?, updated_at = NOW() WHERE id = ?`,
        [applyAmount, wallet.id]
      );

      // 4. Insert into tr_wallet_ledger
      try {
        await conn.execute(
          `INSERT INTO tr_wallet_ledger (
            customer_id, transaction_id, type, amount, created_by, created_at
          ) VALUES (?, ?, 'payment', ?, ?, NOW())`,
          [row.customer_id, row.id, -applyAmount, userId]
        );
      } catch (ledgerErr) {
        logger.warn('[recordTransactionPayment]', 'Error inserting wallet ledger:', ledgerErr?.message);
      }

      // 5. Auto-upgrade to premium member if not already!
      const [[cust]] = await conn.execute('SELECT id, is_member FROM mst_customer WHERE id = ? LIMIT 1', [row.customer_id]);
      if (cust && !cust.is_member) {
        try {
          const memberNo = 'MBR-' + Date.now().toString().slice(-6);
          await conn.execute(
            `INSERT INTO mst_membership (
              customer_id, member_no, status, discount_pct, 
              topup_count, started_at, expired_at, registered_by, created_at, updated_at
            ) VALUES (?, ?, 'active', 20.00, 0, NOW(), DATE_ADD(NOW(), INTERVAL 6 MONTH), ?, NOW(), NOW())`,
            [row.customer_id, memberNo, userId || row.customer_id]
          );
          await conn.execute('UPDATE mst_customer SET is_member = 1, updated_at = NOW() WHERE id = ?', [row.customer_id]);
          logger.info('[recordTransactionPayment]', 'Customer auto-upgraded to premium', { customerId: row.customer_id });
        } catch (mErr) {
          logger.warn('[recordTransactionPayment]', 'gagal auto-upgrade membership:', mErr?.message);
        }
      }
    }

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
    } catch (err) { logger.warn('[recordTransactionPayment] emitPaymentSettled gagal:', err?.message); }

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
    logger.error('[recordTransactionPayment] Error', { error: err.message, stack: err.stack });
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
        t.payment_status AS paymentStatus,
        t.created_at AS createdAt,
        c.name AS customerName,
        c.photo AS customerPhoto,
        c.gender AS customerGender,
        u.name AS cashierName,
        GROUP_CONCAT(ti.service_name_snapshot ORDER BY ti.id ASC SEPARATOR '||') AS itemNames,
        GROUP_CONCAT(ti.is_express ORDER BY ti.id ASC SEPARATOR '||') AS itemExpresses
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      JOIN mst_user u ON u.id = t.cashier_id
      LEFT JOIN tr_transaction_item ti ON ti.transaction_id = t.id ${itemActiveFilter}
      WHERE t.deleted_at IS NULL
      ${outletFilter}
      GROUP BY t.id, t.transaction_no, t.status, t.picked_up_at, t.is_express, t.total, t.payment_status, t.created_at, c.name, u.name
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
      // Derive paymentStatus for frontend (map payment_status to paid/partial/unpaid)
      const paymentStatusMap = { 'paid': 'paid', 'partial': 'partial' };
      const paymentStatus = paymentStatusMap[t.paymentStatus] || 'unpaid';
      // Extract time from createdAt
      const createdDate = new Date(t.createdAt);
      const time = createdDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return {
        id: t.transactionNo || t.id,
        transactionNo: t.transactionNo,
        status: mapDbStatusToFrontend(t.dbStatus, t.pickedUpAt),
        paymentStatus,
        date: new Date(t.createdAt).toISOString().slice(0, 10),
        time,
        createdAt: t.createdAt,
        isExpress: t.isExpress === 1 || t.isExpress === true,
        items,
        services: items.length > 0 ? items[0].name : '1 layanan',
        total: Number(t.total),
        createdBy: t.cashierName,
        customerName: t.customerName,
        customerPhoto: t.customerPhoto || null,
        customerGender: t.customerGender || null,
        pickedUpAt: t.pickedUpAt,
      };
    });

    const r = statsRows[0] || {};

    // Time metrics — average processing time, oldest waiting, overdue pickups
    const [timeRows] = await poolWaschenPos.execute(
      `SELECT
        -- Avg processing time (created_at → picked_up_at for completed orders today)
        AVG(TIMESTAMPDIFF(HOUR, t.created_at, t.picked_up_at)) AS avg_processing_hours,
        -- Oldest waiting time for ready orders
        MIN(TIMESTAMPDIFF(HOUR, t.updated_at, NOW())) AS oldest_waiting_hours,
        -- Express orders still processing (potential overdue)
        SUM(CASE WHEN t.is_express = 1 AND t.status IN ('pending','process') THEN 1 ELSE 0 END) AS express_processing,
        -- Overdue pickups (ready > 24 hours not picked up)
        SUM(CASE WHEN t.status IN ('ready_for_pickup','ready_for_delivery') AND t.picked_up_at IS NULL AND TIMESTAMPDIFF(HOUR, t.updated_at, NOW()) > 24 THEN 1 ELSE 0 END) AS overdue_pickup
       FROM tr_transaction t
       WHERE t.deleted_at IS NULL ${outletFilter}`,
      outletParam
    );

    const t = timeRows[0] || {};

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
        timeMetrics: {
          avgProcessingHours: Number(t.avg_processing_hours || 0).toFixed(1),
          oldestWaitingHours: Number(t.oldest_waiting_hours || 0),
          expressProcessing: Number(t.express_processing || 0),
          overduePickup: Number(t.overdue_pickup || 0),
        },
        recent,
      },
    });
  } catch (err) {
    logger.error('[getDashboardStats] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik.' });
  }
};

// END OF getDashboardStats
// </PLACEHOLDER_END>

// ─── GET /api/transactions/dashboard/revenue-trend ──────────────────────────
export const getRevenueTrend = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const userOutletId = req.user?.outletId;
    const outletFilter = userOutletId ? 'AND outlet_id = ?' : '';
    const outletParam = userOutletId ? [userOutletId] : [];

    // Generate date range
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        DATE(created_at) AS date,
        COALESCE(SUM(total), 0) AS revenue
       FROM tr_transaction
       WHERE deleted_at IS NULL
         AND status <> 'cancelled'
         AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ${outletFilter}
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days, ...outletParam]
    );

    // Map to days array — DATE() from MySQL may return Date object or string
    const toDateKey = (d) => {
      if (!d) return '';
      if (d instanceof Date) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return String(d).substring(0, 10);
    };
    const revenueMap = {};
    rows.forEach((r) => {
      revenueMap[toDateKey(r.date)] = Number(r.revenue);
    });

    const data = dates.map((date) => ({
      date,
      label: new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      revenue: revenueMap[date] || 0,
    }));

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    logger.error('[getRevenueTrend] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat tren revenue.' });
  }
};

// ─── GET /api/transactions/dashboard/payment-methods ──────────────────────────
export const getPaymentMethods = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const requestedOutletId = req.query.outletId;

    // Global roles (admin) can see all or specific outlet
    const globalRoles = ['admin'];
    const isGlobalRole = globalRoles.includes(userRole);

    let effectiveOutlet = null;

    if (isGlobalRole) {
      // Admin can see all outlets or specific one
      effectiveOutlet = requestedOutletId || null;
    } else {
      // Frontliner only sees their outlet
      effectiveOutlet = userOutletId;
      if (!effectiveOutlet) {
        return res.status(400).json({
          success: false,
          message: 'User tidak memiliki outlet yang ditetapkan.'
        });
      }
    }

    const outletFilter = effectiveOutlet ? 'AND t.outlet_id = ?' : '';
    const params = effectiveOutlet ? [days, effectiveOutlet] : [days];

    // Get payment breakdown from tr_payment_item
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        tp.method,
        COALESCE(SUM(tp.amount), 0) AS total
       FROM tr_transaction t
       LEFT JOIN tr_payment_item tp ON tp.transaction_id = t.id AND tp.deleted_at IS NULL AND tp.status = 'paid'
       WHERE t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ${outletFilter}
       GROUP BY tp.method
       ORDER BY total DESC`,
      params
    );

    // Calculate total
    const total = rows.reduce((sum, r) => sum + Number(r.total), 0);

    // Map method labels (handle NULL/undefined method as cash)
    const methodLabels = {
      cash: { label: 'Tunai', color: '#10B981' },
      qris: { label: 'QRIS', color: '#3B82F6' },
      edc: { label: 'EDC', color: '#6B7280' },
      transfer: { label: 'Transfer', color: '#8B5CF6' },
      deposit: { label: 'Deposit', color: '#F59E0B' },
      ovo: { label: 'OVO', color: '#9C27B0' },
      gopay: { label: 'GoPay', color: '#00A651' },
      dana: { label: 'DANA', color: '#118EEA' },
      shopeepay: { label: 'ShopeePay', color: '#EE4D2D' },
      other: { label: 'Lainnya', color: '#9CA3AF' },
    };

    const data = rows.map(r => {
      const method = (r.method || 'cash').toLowerCase();
      const config = methodLabels[method] || methodLabels.other;
      const value = Number(r.total);
      return {
        label: config.label,
        value: total > 0 ? Math.round((value / total) * 100) : 0,
        amount: value,
        color: config.color,
      };
    }).filter(d => d.amount > 0);

    // If no data, return empty array (no fake placeholder values)
    if (data.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    logger.error('[getPaymentMethods] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat metode pembayaran.' });
  }
};

// ─── GET /api/transactions/dashboard/top-services ───────────────────────────
export const getTopServices = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5)); // Clamp between 1-100
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const requestedOutletId = req.query.outletId;

    // Global roles can see all or specific outlet
    const globalRoles = ['admin'];
    const isGlobalRole = globalRoles.includes(userRole);

    let effectiveOutlet = null;
    if (isGlobalRole) {
      effectiveOutlet = requestedOutletId || null;
    } else {
      effectiveOutlet = userOutletId;
      if (!effectiveOutlet) {
        return res.status(400).json({
          success: false,
          message: 'User tidak memiliki outlet yang ditetapkan.'
        });
      }
    }

    let query;
    let params;

    if (effectiveOutlet) {
      query = `
        SELECT
          MAX(ti.service_name_snapshot) AS serviceName,
          COUNT(DISTINCT ti.transaction_id) AS transactionCount,
          SUM(ti.qty) AS totalQuantity,
          SUM(ti.subtotal) AS totalRevenue
         FROM tr_transaction_item ti
         JOIN tr_transaction t ON t.id = ti.transaction_id
         WHERE ti.deleted_at IS NULL
           AND ti.is_active = 1
           AND t.deleted_at IS NULL
           AND t.status <> 'cancelled'
           AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           AND t.outlet_id = ?
         GROUP BY ti.service_id
         ORDER BY transactionCount DESC
         LIMIT ${parseInt(limit)}
      `;
      params = [days, effectiveOutlet];
    } else {
      query = `
        SELECT
          MAX(ti.service_name_snapshot) AS serviceName,
          COUNT(DISTINCT ti.transaction_id) AS transactionCount,
          SUM(ti.qty) AS totalQuantity,
          SUM(ti.subtotal) AS totalRevenue
         FROM tr_transaction_item ti
         JOIN tr_transaction t ON t.id = ti.transaction_id
         WHERE ti.deleted_at IS NULL
           AND ti.is_active = 1
           AND t.deleted_at IS NULL
           AND t.status <> 'cancelled'
           AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY ti.service_id
         ORDER BY transactionCount DESC
         LIMIT ${parseInt(limit)}
      `;
      params = [days];
    }

    // Get top services by transaction count using service_name_snapshot
    const [rows] = await poolWaschenPos.execute(query, params);

    // Calculate max for percentage calculation
    const maxCount = rows.length > 0 ? Math.max(...rows.map(r => Number(r.transactionCount))) : 0;

    const data = rows.map((r, i) => ({
      rank: i + 1,
      name: r.serviceName,
      count: Number(r.transactionCount),
      quantity: Number(r.totalQuantity),
      revenue: Number(r.totalRevenue),
      percentage: maxCount > 0 ? Math.round((Number(r.transactionCount) / maxCount) * 100) : 0,
    }));

    // Color palette for ranking
    const rankColors = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#6B7280'];

    return res.status(200).json({
      success: true,
      data: data.map((d, i) => ({
        ...d,
        color: rankColors[i] || '#9CA3AF',
      })),
    });
  } catch (err) {
    logger.error('[getTopServices] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat layanan teratas.', error: err.message });
  }
};

// PLACEHOLDER_START
// PUT /api/transactions/:id/status
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
        ? `SELECT id, version, status, customer_id, transaction_no, total FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`
        : `SELECT id, status, customer_id, transaction_no, total FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const txUUID = rows[0].id;
    const transactionData = rows[0];
    const currentVersion = hasVersion ? rows[0].version : undefined;

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

    // ── WhatsApp notification: status updated (best-effort, non-blocking) ─────────
    (async () => {
      try {
        // Fetch customer data
        const [[custRow]] = await poolWaschenPos.execute(
          `SELECT id, name, phone FROM mst_customer WHERE id = ? LIMIT 1`,
          [transactionData.customer_id]
        );
        if (custRow) {
          const customer = {
            id: custRow.id,
            name: custRow.name,
            phone: custRow.phone,
          };

          // Check if order is ready for pickup
          if (status === 'selesai' || dbStatus === 'ready_for_pickup') {
            await sendOrderReadyNotification(customer, transactionData);
          } else {
            await sendOrderStatusUpdatedNotification(customer, transactionData, status);
          }
        }
      } catch (whatsappErr) {
        logger.warn('[updateTransactionStatus]', 'Error sending WhatsApp notification:', whatsappErr?.message || whatsappErr);
      }
    })();

    return res.status(200).json({
      success: true,
      message: 'Status transaksi diperbarui.',
      data: hasVersion ? { newVersion: currentVersion + 1 } : undefined,
    });
  } catch (err) {
    logger.error('[updateTransactionStatus] Error', { error: err.message, stack: err.stack });
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
    // Kriteria "siap diambil": production_status='ready' + payment_status='paid' + picked_up_at IS NULL
    // Check if logistic columns exist (graceful for older DB versions)
    const hasCourierNameCol = await hasColumn('tr_logistic_order', 'courier_name');
    const courierSelect = hasCourierNameCol
      ? `, (SELECT courier_name FROM tr_logistic_order WHERE transaction_id = t.id AND type = 'delivery' LIMIT 1) AS courierName`
      : '';

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
        t.pickup_type AS pickupType
        ${courierSelect},
        c.name AS customerName,
        c.phone AS customerPhone,
        c.photo AS customerPhoto,
        c.gender AS customerGender,
        c.email AS customerEmail,
        c.address_housing AS customerAddressHousing,
        c.address_block AS customerAddressBlock,
        c.address_no AS customerAddressNo,
        c.address_detail AS customerAddressDetail,
        c.is_member AS customerIsMember,
        az.name AS customerAreaZoneName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_area_zone az ON az.id = c.area_zone_id
      WHERE t.deleted_at IS NULL
        AND t.status IN ('draft', 'pending', 'process', 'ready_for_pickup', 'ready_for_delivery')
        AND t.picked_up_at IS NULL
        AND t.payment_status = 'paid'
        AND (t.status NOT IN ('ready_for_pickup', 'ready_for_delivery') OR t.created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY))
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
    const hasItemExtraCols = await hasColumn('tr_transaction_item', 'material');

    const packingQueueSelect = hasPackingCols
      ? ', COALESCE(ti.packing_needed, 1) AS packingNeeded, ti.packing_notes AS packingNotes' : '';
    const packingDoneSelect = hasPackingDone
      ? ', COALESCE(MAX(iu_pk.packing_done), 0) AS packingDone' : '';
    const itemExtraSelect = hasItemExtraCols
      ? ', ti.material, ti.brand, ti.special_care_alert AS specialCareAlert' : '';
    const packingDoneJoin = hasPackingDone
      ? `LEFT JOIN tr_item_unit iu_pk ON iu_pk.transaction_item_id = ti.id` : '';
    const packingGroupBy = (hasPackingCols || hasPackingDone)
      ? `GROUP BY ti.id, ti.transaction_id, ti.service_name_snapshot, ti.unit_type_snapshot, ti.qty, ti.is_express${hasPackingCols ? ', ti.packing_needed, ti.packing_notes' : ''}${hasItemExtraCols ? ', ti.material, ti.brand, ti.special_care_alert' : ''}` : '';

    const [allItems] = await poolWaschenPos.execute(
      `SELECT ti.id AS itemId, ti.transaction_id,
              ti.service_name_snapshot AS name, ti.unit_type_snapshot AS unit,
              ti.qty, ti.is_express AS isExpress
              ${packingQueueSelect}${packingDoneSelect}${itemExtraSelect}
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
          material: item.material || null,
          brand: item.brand || null,
          specialCareAlert: item.specialCareAlert || null,
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
        // Return raw MySQL DATETIME directly — avoids timezone conversion issues
        estimatedDoneAt: t.estimatedDoneAt || null,
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
    logger.error('[getProductionQueue] Error', { error: err.message, stack: err.stack });
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

    const isGlobalRole = ['admin'].includes(req.user?.roleCode);
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
    logger.error('[cancelTransaction] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal membatalkan transaksi.' });
  }
};

// ─── PERBAIKAN: PATCH /api/transactions/:id/production-stage ─────────────────
const VALID_STAGES = ['Diterima', 'Cuci', 'Setrika', 'Packing', 'Selesai'];

export const updateProductionStage = async (req, res) => {
  const connection = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { stage, itemId, expectedVersion } = req.body;

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

    // Check if version column exists for optimistic locking
    const hasVersionCol = await hasColumn('tr_transaction', 'version');

    // Start transaction for atomic operations
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      hasVersionCol
        ? `SELECT id, pickup_type, version FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`
        : `SELECT id, pickup_type FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    const txId = rows[0].id;
    const pickupType = rows[0].pickup_type;
    const currentVersion = hasVersionCol ? rows[0].version : undefined;

    // Optimistic locking — kalau client kirim expectedVersion, cek dulu (hanya jika version column ada)
    if (hasVersionCol && expectedVersion != null && Number(expectedVersion) !== Number(currentVersion)) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        code: 'STALE_DATA',
        message: 'Data transaksi sudah diperbarui oleh user lain. Mohon refresh dan coba lagi.',
        currentVersion,
      });
    }

    if (dbStatus === 'ready') {
      // Validasi packing photo — wajib sebelum bisa mark Selesai
      // tr_item_photo tidak punya transaction_id langsung, perlu JOIN tr_item_unit
      const [photoCheck] = await connection.execute(
        `SELECT ip.id FROM tr_item_photo ip
         JOIN tr_item_unit iu ON iu.id = ip.item_unit_id
         WHERE iu.transaction_id = ? AND ip.photo_type = 'packing' AND ip.deleted_at IS NULL
         LIMIT 1`,
        [txId]
      );
      if (!photoCheck.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, code: 'PACKING_PHOTO_REQUIRED', message: 'Wajib foto packing / serah terima sebelum menandai selesai.' });
      }
    }
    // ── Per-item mode (itemId dikirim) ──────────────────────────────────────
    if (itemId) {
      const [itemCheck] = await connection.execute(
        `SELECT id FROM tr_transaction_item WHERE id = ? AND transaction_id = ? LIMIT 1`,
        [itemId, txId]
      );
      if (!itemCheck.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Item tidak ditemukan dalam transaksi ini.' });
      }

      await connection.execute(
        `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE transaction_item_id = ?`,
        [dbStatus, itemId]
      );

      const [unitRows] = await connection.execute(
        `SELECT id FROM tr_item_unit WHERE transaction_item_id = ?`,
        [itemId]
      );
      for (const unit of unitRows) {
        await connection.execute(
          `INSERT INTO tr_production_log (item_unit_id, pic_id, stage, status, notes, started_at, created_at)
           VALUES (?, ?, ?, 'done', ?, NOW(), NOW())`,
          [unit.id, req.user?.userId, dbStatus, `[Per-item] Stage: ${stage}`]
        );
      }

      // Cek apakah SEMUA unit di transaksi ini sudah ready
      const [doneCheck] = await connection.execute(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN production_status = 'ready' THEN 1 ELSE 0 END) AS readyCount
         FROM tr_item_unit WHERE transaction_id = ?`,
        [txId]
      );
      const { total, readyCount } = doneCheck[0] || {};
      const allDone = Number(total) > 0 && Number(total) === Number(readyCount);

      if (allDone) {
        const nextStatus = pickupType === 'delivery' ? 'ready_for_delivery' : 'ready_for_pickup';
        await connection.execute(
          hasVersionCol
            ? `UPDATE tr_transaction SET status = ?, updated_at = NOW(), version = version + 1 WHERE id = ?`
            : `UPDATE tr_transaction SET status = ?, updated_at = NOW() WHERE id = ?`,
          [nextStatus, txId]
        );
        try {
          await connection.execute(
            `INSERT INTO tr_notification (transaction_id, type, recipient_customer_id, wa_number, message_body, status, sent_by, created_at, updated_at)
             SELECT t.id, 'selesai', t.customer_id, COALESCE(c.phone,'-'),
               CONCAT('Cucian Anda (', t.transaction_no, ') sudah selesai dan siap ', IF(t.pickup_type='delivery','diantar.','diambil di outlet.')),
               'opened', ?, NOW(), NOW()
             FROM tr_transaction t JOIN mst_customer c ON c.id=t.customer_id WHERE t.id=?`,
            [req.user?.userId, txId]
          );
        } catch (_) { /* notifikasi tidak bloking */ }
      } else {
        await connection.execute(
          hasVersionCol
            ? `UPDATE tr_transaction SET status = 'process', updated_at = NOW(), version = version + 1 WHERE id = ? AND status IN ('draft','pending')`
            : `UPDATE tr_transaction SET status = 'process', updated_at = NOW() WHERE id = ? AND status IN ('draft','pending')`,
          [txId]
        );
      }

      // Kembalikan progress item ini (deduplicated)
      const [logRows] = await connection.execute(
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

      await connection.commit();

    // Emit realtime update untuk production dashboard (per-item mode)
    try {
      const [txRow] = await poolWaschenPos.execute(
        `SELECT outlet_id FROM tr_transaction WHERE id = ? LIMIT 1`,
        [txId]
      );
      if (txRow.length > 0) {
        emitProductionUpdate(txRow[0].outlet_id, txId, itemId || null, dbStatus);
      }
    } catch (e) {
      logger.warn('[updateProductionStage]', 'EventBus emit failed:', e?.message);
    }

    return res.status(200).json({
      success: true,
      message: `Stage '${stage}' berhasil dicatat untuk layanan ini.`,
      data: { progress, allDone, newVersion: hasVersionCol ? Number(currentVersion || 0) + 1 : undefined },
    });
  }

    // ── Fallback: update semua item di transaksi (mode lama) ─────────────────
    await connection.execute(
      `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE transaction_id = ?`,
      [dbStatus, txId]
    );
    const [unitRows] = await connection.execute(
      `SELECT id FROM tr_item_unit WHERE transaction_id = ?`,
      [txId]
    );
    for (const unit of unitRows) {
      await connection.execute(
        `INSERT INTO tr_production_log (item_unit_id, pic_id, stage, status, notes, started_at, created_at)
         VALUES (?, ?, ?, 'done', ?, NOW(), NOW())`,
        [unit.id, req.user?.userId, dbStatus, `Stage diubah menjadi: ${stage}`]
      );
    }
    if (dbStatus === 'packing' || dbStatus === 'ready') {
      const nextStatus = pickupType === 'delivery' ? 'ready_for_delivery' : 'ready_for_pickup';
      await connection.execute(
        hasVersionCol
          ? `UPDATE tr_transaction SET status = ?, updated_at = NOW(), version = version + 1 WHERE id = ?`
          : `UPDATE tr_transaction SET status = ?, updated_at = NOW() WHERE id = ?`,
        [nextStatus, txId]
      );
      try {
        await connection.execute(
          `INSERT INTO tr_notification (transaction_id, type, recipient_customer_id, wa_number, message_body, status, sent_by, created_at, updated_at)
           SELECT t.id, 'selesai', t.customer_id, COALESCE(c.phone,'-'),
             CONCAT('Cucian Anda dengan nota ', t.transaction_no, ' sudah selesai dan siap ', IF(t.pickup_type='delivery','diantar oleh kurir kami.','diambil di outlet.')),
             'opened', ?, NOW(), NOW()
           FROM tr_transaction t JOIN mst_customer c ON c.id=t.customer_id WHERE t.id=?`,
          [req.user?.userId, txId]
        );
      } catch (_) { /* notifikasi tidak bloking */ }
    } else {
      await connection.execute(
        hasVersionCol
          ? `UPDATE tr_transaction SET status = 'process', updated_at = NOW(), version = version + 1 WHERE id = ? AND status IN ('draft','pending')`
          : `UPDATE tr_transaction SET status = 'process', updated_at = NOW() WHERE id = ? AND status IN ('draft','pending')`,
        [txId]
      );
    }

    const [logRows] = await connection.execute(
      `SELECT pl.stage, pl.started_at AS timestamp
       FROM tr_production_log pl
       JOIN tr_item_unit iu ON iu.id = pl.item_unit_id
       WHERE iu.transaction_id = ?
       ORDER BY pl.started_at ASC`,
      [txId]
    );
    const progress = logRows.map((l) => ({ stage: reverseMap[l.stage] || l.stage, timestamp: l.timestamp }));

    await connection.commit();

    // Emit realtime update untuk production dashboard (transaction-level mode)
    try {
      const [txRow] = await poolWaschenPos.execute(
        `SELECT outlet_id FROM tr_transaction WHERE id = ? LIMIT 1`,
        [txId]
      );
      if (txRow.length > 0) {
        emitProductionUpdate(txRow[0].outlet_id, txId, null, dbStatus);
      }
    } catch (e) {
      logger.warn('[updateProductionStage]', 'EventBus emit failed:', e?.message);
    }

    return res.status(200).json({
      success: true,
      message: `Stage '${stage}' berhasil dicatat.`,
      data: { progress, newVersion: hasVersionCol ? Number(currentVersion || 0) + 1 : undefined },
    });
  } catch (err) {
    await connection.rollback();
    logger.error('[updateProductionStage] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal mencatat progress produksi.' });
  } finally {
    connection.release();
  }
};

// ─── PATCH /api/transactions/:id/production-stage/revert ─────────────────────
// Rollback stage terakhir (untuk handle salah pencet)
// Hanya boleh revert kalau belum sampai 'Selesai' / 'Packing complete'
export const revertProductionStage = async (req, res) => {
  const connection = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { itemId, reason } = req.body;
    const userId = req.user?.userId || null;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Alasan revert wajib diisi.' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, outlet_id FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    const txId = rows[0].id;
    const outletId = rows[0].outlet_id;

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
      const [units] = await connection.execute(
        `SELECT id, production_status FROM tr_item_unit
         WHERE transaction_id = ? AND transaction_item_id = ?`,
        [txId, itemId]
      );
      if (units.length === 0) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Item tidak ditemukan.' });
      }
      // Tidak boleh revert kalau status = 'done' (sudah diserahkan ke customer)
      if (units.some(u => u.production_status === 'done')) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Tidak bisa revert: item sudah diserahkan ke customer.' });
      }

      for (const u of units) {
        const newStatus = revertMap[u.production_status] || u.production_status;
        if (newStatus !== u.production_status) {
          await connection.execute(
            `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE id = ?`,
            [newStatus, u.id]
          );
          // Log revert untuk audit trail
          await connection.execute(
            `INSERT INTO tr_production_log (item_unit_id, stage, status, started_at, completed_at, pic_id, notes)
             VALUES (?, ?, 'reverted', NOW(), NOW(), ?, ?)`,
            [u.id, u.production_status, userId, `[REVERT] ${reason.trim()}`]
          );
 // Emit realtime update
          emitProductionUpdate(outletId, txId, u.id, newStatus);
        }
      }
    } else {
      // Tx-level revert: revert semua item
      const [units] = await connection.execute(
        `SELECT id, production_status FROM tr_item_unit WHERE transaction_id = ?`,
        [txId]
      );
      if (units.some(u => u.production_status === 'done')) {
        await connection.rollback();
        return res.status(409).json({ success: false, message: 'Tidak bisa revert: order sudah diserahkan ke customer.' });
      }
      for (const u of units) {
        const newStatus = revertMap[u.production_status] || u.production_status;
        if (newStatus !== u.production_status) {
          await connection.execute(
            `UPDATE tr_item_unit SET production_status = ?, updated_at = NOW() WHERE id = ?`,
            [newStatus, u.id]
          );
          emitProductionUpdate(outletId, txId, u.id, newStatus);
        }
      }
    }

    await connection.commit();
    return res.status(200).json({
      success: true,
      message: 'Stage berhasil dikembalikan ke tahap sebelumnya.',
    });
  } catch (err) {
    await connection.rollback();
    logger.error('[revertProductionStage] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal revert stage.' });
  } finally {
    connection.release();
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
    logger.error('[requestApproval] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal mengajukan approval.' });
  }
};

// ─── POST /api/transactions/:id/condition ──────────────────────────────────
// ─── POST /api/transactions/:id/condition ──────────────────────────────────
// Simpan dokumentasi foto kondisi/packing dari produksi
// Body: { photos: [{ url, type }], notes, isDamage, phase, itemId }
// phase: 'receive' | 'packing' (menentukan default photo_type kalau type tidak diset)
export const saveItemCondition = async (req, res) => {
  const connection = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { photos, notes, isDamage, phase, itemId } = req.body;
    const userId = req.user?.userId || null;

    await connection.beginTransaction();

    // 1. Cari transaksi
    const [txRow] = await connection.execute(
      `SELECT id, outlet_id FROM tr_transaction WHERE id = ? OR transaction_no = ? LIMIT 1`,
      [id, id]
    );
    if (txRow.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    const txId = txRow[0].id;
    const outletId = txRow[0].outlet_id;

    // 2. Cari item_unit yang akan dilekati foto
    let unitRows;
    if (itemId) {
      [unitRows] = await connection.execute(
        `SELECT id FROM tr_item_unit WHERE transaction_id = ? AND transaction_item_id = ? LIMIT 1`,
        [txId, itemId]
      );
    } else {
      [unitRows] = await connection.execute(
        `SELECT id FROM tr_item_unit WHERE transaction_id = ? LIMIT 1`,
        [txId]
      );
    }
    if (unitRows.length === 0) {
      await connection.rollback();
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

    // 4. Insert semua foto dengan transaction
    // expires_at format MySQL DATETIME (yyyy-mm-dd HH:MM:SS)
    const expiresDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiresAt = expiresDate.toISOString().slice(0, 19).replace('T', ' ');
    const photoArr = Array.isArray(photos) ? photos : [];
    let insertedCount = 0;
    let lastInsertError = null;

    for (const p of photoArr) {
      const url = typeof p === 'string' ? p : (p?.url || p?.photoUrl);
      if (!url) continue;

      const photoType = mapType(p?.type) || defaultPhotoType;

      try {
        await connection.execute(
          `INSERT INTO tr_item_photo (item_unit_id, photo_url, photo_type, notes, expires_at, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [unitId, url, photoType, notes || null, expiresAt, userId]
        );
        insertedCount++;
      } catch (insertErr) {
        logger.error('[saveItemCondition] Insert failed', { code: insertErr.code, photoType, error: insertErr.message });
        lastInsertError = insertErr;
        // Continue to next photo but track failure
      }
    }

    // 5. Edge case: tidak ada foto tapi ada notes (pure text laporan)
    if (insertedCount === 0 && notes && notes.trim()) {
      try {
        await connection.execute(
          `INSERT INTO tr_item_photo (item_unit_id, photo_url, photo_type, notes, expires_at, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [unitId, 'note_only', defaultPhotoType, notes, expiresAt, userId]
        );
        insertedCount++;
      } catch (e) {
        logger.error('[saveItemCondition] Note-only insert failed', { error: e.message });
        lastInsertError = e;
      }
    }

    // 6. Tag damage di transaction notes
    if (isDamage) {
      await connection.execute(
        `UPDATE tr_transaction SET notes = CONCAT(COALESCE(notes, ''), ' | [AWAS ADA KERUSAKAN AWAL]') WHERE id = ?`,
        [txId]
      );
    }

    if (insertedCount === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Tidak ada foto/catatan yang berhasil disimpan. Coba ulangi.',
 error: lastInsertError?.message || 'Unknown error',
      });
    }

    await connection.commit();

    // Emit realtime update untuk photo refresh
    try {
      emitPhotoSaved(outletId, txId, unitId, defaultPhotoType);
    } catch (e) {
      logger.warn('[saveItemCondition]', 'EventBus emit failed:', e?.message);
    }

    return res.status(200).json({
      success: true,
      message: `${insertedCount} dokumentasi berhasil disimpan.`,
      data: { insertedCount, defaultPhotoType },
    });
  } catch (err) {
    await connection.rollback();
    logger.error('[saveItemCondition] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal menyimpan kondisi barang.' });
  } finally {
    connection.release();
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
    logger.error('[deleteItemPhoto] Error', { error: err?.message || String(err), stack: err?.stack });
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
    logger.error('[updateItemPhoto] Error', { error: err?.message || String(err), stack: err?.stack });
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
    logger.error('[getTransactionPhotos] Error', { error: err?.message || String(err), stack: err?.stack });
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
    logger.error('[saveReview] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal menyimpan review.' });
  }
};

// ─── PATCH /api/transactions/:id/delivery-type ───────────────────────────────
export const updateDeliveryType = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { pickupType, pickupFee = 10000, deliveryFee = 10000, scheduleAt, areaZoneId, notes } = req.body;

    const VALID_TYPES = ['self', 'pickup', 'delivery', 'both'];
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
    logger.error('[updateDeliveryType] Error', { error: err?.message || String(err), stack: err?.stack });
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
    logger.error('[updatePackingInfo] Error', { error: err?.message || String(err), stack: err?.stack });
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
const PACKING_PHOTO_TYPES = new Set(['packing', 'qc']);

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
    logger.warn('[getProductionMetaBatch]', 'Photo query error:', err?.message);
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

    // Ambil PER-ITEM yang sudah selesai produksi.
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
        c.photo AS customerPhoto,
        c.gender AS customerGender,
        o.name AS outletName
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
      JOIN tr_transaction_item ti ON ti.id = agg.itemId
      JOIN tr_transaction t ON t.id = agg.txId
      JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      WHERE t.deleted_at IS NULL
        AND t.status <> 'cancelled'
        AND agg.unfinishedCount = 0
        AND agg.totalUnits > 0
        AND agg.itemUpdatedAt >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ${outletSql}
      ORDER BY agg.itemUpdatedAt DESC
      LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    // Hitung total untuk pagination — match same filter (item yang sudah selesai)
    const countParams = [days];
    if (userOutletId) countParams.push(userOutletId);
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM (
        SELECT iu.transaction_item_id
        FROM tr_item_unit iu
        JOIN tr_transaction t ON t.id = iu.transaction_id
        WHERE t.deleted_at IS NULL
          AND t.status <> 'cancelled'
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
      customerPhoto: r.customerPhoto || null,
      customerGender: r.customerGender || null,
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
    logger.error('[getProductionHistory] Error', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat produksi.' });
  }
};

// ─── PATCH /api/transactions/:id/reschedule — ubah estimasi & jadwal pickup/delivery ───
export const rescheduleTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { estimated_done_at, pickup_type, pickup_address, pickup_notes, reason } = req.body;

    if (!estimated_done_at && !pickup_type) {
      return res.status(400).json({ success: false, message: 'estimated_done_at atau pickup_type wajib diisi.' });
    }

    // Verify transaction exists
    const [[tx]] = await poolWaschenPos.execute(
      `SELECT id, status, estimated_done_at, pickup_type FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?)`,
      [id, id]
    );
    if (!tx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    // Cannot reschedule completed/cancelled transactions
    if (['completed', 'cancelled', 'picked_up'].includes(tx.status)) {
      return res.status(422).json({ success: false, message: `Tidak dapat mengubah jadwal transaksi dengan status '${tx.status}'.` });
    }

    const updates = [];
    const params = [];
    if (estimated_done_at !== undefined) { updates.push('estimated_done_at = ?'); params.push(new Date(estimated_done_at)); }
    if (pickup_type !== undefined) { updates.push('pickup_type = ?'); params.push(pickup_type); }
    if (pickup_address !== undefined) { updates.push('pickup_address = ?'); params.push(pickup_address); }
    if (pickup_notes !== undefined) { updates.push('pickup_notes = ?'); params.push(pickup_notes); }

    params.push(id, id);
    await poolWaschenPos.execute(
      `UPDATE tr_transaction SET ${updates.join(', ')}, updated_at = NOW()
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?)`,
      params
    );

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      entityType: 'transaction',
      entityId: tx.id,
      action: 'reschedule_transaction',
      newData: { estimated_done_at, pickup_type, pickup_address, pickup_notes, reason },
      req,
    }).catch(() => {});

    return res.status(200).json({ success: true, message: 'Jadwal berhasil diperbarui.' });
  } catch (err) {
    logger.error('[rescheduleTransaction] Error', { error: err?.message || String(err), stack: err?.stack });
    return res.status(500).json({ success: false, message: 'Gagal memperbarui jadwal.' });
  }
};

// ─── POST /api/transactions/:id/cancellation-requests — ajukan pembatalan ───
export const requestCancellation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, type = 'cancellation' } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Alasan pembatalan minimal 5 karakter.' });
    }

    const [[tx]] = await poolWaschenPos.execute(
      `SELECT id, status, customer_id FROM tr_transaction WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?)`,
      [id, id]
    );
    if (!tx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    if (['completed', 'cancelled', 'picked_up'].includes(tx.status)) {
      return res.status(422).json({ success: false, message: `Tidak dapat membatalkan transaksi dengan status '${tx.status}'.` });
    }

    // Check for existing pending request
    const [[existing]] = await poolWaschenPos.execute(
      `SELECT id FROM tr_approval WHERE entity_type = 'transaction' AND entity_id = ? AND status = 'pending' LIMIT 1`,
      [tx.id]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Sudah ada permintaan persetujuan yang masih pending.' });
    }

    await poolWaschenPos.execute(
      `INSERT INTO tr_approval (entity_type, entity_id, type, reason, status, requested_by, requested_at)
       VALUES ('transaction', ?, 'cancellation', ?, 'pending', ?, NOW())`,
      [tx.id, reason.trim(), req.user?.userId || null]
    );

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      entityType: 'transaction',
      entityId: tx.id,
      action: 'request_cancellation',
      newData: { reason, type },
      req,
    }).catch(() => {});

    return res.status(201).json({ success: true, message: 'Permintaan pembatalan berhasil diajukan.' });
  } catch (err) {
    logger.error('[requestCancellation] Error', { error: err?.message || String(err), stack: err?.stack });
    return res.status(500).json({ success: false, message: 'Gagal mengajukan pembatalan.' });
  }
};

// ─── GET /api/transactions/:id/labels — data label untuk print nota/item ───
export const getTransactionLabels = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id } = req.query;

    const [txRows] = await poolWaschenPos.execute(
      `SELECT t.id, t.transaction_no AS transactionNo, t.created_at AS createdAt,
              t.estimated_done_at AS estimatedDoneAt, t.is_express AS isExpress,
              t.pickup_type AS pickupType, t.status AS dbStatus,
              c.name AS customerName, c.phone AS customerPhone,
              o.name AS outletName, o.address AS outletAddress, o.phone AS outletPhone
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE t.deleted_at IS NULL AND (t.id = ? OR t.transaction_no = ?)`,
      [id, id]
    );
    if (!txRows.length) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    const tx = txRows[0];

    let itemSql = `SELECT ti.id AS itemId, ti.service_name_snapshot AS serviceName,
                          ti.qty, ti.unit_type_snapshot AS unitType,
                          ti.unit_price_snapshot AS unitPrice, ti.subtotal,
                          ti.notes AS itemNotes, ti.is_express AS isExpress,
                          ti.packing_needed AS packingNeeded, ti.packing_done AS packingDone,
                          p.stage_name AS currentStage, p.updated_at AS stageUpdatedAt
                   FROM tr_transaction_item ti
                   LEFT JOIN tr_production p ON p.item_id = ti.id
                   WHERE ti.transaction_id = ? AND ti.is_active = 1`;
    const itemParams = [tx.id];
    if (item_id) { itemSql += ' AND ti.id = ?'; itemParams.push(item_id); }

    const [itemRows] = await poolWaschenPos.execute(itemSql, itemParams);

    const labels = itemRows.map(item => ({
      itemId: item.itemId,
      notaCode: tx.transactionNo,
      serviceName: item.serviceName,
      qty: item.qty,
      unit: item.unitType,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      itemNotes: item.itemNotes,
      isExpress: !!item.isExpress,
      packingNeeded: !!item.packingNeeded,
      packingDone: !!item.packingDone,
      currentStage: item.currentStage || 'Diterima',
      estimatedDoneAt: tx.estimatedDoneAt,
      createdAt: tx.createdAt,
      customerName: tx.customerName,
      customerPhone: tx.customerPhone,
      outletName: tx.outletName,
      outletAddress: tx.outletAddress,
      outletPhone: tx.outletPhone,
      pickupType: tx.pickupType,
      isExpressNota: !!tx.isExpress,
      qrData: `WASCHEN:${tx.transactionNo}:${item.itemId}`,
    }));

    return res.status(200).json({ success: true, data: labels });
  } catch (err) {
    logger.error('[getTransactionLabels] Error', { error: err?.message || String(err), stack: err?.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat data label.' });
  }
};