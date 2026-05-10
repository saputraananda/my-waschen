import { poolWaschenPos } from '../db/connection.js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const schemaColumnCache = new Map();
const hasColumn = async (tableName, columnName) => {
  const key = `${tableName}.${columnName}`;
  if (schemaColumnCache.has(key)) return schemaColumnCache.get(key);
  const [rows] = await poolWaschenPos.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  const exists = rows.length > 0;
  schemaColumnCache.set(key, exists);
  return exists;
};

// ─── Controller: GET /api/users/me ────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT u.id, u.name, u.username, u.phone, u.email,
              r.code AS role, o.id AS outletId, o.name AS outletName
       FROM mst_user u
       JOIN mst_role r ON r.id = u.primary_role_id
       LEFT JOIN mst_outlet o ON o.id = u.outlet_id
       WHERE u.id = ? AND u.is_active = 1 LIMIT 1`,
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    const u = rows[0];

    // Ambil photo — graceful jika kolom belum ada (DDL patch belum dijalankan)
    let photo = null;
    try {
      const [[photoRow]] = await poolWaschenPos.execute(
        'SELECT photo FROM mst_user WHERE id = ? LIMIT 1', [u.id]
      );
      photo = photoRow?.photo || null;
    } catch { /* kolom belum ada */ }

    return res.json({
      success: true,
      data: {
        userId:     u.id,
        name:       u.name,
        username:   u.username,
        phone:      u.phone || null,
        email:      u.email || null,
        photo,
        roleCode:   u.role,
        role:       u.role,
        outletId:   u.outletId,
        outletName: u.outletName,
        outlet: u.outletId ? { id: u.outletId, name: u.outletName } : null,
        avatar: u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      },
    });
  } catch (err) {
    console.error('[getMe] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat profil.' });
  }
};

// ─── Controller: PATCH /api/users/me/profile ──────────────────────────────────
export const updateMyProfile = async (req, res) => {
  try {
    const { name, phone, email, photo } = req.body;
    const { userId } = req.user;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Nama tidak boleh kosong.' });
    }

    // Update name, phone, email (kolom sudah ada); coba sertakan photo, fallback jika belum ada
    try {
      console.log(`[updateMyProfile] Trying to update with photo. Length:`, photo ? photo.length : 0);
      await poolWaschenPos.execute(
        `UPDATE mst_user SET name = ?, phone = ?, email = ?, photo = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), phone?.trim() || null, email?.trim() || null, photo || null, userId]
      );
      console.log(`[updateMyProfile] Update photo SUCCESS`);
    } catch (colErr) {
      console.error(`[updateMyProfile] Error updating photo:`, colErr.code, colErr.message);
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        console.log(`[updateMyProfile] Falling back to update without photo`);
        await poolWaschenPos.execute(
          `UPDATE mst_user SET name = ?, phone = ?, email = ?, updated_at = NOW() WHERE id = ?`,
          [name.trim(), phone?.trim() || null, email?.trim() || null, userId]
        );
      } else if (colErr.code === 'ER_NET_PACKET_TOO_LARGE') {
        return res.status(400).json({ success: false, message: 'Ukuran foto terlalu besar untuk disimpan di database (Packet too large).' });
      } else {
        throw colErr;
      }
    }

    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data: { name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null, photo: photo || null },
    });
  } catch (err) {
    console.error('[updateMyProfile] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui profil.' });
  }
};

// ─── Controller: PATCH /api/users/me/password ─────────────────────────────────
export const changeMyPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { userId } = req.user;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Password lama dan baru wajib diisi.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter.' });
    }

    const [rows] = await poolWaschenPos.execute(
      'SELECT password_hash FROM mst_user WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Password lama salah.' });

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await poolWaschenPos.execute(
      'UPDATE mst_user SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newHash, userId]
    );

    return res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    console.error('[changeMyPassword] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
  }
};

