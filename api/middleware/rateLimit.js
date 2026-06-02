// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiters — proteksi brute-force & abuse
// ─────────────────────────────────────────────────────────────────────────────
import rateLimit from 'express-rate-limit';

// Helper: per-user key (kalau sudah ter-authenticate), fallback ke IP.
// Penting untuk kantor multi-user 1 IP supaya 5 kasir tidak saling habiskan limit.
const userKey = (req) => {
  if (req.user?.userId) return `u:${req.user.userId}`;
  return req.ip;
};

// Helper: skip kalau response dari cache (HIT/STALE/COALESCED)
const skipIfCached = (req, res) => res?.locals?.fromCache === true;

// Auth (login, password reset) — paling ketat (per IP, sebelum auth)
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
  max: 120,            // per user/IP — write action bisa banyak (multi-item submit)
  keyGenerator: userKey,
  message: { success: false, message: 'Terlalu banyak permintaan. Mohon tunggu sebentar.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Approval / verification actions — ketat (sensitif untuk audit)
export const approvalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: userKey,
  message: { success: false, message: 'Terlalu banyak request approval. Tunggu 1 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public endpoints (outlet list, awareness sources) — longgar
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, message: 'Terlalu banyak request.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Read-heavy endpoints (list transaksi, list customer, dashboard stats).
// Naikkan ke 600/menit/user — infinite scroll + polling tidak boleh kena throttle.
// Cache HIT di-skip biar tidak makan limit.
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  keyGenerator: userKey,
  skip: skipIfCached,
  message: { success: false, message: 'Terlalu banyak permintaan. Tunggu sebentar.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search/autocomplete — paling longgar (per user)
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  keyGenerator: userKey,
  skip: skipIfCached,
  message: { success: false, message: 'Terlalu banyak pencarian. Tunggu sebentar.' },
  standardHeaders: true,
  legacyHeaders: false,
});
