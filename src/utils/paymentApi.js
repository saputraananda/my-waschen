// ─────────────────────────────────────────────────────────────────────────────
// Payment Gateway client helpers
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

let cachedConfig = null;

export async function getPaymentConfig(force = false) {
  if (cachedConfig && !force) return cachedConfig;
  const res = await axios.get('/api/payments/config');
  cachedConfig = res?.data?.data || null;
  return cachedConfig;
}

/**
 * Charge transaksi via channel tertentu.
 */
export async function chargePayment({ transactionId, channel, amount }) {
  const res = await axios.post('/api/payments/charge', { transactionId, channel, amount });
  return res?.data?.data;
}

/**
 * Polling status — endpoint backend sudah no-cache.
 * Jangan kirim ?sync=1 di polling loop.
 */
export async function getPaymentStatus(orderId) {
  const url = `/api/payments/status/${encodeURIComponent(orderId)}`;
  const res = await axios.get(url, {
    headers: {
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
    },
  });
  return res?.data?.data;
}

/**
 * Manual sync ke Midtrans — HANYA dipanggil dari tombol "Cek Status".
 * Frontend wajib pakai cooldown 10 detik agar tidak spam.
 */
export async function syncPaymentStatus(orderId) {
  const res = await axios.get(`/api/payments/sync/${encodeURIComponent(orderId)}`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return res?.data?.data;
}

/**
 * Health check endpoint untuk admin.
 */
export async function getPaymentHealth() {
  const res = await axios.get('/api/payments/health', {
    headers: { 'Cache-Control': 'no-store' },
  });
  return res?.data?.data;
}

export async function cancelPayment(orderId) {
  const res = await axios.post(`/api/payments/cancel/${encodeURIComponent(orderId)}`);
  return res?.data?.data;
}

export async function createTopupSnap({ customerId, faceValue, sellPrice }) {
  const res = await axios.post('/api/payments/topup/snap', { customerId, faceValue, sellPrice });
  return res?.data?.data;
}

export async function getTransactionPayments(txId) {
  const res = await axios.get(`/api/payments/transactions/${encodeURIComponent(txId)}`);
  return res?.data?.data || [];
}

export async function getPaymentReport(filters = {}) {
  const res = await axios.get('/api/payments/report', { params: filters });
  return res?.data?.data;
}

/**
 * Lazy-load Snap.js script dari Midtrans CDN.
 */
export async function loadSnapJs() {
  const cfg = await getPaymentConfig();
  if (!cfg?.clientKey) throw new Error('Client key Midtrans belum dikonfigurasi.');
  if (window.snap) return;

  const url = cfg.isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  await new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) {
      const wait = () => (window.snap ? resolve() : setTimeout(wait, 100));
      return wait();
    }
    const s = document.createElement('script');
    s.src = url;
    s.setAttribute('data-client-key', cfg.clientKey);
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal memuat Snap.js'));
    document.head.appendChild(s);
  });
}

/**
 * Buka Snap popup. Resolve saat user finish/pending/error/close.
 */
export async function openSnapPopup(token) {
  await loadSnapJs();
  return new Promise((resolve) => {
    window.snap.pay(token, {
      onSuccess: (result) => resolve({ status: 'success', result }),
      onPending: (result) => resolve({ status: 'pending', result }),
      onError: (result) => resolve({ status: 'error', result }),
      onClose: () => resolve({ status: 'close' }),
    });
  });
}

// Default export — wrapper supaya import default juga jalan
const paymentApi = {
  getPaymentConfig,
  chargePayment,
  getPaymentStatus,
  syncPaymentStatus,
  getPaymentHealth,
  cancelPayment,
  createTopupSnap,
  getTransactionPayments,
  getPaymentReport,
  loadSnapJs,
  openSnapPopup,
};

export default paymentApi;
