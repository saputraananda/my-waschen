// ─────────────────────────────────────────────────────────────────────────────
// birthday.routes.js — Birthday Automation API Routes
// Phase 5-7: Birthday Automation
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { readLimiter } from '../middleware/rateLimit.js';
import { cacheResponse } from '../middleware/cacheResponse.js';
import {
  getTodayBirthdays,
  getUpcomingBirthdays,
  sendBirthdayGreeting,
  sendBulkBirthdayGreeting,
  offerDepositBonus,
  getBirthdayStats,
} from '../controllers/birthdayAutomationController.js';

const router = Router();

const ADMIN = requireRole('admin', 'superadmin', 'owner');

// GET /api/birthday/today — Get customers with birthday today
router.get('/today', authenticate, cacheResponse({ ttl: 60000 }), readLimiter, getTodayBirthdays);

// GET /api/birthday/upcoming — Get upcoming birthdays
router.get('/upcoming', authenticate, cacheResponse({ ttl: 60000 }), readLimiter, getUpcomingBirthdays);

// GET /api/birthday/stats — Birthday campaign statistics
router.get('/stats', authenticate, ADMIN, cacheResponse({ ttl: 300000 }), readLimiter, getBirthdayStats);

// POST /api/birthday/send — Send birthday greeting to one customer
router.post('/send', authenticate, ADMIN, sendBirthdayGreeting);

// POST /api/birthday/send-bulk — Bulk send birthday greetings
router.post('/send-bulk', authenticate, ADMIN, sendBulkBirthdayGreeting);

// POST /api/birthday/offer-deposit-bonus — Offer deposit bonus to birthday customer
router.post('/offer-deposit-bonus', authenticate, ADMIN, offerDepositBonus);

export default router;
