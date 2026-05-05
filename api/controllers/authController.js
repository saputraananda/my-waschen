import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { poolWaschenPos } from '../db/connection.js';

// ─── Helper ───────────────────────────────────────────────────────────────────
const getInitials = (name) => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── Controller: POST /api/auth/login ─────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT u.id, u.name, u.username, u.password_hash,
              r.code  AS role_code,
              o.id    AS outlet_id,   o.name    AS outlet_name,
              o.address AS outlet_address, o.phone AS outlet_phone
       FROM mst_user u
       JOIN mst_role   r ON r.id = u.primary_role_id
       LEFT JOIN mst_outlet o ON o.id = u.outlet_id
       WHERE u.username = ? AND u.is_active = 1
       LIMIT 1`,
      [username.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau tidak aktif' });
    }

    const user = rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Password salah. Coba lagi.' });
    }

    // Catat waktu login terakhir
    await poolWaschenPos.execute(
      'UPDATE mst_user SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    const JWT_SECRET = process.env.JWT_SECRET || 'waschen-secret-dev-2025';
    const token = jwt.sign(
      { userId: user.id, roleCode: user.role_code, outletId: user.outlet_id, username: user.username },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        userId:     user.id,
        name:       user.name,
        username:   user.username,
        avatar:     getInitials(user.name),
        roleCode:   user.role_code,
        outletId:   user.outlet_id,
        outletName: user.outlet_name,
        outlet: user.outlet_id ? {
          id:      user.outlet_id,
          name:    user.outlet_name,
          address: user.outlet_address,
          phone:   user.outlet_phone,
        } : null,
      },
    });
  } catch (err) {
    console.error('[login] Error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server. Coba lagi.' });
  }
};

// ─── Controller: POST /api/auth/logout ────────────────────────────────────────
export const logout = (req, res) => {
  return res.status(200).json({ success: true, message: 'Logout berhasil' });
};

// ─── Controller: GET /api/auth/outlets ────────────────────────────────────────
export const getOutlets = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT id, outlet_code, name, address, phone FROM mst_outlet WHERE is_active = 1 ORDER BY name'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getOutlets] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data outlet.' });
  }
};
