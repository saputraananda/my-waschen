import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getOutletDetail, getOutletTeam, getOutletKasBalance } from '../controllers/outletController.js';

const router = Router();

// GET /api/outlets/:id
router.get('/:id', authenticate, getOutletDetail);

// GET /api/outlets/:id/team
router.get('/:id/team', authenticate, getOutletTeam);

// GET /api/outlets/:id/kas
router.get('/:id/kas', authenticate, getOutletKasBalance);

export default router;
