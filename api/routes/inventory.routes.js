import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import {
  getOutletStock,
  getInventoryOutletSummary,
  getAllOutletStocks,
  adjustInventoryStock,
  getInventoryCategories,
  listInventoryItems,
  createInventoryItem,
  patchInventoryItem,
  patchOutletMinStock,
  listServiceInventoryUsage,
  upsertServiceInventoryUsage,
  deleteServiceInventoryUsage,
  // Phase 5: Low-Stock Workflow
  createLowStockAlert,
  getLowStockAlertHistory,
  convertAlertToPurchaseRequest,
  // Phase 6: Stock History
  getStockHistory,
} from '../controllers/inventoryController.js';
import { validateInventoryCreate } from '../schemas/validationSchemas.js';

const router = Router();

const adminOnly = requireRole('admin');
const productionOrAbove = requireRole('admin', 'produksi', 'frontline');

router.get('/categories', authenticate, requireRole('frontline', 'produksi', 'admin'), getInventoryCategories);
router.get('/items', authenticate, requireRole('frontline', 'produksi', 'admin'), listInventoryItems);
// Validation: Zod schema validates category_id, name, unit, item_code
router.post('/items', authenticate, adminOnly, validateInventoryCreate, createInventoryItem);
router.patch('/items/:id', authenticate, adminOnly, patchInventoryItem);
router.get('/service-usage', authenticate, adminOnly, listServiceInventoryUsage);
router.post('/service-usage', authenticate, adminOnly, upsertServiceInventoryUsage);
router.delete('/service-usage/:id', authenticate, adminOnly, deleteServiceInventoryUsage);
router.patch('/outlet-min', authenticate, adminOnly, patchOutletMinStock);

router.get('/stock', authenticate, requireRole('frontline', 'produksi', 'admin'), getOutletStock);
router.get('/summary-outlets', authenticate, adminOnly, getInventoryOutletSummary);
router.get('/all-outlet-stocks', authenticate, adminOnly, getAllOutletStocks);
router.post('/adjust', authenticate, requireRole('frontline', 'produksi', 'admin'), adjustInventoryStock);

// Phase 5: Low-Stock Workflow - Production to Frontliner Alert
router.post('/low-stock-alert', authenticate, productionOrAbove, createLowStockAlert);
router.get('/low-stock-history', authenticate, adminOnly, getLowStockAlertHistory);
router.post('/low-stock-to-pr', authenticate, productionOrAbove, convertAlertToPurchaseRequest);

// GET /api/inventory/low-stock-my-alerts - Kasir sees alerts for their outlet
router.get('/low-stock-my-alerts', authenticate, requireRole('frontline', 'admin', 'produksi'), getLowStockAlertHistory);

// Phase 6: Stock Movement History
router.get('/stock-history', authenticate, adminOnly, getStockHistory);

export default router;
