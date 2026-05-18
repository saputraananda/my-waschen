import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer, topupDeposit, upgradeToPremium, downgradeFromPremium } from '../controllers/customerController.js';

const router = Router();

// GET /api/customers - Ambil semua pelanggan aktif
router.get('/', authenticate, getCustomers);

// POST /api/customers - Tambah pelanggan baru
router.post('/', authenticate, createCustomer);

// GET /api/customers/:id — detail satu pelanggan
router.get('/:id', authenticate, getCustomerById);

// POST /api/customers/:id/topup — top up saldo deposit customer
router.post('/:id/topup', authenticate, topupDeposit);

// POST /api/customers/:id/upgrade — upgrade customer ke member premium
router.post('/:id/upgrade', authenticate, upgradeToPremium);

// POST /api/customers/:id/downgrade — turunkan customer dari member premium
router.post('/:id/downgrade', authenticate, downgradeFromPremium);

// PUT /api/customers/:id - Update pelanggan
router.put('/:id', authenticate, updateCustomer);

// DELETE /api/customers/:id - Delete (Soft) pelanggan
router.delete('/:id', authenticate, deleteCustomer);

export default router;
