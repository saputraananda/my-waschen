import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = Router();

// GET /api/dashboard/stats — ringkasan statistik dari DB views
router.get('/stats', authenticate, getDashboardStats);

export default router;
