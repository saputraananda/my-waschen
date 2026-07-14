// ─────────────────────────────────────────────────────────────────────────────
// production.routes.js — Production Item Unit Routes
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadItemUnitPhoto } from '../controllers/productionItemUnitController.js';

const router = Router();

// POST /api/production/item-unit/:id/photo — Upload photo for PAP
router.post('/item-unit/:id/photo', authenticate, requireRole('produksi', 'admin', 'frontline'), uploadItemUnitPhoto);

export default router;
