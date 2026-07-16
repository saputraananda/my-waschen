// ─────────────────────────────────────────────────────────────────────────────
// refund.routes.js — Refund Workflow API Routes
// Phase 5-7: Refund Workflows
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import {
  listRefunds,
  getRefundById,
  createRefund,
  approveRefund,
  rejectRefund,
  processRefund,
  cancelRefund,
  getRefundStats,
} from '../controllers/refundController.js';

const router = Router();

const ADMIN = requireRole('admin');

// Invalidate cache on refund mutations
const invalidateRefunds = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/refunds*');
    }
  });
  next();
};

// GET /api/refunds/stats — Refund statistics
router.get('/stats', authenticate, ADMIN, getRefundStats);

// GET /api/refunds — List all refunds
router.get('/', authenticate, ADMIN, readLimiter, listRefunds);

// GET /api/refunds/:id — Get refund detail
router.get('/:id', authenticate, ADMIN, readLimiter, getRefundById);

// POST /api/refunds — Create new refund request
router.post('/', authenticate, ADMIN, invalidateRefunds, createRefund);

// POST /api/refunds/:id/approve — Approve refund request
router.post('/:id/approve', authenticate, ADMIN, invalidateRefunds, approveRefund);

// POST /api/refunds/:id/reject — Reject refund request
router.post('/:id/reject', authenticate, ADMIN, invalidateRefunds, rejectRefund);

// POST /api/refunds/:id/process — Process approved refund
router.post('/:id/process', authenticate, ADMIN, invalidateRefunds, processRefund);

// POST /api/refunds/:id/cancel — Cancel refund request
router.post('/:id/cancel', authenticate, ADMIN, invalidateRefunds, cancelRefund);

export default router;
