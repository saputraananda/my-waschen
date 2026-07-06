// ─────────────────────────────────────────────────────────────────────────────
// error.routes.js — Error Tracking API Routes
// Phase 8: Technical Debt & Optimization
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import {
  logFrontendError,
  getErrorLogs,
  getErrorStats,
  resolveError,
  updateErrorStatus,
} from '../controllers/errorTrackingController.js';

const router = Router();

const ADMIN_ROLES = requireRole('admin', 'superadmin', 'owner');

// POST /api/errors/log — Log error from frontend (public but authenticated preferred)
router.post('/log', logFrontendError);

// GET /api/errors — Get error logs (admin only)
router.get('/', authenticate, ADMIN_ROLES, readLimiter, getErrorLogs);

// GET /api/errors/stats — Get error statistics (admin only)
router.get('/stats', authenticate, ADMIN_ROLES, readLimiter, getErrorStats);

// PATCH /api/errors/:id/resolve — Mark error as resolved
router.patch('/:id/resolve', authenticate, ADMIN_ROLES, resolveError);

// PATCH /api/errors/:id — Update error status
router.patch('/:id', authenticate, ADMIN_ROLES, updateErrorStatus);

export default router;
