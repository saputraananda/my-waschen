import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDrawerEntries,
  addDrawerEntry,
  deleteDrawerEntry,
  getDrawerSummaryBySession,
} from '../controllers/cashDrawerController.js';

const router = Router();

// Ambil entri kas laci sesi aktif (atau query ?sessionId=xxx)
router.get('/entries', authenticate, getDrawerEntries);

// Tambah entri masuk/keluar manual
router.post('/entry', authenticate, addDrawerEntry);

// Hapus entri (hanya saat sesi masih open, oleh pencatat atau admin)
router.delete('/entry/:id', authenticate, deleteDrawerEntry);

// Ringkasan lengkap per sesi (untuk laporan / tutup shift)
router.get('/summary-by-session/:sessionId', authenticate, getDrawerSummaryBySession);

export default router;
