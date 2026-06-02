// ─────────────────────────────────────────────────────────────────────────────
// Payment routes — Midtrans gateway
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter, publicLimiter } from '../middleware/rateLimit.js';
import {
  getPaymentConfig,
  chargeTransaction,
  getPaymentStatus,
  syncPaymentStatus,
  cancelPayment,
  createTopupSnap,
  getTransactionPayments,
  getPaymentReport,
  getPaymentHealth,
} from '../controllers/paymentController.js';

const router = Router();

// Config publik (client key, isProduction)
router.get('/config', authenticate, getPaymentConfig);

// Charge — kasir & frontline
router.post('/charge', authenticate, requireRole('kasir', 'frontline', 'admin', 'finance'), writeLimiter, chargeTransaction);

// Status & list — semua role yang akses transaksi
router.get('/status/:orderId', authenticate, readLimiter, getPaymentStatus);

// Manual sync (tombol "Cek Status" di QrPaymentPage)
// HANYA endpoint ini yang boleh hit Midtrans GET status API langsung.
// Frontend wajib pakai cooldown 10 detik agar tidak spam.
router.get('/sync/:orderId', authenticate, writeLimiter, syncPaymentStatus);

router.get('/transactions/:txId', authenticate, readLimiter, getTransactionPayments);

// Cancel pending
router.post('/cancel/:orderId', authenticate, requireRole('kasir', 'frontline', 'admin', 'finance'), writeLimiter, cancelPayment);

// Topup via Snap
router.post('/topup/snap', authenticate, requireRole('kasir', 'frontline', 'admin', 'finance'), writeLimiter, createTopupSnap);

// Report — admin & finance & kasir
router.get('/report', authenticate, requireRole('admin', 'superadmin', 'owner', 'finance', 'kasir', 'frontline'), readLimiter, getPaymentReport);

// Internal health check (admin only)
router.get('/health', authenticate, requireRole('admin', 'superadmin', 'owner'), getPaymentHealth);

export default router;
