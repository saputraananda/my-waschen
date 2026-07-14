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

// ─── Role Groups ────────────────────────────────────────────────────────────
export const ROLE_GROUPS = {
  ADMIN: ['admin'],
  FRONTLINER: ['frontline'],
  PRODUKSI: ['produksi'],
};

// ─── Named Role Guards ──────────────────────────────────────────────────────
export const isAdmin = requireRole(...ROLE_GROUPS.ADMIN);
export const isFrontliner = requireRole(...ROLE_GROUPS.FRONTLINER);
export const isProduksi = requireRole(...ROLE_GROUPS.PRODUKSI);

// ─── Master Data Guard ──────────────────────────────────────────────────────
// Master data = layanan, outlet, kategori — hanya admin yang boleh modifikasi
export const canManageMasterData = requireRole('admin');

// ─── Middleware: outlet guard ──────────────────────────────────────────────
export const requireSameOutlet = (req, res, next) => {
  const targetOutletId = req.params.outletId || req.params.id || req.query.outletId || req.body.outletId;

  if (!targetOutletId) return next();

  // Admin bisa akses semua outlet
  if (req.user.roleCode === 'admin') return next();

  if (String(req.user.outletId) !== String(targetOutletId)) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Anda hanya bisa mengakses data outlet Anda sendiri.',
    });
  }

  next();
};

// ─── Middleware: cek shift aktif ─────────────────────────────────────────────
// Blokir transaksi keuangan jika shift belum buka.
// Frontliner butuh shift aktif.
export const requireActiveShift = async (req, res, next) => {
  const userId = req.user?.userId;
  const outletId = req.user?.outletId;

  // Tanpa outlet = bypass (dev environment)
  if (!outletId) return next();

  // Admin & Produksi tidak butuh shift
  const NON_FRONTLINER = new Set(['admin', 'produksi']);
  if (NON_FRONTLINER.has(req.user.roleCode)) return next();

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
    next();
  }
};
