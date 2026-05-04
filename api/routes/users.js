import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ─── GET /api/users/me ────────────────────────────────────────────────────────
// Contoh route yang butuh auth
router.get('/me', authenticate, (req, res) => {
  res.json({ success: true, data: req.user });
});

// ─── GET /api/users ───────────────────────────────────────────────────────────
// Hanya admin yang bisa lihat semua user
router.get('/', authenticate, requireRole('admin'), (req, res) => {
  res.json({ success: true, message: 'Daftar user (admin only)', data: [] });
});

export default router;