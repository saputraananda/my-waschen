import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { approvalLimiter } from '../middleware/rateLimit.js';
import { getApprovals, resolveApproval, bulkResolveApprovals } from '../controllers/approvalController.js';

const router = Router();

// GET /api/approvals — list semua approval
router.get('/', authenticate, getApprovals);

// PUT /api/approvals/bulk — bulk approve/reject
router.put('/bulk', authenticate, approvalLimiter, bulkResolveApprovals);

// PUT /api/approvals/:id — approve atau reject single
router.put('/:id', authenticate, approvalLimiter, resolveApproval);

export default router;
