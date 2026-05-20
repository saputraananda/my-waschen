import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, topupDeposit, upgradeToPremium, downgradeFromPremium, lookupCustomers } from '../controllers/customerController.js';

const router = Router();

// GET /api/customers - Ambil semua pelanggan aktif (paginated, searchable)
router.get('/', authenticate, getCustomers);

// GET /api/customers/lookup?q=... — fast autocomplete (untuk checkout)
router.get('/lookup', authenticate, lookupCustomers);

// POST /api/customers - Tambah pelanggan baru
router.post('/', authenticate, writeLimiter, createCustomer);

// GET /api/customers/:id — detail satu pelanggan
router.get('/:id', authenticate, getCustomerById);

// POST /api/customers/:id/topup — top up saldo deposit customer (audit-sensitive)
router.post('/:id/topup', authenticate, writeLimiter, topupDeposit);

// POST /api/customers/:id/upgrade — upgrade customer ke member premium
router.post('/:id/upgrade', authenticate, writeLimiter, upgradeToPremium);

// POST /api/customers/:id/downgrade — turunkan customer dari member premium
router.post('/:id/downgrade', authenticate, writeLimiter, downgradeFromPremium);

// PUT /api/customers/:id - Update pelanggan
router.put('/:id', authenticate, writeLimiter, updateCustomer);

// DELETE /api/customers/:id - Delete (Soft) pelanggan
router.delete('/:id', authenticate, writeLimiter, deleteCustomer);

export default router;
