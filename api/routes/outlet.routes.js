import { Router } from 'express';
import { authenticate, requireSameOutlet } from '../middleware/auth.js';
import { getOutletDetail, getOutletTeam, getOutletKasBalance, getOutletsAdmin, updateOutlet, toggleOutletActive, createOutlet, deleteOutlet } from '../controllers/outletController.js';
import { getOutlets } from '../controllers/masterController.js';

const router = Router();

// GET /api/outlets — daftar outlet (alias kompatibel; client lama / cache masih memanggil path ini)
router.get('/', authenticate, getOutlets);

// GET /api/outlets/admin/all — admin: semua outlet + stats (termasuk nonaktif)
router.get('/admin/all', authenticate, getOutletsAdmin);

// POST /api/outlets — admin: buat outlet baru
router.post('/', authenticate, createOutlet);

// PUT /api/outlets/:id — admin: update outlet
router.put('/:id', authenticate, updateOutlet);

// PATCH /api/outlets/:id/toggle — admin: toggle aktif/nonaktif
router.patch('/:id/toggle', authenticate, toggleOutletActive);

// DELETE /api/outlets/:id — admin: soft delete outlet
router.delete('/:id', authenticate, deleteOutlet);

// GET /api/outlets/:id
router.get('/:id', authenticate, requireSameOutlet, getOutletDetail);

// GET /api/outlets/:id/team
router.get('/:id/team', authenticate, requireSameOutlet, getOutletTeam);

// GET /api/outlets/:id/kas
router.get('/:id/kas', authenticate, requireSameOutlet, getOutletKasBalance);

export default router;
