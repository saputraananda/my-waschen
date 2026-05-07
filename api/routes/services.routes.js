import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getServices, createService, toggleService, updateService, deleteService } from '../controllers/serviceController.js';

const router = Router();

// GET /api/services - Ambil layanan (filtered per outlet)
router.get('/', authenticate, getServices);

// POST /api/services - Tambah layanan baru
router.post('/', authenticate, createService);

// PATCH /api/services/:id/toggle - Toggle status aktif/nonaktif
router.patch('/:id/toggle', authenticate, toggleService);

// PUT /api/services/:id - Update layanan
router.put('/:id', authenticate, updateService);

// DELETE /api/services/:id - Delete layanan
router.delete('/:id', authenticate, deleteService);

export default router;
