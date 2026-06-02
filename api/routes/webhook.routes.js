// ─────────────────────────────────────────────────────────────────────────────
// Webhook routes — public endpoint untuk callback dari payment gateway
// PENTING: TIDAK pakai authenticate. Validasi pakai signature key.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { handleMidtransWebhook } from '../controllers/paymentController.js';

const router = Router();

// Rate limit khusus webhook — Midtrans bisa retry, jadi cukup longgar
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600, // 600 webhook per menit per IP — Midtrans retry
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many webhook requests' },
});

// POST /api/webhook/midtrans — terima notification dari Midtrans
// Signature verification ada di controller
router.post('/midtrans', webhookLimiter, handleMidtransWebhook);

export default router;
