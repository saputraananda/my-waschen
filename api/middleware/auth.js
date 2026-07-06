import jwt from 'jsonwebtoken';
import { poolWaschenPos } from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');

// ─── Middleware: verifikasi token JWT ─────────────────────────────────────────
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token tidak ditemukan.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Simpan decoded payload ke req.user supaya bisa dipakai di route handler
    req.user = {
      userId: decoded.userId,
      roleCode: decoded.roleCode,
      outletId: decoded.outletId,
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Sesi telah berakhir. Silakan login ulang.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid.',
      code: 'TOKEN_INVALID',
    });
  }
};

// ─── Middleware: role guard ───────────────────────────────────────────────────
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Tidak terautentikasi',
      });
    }

    if (!allowedRoles.includes(req.user.roleCode)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Role '${req.user.roleCode}' tidak diizinkan untuk endpoint ini.`,
        allowedRoles,
      });
    }

    next();
  };
};

// ─── Sentralisasi Role Groups ────────────────────────────────────────────────
// Semua definisi role-group ada di sini sebagai single source of truth.
// File routes cukup menggunakan named middleware di bawah ini.
export const ROLE_GROUPS = {
  ADMIN: ['admin', 'superadmin', 'owner'],
  FINANCE: ['admin', 'superadmin', 'owner', 'finance'],
  CASHIER: ['kasir', 'frontline'],
  PRODUCTION: ['produksi'],
  GLOBAL: ['admin', 'superadmin', 'owner', 'finance'],
};

// ─── Named Role Guards ──────────────────────────────────────────────────────
// Gunakan ini di route files agar konsisten dan mudah di-maintain.
export const canManageMasterData = requireRole(...ROLE_GROUPS.ADMIN);
export const canManageTransactions = requireRole(...ROLE_GROUPS.ADMIN, ...ROLE_GROUPS.CASHIER);
export const canAccessFinance = requireRole(...ROLE_GROUPS.FINANCE);
export const canAccessProduction = requireRole(...ROLE_GROUPS.ADMIN, ...ROLE_GROUPS.PRODUCTION);

// ─── Legacy Aliases (backward compat) ────────────────────────────────────────
export const isAdmin = requireRole(...ROLE_GROUPS.ADMIN);
export const isCashier = requireRole(...ROLE_GROUPS.CASHIER);


// ─── Middleware: outlet guard (user hanya bisa akses data outletnya sendiri) ──
export const requireSameOutlet = (req, res, next) => {
  const targetOutletId = req.params.outletId || req.params.id || req.query.outletId || req.body.outletId;

  if (!targetOutletId) return next();

  // Role-role global boleh akses semua outlet
  const GLOBAL_ROLES = new Set(['admin', 'superadmin', 'owner', 'finance']);
  if (GLOBAL_ROLES.has(req.user.roleCode)) return next();

  if (String(req.user.outletId) !== String(targetOutletId)) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Anda hanya bisa mengakses data outlet Anda sendiri.',
    });
  }

  next();
};

// ─── Middleware: cek shift aktif ─────────────────────────────────────────────
// Blokir transaksi keuangan (checkout, payment, topup deposit) jika shift belum buka.
// Bypass untuk: user tanpa outletId (dev), role non-kasir (produksi).
export const requireActiveShift = async (req, res, next) => {
  const userId = req.user?.userId;
  const outletId = req.user?.outletId;

  // Tanpa outlet = bypass (dev environment atau role tanpa outlet)
  if (!outletId) return next();

  // Role non-kasir tidak punya shift (produksi, finance read-only, dll.)
  const CASHIER_ROLES = new Set(['kasir', 'frontline']);
  if (!CASHIER_ROLES.has(req.user.roleCode)) return next();

  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT id FROM tr_cashier_session
       WHERE cashier_id = ? AND status = 'open' AND deleted_at IS NULL
       LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'SHIFT_CLOSED',
        message: 'Buka shift terlebih dahulu untuk melakukan transaksi ini.',
      });
    }

    next();
  } catch (err) {
    console.error('[requireActiveShift] DB error:', err);
    // Jika gagal cek DB, izinkan saja (fail open — avoid blocking legitimate ops)
    next();
  }
};