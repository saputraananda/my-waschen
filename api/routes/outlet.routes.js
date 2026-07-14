import { Router } from 'express';
import { authenticate, requireSameOutlet, canManageMasterData } from '../middleware/auth.js';
import { getOutletDetail, getOutletTeam, getOutletKasBalance, getOutletsAdmin, updateOutlet, toggleOutletActive, createOutlet, deleteOutlet } from '../controllers/outletController.js';
import { getOutlets } from '../controllers/authController.js';
import { getBankAccountsByOutlet } from '../controllers/bankAccountController.js';

const router = Router();

// GET /api/outlets — daftar outlet (alias kompatibel; client lama / cache masih memanggil path ini)
router.get('/', authenticate, getOutlets);

// GET /api/outlets/:outletId/bank-accounts
router.get('/:outletId/bank-accounts', authenticate, requireSameOutlet, getBankAccountsByOutlet);

// GET /api/outlets/admin/all — admin: semua outlet + stats (termasuk nonaktif)
router.get('/admin/all', authenticate, canManageMasterData, getOutletsAdmin);

// POST /api/outlets — admin: buat outlet baru
router.post('/', authenticate, canManageMasterData, createOutlet);

// PUT /api/outlets/:id — admin: update outlet
router.put('/:id', authenticate, canManageMasterData, updateOutlet);

// PATCH /api/outlets/:id/toggle — admin: toggle aktif/nonaktif
router.patch('/:id/toggle', authenticate, canManageMasterData, toggleOutletActive);

// DELETE /api/outlets/:id — admin: soft delete outlet
router.delete('/:id', authenticate, canManageMasterData, deleteOutlet);

// GET /api/outlets/:id
router.get('/:id', authenticate, requireSameOutlet, getOutletDetail);

// GET /api/outlets/:id/team
router.get('/:id/team', authenticate, requireSameOutlet, getOutletTeam);

// GET /api/outlets/:id/kas
router.get('/:id/kas', authenticate, requireSameOutlet, getOutletKasBalance);

export default router;
