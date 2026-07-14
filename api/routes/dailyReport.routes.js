import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
import {
  generateDailyReport,
  sendDailyReport,
  getReportHistory,
  getTemplates,
} from '../controllers/dailyReportController.js';

const router = Router();

// GET /api/daily-reports/templates — get templates
router.get('/templates', authenticate, readLimiter, getTemplates);

// GET /api/daily-reports/generate — generate report
router.get('/generate', authenticate, requireRole('frontline', 'admin'), readLimiter, generateDailyReport);

// GET /api/daily-reports/history — get history
router.get('/history', authenticate, requireRole('frontline', 'admin'), readLimiter, getReportHistory);

// POST /api/daily-reports/send — send report via WA
router.post('/send', authenticate, requireRole('frontline', 'admin'), writeLimiter, sendDailyReport);

export default router;
