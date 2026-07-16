// ─────────────────────────────────────────────────────────────────────────────
// production.routes.js — Production Item Unit Routes
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadItemUnitPhoto } from '../controllers/productionItemUnitController.js';

const router = Router();

// POST /api/production/item-unit/:id/photo — Upload photo for PAP
// PERUBAHAN: Hanya role 'produksi' yang boleh upload foto hasil laundry
router.post('/item-unit/:id/photo', authenticate, requireRole('produksi'), uploadItemUnitPhoto);

export default router;
