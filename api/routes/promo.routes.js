import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { getPromos, createPromo, patchPromo } from '../controllers/promoController.js';

const router = Router();

router.get('/', authenticate, getPromos);
router.post('/', authenticate, requireRole('admin', 'finance', 'superadmin', 'owner'), createPromo);
router.patch('/:id', authenticate, requireRole('admin', 'finance', 'superadmin', 'owner'), patchPromo);

export default router;
