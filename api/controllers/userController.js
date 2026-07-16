import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { validatePassword, validateEmail } from '../utils/validation.js';
import { notDeleted, softDeleteRecord } from '../utils/softDelete.js';
import logger from '../utils/logger.js';

// ─── Cache cek kolom schema ───────────────────────────────────────────────────
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

// ─── Helper: build SELECT username gracefully ─────────────────────────────────
// Jika kolom username belum ada (migration belum dijalankan), fallback ke email
const usernameSelect = async () => {
  const has = await hasColumn('mst_user', 'username');
  return has ? 'u.username' : 'u.email AS username';
};

// ─── Controller: GET /api/users/me ────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    const uSel = await usernameSelect();
    const hasGenderCol = await hasColumn('mst_user', 'gender');
    const genderSelect = hasGenderCol ? 'u.gender,' : '';
    const [rows] = await poolWaschenPos.execute(
      `SELECT u.id, u.name, ${uSel}, u.email, u.phone, ${genderSelect}
              r.code AS role, o.id AS outletId, o.name AS outletName
       FROM mst_user u
       JOIN mst_role r ON r.id = u.primary_role_id
       LEFT JOIN mst_outlet o ON o.id = u.outlet_id
       WHERE u.id = ? AND u.is_active = 1 LIMIT 1`,
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    const u = rows[0];

    // Ambil photo — graceful jika kolom belum ada
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
        gender:     u.gender || null,
        roleCode:   u.role,
        role:       u.role,
        outletId:   u.outletId,
        outletName: u.outletName,
        outlet: u.outletId ? { id: u.outletId, name: u.outletName } : null,
        avatar: u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      },
    });
  } catch (err) {
    logger.error('Gagal memuat profil', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat profil.' });
  }
};

