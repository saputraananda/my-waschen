// ─────────────────────────────────────────────────────────────────────────────
// dashboardIntelligence.routes.js — Phase 4: Dashboard Intelligence API Routes
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse } from '../middleware/cacheResponse.js';
import {
  getLowStockAlerts,
  getOutletComparison,
  getDailyTargetProgress,
  getDashboardMetrics,
} from '../controllers/dashboardIntelligenceController.js';

const router = Router();

const ADMIN = requireRole('admin');

// GET /api/dashboard-intelligence/low-stock — Low stock alerts
router.get('/low-stock', authenticate, cacheResponse({ ttl: 60_000 }), readLimiter, getLowStockAlerts);

// GET /api/dashboard-intelligence/outlet-comparison — Outlet comparison data
router.get('/outlet-comparison', authenticate, ADMIN, cacheResponse({ ttl: 60_000 }), readLimiter, getOutletComparison);

// GET /api/dashboard-intelligence/target-daily — Daily target progress per outlet
router.get('/target-daily', authenticate, ADMIN, cacheResponse({ ttl: 60_000 }), readLimiter, getDailyTargetProgress);

// GET /api/dashboard-intelligence/metrics — Transaction metrics summary
router.get('/metrics', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getDashboardMetrics);

export default router;
