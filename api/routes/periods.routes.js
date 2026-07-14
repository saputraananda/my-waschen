import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getCurrentPeriod, getPeriodHistory, closePeriod } from '../controllers/periodController.js';

const router = Router();

// GET /api/periods/current — info periode berjalan + stats + alert flag
// Kasir pakai outletId dari token; admin bisa pass ?outletId=xxx
router.get('/current', authenticate, getCurrentPeriod);

// GET /api/periods/history — riwayat tutup buku
router.get('/history', authenticate, getPeriodHistory);

// POST /api/periods/close — eksekusi tutup buku (admin only)
router.post('/close', authenticate, requireRole('admin'), closePeriod);

export default router;
