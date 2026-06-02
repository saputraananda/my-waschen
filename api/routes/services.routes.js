import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getServices, createService, toggleService, updateService, deleteService, togglePinService, toggleFavoriteService } from '../controllers/serviceController.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import { readLimiter } from '../middleware/rateLimit.js';

const router = Router();

// Invalidate cache services kalau ada perubahan (helper inline)
const invalidateServices = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/services*');
    }
  });
  next();
};

// GET /api/services — kasir, produksi, admin (baca untuk nota / referensi)
// Cache 2 menit — data master jarang berubah
router.get('/', authenticate, cacheResponse({ ttl: 120_000 }), readLimiter, getServices);

// Mutasi master layanan (harga, satuan, dll.) — selaras Manajemen Layanan admin & kasir
const manageServices = requireRole('admin', 'finance', 'superadmin', 'owner', 'kasir', 'frontline');
router.post('/', authenticate, manageServices, invalidateServices, createService);
router.patch('/:id/toggle', authenticate, manageServices, invalidateServices, toggleService);
router.put('/:id', authenticate, manageServices, invalidateServices, updateService);
router.delete('/:id', authenticate, manageServices, invalidateServices, deleteService);

// Pin/unpin service (bisa diakses admin & kasir/frontliner)
router.post('/:id/pin', authenticate, invalidateServices, togglePinService);

// Favorite/unfavorite service (untuk customer)
router.post('/:id/favorite', authenticate, invalidateServices, toggleFavoriteService);

export default router;
