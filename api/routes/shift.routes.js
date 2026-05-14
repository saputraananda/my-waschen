import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getShiftStatus,
  openShift,
  closeShift,
  getShiftCurrentSummary,
  listShiftSessions,
  getShiftOutletSummary,
} from '../controllers/shiftController.js';

const router = Router();

router.get('/status', authenticate, getShiftStatus);
router.post('/open', authenticate, openShift);
router.post('/close', authenticate, closeShift);
router.get('/current-summary', authenticate, getShiftCurrentSummary);
router.get('/sessions', authenticate, listShiftSessions);
router.get('/outlet-summary', authenticate, getShiftOutletSummary);

export default router;
