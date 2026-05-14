import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  checkoutTransaction,
  getTransactions,
  getTransactionById,
  recordTransactionPayment,
  getDashboardStats,
  getProductionQueue,
  updateTransactionStatus,
  cancelTransaction,
  updateProductionStage,
  saveItemCondition,
  saveReview,
  requestApproval,
} from '../controllers/transactionController.js';

const router = Router();

// GET /api/transactions — list transaksi
router.get('/', authenticate, getTransactions);

// GET /api/transactions/dashboard/stats — statistik dashboard
router.get('/dashboard/stats', authenticate, getDashboardStats);

// GET /api/transactions/production/queue — antrian produksi (kasir ikut baca; produksi/admin)
router.get('/production/queue', authenticate, requireRole('kasir', 'produksi', 'admin', 'finance'), getProductionQueue);

// GET /api/transactions/:id — detail transaksi
router.get('/:id', authenticate, getTransactionById);

// PUT /api/transactions/:id/status — update status transaksi
router.put('/:id/status', authenticate, updateTransactionStatus);

// POST /api/transactions/checkout — buat nota (kasir / admin / finance; bukan produksi)
router.post('/checkout', authenticate, requireRole('kasir', 'admin', 'finance'), checkoutTransaction);

// POST /api/transactions/:id/payments — pelunasan / pembayaran lanjutan (kasir & admin)
router.post('/:id/payments', authenticate, recordTransactionPayment);

// PATCH /api/transactions/:id/cancel — batalkan transaksi
router.patch('/:id/cancel', authenticate, cancelTransaction);

// PATCH /api/transactions/:id/production-stage — catat progress produksi
router.patch('/:id/production-stage', authenticate, requireRole('produksi', 'admin'), updateProductionStage);

// POST /api/transactions/:id/condition — catat kondisi pakaian
router.post('/:id/condition', authenticate, saveItemCondition);

// POST /api/transactions/:id/review — submit review
router.post('/:id/review', authenticate, saveReview);

// POST /api/transactions/:id/request-approval — ajukan pembatalan/penghapusan via approval
router.post('/:id/request-approval', authenticate, requestApproval);

export default router;
