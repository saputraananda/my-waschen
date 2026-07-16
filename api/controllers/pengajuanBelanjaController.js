// ─────────────────────────────────────────────────────────────────────────────
// Pengajuan Belanja Controller
// Unified controller for expense/purchase requests
// Consolidates: Petty Cash + Kas Operasional + AP Request
//
// Business Logic:
// - Kasir submits request (1 or more items)
// - ≤ Rp 500.000: auto-approve (auto_approved)
// - > Rp 500.000: requires admin approval (pending)
// - Admin approves/rejects
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('PengajuanBelanja');

const AUTO_APPROVE_LIMIT = 500_000;
const FRONTLINER_ROLES = ['frontline'];
const ADMIN_ROLES = ['admin'];

// ─── Helper: Generate Request Number ────────────────────────────────────────────
async function generateRequestNo(conn, outletId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const outletCode = String(outletId).padStart(2, '0');

  const [rows] = await conn.execute(
    `SELECT request_no FROM tr_pengajuan_belanja
     WHERE request_no LIKE ? AND DATE(created_at) = CURDATE()
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`PB-${dateStr}-%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].request_no;
    const match = lastNo.match(/PB-\d{8}-(\d{3})$/);
    if (match) seq = parseInt(match[1], 10) + 1;
  }

  return `PB-${dateStr}-${String(seq).padStart(3, '0')}`;
}

// ─── Helper: Calculate total from items ───────────────────────────────────────
function calculateTotal(items) {
  return items.reduce((sum, item) => {
    const qty = parseFloat(item.qty) || 1;
    const price = parseFloat(item.estimatedPrice) || 0;
    return sum + (qty * price);
  }, 0);
}

// ─── GET /api/pengajuan-belanja/categories ───────────────────────────────────
export const getCategories = async (req, res) => {
  try {
    const { groupType } = req.query;

    let query = 'SELECT * FROM mst_pengajuan_category WHERE is_active = 1';
    const params = [];

    if (groupType) {
      query += ' AND group_type = ?';
      params.push(groupType);
    }

    query += ' ORDER BY group_type, id';

    const [rows] = await poolWaschenPos.execute(query, params);

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    logger.error('[getCategories] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil kategori' });
  }
};

