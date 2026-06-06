// ─────────────────────────────────────────────────────────────────────────────
// Outlet Operational Cash Controller
// ─────────────────────────────────────────────────────────────────────────────
// Saldo kas operasional terpisah dari revenue laundry.
// - Top-up oleh admin/owner (sumber luar)
// - Expense oleh kasir saja, auto-approve kalau <= AUTO_APPROVE_LIMIT
// - Di atas limit → masuk approval queue admin
// - Rekonsiliasi (cash count manual) bisa dilakukan admin
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { getSettingValue } from './settingsController.js';

const AUTO_APPROVE_LIMIT = 500_000; // Rp 500.000
// Default kalau setting belum ada — tetap diquery dari mst_setting setiap call.
const DEFAULT_MIN_BALANCE = 2_000_000;

const EXPENSE_CATEGORIES = ['gas', 'utility', 'supplies', 'repair', 'transport', 'consumption', 'other'];
const TOPUP_SOURCES = ['cash', 'transfer', 'admin_pocket', 'other'];

const CATEGORY_LABELS = {
  gas: 'Gas / Bahan Bakar',
  utility: 'Listrik & Utilitas',
  supplies: 'Bahan Baku Darurat',
  repair: 'Reparasi Alat',
  transport: 'Transport',
  consumption: 'Konsumsi Karyawan',
  other: 'Lain-lain',
};

const TOPUP_SOURCE_LABELS = {
  cash: 'Tunai',
  transfer: 'Transfer Bank',
  admin_pocket: 'Kas Admin',
  other: 'Lainnya',
};

