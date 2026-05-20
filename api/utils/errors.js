// ─────────────────────────────────────────────────────────────────────────────
// Centralized Error Messages & HTTP Error Helper
// ─────────────────────────────────────────────────────────────────────────────

export const ERR = {
  // Auth
  UNAUTHORIZED:        { status: 401, message: 'Akses ditolak. Token tidak ditemukan.' },
  TOKEN_EXPIRED:       { status: 401, message: 'Sesi telah berakhir. Silakan login ulang.', code: 'TOKEN_EXPIRED' },
  TOKEN_INVALID:       { status: 401, message: 'Token tidak valid.', code: 'TOKEN_INVALID' },
  FORBIDDEN:           { status: 403, message: 'Anda tidak memiliki izin untuk aksi ini.' },
  OUTLET_FORBIDDEN:    { status: 403, message: 'Akses ditolak. Anda hanya bisa mengakses data outlet Anda sendiri.' },

  // Auth - Login
  INVALID_CREDENTIALS: { status: 401, message: 'Username atau password salah.' },
  ACCOUNT_INACTIVE:    { status: 401, message: 'Akun tidak aktif. Hubungi administrator.' },

  // Validation
  MISSING_FIELDS:      { status: 400, message: 'Harap lengkapi semua field yang wajib diisi.' },
  INVALID_FORMAT:      { status: 400, message: 'Format data tidak valid.' },
  INVALID_STATUS:      { status: 400, message: 'Status tidak valid.' },
  INVALID_AMOUNT:      { status: 400, message: 'Nominal tidak valid.' },

  // Not Found
  NOT_FOUND:           { status: 404, message: 'Data tidak ditemukan.' },
  TX_NOT_FOUND:        { status: 404, message: 'Transaksi tidak ditemukan.' },
  CUSTOMER_NOT_FOUND:  { status: 404, message: 'Customer tidak ditemukan.' },
  USER_NOT_FOUND:      { status: 404, message: 'User tidak ditemukan.' },
  SERVICE_NOT_FOUND:   { status: 404, message: 'Layanan tidak ditemukan.' },
  OUTLET_NOT_FOUND:    { status: 404, message: 'Outlet tidak ditemukan.' },

  // Conflict
  DUPLICATE_USERNAME:  { status: 409, message: 'Username sudah digunakan.' },
  DUPLICATE_PHONE:     { status: 409, message: 'Nomor HP sudah terdaftar.' },
  DUPLICATE_TX_NO:     { status: 409, message: 'Nomor transaksi sudah ada.' },
  ALREADY_PROCESSED:   { status: 409, message: 'Data sudah diproses sebelumnya.' },
  ALREADY_CANCELLED:   { status: 409, message: 'Transaksi sudah dibatalkan.' },
  ALREADY_VERIFIED:    { status: 409, message: 'Pembayaran sudah diverifikasi.' },
  STALE_DATA:          { status: 409, message: 'Data sudah diperbarui oleh user lain. Mohon refresh dan coba lagi.', code: 'STALE_DATA' },

  // Business Logic
  SHIFT_NOT_OPEN:      { status: 400, message: 'Tidak ada shift yang sedang terbuka.' },
  SHIFT_ALREADY_OPEN:  { status: 400, message: 'Anda masih memiliki sesi shift yang terbuka.' },
  INSUFFICIENT_STOCK:  { status: 400, message: 'Stok tidak mencukupi.' },
  PROMO_INVALID:       { status: 400, message: 'Promo tidak berlaku atau tidak untuk outlet ini.' },
  PERIOD_CLOSED:       { status: 409, message: 'Periode ini sudah ditutup sebelumnya.' },

  // Server
  INTERNAL:            { status: 500, message: 'Terjadi kesalahan pada server. Coba lagi.' },
  DB_ERROR:            { status: 500, message: 'Gagal mengakses database. Coba lagi.' },
};

/**
 * Send standardized error response.
 * Usage: return sendError(res, ERR.NOT_FOUND);
 *        return sendError(res, ERR.INTERNAL, 'Gagal memuat data laporan.');
 */
export function sendError(res, errDef, customMessage) {
  return res.status(errDef.status).json({
    success: false,
    message: customMessage || errDef.message,
    ...(errDef.code ? { code: errDef.code } : {}),
  });
}

/**
 * Wrap async controller to catch unhandled errors.
 * Usage: router.get('/', asyncHandler(myController));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('[asyncHandler]', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: ERR.INTERNAL.message });
      }
    });
  };
}
