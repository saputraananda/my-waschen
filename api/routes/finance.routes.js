import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, approvalLimiter } from '../middleware/rateLimit.js';
import {
  getFinanceStats,
  getPayments,
  verifyPayment,
  bulkVerifyPayments,
  getRevenueRecap,
  getFinanceReport,
} from '../controllers/financeController.js';

const router = Router();

// GET /api/finance/stats — ringkasan omset & pending verifikasi
router.get('/stats', authenticate, requireRole('admin'), getFinanceStats);

// GET /api/finance/payments — daftar pembayaran transfer/QRIS
router.get('/payments', authenticate, requireRole('admin'), getPayments);

// PATCH /api/finance/payments/:id/verify — verifikasi pembayaran (single)
router.patch('/payments/:id/verify', authenticate, requireRole('admin'), writeLimiter, verifyPayment);

// PATCH /api/finance/payments/bulk-verify — verifikasi pembayaran (bulk)
router.patch('/payments/bulk-verify', authenticate, requireRole('admin'), approvalLimiter, bulkVerifyPayments);

// GET /api/finance/revenue-recap — rekap pendapatan paginated
router.get('/revenue-recap', authenticate, requireRole('admin'), getRevenueRecap);

// GET /api/finance/report — laporan keuangan per periode
router.get('/report', authenticate, requireRole('admin'), getFinanceReport);

export default router;
