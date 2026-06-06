// ─────────────────────────────────────────────────────────────────────────────
// Midtrans Service — wrapper untuk Core API + Snap
// ─────────────────────────────────────────────────────────────────────────────
// Menyediakan:
//   - chargeQris(params)       → Core API charge QRIS
//   - chargeEwallet(params)    → Core API charge GoPay/ShopeePay
//   - chargeBankTransfer(params) → Core API charge VA (BCA/BNI/BRI/Permata/Mandiri)
//   - createSnapTransaction(params) → Snap (untuk topup, share link)
//   - getStatus(orderId)       → cek status di Midtrans
//   - cancelTransaction(orderId)
//   - verifySignatureKey(payload) → verifikasi webhook signature
//
// Semua fungsi async, return { ok, data, error }.
// ─────────────────────────────────────────────────────────────────────────────
import midtransClient from 'midtrans-client';
import crypto from 'crypto';
import https from 'https';

// Workaround SSL certificate issue di development (Windows/localhost)
// JANGAN aktifkan di production!
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('[midtrans] ⚠️  SSL verification disabled untuk development environment');
}

// Support 2 cara konfigurasi env:
//   MIDTRANS_ENV=sandbox|production (legacy)
//   MIDTRANS_IS_PRODUCTION=true|false (sesuai prompt)
const ENV_RAW = (process.env.MIDTRANS_ENV || '').toLowerCase();
const IS_PROD_FLAG = String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase();
const IS_PRODUCTION =
  IS_PROD_FLAG === 'true' || IS_PROD_FLAG === '1' || ENV_RAW === 'production';
const ENV = IS_PRODUCTION ? 'production' : 'sandbox';
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || '';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
const PAYMENT_EXPIRY_MIN = Math.max(5, Math.min(1440, parseInt(process.env.MIDTRANS_PAYMENT_EXPIRY_MINUTES, 10) || 15));

// ── Utility & startup validation ───────────────────────────────────────────
export function isMidtransProduction() {
  return IS_PRODUCTION;
}

