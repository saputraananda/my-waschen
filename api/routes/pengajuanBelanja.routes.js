import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import {
  getCategories,
  createPengajuan,
  getPengajuans,
  getPengajuanById,
  approvePengajuan,
  rejectPengajuan,
  cancelPengajuan,
  getDashboard,
  getConfig,
} from '../controllers/pengajuanBelanjaController.js';

const router = Router();

// Cache invalidation helper
const invalidatePengajuan = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/pengajuan-belanja*');
    }
  });
  next();
};

// GET /api/pengajuan-belanja/config — get config
router.get('/config', authenticate, readLimiter, getConfig);

// GET /api/pengajuan-belanja/categories — list categories
router.get('/categories', authenticate, readLimiter, getCategories);

// GET /api/pengajuan-belanja/dashboard — dashboard summary
router.get('/dashboard', authenticate, requireRole('frontline', 'admin'), readLimiter, getDashboard);

// GET /api/pengajuan-belanja — list all pengajuan
router.get('/', authenticate, requireRole('frontline', 'admin'), readLimiter, getPengajuans);

// GET /api/pengajuan-belanja/:id — get pengajuan by ID
router.get('/:id', authenticate, requireRole('frontline', 'admin'), readLimiter, getPengajuanById);

// POST /api/pengajuan-belanja — create new pengajuan
router.post('/', authenticate, requireRole('frontline'), writeLimiter, invalidatePengajuan, createPengajuan);

// PATCH /api/pengajuan-belanja/:id/approve — approve pengajuan (admin only)
router.patch('/:id/approve', authenticate, requireRole('admin'), writeLimiter, invalidatePengajuan, approvePengajuan);

// PATCH /api/pengajuan-belanja/:id/reject — reject pengajuan (admin only)
router.patch('/:id/reject', authenticate, requireRole('admin'), writeLimiter, invalidatePengajuan, rejectPengajuan);

// PATCH /api/pengajuan-belanja/:id/cancel — cancel pengajuan (kasir or admin)
router.patch('/:id/cancel', authenticate, requireRole('frontline', 'admin'), writeLimiter, invalidatePengajuan, cancelPengajuan);

export default router;
