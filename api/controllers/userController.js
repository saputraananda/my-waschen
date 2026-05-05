import { poolWaschenPos } from '../db/connection.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

// ─── Controller: GET /api/users/me ────────────────────────────────────────────
export const getMe = (req, res) => {
  return res.json({ success: true, data: req.user });
};

// ─── Controller: GET /api/users ───────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        u.id,
        u.name,
        u.username,
        r.code AS role,
        o.name AS outlet,
        u.is_active AS active,
        u.created_at AS createdAt
      FROM mst_user u
      LEFT JOIN mst_role r ON r.id = u.primary_role_id
      LEFT JOIN mst_outlet o ON o.id = u.outlet_id
      ORDER BY u.name`
    );
    // Generate avatar initials
    const users = rows.map((u) => ({
      ...u,
      avatar: u.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    }));
    return res.json({ success: true, data: users });
  } catch (err) {
    console.error('[getAllUsers] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data user.' });
  }
};

// ─── Controller: POST /api/users/register ─────────────────────────────────────
export const registerUser = async (req, res) => {
  try {
    const { name, username, password, role, outlet } = req.body;

    // Validasi
    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama, username, dan password wajib diisi',
      });
    }

    // Cek username sudah ada
    const [existing] = await poolWaschenPos.execute(
      'SELECT id FROM mst_user WHERE username = ?',
      [username.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username sudah digunakan',
      });
    }

    // Hash password dengan bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Get role_id
    const [roleRows] = await poolWaschenPos.execute(
      'SELECT id FROM mst_role WHERE code = ?',
      [role || 'kasir']
    );
    const roleId = roleRows.length > 0 ? roleRows[0].id : null;

    // Get outlet_id jika ada
    let outletId = null;
    if (outlet) {
      const [outletRows] = await poolWaschenPos.execute(
        'SELECT id FROM mst_outlet WHERE name = ?',
        [outlet]
      );
      if (outletRows.length > 0) {
        outletId = outletRows[0].id;
      }
    }

    const id = randomUUID();

    await poolWaschenPos.execute(
      `INSERT INTO mst_user
        (id, name, username, password_hash, primary_role_id, outlet_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [id, name.trim(), username.trim(), passwordHash, roleId, outletId]
    );

    return res.status(201).json({
      success: true,
      message: 'User berhasil ditambahkan',
      data: {
        id,
        name: name.trim(),
        username: username.trim(),
        role: role || 'kasir',
        outlet: outlet || null,
        active: true,
      },
    });
  } catch (err) {
    console.error('[registerUser] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mendaftarkan user.' });
  }
};

// ─── Controller: PATCH /api/users/:id/toggle ───────────────────────────────────
export const toggleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (active === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Status active wajib diisi',
      });
    }

    await poolWaschenPos.execute(
      'UPDATE mst_user SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [active ? 1 : 0, id]
    );

    return res.json({
      success: true,
      message: 'Status user berhasil diubah',
    });
  } catch (err) {
    console.error('[toggleUser] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah status user.' });
  }
};
