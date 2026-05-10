import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
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

// GET /api/transactions/production/queue — antrian produksi
router.get('/production/queue', authenticate, getProductionQueue);

// GET /api/transactions/:id — detail transaksi
router.get('/:id', authenticate, getTransactionById);

// PUT /api/transactions/:id/status — update status transaksi
router.put('/:id/status', authenticate, updateTransactionStatus);

// POST /api/transactions/checkout — buat nota baru dengan DB transaction
router.post('/checkout', authenticate, checkoutTransaction);

// POST /api/transactions/:id/payments — pelunasan / pembayaran lanjutan (kasir & admin)
router.post('/:id/payments', authenticate, recordTransactionPayment);

// PATCH /api/transactions/:id/cancel — batalkan transaksi
router.patch('/:id/cancel', authenticate, cancelTransaction);

// PATCH /api/transactions/:id/production-stage — catat progress produksi
router.patch('/:id/production-stage', authenticate, updateProductionStage);

// POST /api/transactions/:id/condition — catat kondisi pakaian
router.post('/:id/condition', authenticate, saveItemCondition);

// POST /api/transactions/:id/review — submit review
router.post('/:id/review', authenticate, saveReview);

// POST /api/transactions/:id/request-approval — ajukan pembatalan/penghapusan via approval
router.post('/:id/request-approval', authenticate, requestApproval);

export default router;
