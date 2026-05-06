import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getCustomers, createCustomer, topupDeposit } from '../controllers/customerController.js';

const router = Router();

// GET /api/customers - Ambil semua pelanggan aktif
router.get('/', authenticate, getCustomers);

// POST /api/customers - Tambah pelanggan baru
router.post('/', authenticate, createCustomer);

// POST /api/customers/:id/topup — top up saldo deposit customer
router.post('/:id/topup', authenticate, topupDeposit);

export default router;
