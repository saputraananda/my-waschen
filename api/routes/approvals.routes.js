import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { approvalLimiter } from '../middleware/rateLimit.js';
import { getApprovals, resolveApproval, bulkResolveApprovals } from '../controllers/approvalController.js';

const router = Router();

// Role guard - only admin can access approvals
const canAccessApproval = requireRole('admin');

// GET /api/approvals — list semua approval
router.get('/', authenticate, canAccessApproval, getApprovals);

// PUT /api/approvals/bulk — bulk approve/reject
router.put('/bulk', authenticate, canAccessApproval, approvalLimiter, bulkResolveApprovals);

// PUT /api/approvals/:id — approve atau reject single
router.put('/:id', authenticate, canAccessApproval, approvalLimiter, resolveApproval);

export default router;
