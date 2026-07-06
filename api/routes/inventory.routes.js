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
} from '../controllers/inventoryController.js';
import { validateInventoryCreate } from '../schemas/validationSchemas.js';

const router = Router();

const adminFinance = requireRole('admin', 'finance', 'superadmin', 'owner');
const productionOrAbove = requireRole('admin', 'finance', 'superadmin', 'owner', 'produksi', 'kasir', 'frontline');

router.get('/categories', authenticate, requireRole('kasir', 'frontline', 'produksi', 'admin', 'finance', 'superadmin', 'owner'), getInventoryCategories);
router.get('/items', authenticate, requireRole('kasir', 'frontline', 'produksi', 'admin', 'finance', 'superadmin', 'owner'), listInventoryItems);
// Validation: Zod schema validates category_id, name, unit, item_code
router.post('/items', authenticate, adminFinance, validateInventoryCreate, createInventoryItem);
router.patch('/items/:id', authenticate, adminFinance, patchInventoryItem);
router.get('/service-usage', authenticate, adminFinance, listServiceInventoryUsage);
router.post('/service-usage', authenticate, adminFinance, upsertServiceInventoryUsage);
router.delete('/service-usage/:id', authenticate, adminFinance, deleteServiceInventoryUsage);
router.patch('/outlet-min', authenticate, adminFinance, patchOutletMinStock);

router.get('/stock', authenticate, requireRole('kasir', 'frontline', 'produksi', 'admin', 'finance', 'superadmin', 'owner'), getOutletStock);
router.get('/summary-outlets', authenticate, adminFinance, getInventoryOutletSummary);
router.get('/all-outlet-stocks', authenticate, adminFinance, getAllOutletStocks);
router.post('/adjust', authenticate, requireRole('kasir', 'frontline', 'produksi', 'admin', 'finance', 'superadmin', 'owner'), adjustInventoryStock);

// Phase 5: Low-Stock Workflow - Production to Frontliner Alert
router.post('/low-stock-alert', authenticate, productionOrAbove, createLowStockAlert);
router.get('/low-stock-history', authenticate, adminFinance, getLowStockAlertHistory);
router.post('/low-stock-to-pr', authenticate, productionOrAbove, convertAlertToPurchaseRequest);

export default router;
