import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, approvalLimiter } from '../middleware/rateLimit.js';
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
  updateDeliveryType,
  updatePackingInfo,
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
router.put('/:id/status', authenticate, requireRole('kasir', 'produksi', 'admin'), writeLimiter, updateTransactionStatus);

// POST /api/transactions/checkout — buat nota (kasir / admin / finance; bukan produksi)
router.post('/checkout', authenticate, requireRole('kasir', 'admin', 'finance'), writeLimiter, checkoutTransaction);

// POST /api/transactions/:id/payments — pelunasan / pembayaran lanjutan (kasir & admin)
router.post('/:id/payments', authenticate, requireRole('kasir', 'admin', 'finance'), writeLimiter, recordTransactionPayment);

// PATCH /api/transactions/:id/cancel — batalkan transaksi
router.patch('/:id/cancel', authenticate, requireRole('kasir', 'admin'), approvalLimiter, cancelTransaction);

// PATCH /api/transactions/:id/production-stage — catat progress produksi
router.patch('/:id/production-stage', authenticate, requireRole('produksi', 'admin'), writeLimiter, updateProductionStage);

// POST /api/transactions/:id/condition — catat kondisi pakaian
router.post('/:id/condition', authenticate, writeLimiter, saveItemCondition);

// POST /api/transactions/:id/review — submit review
router.post('/:id/review', authenticate, writeLimiter, saveReview);

// POST /api/transactions/:id/request-approval — ajukan pembatalan/penghapusan via approval
router.post('/:id/request-approval', authenticate, approvalLimiter, requestApproval);

// PATCH /api/transactions/:id/delivery-type — ubah jenis pengiriman (self/pickup/delivery)
router.patch('/:id/delivery-type', authenticate, requireRole('kasir', 'admin'), writeLimiter, updateDeliveryType);

// PATCH /api/transactions/:id/items/:itemId/packing — set packing requirement (kasir) atau update packing_done (produksi)
router.patch('/:id/items/:itemId/packing', authenticate, requireRole('kasir', 'produksi', 'admin'), writeLimiter, updatePackingInfo);

export default router;