// ─── Controller: PATCH /api/users/me/profile ──────────────────────────────────
export const updateMyProfile = async (req, res) => {
  try {
    const { name, phone, email, photo, gender } = req.body;
    const { userId } = req.user;

    // Validate gender if provided
    const validGenders = ['male', 'female', 'other', null];
    if (gender !== undefined && !validGenders.includes(gender)) {
      return res.status(400).json({ success: false, message: 'Jenis kelamin tidak valid.' });
    }

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Nama tidak boleh kosong.' });
    }

    try {
      // Try update with gender column
      await poolWaschenPos.execute(
        `UPDATE mst_user SET name = ?, phone = ?, email = ?, photo = ?, gender = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), phone?.trim() || null, email?.trim() || null, photo || null, gender || null, userId]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        // Fallback: gender column not yet migrated
        await poolWaschenPos.execute(
          `UPDATE mst_user SET name = ?, phone = ?, email = ?, updated_at = NOW() WHERE id = ?`,
          [name.trim(), phone?.trim() || null, email?.trim() || null, userId]
        );
      } else if (colErr.code === 'ER_NET_PACKET_TOO_LARGE') {
        return res.status(400).json({ success: false, message: 'Ukuran foto terlalu besar.' });
      } else {
        throw colErr;
      }
    }

    return res.json({
      success: true,
      message: 'Profil berhasil diperbarui.',
      data: { name: name.trim(), phone: phone?.trim() || null, email: email?.trim() || null, photo: photo || null, gender: gender || null },
    });
  } catch (err) {
    logger.error('Gagal memperbarui profil', { error: err.message });
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

    const passErr = validatePassword(newPassword);
    if (passErr) return res.status(400).json({ success: false, message: passErr });

    if (oldPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'Password baru tidak boleh sama dengan password lama.' });
    }

    const [rows] = await poolWaschenPos.execute(
      'SELECT password_hash FROM mst_user WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

    const valid = (oldPassword === rows[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Password lama salah.' });

    await poolWaschenPos.execute(
      'UPDATE mst_user SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPassword, userId]
    );

    return res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err) {
    logger.error('Gagal mengubah password', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
  }
};

// ─── Controller: GET /api/users ───────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const hasDeletedAt = await hasColumn('mst_user', 'deleted_at');
    const hasGenderCol = await hasColumn('mst_user', 'gender');
    const uSel = await usernameSelect();
    const genderSelect = hasGenderCol ? 'u.gender,' : '';

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        u.id,
        u.name,
        ${uSel},
        u.email,
        ${genderSelect}
        r.code AS role,
        u.outlet_id AS outletId,
        o.name AS outlet,
        u.is_active AS active,
        u.created_at AS createdAt
      FROM mst_user u
      LEFT JOIN mst_role r ON r.id = u.primary_role_id
      LEFT JOIN mst_outlet o ON o.id = u.outlet_id
      ${hasDeletedAt ? 'WHERE u.deleted_at IS NULL' : ''}
      ORDER BY u.name`
    );

    const users = rows.map((u) => ({
      ...u,
      gender: u.gender || null,
      avatar: u.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    }));
    return res.json({ success: true, data: users });
  } catch (err) {
    logger.error('Gagal memuat data user', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data user.' });
  }
};

// ─── Controller: POST /api/users/register ─────────────────────────────────────
export const registerUser = async (req, res) => {
  try {
    const { name, username, password, email, role, outletId, outlet, gender } = req.body;

    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'Nama dan password wajib diisi' });
    }

    // Tentukan email efektif
    const effectiveEmail = (email || '').trim() || null;
    // Tentukan username efektif — wajib ada salah satu
    const effectiveUsername = (username || '').trim() || null;

    if (!effectiveEmail && !effectiveUsername) {
      return res.status(400).json({ success: false, message: 'Username atau email wajib diisi' });
    }

    // Validasi email jika diisi
    if (effectiveEmail) {
      const emailErr = validateEmail(effectiveEmail);
      if (emailErr) return res.status(400).json({ success: false, message: emailErr });
    }

    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ success: false, message: passErr });

    const hasUsernameCol = await hasColumn('mst_user', 'username');

    // Cek duplikat email
    if (effectiveEmail) {
      const [existEmail] = await poolWaschenPos.execute(
        'SELECT id FROM mst_user WHERE email = ? LIMIT 1',
        [effectiveEmail]
      );
      if (existEmail.length > 0) {
        return res.status(409).json({ success: false, message: 'Email sudah digunakan' });
      }
    }

    // Cek duplikat username (jika kolom ada)
    if (hasUsernameCol && effectiveUsername) {
      const [existUname] = await poolWaschenPos.execute(
        'SELECT id FROM mst_user WHERE username = ? LIMIT 1',
        [effectiveUsername]
      );
      if (existUname.length > 0) {
        return res.status(409).json({ success: false, message: 'Username sudah digunakan' });
      }
    }

    // Get role_id
    const [roleRows] = await poolWaschenPos.execute(
      'SELECT id FROM mst_role WHERE code = ?',
      [role || 'frontline']
    );
    const roleId = roleRows.length > 0 ? roleRows[0].id : null;

    // Resolve outletId
    let finalOutletId = outletId || null;
    let finalOutletName = outlet || null;
    if (!finalOutletId && outlet) {
      const [outletRows] = await poolWaschenPos.execute(
        'SELECT id FROM mst_outlet WHERE name = ? LIMIT 1',
        [outlet]
      );
      if (outletRows.length > 0) finalOutletId = outletRows[0].id;
    } else if (finalOutletId && !finalOutletName) {
      const [outletRows] = await poolWaschenPos.execute(
        'SELECT name FROM mst_outlet WHERE id = ? LIMIT 1',
        [finalOutletId]
      );
      if (outletRows.length > 0) finalOutletName = outletRows[0].name;
    }

    // Email wajib ada di DB (NOT NULL) — gunakan username sebagai fallback email
    const finalEmail = effectiveEmail || `${effectiveUsername}@waschen.local`;

    const hasGenderCol = await hasColumn('mst_user', 'gender');
    let insertResult;
    if (hasGenderCol && hasUsernameCol) {
      [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO mst_user
          (name, username, email, password_hash, primary_role_id, outlet_id, gender, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [name.trim(), effectiveUsername || finalEmail.split('@')[0], finalEmail, password, roleId, finalOutletId, gender || 'female']
      );
    } else if (hasGenderCol) {
      [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO mst_user
          (name, email, password_hash, primary_role_id, outlet_id, gender, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [name.trim(), finalEmail, password, roleId, finalOutletId, gender || 'female']
      );
    } else if (hasUsernameCol) {
      [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO mst_user
          (name, username, email, password_hash, primary_role_id, outlet_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [name.trim(), effectiveUsername || finalEmail.split('@')[0], finalEmail, password, roleId, finalOutletId]
      );
    } else {
      [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO mst_user
          (name, email, password_hash, primary_role_id, outlet_id, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [name.trim(), finalEmail, password, roleId, finalOutletId]
      );
    }

    const newId = insertResult.insertId;

    return res.status(201).json({
      success: true,
      message: 'User berhasil ditambahkan',
      data: {
        id: newId,
        name: name.trim(),
        username: effectiveUsername || finalEmail.split('@')[0],
        email: finalEmail,
        role: role || 'frontline',
        outlet: finalOutletName,
        outletId: finalOutletId,
        gender: gender || 'female',
        active: true,
      },
    });
  } catch (err) {
    logger.error('Gagal mendaftarkan user', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mendaftarkan user.' });
  }
};

// ─── Controller: PUT /api/users/:id ───────────────────────────────────────────
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, role, outletId, active, gender } = req.body;

    if (!name?.trim() || !role) {
      return res.status(400).json({ success: false, message: 'Nama dan role wajib diisi' });
    }

    const effectiveEmail = (email || '').trim() || null;
    const effectiveUsername = (username || '').trim() || null;

    if (!effectiveEmail && !effectiveUsername) {
      return res.status(400).json({ success: false, message: 'Username atau email wajib diisi' });
    }

    if (effectiveEmail) {
      const emailErr = validateEmail(effectiveEmail);
      if (emailErr) return res.status(400).json({ success: false, message: emailErr });
    }

    const hasDeletedAt = await hasColumn('mst_user', 'deleted_at');
    const hasUsernameCol = await hasColumn('mst_user', 'username');

    const [targetRows] = await poolWaschenPos.execute(
      `SELECT id FROM mst_user WHERE id = ? ${hasDeletedAt ? 'AND deleted_at IS NULL' : ''} LIMIT 1`,
      [id]
    );
    if (targetRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    // Cek duplikat email
    if (effectiveEmail) {
      const [existEmail] = await poolWaschenPos.execute(
        `SELECT id FROM mst_user WHERE email = ? AND id <> ? ${hasDeletedAt ? 'AND deleted_at IS NULL' : ''} LIMIT 1`,
        [effectiveEmail, id]
      );
      if (existEmail.length > 0) {
        return res.status(409).json({ success: false, message: 'Email sudah digunakan.' });
      }
    }

    // Cek duplikat username
    if (hasUsernameCol && effectiveUsername) {
      const [existUname] = await poolWaschenPos.execute(
        `SELECT id FROM mst_user WHERE username = ? AND id <> ? ${hasDeletedAt ? 'AND deleted_at IS NULL' : ''} LIMIT 1`,
        [effectiveUsername, id]
      );
      if (existUname.length > 0) {
        return res.status(409).json({ success: false, message: 'Username sudah digunakan.' });
      }
    }

    const [roleRows] = await poolWaschenPos.execute(
      'SELECT id FROM mst_role WHERE code = ? LIMIT 1',
      [role]
    );
    if (roleRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Role tidak valid.' });
    }

    const finalEmail = effectiveEmail || `${effectiveUsername}@waschen.local`;
    const hasGenderCol = await hasColumn('mst_user', 'gender');

    if (hasGenderCol && hasUsernameCol) {
      await poolWaschenPos.execute(
        `UPDATE mst_user
         SET name = ?, username = ?, email = ?, primary_role_id = ?, outlet_id = ?, gender = ?, is_active = ?, updated_at = NOW()
         WHERE id = ?`,
        [name.trim(), effectiveUsername || finalEmail.split('@')[0], finalEmail, roleRows[0].id, outletId || null, gender || 'female', active === false ? 0 : 1, id]
      );
    } else if (hasGenderCol) {
      await poolWaschenPos.execute(
        `UPDATE mst_user
         SET name = ?, email = ?, primary_role_id = ?, outlet_id = ?, gender = ?, is_active = ?, updated_at = NOW()
         WHERE id = ?`,
        [name.trim(), finalEmail, roleRows[0].id, outletId || null, gender || 'female', active === false ? 0 : 1, id]
      );
    } else if (hasUsernameCol) {
      await poolWaschenPos.execute(
        `UPDATE mst_user
         SET name = ?, username = ?, email = ?, primary_role_id = ?, outlet_id = ?, is_active = ?, updated_at = NOW()
         WHERE id = ?`,
        [name.trim(), effectiveUsername || finalEmail.split('@')[0], finalEmail, roleRows[0].id, outletId || null, active === false ? 0 : 1, id]
      );
    } else {
      await poolWaschenPos.execute(
        `UPDATE mst_user
         SET name = ?, email = ?, primary_role_id = ?, outlet_id = ?, is_active = ?, updated_at = NOW()
         WHERE id = ?`,
        [name.trim(), finalEmail, roleRows[0].id, outletId || null, active === false ? 0 : 1, id]
      );
    }

    const uSel = await usernameSelect();
    const [[updated]] = await poolWaschenPos.execute(
      `SELECT u.id, u.name, ${uSel}, u.email, u.is_active AS active,
              r.code AS role, u.outlet_id AS outletId, o.name AS outlet
       FROM mst_user u
       LEFT JOIN mst_role r ON r.id = u.primary_role_id
       LEFT JOIN mst_outlet o ON o.id = u.outlet_id
       WHERE u.id = ? LIMIT 1`,
      [id]
    );

    return res.json({
      success: true,
      message: 'User berhasil diupdate.',
      data: {
        ...updated,
        gender: gender || 'female',
        avatar: updated.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      },
    });
  } catch (err) {
    logger.error('Gagal mengupdate user', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengupdate user.' });
  }
};

// ─── Controller: PATCH /api/users/:id/toggle ───────────────────────────────────
export const toggleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (active === undefined) {
      return res.status(400).json({ success: false, message: 'Status active wajib diisi' });
    }

    await poolWaschenPos.execute(
      'UPDATE mst_user SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [active ? 1 : 0, id]
    );

    return res.json({ success: true, message: 'Status user berhasil diubah' });
  } catch (err) {
    logger.error('Gagal mengubah status user', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengubah status user.' });
  }
};

// ─── Controller: DELETE /api/users/:id ────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.userId;

    // Bandingkan sebagai string karena id dari JWT bisa number atau string
    if (String(id) === String(requesterId)) {
      return res.status(400).json({ success: false, message: 'Akun Anda sendiri tidak bisa dihapus.' });
    }

    const hasDeletedAt = await hasColumn('mst_user', 'deleted_at');
    const hasUsernameCol = await hasColumn('mst_user', 'username');

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, email FROM mst_user
       WHERE id = ? ${hasDeletedAt ? 'AND deleted_at IS NULL' : ''} LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    const emailSuffix = `deleted_${Date.now()}@deleted.local`;
    const usernameSuffix = `del_${Date.now()}`;

    if (hasDeletedAt) {
      if (hasUsernameCol) {
        await poolWaschenPos.execute(
          `UPDATE mst_user
           SET is_active = 0, deleted_at = NOW(),
               username = LEFT(CONCAT(COALESCE(username, ''), ?), 80),
               email = ?, updated_at = NOW()
           WHERE id = ?`,
          [usernameSuffix, emailSuffix, id]
        );
      } else {
        await poolWaschenPos.execute(
          `UPDATE mst_user
           SET is_active = 0, deleted_at = NOW(), email = ?, updated_at = NOW()
           WHERE id = ?`,
          [emailSuffix, id]
        );
      }
    } else {
      if (hasUsernameCol) {
        await poolWaschenPos.execute(
          `UPDATE mst_user
           SET is_active = 0,
               name = CONCAT('[DELETED] ', name),
               username = LEFT(CONCAT(COALESCE(username, ''), ?), 80),
               email = ?, updated_at = NOW()
           WHERE id = ?`,
          [usernameSuffix, emailSuffix, id]
        );
      } else {
        await poolWaschenPos.execute(
          `UPDATE mst_user
           SET is_active = 0,
               name = CONCAT('[DELETED] ', name),
               email = ?, updated_at = NOW()
           WHERE id = ?`,
          [emailSuffix, id]
        );
      }
    }

    writeAudit(poolWaschenPos, {
      userId: requesterId,
      outletId: req.user?.outletId,
      entityType: 'user',
      entityId: id,
      action: 'delete_user',
      oldData: { email: rows[0].email },
      req,
    }).catch(() => {});

    return res.json({ success: true, message: 'User berhasil dihapus.' });
  } catch (err) {
    logger.error('Gagal menghapus user', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menghapus user.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/users/pic
// Get PIC users (shift partners) for the current user's outlet
// Returns: list of users in the same outlet who can be PIC partners
// ══════════════════════════════════════════════════════════════════════════════
export const getPICUsers = async (req, res) => {
  try {
    const outletId = req.user?.outletId;
    const { role, isActive } = req.query;

    let query = `SELECT u.id, u.username, u.name, r.code AS role_code, u.outlet_id, u.is_active
       FROM mst_user u
       JOIN mst_role r ON r.id = u.primary_role_id
       WHERE u.outlet_id = ? AND u.deleted_at IS NULL`;
    const params = [outletId];

    if (isActive === 'true') {
      query += ' AND u.is_active = 1';
    }
    if (role) {
      const roles = role.split(',').map(r => r.trim()).filter(Boolean);
      if (roles.length > 0) {
        query += ' AND r.code IN (' + roles.map(() => '?').join(',') + ')';
        params.push(...roles);
      }
    }
    query += ' ORDER BY u.name ASC';

    const [users] = await poolWaschenPos.query(query, params);

    return res.json({ success: true, data: users });
  } catch (err) {
    logger.error('Gagal mengambil data PIC users', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengambil data PIC users.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/users/me/activities
// Activity log for profile page
// Returns: recent activities (deposits, transactions, shift events, etc.)
// ══════════════════════════════════════════════════════════════════════════════
export const getMyActivities = async (req, res) => {
  try {
    const userId = req.user?.userId;
    // Clamp limit to safe range
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const activities = [];

    // 1. Cash Deposits
    try {
      const [deposits] = await poolWaschenPos.query(
        `SELECT id, amount, notes, created_at
         FROM tr_cash_deposit
         WHERE cashier_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ${limit}`,
        [userId]
      );
      deposits.forEach(d => {
        activities.push({
          id: `dep_${d.id}`,
          type: 'deposit',
          amount: Number(d.amount || 0),
          description: d.notes || 'Setoran tunai',
          createdAt: d.created_at,
        });
      });
    } catch { /* skip if table doesn't exist */ }

    // 2. Shift Open events
    try {
      const [shifts] = await poolWaschenPos.query(
        `SELECT id, shift, opened_at, status
         FROM tr_cashier_session
         WHERE cashier_id = ? AND deleted_at IS NULL
         ORDER BY opened_at DESC LIMIT ${limit}`,
        [userId]
      );
      shifts.forEach(s => {
        if (s.status === 'open') {
          activities.push({
            id: `shift_open_${s.id}`,
            type: 'shift_open',
            description: `Membuka shift ${s.shift || 'Regular'}`,
            createdAt: s.opened_at,
          });
        }
      });
    } catch { /* skip if table doesn't exist */ }

    // 3. Customer created (from audit log)
    try {
      const [customers] = await poolWaschenPos.query(
        `SELECT id, name, created_at
         FROM mst_customer
         WHERE created_by = ? AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT ${limit}`,
        [userId]
      );
      customers.forEach(c => {
        activities.push({
          id: `cust_${c.id}`,
          type: 'customer_created',
          customerName: c.name,
          description: `Menambah customer baru: ${c.name}`,
          createdAt: c.created_at,
        });
      });
    } catch { /* skip if table doesn't exist */ }

    // 4. Shift handover events (from audit log)
    try {
      const hasDeletedAt = await hasColumn('tr_cashier_session', 'deleted_at');
      const [handoverLogs] = await poolWaschenPos.query(
        `SELECT cs.id, cs.handover_at, cs.handover_notes, u.name AS targetName
         FROM tr_cashier_session cs
         LEFT JOIN mst_user u ON u.id = cs.accepted_by
         WHERE cs.cashier_id = ? AND cs.handover_at IS NOT NULL
           ${hasDeletedAt ? 'AND cs.deleted_at IS NULL' : ''}
         ORDER BY cs.handover_at DESC LIMIT ${limit}`,
        [userId]
      );
      handoverLogs.forEach(h => {
        activities.push({
          id: `handover_${h.id}`,
          type: 'shift_handover',
          targetName: h.targetName || 'Unknown',
          description: `Oper shift ke ${h.targetName || 'Unknown'}`,
          createdAt: h.handover_at,
        });
      });
    } catch { /* skip */ }

    // Sort by date descending and limit
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const finalActivities = activities.slice(0, limit);

    return res.json({ success: true, data: finalActivities });
  } catch (err) {
    logger.error('Gagal mengambil aktivitas', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengambil aktivitas.' });
  }
};
