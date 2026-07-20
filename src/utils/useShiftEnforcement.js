/**
 * useShiftEnforcement — hook global untuk cek shift dan handle 403 SHIFT_CLOSED.
 *
 * Fungsi:
 * 1. Cek status shift saat init dan saat user navigasi ke halaman keuangan.
 * 2. Intercept API response 403 SHIFT_CLOSED → tampilkan modal prompt.
 * 3. Provide method untuk navigate ke buka shift.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

const CASHIER_ROLES = new Set(['frontline']);

export function useShiftEnforcement({ onShiftRequired }) {
  const [shiftOpen, setShiftOpen] = useState(null); // null = belum dicek
  const interceptorRef = useRef(null);

  // ── Cek status shift dari server ────────────────────────────────────────
  const checkShift = useCallback(async () => {
    try {
      const res = await axios.get('/api/shifts/status');
      const data = res?.data;
      const isOpen = data?.isOpen === true || data?.bypass === true;
      setShiftOpen(isOpen);
      return isOpen;
    } catch {
      setShiftOpen(false);
      return false;
    }
  }, []);

  // ── Pasang axios interceptor untuk tangkap 403 SHIFT_CLOSED ────────────────
  useEffect(() => {
    // Remove existing interceptor
    if (interceptorRef.current != null) {
      axios.interceptors.response.eject(interceptorRef.current);
    }

    interceptorRef.current = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error?.response?.status;
        const code = error?.response?.data?.code;
        const message = error?.response?.data?.message;

        if (status === 403 && code === 'SHIFT_CLOSED') {
          // Trigger modal prompt
          if (onShiftRequired) {
            onShiftRequired(message || 'Buka shift terlebih dahulu untuk melakukan transaksi ini.');
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      if (interceptorRef.current != null) {
        axios.interceptors.response.eject(interceptorRef.current);
        interceptorRef.current = null;
      }
    };
  }, [onShiftRequired]);

  return { shiftOpen, checkShift };
}

// ─── Route definitions yang butuh shift aktif ─────────────────────────────────
export const FINANCIAL_SCREENS = new Set([
  'nota_step1', 'nota_step2', 'nota_step3', 'nota_berhasil',
  'detail_transaksi', 'pelunasan', 'topup_deposit',
  'kas_outlet', 'kasir_shift',
]);

/**
 * Check apakah screen saat ini butuh shift aktif.
 * Cashier roles (kasir/frontline) → perlu shift.
 * Frontliner roles → perlu shift.
 * Admin/produksi → tidak perlu (bypass).
 */
export function screenNeedsShift(user, screen) {
  if (!user) return false;
  if (!CASHIER_ROLES.has(user.roleCode)) return false; // non-cashier bypass
  return FINANCIAL_SCREENS.has(screen);
}
