import { randomUUID } from 'crypto';
import { poolWaschenPos } from '../db/connection.js';

const SHIFT_ENUM = new Set(['pagi', 'siang', 'malam', 'full']);
const ADMIN_ROLES = new Set(['admin', 'finance', 'superadmin', 'owner']);

const assertAdmin = (req, res) => {
  if (!ADMIN_ROLES.has(req.user?.roleCode)) {
    res.status(403).json({ success: false, message: 'Hanya admin/finance/owner.' });
    return false;
  }
  return true;
};

// ─── GET /api/shifts/status ────────────────────────────────────────────────
export const getShiftStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;

    if (!outletId) {
      return res.status(200).json({
        success: true,
        isOpen: true,
        bypass: true,
        session: null,
      });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, outlet_id, cashier_id, session_date, shift, opened_at, closed_at,
              opening_cash, closing_cash, system_cash, cash_diff, notes, status, created_at, updated_at
       FROM tr_cashier_session
       WHERE cashier_id = ? AND status = 'open'
       ORDER BY opened_at DESC
       LIMIT 1`,
      [userId]
    );

    const [lastClosedRows] = await poolWaschenPos.execute(
      `SELECT id, session_date, shift, opened_at, closed_at, opening_cash, closing_cash, system_cash, cash_diff, notes
       FROM tr_cashier_session
       WHERE cashier_id = ? AND status = 'closed'
       ORDER BY closed_at DESC
       LIMIT 1`,
      [userId]
    );

    if (rows.length > 0) {
      const s = rows[0];
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
          openingCash: Number(s.opening_cash),
          status: s.status,
        },
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
    console.error('[getShiftStatus] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengecek status shift.' });
  }
};

// ─── POST /api/shifts/open ──────────────────────────────────────────────────
export const openShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;
    const { openingCash, shift: shiftRaw } = req.body;

    if (!outletId) {
      return res.status(400).json({ success: false, message: 'User tidak terikat pada outlet manapun.' });
    }

    const shift = SHIFT_ENUM.has(shiftRaw) ? shiftRaw : 'full';
    const openAmt = openingCash != null ? Number(openingCash) : 0;
    if (!Number.isFinite(openAmt) || openAmt < 0) {
      return res.status(400).json({ success: false, message: 'Modal awal tidak valid.' });
    }

    const [check] = await poolWaschenPos.execute(
      `SELECT id FROM tr_cashier_session WHERE cashier_id = ? AND status = 'open' LIMIT 1`,
      [userId]
    );

    if (check.length > 0) {
      return res.status(400).json({ success: false, message: 'Anda masih memiliki sesi operasional yang terbuka.' });
    }

    const sessionId = randomUUID();
    const today = new Date().toISOString().slice(0, 10);

    await poolWaschenPos.execute(
      `INSERT INTO tr_cashier_session
        (id, outlet_id, cashier_id, session_date, shift, opened_at, opening_cash, status)
       VALUES (?, ?, ?, ?, ?, NOW(), ?, 'open')`,
      [sessionId, outletId, userId, today, shift, openAmt]
    );

    return res.status(201).json({
      success: true,
      message: 'Shift berhasil dibuka.',
      data: {
        id: sessionId,
        openedAt: new Date().toISOString(),
        shift,
        openingCash: openAmt,
        sessionDate: today,
        outletId,
      },
    });
  } catch (err) {
    console.error('[openShift] Error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Shift jenis ini sudah pernah dibuka hari ini untuk akun Anda. Pilih jenis shift lain atau tutup sesi sebelumnya.',
      });
    }
    return res.status(500).json({ success: false, message: 'Gagal membuka shift.' });
  }
};

// ─── GET /api/shifts/current-summary — live payment summary for open shift ──
export const getShiftCurrentSummary = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const [rows] = await poolWaschenPos.execute(
      `SELECT * FROM tr_cashier_session WHERE cashier_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: null });
    }

    const session = rows[0];

    const [methodRows] = await poolWaschenPos.execute(
      `SELECT pi.method, COALESCE(SUM(pi.amount), 0) AS total_amount, COUNT(*) AS tx_count
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ?
         AND t.outlet_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND pi.status = 'paid'
         AND COALESCE(pi.paid_at, pi.recorded_at) >= ?
         AND COALESCE(pi.paid_at, pi.recorded_at) <= NOW()
       GROUP BY pi.method
       ORDER BY total_amount DESC`,
      [userId, session.outlet_id, session.opened_at]
    );

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

    const grandTotal = paymentSummary.reduce((s, p) => s + p.amount, 0);

    return res.status(200).json({
      success: true,
      data: {
        sessionId: session.id,
        openedAt: session.opened_at,
        shift: session.shift,
        openingCash: Number(session.opening_cash || 0),
        totalTransactions: Number(txCountRow[0]?.total_trx || 0),
        totalOmset: Number(txCountRow[0]?.total_omset || 0),
        grandTotalPayments: grandTotal,
        paymentSummary,
      },
    });
  } catch (err) {
    console.error('[getShiftCurrentSummary] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat ringkasan shift.' });
  }
};