function fmtCsvDateTime(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtCsvDateOnly(v) {
  if (!v) return '';
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function slugify(s) {
  return String(s || 'semua-outlet')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'outlet';
}

// ════════════════════════════════════════════════════════════════════════════
// Helper: ensure balance row exists, return current balance
// ════════════════════════════════════════════════════════════════════════════
async function ensureBalance(conn, outletId) {
  await conn.execute(
    `INSERT IGNORE INTO mst_outlet_cash_balance (outlet_id, balance) VALUES (?, 0)`,
    [outletId]
  );
  const [rows] = await conn.execute(
    `SELECT balance FROM mst_outlet_cash_balance WHERE outlet_id = ? FOR UPDATE`,
    [outletId]
  );
  return Number(rows[0]?.balance || 0);
}

async function logLedger(conn, { outletId, type, amount, balanceAfter, topupId = null, expenseId = null, notes = null, createdBy = null }) {
  await conn.execute(
    `INSERT INTO tr_outlet_cash_ledger
      (outlet_id, type, amount, balance_after, topup_id, expense_id, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [outletId, type, amount, balanceAfter, topupId, expenseId, notes, createdBy]
  );
}

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/balance — saldo outlet user (atau outlet tertentu utk admin)
// ════════════════════════════════════════════════════════════════════════════
export const getBalance = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isAdmin = ['admin', 'superadmin', 'owner'].includes(userRole);

    const targetOutletId = isAdmin && req.query.outletId
      ? Number(req.query.outletId)
      : userOutletId;

    if (!targetOutletId) {
      return res.status(400).json({ success: false, message: 'Outlet ID wajib.' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT b.outlet_id AS outletId, b.balance, b.last_topup_at, b.last_expense_at,
              b.last_reconcile_at, b.notes, b.updated_at,
              o.name AS outletName
         FROM mst_outlet_cash_balance b
         LEFT JOIN mst_outlet o ON o.id = b.outlet_id
        WHERE b.outlet_id = ?`,
      [targetOutletId]
    );

    if (!rows.length) {
      // Init kalau belum ada
      await poolWaschenPos.execute(
        `INSERT IGNORE INTO mst_outlet_cash_balance (outlet_id, balance) VALUES (?, 0)`,
        [targetOutletId]
      );
      return res.json({ success: true, data: { outletId: targetOutletId, balance: 0 } });
    }

    return res.json({ success: true, data: { ...rows[0], balance: Number(rows[0].balance) } });
  } catch (err) {
    console.error('[getBalance] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil saldo kas.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/balances — semua outlet (untuk admin dashboard)
// ════════════════════════════════════════════════════════════════════════════
export const getAllBalances = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT b.outlet_id AS outletId, o.name AS outletName,
              COALESCE(b.balance, 0) AS balance,
              b.last_topup_at, b.last_expense_at, b.last_reconcile_at, b.updated_at
         FROM mst_outlet o
         LEFT JOIN mst_outlet_cash_balance b ON b.outlet_id = o.id
        WHERE o.deleted_at IS NULL
        ORDER BY o.name ASC`
    );
    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, balance: Number(r.balance || 0) })),
    });
  } catch (err) {
    console.error('[getAllBalances] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil saldo semua outlet.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/outlet-cash/topup — admin top-up saldo outlet
// Body: { outletId, amount, source, referenceNo?, notes? }
// ════════════════════════════════════════════════════════════════════════════
export const topupCash = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { outletId, amount, source = 'transfer', referenceNo = null, notes = null } = req.body || {};
    const numAmount = Math.round(Number(amount));
    if (!outletId || !Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'outletId & amount wajib & positif.' });
    }
    if (!TOPUP_SOURCES.includes(source)) {
      return res.status(400).json({ success: false, message: `Source tidak valid. Pilih: ${TOPUP_SOURCES.join(', ')}` });
    }

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Auth required.' });

    await conn.beginTransaction();

    const balanceBefore = await ensureBalance(conn, outletId);
    const balanceAfter = balanceBefore + numAmount;

    const [topupRes] = await conn.execute(
      `INSERT INTO tr_outlet_cash_topup
        (outlet_id, amount, source, reference_no, notes, topup_by,
         balance_before, balance_after, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [outletId, numAmount, source, referenceNo, notes, userId, balanceBefore, balanceAfter]
    );
    const topupId = topupRes.insertId;

    await conn.execute(
      `UPDATE mst_outlet_cash_balance
          SET balance = ?, last_topup_at = NOW()
        WHERE outlet_id = ?`,
      [balanceAfter, outletId]
    );

    await logLedger(conn, {
      outletId, type: 'topup', amount: numAmount, balanceAfter,
      topupId, notes: notes || `Top-up via ${source}`, createdBy: userId,
    });

    await conn.commit();
    return res.json({
      success: true,
      data: { topupId, outletId, amount: numAmount, balanceBefore, balanceAfter },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('[topupCash] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal top-up kas.' });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/outlet-cash/expense — kasir input pengeluaran
// Body: { amount, category, description, receiptPhotoUrl? }
// Auto-approve kalau <= AUTO_APPROVE_LIMIT, else masuk approval queue
// ════════════════════════════════════════════════════════════════════════════
export const submitExpense = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { amount, category = 'other', description, receiptPhotoUrl = null } = req.body || {};
    const numAmount = Math.round(Number(amount));

    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount harus positif.' });
    }
    if (!EXPENSE_CATEGORIES.includes(String(category))) {
      return res.status(400).json({ success: false, message: `Kategori tidak valid. Pilih: ${EXPENSE_CATEGORIES.join(', ')}` });
    }
    if (!description || String(description).trim() === '') {
      return res.status(400).json({ success: false, message: 'Deskripsi pengeluaran wajib.' });
    }

    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const outletId = req.user?.outletId;
    if (!userId) return res.status(401).json({ success: false, message: 'Auth required.' });
    if (userRole !== 'kasir' && userRole !== 'frontline') {
      return res.status(403).json({ success: false, message: 'Hanya kasir yang bisa input pengeluaran.' });
    }
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'User tidak terikat ke outlet.' });
    }

    await conn.beginTransaction();

    const needsApproval = numAmount > AUTO_APPROVE_LIMIT;

    // Kalau auto-approve, validasi saldo cukup
    if (!needsApproval) {
      const balanceBefore = await ensureBalance(conn, outletId);
      if (balanceBefore < numAmount) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Saldo kas tidak cukup. Saldo: Rp ${balanceBefore.toLocaleString('id-ID')}, dibutuhkan: Rp ${numAmount.toLocaleString('id-ID')}.`,
        });
      }

      const balanceAfter = balanceBefore - numAmount;

      const [expRes] = await conn.execute(
        `INSERT INTO tr_outlet_cash_expense
          (outlet_id, category, amount, description, receipt_photo_url,
           status, requested_by, approved_by, resolved_at,
           balance_before, balance_after, created_at)
         VALUES (?, ?, ?, ?, ?, 'auto_approved', ?, ?, NOW(), ?, ?, NOW())`,
        [outletId, category, numAmount, description, receiptPhotoUrl,
         userId, userId, balanceBefore, balanceAfter]
      );
      const expenseId = expRes.insertId;

      await conn.execute(
        `UPDATE mst_outlet_cash_balance
            SET balance = ?, last_expense_at = NOW()
          WHERE outlet_id = ?`,
        [balanceAfter, outletId]
      );

      await logLedger(conn, {
        outletId, type: 'expense', amount: -numAmount, balanceAfter,
        expenseId, notes: `${category}: ${description}`, createdBy: userId,
      });

      await conn.commit();
      return res.json({
        success: true,
        data: {
          expenseId, status: 'auto_approved', amount: numAmount,
          balanceBefore, balanceAfter, needsApproval: false,
        },
      });
    }

    // Pengeluaran > limit: butuh approval — saldo BELUM dipotong
    const [expRes] = await conn.execute(
      `INSERT INTO tr_outlet_cash_expense
        (outlet_id, category, amount, description, receipt_photo_url,
         status, requested_by, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending_approval', ?, NOW())`,
      [outletId, category, numAmount, description, receiptPhotoUrl, userId]
    );
    const expenseId = expRes.insertId;

    const reason = `${category} — ${description} (Rp ${numAmount.toLocaleString('id-ID')})`;
    const [aprRes] = await conn.execute(
      `INSERT INTO tr_outlet_cash_approval
        (expense_id, outlet_id, amount, status, reason, requested_by, requested_at)
       VALUES (?, ?, ?, 'pending', ?, ?, NOW())`,
      [expenseId, outletId, numAmount, reason, userId]
    );
    const approvalId = aprRes.insertId;

    await conn.execute(
      `UPDATE tr_outlet_cash_expense SET approval_id = ? WHERE id = ?`,
      [approvalId, expenseId]
    );

    await conn.commit();
    return res.json({
      success: true,
      data: {
        expenseId, approvalId, status: 'pending_approval',
        amount: numAmount, needsApproval: true,
        message: `Pengeluaran > Rp ${AUTO_APPROVE_LIMIT.toLocaleString('id-ID')} memerlukan persetujuan admin.`,
      },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('[submitExpense] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mencatat pengeluaran.' });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/outlet-cash/approval/:id — approve/reject expense (admin only)
// Body: { action: 'approve' | 'reject', rejectReason? }
// ════════════════════════════════════════════════════════════════════════════
export const resolveApproval = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { id } = req.params;
    const { action, rejectReason = null } = req.body || {};
    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;

    if (!['admin', 'superadmin', 'owner'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya admin/owner yang bisa approve.' });
    }
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action harus approve atau reject.' });
    }

    await conn.beginTransaction();

    const [aprRows] = await conn.execute(
      `SELECT a.id, a.expense_id, a.outlet_id, a.amount, a.status, a.requested_by,
              e.category, e.description, e.receipt_photo_url
         FROM tr_outlet_cash_approval a
         JOIN tr_outlet_cash_expense e ON e.id = a.expense_id
        WHERE a.id = ? AND a.is_active = 1
        LIMIT 1`,
      [id]
    );

    if (!aprRows.length) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Approval tidak ditemukan.' });
    }
    const apr = aprRows[0];
    if (apr.status !== 'pending') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Approval sudah diproses.' });
    }

    if (action === 'approve') {
      const balanceBefore = await ensureBalance(conn, apr.outlet_id);
      if (balanceBefore < Number(apr.amount)) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Saldo kas tidak cukup. Saldo: Rp ${balanceBefore.toLocaleString('id-ID')}, request: Rp ${Number(apr.amount).toLocaleString('id-ID')}.`,
        });
      }

      const balanceAfter = balanceBefore - Number(apr.amount);

      await conn.execute(
        `UPDATE tr_outlet_cash_approval
            SET status = 'approved', approved_by = ?, resolved_at = NOW()
          WHERE id = ?`,
        [userId, id]
      );

      await conn.execute(
        `UPDATE tr_outlet_cash_expense
            SET status = 'approved', approved_by = ?, resolved_at = NOW(),
                balance_before = ?, balance_after = ?
          WHERE id = ?`,
        [userId, balanceBefore, balanceAfter, apr.expense_id]
      );

      await conn.execute(
        `UPDATE mst_outlet_cash_balance
            SET balance = ?, last_expense_at = NOW()
          WHERE outlet_id = ?`,
        [balanceAfter, apr.outlet_id]
      );

      await logLedger(conn, {
        outletId: apr.outlet_id, type: 'expense',
        amount: -Number(apr.amount), balanceAfter,
        expenseId: apr.expense_id,
        notes: `Approved: ${apr.category}: ${apr.description}`,
        createdBy: userId,
      });

      await conn.commit();
      return res.json({
        success: true,
        data: { status: 'approved', balanceAfter, expenseId: apr.expense_id },
      });
    }

    // Reject
    await conn.execute(
      `UPDATE tr_outlet_cash_approval
          SET status = 'rejected', approved_by = ?, resolved_at = NOW(), reject_reason = ?
        WHERE id = ?`,
      [userId, rejectReason, id]
    );
    await conn.execute(
      `UPDATE tr_outlet_cash_expense
          SET status = 'rejected', approved_by = ?, resolved_at = NOW(), reject_reason = ?
        WHERE id = ?`,
      [userId, rejectReason, apr.expense_id]
    );

    await conn.commit();
    return res.json({
      success: true,
      data: { status: 'rejected', expenseId: apr.expense_id },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('[resolveApproval] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal proses approval.' });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/approvals — list approval pending (admin)
// ════════════════════════════════════════════════════════════════════════════
export const getApprovals = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    if (!['admin', 'superadmin', 'owner'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya admin yang bisa lihat approval.' });
    }

    const status = String(req.query.status || 'pending');
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const params = [];
    let where = 'a.is_active = 1';
    if (['pending', 'approved', 'rejected'].includes(status)) {
      where += ' AND a.status = ?';
      params.push(status);
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT a.id, a.expense_id AS expenseId, a.outlet_id AS outletId, a.amount,
              a.status, a.reason, a.reject_reason AS rejectReason,
              a.requested_at AS requestedAt, a.resolved_at AS resolvedAt,
              o.name AS outletName,
              u.name AS requesterName,
              ru.name AS resolverName,
              e.category, e.description, e.receipt_photo_url AS receiptPhotoUrl
         FROM tr_outlet_cash_approval a
         JOIN tr_outlet_cash_expense e ON e.id = a.expense_id
         JOIN mst_user u ON u.id = a.requested_by
         LEFT JOIN mst_user ru ON ru.id = a.approved_by
         LEFT JOIN mst_outlet o ON o.id = a.outlet_id
        WHERE ${where}
        ORDER BY FIELD(a.status, 'pending', 'approved', 'rejected'), a.requested_at DESC
        LIMIT ${limit}`,
      params
    );

    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, amount: Number(r.amount) })),
    });
  } catch (err) {
    console.error('[getApprovals outlet-cash] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat approval.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/expenses — riwayat pengeluaran outlet
// Query: ?outletId=&startDate=&endDate=&category=&status=&urgency=&search=&page=&limit=
// ════════════════════════════════════════════════════════════════════════════
export const getExpenses = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

    const targetOutletId = isGlobal && req.query.outletId
      ? Number(req.query.outletId)
      : userOutletId;

    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    const params = [];
    let where = 'e.outlet_id IS NOT NULL';

    if (targetOutletId) {
      where += ' AND e.outlet_id = ?';
      params.push(targetOutletId);
    }
    if (req.query.startDate) {
      where += ' AND DATE(e.created_at) >= ?';
      params.push(req.query.startDate);
    }
    if (req.query.endDate) {
      where += ' AND DATE(e.created_at) <= ?';
      params.push(req.query.endDate);
    }
    if (req.query.category && EXPENSE_CATEGORIES.includes(req.query.category)) {
      where += ' AND e.category = ?';
      params.push(req.query.category);
    }
    if (req.query.status) {
      where += ' AND e.status = ?';
      params.push(req.query.status);
    }
    if (req.query.search && String(req.query.search).trim()) {
      where += ' AND (e.description LIKE ? OR u.name LIKE ?)';
      const q = `%${String(req.query.search).trim()}%`;
      params.push(q, q);
    }
    // Filter min/max amount
    if (req.query.minAmount && Number(req.query.minAmount) > 0) {
      where += ' AND e.amount >= ?';
      params.push(Number(req.query.minAmount));
    }
    if (req.query.maxAmount && Number(req.query.maxAmount) > 0) {
      where += ' AND e.amount <= ?';
      params.push(Number(req.query.maxAmount));
    }

    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total
         FROM tr_outlet_cash_expense e
         LEFT JOIN mst_user u ON u.id = e.requested_by
        WHERE ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await poolWaschenPos.execute(
      `SELECT e.id, e.outlet_id AS outletId, e.category, e.amount, e.description,
              e.receipt_photo_url AS receiptPhotoUrl, e.status, e.reject_reason AS rejectReason,
              e.balance_before AS balanceBefore, e.balance_after AS balanceAfter,
              e.created_at AS createdAt, e.resolved_at AS resolvedAt,
              u.name AS requesterName,
              ru.name AS approverName,
              o.name AS outletName
         FROM tr_outlet_cash_expense e
         LEFT JOIN mst_user u ON u.id = e.requested_by
         LEFT JOIN mst_user ru ON ru.id = e.approved_by
         LEFT JOIN mst_outlet o ON o.id = e.outlet_id
        WHERE ${where}
        ORDER BY e.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, amount: Number(r.amount) })),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (err) {
    console.error('[getExpenses] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat pengeluaran.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/topups — riwayat top-up
// ════════════════════════════════════════════════════════════════════════════
export const getTopups = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

    const targetOutletId = isGlobal && req.query.outletId
      ? Number(req.query.outletId)
      : userOutletId;

    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    const params = [];
    let where = '1=1';
    if (targetOutletId) { where += ' AND t.outlet_id = ?'; params.push(targetOutletId); }
    if (req.query.startDate) { where += ' AND DATE(t.created_at) >= ?'; params.push(req.query.startDate); }
    if (req.query.endDate)   { where += ' AND DATE(t.created_at) <= ?'; params.push(req.query.endDate); }

    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM tr_outlet_cash_topup t WHERE ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await poolWaschenPos.execute(
      `SELECT t.id, t.outlet_id AS outletId, t.amount, t.source, t.reference_no AS referenceNo,
              t.notes, t.balance_before AS balanceBefore, t.balance_after AS balanceAfter,
              t.created_at AS createdAt,
              u.name AS topupByName,
              o.name AS outletName
         FROM tr_outlet_cash_topup t
         LEFT JOIN mst_user u ON u.id = t.topup_by
         LEFT JOIN mst_outlet o ON o.id = t.outlet_id
        WHERE ${where}
        ORDER BY t.created_at DESC
        LIMIT ${limitNum} OFFSET ${offset}`,
      params
    );

    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, amount: Number(r.amount) })),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (err) {
    console.error('[getTopups] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat top-up.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/outlet-cash/reconcile — admin set saldo manual (selisih kas fisik)
// Body: { outletId, actualBalance, notes }
// ════════════════════════════════════════════════════════════════════════════
export const reconcileBalance = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const userRole = req.user?.roleCode;
    if (!['admin', 'superadmin', 'owner'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya admin yang bisa rekonsiliasi.' });
    }

    const { outletId, actualBalance, notes } = req.body || {};
    const numActual = Math.round(Number(actualBalance));

    if (!outletId || !Number.isFinite(numActual) || numActual < 0) {
      return res.status(400).json({ success: false, message: 'outletId & actualBalance wajib (>= 0).' });
    }
    if (!notes || String(notes).trim() === '') {
      return res.status(400).json({ success: false, message: 'Notes wajib (alasan rekonsiliasi).' });
    }

    const userId = req.user?.userId;

    await conn.beginTransaction();

    const balanceBefore = await ensureBalance(conn, outletId);
    const diff = numActual - balanceBefore;

    if (diff === 0) {
      await conn.rollback();
      return res.json({
        success: true,
        data: { balance: numActual, diff: 0, message: 'Saldo sudah sesuai, tidak perlu rekonsiliasi.' },
      });
    }

    await conn.execute(
      `UPDATE mst_outlet_cash_balance
          SET balance = ?, last_reconcile_at = NOW(), notes = ?
        WHERE outlet_id = ?`,
      [numActual, notes, outletId]
    );

    const ledgerType = diff > 0 ? 'reconcile_in' : 'reconcile_out';
    await logLedger(conn, {
      outletId, type: ledgerType, amount: diff, balanceAfter: numActual,
      notes: `Rekonsiliasi: ${notes}`, createdBy: userId,
    });

    await conn.commit();
    return res.json({
      success: true,
      data: { balanceBefore, balanceAfter: numActual, diff, message: 'Rekonsiliasi tercatat.' },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('[reconcileBalance] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal rekonsiliasi.' });
  } finally {
    conn.release();
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/ledger — audit ledger detail
// ════════════════════════════════════════════════════════════════════════════
export const getLedger = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);
    const targetOutletId = isGlobal && req.query.outletId
      ? Number(req.query.outletId)
      : userOutletId;

    if (!targetOutletId) return res.status(400).json({ success: false, message: 'outletId wajib.' });

    const limitNum = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const [rows] = await poolWaschenPos.execute(
      `SELECT l.id, l.outlet_id AS outletId, l.type, l.amount,
              l.balance_after AS balanceAfter, l.notes,
              l.topup_id AS topupId, l.expense_id AS expenseId,
              u.name AS createdByName, l.created_at AS createdAt
         FROM tr_outlet_cash_ledger l
         LEFT JOIN mst_user u ON u.id = l.created_by
        WHERE l.outlet_id = ?
        ORDER BY l.created_at DESC
        LIMIT ${limitNum}`,
      [targetOutletId]
    );
    return res.json({
      success: true,
      data: rows.map(r => ({ ...r, amount: Number(r.amount), balanceAfter: Number(r.balanceAfter) })),
    });
  } catch (err) {
    console.error('[getLedger] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat ledger.' });
  }
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/summary — laporan summary per kategori per periode
// ════════════════════════════════════════════════════════════════════════════
export const getSummary = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);
    const targetOutletId = isGlobal && req.query.outletId
      ? Number(req.query.outletId)
      : userOutletId;

    const params = [];
    let where = `e.status IN ('approved', 'auto_approved')`;
    if (targetOutletId) { where += ' AND e.outlet_id = ?'; params.push(targetOutletId); }
    if (req.query.startDate) { where += ' AND DATE(e.created_at) >= ?'; params.push(req.query.startDate); }
    if (req.query.endDate)   { where += ' AND DATE(e.created_at) <= ?'; params.push(req.query.endDate); }

    // ── 1. Breakdown per kategori
    const [byCategory] = await poolWaschenPos.execute(
      `SELECT category, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS totalAmount
         FROM tr_outlet_cash_expense e
        WHERE ${where}
        GROUP BY category
        ORDER BY totalAmount DESC`,
      params
    );

    // ── 2. Total summary
    const [totals] = await poolWaschenPos.execute(
      `SELECT
          COUNT(*) AS totalCount,
          COALESCE(SUM(amount), 0) AS totalExpense,
          COALESCE(SUM(CASE WHEN status = 'auto_approved' THEN amount ELSE 0 END), 0) AS autoApprovedTotal,
          COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS approvedTotal,
          COALESCE(AVG(amount), 0) AS avgAmount,
          COALESCE(MAX(amount), 0) AS maxAmount
        FROM tr_outlet_cash_expense e
        WHERE ${where}`,
      params
    );

    // ── 3. Daily time series (untuk chart)
    const [daily] = await poolWaschenPos.execute(
      `SELECT DATE(e.created_at) AS date,
              COUNT(*) AS count,
              COALESCE(SUM(amount), 0) AS totalAmount
         FROM tr_outlet_cash_expense e
        WHERE ${where}
        GROUP BY DATE(e.created_at)
        ORDER BY date ASC`,
      params
    );

    // ── 4. Top spenders (kasir yang paling banyak input expense)
    const [topSpenders] = await poolWaschenPos.execute(
      `SELECT u.name AS userName, COUNT(*) AS count,
              COALESCE(SUM(e.amount), 0) AS totalAmount
         FROM tr_outlet_cash_expense e
         LEFT JOIN mst_user u ON u.id = e.requested_by
        WHERE ${where}
        GROUP BY e.requested_by, u.name
        ORDER BY totalAmount DESC
        LIMIT 5`,
      params
    );

    // ── 5. Top expenses (transaksi pengeluaran terbesar)
    const [topExpenses] = await poolWaschenPos.execute(
      `SELECT e.id, e.category, e.amount, e.description, e.created_at AS createdAt,
              u.name AS requesterName
         FROM tr_outlet_cash_expense e
         LEFT JOIN mst_user u ON u.id = e.requested_by
        WHERE ${where}
        ORDER BY e.amount DESC
        LIMIT 10`,
      params
    );

    // ── 6. Topup summary di periode yang sama
    const topupParams = [];
    let topupWhere = '1=1';
    if (targetOutletId) { topupWhere += ' AND outlet_id = ?'; topupParams.push(targetOutletId); }
    if (req.query.startDate) { topupWhere += ' AND DATE(created_at) >= ?'; topupParams.push(req.query.startDate); }
    if (req.query.endDate)   { topupWhere += ' AND DATE(created_at) <= ?'; topupParams.push(req.query.endDate); }

    const [topupSum] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS totalAmount
         FROM tr_outlet_cash_topup
        WHERE ${topupWhere}`,
      topupParams
    );

    return res.json({
      success: true,
      data: {
        summary: {
          totalCount: Number(totals[0]?.totalCount || 0),
          totalExpense: Number(totals[0]?.totalExpense || 0),
          autoApprovedTotal: Number(totals[0]?.autoApprovedTotal || 0),
          approvedTotal: Number(totals[0]?.approvedTotal || 0),
          avgAmount: Math.round(Number(totals[0]?.avgAmount || 0)),
          maxAmount: Number(totals[0]?.maxAmount || 0),
          // Topup info
          topupCount: Number(topupSum[0]?.count || 0),
          topupTotal: Number(topupSum[0]?.totalAmount || 0),
          // Net flow
          netCashFlow: Number(topupSum[0]?.totalAmount || 0) - Number(totals[0]?.totalExpense || 0),
        },
        byCategory: byCategory.map(r => ({
          category: r.category,
          count: Number(r.count),
          totalAmount: Number(r.totalAmount),
          // Persentase dari total
          percentage: totals[0]?.totalExpense > 0
            ? Math.round((Number(r.totalAmount) / Number(totals[0].totalExpense)) * 100)
            : 0,
        })),
        daily: daily.map(r => ({
          date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
          count: Number(r.count),
          totalAmount: Number(r.totalAmount),
        })),
        topSpenders: topSpenders.map(r => ({
          userName: r.userName || 'Unknown',
          count: Number(r.count),
          totalAmount: Number(r.totalAmount),
        })),
        topExpenses: topExpenses.map(r => ({
          id: r.id,
          category: r.category,
          amount: Number(r.amount),
          description: r.description,
          createdAt: r.createdAt,
          requesterName: r.requesterName,
        })),
      },
    });
  } catch (err) {
    console.error('[getSummary outlet-cash] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat summary.' });
  }
};

