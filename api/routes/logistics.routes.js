import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  createLogisticOrder,
  getLogisticOrders,
  rescheduleLogistic,
  getAreaZones,
} from '../controllers/logisticsController.js';

const router = Router();

// GET /api/logistics — list logistic orders
router.get('/', authenticate, getLogisticOrders);

// GET /api/logistics/area-zones — daftar area zone untuk dropdown
router.get('/area-zones', authenticate, getAreaZones);

// POST /api/logistics — buat logistic order baru
router.post('/', authenticate, createLogisticOrder);

// POST /api/logistics/:id/reschedule — ubah jadwal logistik
router.post('/:id/reschedule', authenticate, rescheduleLogistic);

export default router;
