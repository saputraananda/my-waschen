import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import {
  createOutstanding,
  getOutstandings,
  getOutstandingById,
  recordPayment,
  sendReminder,
  writeOffOutstanding,
  getOutstandingDashboard,
} from '../controllers/outstandingController.js';

const router = Router();

// Cache invalidation helper
const invalidateOutstandings = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/outstandings*');
      invalidatePattern('GET:/api/outstanding/dashboard*');
    }
  });
  next();
};

// GET /api/outstandings/dashboard — dashboard summary (HARUS DI ATAS SEBELUM /:id)
router.get('/dashboard', authenticate, requireRole('frontline', 'admin'), readLimiter, getOutstandingDashboard);

// GET /api/outstandings/:id — get outstanding by ID (HARUS DI BAWAH /dashboard)
router.get('/:id', authenticate, requireRole('frontline', 'admin'), readLimiter, getOutstandingById);

// GET /api/outstandings — list all outstandings
router.get('/', authenticate, requireRole('frontline', 'admin'), readLimiter, getOutstandings);

// POST /api/outstandings — create new outstanding
router.post('/', authenticate, requireRole('frontline', 'admin'), writeLimiter, invalidateOutstandings, createOutstanding);

// POST /api/outstandings/:id/payment — record payment
router.post('/:id/payment', authenticate, requireRole('frontline', 'admin'), writeLimiter, invalidateOutstandings, recordPayment);

// POST /api/outstandings/:id/reminder — send reminder
router.post('/:id/reminder', authenticate, requireRole('frontline', 'admin'), writeLimiter, invalidateOutstandings, sendReminder);

// PATCH /api/outstandings/:id/close — write off (admin only)
router.patch('/:id/close', authenticate, requireRole('admin'), writeLimiter, invalidateOutstandings, writeOffOutstanding);

export default router;
