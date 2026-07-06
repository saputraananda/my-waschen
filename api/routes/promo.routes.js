import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { getPromos, createPromo, patchPromo } from '../controllers/promoController.js';
import { validatePromoCreate } from '../schemas/validationSchemas.js';

const router = Router();

router.get('/', authenticate, getPromos);
// Validation: Zod schema validates code, name, type, value, promo_type, dates
router.post('/', authenticate, requireRole('admin', 'finance', 'superadmin', 'owner'), validatePromoCreate, createPromo);
router.patch('/:id', authenticate, requireRole('admin', 'finance', 'superadmin', 'owner'), patchPromo);

export default router;
