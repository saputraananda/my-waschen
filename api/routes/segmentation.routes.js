// ─────────────────────────────────────────────────────────────────────────────
// segmentation.routes.js — Customer Segmentation API Routes
// Phase 5-7: Customer Segmentation
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse } from '../middleware/cacheResponse.js';
import {
  getSegmentationOverview,
  getSegmentedCustomers,
  getVIPInsights,
  getSegmentationTiers,
} from '../controllers/customerSegmentationController.js';

const router = Router();

const ADMIN = requireRole('admin');

// GET /api/segmentation/tiers — Loyalty & Membership tier definitions (public info)
router.get('/tiers', authenticate, readLimiter, getSegmentationTiers);

// GET /api/segmentation/overview — Customer segmentation overview (admin only)
router.get('/overview', authenticate, ADMIN, cacheResponse({ ttl: 60000 }), readLimiter, getSegmentationOverview);

// GET /api/segmentation/customers — List customers by segment (admin only)
router.get('/customers', authenticate, ADMIN, cacheResponse({ ttl: 60000 }), readLimiter, getSegmentedCustomers);

// GET /api/segmentation/vip-insights — VIP, At-Risk, and Potential insights (admin only)
router.get('/vip-insights', authenticate, ADMIN, cacheResponse({ ttl: 30000 }), readLimiter, getVIPInsights);

export default router;
