import jwt from 'jsonwebtoken';
// bcrypt dihapus — password disimpan plain text sesuai permintaan user
import { poolWaschenPos } from '../db/connection.js';

// ─── Helper ───────────────────────────────────────────────────────────────────
const getInitials = (name) => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─── Controller: POST /api/auth/login ─────────────────────────────────────────
// Login bisa pakai username ATAU email — dicek keduanya
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username/email dan password wajib diisi' });
    }

    const identifier = username.trim();

    // Cek apakah kolom username sudah ada di DB
    const [colCheck] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_user' AND COLUMN_NAME = 'username'
       LIMIT 1`
    );
    const hasUsername = colCheck.length > 0;

    let rows;
    if (hasUsername) {
      // Login bisa pakai username atau email
      [rows] = await poolWaschenPos.execute(
        `SELECT u.id, u.name, u.username, u.email, u.password_hash,
                u.phone,
                r.code  AS role_code,
                o.id    AS outlet_id,   o.name    AS outlet_name,
                o.address AS outlet_address, o.phone AS outlet_phone
         FROM mst_user u
         JOIN mst_role   r ON r.id = u.primary_role_id
         LEFT JOIN mst_outlet o ON o.id = u.outlet_id
         WHERE (u.username = ? OR u.email = ?) AND u.is_active = 1
         LIMIT 1`,
        [identifier, identifier]
      );
    } else {
      // Fallback: hanya email (kolom username belum ada)
      [rows] = await poolWaschenPos.execute(
        `SELECT u.id, u.name, u.email AS username, u.email, u.password_hash,
                u.phone,
                r.code  AS role_code,
                o.id    AS outlet_id,   o.name    AS outlet_name,
                o.address AS outlet_address, o.phone AS outlet_phone
         FROM mst_user u
         JOIN mst_role   r ON r.id = u.primary_role_id
         LEFT JOIN mst_outlet o ON o.id = u.outlet_id
         WHERE u.email = ? AND u.is_active = 1
         LIMIT 1`,
        [identifier]
      );
    }

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan atau tidak aktif' });
    }

    const user = rows[0];

    // Plain text password comparison — tanpa encrypt/hash sesuai permintaan user
    const isPasswordValid = (password === user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Password salah. Coba lagi.' });
    }

    // Ambil kolom photo — graceful jika belum ada
    let photo = null;
    try {
      const [[photoRow]] = await poolWaschenPos.execute(
        'SELECT photo FROM mst_user WHERE id = ? LIMIT 1',
        [user.id]
      );
      photo = photoRow?.photo || null;
    } catch { /* kolom photo belum ada */ }

    // Catat waktu login terakhir
    await poolWaschenPos.execute(
      'UPDATE mst_user SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    const JWT_SECRET = process.env.JWT_SECRET;
    const token = jwt.sign(
      {
        userId:   user.id,
        roleCode: user.role_code,
        outletId: user.outlet_id,
        username: user.username,
      },
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
        phone:      user.phone  || null,
        email:      user.email  || null,
        photo:      photo,
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

// ─── Controller: POST /api/auth/refresh ───────────────────────────────────────
export const refreshToken = async (req, res) => {
  try {
    const { userId } = req.user;

    const [colCheck] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_user' AND COLUMN_NAME = 'username'
       LIMIT 1`
    );
    const hasUsername = colCheck.length > 0;

    const selectUsername = hasUsername ? 'u.username,' : 'u.email AS username,';

    const [rows] = await poolWaschenPos.execute(
      `SELECT u.id, ${selectUsername} u.is_active,
              r.code AS role_code,
              o.id AS outlet_id
       FROM mst_user u
       JOIN mst_role r ON r.id = u.primary_role_id
       LEFT JOIN mst_outlet o ON o.id = u.outlet_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'Akun tidak aktif. Silakan login ulang.' });
    }

    const user = rows[0];
    const JWT_SECRET = process.env.JWT_SECRET;
    const newToken = jwt.sign(
      {
        userId:   user.id,
        roleCode: user.role_code,
        outletId: user.outlet_id,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      success: true,
      data: { token: newToken },
    });
  } catch (err) {
    console.error('[refreshToken] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal refresh token.' });
  }
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
