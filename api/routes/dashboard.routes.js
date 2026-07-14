import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse } from '../middleware/cacheResponse.js';
import {
  getDashboardStats,
  getRevenueTrend,
  getSparkline,
  getTargetTracking,
  getOutletDashboard,
} from '../controllers/dashboardController.js';

const router = Router();

const ADMIN = requireRole('admin');

// GET /api/dashboard/stats — ringkasan statistik
// Cache 30s fresh, 2 menit stale (data dashboard tidak harus realtime)
// Stats di-invalidate saat ada mutasi transaksi via invalidatePattern di transactions routes.
router.get('/stats', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getDashboardStats);

// GET /api/dashboard/revenue-trend — Revenue trend chart: Aktual vs Target
router.get('/revenue-trend', authenticate, cacheResponse({ ttl: 60_000 }), readLimiter, getRevenueTrend);

// GET /api/dashboard/sparkline — Sparkline data for mini charts
router.get('/sparkline', authenticate, readLimiter, getSparkline);

// GET /api/dashboard/target-tracking — Monthly target with daily breakdown
router.get('/target-tracking', authenticate, readLimiter, getTargetTracking);

// GET /api/dashboard/outlets — List all outlets with dashboard summary (admin only)
router.get('/outlets', authenticate, ADMIN, cacheResponse({ ttl: 60_000 }), readLimiter, getOutletDashboard);

export default router;
