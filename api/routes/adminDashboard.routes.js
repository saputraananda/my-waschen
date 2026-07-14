// Routes for admin dashboard charts
import express from 'express';
import {
  getOutletPerformance,
  getCashDepositStatus,
  getPaymentMethodTrend
} from '../controllers/adminDashboardController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/outlet-performance', authenticate, requireRole('admin'), getOutletPerformance);
router.get('/cash-deposit-status', authenticate, requireRole('admin'), getCashDepositStatus);
router.get('/payment-trend', authenticate, requireRole('admin'), getPaymentMethodTrend);

export default router;
