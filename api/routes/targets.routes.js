import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import {
  listTargets, getTargetProgress, upsertTarget, deleteTarget,
  getDailyProgress, getTodaySummary,
} from '../controllers/targetController.js';

const router = Router();

const ADMIN = requireRole('admin');

// Invalidate cache target setiap kali ada mutasi (upsert/delete)
const invalidateTargets = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/targets*');
    }
  });
  next();
};

// GET /api/targets/progress — capaian bulan ini untuk outlet kasir/frontliner
router.get('/progress', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getTargetProgress);

// GET /api/targets/today-summary — widget capaian hari ini (kasir dashboard)
router.get('/today-summary', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getTodaySummary);

// GET /api/targets/daily-progress — breakdown harian (admin & kasir untuk outlet sendiri)
router.get('/daily-progress', authenticate, cacheResponse({ ttl: 60_000 }), readLimiter, getDailyProgress);

// GET /api/targets — daftar semua target (admin)
router.get('/', authenticate, ADMIN, cacheResponse({ ttl: 60_000 }), readLimiter, listTargets);

// POST /api/targets — upsert (auto-invalidate cache)
router.post('/', authenticate, ADMIN, invalidateTargets, upsertTarget);

// DELETE /api/targets/:id (auto-invalidate cache)
router.delete('/:id', authenticate, ADMIN, invalidateTargets, deleteTarget);

export default router;
