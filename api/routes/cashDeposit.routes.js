import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import {
  submitDeposit,
  listMyDeposits,
  listDepositRequests,
  approveDeposit,
  rejectDeposit,
  getDepositSummary,
  getCashPoolSummary,
} from '../controllers/cashDepositController.js';

const router = Router();

// Role guards
const canAccessAdmin = requireRole('admin');

// Kasir: submit setor
router.post('/', authenticate, writeLimiter, submitDeposit);

// Kasir: list own deposits
router.get('/', authenticate, readLimiter, listMyDeposits);

// Kasir: deposit summary for today
router.get('/summary', authenticate, readLimiter, getDepositSummary);

// Admin: pool kas tertahan per outlet
router.get('/pool-summary', authenticate, canAccessAdmin, readLimiter, getCashPoolSummary);

// Admin: list deposit requests (pending/approved/rejected)
router.get('/pending', authenticate, canAccessAdmin, readLimiter, listDepositRequests);

// Admin: approve
router.patch('/:id/approve', authenticate, canAccessAdmin, writeLimiter, approveDeposit);

// Admin: reject
router.patch('/:id/reject', authenticate, canAccessAdmin, writeLimiter, rejectDeposit);

export default router;
