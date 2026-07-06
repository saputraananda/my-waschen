// ─────────────────────────────────────────────────────────────────────────────
// membership.routes.js — WPC Membership API routes
// Phase 2: Membership System Overhaul
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import {
  getMembershipStatus,
  getMembershipDetails,
  listMemberships,
  registerMembership,
  renewMembership,
  upgradeTier,
  cancelMembership,
  processExpiryAndForfeiture,
  updateLastTransaction,
  getTierInfo,
} from '../controllers/membershipController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── Public routes (authenticated) ──────────────────────────────────────────────

// Get tier information (public display)
router.get('/tiers', getTierInfo);

// Get membership status for a customer
router.get('/status/:customerId', authenticate, getMembershipStatus);

// Get membership details
router.get('/:customerId', authenticate, getMembershipDetails);

// List all memberships (admin)
router.get('/', authenticate, listMemberships);

// ── Membership actions ─────────────────────────────────────────────────────────

// Register new membership
router.post('/register', authenticate, registerMembership);

// Renew membership
router.post('/:id/renew', authenticate, renewMembership);

// Upgrade tier (Gold → Diamond)
router.post('/:id/upgrade', authenticate, upgradeTier);

// Cancel/suspend membership (admin only)
router.post('/:id/cancel', authenticate, cancelMembership);

// Update last transaction (called from checkout)
router.post('/:id/update-last-transaction', authenticate, updateLastTransaction);

// ── Cron/Internal routes ──────────────────────────────────────────────────────

// Process expiry and forfeiture (should be called daily by scheduler)
router.post('/cron/expiry-check', authenticate, processExpiryAndForfeiture);

export default router;
