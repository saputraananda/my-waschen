import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import {
  getOutletStock,
  getInventoryOutletSummary,
  adjustInventoryStock,
  getInventoryCategories,
  listInventoryItems,
  createInventoryItem,
  patchInventoryItem,
  patchOutletMinStock,
  listServiceInventoryUsage,
  upsertServiceInventoryUsage,
  deleteServiceInventoryUsage,
} from '../controllers/inventoryController.js';

const router = Router();

const adminFinance = requireRole('admin', 'finance', 'superadmin', 'owner');

router.get('/categories', authenticate, adminFinance, getInventoryCategories);
router.get('/items', authenticate, adminFinance, listInventoryItems);
router.post('/items', authenticate, adminFinance, createInventoryItem);
router.patch('/items/:id', authenticate, adminFinance, patchInventoryItem);
router.get('/service-usage', authenticate, adminFinance, listServiceInventoryUsage);
router.post('/service-usage', authenticate, adminFinance, upsertServiceInventoryUsage);
router.delete('/service-usage/:id', authenticate, adminFinance, deleteServiceInventoryUsage);
router.patch('/outlet-min', authenticate, adminFinance, patchOutletMinStock);

router.get('/stock', authenticate, requireRole('kasir', 'produksi', 'admin', 'finance', 'superadmin', 'owner'), getOutletStock);
router.get('/summary-outlets', authenticate, adminFinance, getInventoryOutletSummary);
router.post('/adjust', authenticate, requireRole('kasir', 'produksi', 'admin', 'finance', 'superadmin', 'owner'), adjustInventoryStock);

export default router;
