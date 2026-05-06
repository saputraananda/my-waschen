import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getNotifications } from '../controllers/notificationController.js';

const router = Router();

// GET /api/notifications — notifikasi real-time dari data transaksi
router.get('/', authenticate, getNotifications);

export default router;
