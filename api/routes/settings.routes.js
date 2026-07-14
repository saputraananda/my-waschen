import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter } from '../middleware/rateLimit.js';
import {
  getSettings, getSettingByKey, updateSetting,
} from '../controllers/settingsController.js';

const router = Router();

const ADMIN = requireRole('admin');

router.get('/', authenticate, ADMIN, readLimiter, getSettings);
router.get('/:key', authenticate, ADMIN, readLimiter, getSettingByKey);
router.patch('/:key', authenticate, ADMIN, writeLimiter, updateSetting);

export default router;
