import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getApprovals, resolveApproval } from '../controllers/approvalController.js';

const router = Router();

// GET /api/approvals — list semua approval
router.get('/', authenticate, getApprovals);

// PUT /api/approvals/:id — approve atau reject
router.put('/:id', authenticate, resolveApproval);

export default router;
