import { Router } from 'express';
import { authenticate, canManageMasterData } from '../middleware/auth.js';
import { getServices, createService, toggleService, updateService, deleteService, togglePinService, toggleFavoriteService } from '../controllers/serviceController.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { validateServiceCreate } from '../schemas/validationSchemas.js';

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

// Mutasi master layanan (harga, satuan, dll.) — HANYA admin
// Kasir/frontline tidak boleh memodifikasi master data layanan (risiko fraud: ubah harga sebelum checkout)
// Validation: Zod schema validates name, category_id, price, unit, SLA hours
router.post('/', authenticate, canManageMasterData, invalidateServices, validateServiceCreate, createService);
router.put('/:id', authenticate, canManageMasterData, invalidateServices, updateService);
router.delete('/:id', authenticate, canManageMasterData, invalidateServices, deleteService);

// Toggle active/inactive — bisa diakses admin & kasir/frontliner (untuk kelola layanan di outlet mereka)
router.patch('/:id/toggle', authenticate, invalidateServices, toggleService);

// Pin/unpin service (bisa diakses admin & kasir/frontliner)
router.post('/:id/pin', authenticate, invalidateServices, togglePinService);

// Favorite/unfavorite service (untuk customer)
router.post('/:id/favorite', authenticate, invalidateServices, toggleFavoriteService);

export default router;
