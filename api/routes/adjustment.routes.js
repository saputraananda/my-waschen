import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import {
  createAdjustment,
  getAdjustments,
  getAdjustmentById,
  getAdjustmentByTransactionId,
  getAdjustmentAuditTrail,
  approveAdjustment,
  rejectAdjustment,
  rollbackAdjustment,
} from '../controllers/adjustmentController.js';

const router = Router();

// Invalidate cache when adjustments are made
const invalidateAdjustments = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/adjustments*');
      invalidatePattern('GET:/api/transactions*');
    }
  });
  next();
};

// GET /api/adjustments — list all adjustments
router.get('/', authenticate, requireRole('frontline', 'admin'), readLimiter, getAdjustments);

// GET /api/adjustments/audit — audit trail for admin
router.get('/audit', authenticate, requireRole('admin'), readLimiter, getAdjustmentAuditTrail);

// GET /api/adjustments/:id — get adjustment by ID
router.get('/:id', authenticate, requireRole('frontline', 'admin'), readLimiter, getAdjustmentById);

// GET /api/adjustments/transaction/:transactionId — get adjustments for a transaction
router.get('/transaction/:transactionId', authenticate, requireRole('frontline', 'admin'), readLimiter, getAdjustmentByTransactionId);

// POST /api/adjustments — create new adjustment
router.post('/', authenticate, requireRole('frontline', 'admin'), writeLimiter, invalidateAdjustments, createAdjustment);

// PATCH /api/adjustments/:id/approve — approve adjustment (admin only)
router.patch('/:id/approve', authenticate, requireRole('admin'), writeLimiter, invalidateAdjustments, approveAdjustment);

// PATCH /api/adjustments/:id/reject — reject adjustment (admin only)
router.patch('/:id/reject', authenticate, requireRole('admin'), writeLimiter, invalidateAdjustments, rejectAdjustment);

// PATCH /api/adjustments/:id/rollback — rollback adjustment (admin only)
router.patch('/:id/rollback', authenticate, requireRole('admin'), writeLimiter, invalidateAdjustments, rollbackAdjustment);

export default router;
