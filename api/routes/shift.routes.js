import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getShiftStatus, openShift, closeShift } from '../controllers/shiftController.js';

const router = Router();

router.get('/status', authenticate, getShiftStatus);
router.post('/open', authenticate, openShift);
router.post('/close', authenticate, closeShift);

export default router;
