import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, publicLimiter } from '../middleware/rateLimit.js';
import { login, logout, getOutlets, refreshToken } from '../controllers/authController.js';

const router = Router();

router.post('/login',    authLimiter, login);
router.post('/logout',   logout);
router.post('/refresh',  authenticate, refreshToken); // requires valid (not-yet-expired) token
router.get('/outlets',   publicLimiter, getOutlets);

export default router;
