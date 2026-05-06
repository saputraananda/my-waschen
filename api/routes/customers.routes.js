import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getCustomers, createCustomer } from '../controllers/customerController.js';

const router = Router();

// GET /api/customers - Ambil semua pelanggan aktif
router.get('/', authenticate, getCustomers);

// POST /api/customers - Tambah pelanggan baru
router.post('/', authenticate, createCustomer);

export default router;
