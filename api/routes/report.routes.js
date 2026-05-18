import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  getExecutiveSummary,
  getOutletPerformance,
  getServiceAnalytics,
  getCashierPerformance,
  getCustomerInsights,
} from '../controllers/reportController.js';

const router = Router();

router.get('/executive-summary', authenticate, requireRole('admin', 'superadmin', 'owner', 'finance'), getExecutiveSummary);
router.get('/outlet-performance', authenticate, requireRole('admin', 'superadmin', 'owner', 'finance'), getOutletPerformance);
router.get('/service-analytics', authenticate, requireRole('admin', 'superadmin', 'owner', 'finance'), getServiceAnalytics);
router.get('/cashier-performance', authenticate, requireRole('admin', 'superadmin', 'owner', 'finance'), getCashierPerformance);
router.get('/customer-insights', authenticate, requireRole('admin', 'superadmin', 'owner', 'finance'), getCustomerInsights);

export default router;
