import { Router } from 'express';
import { getServices, createService, toggleService } from '../controllers/serviceController.js';

const router = Router();

// GET /api/services - Ambil semua layanan
router.get('/', getServices);

// POST /api/services - Tambah layanan baru
router.post('/', createService);

// PATCH /api/services/:id/toggle - Toggle status aktif/nonaktif
router.patch('/:id/toggle', toggleService);

export default router;
