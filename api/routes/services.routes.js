import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getServices, createService, toggleService, updateService, deleteService } from '../controllers/serviceController.js';

const router = Router();

// GET /api/services — kasir, produksi, admin (baca untuk nota / referensi)
router.get('/', authenticate, getServices);

// Mutasi master layanan (harga, satuan, dll.) — selaras Manajemen Layanan admin
const manageServices = requireRole('admin', 'finance');
router.post('/', authenticate, manageServices, createService);
router.patch('/:id/toggle', authenticate, manageServices, toggleService);
router.put('/:id', authenticate, manageServices, updateService);
router.delete('/:id', authenticate, manageServices, deleteService);

export default router;
