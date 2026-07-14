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
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Role guards
const ADMIN = requireRole('admin');
const FRONTLINER = requireRole('frontline');

// ── Public routes (authenticated) ──────────────────────────────────────────────

// Get tier information (public display but still needs authentication for security)
router.get('/tiers', authenticate, getTierInfo);

// Get membership status for a customer
router.get('/status/:customerId', authenticate, getMembershipStatus);

// Get membership details
router.get('/:customerId', authenticate, getMembershipDetails);

// List all memberships (admin)
router.get('/', authenticate, ADMIN, listMemberships);

// ── Membership actions ─────────────────────────────────────────────────────────

// Register new membership (kasir only)
router.post('/register', authenticate, FRONTLINER, registerMembership);

// Renew membership
router.post('/:id/renew', authenticate, FRONTLINER, renewMembership);

// Upgrade tier (Gold → Diamond)
router.post('/:id/upgrade', authenticate, FRONTLINER, upgradeTier);

// Cancel/suspend membership (admin only)
router.post('/:id/cancel', authenticate, ADMIN, cancelMembership);

// Update last transaction (called from checkout)
router.post('/:id/update-last-transaction', authenticate, FRONTLINER, updateLastTransaction);

// ── Cron/Internal routes ──────────────────────────────────────────────────────

// Process expiry and forfeiture (should be called daily by scheduler)
router.post('/cron/expiry-check', authenticate, ADMIN, processExpiryAndForfeiture);

export default router;
