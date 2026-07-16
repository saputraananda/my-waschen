// ─────────────────────────────────────────────────────────────────────────────
// Payment API Utilities — Midtrans Snap Integration
// ─────────────────────────────────────────────────────────────────────────────
import axios from './api.js';

const SNAP_BASE_URL = import.meta.env.VITE_MIDTRANS_SNAP_URL || '/api/midtrans';

/**
 * Create a Snap token for topup payment
 * @param {Object} params - { customerId, faceValue, sellPrice }
 * @returns {Promise<{ snapToken, snapUrl, orderId, topupNo }>}
 */
export async function createTopupSnap({ customerId, faceValue, sellPrice }) {
  const res = await axios.post('/api/customers/topup-snap', {
    customerId,
    faceValue,
    sellPrice,
  });
  if (!res?.data?.success) {
    throw new Error(res?.data?.message || 'Gagal membuat link pembayaran');
  }
  return res.data.data;
}

/**
 * Open Midtrans Snap popup
 * @param {string} snapToken - Snap token from createTopupSnap
 * @returns {Promise<{ status: 'settlement' | 'pending' | 'close' | 'error' }>}
 */
export function openSnapPopup(snapToken) {
  return new Promise((resolve) => {
    // Check if snap.js is loaded
    if (typeof window.snap === 'undefined') {
      console.warn('[paymentApi] Midtrans Snap.js not loaded');
      // Load snap.js dynamically
      const script = document.createElement('script');
      script.src = SNAP_BASE_URL.replace('/api/midtrans', '') + '/snap/snap.js';
      script.setAttribute('data-client-key', import.meta.env.VITE_MIDTRANS_CLIENT_KEY || '');
      document.head.appendChild(script);
      script.onload = () => {
        window.snap.pay(snapToken, {
          onSuccess: () => resolve({ status: 'settlement' }),
          onPending: () => resolve({ status: 'pending' }),
          onClose: () => resolve({ status: 'close' }),
          onError: () => resolve({ status: 'error' }),
        });
      };
      script.onerror = () => resolve({ status: 'error' });
      return;
    }

    window.snap.pay(snapToken, {
      onSuccess: () => resolve({ status: 'settlement' }),
      onPending: () => resolve({ status: 'pending' }),
      onClose: () => resolve({ status: 'close' }),
      onError: () => resolve({ status: 'error' }),
    });
  });
}

/**
 * Check payment status from backend
 * @param {string} orderId - Order ID from Midtrans
 * @param {boolean} forceRefresh - Force refresh from Midtrans API
 * @returns {Promise<{ status: 'settlement' | 'pending' | 'failed' | 'expire' }>}
 */
export async function getPaymentStatus(orderId, forceRefresh = false) {
  try {
    const res = await axios.get(`/api/midtrans/status/${orderId}`, {
      params: { force: forceRefresh },
    });
    return res?.data?.data || { status: 'unknown' };
  } catch (err) {
    console.error('[paymentApi] getPaymentStatus error:', err);
    return { status: 'error' };
  }
}

/**
 * Get Snap URL for sharing (without popup)
 * @param {string} snapToken - Snap token
 * @returns {string} Snap redirect URL
 */
export function getSnapRedirectUrl(snapToken) {
  const baseUrl = SNAP_BASE_URL.replace('/api/midtrans', '');
  return `${baseUrl}/v2/transactions/${snapToken}/redirect`;
}
