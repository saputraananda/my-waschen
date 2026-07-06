// Routes for admin dashboard charts
import express from 'express';
import {
  getOutletPerformance,
  getCashDepositStatus,
  getPaymentMethodTrend
} from '../controllers/adminDashboardController.js';
import { authenticate, canAccessFinance } from '../middleware/auth.js';

const router = express.Router();

router.get('/outlet-performance', authenticate, canAccessFinance, getOutletPerformance);
router.get('/cash-deposit-status', authenticate, canAccessFinance, getCashDepositStatus);
router.get('/payment-trend', authenticate, canAccessFinance, getPaymentMethodTrend);

export default router;
