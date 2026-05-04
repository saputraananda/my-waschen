import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'waschen-secret-dev-2025';

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

// ─── Middleware: outlet guard (user hanya bisa akses data outletnya sendiri) ──
export const requireSameOutlet = (req, res, next) => {
  const targetOutletId = req.params.outletId || req.query.outletId || req.body.outletId;

  if (!targetOutletId) return next(); // kalau tidak ada filter outlet, lanjut
  if (req.user.roleCode === 'admin') return next(); // admin bisa akses semua outlet

  if (req.user.outletId !== targetOutletId) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Anda hanya bisa mengakses data outlet Anda sendiri.',
    });
  }

  next();
};