import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import {
  submitRequest, getRequests, resolveRequest, getSummary, resubmitRequest,
} from '../controllers/purchaseRequestController.js';

const router = Router();

const invalidate = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/purchase-requests*');
      // Stok berubah saat approve — invalidate inventory cache juga
      invalidatePattern('GET:/api/inventory*');
    }
  });
  next();
};

// Kasir submit & resubmit
router.post('/', authenticate, requireRole('frontline'), writeLimiter, invalidate, submitRequest);
router.patch('/:id/resubmit', authenticate, requireRole('frontline'), writeLimiter, invalidate, resubmitRequest);

// Admin view summary (harus di atas /:id biar tidak tertangkap dynamic route)
router.get('/summary', authenticate, requireRole('admin'), cacheResponse({ ttl: 30_000 }), readLimiter, getSummary);

// Daftar (kasir & admin)
router.get('/', authenticate, cacheResponse({ ttl: 15_000 }), readLimiter, getRequests);

// Admin resolve (approve/revise/reject/fulfill/cancel)
router.patch('/:id', authenticate, requireRole('admin'), writeLimiter, invalidate, resolveRequest);

export default router;
