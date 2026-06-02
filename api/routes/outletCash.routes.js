// ─────────────────────────────────────────────────────────────────────────────
// Outlet Cash Routes
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter, readLimiter, approvalLimiter } from '../middleware/rateLimit.js';
import { cacheResponse, invalidatePattern } from '../middleware/cacheResponse.js';
import {
  getBalance, getAllBalances,
  topupCash, submitExpense, resolveApproval,
  getApprovals, getExpenses, getTopups,
  reconcileBalance, getLedger, getSummary, getCashConfig,
  exportTransactionsCsv,
} from '../controllers/outletCashController.js';

const router = Router();

const ADMIN_ROLES = ['admin', 'superadmin', 'owner'];
const KASIR_ROLES = ['kasir', 'frontline'];

// Invalidate cache outlet-cash setelah mutasi
const invalidateCash = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidatePattern('GET:/api/outlet-cash*');
    }
  });
  next();
};

// Config (public dalam app — semua role yang login)
router.get('/config', authenticate, readLimiter, getCashConfig);

// Saldo
router.get('/balance', authenticate, cacheResponse({ ttl: 15_000 }), readLimiter, getBalance);
router.get('/balances', authenticate, requireRole(...ADMIN_ROLES), cacheResponse({ ttl: 30_000 }), readLimiter, getAllBalances);

// Top-up (admin only)
router.post('/topup', authenticate, requireRole(...ADMIN_ROLES), writeLimiter, invalidateCash, topupCash);
router.get('/topups', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getTopups);

// Expense (kasir only untuk submit, semua role baca riwayatnya)
router.post('/expense', authenticate, requireRole(...KASIR_ROLES), writeLimiter, invalidateCash, submitExpense);
router.get('/expenses', authenticate, cacheResponse({ ttl: 20_000 }), readLimiter, getExpenses);

// Approval (admin only)
router.get('/approvals', authenticate, requireRole(...ADMIN_ROLES), cacheResponse({ ttl: 10_000 }), readLimiter, getApprovals);
router.patch('/approval/:id', authenticate, requireRole(...ADMIN_ROLES), approvalLimiter, invalidateCash, resolveApproval);

// Rekonsiliasi (admin only)
router.post('/reconcile', authenticate, requireRole(...ADMIN_ROLES), writeLimiter, invalidateCash, reconcileBalance);

// Audit ledger
router.get('/ledger', authenticate, cacheResponse({ ttl: 30_000 }), readLimiter, getLedger);

// Summary report
router.get('/summary', authenticate, cacheResponse({ ttl: 60_000 }), readLimiter, getSummary);

// Export CSV (admin) — no cache
router.get('/transactions/export', authenticate, requireRole(...ADMIN_ROLES), readLimiter, exportTransactionsCsv);

export default router;
