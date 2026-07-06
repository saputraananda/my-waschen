// ─────────────────────────────────────────────────────────────────────────────
// delivery.routes.js — Delivery/Logistic API routes
// 
// DATABASE TABLE: tr_logistic_order (CORRECT)
// BUGFIX TASK 1.2: Verified all routes properly reference tr_logistic_order
//                  instead of non-existent 'deliveries' or 'tr_delivery' table
// 
// All routes in this file interact ONLY with the tr_logistic_order table through
// the deliveryController.js methods. No legacy table references remain.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import {
  getDriverTasks,
  getDriverHistory,
  updateStatus,
  assignDriver,
  createDelivery,
  getAllDeliveries,
  getDeliveryById,
  cancelOrder,
  rescheduleOrder,
  getStats
} from '../controllers/deliveryController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── Public routes (authenticated) ─────────────────────────────────────────────

// GET /api/delivery/tasks - Get courier's active tasks
// Table: tr_logistic_order (WHERE courier_id = ? AND status NOT IN done/cancelled)
// Controller: getDriverTasks
router.get('/tasks', authenticate, getDriverTasks);

// GET /api/delivery/history - Get courier's completed order history
// Table: tr_logistic_order (WHERE courier_id = ? AND status IN done/cancelled)
// Controller: getDriverHistory
router.get('/history', authenticate, getDriverHistory);

// GET /api/delivery/stats - Get order statistics by status
// Table: tr_logistic_order (GROUP BY status)
// Controller: getStats
router.get('/stats', authenticate, getStats);

// GET /api/delivery/:id - Get order details by ID
// Table: tr_logistic_order (JOIN tr_transaction, mst_customer, mst_outlet)
// Controller: getDeliveryById
router.get('/:id', authenticate, getDeliveryById);

// ── Admin routes ──────────────────────────────────────────────────────────────

// GET /api/delivery - Get all delivery orders (admin with filters)
// Table: tr_logistic_order (WHERE deleted_at IS NULL + optional filters)
// Controller: getAllDeliveries
router.get('/', authenticate, getAllDeliveries);

// POST /api/delivery - Create new delivery/pickup order
// Table: tr_logistic_order (INSERT INTO with transaction_id, type, address, etc.)
// Controller: createDelivery
router.post('/', authenticate, createDelivery);

// PUT /api/delivery/:id/assign - Assign courier to order
// Table: tr_logistic_order (UPDATE courier_id WHERE id = ?)
// Controller: assignDriver
router.put('/:id/assign', authenticate, assignDriver);

// PUT /api/delivery/:id/status - Update order status
// Table: tr_logistic_order (UPDATE status WHERE id = ?)
// Controller: updateStatus
router.put('/:id/status', authenticate, updateStatus);

// PUT /api/delivery/:id/cancel - Cancel order
// Table: tr_logistic_order (UPDATE status = 'cancelled' WHERE id = ?)
// Controller: cancelOrder
router.put('/:id/cancel', authenticate, cancelOrder);

// PUT /api/delivery/:id/reschedule - Reschedule order
// Table: tr_logistic_order (UPDATE scheduled_at WHERE id = ?)
// Controller: rescheduleOrder
router.put('/:id/reschedule', authenticate, rescheduleOrder);

export default router;
