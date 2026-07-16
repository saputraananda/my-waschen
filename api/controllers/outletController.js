import { poolWaschenPos } from '../db/connection.js';
import logger from '../utils/logger.js';

// ─── GET /api/outlets/admin/all ───────────────────────────────────────────────
// Admin-only: list semua outlet dengan stats (termasuk nonaktif).
// Outlet yang sudah dihapus (deleted_at IS NOT NULL) tidak ditampilkan.
export const getOutletsAdmin = async (req, res) => {
  try {
    const [outlets] = await poolWaschenPos.execute(
      `SELECT
        o.id, o.outlet_code AS outletCode, o.name, o.address, o.phone, o.email,
        o.is_active AS isActive, o.created_at AS createdAt
       FROM mst_outlet o
       WHERE o.deleted_at IS NULL
       ORDER BY o.name`
    );

    // Enrich with stats
    const enriched = await Promise.all(outlets.map(async (o) => {
      // Service count: global now (same for all outlets)
      const [[svc]] = await poolWaschenPos.execute(
        'SELECT COUNT(*) AS cnt FROM mst_service WHERE is_active = 1 AND deleted_at IS NULL'
      );
      const [[team]] = await poolWaschenPos.execute(
        'SELECT COUNT(*) AS cnt FROM mst_user WHERE outlet_id = ? AND is_active = 1', [o.id]
      );
      const [[txMonth]] = await poolWaschenPos.execute(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS revenue
         FROM tr_transaction
         WHERE outlet_id = ? AND deleted_at IS NULL AND status <> 'cancelled'
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
        [o.id]
      );
      const [[target]] = await poolWaschenPos.execute(
        `SELECT target_amount FROM mst_outlet_target
         WHERE deleted_at IS NULL AND outlet_id = ? AND period_year = YEAR(CURDATE()) AND period_month = MONTH(CURDATE())
         LIMIT 1`,
        [o.id]
      ).catch(() => [[null]]);

      return {
        ...o,
        isActive: !!o.isActive,
        serviceCount: Number(svc?.cnt || 0),
        teamCount: Number(team?.cnt || 0),
        monthlyTxCount: Number(txMonth?.cnt || 0),
        monthlyRevenue: Number(txMonth?.revenue || 0),
        targetAmount: target?.target_amount ? Number(target.target_amount) : null,
      };
    }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    logger.error('Gagal memuat data outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data outlet.' });
  }
};

// ─── PUT /api/outlets/:id ─────────────────────────────────────────────────────
// Admin-only: update outlet info
export const updateOutlet = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, email, outletCode } = req.body;

    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (address !== undefined) { fields.push('address = ?'); values.push(address); }
    if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
    if (email !== undefined) { fields.push('email = ?'); values.push(email); }
    if (outletCode !== undefined) { fields.push('outlet_code = ?'); values.push(outletCode); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });
    }

    fields.push('updated_at = NOW()');
    values.push(id);

    await poolWaschenPos.execute(
      `UPDATE mst_outlet SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return res.json({ success: true, message: 'Outlet berhasil diperbarui.' });
  } catch (err) {
    logger.error('Gagal memperbarui outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memperbarui outlet.' });
  }
};

// ─── PATCH /api/outlets/:id/toggle ────────────────────────────────────────────
// Admin-only: toggle aktif/nonaktif outlet.
// IMPORTANT: nonaktif ≠ hapus.
//   - Toggle hanya ubah is_active (0/1).
//   - User & data lain TIDAK ikut diubah.
//   - deleted_at TIDAK ikut di-set (itu wewenang DELETE endpoint).
export const toggleOutletActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Pastikan outlet ada (dan belum dihapus)
    const [[outlet]] = await poolWaschenPos.execute(
      'SELECT id, name, deleted_at FROM mst_outlet WHERE id = ? LIMIT 1',
      [id]
    );
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet tidak ditemukan.' });
    }
    if (outlet.deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'Outlet sudah dihapus. Untuk mengaktifkan kembali, restore lewat admin database.',
      });
    }

    await poolWaschenPos.execute(
      'UPDATE mst_outlet SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [isActive ? 1 : 0, id]
    );

    return res.json({
      success: true,
      message: `Outlet "${outlet.name}" ${isActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
    });
  } catch (err) {
    logger.error('Gagal mengubah status outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengubah status outlet.' });
  }
};

