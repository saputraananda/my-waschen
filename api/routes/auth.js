import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const router = express.Router();

// ─── Mock DB ──────────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { userId: 'USR-001', name: 'Budi Santoso', email: 'kasir@waschen.id', passwordHash: '$2a$10$YourHashedPasswordHere', roleCode: 'kasir', outletId: 'OTL-001', outletName: 'Waschen Sudirman', isActive: true, avatar: 'BS' },
  { userId: 'USR-002', name: 'Dewi Rahayu', email: 'produksi@waschen.id', passwordHash: '$2a$10$YourHashedPasswordHere', roleCode: 'produksi', outletId: 'OTL-001', outletName: 'Waschen Sudirman', isActive: true, avatar: 'DR' },
  { userId: 'USR-003', name: 'Ahmad Fauzi', email: 'admin@waschen.id', passwordHash: '$2a$10$YourHashedPasswordHere', roleCode: 'admin', outletId: 'OTL-001', outletName: 'Waschen Sudirman', isActive: true, avatar: 'AF' },
  { userId: 'USR-004', name: 'Siti Nurhaliza', email: 'finance@waschen.id', passwordHash: '$2a$10$YourHashedPasswordHere', roleCode: 'finance', outletId: 'OTL-002', outletName: 'Waschen Kemang', isActive: true, avatar: 'SN' },
];

const MOCK_OUTLETS = [
  { id: 'OTL-001', name: 'Waschen Sudirman', address: 'Jl. Sudirman No. 123' },
  { id: 'OTL-002', name: 'Waschen Kemang', address: 'Jl. Kemang Raya No. 45' },
  { id: 'OTL-003', name: 'Waschen Kelapa Gading', address: 'Jl. Kelapa Gading No. 8' },
];

// Cari user SEKARANG CUKUP BERDASARKAN EMAIL
const findUserByEmail = (email) => {
  return MOCK_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
};

const verifyPassword = (inputPassword, storedHash) => {
  const DEV_PASSWORDS = {
    'kasir@waschen.id': 'kasir123',
    'produksi@waschen.id': 'produksi123',
    'admin@waschen.id': 'admin123',
    'finance@waschen.id': 'finance123',
  };
  if (process.env.NODE_ENV !== 'production') {
    const email = Object.keys(DEV_PASSWORDS).find((k) => DEV_PASSWORDS[k] === inputPassword);
    return !!email;
  }
  return bcrypt.compareSync(inputPassword, storedHash);
};

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ success: false, message: 'Email dan password wajib diisi' });

    const user = findUserByEmail(email.trim());

    if (!user) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau tidak aktif' });
    }

    const isPasswordValid = verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Password salah. Coba lagi.' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'waschen-secret-dev-2025';
    const token = jwt.sign(
      { userId: user.userId, roleCode: user.roleCode, outletId: user.outletId, email: user.email },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    const outlet = MOCK_OUTLETS.find((o) => o.id === user.outletId);

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        userId: user.userId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        roleCode: user.roleCode, // Backend tetap mengirim role aslinya (admin)
        outletId: user.outletId,
        outletName: outlet?.name || user.outletName,
        outlet: outlet || null,
      },
    });
  } catch (err) {
    console.error('[login] Error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
});

router.post('/logout', (req, res) => res.status(200).json({ success: true, message: 'Logout berhasil' }));
router.get('/outlets', (req, res) => res.status(200).json({ success: true, data: MOCK_OUTLETS }));

// Wajib export default untuk ES Modules
export default router;