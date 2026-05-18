import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { listTargets, getTargetProgress, upsertTarget, deleteTarget } from '../controllers/targetController.js';

const router = Router();

// GET /api/targets/progress — capaian bulan ini untuk outlet kasir/frontliner
router.get('/progress', authenticate, getTargetProgress);

// GET /api/targets — daftar semua target (admin, dengan filter outlet/tahun/bulan)
router.get('/', authenticate, requireRole('admin', 'superadmin', 'finance', 'owner'), listTargets);

// POST /api/targets — buat atau update target (upsert by outlet+year+month)
router.post('/', authenticate, requireRole('admin', 'superadmin', 'finance', 'owner'), upsertTarget);

// DELETE /api/targets/:id — hapus target
router.delete('/:id', authenticate, requireRole('admin', 'superadmin', 'finance', 'owner'), deleteTarget);

export default router;
