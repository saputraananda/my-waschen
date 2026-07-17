// ─────────────────────────────────────────────────────────────────────────────
// production.routes.js — Production Item Unit Routes
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  updateItemUnitStatus,
  getItemUnitDetail,
  uploadItemUnitPhoto,
} from '../controllers/productionItemUnitController.js';

const router = Router();

// PUT /api/production/item-unit/:id/status — Update production status
// PERUBAHAN: Role 'produksi' atau 'admin' boleh update status
router.put('/item-unit/:id/status', authenticate, updateItemUnitStatus);

// GET /api/production/item-unit/:id — Get item unit detail
router.get('/item-unit/:id', authenticate, getItemUnitDetail);

// POST /api/production/item-unit/:id/photo — Upload photo for PAP
// PERUBAHAN: Hanya role 'produksi' yang boleh upload foto hasil laundry
router.post('/item-unit/:id/photo', authenticate, requireRole('produksi'), uploadItemUnitPhoto);

export default router;
