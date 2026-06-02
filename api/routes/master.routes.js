import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAwarenessSources, getAreaZones, getMaterials, getOutlets } from '../controllers/masterController.js';
import { cacheResponse } from '../middleware/cacheResponse.js';
import { readLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Master data jarang sekali berubah — TTL panjang (5 menit)
const masterCache = cacheResponse({ ttl: 5 * 60_000 });

// GET /api/master/awareness
router.get('/awareness', authenticate, masterCache, readLimiter, getAwarenessSources);

// GET /api/master/area-zones
router.get('/area-zones', authenticate, masterCache, readLimiter, getAreaZones);

// GET /api/master/materials
router.get('/materials', authenticate, masterCache, readLimiter, getMaterials);

// GET /api/master/outlets
router.get('/outlets', authenticate, masterCache, readLimiter, getOutlets);

export default router;
