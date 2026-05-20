// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiters — proteksi brute-force & abuse
// ─────────────────────────────────────────────────────────────────────────────
import rateLimit from 'express-rate-limit';

// Auth (login, password reset) — paling ketat
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,
  message: { success: false, message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Write operations (create/update/delete) — sedang
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  max: 60,             // max 60 write per menit per IP
  message: { success: false, message: 'Terlalu banyak permintaan. Mohon tunggu sebentar.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Approval / verification actions — ketat (sensitif untuk audit)
export const approvalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Terlalu banyak request approval. Tunggu 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoints (outlet list, awareness sources) — longgar
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { success: false, message: 'Terlalu banyak request.' },
  standardHeaders: true,
  legacyHeaders: false,
});
