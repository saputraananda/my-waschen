import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter, readLimiter, searchLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, topupDeposit, upgradeToPremium, downgradeFromPremium, lookupCustomers } from '../controllers/customerController.js';

const router = Router();

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
router.post('/', authenticate, writeLimiter, invalidateCustomers, createCustomer);

// GET /api/customers/:id — detail satu pelanggan, cache 30 detik
router.get('/:id', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getCustomerById);

// POST /api/customers/:id/topup — top up saldo deposit customer (audit-sensitive)
router.post('/:id/topup', authenticate, writeLimiter, invalidateCustomers, topupDeposit);

// POST /api/customers/:id/upgrade — upgrade customer ke member premium
router.post('/:id/upgrade', authenticate, writeLimiter, invalidateCustomers, upgradeToPremium);

// POST /api/customers/:id/downgrade — turunkan customer dari member premium
router.post('/:id/downgrade', authenticate, writeLimiter, invalidateCustomers, downgradeFromPremium);

// PUT /api/customers/:id - Update pelanggan
router.put('/:id', authenticate, writeLimiter, invalidateCustomers, updateCustomer);

// DELETE /api/customers/:id - Delete (Soft) pelanggan
router.delete('/:id', authenticate, writeLimiter, invalidateCustomers, deleteCustomer);

export default router;