// ─── Controller: GET /api/users ───────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('mst_user', 'deleted_at');
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        u.id,
        u.name,
        u.username,
        u.email,
        r.code AS role,
        o.name AS outlet,
        u.is_active AS active,
        u.created_at AS createdAt
      FROM mst_user u
      LEFT JOIN mst_role r ON r.id = u.primary_role_id
      LEFT JOIN mst_outlet o ON o.id = u.outlet_id
      ${hasDeletedAt ? 'WHERE u.deleted_at IS NULL' : ''}
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
    const { name, username, password, email, role, outletId, outlet } = req.body;

    // Validasi
    if (!name || !username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nama, username, email, dan password wajib diisi',
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

    // Cek dan gunakan outletId dari req.body jika ada
    let finalOutletId = outletId; 

    if (!finalOutletId && outlet) {
      const [outletRows] = await poolWaschenPos.execute(
        'SELECT id FROM mst_outlet WHERE name = ?',
        [outlet]
      );
      if (outletRows.length > 0) {
        finalOutletId = outletRows[0].id;
      }
    }

    const id = randomUUID();

    await poolWaschenPos.execute(
      `INSERT INTO mst_user
        (id, name, username, email, password_hash, primary_role_id, outlet_id, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [id, name.trim(), username.trim(), email.trim(), passwordHash, roleId, finalOutletId || null]
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

// ─── Controller: PUT /api/users/:id ───────────────────────────────────────────
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, role, outletId, active } = req.body;

    if (!name?.trim() || !username?.trim() || !email?.trim() || !role) {
      return res.status(400).json({
        success: false,
        message: 'Nama, username, email, dan role wajib diisi',
      });
    }

    const hasDeletedAt = await hasColumn('mst_user', 'deleted_at');
    const [targetRows] = await poolWaschenPos.execute(
      `SELECT id FROM mst_user
       WHERE id = ?
       ${hasDeletedAt ? 'AND deleted_at IS NULL' : ''}
       LIMIT 1`,
      [id]
    );
    if (targetRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    const [existing] = await poolWaschenPos.execute(
      `SELECT id FROM mst_user
       WHERE username = ? AND id <> ?
       ${hasDeletedAt ? 'AND deleted_at IS NULL' : ''}
       LIMIT 1`,
      [username.trim(), id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
    }

    const [roleRows] = await poolWaschenPos.execute(
      'SELECT id FROM mst_role WHERE code = ? LIMIT 1',
      [role]
    );
    if (roleRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Role tidak valid.' });
    }

    await poolWaschenPos.execute(
      `UPDATE mst_user
       SET name = ?, username = ?, email = ?, primary_role_id = ?, outlet_id = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        name.trim(),
        username.trim(),
        email.trim(),
        roleRows[0].id,
        outletId || null,
        active === false ? 0 : 1,
        id,
      ]
    );

    const [[updated]] = await poolWaschenPos.execute(
      `SELECT
        u.id, u.name, u.username, u.email, u.is_active AS active,
        r.code AS role, o.name AS outlet
       FROM mst_user u
       LEFT JOIN mst_role r ON r.id = u.primary_role_id
       LEFT JOIN mst_outlet o ON o.id = u.outlet_id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

    return res.json({
      success: true,
      message: 'User berhasil diupdate.',
      data: {
        ...updated,
        avatar: updated.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      },
    });
  } catch (err) {
    console.error('[updateUser] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengupdate user.' });
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

// ─── Controller: DELETE /api/users/:id ────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.userId;

    if (id === requesterId) {
      return res.status(400).json({ success: false, message: 'Akun Anda sendiri tidak bisa dihapus.' });
    }

    const hasDeletedAt = await hasColumn('mst_user', 'deleted_at');
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, username, email FROM mst_user
       WHERE id = ?
       ${hasDeletedAt ? 'AND deleted_at IS NULL' : ''}
       LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    const usernameSuffix = `_del_${Date.now().toString().slice(-6)}`;
    const emailSuffix = `deleted_${Date.now()}@deleted.local`;

    if (hasDeletedAt) {
      await poolWaschenPos.execute(
        `UPDATE mst_user
         SET is_active = 0,
             deleted_at = NOW(),
             username = LEFT(CONCAT(username, ?), 60),
             email = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [usernameSuffix, emailSuffix, id]
      );
    } else {
      await poolWaschenPos.execute(
        `UPDATE mst_user
         SET is_active = 0,
             name = CONCAT('[DELETED] ', name),
             username = LEFT(CONCAT(username, ?), 60),
             email = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [usernameSuffix, emailSuffix, id]
      );
    }

    return res.json({ success: true, message: 'User berhasil dihapus.' });
  } catch (err) {
    console.error('[deleteUser] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus user.' });
  }
};