// ─── POST /api/pengajuan-belanja ────────────────────────────────────────────
export const createPengajuan = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const {
      items, // Array of { categoryId, itemName, qty, unit, estimatedPrice }
      description,
      periodMonth,
      periodYear,
      picName,
      receiptPhotoUrl,
    } = req.body;

    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const outletId = req.user?.outletId;

    // Validation
    if (!FRONTLINER_ROLES.includes(userRole)) {
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya kasir yang bisa membuat pengajuan' });
    }

    if (!outletId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'User tidak terikat ke outlet' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Minimal harus ada 1 item' });
    }

    // Validate each item
    for (const item of items) {
      if (!item.categoryId) {
        conn.release();
        return res.status(400).json({ success: false, message: 'Kategori wajib dipilih untuk semua item' });
      }
      if (!item.itemName || item.itemName.trim().length < 2) {
        conn.release();
        return res.status(400).json({ success: false, message: 'Nama item minimal 2 karakter' });
      }
      if (!item.estimatedPrice || parseFloat(item.estimatedPrice) <= 0) {
        conn.release();
        return res.status(400).json({ success: false, message: 'Harga estimasi harus lebih dari 0' });
      }
    }

    await conn.beginTransaction();

    // Generate request number
    const requestNo = await generateRequestNo(conn, outletId);

    // Calculate total
    const totalAmount = calculateTotal(items);
    const needsApproval = totalAmount > AUTO_APPROVE_LIMIT;

    // Resolve PIC
    const resolvedPicName = picName || req.user?.name || req.user?.fullName || 'Unknown';
    const resolvedPicId = userId;

    // Determine source type based on first item category
    const [firstCat] = await conn.execute(
      'SELECT group_type FROM mst_pengajuan_category WHERE id = ?',
      [items[0].categoryId]
    );
    const sourceType = firstCat.length > 0 ? (firstCat[0].group_type || 'operational') : 'operational';

    // Insert main request
    const [insertResult] = await conn.execute(
      `INSERT INTO tr_pengajuan_belanja
        (request_no, outlet_id, requested_by, pic_id, pic_name, total_amount,
         description, period_month, period_year, status, needs_approval, source_type, receipt_photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestNo,
        outletId,
        userId,
        resolvedPicId,
        resolvedPicName,
        totalAmount,
        description || null,
        periodMonth || null,
        periodYear || null,
        needsApproval ? 'pending' : 'auto_approved',
        needsApproval ? 1 : 0,
        sourceType,
        receiptPhotoUrl || null,
      ]
    );

    const pengajuanId = insertResult.insertId;

    // Insert items
    for (const item of items) {
      const qty = parseFloat(item.qty) || 1;
      const estimatedPrice = parseFloat(item.estimatedPrice);
      const totalPrice = qty * estimatedPrice;

      await conn.execute(
        `INSERT INTO tr_pengajuan_belanja_item
          (pengajuan_id, category_id, item_name, qty, unit, estimated_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pengajuanId,
          item.categoryId,
          item.itemName.trim(),
          qty,
          item.unit || 'pcs',
          estimatedPrice,
          totalPrice,
        ]
      );
    }

    await writeAudit(conn, {
      userId,
      outletId,
      entityType: 'pengajuan_belanja',
      entityId: pengajuanId,
      action: 'create',
      newData: { requestNo, totalAmount, itemCount: items.length, needsApproval },
      req,
      picId: resolvedPicId,
      picName: resolvedPicName,
    });

    await conn.commit();

    logger.info('[createPengajuan]', { pengajuanId, requestNo, totalAmount, needsApproval, by: resolvedPicName });

    return res.status(201).json({
      success: true,
      message: needsApproval
        ? `Pengajuan berhasil. Total Rp ${totalAmount.toLocaleString('id-ID')} memerlukan persetujuan admin.`
        : 'Pengajuan berhasil (auto-approve)',
      data: {
        id: pengajuanId,
        requestNo,
        totalAmount,
        status: needsApproval ? 'pending' : 'auto_approved',
        needsApproval,
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[createPengajuan] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal membuat pengajuan' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/pengajuan-belanja ──────────────────────────────────────────────
export const getPengajuans = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      outletId,
      status,
      categoryId,
      groupType, // 'operasional' or 'tagihan'
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isAdmin = ADMIN_ROLES.includes(userRole);

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offsetNum = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions = ['1=1'];
    const params = [];

    // Boundary enforcement
    if (!isAdmin && userOutletId) {
      conditions.push('p.outlet_id = ?');
      params.push(userOutletId);
    } else if (outletId) {
      conditions.push('p.outlet_id = ?');
      params.push(outletId);
    }

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (dateFrom) {
      conditions.push('DATE(p.created_at) >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('DATE(p.created_at) <= ?');
      params.push(dateTo);
    }

    if (search) {
      conditions.push('(p.request_no LIKE ? OR p.description LIKE ? OR pi.item_name LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (categoryId) {
      conditions.push('pi.category_id = ?');
      params.push(categoryId);
    }

    // Filter by group_type (Uang Kas = 'operasional', Biaya AP = 'tagihan')
    if (groupType) {
      conditions.push('EXISTS (SELECT 1 FROM tr_pengajuan_belanja_item pi2 JOIN mst_pengajuan_category c2 ON pi2.category_id = c2.id WHERE pi2.pengajuan_id = p.id AND c2.group_type = ?)');
      params.push(groupType);
    }

    const whereClause = conditions.join(' AND ');

    // Query with items
    const [rows] = await poolWaschenPos.execute(
      `SELECT p.*,
              o.name as outlet_name,
              u.name as requester_name,
              au.name as approver_name
       FROM tr_pengajuan_belanja p
       LEFT JOIN mst_outlet o ON p.outlet_id = o.id
       LEFT JOIN mst_user u ON p.requested_by = u.id
       LEFT JOIN mst_user au ON p.approved_by = au.id
       WHERE ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offsetNum]
    );

    // Get items for each pengajuan
    for (const row of rows) {
      const [items] = await poolWaschenPos.execute(
        `SELECT pi.*, c.name as category_name, c.code as category_code, c.icon as category_icon, c.color as category_color, c.group_type as category_group_type
         FROM tr_pengajuan_belanja_item pi
         JOIN mst_pengajuan_category c ON pi.category_id = c.id
         WHERE pi.pengajuan_id = ?
         ORDER BY pi.id`,
        [row.id]
      );
      row.items = items;
    }

    // Count
    const [countResult] = await poolWaschenPos.execute(
      `SELECT COUNT(DISTINCT p.id) as total
       FROM tr_pengajuan_belanja p
       LEFT JOIN tr_pengajuan_belanja_item pi ON p.id = pi.pengajuan_id
       WHERE ${whereClause}`,
      params
    );

    // Summary by status (with optional groupType filter)
    const summaryConditions = ['1=1'];
    const summaryParams = [];

    if (!isAdmin && userOutletId) {
      summaryConditions.push('p.outlet_id = ?');
      summaryParams.push(userOutletId);
    } else if (outletId) {
      summaryConditions.push('p.outlet_id = ?');
      summaryParams.push(outletId);
    }

    if (groupType) {
      summaryConditions.push('EXISTS (SELECT 1 FROM tr_pengajuan_belanja_item pi2 JOIN mst_pengajuan_category c2 ON pi2.category_id = c2.id WHERE pi2.pengajuan_id = p.id AND c2.group_type = ?)');
      summaryParams.push(groupType);
    }

    const [summary] = await poolWaschenPos.execute(
      `SELECT
        p.status,
        COUNT(*) as count,
        COALESCE(SUM(p.total_amount), 0) as total_amount
       FROM tr_pengajuan_belanja p
       WHERE ${summaryConditions.join(' AND ')}
       GROUP BY p.status`,
      summaryParams
    );

    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, total_amount: parseFloat(r.total_amount) })),
      summary: summary.map(s => ({
        status: s.status,
        count: parseInt(s.count),
        total_amount: parseFloat(s.total_amount),
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limitNum),
      },
    });

  } catch (error) {
    logger.error('[getPengajuans] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data' });
  }
};

// ─── GET /api/pengajuan-belanja/:id ─────────────────────────────────────────
export const getPengajuanById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isAdmin = ADMIN_ROLES.includes(userRole);

    const [rows] = await poolWaschenPos.execute(
      `SELECT p.*,
              o.name as outlet_name,
              u.name as requester_name,
              au.name as approver_name
       FROM tr_pengajuan_belanja p
       LEFT JOIN mst_outlet o ON p.outlet_id = o.id
       LEFT JOIN mst_user u ON p.requested_by = u.id
       LEFT JOIN mst_user au ON p.approved_by = au.id
       WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }

    const pengajuan = rows[0];

    // Boundary check
    if (!isAdmin && pengajuan.outlet_id !== userOutletId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    // Get items
    const [items] = await poolWaschenPos.execute(
      `SELECT pi.*, c.name as category_name, c.code as category_code, c.icon as category_icon, c.color as category_color
       FROM tr_pengajuan_belanja_item pi
       JOIN mst_pengajuan_category c ON pi.category_id = c.id
       WHERE pi.pengajuan_id = ?
       ORDER BY pi.id`,
      [id]
    );

    pengajuan.items = items;

    return res.json({ success: true, data: pengajuan });

  } catch (error) {
    logger.error('[getPengajuanById] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail' });
  }
};

// ─── PATCH /api/pengajuan-belanja/:id/approve ────────────────────────────────
export const approvePengajuan = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { approvalNotes } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    if (!ADMIN_ROLES.includes(userRole)) {
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat approve' });
    }

    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM tr_pengajuan_belanja WHERE id = ? AND status = "pending" FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan atau sudah diproses' });
    }

    const pengajuan = rows[0];

    await conn.execute(
      `UPDATE tr_pengajuan_belanja
       SET status = 'approved', approved_by = ?, approved_at = NOW(), approval_notes = ?
       WHERE id = ?`,
      [userId, approvalNotes || null, id]
    );

    await writeAudit(conn, {
      userId,
      outletId: pengajuan.outlet_id,
      entityType: 'pengajuan_belanja',
      entityId: id,
      action: 'approve',
      oldData: { status: 'pending' },
      newData: { status: 'approved', approvalNotes },
      req,
    });

    await conn.commit();

    logger.info('[approvePengajuan]', { id, by: req.user?.name });

    return res.json({
      success: true,
      message: 'Pengajuan berhasil diapprove',
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[approvePengajuan] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal approve pengajuan' });
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/pengajuan-belanja/:id/reject ────────────────────────────────
export const rejectPengajuan = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { reason, approvalNotes } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    if (!ADMIN_ROLES.includes(userRole)) {
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat reject' });
    }

    if (!reason || reason.trim().length < 3) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Alasan tolak minimal 3 karakter' });
    }

    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM tr_pengajuan_belanja WHERE id = ? AND status = "pending" FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan atau sudah diproses' });
    }

    const pengajuan = rows[0];

    await conn.execute(
      `UPDATE tr_pengajuan_belanja
       SET status = 'rejected', approved_by = ?, approved_at = NOW(), approval_notes = ?
       WHERE id = ?`,
      [userId, `Rejected: ${reason}`, id]
    );

    await writeAudit(conn, {
      userId,
      outletId: pengajuan.outlet_id,
      entityType: 'pengajuan_belanja',
      entityId: id,
      action: 'reject',
      oldData: { status: 'pending' },
      newData: { status: 'rejected', reason },
      req,
    });

    await conn.commit();

    logger.info('[rejectPengajuan]', { id, by: req.user?.name, reason });

    return res.json({
      success: true,
      message: 'Pengajuan berhasil ditolak',
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[rejectPengajuan] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal reject pengajuan' });
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/pengajuan-belanja/:id/cancel ─────────────────────────────────
export const cancelPengajuan = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isAdmin = ADMIN_ROLES.includes(userRole);

    await conn.beginTransaction();

    const [rows] = await conn.execute(
      'SELECT * FROM tr_pengajuan_belanja WHERE id = ? FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });
    }

    const pengajuan = rows[0];

    // Check ownership
    if (!isAdmin && pengajuan.requested_by !== userId) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya pemilik pengajuan yang bisa membatalkan' });
    }

    // Only pending/auto_approved can be cancelled
    if (!['pending', 'auto_approved'].includes(pengajuan.status)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, message: 'Pengajuan sudah diproses tidak bisa dibatalkan' });
    }

    await conn.execute(
      `UPDATE tr_pengajuan_belanja SET status = 'cancelled' WHERE id = ?`,
      [id]
    );

    await writeAudit(conn, {
      userId,
      outletId: pengajuan.outlet_id,
      entityType: 'pengajuan_belanja',
      entityId: id,
      action: 'cancel',
      oldData: { status: pengajuan.status },
      newData: { status: 'cancelled' },
      req,
    });

    await conn.commit();

    logger.info('[cancelPengajuan]', { id, by: req.user?.name });

    return res.json({
      success: true,
      message: 'Pengajuan berhasil dibatalkan',
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[cancelPengajuan] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal membatalkan pengajuan' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/pengajuan-belanja/dashboard ────────────────────────────────────
export const getDashboard = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isAdmin = ADMIN_ROLES.includes(userRole);

    const conditions = ['1=1'];
    const params = [];

    if (!isAdmin && userOutletId) {
      conditions.push('p.outlet_id = ?');
      params.push(userOutletId);
    }

    const whereClause = conditions.join(' AND ');

    // Status summary
    const [statusSummary] = await poolWaschenPos.execute(
      `SELECT
        p.status,
        COUNT(*) as count,
        COALESCE(SUM(p.total_amount), 0) as total_amount
       FROM tr_pengajuan_belanja p
       WHERE ${whereClause}
       GROUP BY p.status`,
      params
    );

    // Category breakdown
    const [categorySummary] = await poolWaschenPos.execute(
      `SELECT
        c.id, c.name, c.code, c.icon, c.color,
        COUNT(pi.id) as item_count,
        COALESCE(SUM(pi.total_price), 0) as total_amount
       FROM mst_pengajuan_category c
       LEFT JOIN tr_pengajuan_belanja_item pi ON c.id = pi.category_id
       LEFT JOIN tr_pengajuan_belanja p ON pi.pengajuan_id = p.id AND ${whereClause}
       WHERE c.is_active = 1
       GROUP BY c.id, c.name, c.code, c.icon, c.color
       ORDER BY total_amount DESC`,
      params
    );

    // Recent requests
    const [recent] = await poolWaschenPos.execute(
      `SELECT p.*, o.name as outlet_name
       FROM tr_pengajuan_belanja p
       LEFT JOIN mst_outlet o ON p.outlet_id = o.id
       WHERE ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT 10`,
      params
    );

    // Pending approval count (for admin)
    let pendingApprovalCount = 0;
    if (isAdmin) {
      const [pending] = await poolWaschenPos.execute(
        `SELECT COUNT(*) as count FROM tr_pengajuan_belanja WHERE status = 'pending'`,
        []
      );
      pendingApprovalCount = pending[0].count;
    }

    return res.json({
      success: true,
      data: {
        statusSummary: statusSummary.map(s => ({
          status: s.status,
          count: parseInt(s.count),
          total_amount: parseFloat(s.total_amount),
        })),
        categorySummary,
        recent,
        pendingApprovalCount,
      },
    });

  } catch (error) {
    logger.error('[getDashboard] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil dashboard' });
  }
};

// ─── GET /api/pengajuan-belanja/config ───────────────────────────────────────
export const getConfig = async (req, res) => {
  return res.json({
    success: true,
    data: {
      autoApproveLimit: AUTO_APPROVE_LIMIT,
      currency: 'IDR',
    },
  });
};
