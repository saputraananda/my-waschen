import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { getPromos, createPromo, patchPromo, getAutoApplicablePromos } from '../controllers/promoController.js';
import { validatePromoCreate } from '../schemas/validationSchemas.js';

const router = Router();

router.get('/', authenticate, getPromos);
// Auto-applicable promos based on services/customer
router.get('/auto-applicable', authenticate, getAutoApplicablePromos);
// Validation: Zod schema validates code, name, type, value, promo_type, dates
router.post('/', authenticate, requireRole('admin'), validatePromoCreate, createPromo);
router.patch('/:id', authenticate, requireRole('admin'), patchPromo);

export default router;
