import { Router } from 'express';
import { authenticate, requireActiveShift, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter, searchLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import { validateCustomerCreate, validateCustomerUpdate } from '../schemas/validationSchemas.js';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, topupDeposit, upgradeToPremium, downgradeFromPremium, lookupCustomers, exportCustomerTransactions, getCustomerFavoriteServices, updateCustomerFavoriteService, removeCustomerFavoriteService } from '../controllers/customerController.js';

const router = Router();

// Role guards
const FRONTLINER = ['frontline'];
const ADMIN = ['admin'];

// Invalidate cache customers kalau ada mutasi
const invalidateCustomers = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/customers*');
    }
  });
  next();
};

// GET /api/customers - paginated list — cache 30 detik
router.get('/', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getCustomers);

// GET /api/customers/lookup?q=... — autocomplete, cache 60 detik (per query)
router.get('/lookup', authenticate, cacheResponse({ ttl: 60_000 }), searchLimiter, lookupCustomers);

// POST /api/customers - Tambah pelanggan baru
// Validation: Zod schema validates name, phone, email, gender, address fields
router.post('/', authenticate, writeLimiter, invalidateCustomers, validateCustomerCreate, createCustomer);

// GET /api/customers/:id — detail satu pelanggan, cache 30 detik
router.get('/:id', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getCustomerById);

// GET /api/customers/:id/transactions/export — export transaksi customer (Excel/PDF) (admin only)
router.get('/:id/transactions/export', authenticate, requireRole(...ADMIN), readLimiter, exportCustomerTransactions);

// GET /api/customers/:id/favorite-services — layanan favorit customer
router.get('/:id/favorite-services', authenticate, readLimiter, getCustomerFavoriteServices);

// PUT /api/customers/:id/favorite-services — update pin layanan favorit
router.put('/:id/favorite-services', authenticate, writeLimiter, updateCustomerFavoriteService);

// DELETE /api/customers/:id/favorite-services/:serviceId — hapus dari favorit
router.delete('/:id/favorite-services/:serviceId', authenticate, writeLimiter, removeCustomerFavoriteService);

// POST /api/customers/:id/topup — top up saldo deposit customer (audit-sensitive)
router.post('/:id/topup', authenticate, requireActiveShift, writeLimiter, invalidateCustomers, topupDeposit);

// POST /api/customers/:id/upgrade — upgrade customer ke member premium (kasir only)
router.post('/:id/upgrade', authenticate, requireRole(...FRONTLINER), writeLimiter, invalidateCustomers, upgradeToPremium);

// POST /api/customers/:id/downgrade — turunkan customer dari member premium (admin only)
router.post('/:id/downgrade', authenticate, requireRole(...ADMIN), writeLimiter, invalidateCustomers, downgradeFromPremium);

// PUT /api/customers/:id - Update pelanggan
// Validation: Zod schema validates all optional update fields
router.put('/:id', authenticate, writeLimiter, invalidateCustomers, validateCustomerUpdate, updateCustomer);

// DELETE /api/customers/:id - Delete (Soft) pelanggan (admin only)
router.delete('/:id', authenticate, requireRole(...ADMIN), writeLimiter, invalidateCustomers, deleteCustomer);

export default router;
