import { Router } from 'express';
import { authenticate, requireSameOutlet } from '../middleware/auth.js';
import { getOutletDetail, getOutletTeam, getOutletKasBalance } from '../controllers/outletController.js';
import { getOutlets } from '../controllers/masterController.js';

const router = Router();

// GET /api/outlets — daftar outlet (alias kompatibel; client lama / cache masih memanggil path ini)
router.get('/', authenticate, getOutlets);

// GET /api/outlets/:id
router.get('/:id', authenticate, requireSameOutlet, getOutletDetail);

// GET /api/outlets/:id/team
router.get('/:id/team', authenticate, requireSameOutlet, getOutletTeam);

// GET /api/outlets/:id/kas
router.get('/:id/kas', authenticate, requireSameOutlet, getOutletKasBalance);

export default router;
