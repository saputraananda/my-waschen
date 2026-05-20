import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getExecutiveSummary,
  getOutletPerformance,
  getServiceAnalytics,
  getCashierPerformance,
  getCustomerInsights,
  getComparisonReport,
  getCohortAnalysis,
  getForecast,
} from '../controllers/reportController.js';

const router = Router();

const adminOnly = requireRole('admin', 'superadmin', 'owner', 'finance');

router.get('/executive-summary',  authenticate, adminOnly, getExecutiveSummary);
router.get('/outlet-performance', authenticate, adminOnly, getOutletPerformance);
router.get('/service-analytics',  authenticate, adminOnly, getServiceAnalytics);
router.get('/cashier-performance',authenticate, adminOnly, getCashierPerformance);
router.get('/customer-insights',  authenticate, adminOnly, getCustomerInsights);

// New endpoints
router.get('/comparison',         authenticate, adminOnly, getComparisonReport);
router.get('/cohort',             authenticate, adminOnly, getCohortAnalysis);
router.get('/forecast',           authenticate, adminOnly, getForecast);

export default router;
