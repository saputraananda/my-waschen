import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse } from '../middleware/cacheResponse.js';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = Router();

// GET /api/dashboard/stats — ringkasan statistik
// Cache 30s fresh, 2 menit stale (data dashboard tidak harus realtime)
// Stats di-invalidate saat ada mutasi transaksi via invalidatePattern di transactions routes.
router.get('/stats', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getDashboardStats);

export default router;
