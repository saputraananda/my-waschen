// ══════════════════════════════════════════════════════════════════════════════
// shiftController.js — Main Shift Management (Kasir Session)
// Complete shift lifecycle: open → operate → handover → close
// Integrated with sub-session for multi-user accountability
// ══════════════════════════════════════════════════════════════════════════════
import { poolWaschenPos } from '../db/connection.js';
import logger from '../utils/logger.js';

const SHIFT_ENUM = new Set(['pagi', 'siang', 'malam', 'full']);
const ADMIN_ROLES = ['admin'];

// ─── Helper: Admin assertion ─────────────────────────────────────────────────
const assertAdmin = (req, res) => {
  if (!ADMIN_ROLES.has(req.user?.roleCode)) {
    res.status(403).json({ success: false, message: 'Hanya admin/finance/owner.' });
    return false;
  }
  return true;
};

// ─── Helper: Get sub-session table existence ─────────────────────────────────
async function hasSubSessionTable() {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tr_cashier_sub_session' LIMIT 1`
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Helper: Get column existence ────────────────────────────────────────────
async function hasColumn(tableName, columnName) {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [tableName, columnName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/status
// Check current shift status for logged-in cashier
// Returns: main session + active sub-session (if exists)
// ══════════════════════════════════════════════════════════════════════════════
export const getShiftStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;

    // User without outlet = bypass (dev environment)
    if (!outletId) {
      return res.status(200).json({
        success: true,
        isOpen: true,
        bypass: true,
        session: null,
        subSession: null,
      });
    }

    // ── Get main session (open only) ────────────────────────────────────────────
    const [mainSessionRows] = await poolWaschenPos.execute(
      `SELECT id, outlet_id, cashier_id, session_date, shift, opened_at, closed_at,
              opening_cash, closing_cash, system_cash, cash_diff, notes, status,
              handover_cash, handover_at, parent_session_id
       FROM tr_cashier_session
       WHERE cashier_id = ? AND status IN ('open', 'handover') AND deleted_at IS NULL
       ORDER BY opened_at DESC
       LIMIT 1`,
      [userId]
    );

    // ── Get last closed session for reference ─────────────────────────────────
    const [lastClosedRows] = await poolWaschenPos.execute(
      `SELECT id, session_date, shift, opened_at, closed_at,
              opening_cash, closing_cash, system_cash, cash_diff, notes
       FROM tr_cashier_session
       WHERE cashier_id = ? AND status = 'closed' AND deleted_at IS NULL
       ORDER BY closed_at DESC
       LIMIT 1`,
      [userId]
    );

    // ── Get active sub-session if table exists ─────────────────────────────────
    let activeSubSession = null;
    const hasSubSession = await hasSubSessionTable();

    if (hasSubSession && mainSessionRows.length > 0) {
      const mainSession = mainSessionRows[0];

      const [subSessionRows] = await poolWaschenPos.execute(
        `SELECT ss.id, ss.opened_at, ss.status, ss.beginning_cash,
                (SELECT COUNT(*) FROM tr_transaction WHERE sub_session_id = ss.id AND deleted_at IS NULL) AS transaction_count
         FROM tr_cashier_sub_session ss
         WHERE ss.cashier_id = ? AND ss.session_id = ? AND ss.status = 'open'
         ORDER BY ss.opened_at DESC
         LIMIT 1`,
        [userId, mainSession.id]
      );

      if (subSessionRows.length > 0) {
        const ss = subSessionRows[0];
        activeSubSession = {
          id: ss.id,
          sessionId: mainSession.id,
          openedAt: ss.opened_at,
          status: ss.status,
          beginningCash: Number(ss.beginning_cash || 0),
          transactionCount: Number(ss.transaction_count || 0),
        };
      }
    }

    // ── Format main session response ───────────────────────────────────────────
    if (mainSessionRows.length > 0) {
      const s = mainSessionRows[0];
      return res.status(200).json({
        success: true,
        isOpen: true,
        bypass: false,
        session: {
          id: s.id,
          outletId: s.outlet_id,
          cashierId: s.cashier_id,
          sessionDate: s.session_date,
          shift: s.shift,
          openedAt: s.opened_at,
          closedAt: s.closed_at,
          openingCash: Number(s.opening_cash || 0),
          status: s.status,
          handoverCash: s.handover_cash ? Number(s.handover_cash) : null,
          handoverAt: s.handover_at || null,
          parentSessionId: s.parent_session_id || null,
        },
        subSession: activeSubSession,
        lastClosedSession: lastClosedRows[0]
          ? {
              id: lastClosedRows[0].id,
              sessionDate: lastClosedRows[0].session_date,
              shift: lastClosedRows[0].shift,
              openedAt: lastClosedRows[0].opened_at,
              closedAt: lastClosedRows[0].closed_at,
              openingCash: Number(lastClosedRows[0].opening_cash ?? 0),
              closingCash: Number(lastClosedRows[0].closing_cash ?? 0),
              systemCash: Number(lastClosedRows[0].system_cash ?? 0),
              cashDiff: Number(lastClosedRows[0].cash_diff ?? 0),
              notes: lastClosedRows[0].notes || null,
            }
          : null,
      });
    }

    return res.status(200).json({
      success: true,
      isOpen: false,
      bypass: false,
      session: null,
      subSession: null,
      lastClosedSession: lastClosedRows[0]
        ? {
            id: lastClosedRows[0].id,
            sessionDate: lastClosedRows[0].session_date,
            shift: lastClosedRows[0].shift,
            openedAt: lastClosedRows[0].opened_at,
            closedAt: lastClosedRows[0].closed_at,
            openingCash: Number(lastClosedRows[0].opening_cash ?? 0),
            closingCash: Number(lastClosedRows[0].closing_cash ?? 0),
            systemCash: Number(lastClosedRows[0].system_cash ?? 0),
            cashDiff: Number(lastClosedRows[0].cash_diff ?? 0),
            notes: lastClosedRows[0].notes || null,
          }
        : null,
    });
  } catch (err) {
    logger.error('Gagal mengecek status shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengecek status shift.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/open
// Buka shift baru untuk kasir
// outletId diambil dari user context (bukan body)
// ══════════════════════════════════════════════════════════════════════════════
export const openShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;
    const { openingCash, shift: shiftRaw, shiftUserName } = req.body;

    if (!outletId) {
      return res.status(400).json({
        success: false,
        message: 'User tidak terikat pada outlet manapun.'
      });
    }

    // Validate shift type
    const shift = SHIFT_ENUM.has(shiftRaw) ? shiftRaw : 'full';

    // Validate opening cash
    const openAmt = openingCash != null ? Number(openingCash) : 0;
    if (!Number.isFinite(openAmt) || openAmt < 0) {
      return res.status(400).json({ success: false, message: 'Modal awal tidak valid.' });
    }

    // Check for existing open session
    const [check] = await poolWaschenPos.execute(
      `SELECT id FROM tr_cashier_session
       WHERE cashier_id = ? AND status IN ('open', 'handover') AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );

    if (check.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Anda masih memiliki sesi operasional yang terbuka.'
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Check if shift_user_name column exists (graceful for pre-migration)
    const hasShiftUserName = await hasColumn('tr_cashier_session', 'shift_user_name');

    let insertResult;
    if (hasShiftUserName && shiftUserName) {
      [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO tr_cashier_session
          (outlet_id, cashier_id, session_date, shift, opened_at, opening_cash, shift_user_name, status)
         VALUES (?, ?, ?, ?, NOW(), ?, ?, 'open')`,
        [outletId, userId, today, shift, openAmt, String(shiftUserName).trim().slice(0, 100)]
      );
    } else {
      [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO tr_cashier_session
          (outlet_id, cashier_id, session_date, shift, opened_at, opening_cash, status)
         VALUES (?, ?, ?, ?, NOW(), ?, 'open')`,
        [outletId, userId, today, shift, openAmt]
      );
    }

    const sessionId = insertResult.insertId;

    return res.status(201).json({
      success: true,
      message: 'Shift berhasil dibuka.',
      data: {
        id: sessionId,
        openedAt: new Date().toISOString(),
        shift,
        openingCash: openAmt,
        shiftUserName: shiftUserName || null,
        sessionDate: today,
        outletId,
      },
    });
  } catch (err) {
    logger.error('Gagal membuka shift', { error: err.message });
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Shift jenis ini sudah pernah dibuka hari ini. Tutup sesi sebelumnya terlebih dahulu.',
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal membuka shift.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/current-summary
// Live payment summary for open shift
// Includes: transaction count, omset, payment breakdown, setor status
// ══════════════════════════════════════════════════════════════════════════════
export const getShiftCurrentSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;

    // Get open session
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, outlet_id, shift, opened_at, opening_cash, status, parent_session_id
       FROM tr_cashier_session
       WHERE cashier_id = ? AND status IN ('open', 'handover') AND deleted_at IS NULL
       ORDER BY opened_at DESC LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: null });
    }

    const session = rows[0];

    // ── Get payment summary filtered by session opened_at ───────────────────────
    const [methodRows] = await poolWaschenPos.execute(
      `SELECT pi.method, COALESCE(SUM(pi.amount), 0) AS total_amount, COUNT(DISTINCT pi.transaction_id) AS tx_count
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ?
         AND t.outlet_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND pi.status = 'paid'
         AND t.created_at >= ?
         AND t.created_at <= NOW()
       GROUP BY pi.method
       ORDER BY total_amount DESC`,
      [userId, session.outlet_id, session.opened_at]
    );

    // ── Get transaction count & omset ──────────────────────────────────────────
    const [txCountRow] = await poolWaschenPos.execute(
      `SELECT COUNT(DISTINCT t.id) AS total_trx, COALESCE(SUM(t.total), 0) AS total_omset
       FROM tr_transaction t
       WHERE t.cashier_id = ?
         AND t.outlet_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND t.created_at >= ?
         AND t.created_at <= NOW()`,
      [userId, session.outlet_id, session.opened_at]
    );

    const paymentSummary = methodRows.map((r) => ({
      method: r.method,
      amount: Number(r.total_amount || 0),
      count: Number(r.tx_count || 0),
    }));

    // ── Get setor summary for today ────────────────────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const [setorRow] = await poolWaschenPos.execute(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'approved' THEN deposit_amount ELSE 0 END), 0) AS totalApproved,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN deposit_amount ELSE 0 END), 0) AS totalPending,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pendingCount
       FROM tr_cash_deposit
       WHERE cashier_id = ? AND outlet_id = ? AND deposit_date = ?`,
      [userId, session.outlet_id, today]
    );

    // ── Get drawer expenses for this session ───────────────────────────────────
    const [drawerRow] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_expense
       FROM tr_cash_drawer
       WHERE session_id = ? AND type = 'out'`,
      [session.id]
    );

    // ── Calculate expected cash position ───────────────────────────────────────
    const openingCash = Number(session.opening_cash || 0);
    const cashSales = paymentSummary.find(p => p.method === 'cash')?.amount || 0;
    const totalExpense = Number(drawerRow[0]?.total_expense || 0);
    const expectedCash = openingCash + cashSales - totalExpense;

    const grandTotal = paymentSummary.reduce((s, p) => s + p.amount, 0);

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        openedAt: session.opened_at,
        shift: session.shift,
        openingCash,
        totalTransactions: Number(txCountRow[0]?.total_trx || 0),
        totalOmset: Number(txCountRow[0]?.total_omset || 0),
        grandTotalPayments: grandTotal,
        cashSales,
        totalExpense,
        expectedCash,
        paymentSummary,
        setorSummary: {
          totalApproved: Number(setorRow[0]?.totalApproved || 0),
          totalPending: Number(setorRow[0]?.totalPending || 0),
          pendingCount: Number(setorRow[0]?.pendingCount || 0),
          hasPending: Number(setorRow[0]?.pendingCount || 0) > 0,
        },
      },
    });
  } catch (err) {
    logger.error('Gagal memuat ringkasan shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat ringkasan shift.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/close
// Tutup shift dan rekonsiliasi kas
// system_cash = opening_cash + cash_sales - expenses
// cash_diff = closing_cash - system_cash
// ══════════════════════════════════════════════════════════════════════════════
export const closeShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { closingCash, notes, photos } = req.body;

    // Get open session
    const [rows] = await poolWaschenPos.execute(
      `SELECT * FROM tr_cashier_session
       WHERE cashier_id = ? AND status = 'open' AND deleted_at IS NULL
       ORDER BY opened_at DESC LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada shift kas yang sedang terbuka.'
      });
    }

    const session = rows[0];

    // ── Check pending setor (warning only, tidak blokir) ──────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const [pendingSetor] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(deposit_amount), 0) AS total
       FROM tr_cash_deposit
       WHERE cashier_id = ? AND outlet_id = ? AND status = 'pending'`,
      [userId, session.outlet_id]
    );
    const pendingSetorCount = Number(pendingSetor[0]?.cnt || 0);
    const pendingSetorTotal = Number(pendingSetor[0]?.total || 0);

    // ── Get cash sales ─────────────────────────────────────────────────────────
    const [txCash] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(pi.amount), 0) AS total_cash
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ?
         AND t.outlet_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND pi.method = 'cash'
         AND pi.status = 'paid'
         AND t.created_at >= ?
         AND t.created_at <= NOW()`,
      [userId, session.outlet_id, session.opened_at]
    );

    // ── Get all payment methods ───────────────────────────────────────────────
    const [methodRows] = await poolWaschenPos.execute(
      `SELECT pi.method, COALESCE(SUM(pi.amount), 0) AS total_amount,
              COUNT(DISTINCT pi.transaction_id) AS tx_count
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ?
         AND t.outlet_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND pi.status = 'paid'
         AND t.created_at >= ?
         AND t.created_at <= NOW()
       GROUP BY pi.method
       ORDER BY total_amount DESC`,
      [userId, session.outlet_id, session.opened_at]
    );

    // ── Calculate cash position ─────────────────────────────────────────────────
    const opening = Number(session.opening_cash);
    const cashSales = Number(txCash[0]?.total_cash || 0);

    // Get drawer expenses for this session
    const [drawerExpenseRow] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_expense
       FROM tr_cash_drawer
       WHERE session_id = ? AND type = 'out'`,
      [session.id]
    );
    const totalExpense = Number(drawerExpenseRow[0]?.total_expense || 0);

    // system_cash = modal awal + penjualan tunai - pengeluaran
    const systemCash = opening + cashSales - totalExpense;

    // Validate closing cash
    const actualCash = closingCash != null ? Number(closingCash) : 0;
    if (!Number.isFinite(actualCash) || actualCash < 0) {
      return res.status(400).json({ success: false, message: 'Jumlah uang fisik tidak valid.' });
    }
    const diff = actualCash - systemCash;

    // ── Serialize photos if provided ──────────────────────────────────────────
    let photosJson = null;
    if (photos && Array.isArray(photos) && photos.length > 0) {
      photosJson = JSON.stringify(photos.map((p) => ({
        label: p.label || 'Bukti Transaksi',
        data: p.data || null,
      })));
    }

    // ── Update session ─────────────────────────────────────────────────────────
    const hasClosingPhotos = await hasColumn('tr_cashier_session', 'closing_photos');

    try {
      if (hasClosingPhotos) {
        await poolWaschenPos.execute(
          `UPDATE tr_cashier_session
           SET status = 'closed', closed_at = NOW(),
               closing_cash = ?, system_cash = ?, cash_diff = ?, notes = ?, closing_photos = ?
           WHERE id = ?`,
          [actualCash, systemCash, diff, notes || null, photosJson, session.id]
        );
      } else {
        await poolWaschenPos.execute(
          `UPDATE tr_cashier_session
           SET status = 'closed', closed_at = NOW(),
               closing_cash = ?, system_cash = ?, cash_diff = ?, notes = ?
           WHERE id = ?`,
          [actualCash, systemCash, diff, notes || null, session.id]
        );
      }
    } catch (updateErr) {
      if (updateErr.code === 'ER_BAD_FIELD_ERROR') {
        // Fallback for pre-migration
        await poolWaschenPos.execute(
          `UPDATE tr_cashier_session
           SET status = 'closed', closed_at = NOW(),
               closing_cash = ?, system_cash = ?, cash_diff = ?, notes = ?
           WHERE id = ?`,
          [actualCash, systemCash, diff, notes || null, session.id]
        );
      } else {
        throw updateErr;
      }
    }

    // ── Get total setor for this session ──────────────────────────────────────
    const [setorTotalRow] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(deposit_amount), 0) AS total FROM tr_cash_deposit
       WHERE cashier_id = ? AND outlet_id = ? AND deposit_date = ? AND status = 'approved'`,
      [userId, session.outlet_id, today]
    );
    const totalSetor = Number(setorTotalRow[0]?.total || 0);

    // ── Update total_setor if column exists ───────────────────────────────────
    try {
      await poolWaschenPos.execute(
        `UPDATE tr_cashier_session SET total_setor = ? WHERE id = ?`,
        [totalSetor, session.id]
      );
    } catch { /* column may not exist yet */ }

    const paymentSummary = methodRows.map((r) => ({
      method: r.method,
      amount: Number(r.total_amount || 0),
      count: Number(r.tx_count || 0),
    }));

    return res.status(200).json({
      success: true,
      message: 'Shift berhasil ditutup dan direkonsiliasi.',
      data: {
        sessionId: session.id,
        openedAt: session.opened_at,
        closedAt: new Date().toISOString(),
        openingCash: opening,
        cashSales,
        totalExpense,
        totalSetor,
        systemCash,
        closingCash: actualCash,
        difference: diff,
        isBalanced: diff === 0,
        paymentSummary,
        pendingSetorWarning: pendingSetorCount > 0 ? {
          count: pendingSetorCount,
          total: pendingSetorTotal,
          message: `Ada ${pendingSetorCount} setor pending (Rp ${pendingSetorTotal.toLocaleString('id-ID')}). Segera minta approval admin.`,
        } : null,
      },
    });
  } catch (err) {
    logger.error('Gagal menutup shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menutup shift.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/sessions
// Admin: Riwayat semua shift dengan filtering
// ══════════════════════════════════════════════════════════════════════════════
export const listShiftSessions = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;

    const { outletId, dateFrom, dateTo } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 150, 1), 500);

    const hasClosingPhotos = await hasColumn('tr_cashier_session', 'closing_photos');
    const photoCol = hasClosingPhotos ? 'cs.closing_photos AS closingPhotos,' : '';

    let sql = `
      SELECT
        cs.id,
        cs.outlet_id AS outletId,
        o.name AS outletName,
        cs.cashier_id AS cashierId,
        u.name AS cashierName,
        cs.session_date AS sessionDate,
        cs.shift,
        cs.opened_at AS openedAt,
        cs.closed_at AS closedAt,
        cs.opening_cash AS openingCash,
        cs.closing_cash AS closingCash,
        cs.system_cash AS systemCash,
        cs.cash_diff AS cashDiff,
        cs.notes,
        cs.total_setor AS totalSetor,
        cs.status,
        ${photoCol}
        cs.handover_cash AS handoverCash,
        cs.handover_at AS handoverAt,
        cs.parent_session_id AS parentSessionId
      FROM tr_cashier_session cs
      JOIN mst_outlet o ON o.id = cs.outlet_id
      JOIN mst_user u ON u.id = cs.cashier_id
      WHERE 1=1
    `;
    const params = [];

    if (outletId) {
      sql += ' AND cs.outlet_id = ?';
      params.push(outletId);
    }
    if (dateFrom) {
      sql += ' AND cs.session_date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND cs.session_date <= ?';
      params.push(dateTo);
    }

    sql += ` ORDER BY cs.opened_at DESC LIMIT ${Number(limit)}`;

    const [rows] = await poolWaschenPos.execute(sql, params);

    // Get payment breakdown per session
    const sessionIds = rows.map((r) => r.id);
    let paymentMap = new Map();
    if (sessionIds.length > 0) {
      const ph = sessionIds.map(() => '?').join(',');
      const [paymentRows] = await poolWaschenPos.execute(
        `SELECT t.session_id AS sessionId, pi.method, SUM(pi.amount) AS total_amount,
                COUNT(DISTINCT t.id) AS tx_count
         FROM tr_transaction t
         JOIN tr_payment_item pi ON pi.transaction_id = t.id
         WHERE t.session_id IN (${ph})
           AND t.deleted_at IS NULL
           AND t.status <> 'cancelled'
           AND pi.status = 'paid'
         GROUP BY t.session_id, pi.method`,
        sessionIds
      );
      paymentRows.forEach(r => {
        const curr = paymentMap.get(r.sessionId) || [];
        curr.push({
          method: r.method,
          amount: Number(r.total_amount || 0),
          count: Number(r.tx_count || 0),
        });
        paymentMap.set(r.sessionId, curr);
      });
    }

    const data = rows.map((r) => {
      let parsedPhotos = [];
      if (r.closingPhotos) {
        try {
          const raw = typeof r.closingPhotos === 'string'
            ? JSON.parse(r.closingPhotos)
            : r.closingPhotos;
          if (Array.isArray(raw)) parsedPhotos = raw;
        } catch { /* keep empty */ }
      }

      return {
        id: r.id,
        outletId: r.outletId,
        outletName: r.outletName,
        cashierId: r.cashierId,
        cashierName: r.cashierName,
        sessionDate: r.sessionDate,
        shift: r.shift,
        openedAt: r.openedAt,
        closedAt: r.closedAt,
        openingCash: Number(r.openingCash ?? 0),
        closingCash: r.closingCash != null ? Number(r.closingCash) : null,
        systemCash: r.systemCash != null ? Number(r.systemCash) : null,
        cashDiff: r.cashDiff != null ? Number(r.cashDiff) : null,
        totalSetor: r.totalSetor != null ? Number(r.totalSetor) : null,
        notes: r.notes,
        status: r.status,
        handoverCash: r.handoverCash != null ? Number(r.handoverCash) : null,
        handoverAt: r.handoverAt,
        parentSessionId: r.parentSessionId,
        closingPhotos: parsedPhotos,
        paymentSummary: paymentMap.get(r.id) || [],
      };
    });

    return res.json({ success: true, data });
  } catch (err) {
    logger.error('Gagal memuat riwayat shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat shift.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/outlet-summary
// Admin: Ringkasan performa per outlet
// ══════════════════════════════════════════════════════════════════════════════
export const getShiftOutletSummary = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;

    const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);
    const dateFrom = req.query.dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        o.id AS outletId,
        o.name AS outletName,
        COUNT(cs.id) AS sessionCount,
        SUM(CASE WHEN cs.status = 'closed' THEN 1 ELSE 0 END) AS closedCount,
        SUM(CASE WHEN cs.status = 'open' THEN 1 ELSE 0 END) AS openCount,
        SUM(CASE WHEN cs.status = 'open' AND cs.opened_at < DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS staleOpenCount,
        AVG(CASE WHEN cs.status = 'closed' THEN ABS(COALESCE(cs.cash_diff, 0)) END) AS avgAbsCashDiff,
        SUM(CASE WHEN cs.status = 'closed' AND ABS(COALESCE(cs.cash_diff, 0)) >= 50000 THEN 1 ELSE 0 END) AS largeDiffCount,
        SUM(CASE WHEN cs.notes IS NOT NULL AND TRIM(cs.notes) <> '' THEN 1 ELSE 0 END) AS notesCount
       FROM mst_outlet o
       LEFT JOIN tr_cashier_session cs ON cs.outlet_id = o.id
         AND cs.session_date >= ? AND cs.session_date <= ?
       WHERE o.is_active = 1
       GROUP BY o.id, o.name`,
      [dateFrom, dateTo]
    );

    const data = rows.map((r) => ({
      outletId: r.outletId,
      outletName: r.outletName,
      sessionCount: Number(r.sessionCount || 0),
      closedCount: Number(r.closedCount || 0),
      openCount: Number(r.openCount || 0),
      staleOpenCount: Number(r.staleOpenCount || 0),
      avgAbsCashDiff: r.avgAbsCashDiff != null ? Number(r.avgAbsCashDiff) : null,
      largeDiffCount: Number(r.largeDiffCount || 0),
      notesCount: Number(r.notesCount || 0),
    }));

    data.sort((a, b) => {
      const av = (x) => (x.avgAbsCashDiff != null ? x.avgAbsCashDiff : Number.POSITIVE_INFINITY);
      const d = av(a) - av(b);
      if (d !== 0) return d;
      return b.closedCount - a.closedCount;
    });

    return res.json({ success: true, data, meta: { dateFrom, dateTo } });
  } catch (err) {
    logger.error('Gagal ringkasan shift per outlet', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal ringkasan shift per outlet.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/export
// Admin: Export data laporan shift (untuk Excel/PDF)
// ══════════════════════════════════════════════════════════════════════════════
export const exportShiftReport = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;

    const { outletId, dateFrom, dateTo } = req.query;
    const from = dateFrom || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = dateTo || new Date().toISOString().slice(0, 10);

    let sql = `
      SELECT
        cs.session_date AS sessionDate,
        o.name AS outletName,
        u.name AS cashierName,
        cs.shift,
        cs.opened_at AS openedAt,
        cs.closed_at AS closedAt,
        cs.opening_cash AS openingCash,
        cs.closing_cash AS closingCash,
        cs.system_cash AS systemCash,
        cs.cash_diff AS cashDiff,
        cs.total_setor AS totalSetor,
        cs.notes,
        cs.status
      FROM tr_cashier_session cs
      JOIN mst_outlet o ON o.id = cs.outlet_id
      JOIN mst_user u ON u.id = cs.cashier_id
      WHERE cs.session_date >= ? AND cs.session_date <= ? AND cs.deleted_at IS NULL
    `;
    const params = [from, to];

    if (outletId) {
      sql += ' AND cs.outlet_id = ?';
      params.push(outletId);
    }
    sql += ' ORDER BY cs.session_date DESC, cs.opened_at DESC';

    const [rows] = await poolWaschenPos.execute(sql, params);

    // Get payment breakdown per session
    const sessionIds = rows.map(r => r.id);
    let paymentMap = {};
    if (sessionIds.length > 0) {
      const ph = sessionIds.map(() => '?').join(',');
      const [paymentRows] = await poolWaschenPos.execute(
        `SELECT t.session_id AS sessionId, pi.method, SUM(pi.amount) AS total
         FROM tr_transaction t
         JOIN tr_payment_item pi ON pi.transaction_id = t.id
         WHERE t.session_id IN (${ph}) AND t.deleted_at IS NULL
           AND t.status <> 'cancelled' AND pi.status = 'paid'
         GROUP BY t.session_id, pi.method`,
        sessionIds
      );
      paymentRows.forEach(r => {
        if (!paymentMap[r.sessionId]) paymentMap[r.sessionId] = {};
        paymentMap[r.sessionId][r.method] = Number(r.total || 0);
      });
    }

    const data = rows.map(r => ({
      sessionDate: r.sessionDate,
      outletName: r.outletName,
      cashierName: r.cashierName,
      shift: r.shift,
      openedAt: r.openedAt,
      closedAt: r.closedAt,
      openingCash: Number(r.openingCash ?? 0),
      cashSales: Number(r.systemCash ?? 0) - Number(r.openingCash ?? 0),
      totalSetor: Number(r.totalSetor ?? 0),
      closingCash: r.closingCash != null ? Number(r.closingCash) : null,
      systemCash: r.systemCash != null ? Number(r.systemCash) : null,
      cashDiff: r.cashDiff != null ? Number(r.cashDiff) : null,
      status: r.status,
      notes: r.notes,
      payments: paymentMap[r.id] || {},
    }));

    return res.json({ success: true, data, meta: { dateFrom: from, dateTo: to } });
  } catch (err) {
    logger.error('Gagal export laporan shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal export laporan shift.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/handover
// Kasir: Oper shift ke produksi
// Status berubah: 'open' → 'handover'
// Produksi terima dengan membuat session baru
// ══════════════════════════════════════════════════════════════════════════════
export const handoverShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { handoverCash, notes } = req.body;

    // Get open session
    const [rows] = await poolWaschenPos.execute(
      `SELECT * FROM tr_cashier_session
       WHERE cashier_id = ? AND status = 'open' AND deleted_at IS NULL
       ORDER BY opened_at DESC LIMIT 1`,
      [userId]
    );
    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada shift yang terbuka.'
      });
    }

    const session = rows[0];
    const amount = handoverCash != null ? Number(handoverCash) : 0;
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'Jumlah uang serah tidak valid.'
      });
    }

    // ── Calculate kasir's cash summary ─────────────────────────────────────────
    // Cash sales = total cash received from transactions
    const [txCash] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(pi.amount), 0) AS total
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ? AND t.outlet_id = ? AND t.deleted_at IS NULL
         AND t.status <> 'cancelled' AND pi.method = 'cash' AND pi.status = 'paid'
         AND t.created_at >= ?`,
      [userId, session.outlet_id, session.opened_at]
    );

    // All payment methods
    const [methodRows] = await poolWaschenPos.execute(
      `SELECT pi.method, COALESCE(SUM(pi.amount), 0) AS total,
              COUNT(DISTINCT pi.transaction_id) AS cnt
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ? AND t.outlet_id = ? AND t.deleted_at IS NULL
         AND t.status <> 'cancelled' AND pi.status = 'paid'
         AND t.created_at >= ?
       GROUP BY pi.method`,
      [userId, session.outlet_id, session.opened_at]
    );

    // Drawer expenses
    const [drawerRow] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM tr_cash_drawer
       WHERE session_id = ? AND type = 'out'`,
      [session.id]
    );

    // ── Calculate system cash ───────────────────────────────────────────────────
    // system_cash = opening_cash + cash_sales - expenses
    // CRITICAL: opening_cash SUDAH termasuk handover dari shift sebelumnya (jika ada)
    const opening = Number(session.opening_cash);
    const cashSales = Number(txCash[0]?.total || 0);
    const expenses = Number(drawerRow[0]?.total || 0);
    const systemCash = opening + cashSales - expenses;
    const diff = amount - systemCash;

    // ── Update session to handover status ──────────────────────────────────────
    await poolWaschenPos.execute(
      `UPDATE tr_cashier_session
       SET status = 'handover', handover_cash = ?, handover_at = NOW(),
           handover_notes = ?, system_cash = ?, cash_diff = ?, closing_cash = ?
       WHERE id = ?`,
      [amount, notes || null, systemCash, diff, amount, session.id]
    );

    const paymentSummary = methodRows.map(r => ({
      method: r.method,
      amount: Number(r.total),
      count: Number(r.cnt),
    }));

    return res.status(200).json({
      success: true,
      message: 'Shift berhasil dioper ke produksi.',
      data: {
        sessionId: session.id,
        handoverCash: amount,
        systemCash,
        difference: diff,
        cashSales,
        expenses,
        openingCash: opening,
        expectedCash: systemCash,
        paymentSummary,
      },
    });
  } catch (err) {
    logger.error('Gagal oper shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal oper shift.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/accept-handover
// Produksi: Terima operan dari kasir, buat session baru
// ══════════════════════════════════════════════════════════════════════════════
export const acceptHandover = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;
    const { sessionId, acceptedCash } = req.body;

    if (!outletId) {
      return res.status(400).json({
        success: false,
        message: 'User tidak terikat outlet.'
      });
    }

    // Check session is in handover status
    const [[session]] = await poolWaschenPos.execute(
      `SELECT cs.*, u.name AS kasirName FROM tr_cashier_session cs
       JOIN mst_user u ON u.id = cs.cashier_id
       WHERE cs.id = ? AND cs.outlet_id = ? AND cs.status = 'handover' AND cs.accepted_by IS NULL`,
      [sessionId, outletId]
    );
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Sesi operan tidak ditemukan atau sudah diterima.'
      });
    }

    // Check produksi doesn't already have an open session
    const [existingOpen] = await poolWaschenPos.execute(
      `SELECT id FROM tr_cashier_session
       WHERE cashier_id = ? AND status = 'open' AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    if (existingOpen.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Anda sudah punya shift yang terbuka.'
      });
    }

    // Accepted cash bisa berbeda dari handover cash (jika ada selisih)
    const accepted = acceptedCash != null ? Number(acceptedCash) : Number(session.handover_cash || 0);

    // Mark handover as accepted
    await poolWaschenPos.execute(
      `UPDATE tr_cashier_session
       SET accepted_cash = ?, accepted_by = ?, accepted_at = NOW() WHERE id = ?`,
      [accepted, userId, session.id]
    );

    // Create new session for produksi
    const today = new Date().toISOString().slice(0, 10);
    const [newSession] = await poolWaschenPos.execute(
      `INSERT INTO tr_cashier_session
        (outlet_id, cashier_id, session_date, shift, opened_at, opening_cash, status, parent_session_id)
       VALUES (?, ?, ?, 'produksi', NOW(), ?, 'open', ?)`,
      [outletId, userId, today, accepted, session.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Operan diterima. Shift produksi dimulai.',
      data: {
        parentSessionId: session.id,
        newSessionId: newSession.insertId,
        openingCash: accepted,
        kasirHandoverCash: Number(session.handover_cash || 0),
        kasirName: session.kasirName,
        difference: accepted - Number(session.handover_cash || 0),
      },
    });
  } catch (err) {
    logger.error('Gagal terima operan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal terima operan.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/pending-handover
// Produksi: Cek apakah ada operan yang menunggu di outlet ini
// ══════════════════════════════════════════════════════════════════════════════
export const getPendingHandover = async (req, res) => {
  try {
    const outletId = req.user?.outletId;
    if (!outletId) return res.json({ success: true, data: null });

    const [rows] = await poolWaschenPos.execute(
      `SELECT cs.id, cs.handover_cash, cs.handover_at, cs.handover_notes,
              cs.session_date, cs.opened_at, cs.system_cash, cs.cash_diff,
              u.name AS kasirName
       FROM tr_cashier_session cs
       JOIN mst_user u ON u.id = cs.cashier_id
       WHERE cs.outlet_id = ? AND cs.status = 'handover' AND cs.accepted_by IS NULL
       ORDER BY cs.handover_at DESC LIMIT 1`,
      [outletId]
    );

    if (rows.length === 0) return res.json({ success: true, data: null });

    const r = rows[0];
    return res.json({
      success: true,
      data: {
        sessionId: r.id,
        handoverCash: Number(r.handover_cash || 0),
        handoverAt: r.handover_at,
        handoverNotes: r.handover_notes,
        systemCash: Number(r.system_cash || 0),
        cashDiff: Number(r.cash_diff || 0),
        kasirName: r.kasirName,
        sessionDate: r.session_date,
        openedAt: r.opened_at,
      },
    });
  } catch (err) {
    logger.error('Gagal cek operan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal cek operan.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/my-stats
// Stats for profile page - by period
// Returns: totalShifts, totalTransactions, totalRevenue
// ══════════════════════════════════════════════════════════════════════════════
export const getMyStats = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [userId];

    if (start_date) {
      dateFilter += ' AND cs.opened_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ' AND cs.opened_at <= ?';
      params.push(end_date);
    }

    // Get shift count
    const [shiftRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS totalShifts
       FROM tr_cashier_session cs
       WHERE cs.cashier_id = ? AND cs.status = 'closed' AND cs.deleted_at IS NULL${dateFilter}`,
      params
    );

    // Get transaction count and total revenue
    const [txRows] = await poolWaschenPos.execute(
      `SELECT COUNT(DISTINCT t.id) AS totalTransactions,
              COALESCE(SUM(t.total), 0) AS totalRevenue
       FROM tr_transaction t
       JOIN tr_cashier_session cs ON cs.id = t.session_id
       WHERE cs.cashier_id = ? AND t.deleted_at IS NULL
         AND t.status NOT IN ('cancelled', 'pending')${dateFilter}`,
      params
    );

    return res.json({
      success: true,
      data: {
        totalShifts: Number(shiftRows[0]?.totalShifts || 0),
        totalTransactions: Number(txRows[0]?.totalTransactions || 0),
        totalRevenue: Number(txRows[0]?.totalRevenue || 0),
      },
    });
  } catch (err) {
    logger.error('Gagal mengambil statistik shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengambil statistik.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/my-history
// Shift history for profile page
// Returns: list of closed shifts with details
// ══════════════════════════════════════════════════════════════════════════════
export const getMyHistory = async (req, res) => {
  try {
    const userId = req.user?.userId;
    // Clamp limit to safe range and convert to number
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));

    // Use query() instead of execute() for LIMIT clause to avoid type issues
    const [rows] = await poolWaschenPos.query(
      `SELECT cs.id, cs.session_date, cs.shift, cs.opened_at, cs.closed_at,
              cs.opening_cash, cs.closing_cash, cs.system_cash, cs.cash_diff,
              cs.status, u.name AS cashierName
       FROM tr_cashier_session cs
       JOIN mst_user u ON u.id = cs.cashier_id
       WHERE cs.cashier_id = ? AND cs.deleted_at IS NULL
       ORDER BY cs.closed_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    const data = rows.map(r => ({
      id: r.id,
      openedAt: r.opened_at,
      closedAt: r.closed_at,
      shiftType: r.shift || 'Regular',
      cashierName: r.cashierName,
      openingCash: Number(r.opening_cash || 0),
      closingCash: Number(r.closing_cash || 0),
      systemCash: Number(r.system_cash || 0),
      cashDiff: Number(r.cash_diff || 0),
      status: r.status,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    logger.error('Gagal mengambil riwayat shift', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengambil riwayat shift.' });
  }
};
