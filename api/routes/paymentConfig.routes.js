import { Router } from 'express';
import { authenticate, canManageMasterData } from '../middleware/auth.js';
import {
  getBankAccounts,
  getBankAccountsByOutlet,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  seedBankAccounts,
} from '../controllers/paymentConfigController.js';

const router = Router();

// GET /api/bank-accounts — list all (admin) or filter by outlet
router.get('/', authenticate, getBankAccounts);

// GET /api/bank-accounts/by-outlet/:outletId — list by outlet (for kasir checkout)
router.get('/by-outlet/:outletId', authenticate, getBankAccountsByOutlet);

// POST /api/bank-accounts/seed — seed dummy data (admin only, for dev/testing)
router.post('/seed', authenticate, canManageMasterData, seedBankAccounts);

// POST /api/bank-accounts — create (admin only)
router.post('/', authenticate, canManageMasterData, createBankAccount);

// PUT /api/bank-accounts/:id — update (admin only)
router.put('/:id', authenticate, canManageMasterData, updateBankAccount);

// DELETE /api/bank-accounts/:id — soft delete (admin only)
router.delete('/:id', authenticate, canManageMasterData, deleteBankAccount);

export default router;
