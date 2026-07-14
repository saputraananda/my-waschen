import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
import {
  getMerges,
  getMergeById,
  createMerge,
  getMergeableTransactions,
  rollbackMerge,
} from '../controllers/mergeController.js';

const router = Router();

// GET /api/merges — list all merges
router.get('/', authenticate, requireRole('frontline', 'admin'), readLimiter, getMerges);

// GET /api/merges/transactions/:transactionId — get mergeable transactions
router.get('/transactions/:transactionId', authenticate, requireRole('frontline', 'admin'), readLimiter, getMergeableTransactions);

// GET /api/merges/:id — get merge by ID
router.get('/:id', authenticate, requireRole('frontline', 'admin'), readLimiter, getMergeById);

// POST /api/merges — create new merge
router.post('/', authenticate, requireRole('frontline', 'admin'), writeLimiter, createMerge);

// POST /api/merges/:id/rollback — rollback merge (admin only)
router.post('/:id/rollback', authenticate, requireRole('admin'), writeLimiter, rollbackMerge);

export default router;