export function getMidtransBaseUrl(kind = 'core') {
  const prod = IS_PRODUCTION;
  if (kind === 'core') return prod ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  if (kind === 'snap') return prod ? 'https://app.midtrans.com/snap' : 'https://app.sandbox.midtrans.com/snap';
  return prod ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

// Startup validation — fail fast supaya tidak diam-diam pakai key salah
(function validateMidtransConfig() {
  if (!SERVER_KEY || !CLIENT_KEY) {
    console.warn('[midtrans] ⚠️  SERVER_KEY atau CLIENT_KEY belum di-set. Fitur payment gateway akan disabled.');
    return;
  }
  // Production guard: tolak boot kalau pakai sandbox key
  if (IS_PRODUCTION) {
    if (SERVER_KEY.startsWith('SB-') || CLIENT_KEY.startsWith('SB-')) {
      const msg = '\n❌ MIDTRANS CONFIG ERROR: MIDTRANS_ENV=production tapi keys masih sandbox (prefix SB-).\n' +
                  '   Server key: ' + SERVER_KEY.slice(0, 8) + '...\n' +
                  '   Client key: ' + CLIENT_KEY.slice(0, 8) + '...\n' +
                  '   Ganti dengan key production di .env (Mid-server-... / Mid-client-...) atau set MIDTRANS_ENV=sandbox.\n';
      console.error(msg);
      throw new Error('Midtrans production environment menggunakan sandbox keys');
    }
    if (!SERVER_KEY.startsWith('Mid-server-')) {
      console.warn('[midtrans] ⚠️  SERVER_KEY tidak dimulai dengan "Mid-server-" — pastikan ini production key yang benar.');
    }
  } else {
    if (!SERVER_KEY.startsWith('SB-')) {
      console.warn('[midtrans] ⚠️  MIDTRANS_ENV=sandbox tapi SERVER_KEY bukan SB-... — cek .env supaya tidak salah environment.');
    }
  }
  console.log(`[midtrans] env: ${IS_PRODUCTION ? 'PRODUCTION' : 'sandbox'} · base: ${getMidtransBaseUrl('core')}`);
})();

// Core API client (untuk QRIS, e-wallet, VA, kartu kredit)
const coreApi = new midtransClient.CoreApi({
  isProduction: IS_PRODUCTION,
  serverKey: SERVER_KEY,
  clientKey: CLIENT_KEY,
});

// Snap client (untuk hosted page / link)
const snap = new midtransClient.Snap({
  isProduction: IS_PRODUCTION,
  serverKey: SERVER_KEY,
  clientKey: CLIENT_KEY,
});

const isConfigured = () => Boolean(SERVER_KEY && CLIENT_KEY);

const safeError = (err) => {
  // midtrans-client throws Error dengan message JSON string kadang
  // Coba parse status_message dari ApiResponse, atau dari validation_messages
  const apiResp = err?.ApiResponse || null;
  const validationMsg = Array.isArray(apiResp?.validation_messages) && apiResp.validation_messages.length > 0
    ? `Validasi: ${apiResp.validation_messages.join('; ')}`
    : null;
  const statusMsg = apiResp?.status_message || null;
  const msg = validationMsg || statusMsg || err?.message || String(err);
  // Log full Midtrans response untuk diagnose
  if (apiResp) {
    console.error('[midtrans] API error:', {
      status_code: apiResp.status_code,
      status_message: apiResp.status_message,
      validation_messages: apiResp.validation_messages,
      raw: JSON.stringify(apiResp).slice(0, 500),
    });
  } else {
    console.error('[midtrans] non-API error:', err?.message || err);
  }
  return { ok: false, error: msg, raw: apiResp };
};

/**
 * Generate order_id unik. Format: WSC-{tipe}-{timestamp}-{random}
 * Karakter aman untuk Midtrans (alfanumerik + dash + underscore).
 */
export function generateOrderId(prefix = 'TRX') {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rnd}`;
}

/**
 * Verifikasi signature dari webhook Midtrans.
 * Formula: SHA512(order_id + status_code + gross_amount + server_key)
 *
 * Wajib dipanggil di webhook handler sebelum proses event.
 */
export function verifySignatureKey({ order_id, status_code, gross_amount, signature_key }) {
  if (!order_id || !status_code || !gross_amount || !signature_key) return false;
  const raw = `${order_id}${status_code}${gross_amount}${SERVER_KEY}`;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');
  return expected === signature_key;
}

/**
 * Charge QRIS — generate QR string untuk customer scan.
 *
 * @param {Object} params
 * @param {string} params.orderId - Unik. Pakai generateOrderId() kalau belum ada.
 * @param {number} params.amount - Total tagihan (rupiah, integer)
 * @param {string} [params.customerName]
 * @param {string} [params.customerPhone]
 * @param {Array}  [params.items] - [{ id, name, price, quantity, category }]
 *
 * @returns {Promise<{ok, data: { qr_string, transaction_id, gross_amount, expires_at, raw }, error}>}
 */
export async function chargeQris({ orderId, amount, customerName, customerPhone, items }) {
  if (!isConfigured()) return { ok: false, error: 'Midtrans belum dikonfigurasi (MIDTRANS_SERVER_KEY/CLIENT_KEY kosong).' };
  try {
    // Build custom_expiry dengan order_time eksplisit (WIB +0700 — sesuai zona Indonesia).
    // Kalau timezone server bukan WIB tapi suffix tetap +0700, Midtrans bisa reject
    // karena waktu dianggap di luar threshold. Jadi pakai UTC betulan + offset 7 jam.
    const nowUtc = new Date();
    const wib = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const orderTime = `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())} +0700`;

    const payload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(Number(amount)),
      },
      qris: { acquirer: 'gopay' }, // gopay = banyak channel default
      // order_time wajib diisi supaya custom_expiry dihitung dari waktu yang benar
      custom_expiry: {
        order_time: orderTime,
        expiry_duration: Math.max(5, PAYMENT_EXPIRY_MIN),
        unit: 'minute',
      },
      ...(customerName || (customerPhone && String(customerPhone).trim().length > 0)
        ? {
            customer_details: {
              first_name: (customerName || 'Customer').slice(0, 50),
              ...(customerPhone && String(customerPhone).trim().length > 0
                ? { phone: String(customerPhone).replace(/\D/g, '').slice(0, 20) }
                : {}),
            },
          }
        : {}),
      ...(Array.isArray(items) && items.length
        ? { item_details: items.map((it) => ({
            id: String(it.id || '').slice(0, 50) || 'ITEM',
            name: String(it.name || 'Item').slice(0, 50),
            price: Math.round(Number(it.price || 0)),
            quantity: Math.max(1, Math.round(Number(it.quantity || 1))),
            category: String(it.category || 'service').slice(0, 50),
          })) }
        : {}),
    };

    const res = await coreApi.charge(payload);
    // Midtrans response untuk QRIS: actions[0] = generate-qr-code (image URL)
    const qrAction = (res.actions || []).find((a) => a.name === 'generate-qr-code');
    return {
      ok: true,
      data: {
        order_id: res.order_id,
        transaction_id: res.transaction_id,
        gross_amount: Number(res.gross_amount),
        qr_string: res.qr_string || null,
        qr_image_url: qrAction?.url || null,
        expires_at: res.expiry_time || null,
        status: res.transaction_status,
        raw: res,
      },
    };
  } catch (err) { return safeError(err); }
}

/**
 * Charge E-Wallet — GoPay, ShopeePay (deeplink).
 * @param {Object} params
 * @param {string} params.orderId
 * @param {number} params.amount
 * @param {'gopay'|'shopeepay'} params.channel
 * @param {string} [params.customerName]
 * @param {string} [params.customerPhone]
 */
export async function chargeEwallet({ orderId, amount, channel, customerName, customerPhone, items }) {
  if (!isConfigured()) return { ok: false, error: 'Midtrans belum dikonfigurasi.' };
  if (!['gopay', 'shopeepay'].includes(channel)) {
    return { ok: false, error: `Channel ${channel} tidak didukung untuk Core API. Pakai chargeQris() atau Snap.` };
  }
  try {
    const payload = {
      payment_type: channel,
      transaction_details: { order_id: orderId, gross_amount: Math.round(Number(amount)) },
      ...(channel === 'gopay'
        ? { gopay: {
            enable_callback: true,
            callback_url: `${APP_BASE_URL}/payment/finish?order_id=${encodeURIComponent(orderId)}`,
          } }
        : { shopeepay: {
            callback_url: `${APP_BASE_URL}/payment/finish?order_id=${encodeURIComponent(orderId)}`,
          } }),
      ...(customerName || (customerPhone && String(customerPhone).trim().length > 0)
        ? { customer_details: {
            first_name: (customerName || 'Customer').slice(0, 50),
            ...(customerPhone && String(customerPhone).trim().length > 0
              ? { phone: String(customerPhone).replace(/\D/g, '').slice(0, 20) }
              : {}),
          } }
        : {}),
      ...(Array.isArray(items) && items.length ? { item_details: mapItems(items) } : {}),
    };

    const res = await coreApi.charge(payload);
    const deeplinkAction = (res.actions || []).find((a) => a.name === 'deeplink-redirect');
    const qrAction = (res.actions || []).find((a) => a.name === 'generate-qr-code');
    return {
      ok: true,
      data: {
        order_id: res.order_id,
        transaction_id: res.transaction_id,
        gross_amount: Number(res.gross_amount),
        deeplink_url: deeplinkAction?.url || null,
        qr_image_url: qrAction?.url || null,
        expires_at: res.expiry_time || null,
        status: res.transaction_status,
        raw: res,
      },
    };
  } catch (err) { return safeError(err); }
}

/**
 * Charge Bank Transfer / Virtual Account.
 * Channel: bca, bni, bri, permata, mandiri (echannel)
 */
export async function chargeBankTransfer({ orderId, amount, bank, customerName, customerPhone, items }) {
  if (!isConfigured()) return { ok: false, error: 'Midtrans belum dikonfigurasi.' };
  const supportedBanks = ['bca', 'bni', 'bri', 'permata', 'mandiri'];
  if (!supportedBanks.includes(String(bank).toLowerCase())) {
    return { ok: false, error: `Bank ${bank} tidak didukung. Pilih: ${supportedBanks.join(', ')}` };
  }
  try {
    let payload = {
      transaction_details: { order_id: orderId, gross_amount: Math.round(Number(amount)) },
      ...(customerName || (customerPhone && String(customerPhone).trim().length > 0)
        ? { customer_details: {
            first_name: (customerName || 'Customer').slice(0, 50),
            ...(customerPhone && String(customerPhone).trim().length > 0
              ? { phone: String(customerPhone).replace(/\D/g, '').slice(0, 20) }
              : {}),
          } }
        : {}),
      ...(Array.isArray(items) && items.length ? { item_details: mapItems(items) } : {}),
    };

    if (bank === 'mandiri') {
      // Mandiri pakai echannel (bukan bank_transfer)
      payload = {
        ...payload,
        payment_type: 'echannel',
        echannel: {
          bill_info1: 'Pembayaran',
          bill_info2: orderId.slice(-12),
        },
      };
    } else if (bank === 'permata') {
      payload = { ...payload, payment_type: 'permata' };
    } else {
      payload = {
        ...payload,
        payment_type: 'bank_transfer',
        bank_transfer: { bank }, // bca, bni, bri
      };
    }

    const res = await coreApi.charge(payload);
    const va =
      res.va_numbers?.[0]?.va_number ||
      res.permata_va_number ||
      res.bill_key || null;
    const billerCode = res.biller_code || null;
    return {
      ok: true,
      data: {
        order_id: res.order_id,
        transaction_id: res.transaction_id,
        gross_amount: Number(res.gross_amount),
        va_number: va,
        biller_code: billerCode,
        bank: bank,
        expires_at: res.expiry_time || null,
        status: res.transaction_status,
        raw: res,
      },
    };
  } catch (err) { return safeError(err); }
}

/**
 * Snap transaction — buat URL pembayaran yang bisa dibuka di browser.
 * Cocok untuk topup, share link via WA, atau customer-side payment di PWA.
 *
 * @returns {Promise<{ok, data: { token, redirect_url }, error}>}
 */
export async function createSnapTransaction({ orderId, amount, customerName, customerPhone, customerEmail, items, enabledPayments }) {
  if (!isConfigured()) return { ok: false, error: 'Midtrans belum dikonfigurasi.' };
  try {
    const payload = {
      transaction_details: { order_id: orderId, gross_amount: Math.round(Number(amount)) },
      credit_card: { secure: true },
      customer_details: {
        first_name: (customerName || 'Customer').slice(0, 50),
        phone: (customerPhone || '').slice(0, 20),
        ...(customerEmail ? { email: customerEmail } : {}),
      },
      ...(Array.isArray(items) && items.length ? { item_details: mapItems(items) } : {}),
      // Default enable semua channel; kalau dikasih array, batasi channel tertentu
      ...(Array.isArray(enabledPayments) && enabledPayments.length
        ? { enabled_payments: enabledPayments }
        : {}),
      callbacks: {
        finish: `${APP_BASE_URL}/payment/finish?order_id=${encodeURIComponent(orderId)}`,
      },
      expiry: { unit: 'minutes', duration: PAYMENT_EXPIRY_MIN },
    };

    const res = await snap.createTransaction(payload);
    return {
      ok: true,
      data: {
        order_id: orderId,
        token: res.token,
        redirect_url: res.redirect_url,
        raw: res,
      },
    };
  } catch (err) { return safeError(err); }
}

/**
 * Cek status transaksi di Midtrans (untuk polling fallback / reconciliation).
 */
export async function getStatus(orderIdOrTxId) {
  if (!isConfigured()) return { ok: false, error: 'Midtrans belum dikonfigurasi.' };
  try {
    const res = await coreApi.transaction.status(orderIdOrTxId);
    return { ok: true, data: res };
  } catch (err) { return safeError(err); }
}

/**
 * Cancel transaksi yang masih pending.
 */
export async function cancelTransaction(orderIdOrTxId) {
  if (!isConfigured()) return { ok: false, error: 'Midtrans belum dikonfigurasi.' };
  try {
    const res = await coreApi.transaction.cancel(orderIdOrTxId);
    return { ok: true, data: res };
  } catch (err) { return safeError(err); }
}

/**
 * Approve / capture (untuk credit card flow).
 */
export async function approveTransaction(orderIdOrTxId) {
  if (!isConfigured()) return { ok: false, error: 'Midtrans belum dikonfigurasi.' };
  try {
    const res = await coreApi.transaction.approve(orderIdOrTxId);
    return { ok: true, data: res };
  } catch (err) { return safeError(err); }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mapItems(items) {
  return items.slice(0, 50).map((it) => ({
    id: String(it.id || '').slice(0, 50) || 'ITEM',
    name: String(it.name || 'Item').slice(0, 50),
    price: Math.round(Number(it.price || 0)),
    quantity: Math.max(1, Math.round(Number(it.quantity || 1))),
    category: String(it.category || 'service').slice(0, 50),
  }));
}

/**
 * Map raw Midtrans transaction_status ke status internal kita.
 *  pending → pending
 *  capture → settlement (CC after capture)
 *  settlement → settlement (paid)
 *  deny | cancel | expire | failure → failed
 *  refund | partial_refund → refunded
 */
export function mapMidtransStatus(midtransStatus, fraudStatus) {
  const s = String(midtransStatus || '').toLowerCase();
  if (s === 'capture') {
    if (fraudStatus === 'challenge') return 'pending';
    if (fraudStatus === 'accept') return 'settlement';
    return 'pending';
  }
  if (s === 'settlement') return 'settlement';
  if (s === 'pending') return 'pending';
  if (s === 'deny' || s === 'cancel' || s === 'expire' || s === 'failure') return 'failed';
  if (s === 'refund' || s === 'partial_refund') return 'refunded';
  return s || 'pending';
}

export const MidtransConfig = {
  isProduction: IS_PRODUCTION,
  isConfigured: isConfigured(),
  clientKey: CLIENT_KEY, // safe to expose to frontend
  paymentExpiryMinutes: PAYMENT_EXPIRY_MIN,
};

export default {
  chargeQris,
  chargeEwallet,
  chargeBankTransfer,
  createSnapTransaction,
  getStatus,
  cancelTransaction,
  approveTransaction,
  verifySignatureKey,
  generateOrderId,
  mapMidtransStatus,
  MidtransConfig,
};
