import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  validateShiftOpen,
  validateShiftClose,
  validateSubSessionOpen,
  validateSubSessionClose,
  validateHandover,
  validateAcceptHandover,
} from '../schemas/validationSchemas.js';
import {
  getShiftStatus,
  openShift,
  closeShift,
  getShiftCurrentSummary,
  listShiftSessions,
  getShiftOutletSummary,
  exportShiftReport,
  handoverShift,
  acceptHandover,
  getPendingHandover,
  getMyStats,
  getMyHistory,
} from '../controllers/shiftController.js';
import {
  openSubSession,
  closeSubSession,
  getCurrentSubSession,
  getAllSubSessions,
  getSubSessionById,
  createHandover,
  getHandoverHistory,
  acknowledgeHandover,
} from '../controllers/subSessionController.js';

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SHIFT ROUTES (Kasir Session - single user per outlet)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shifts/status - Check current shift status
router.get('/status', authenticate, getShiftStatus);

// POST /api/shifts/open - Buka shift baru
router.post('/open', authenticate, writeLimiter, validateShiftOpen, openShift);

// POST /api/shifts/close - Tutup shift
router.post('/close', authenticate, writeLimiter, validateShiftClose, closeShift);

// GET /api/shifts/current-summary - Live summary untuk open shift
router.get('/current-summary', authenticate, getShiftCurrentSummary);

// GET /api/shifts/sessions - Admin: riwayat semua shift
router.get('/sessions', authenticate, listShiftSessions);

// GET /api/shifts/outlet-summary - Admin: ringkasan per outlet
router.get('/outlet-summary', authenticate, getShiftOutletSummary);

// GET /api/shifts/export - Admin: export report
router.get('/export', authenticate, exportShiftReport);

// GET /api/shifts/my-stats - Stats for profile page (by period)
router.get('/my-stats', authenticate, getMyStats);

// GET /api/shifts/my-history - Shift history for profile page
router.get('/my-history', authenticate, getMyHistory);

// ══════════════════════════════════════════════════════════════════════════════
// HANDOVER ROUTES (Kasir → Produksi)
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/shifts/handover - Oper shift ke produksi
router.post('/handover', authenticate, writeLimiter, validateHandover, handoverShift);

// POST /api/shifts/accept-handover - Produksi terima handover
router.post('/accept-handover', authenticate, writeLimiter, validateAcceptHandover, acceptHandover);

// GET /api/shifts/pending-handover - Cek apakah ada handover waiting
router.get('/pending-handover', authenticate, getPendingHandover);

// ══════════════════════════════════════════════════════════════════════════════
// SUB-SESSION ROUTES (Individual Frontliner dalam Main Shift)
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/shifts/sub-session/open - Frontliner gabung/buka sub-session
router.post('/sub-session/open', authenticate, writeLimiter, validateSubSessionOpen, openSubSession);

// POST /api/shifts/sub-session/close - Frontliner tutup sub-session
router.post('/sub-session/close', authenticate, writeLimiter, validateSubSessionClose, closeSubSession);

// GET /api/shifts/sub-session/current - Get sub-session aktif user
router.get('/sub-session/current', authenticate, getCurrentSubSession);

// GET /api/shifts/sub-session/:sessionId/all - Get semua sub-session dalam shift
router.get('/sub-session/:sessionId/all', authenticate, getAllSubSessions);

// GET /api/shifts/sub-session/:id - Get detail sub-session by ID
router.get('/sub-session/:id', authenticate, getSubSessionById);

// ══════════════════════════════════════════════════════════════════════════════
// HANDOVER DETAIL ROUTES (Sub-session handover antar kasir)
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/shifts/handover/create - Create handover record antar sub-session
router.post('/handover/create', authenticate, writeLimiter, createHandover);

// GET /api/shifts/handover/:subSessionId/history - Get history handover
router.get('/handover/:subSessionId/history', authenticate, getHandoverHistory);

// PUT /api/shifts/handover/:id/acknowledge - Acknowledge handover
router.put('/handover/:id/acknowledge', authenticate, writeLimiter, acknowledgeHandover);

export default router;