// ─── POST /api/shifts/close ─────────────────────────────────────────────────
export const closeShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { closingCash, notes } = req.body;

    const [rows] = await poolWaschenPos.execute(
      `SELECT * FROM tr_cashier_session WHERE cashier_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada shift kas yang sedang terbuka.' });
    }

    const session = rows[0];

    const [txCash] = await poolWaschenPos.execute(
      `SELECT SUM(pi.amount) AS total_cash
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ?
         AND t.outlet_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND pi.method = 'cash'
         AND pi.status = 'paid'
         AND COALESCE(pi.paid_at, pi.recorded_at) >= ?
         AND COALESCE(pi.paid_at, pi.recorded_at) <= NOW()`,
      [userId, session.outlet_id, session.opened_at]
    );

    const [methodRows] = await poolWaschenPos.execute(
      `SELECT pi.method, COALESCE(SUM(pi.amount), 0) AS total_amount, COUNT(*) AS tx_count
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ?
         AND t.outlet_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND pi.status = 'paid'
         AND COALESCE(pi.paid_at, pi.recorded_at) >= ?
         AND COALESCE(pi.paid_at, pi.recorded_at) <= NOW()
       GROUP BY pi.method
       ORDER BY total_amount DESC`,
      [userId, session.outlet_id, session.opened_at]
    );

    const cashSales = Number(txCash[0]?.total_cash || 0);
    const opening = Number(session.opening_cash);

    // Ambil total pengeluaran kas laci sesi ini
    const [drawerExpenseRow] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_expense
       FROM tr_cash_drawer
       WHERE session_id = ? AND type = 'out'`,
      [session.id]
    );
    const totalExpense = Number(drawerExpenseRow[0]?.total_expense || 0);

    // system_cash = modal awal + penjualan tunai - pengeluaran manual
    const systemCash = opening + cashSales - totalExpense;
    const actualCash = closingCash != null ? Number(closingCash) : 0;
    if (!Number.isFinite(actualCash) || actualCash < 0) {
      return res.status(400).json({ success: false, message: 'Jumlah uang fisik tidak valid.' });
    }
    const diff = actualCash - systemCash;

    await poolWaschenPos.execute(
      `UPDATE tr_cashier_session
       SET status = 'closed', closed_at = NOW(),
           closing_cash = ?, system_cash = ?, cash_diff = ?, notes = ?
       WHERE id = ?`,
      [actualCash, systemCash, diff, notes || null, session.id]
    );

    const paymentSummary = methodRows.map((r) => ({
      method: r.method,
      amount: Number(r.total_amount || 0),
      count: Number(r.tx_count || 0),
    }));
    const closedAt = new Date().toISOString();

    return res.status(200).json({
      success: true,
      message: 'Shift berhasil ditutup dan direkonsiliasi.',
      data: {
        sessionId: session.id,
        openedAt: session.opened_at,
        closedAt,
        openingCash: opening,
        cashSales,
        systemCash,
        closingCash: actualCash,
        difference: diff,
        paymentSummary,
      },
    });
  } catch (err) {
    console.error('[closeShift] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menutup shift.' });
  }
};

// ─── GET /api/shifts/sessions — admin: riwayat buka/tutup per outlet ──────
export const listShiftSessions = async (req, res) => {
  try {
    if (!assertAdmin(req, res)) return;

    const { outletId, dateFrom, dateTo } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 150, 1), 500);

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
        cs.status
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

    sql += ` ORDER BY cs.opened_at DESC LIMIT ${limit}`;

    const [rows] = await poolWaschenPos.execute(sql, params);

    const sessionIds = rows.map((r) => r.id);
    let paymentMap = new Map();
    if (sessionIds.length > 0) {
      const ph = sessionIds.map(() => '?').join(',');
      const [paymentRows] = await poolWaschenPos.execute(
        `SELECT t.session_id AS sessionId, pi.method, SUM(pi.amount) AS total_amount, COUNT(*) AS tx_count
         FROM tr_transaction t
         JOIN tr_payment_item pi ON pi.transaction_id = t.id
         WHERE t.session_id IN (${ph})
           AND t.deleted_at IS NULL
           AND t.status <> 'cancelled'
           AND pi.status = 'paid'
         GROUP BY t.session_id, pi.method`,
        sessionIds
      );
      paymentMap = paymentRows.reduce((acc, r) => {
        const curr = acc.get(r.sessionId) || [];
        curr.push({
          method: r.method,
          amount: Number(r.total_amount || 0),
          count: Number(r.tx_count || 0),
        });
        acc.set(r.sessionId, curr);
        return acc;
      }, new Map());
    }

    const data = rows.map((r) => ({
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
      notes: r.notes,
      status: r.status,
      paymentSummary: paymentMap.get(r.id) || [],
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[listShiftSessions]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat shift.' });
  }
};

// ─── GET /api/shifts/outlet-summary — admin: agregasi per outlet (disiplin) ─
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
    console.error('[getShiftOutletSummary]', err);
    return res.status(500).json({ success: false, message: 'Gagal ringkasan shift per outlet.' });
  }
};
