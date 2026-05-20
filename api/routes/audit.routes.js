import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getAuditLog, getAuditActions } from '../controllers/auditController.js';

const router = Router();

// Hanya role global yang bisa lihat audit log
const adminOnly = requireRole('admin', 'superadmin', 'owner', 'finance');

router.get('/',         authenticate, adminOnly, getAuditLog);
router.get('/actions',  authenticate, adminOnly, getAuditActions);

export default router;
