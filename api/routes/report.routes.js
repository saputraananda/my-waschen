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
  getOutletSummary,
  exportTransactions,
  exportCustomers,
  exportServices,
  exportInventory,
  exportFinancialReport,
} from '../controllers/reportController.js';

const router = Router();

const adminOnly = requireRole('admin');

router.get('/executive-summary',  authenticate, adminOnly, getExecutiveSummary);
router.get('/outlet-performance', authenticate, adminOnly, getOutletPerformance);
router.get('/service-analytics',  authenticate, adminOnly, getServiceAnalytics);
router.get('/cashier-performance',authenticate, adminOnly, getCashierPerformance);
router.get('/customer-insights',  authenticate, adminOnly, getCustomerInsights);
router.get('/comparison',         authenticate, adminOnly, getComparisonReport);
router.get('/cohort',             authenticate, adminOnly, getCohortAnalysis);
router.get('/forecast',           authenticate, adminOnly, getForecast);

// Outlet summary — accessible by all authenticated users (kasir/produksi/admin)
// Default outlet = outlet user. Admin bisa pass outletId untuk lihat outlet lain.
router.get('/outlet-summary',     authenticate, getOutletSummary);

// ── Data Export Endpoints (CSV/Excel) ──────────────────────────────────────────
router.get('/export/transactions',  authenticate, adminOnly, exportTransactions);
router.get('/export/customers',     authenticate, adminOnly, exportCustomers);
router.get('/export/services',      authenticate, adminOnly, exportServices);
router.get('/export/inventory',    authenticate, adminOnly, exportInventory);
router.get('/export/financial',    authenticate, adminOnly, exportFinancialReport);

export default router;
