import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';
import {
  getCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
} from '../controllers/customerAddressController.js';

const router = Router();

// GET /api/customer-addresses/:customerId
router.get('/:customerId', authenticate, readLimiter, getCustomerAddresses);

// POST /api/customer-addresses/:customerId
router.post('/:customerId', authenticate, writeLimiter, createCustomerAddress);

// PUT /api/customer-addresses/:id
router.put('/:id', authenticate, writeLimiter, updateCustomerAddress);

// DELETE /api/customer-addresses/:id (soft delete)
router.delete('/:id', authenticate, writeLimiter, deleteCustomerAddress);

export default router;
