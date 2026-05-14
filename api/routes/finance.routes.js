import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getFinanceStats,
  getPayments,
  verifyPayment,
  getRevenueRecap,
  getFinanceReport,
} from '../controllers/financeController.js';

const router = Router();

// GET /api/finance/stats — ringkasan omset & pending verifikasi
router.get('/stats', authenticate, requireRole('admin', 'finance'), getFinanceStats);

// GET /api/finance/payments — daftar pembayaran transfer/QRIS
router.get('/payments', authenticate, requireRole('admin', 'finance'), getPayments);

// PATCH /api/finance/payments/:id/verify — verifikasi pembayaran
router.patch('/payments/:id/verify', authenticate, requireRole('admin', 'finance'), verifyPayment);

// GET /api/finance/revenue-recap — rekap pendapatan paginated
router.get('/revenue-recap', authenticate, requireRole('admin', 'finance'), getRevenueRecap);

// GET /api/finance/report — laporan keuangan per periode
router.get('/report', authenticate, requireRole('admin', 'finance'), getFinanceReport);

export default router;
