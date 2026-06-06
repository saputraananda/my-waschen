// ─────────────────────────────────────────────────────────────────────────────
// Payment Controller — Midtrans gateway integration
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints:
//   POST /api/payments/charge          → buat pembayaran baru (kasir/customer)
//   GET  /api/payments/status/:orderId → cek status (polling fallback)
//   GET  /api/payments/transactions/:txId → list semua attempt untuk 1 transaksi
//   POST /api/payments/cancel/:orderId → batalkan attempt yang masih pending
//   POST /api/payments/topup/snap      → snap link untuk topup deposit
//   POST /api/webhook/midtrans         → webhook dari Midtrans (NO AUTH, signature verify)
//
// Reporting bisa langsung query tr_payment_item + filter gateway/channel.
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import midtrans, {
  generateOrderId,
  verifySignatureKey,
  mapMidtransStatus,
  MidtransConfig,
} from '../services/midtrans.js';
import { emitPaymentSettled } from '../services/eventBus.js';

// ════════════════════════════════════════════════════════════════════════════
// Helper: log integration event ke tr_payment_gateway_log
// ════════════════════════════════════════════════════════════════════════════
async function logGatewayEvent({
  gateway = 'midtrans', orderId, transactionId, eventType, status, amount,
  channel, payload, signatureValid, ipAddress, relatedTable, relatedId, errorMessage,
}) {
  try {
    await poolWaschenPos.execute(
      `INSERT INTO tr_payment_gateway_log
        (gateway, order_id, transaction_id, event_type, status, amount, channel,
         payload, signature_valid, ip_address, related_table, related_id, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        gateway, orderId, transactionId || null, eventType,
        status || null, amount != null ? Number(amount) : null, channel || null,
        payload ? JSON.stringify(payload) : null,
        signatureValid != null ? (signatureValid ? 1 : 0) : null,
        ipAddress || null, relatedTable || null, relatedId || null,
        errorMessage || null,
      ]
    );
  } catch (err) {
    console.error('[logGatewayEvent] Error:', err.message);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/payments/config — frontend butuh client key + isProduction flag
// ════════════════════════════════════════════════════════════════════════════
export const getPaymentConfig = async (req, res) => {
  return res.json({
    success: true,
    data: {
      gateway: 'midtrans',
      isProduction: MidtransConfig.isProduction,
      clientKey: MidtransConfig.clientKey,
      isConfigured: MidtransConfig.isConfigured,
      paymentExpiryMinutes: MidtransConfig.paymentExpiryMinutes,
      // Channel yang aktif
      enabledChannels: ['qris', 'gopay', 'shopeepay', 'bca_va', 'bni_va', 'bri_va', 'permata_va', 'mandiri_va'],
    },
  });
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/payments/charge — kasir buat pembayaran (Core API)
// Body: { transactionId, channel, amount? }
//   channel: qris | gopay | shopeepay | bca_va | bni_va | bri_va | permata_va | mandiri_va
//   amount: optional, default = sisa tagihan transaksi
// ════════════════════════════════════════════════════════════════════════════
export const chargeTransaction = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    if (!MidtransConfig.isConfigured) {
      return res.status(503).json({ success: false, message: 'Payment gateway belum dikonfigurasi.' });
    }

    const { transactionId, channel, amount: requestedAmount } = req.body || {};
    if (!transactionId || !channel) {
      return res.status(400).json({ success: false, message: 'transactionId & channel wajib diisi.' });
    }

    // Ambil transaksi
    const [trxRows] = await conn.execute(
      `SELECT t.id, t.transaction_no, t.total, t.paid_amount, t.payment_status,
              c.name AS customer_name, c.phone AS customer_phone
         FROM tr_transaction t
         LEFT JOIN mst_customer c ON c.id = t.customer_id
        WHERE (t.id = ? OR t.transaction_no = ?) AND t.deleted_at IS NULL
        LIMIT 1`,
      [Number(transactionId) || 0, String(transactionId)]
    );
    if (!trxRows.length) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }
    const trx = trxRows[0];
    if (trx.payment_status === 'paid') {
      return res.status(400).json({ success: false, message: 'Transaksi sudah lunas.' });
    }

    const sisa = Math.max(0, Number(trx.total) - Number(trx.paid_amount || 0));
    const amount = requestedAmount != null ? Math.max(1, Math.round(Number(requestedAmount))) : sisa;
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada sisa tagihan untuk dibayar.' });
    }

    // Order ID format: WSC-{transactionId}-{timestamp}
    // Pastikan tiap charge unik (Midtrans reject duplicate order_id),
    // sehingga retry setelah expire bisa pakai order_id baru.
    const txKey = String(trx.transaction_no || trx.id).replace(/[^A-Z0-9-]/gi, '').slice(0, 20);
    const orderId = `WSC-${txKey}-${Date.now()}`.slice(0, 60);
    const channelLower = String(channel).toLowerCase();

    await logGatewayEvent({
      orderId, eventType: 'charge_request', amount, channel: channelLower,
      payload: { transactionId: trx.id, channel },
      ipAddress: req.ip,
    });

    let result;
    let dbChannel = channelLower;
    const customerArgs = {
      customerName: trx.customer_name,
      customerPhone: trx.customer_phone,
    };
    const items = [{ id: String(trx.transaction_no || trx.id), name: `Pembayaran ${trx.transaction_no || trx.id}`, price: amount, quantity: 1, category: 'laundry' }];

    if (channelLower === 'qris') {
      result = await midtrans.chargeQris({ orderId, amount, items, ...customerArgs });
    } else if (channelLower === 'gopay' || channelLower === 'shopeepay') {
      result = await midtrans.chargeEwallet({ orderId, amount, channel: channelLower, items, ...customerArgs });
    } else if (channelLower.endsWith('_va')) {
      const bank = channelLower.replace('_va', '');
      result = await midtrans.chargeBankTransfer({ orderId, amount, bank, items, ...customerArgs });
    } else {
      return res.status(400).json({ success: false, message: `Channel ${channel} tidak didukung.` });
    }

    if (!result.ok) {
      await logGatewayEvent({
        orderId, eventType: 'charge_response', errorMessage: result.error,
        payload: result.raw, ipAddress: req.ip,
      });
      return res.status(502).json({ success: false, message: result.error || 'Gagal hubungi gateway.' });
    }

    const d = result.data;

    // Insert payment_item baru dengan status pending
    await conn.beginTransaction();
    const [insertResult] = await conn.execute(
      `INSERT INTO tr_payment_item
        (transaction_id, method, amount, recorded_by, status,
         gateway, channel, gateway_status, gateway_order_id, gateway_transaction_id,
         gateway_payload, va_number, qr_string, expires_at, recorded_at)
       VALUES (?, ?, ?, ?, 'pending', 'midtrans', ?, 'pending', ?, ?, ?, ?, ?, ?, NOW())`,
      [
        trx.id,
        mapChannelToMethod(channelLower),
        amount,
        req.user?.userId || req.user?.id || null,
        dbChannel,
        d.order_id,
        d.transaction_id,
        JSON.stringify(d.raw || null),
        d.va_number || null,
        d.qr_string || null,
        d.expires_at ? new Date(d.expires_at) : null,
      ]
    );
    const paymentItemId = insertResult.insertId;
    await conn.commit();

    await logGatewayEvent({
      orderId: d.order_id, transactionId: d.transaction_id, eventType: 'charge_response',
      status: d.status, amount, channel: dbChannel, payload: d.raw,
      relatedTable: 'tr_payment_item', relatedId: paymentItemId, ipAddress: req.ip,
    });

    return res.json({
      success: true,
      data: {
        paymentItemId,
        orderId: d.order_id,
        transactionId: d.transaction_id,
        channel: dbChannel,
        amount,
        status: d.status,
        // Channel-specific outputs
        qrString: d.qr_string || null,
        qrImageUrl: d.qr_image_url || null,
        deeplinkUrl: d.deeplink_url || null,
        vaNumber: d.va_number || null,
        billerCode: d.biller_code || null,
        bank: d.bank || null,
        expiresAt: d.expires_at || null,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('[chargeTransaction] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memproses pembayaran.' });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/payments/status/:orderId — polling status untuk frontend
// ════════════════════════════════════════════════════════════════════════════
// Lightweight: hanya baca dari DB. Sync ke Midtrans dipisah ke endpoint /sync.
// No-store: cegah cache layer apapun (browser, CDN, middleware).
// ════════════════════════════════════════════════════════════════════════════
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    // No cache headers — endpoint ini polling-heavy, jangan dibungkus cache
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const [rows] = await poolWaschenPos.execute(
      `SELECT pi.id, pi.transaction_id AS trxId,
              pi.gateway_status, pi.status,
              pi.amount, pi.channel, pi.va_number, pi.qr_string,
              pi.expires_at, pi.settled_at,
              t.total, t.paid_amount AS paidAmount, t.payment_status AS paymentStatus
         FROM tr_payment_item pi
         LEFT JOIN tr_transaction t ON t.id = pi.transaction_id
        WHERE pi.gateway_order_id = ?
        LIMIT 1`,
      [orderId]
    );

    let dbRow = rows[0] || null;
    let topupRow = null;

    if (!dbRow) {
      const [tRows] = await poolWaschenPos.execute(
        `SELECT id, customer_id AS customerId, gateway_status, face_value AS amount,
                channel, snap_token, snap_redirect_url, expires_at, settled_at
           FROM tr_deposit_topup
          WHERE gateway_order_id = ?
          LIMIT 1`,
        [orderId]
      );
      topupRow = tRows[0] || null;
    }

    if (!dbRow && !topupRow) {
      return res.status(404).json({ success: false, message: 'Order ID tidak ditemukan.' });
    }

    if (topupRow) {
      const status = mapMidtransStatus(topupRow.gateway_status);
      return res.json({
        success: true,
        data: {
          orderId,
          type: 'topup',
          // Lean response — hanya field yang dibutuhkan
          gateway_status: topupRow.gateway_status || 'pending',
          payment_status: status === 'settlement' ? 'paid' : (status === 'failed' ? 'unpaid' : 'pending'),
          amount: Number(topupRow.amount || 0),
          paid_amount: status === 'settlement' ? Number(topupRow.amount || 0) : 0,
          total: Number(topupRow.amount || 0),
          channel: topupRow.channel,
          settledAt: topupRow.settled_at,
          expiresAt: topupRow.expires_at,
        },
      });
    }

    const r = dbRow;
    const status = mapMidtransStatus(r.gateway_status);
    return res.json({
      success: true,
      data: {
        orderId,
        type: 'transaction',
        // ── Field utama yang frontend butuh untuk decide UI ──
        gateway_status: r.gateway_status || 'pending',
        // payment_status dari tr_transaction (sumber of truth lunas/belum)
        payment_status: r.paymentStatus || 'unpaid',
        paid_amount: Number(r.paidAmount || 0),
        total: Number(r.total || 0),
        // ── Channel-specific (untuk render QR / VA di UI) ──
        amount: Number(r.amount || 0),
        channel: r.channel,
        vaNumber: r.va_number,
        qrString: r.qr_string,
        settledAt: r.settled_at,
        expiresAt: r.expires_at,
      },
    });
  } catch (err) {
    console.error('[getPaymentStatus] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal cek status pembayaran.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/payments/sync/:orderId — manual sync ke Midtrans (admin / kasir tombol)
// ════════════════════════════════════════════════════════════════════════════
// Endpoint ini yang BOLEH hit Midtrans GET status API langsung.
// Dipakai saat polling tidak update setelah > 30 detik (webhook delay / retry).
// Frontend wajib pakai cooldown 10 detik agar tidak spam.
// ════════════════════════════════════════════════════════════════════════════
export const syncPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    res.setHeader('Cache-Control', 'no-store');

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId wajib.' });
    }

    // Hit Midtrans get status
    const result = await midtrans.getStatus(orderId);
    if (!result.ok) {
      await logGatewayEvent({
        orderId, eventType: 'manual_sync', errorMessage: result.error,
        ipAddress: req.ip,
      });
      return res.status(502).json({ success: false, message: result.error || 'Gateway error.' });
    }

    const m = result.data;
    const newStatus = mapMidtransStatus(m.transaction_status, m.fraud_status);

    // Update tr_payment_item
    const [pmtUpd] = await poolWaschenPos.execute(
      `UPDATE tr_payment_item
          SET gateway_status = ?,
              status = ?,
              gateway_payload = ?,
              settled_at = CASE WHEN ? = 'settlement' AND settled_at IS NULL THEN NOW() ELSE settled_at END
        WHERE gateway_order_id = ?`,
      [m.transaction_status, newStatus === 'settlement' ? 'paid' : (newStatus === 'failed' ? 'failed' : 'pending'),
       JSON.stringify(m), newStatus, orderId]
    );

    // Kalau settle, update tr_transaction
    if (newStatus === 'settlement' && pmtUpd.affectedRows > 0) {
      const [pmtRows] = await poolWaschenPos.execute(
        `SELECT transaction_id, channel FROM tr_payment_item WHERE gateway_order_id = ? LIMIT 1`,
        [orderId]
      );
      if (pmtRows.length) {
        const pmt = pmtRows[0];
        const [paidSumRows] = await poolWaschenPos.execute(
          `SELECT COALESCE(SUM(amount), 0) AS totalPaid FROM tr_payment_item WHERE transaction_id = ? AND status = 'paid'`,
          [pmt.transaction_id]
        );
        const totalPaid = Number(paidSumRows[0]?.totalPaid || 0);
        const [trxRows] = await poolWaschenPos.execute(
          `SELECT total, outlet_id, transaction_no FROM tr_transaction WHERE id = ?`,
          [pmt.transaction_id]
        );
        const txTotal = Number(trxRows[0]?.total || 0);
        const newPaymentStatus = totalPaid >= txTotal ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');
        await poolWaschenPos.execute(
          `UPDATE tr_transaction SET paid_amount = ?, payment_status = ?, payment_verified = 1,
                                      payment_verified_at = NOW(),
                                      primary_payment_method = COALESCE(primary_payment_method, ?),
                                      settled_at = COALESCE(settled_at, NOW()),
                                      updated_at = NOW()
            WHERE id = ?`,
          [totalPaid, newPaymentStatus, mapChannelToMethod(pmt.channel), pmt.transaction_id]
        );
        try {
          const trxMeta = trxRows[0];
          if (trxMeta?.outlet_id) {
            emitPaymentSettled(trxMeta.outlet_id, pmt.transaction_id, totalPaid, pmt.channel, {
              orderId,
              transactionNo: trxMeta.transaction_no,
              paymentStatus: newPaymentStatus,
            });
          }
        } catch {}
      }
    }

    // Cek topup
    const [topupUpd] = await poolWaschenPos.execute(
      `UPDATE tr_deposit_topup
          SET gateway_status = ?,
              gateway_payload = ?,
              settled_at = CASE WHEN ? = 'settlement' AND settled_at IS NULL THEN NOW() ELSE settled_at END
        WHERE gateway_order_id = ?`,
      [m.transaction_status, JSON.stringify(m), newStatus, orderId]
    );

    if (newStatus === 'settlement' && topupUpd.affectedRows > 0) {
      const [topupRows] = await poolWaschenPos.execute(
        `SELECT id, customer_id, face_value FROM tr_deposit_topup WHERE gateway_order_id = ? LIMIT 1`,
        [orderId]
      );
      if (topupRows.length) {
        const t = topupRows[0];
        const [existingLedger] = await poolWaschenPos.execute(
          `SELECT id FROM tr_wallet_ledger WHERE deposit_id = ? AND type = 'topup' LIMIT 1`,
          [t.id]
        ).catch(() => [[]]);
        if (existingLedger.length === 0) {
          await poolWaschenPos.execute(
            `INSERT INTO mst_customer_wallet (customer_id, balance, updated_at)
             VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance), updated_at = NOW()`,
            [t.customer_id, Number(t.face_value)]
          );
          try {
            await poolWaschenPos.execute(
              `INSERT INTO tr_wallet_ledger (customer_id, deposit_id, type, amount, created_by, created_at)
               VALUES (?, ?, 'topup', ?, NULL, NOW())`,
              [t.customer_id, t.id, Number(t.face_value)]
            );
          } catch { /* ledger optional */ }
        }
      }
    }

    await logGatewayEvent({
      orderId, eventType: 'manual_sync', status: m.transaction_status,
      payload: m, ipAddress: req.ip,
    });

    return res.json({
      success: true,
      data: {
        orderId,
        gateway_status: m.transaction_status,
        internal_status: newStatus,
      },
    });
  } catch (err) {
    console.error('[syncPaymentStatus] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal sync status.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/internal/payment-health — health check untuk admin (Task 5)
// ════════════════════════════════════════════════════════════════════════════
export const getPaymentHealth = async (req, res) => {
  try {
    const role = req.user?.roleCode;
    if (!['admin', 'superadmin', 'owner'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Hanya admin.' });
    }
    res.setHeader('Cache-Control', 'no-store');

    const [lastWebhookRows] = await poolWaschenPos.execute(
      `SELECT MAX(created_at) AS lastWebhookAt
         FROM tr_payment_gateway_log
        WHERE event_type = 'webhook' AND signature_valid = 1`
    );
    const [last24hRows] = await poolWaschenPos.execute(
      `SELECT
          SUM(CASE WHEN event_type = 'webhook' AND signature_valid = 1 THEN 1 ELSE 0 END) AS validWebhooks24h,
          SUM(CASE WHEN event_type = 'webhook' AND signature_valid = 0 THEN 1 ELSE 0 END) AS invalidWebhooks24h,
          SUM(CASE WHEN event_type = 'charge_request' THEN 1 ELSE 0 END) AS chargeRequests24h,
          SUM(CASE WHEN event_type = 'manual_sync' THEN 1 ELSE 0 END) AS manualSyncs24h
        FROM tr_payment_gateway_log
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const isProduction = MidtransConfig.isProduction;
    const usingSandboxKeyInProd = isProduction && serverKey.startsWith('SB-');

    return res.json({
      success: true,
      data: {
        midtransEnv: isProduction ? 'production' : 'sandbox',
        isConfigured: MidtransConfig.isConfigured,
        clientKeyPrefix: (process.env.MIDTRANS_CLIENT_KEY || '').slice(0, 8),
        serverKeyPrefix: serverKey.slice(0, 8),
        webhookUrlConfigured: !!process.env.MIDTRANS_WEBHOOK_URL,
        webhookUrl: process.env.MIDTRANS_WEBHOOK_URL || null,
        lastWebhookReceivedAt: lastWebhookRows[0]?.lastWebhookAt || null,
        warnings: usingSandboxKeyInProd
          ? ['SANDBOX KEY (SB-) digunakan saat MIDTRANS_ENV=production. Ganti ke production keys!']
          : [],
        stats24h: {
          validWebhooks: Number(last24hRows[0]?.validWebhooks24h || 0),
          invalidWebhooks: Number(last24hRows[0]?.invalidWebhooks24h || 0),
          chargeRequests: Number(last24hRows[0]?.chargeRequests24h || 0),
          manualSyncs: Number(last24hRows[0]?.manualSyncs24h || 0),
        },
        paymentExpiryMinutes: MidtransConfig.paymentExpiryMinutes,
      },
    });
  } catch (err) {
    console.error('[getPaymentHealth] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal load health.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/payments/cancel/:orderId — batalkan attempt pending
// ════════════════════════════════════════════════════════════════════════════
export const cancelPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const result = await midtrans.cancelTransaction(orderId);
    if (!result.ok) {
      return res.status(502).json({ success: false, message: result.error });
    }

    await poolWaschenPos.execute(
      `UPDATE tr_payment_item SET gateway_status = 'cancel', status = 'failed'
        WHERE gateway_order_id = ?`,
      [orderId]
    );
    await poolWaschenPos.execute(
      `UPDATE tr_deposit_topup SET gateway_status = 'cancel'
        WHERE gateway_order_id = ?`,
      [orderId]
    );

    await logGatewayEvent({
      orderId, eventType: 'cancel', status: 'cancel', payload: result.data, ipAddress: req.ip,
    });

    return res.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[cancelPayment] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal membatalkan pembayaran.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/payments/topup/snap — generate Snap link untuk topup deposit
// Body: { customerId, faceValue, sellPrice }
// ════════════════════════════════════════════════════════════════════════════
export const createTopupSnap = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    if (!MidtransConfig.isConfigured) {
      return res.status(503).json({ success: false, message: 'Payment gateway belum dikonfigurasi.' });
    }

    const { customerId, faceValue, sellPrice } = req.body || {};
    if (!customerId || !faceValue) {
      return res.status(400).json({ success: false, message: 'customerId & faceValue wajib diisi.' });
    }

    const amount = Math.round(Number(sellPrice || faceValue));
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal tidak valid.' });
    }

    const [custRows] = await conn.execute(
      `SELECT id, name, phone, email FROM mst_customer WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [customerId]
    );
    if (!custRows.length) {
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }
    const cust = custRows[0];

    const orderId = generateOrderId(`TPU${cust.id}`);
    await logGatewayEvent({
      orderId, eventType: 'charge_request', amount, channel: 'snap',
      payload: { customerId: cust.id, faceValue, sellPrice }, ipAddress: req.ip,
    });

    const result = await midtrans.createSnapTransaction({
      orderId,
      amount,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerEmail: cust.email,
      items: [{ id: 'TOPUP', name: `Top Up Deposit Rp${faceValue.toLocaleString('id-ID')}`, price: amount, quantity: 1, category: 'topup' }],
    });

    if (!result.ok) {
      await logGatewayEvent({ orderId, eventType: 'charge_response', errorMessage: result.error, ipAddress: req.ip });
      return res.status(502).json({ success: false, message: result.error });
    }

    // Generate topup_no
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const [seqRow] = await conn.execute(
      `SELECT COUNT(*) AS c FROM tr_deposit_topup WHERE DATE(created_at) = CURDATE()`
    );
    const topupNo = `TPU-${datePart}-${String((seqRow[0]?.c || 0) + 1).padStart(4, '0')}`;

    // Insert deposit_topup pending
    await conn.beginTransaction();
    const [insertResult] = await conn.execute(
      `INSERT INTO tr_deposit_topup
        (topup_no, customer_id, face_value, sell_price, payment_method,
         cashier_id, outlet_id, gateway, channel, gateway_status,
         gateway_order_id, snap_token, snap_redirect_url, gateway_payload, created_at)
       VALUES (?, ?, ?, ?, 'qris', ?, ?, 'midtrans', 'snap', 'pending', ?, ?, ?, ?, NOW())`,
      [
        topupNo, cust.id, Number(faceValue), amount,
        req.user?.userId || req.user?.id || null, req.user?.outletId || null,
        orderId, result.data.token, result.data.redirect_url,
        JSON.stringify(result.data.raw || null),
      ]
    );
    const topupId = insertResult.insertId;
    await conn.commit();

    await logGatewayEvent({
      orderId, eventType: 'charge_response', status: 'pending', amount,
      payload: result.data.raw, relatedTable: 'tr_deposit_topup', relatedId: topupId,
      ipAddress: req.ip,
    });

    return res.json({
      success: true,
      data: {
        topupId,
        topupNo,
        orderId,
        snapToken: result.data.token,
        snapUrl: result.data.redirect_url,
        amount,
        faceValue: Number(faceValue),
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('[createTopupSnap] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat link topup.' });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/webhook/midtrans — webhook handler (NO AUTH, signature verify)
// ════════════════════════════════════════════════════════════════════════════
// Optimized untuk Midtrans webhook SLA:
//   1. Verifikasi signature SEBELUM query DB apapun (drop fast invalid)
//   2. Idempotency check: kalau sudah 'paid' di DB → return 200 OK tanpa proses
//   3. Hanya proses jika transaction_status = 'settlement' atau 'capture' (accept)
//   4. Log SEMUA event tanpa terkecuali (audit trail)
//   5. Operasi berat (wallet topup, audit log lengkap, notifikasi) di-defer
//      via setImmediate supaya handler return < 3 detik
// ════════════════════════════════════════════════════════════════════════════
export const handleMidtransWebhook = async (req, res) => {
  const t0 = Date.now();
  const payload = req.body || {};
  const {
    order_id,
    transaction_id,
    status_code,
    gross_amount,
    signature_key,
    transaction_status,
    fraud_status,
    payment_type,
  } = payload;

  // ── Step 1: Field check (sebelum log apapun, karena order_id wajib) ──────
  if (!order_id || !signature_key || !status_code || !gross_amount) {
    // Field minimum tidak ada — log dengan order_id yang ada (atau 'unknown')
    setImmediate(() => {
      logGatewayEvent({
        orderId: order_id || 'unknown',
        eventType: 'webhook',
        errorMessage: 'Missing required fields',
        payload, ipAddress: req.ip, signatureValid: false,
      }).catch(() => {});
    });
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // ── Step 2: Verify signature DULU (sebelum query DB sama sekali) ─────────
  const sigValid = verifySignatureKey({ order_id, status_code, gross_amount, signature_key });
  if (!sigValid) {
    // Log invalid signature attempt — tapi jangan blok response
    setImmediate(() => {
      logGatewayEvent({
        orderId: order_id, transactionId: transaction_id, eventType: 'webhook',
        status: transaction_status, amount: gross_amount, channel: payment_type,
        payload, signatureValid: false, ipAddress: req.ip,
        errorMessage: 'Invalid signature',
      }).catch(() => {});
    });
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const internalStatus = mapMidtransStatus(transaction_status, fraud_status);
  // Hanya status final yang valid di-translate ke 'paid'
  // Midtrans: settlement = QRIS/e-wallet/VA pasti success
  //           capture (with fraud=accept) = kartu kredit success
  const isFinalPaid = internalStatus === 'settlement';
  const isPaymentTypeRecognized = !!transaction_status;

  // ── Step 3: Idempotency check ────────────────────────────────────────────
  // Kalau settlement event tapi sudah pernah masuk paid → return early
  let pmtRow = null;
  let topupRow = null;
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, transaction_id AS trxId, amount, channel, status, gateway_status
         FROM tr_payment_item WHERE gateway_order_id = ? LIMIT 1`,
      [order_id]
    );
    pmtRow = rows[0] || null;

    if (!pmtRow) {
      const [tRows] = await poolWaschenPos.execute(
        `SELECT id, customer_id AS customerId, face_value AS faceValue, sell_price AS sellPrice, gateway_status
           FROM tr_deposit_topup WHERE gateway_order_id = ? LIMIT 1`,
        [order_id]
      );
      topupRow = tRows[0] || null;
    }

    // Idempotent: kalau sudah paid/settlement, log dan ack
    if (pmtRow && pmtRow.status === 'paid' && isFinalPaid) {
      setImmediate(() => {
        logGatewayEvent({
          orderId: order_id, transactionId: transaction_id, eventType: 'webhook',
          status: transaction_status, amount: gross_amount, channel: payment_type,
          payload, signatureValid: true, ipAddress: req.ip,
          errorMessage: 'Idempotent skip: already paid',
        }).catch(() => {});
      });
      return res.status(200).json({ success: true, message: 'OK (idempotent)' });
    }
    if (topupRow && String(topupRow.gateway_status || '').toLowerCase() === 'settlement' && isFinalPaid) {
      setImmediate(() => {
        logGatewayEvent({
          orderId: order_id, transactionId: transaction_id, eventType: 'webhook',
          status: transaction_status, amount: gross_amount, channel: payment_type,
          payload, signatureValid: true, ipAddress: req.ip,
          errorMessage: 'Idempotent skip: topup already settled',
        }).catch(() => {});
      });
      return res.status(200).json({ success: true, message: 'OK (idempotent)' });
    }
  } catch (err) {
    console.error('[webhook] idempotency check error:', err.message);
    // Lanjut — biar handler tetap proses
  }

  // ── Step 4: Update status (synchronous minimal) ──────────────────────────
  // Hanya update kalau ada record yang cocok. Skip update payment_status
  // ke 'paid' kalau bukan settlement/capture (accept).
  try {
    if (pmtRow) {
      const newPaymentItemStatus = isFinalPaid ? 'paid'
        : internalStatus === 'failed' ? 'failed'
        : 'pending';

      await poolWaschenPos.execute(
        `UPDATE tr_payment_item
            SET gateway_status = ?,
                status = ?,
                gateway_payload = ?,
                settled_at = CASE WHEN ? = 'settlement' AND settled_at IS NULL THEN NOW() ELSE settled_at END
          WHERE id = ?`,
        [transaction_status, newPaymentItemStatus, JSON.stringify(payload), internalStatus, pmtRow.id]
      );

      // Update tr_transaction HANYA kalau status final paid
      if (isFinalPaid) {
        const [paidSumRows] = await poolWaschenPos.execute(
          `SELECT COALESCE(SUM(amount), 0) AS totalPaid
             FROM tr_payment_item WHERE transaction_id = ? AND status = 'paid'`,
          [pmtRow.trxId]
        );
        const totalPaid = Number(paidSumRows[0]?.totalPaid || 0);

        const [trxRows] = await poolWaschenPos.execute(
          `SELECT total FROM tr_transaction WHERE id = ?`,
          [pmtRow.trxId]
        );
        const txTotal = Number(trxRows[0]?.total || 0);
        const newPaymentStatus = totalPaid >= txTotal ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

        await poolWaschenPos.execute(
          `UPDATE tr_transaction
              SET paid_amount = ?,
                  payment_status = ?,
                  payment_verified = 1,
                  payment_verified_at = NOW(),
                  primary_payment_method = COALESCE(primary_payment_method, ?),
                  settled_at = COALESCE(settled_at, NOW()),
                  updated_at = NOW()
            WHERE id = ?`,
          [totalPaid, newPaymentStatus, mapChannelToMethod(pmtRow.channel), pmtRow.trxId]
        );

        // ── Realtime emit: pembayaran masuk ──────────────────────────────────
        try {
          const [[trxOutletRow]] = await poolWaschenPos.execute(
            `SELECT outlet_id, transaction_no FROM tr_transaction WHERE id = ? LIMIT 1`,
            [pmtRow.trxId]
          );
          if (trxOutletRow?.outlet_id) {
            emitPaymentSettled(trxOutletRow.outlet_id, pmtRow.trxId, totalPaid, pmtRow.channel, {
              orderId: order_id,
              transactionNo: trxOutletRow.transaction_no,
              paymentStatus: newPaymentStatus,
            });
          }
        } catch {}
      }
    } else if (topupRow) {
      // Topup: update gateway_status, kalau settle akan diproses async
      await poolWaschenPos.execute(
        `UPDATE tr_deposit_topup
            SET gateway_status = ?,
                gateway_payload = ?,
                settled_at = CASE WHEN ? = 'settlement' AND settled_at IS NULL THEN NOW() ELSE settled_at END
          WHERE id = ?`,
        [transaction_status, JSON.stringify(payload), internalStatus, topupRow.id]
      );
    }
    // Kalau kedua-duanya null: order_id tidak dikenal, tetap log
  } catch (err) {
    console.error('[webhook] update DB error:', err.message);
    // Jangan return error — Midtrans akan retry; cukup log
  }

  // ── Step 5: ACK Midtrans cepat (target < 3 detik) ────────────────────────
  // Operasi berat di-defer via setImmediate supaya handler tidak blocking
  res.status(200).json({ success: true, message: 'OK', durationMs: Date.now() - t0 });

  // ── Step 6: Background tasks (audit log, wallet topup, notif) ────────────
  setImmediate(async () => {
    try {
      // Log webhook event ke gateway log (full payload)
      await logGatewayEvent({
        orderId: order_id, transactionId: transaction_id, eventType: 'webhook',
        status: transaction_status, amount: gross_amount, channel: payment_type,
        payload, signatureValid: true, ipAddress: req.ip,
        relatedTable: pmtRow ? 'tr_payment_item' : (topupRow ? 'tr_deposit_topup' : null),
        relatedId: pmtRow?.id || topupRow?.id || null,
      });

      // Wallet topup — sync di sini sesuai aturan: deposit wallet wajib sync
      // Tapi ini di-defer dari ack supaya Midtrans tidak nunggu
      const isFinalPaid = mapMidtransStatus(transaction_status, fraud_status) === 'settlement';
      let topup = topupRow;
      if (!topup && !pmtRow) {
        const [tRows] = await poolWaschenPos.execute(
          `SELECT id, customer_id AS customerId, face_value AS faceValue, sell_price AS sellPrice
             FROM tr_deposit_topup WHERE gateway_order_id = ? LIMIT 1`,
          [order_id]
        );
        topup = tRows[0] || null;
      }
      if (topup && isFinalPaid) {
        const paidAmount = Math.round(Number(gross_amount || 0));
        const expectedAmount = Math.round(Number(topup.sellPrice || topup.faceValue || 0));
        if (expectedAmount > 0 && paidAmount > 0 && paidAmount !== expectedAmount) {
          await logGatewayEvent({
            orderId: order_id, transactionId: transaction_id, eventType: 'wallet_topup_skip',
            status: transaction_status, amount: gross_amount, channel: payment_type,
            payload, signatureValid: true, ipAddress: req.ip,
            relatedTable: 'tr_deposit_topup', relatedId: topup.id,
            errorMessage: `Amount mismatch: expected ${expectedAmount}, got ${paidAmount}`,
          });
          return;
        }
        try {
          // Idempotent: cek ledger dulu
          const [existingLedger] = await poolWaschenPos.execute(
            `SELECT id FROM tr_wallet_ledger WHERE deposit_id = ? AND type = 'topup' LIMIT 1`,
            [topup.id]
          ).catch(() => [[]]);
          if (existingLedger.length === 0) {
            await poolWaschenPos.execute(
              `INSERT INTO mst_customer_wallet (customer_id, balance, updated_at)
               VALUES (?, ?, NOW())
               ON DUPLICATE KEY UPDATE balance = balance + VALUES(balance), updated_at = NOW()`,
              [topup.customerId, Number(topup.faceValue)]
            );
            try {
              await poolWaschenPos.execute(
                `INSERT INTO tr_wallet_ledger
                  (customer_id, deposit_id, type, amount, created_by, created_at)
                 VALUES (?, ?, 'topup', ?, NULL, NOW())`,
                [topup.customerId, topup.id, Number(topup.faceValue)]
              );
            } catch { /* ledger optional */ }
          }
        } catch (err) {
          console.error('[webhook] wallet topup background error:', err.message);
        }
      }
    } catch (err) {
      console.error('[webhook] background error:', err.message);
    }
  });
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/payments/transactions/:txId — list semua attempt untuk 1 transaksi
// ════════════════════════════════════════════════════════════════════════════
export const getTransactionPayments = async (req, res) => {
  try {
    const { txId } = req.params;
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, method, amount, status,
              gateway, channel, gateway_status, gateway_order_id, gateway_transaction_id,
              va_number, qr_string, expires_at, settled_at,
              recorded_at, paid_at
         FROM tr_payment_item
        WHERE transaction_id = ?
        ORDER BY recorded_at DESC`,
      [Number(txId)]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getTransactionPayments] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data pembayaran.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/payments/report — reporting untuk admin/finance
// Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&outletId=&channel=&gateway=
// ════════════════════════════════════════════════════════════════════════════
export const getPaymentReport = async (req, res) => {
  try {
    const { startDate, endDate, outletId, channel, gateway, status } = req.query;
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

    let where = `pi.recorded_at IS NOT NULL`;
    const params = [];

    if (startDate) { where += ' AND DATE(pi.recorded_at) >= ?'; params.push(startDate); }
    if (endDate)   { where += ' AND DATE(pi.recorded_at) <= ?'; params.push(endDate); }
    if (gateway)   { where += ' AND pi.gateway = ?'; params.push(gateway); }
    if (channel)   { where += ' AND pi.channel = ?'; params.push(channel); }
    if (status)    { where += ' AND pi.status = ?'; params.push(status); }

    // Outlet scoping
    if (!isGlobal && userOutletId) {
      where += ' AND t.outlet_id = ?';
      params.push(userOutletId);
    } else if (outletId) {
      where += ' AND t.outlet_id = ?';
      params.push(outletId);
    }

    // Aggregate by gateway+channel
    const [aggRows] = await poolWaschenPos.execute(
      `SELECT
          COALESCE(pi.gateway, 'manual') AS gateway,
          COALESCE(pi.channel, pi.method) AS channel,
          pi.status,
          COUNT(*) AS count,
          COALESCE(SUM(pi.amount), 0) AS totalAmount
        FROM tr_payment_item pi
        LEFT JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE ${where}
       GROUP BY COALESCE(pi.gateway, 'manual'), COALESCE(pi.channel, pi.method), pi.status
       ORDER BY totalAmount DESC`,
      params
    );

    // Total summary
    const [sumRows] = await poolWaschenPos.execute(
      `SELECT
          COUNT(*) AS totalTx,
          COALESCE(SUM(CASE WHEN pi.status = 'paid' THEN pi.amount ELSE 0 END), 0) AS totalPaid,
          COALESCE(SUM(CASE WHEN pi.status = 'pending' THEN pi.amount ELSE 0 END), 0) AS totalPending,
          COALESCE(SUM(CASE WHEN pi.status = 'failed' THEN pi.amount ELSE 0 END), 0) AS totalFailed,
          COALESCE(SUM(CASE WHEN pi.gateway = 'midtrans' AND pi.status = 'paid' THEN pi.amount ELSE 0 END), 0) AS midtransRevenue,
          COALESCE(SUM(CASE WHEN (pi.gateway IS NULL OR pi.gateway = 'manual') AND pi.status = 'paid' THEN pi.amount ELSE 0 END), 0) AS manualRevenue
        FROM tr_payment_item pi
        LEFT JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE ${where}`,
      params
    );

    return res.json({
      success: true,
      data: {
        summary: {
          totalTransactions: Number(sumRows[0]?.totalTx || 0),
          totalPaid: Number(sumRows[0]?.totalPaid || 0),
          totalPending: Number(sumRows[0]?.totalPending || 0),
          totalFailed: Number(sumRows[0]?.totalFailed || 0),
          midtransRevenue: Number(sumRows[0]?.midtransRevenue || 0),
          manualRevenue: Number(sumRows[0]?.manualRevenue || 0),
        },
        breakdown: aggRows.map(r => ({
          gateway: r.gateway,
          channel: r.channel,
          status: r.status,
          count: Number(r.count),
          totalAmount: Number(r.totalAmount),
        })),
      },
    });
  } catch (err) {
    console.error('[getPaymentReport] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil laporan pembayaran.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════════════
function mapChannelToMethod(channel) {
  const c = String(channel || '').toLowerCase();
  if (c === 'qris') return 'qris';
  if (c === 'gopay') return 'gopay';
  if (c === 'shopeepay') return 'shopeepay';
  if (c === 'ovo') return 'ovo';
  if (c === 'dana') return 'dana';
  if (c.endsWith('_va') || c === 'echannel' || c === 'permata' || c === 'bank_transfer') return 'transfer';
  return 'transfer';
}