// ─── DELETE /api/outlets/:id ──────────────────────────────────────────────────
// Admin-only: soft delete outlet (arsipkan).
// Idempotent: kalau outlet sudah deleted_at, tetap return success.
export const deleteOutlet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || null;

    // Cek outlet (termasuk yang sudah deleted)
    const [[outlet]] = await poolWaschenPos.execute(
      'SELECT id, name, deleted_at FROM mst_outlet WHERE id = ?',
      [id]
    );
    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet tidak ditemukan.' });
    }

    // Idempotent: kalau sudah dihapus, anggap sukses
    if (outlet.deleted_at) {
      return res.json({ success: true, message: `Outlet "${outlet.name}" sudah dihapus sebelumnya.` });
    }

    // Cek ada transaksi aktif (belum selesai) di outlet ini
    const [[activeTx]] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS cnt FROM tr_transaction
       WHERE outlet_id = ? AND deleted_at IS NULL
         AND status NOT IN ('completed', 'cancelled', 'ready_for_pickup', 'ready_for_delivery')`,
      [id]
    );
    if (activeTx.cnt > 0) {
      return res.status(409).json({
        success: false,
        message: `Outlet "${outlet.name}" masih memiliki ${activeTx.cnt} transaksi aktif. Selesaikan terlebih dahulu sebelum menghapus outlet.`,
      });
    }

    // Soft delete
    await poolWaschenPos.execute(
      'UPDATE mst_outlet SET is_active = 0, deleted_at = NOW(), deleted_by = ?, updated_at = NOW() WHERE id = ?',
      [userId, id]
    );

    // Juga nonaktifkan semua user di outlet ini
    await poolWaschenPos.execute(
      'UPDATE mst_user SET is_active = 0, updated_at = NOW() WHERE outlet_id = ? AND is_active = 1',
      [id]
    );

    return res.json({ success: true, message: `Outlet "${outlet.name}" berhasil dihapus.` });
  } catch (err) {
    logger.error('Gagal menghapus outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menghapus outlet.' });
  }
};

// ─── POST /api/outlets ────────────────────────────────────────────────────────
// Admin-only: create new outlet (otomatis cascade: area zone default, kas balance, copy services dari outlet referensi)
export const createOutlet = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { name, outletCode, address, phone, email } = req.body;
    if (!name || !outletCode) {
      return res.status(400).json({ success: false, message: 'Nama dan kode outlet wajib diisi.' });
    }

    await conn.beginTransaction();

    // 1. Insert outlet
    const [result] = await conn.execute(
      `INSERT INTO mst_outlet (outlet_code, name, address, phone, email, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [outletCode, name, address || null, phone || null, email || null]
    );
    const newOutletId = result.insertId;

    // 2. Init kas balance (saldo 0)
    await conn.execute(
      `INSERT IGNORE INTO mst_outlet_cash_balance (outlet_id, balance, created_at, updated_at)
       VALUES (?, 0, NOW(), NOW())`,
      [newOutletId]
    );

    // 3. Buat area zone default (Zona 1, 2, 3, Lainnya)
    const defaultZones = [
      ['ZONE-1',     'Zona 1 (0-3 km)',  0, 10000],
      ['ZONE-2',     'Zona 2 (3-7 km)',  0, 15000],
      ['ZONE-3',     'Zona 3 (7-12 km)', 0, 25000],
      ['ZONE-OTHER', 'Lainnya',          1,     0],
    ];
    for (const [code, zname, isOther, fee] of defaultZones) {
      await conn.execute(
        `INSERT IGNORE INTO mst_area_zone (outlet_id, code, name, is_other, delivery_fee, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [newOutletId, code, zname, isOther, fee]
      );
    }

    // 4. Seed tr_outlet_service for the new outlet (services are global now)
    const [svcResult] = await conn.execute(
      `INSERT IGNORE INTO tr_outlet_service (outlet_id, service_id, sort_order_override)
       SELECT ?, s.id, s.sort_order
       FROM mst_service s
       WHERE s.is_active = 1 AND s.deleted_at IS NULL`,
      [newOutletId]
    );
    const copiedServices = svcResult.affectedRows;

    // 5. Copy inventory stock awal dari semua inventory item aktif
    let copiedStock = 0;
    try {
      const [inventoryItems] = await conn.execute(
        `SELECT id, min_stock_default, default_cost
           FROM mst_inventory_item WHERE is_active = 1 AND deleted_at IS NULL`
      );
      for (const it of inventoryItems) {
        try {
          await conn.execute(
            `INSERT IGNORE INTO mst_inventory_outlet_stock
             (outlet_id, inventory_id, stock_qty, min_stock, last_cost, last_updated_at)
             VALUES (?, ?, 0, ?, ?, NOW())`,
            [newOutletId, it.id, it.min_stock_default || 0, it.default_cost || 0]
          );
          copiedStock++;
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* tabel inventory mungkin belum lengkap */ }

    await conn.commit();

    return res.status(201).json({
      success: true,
      data: {
        id: newOutletId,
        cascaded: {
          areaZones: defaultZones.length,
          servicesCopied: copiedServices,
          stockInitialized: copiedStock,
        },
      },
      message: `Outlet berhasil dibuat${copiedServices > 0 ? ` dengan ${copiedServices} layanan otomatis ter-copy` : ''}.`,
    });
  } catch (err) {
    try { await conn.rollback(); } catch { /* ignore */ }
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Kode outlet sudah digunakan.' });
    }
    logger.error('Gagal membuat outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal membuat outlet.' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/outlets/:id ─────────────────────────────────────────────────────
export const getOutletDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [[outlet]] = await poolWaschenPos.execute(
      `SELECT
        o.id, o.outlet_code AS outletCode, o.name, o.address, o.phone, o.email,
        o.npwp, o.latitude, o.longitude, o.is_active AS isActive,
        o.created_at AS createdAt, o.updated_at AS updatedAt
       FROM mst_outlet o
       WHERE o.id = ?
       LIMIT 1`,
      [id]
    );

    if (!outlet) {
      return res.status(404).json({ success: false, message: 'Outlet tidak ditemukan.' });
    }

    // Count services (active & not deleted)
    const [[svcCount]] = await poolWaschenPos.execute(
      'SELECT COUNT(*) AS cnt FROM mst_service WHERE is_active = 1 AND deleted_at IS NULL'
    );

    // Count team members (active & not deleted)
    const [[teamCount]] = await poolWaschenPos.execute(
      'SELECT COUNT(*) AS cnt FROM mst_user WHERE outlet_id = ? AND is_active = 1 AND deleted_at IS NULL',
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...outlet,
        isActive: !!outlet.isActive,
        serviceCount: Number(svcCount.cnt || 0),
        teamCount: Number(teamCount.cnt || 0),
      },
    });
  } catch (err) {
    logger.error('Gagal memuat detail outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat detail outlet.' });
  }
};

// ─── GET /api/outlets/:id/team ────────────────────────────────────────────────
export const getOutletTeam = async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah kolom username ada
    const [colCheck] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_user' AND COLUMN_NAME = 'username'
       LIMIT 1`
    );
    const uSel = colCheck.length > 0 ? 'u.username,' : 'u.email AS username,';

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        u.id, u.name, ${uSel} u.email, u.phone, u.is_active AS isActive,
        r.code AS roleCode, r.name AS roleName,
        u.created_at AS createdAt
       FROM mst_user u
       JOIN mst_role r ON r.id = u.primary_role_id
       WHERE u.outlet_id = ? AND u.is_active = 1
       ORDER BY r.code, u.name`,
      [id]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('Gagal memuat tim outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat tim outlet.' });
  }
};

// ─── GET /api/outlets/:id/kas ─────────────────────────────────────────────────
export const getOutletKasBalance = async (req, res) => {
  try {
    const { id } = req.params;

    // Sum up kas kasir from all closed sessions + currently open sessions
    // Kas = total opening_cash of open sessions + cash sales during open sessions
    const [[openSession]] = await poolWaschenPos.execute(
      `SELECT
        cs.id AS sessionId,
        cs.cashier_id AS cashierId,
        u.name AS cashierName,
        cs.opening_cash AS openingCash,
        cs.opened_at AS openedAt
       FROM tr_cashier_session cs
       JOIN mst_user u ON u.id = cs.cashier_id
       WHERE cs.outlet_id = ? AND cs.status = 'open'
       ORDER BY cs.opened_at DESC
       LIMIT 1`,
      [id]
    );

    let currentCash = 0;
    let cashierName = null;

    if (openSession) {
      // Calculate cash sales during this session
      const [[cashSales]] = await poolWaschenPos.execute(
        `SELECT COALESCE(SUM(pi.amount), 0) AS total
         FROM tr_payment_item pi
         JOIN tr_transaction t ON t.id = pi.transaction_id
         WHERE t.outlet_id = ?
           AND t.deleted_at IS NULL
           AND t.status <> 'cancelled'
           AND pi.method = 'cash'
           AND pi.status = 'paid'
           AND COALESCE(pi.paid_at, pi.recorded_at) >= ?
           AND COALESCE(pi.paid_at, pi.recorded_at) <= NOW()`,
        [id, openSession.openedAt]
      );

      currentCash = Number(openSession.openingCash || 0) + Number(cashSales.total || 0);
      cashierName = openSession.cashierName;
    }

    // Total kas from last 30 days closed sessions (for history context)
    const [recentSessions] = await poolWaschenPos.execute(
      `SELECT
        cs.id, cs.session_date AS sessionDate,
        u.name AS cashierName,
        cs.opening_cash AS openingCash,
        cs.closing_cash AS closingCash,
        cs.system_cash AS systemCash,
        cs.cash_diff AS cashDiff,
        cs.opened_at AS openedAt,
        cs.closed_at AS closedAt,
        cs.status
       FROM tr_cashier_session cs
       JOIN mst_user u ON u.id = cs.cashier_id
       WHERE cs.outlet_id = ?
         AND cs.session_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY cs.opened_at DESC
       LIMIT 20`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        currentCash,
        cashierName,
        hasOpenSession: !!openSession,
        recentSessions: recentSessions.map((s) => ({
          id: s.id,
          sessionDate: s.sessionDate,
          cashierName: s.cashierName,
          openingCash: Number(s.openingCash ?? 0),
          closingCash: s.closingCash != null ? Number(s.closingCash) : null,
          systemCash: s.systemCash != null ? Number(s.systemCash) : null,
          cashDiff: s.cashDiff != null ? Number(s.cashDiff) : null,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          status: s.status,
        })),
      },
    });
  } catch (err) {
    logger.error('Gagal memuat saldo kas outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat saldo kas outlet.' });
  }
};
