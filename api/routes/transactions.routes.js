import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  checkoutTransaction,
  getTransactions,
  getTransactionById,
  getDashboardStats,
  getProductionQueue,
  updateTransactionStatus,
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

export default router;
