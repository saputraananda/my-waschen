import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import {
  getDrawerEntries,
  addDrawerEntry,
  deleteDrawerEntry,
  getDrawerSummaryBySession,
} from '../controllers/cashDrawerController.js';

const router = Router();
const ADMIN = requireRole('admin');

// Ambil entri kas laci sesi aktif (atau query ?sessionId=xxx)
router.get('/entries', authenticate, getDrawerEntries);

// Tambah entri masuk/keluar manual
router.post('/entry', authenticate, writeLimiter, addDrawerEntry);

// Hapus entri (hanya saat sesi masih open, oleh pencatat atau admin)
router.delete('/entry/:id', authenticate, writeLimiter, deleteDrawerEntry);

// Ringkasan lengkap per sesi (untuk laporan / tutup shift) — Admin only
router.get('/summary-by-session/:sessionId', authenticate, ADMIN, getDrawerSummaryBySession);

export default router;