// Export config untuk frontend
export const getCashConfig = async (_req, res) => {
  const minBalance = await getSettingValue('kas_minimum_balance', DEFAULT_MIN_BALANCE);
  return res.json({
    success: true,
    data: {
      autoApproveLimit: AUTO_APPROVE_LIMIT,
      minBalance: Number(minBalance),
      categories: EXPENSE_CATEGORIES,
      topupSources: TOPUP_SOURCES,
    },
  });
};

// ════════════════════════════════════════════════════════════════════════════
// GET /api/outlet-cash/transactions/export — admin export CSV semua transaksi
// Query: ?outletId=&startDate=&endDate=&type=&category=
// ════════════════════════════════════════════════════════════════════════════
export const exportTransactionsCsv = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    if (!['admin', 'superadmin', 'owner', 'finance'].includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Hanya admin/finance.' });
    }

    const { outletId, startDate, endDate, type, category } = req.query;

    let outletLabel = 'Semua Outlet';
    if (outletId) {
      const [oRows] = await poolWaschenPos.execute(
        'SELECT name FROM mst_outlet WHERE id = ? LIMIT 1',
        [Number(outletId)]
      );
      outletLabel = oRows[0]?.name || `Outlet #${outletId}`;
    }

    // Gabungkan top-up + expense sebagai satu list transaksi
    const params = [];
    let topupWhere = '1=1';
    let expenseWhere = `e.status IN ('approved', 'auto_approved')`;
    if (outletId) {
      topupWhere += ' AND t.outlet_id = ?';
      expenseWhere += ' AND e.outlet_id = ?';
      params.push(Number(outletId));
    }
    if (startDate) {
      topupWhere += ' AND DATE(t.created_at) >= ?';
      expenseWhere += ' AND DATE(e.created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      topupWhere += ' AND DATE(t.created_at) <= ?';
      expenseWhere += ' AND DATE(e.created_at) <= ?';
      params.push(endDate);
    }

    const topupParams = [];
    const expenseParams = [];
    if (outletId) { topupParams.push(Number(outletId)); expenseParams.push(Number(outletId)); }
    if (startDate) { topupParams.push(startDate); expenseParams.push(startDate); }
    if (endDate) { topupParams.push(endDate); expenseParams.push(endDate); }
    if (category && EXPENSE_CATEGORIES.includes(category)) {
      expenseWhere += ' AND e.category = ?';
      expenseParams.push(category);
    }

    let combined = [];
    if (!type || type === 'topup' || type === 'all') {
      const [topupRows] = await poolWaschenPos.execute(
        `SELECT 'topup' AS trxType,
                t.id, t.outlet_id AS outletId, o.name AS outletName,
                t.amount, t.source AS category, t.notes AS description,
                t.balance_before AS balanceBefore, t.balance_after AS balanceAfter,
                u.name AS userName, t.created_at AS createdAt
           FROM tr_outlet_cash_topup t
           LEFT JOIN mst_outlet o ON o.id = t.outlet_id
           LEFT JOIN mst_user u ON u.id = t.topup_by
          WHERE ${topupWhere}`,
        topupParams
      );
      combined = combined.concat(topupRows);
    }
    if (!type || type === 'expense' || type === 'all') {
      const [expenseRows] = await poolWaschenPos.execute(
        `SELECT 'expense' AS trxType,
                e.id, e.outlet_id AS outletId, o.name AS outletName,
                e.amount, e.category, e.description,
                e.balance_before AS balanceBefore, e.balance_after AS balanceAfter,
                u.name AS userName, e.created_at AS createdAt
           FROM tr_outlet_cash_expense e
           LEFT JOIN mst_outlet o ON o.id = e.outlet_id
           LEFT JOIN mst_user u ON u.id = e.requested_by
          WHERE ${expenseWhere}`,
        expenseParams
      );
      combined = combined.concat(expenseRows);
    }

    // Sort by createdAt descending
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const escape = (s) => {
      if (s == null) return '';
      const str = String(s).replace(/"/g, '""');
      return /[",\n\r;]/.test(str) ? `"${str}"` : str;
    };

    const outletLabelResolved = outletLabel !== 'Semua Outlet'
      ? outletLabel
      : (combined[0]?.outletName || outletLabel);
    const periodLabel = startDate && endDate
      ? `${fmtCsvDateOnly(startDate)} – ${fmtCsvDateOnly(endDate)}`
      : 'Semua periode';

    let topupTotal = 0;
    let expenseTotal = 0;
    for (const r of combined) {
      if (r.trxType === 'topup') topupTotal += Number(r.amount || 0);
      else expenseTotal += Number(r.amount || 0);
    }
    const netFlow = topupTotal - expenseTotal;

    const lines = [];
    lines.push(['Laporan Kas Operasional — My Waschen'].map(escape).join(','));
    lines.push(['Outlet', outletLabelResolved].map(escape).join(','));
    lines.push(['Periode', periodLabel].map(escape).join(','));
    lines.push(['Diekspor', fmtCsvDateTime(new Date())].map(escape).join(','));
    lines.push('');

    const header = [
      'No', 'Tanggal & Waktu', 'Outlet', 'Tipe Transaksi', 'Kategori',
      'Nominal (Rp)', 'Saldo Sebelum (Rp)', 'Saldo Sesudah (Rp)', 'Deskripsi', 'Oleh',
    ];
    lines.push(header.map(escape).join(','));

    combined.forEach((r, idx) => {
      const isTopup = r.trxType === 'topup';
      const catLabel = isTopup
        ? (TOPUP_SOURCE_LABELS[r.category] || r.category)
        : (CATEGORY_LABELS[r.category] || r.category);
      const nominal = isTopup ? Number(r.amount) : -Number(r.amount);
      lines.push([
        idx + 1,
        fmtCsvDateTime(r.createdAt),
        r.outletName,
        isTopup ? 'Top-up' : 'Pengeluaran',
        catLabel,
        nominal,
        Number(r.balanceBefore || 0),
        Number(r.balanceAfter || 0),
        r.description,
        r.userName,
      ].map(escape).join(','));
    });

    lines.push('');
    lines.push(['', '', '', 'RINGKASAN PERIODE', '', '', '', '', '', ''].map(escape).join(','));
    lines.push(['', '', '', 'Total Top-up', '', topupTotal, '', '', `${combined.filter(r => r.trxType === 'topup').length} transaksi`, ''].map(escape).join(','));
    lines.push(['', '', '', 'Total Pengeluaran', '', -expenseTotal, '', '', `${combined.filter(r => r.trxType === 'expense').length} transaksi`, ''].map(escape).join(','));
    lines.push(['', '', '', 'Net Cash Flow', '', netFlow, '', '', netFlow >= 0 ? 'Surplus' : 'Defisit', ''].map(escape).join(','));

    const csv = '\uFEFF' + lines.join('\r\n');
    const rangePart = startDate && endDate ? `${startDate}_${endDate}` : new Date().toISOString().slice(0, 10);
    const filename = `kas-outlet_${slugify(outletLabelResolved)}_${rangePart}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('[exportTransactionsCsv]', err);
    return res.status(500).json({ success: false, message: 'Gagal export CSV.' });
  }
};
