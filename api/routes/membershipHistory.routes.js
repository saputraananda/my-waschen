// ─────────────────────────────────────────────────────────────────────────────
// membershipHistory.routes.js — Membership History API Routes
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { getCustomerHistory, getAllHistory, getHistoryStats } from '../controllers/membershipHistoryController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/membership-history/:customerId - Get customer membership history
router.get('/:customerId', getCustomerHistory);

// GET /api/membership-history - Get all history (admin)
router.get('/', getAllHistory);

// GET /api/membership-history/stats - Get history statistics (admin)
router.get('/stats', getHistoryStats);

export default router;
