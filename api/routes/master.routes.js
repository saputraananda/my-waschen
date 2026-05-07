import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAwarenessSources, getAreaZones, getMaterials } from '../controllers/masterController.js';

const router = Router();

// GET /api/master/awareness
router.get('/awareness', authenticate, getAwarenessSources);

// GET /api/master/area-zones
router.get('/area-zones', authenticate, getAreaZones);

// GET /api/master/materials
router.get('/materials', authenticate, getMaterials);

export default router;
