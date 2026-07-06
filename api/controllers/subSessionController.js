// ══════════════════════════════════════════════════════════════════════════════
// subSessionController.js — Sub-Session Management (Individual Frontliner)
// Phase 3: Multi-User Shift Enhancement
//
// Konsep:
// - Admin buka MAIN SHIFT (tr_cashier_session)
// - Masing-masing kasir buka SUB-SESSION (tr_cashier_sub_session)
// - Setiap transaksi di-link ke sub_session_id
// - Kasir bisa handover antar sub-session
// ══════════════════════════════════════════════════════════════════════════════
import { poolWaschenPos as db } from '../db/connection.js';

// ─── Helper: Check column exists ────────────────────────────────────────────
async function hasColumn(tableName, columnName) {
  try {
    const [rows] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
      [tableName, columnName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Helper: Check table exists ──────────────────────────────────────────────
async function hasTable(tableName) {
  try {
    const [rows] = await db.execute(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
      [tableName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/sub-session/open
// Frontliner joins/opens a sub-session within an existing main shift
// Outlet ID is MANDATORY - taken from user context
// ══════════════════════════════════════════════════════════════════════════════
export async function openSubSession(req, res) {
  const conn = await db.getConnection();

  try {
    const { sessionId, beginningCash = 0 } = req.body;
    const cashierId = req.user?.userId || req.user?.id;
    const cashierOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!sessionId) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Session ID wajib diisi.',
      });
    }

    if (!cashierId) {
      conn.release();
      return res.status(401).json({
        success: false,
        message: 'User ID tidak ditemukan.',
      });
    }

    // CRITICAL: Outlet ID is mandatory
    if (!cashierOutletId) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'User tidak terikat pada outlet manapun.',
      });
    }

    await conn.beginTransaction();

    // ── Verify main session exists and is open ────────────────────────────────
    const [[mainSession]] = await conn.execute(`
      SELECT id, outlet_id, shift, session_date, status, opened_at
      FROM tr_cashier_session
      WHERE id = ? AND status = 'open' AND deleted_at IS NULL
      LIMIT 1 FOR UPDATE
    `, [sessionId]);

    if (!mainSession) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Shift utama tidak ditemukan atau sudah ditutup.',
      });
    }

    // ── Verify outlet matches ─────────────────────────────────────────────────
    // Kasir hanya bisa gabung shift di outlet yang sama
    if (String(mainSession.outlet_id) !== String(cashierOutletId)) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Anda tidak bisa bergabung dengan shift outlet lain.',
      });
    }

    // ── Check if cashier already has an open sub-session ─────────────────────
    const [existingSubSessions] = await conn.execute(`
      SELECT id, status FROM tr_cashier_sub_session
      WHERE session_id = ? AND cashier_id = ? AND status = 'open'
      LIMIT 1
    `, [sessionId, cashierId]);

    if (existingSubSessions.length > 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Anda sudah memiliki sub-session aktif untuk shift ini.',
        data: {
          subSessionId: existingSubSessions[0].id,
          alreadyOpen: true,
        },
      });
    }

    // ── Create sub-session ────────────────────────────────────────────────────
    const openedAt = new Date();
    const sessionDate = mainSession.session_date
      ? new Date(mainSession.session_date)
      : new Date();

    const [insertResult] = await conn.execute(`
      INSERT INTO tr_cashier_sub_session (
        session_id, cashier_id, outlet_id, shift, session_date,
        opened_at, status, beginning_cash,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, NOW(), NOW())
    `, [
      sessionId,
      cashierId,
      cashierOutletId, // CRITICAL: Always use cashier's outlet, not fallback
      mainSession.shift,
      sessionDate.toISOString().slice(0, 10),
      openedAt,
      Number(beginningCash) || 0,
    ]);

    const subSessionId = insertResult.insertId;

    await conn.commit();

    // ── Get cashier info ─────────────────────────────────────────────────────
    const [[cashierInfo]] = await conn.execute(
      'SELECT name FROM mst_user WHERE id = ? LIMIT 1',
      [cashierId]
    );

    return res.status(201).json({
      success: true,
      message: `Sub-session berhasil dibuka untuk shift ${mainSession.shift}.`,
      data: {
        subSessionId,
        sessionId: mainSession.id,
        cashierId,
        cashierName: cashierInfo?.name || 'Unknown',
        outletId: cashierOutletId,
        shift: mainSession.shift,
        sessionDate: sessionDate.toISOString().slice(0, 10),
        openedAt,
        status: 'open',
        beginningCash: Number(beginningCash) || 0,
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('[openSubSession] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuka sub-session.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/sub-session/close
// Frontliner closes their sub-session and reconciles cash
// Expected cash = beginning_cash + cash_received - change_given
// ══════════════════════════════════════════════════════════════════════════════
export async function closeSubSession(req, res) {
  const conn = await db.getConnection();

  try {
    const { subSessionId, endingCash, varianceNotes, handoverNotes } = req.body;
    const cashierId = req.user?.userId || req.user?.id;
    const userRole = req.user?.roleCode;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!subSessionId) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Sub-session ID wajib diisi.',
      });
    }

    await conn.beginTransaction();

    // ── Get sub-session with lock ────────────────────────────────────────────
    const [[subSession]] = await conn.execute(`
      SELECT ss.*, s.shift, s.session_date, u.name as cashier_name
      FROM tr_cashier_sub_session ss
      JOIN tr_cashier_session s ON ss.session_id = s.id
      JOIN mst_user u ON ss.cashier_id = u.id
      WHERE ss.id = ?
      LIMIT 1 FOR UPDATE
    `, [subSessionId]);

    if (!subSession) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Sub-session tidak ditemukan.',
      });
    }

    // ── Verify ownership or admin ────────────────────────────────────────────
    if (subSession.cashier_id !== cashierId && !['admin', 'superadmin'].includes(userRole)) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk menutup sub-session ini.',
      });
    }

    if (subSession.status === 'closed') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Sub-session sudah ditutup.',
      });
    }

    // ── Calculate expected cash from transactions ─────────────────────────────
    // Formula: beginning_cash + total_paid - total_change
    // Penjelasan:
    // - beginning_cash: modal kasir saat mulai
    // - total_paid: semua pembayaran masuk (gross, termasuk kembalian)
    // - total_change: semua kembalian yang sudah keluar
    // = sisa kas yang seharusnya ada di laci
    const [txSummary] = await conn.execute(`
      SELECT
        COUNT(*) as transaction_count,
        COALESCE(SUM(paid_amount), 0) as total_paid,
        COALESCE(SUM(change_amount), 0) as total_change
      FROM tr_transaction
      WHERE sub_session_id = ? AND deleted_at IS NULL
    `, [subSessionId]);

    const transactionCount = Number(txSummary[0]?.transaction_count || 0);
    const totalPaid = Number(txSummary[0]?.total_paid || 0);
    const totalChange = Number(txSummary[0]?.total_change || 0);

    // Expected cash = beginning_cash + (paid - change)
    const expectedCash = Number(subSession.beginning_cash) + totalPaid - totalChange;
    const declaredEndingCash = endingCash != null ? Number(endingCash) : expectedCash;
    const variance = declaredEndingCash - expectedCash;

    // ── Update sub-session ───────────────────────────────────────────────────
    const closedAt = new Date();

    await conn.execute(`
      UPDATE tr_cashier_sub_session SET
        status = 'closed',
        closed_at = ?,
        ending_cash = ?,
        expected_cash = ?,
        variance = ?,
        variance_notes = ?,
        handover_notes = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      closedAt,
      declaredEndingCash,
      expectedCash,
      variance,
      varianceNotes || null,
      handoverNotes || null,
      subSessionId,
    ]);

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Sub-session berhasil ditutup.',
      data: {
        subSessionId,
        status: 'closed',
        closedAt,
        cashierName: subSession.cashier_name,
        shift: subSession.shift,
        sessionDate: subSession.session_date,
        beginningCash: Number(subSession.beginning_cash),
        transactionCount,
        totalPaid,
        totalChange,
        expectedCash,
        endingCash: declaredEndingCash,
        variance,
        varianceNotes,
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('[closeSubSession] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menutup sub-session.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/sub-session/current
// Get current active sub-session for logged-in cashier
// ══════════════════════════════════════════════════════════════════════════════
export async function getCurrentSubSession(req, res) {
  try {
    const cashierId = req.user?.userId || req.user?.id;
    const cashierOutletId = req.user?.outletId;

    // ── Check if sub-session table exists ────────────────────────────────────
    const tableExists = await hasTable('tr_cashier_sub_session');
    if (!tableExists) {
      return res.json({
        success: true,
        data: {
          hasActiveSubSession: false,
          subSessionEnabled: false,
          message: 'Fitur sub-session belum diaktifkan.',
        },
      });
    }

    const [rows] = await db.execute(`
      SELECT
        ss.id,
        ss.session_id,
        ss.cashier_id,
        ss.outlet_id,
        ss.shift,
        ss.session_date,
        ss.opened_at,
        ss.status,
        ss.beginning_cash,
        s.opened_at as main_session_opened_at,
        s.status as main_session_status
      FROM tr_cashier_sub_session ss
      JOIN tr_cashier_session s ON ss.session_id = s.id
      WHERE ss.cashier_id = ?
        AND ss.status = 'open'
        AND s.status IN ('open', 'handover')
        AND s.deleted_at IS NULL
      ORDER BY ss.opened_at DESC
      LIMIT 1
    `, [cashierId]);

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          hasActiveSubSession: false,
          subSessionEnabled: true,
          message: 'Anda belum memiliki sub-session aktif. Silakan gabung shift terlebih dahulu.',
        },
      });
    }

    const subSession = rows[0];

    // ── Get transaction count for this sub-session ───────────────────────────
    const [txCount] = await db.execute(`
      SELECT COUNT(*) as count
      FROM tr_transaction
      WHERE sub_session_id = ? AND deleted_at IS NULL
    `, [subSession.id]);

    // ── Get cashier info ─────────────────────────────────────────────────────
    const [[cashierInfo]] = await db.execute(
      'SELECT name FROM mst_user WHERE id = ? LIMIT 1',
      [cashierId]
    );

    return res.json({
      success: true,
      data: {
        hasActiveSubSession: true,
        subSessionEnabled: true,
        subSessionId: subSession.id,
        sessionId: subSession.session_id,
        cashierId: subSession.cashier_id,
        cashierName: cashierInfo?.name || 'Unknown',
        outletId: subSession.outlet_id,
        shift: subSession.shift,
        sessionDate: subSession.session_date,
        openedAt: subSession.opened_at,
        mainSessionOpenedAt: subSession.main_session_opened_at,
        mainSessionStatus: subSession.main_session_status,
        status: subSession.status,
        beginningCash: Number(subSession.beginning_cash),
        transactionCount: Number(txCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('[getCurrentSubSession] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil sub-session aktif.',
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/sub-session/:sessionId/all
// Get all sub-sessions for a main shift (admin/kasir)
// ══════════════════════════════════════════════════════════════════════════════
export async function getAllSubSessions(req, res) {
  try {
    const { sessionId } = req.params;
    const cashierId = req.user?.userId || req.user?.id;
    const userRole = req.user?.roleCode;
    const cashierOutletId = req.user?.outletId;

    // ── Check access: only admin, owner, or kasir di outlet yang sama ─────────
    if (!['admin', 'superadmin', 'owner'].includes(userRole)) {
      // Kasir biasa hanya bisa lihat sub-session mereka sendiri
      // atau sub-session di shift yang sama
    }

    // ── Verify main session exists ───────────────────────────────────────────
    const [[mainSession]] = await db.execute(`
      SELECT id, outlet_id, cashier_id, status FROM tr_cashier_session
      WHERE id = ? AND deleted_at IS NULL LIMIT 1
    `, [sessionId]);

    if (!mainSession) {
      return res.status(404).json({
        success: false,
        message: 'Shift utama tidak ditemukan.',
      });
    }

    // Kasir hanya bisa lihat shift di outlet yang sama
    const isAdmin = ['admin', 'superadmin', 'owner'].includes(userRole);
    if (!isAdmin && String(mainSession.outlet_id) !== String(cashierOutletId)) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke shift ini.',
      });
    }

    // ── Get all sub-sessions ─────────────────────────────────────────────────
    const [rows] = await db.execute(`
      SELECT
        ss.id,
        ss.cashier_id,
        ss.outlet_id,
        ss.shift,
        ss.session_date,
        ss.opened_at,
        ss.closed_at,
        ss.status,
        ss.beginning_cash,
        ss.ending_cash,
        ss.expected_cash,
        ss.variance,
        ss.variance_notes,
        u.name as cashier_name
      FROM tr_cashier_sub_session ss
      JOIN mst_user u ON ss.cashier_id = u.id
      WHERE ss.session_id = ?
      ORDER BY ss.opened_at ASC
    `, [sessionId]);

    // ── Get transaction counts per sub-session ────────────────────────────────
    const subSessionIds = rows.map(r => r.id);
    let txCounts = {};

    if (subSessionIds.length > 0) {
      const placeholders = subSessionIds.map(() => '?').join(',');
      const [counts] = await db.execute(`
        SELECT sub_session_id, COUNT(*) as count,
               SUM(paid_amount) as total_paid, SUM(change_amount) as total_change
        FROM tr_transaction
        WHERE sub_session_id IN (${placeholders}) AND deleted_at IS NULL
        GROUP BY sub_session_id
      `, subSessionIds);

      counts.forEach(c => {
        txCounts[c.sub_session_id] = {
          count: Number(c.count || 0),
          totalPaid: Number(c.total_paid || 0),
          totalChange: Number(c.change_amount || 0),
        };
      });
    }

    return res.json({
      success: true,
      data: rows.map(ss => ({
        id: ss.id,
        cashierId: ss.cashier_id,
        cashierName: ss.cashier_name,
        outletId: ss.outlet_id,
        shift: ss.shift,
        sessionDate: ss.session_date,
        openedAt: ss.opened_at,
        closedAt: ss.closed_at,
        status: ss.status,
        beginningCash: Number(ss.beginning_cash || 0),
        endingCash: ss.ending_cash ? Number(ss.ending_cash) : null,
        expectedCash: ss.expected_cash ? Number(ss.expected_cash) : null,
        variance: ss.variance ? Number(ss.variance) : null,
        varianceNotes: ss.variance_notes,
        transactionCount: txCounts[ss.id]?.count || 0,
        totalPaid: txCounts[ss.id]?.totalPaid || 0,
        totalChange: txCounts[ss.id]?.totalChange || 0,
      })),
    });
  } catch (error) {
    console.error('[getAllSubSessions] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar sub-session.',
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/sub-session/:id
// Get sub-session details by ID
// ══════════════════════════════════════════════════════════════════════════════
export async function getSubSessionById(req, res) {
  try {
    const { id } = req.params;
    const cashierId = req.user?.userId || req.user?.id;
    const userRole = req.user?.roleCode;
    const cashierOutletId = req.user?.outletId;

    const [rows] = await db.execute(`
      SELECT
        ss.*,
        s.shift,
        s.session_date,
        s.status as main_session_status,
        u.name as cashier_name,
        o.name as outlet_name
      FROM tr_cashier_sub_session ss
      JOIN tr_cashier_session s ON ss.session_id = s.id
      JOIN mst_user u ON ss.cashier_id = u.id
      JOIN mst_outlet o ON ss.outlet_id = o.id
      WHERE ss.id = ?
      LIMIT 1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sub-session tidak ditemukan.',
      });
    }

    const ss = rows[0];

    // ── Check access: owner, admin, atau kasir di outlet yang sama ────────────
    const isAdmin = ['admin', 'superadmin', 'owner'].includes(userRole);
    const isOwner = ss.cashier_id === cashierId;
    const sameOutlet = String(ss.outlet_id) === String(cashierOutletId);

    if (!isAdmin && !isOwner && !sameOutlet) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke sub-session ini.',
      });
    }

    // ── Get transactions for this sub-session ───────────────────────────────
    const [transactions] = await db.execute(`
      SELECT
        id, transaction_no, total, paid_amount, change_amount,
        payment_status, status, created_at
      FROM tr_transaction
      WHERE sub_session_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [id]);

    // ── Calculate summary ─────────────────────────────────────────────────────
    const transactionCount = transactions.length;
    const totalPaid = transactions.reduce((sum, t) => sum + Number(t.paid_amount || 0), 0);
    const totalChange = transactions.reduce((sum, t) => sum + Number(t.change_amount || 0), 0);
    const expectedCash = Number(ss.beginning_cash || 0) + totalPaid - totalChange;

    return res.json({
      success: true,
      data: {
        id: ss.id,
        sessionId: ss.session_id,
        cashierId: ss.cashier_id,
        cashierName: ss.cashier_name,
        outletId: ss.outlet_id,
        outletName: ss.outlet_name,
        shift: ss.shift,
        sessionDate: ss.session_date,
        openedAt: ss.opened_at,
        closedAt: ss.closed_at,
        status: ss.status,
        beginningCash: Number(ss.beginning_cash || 0),
        endingCash: ss.ending_cash ? Number(ss.ending_cash) : null,
        expectedCash,
        variance: ss.variance ? Number(ss.variance) : null,
        varianceNotes: ss.variance_notes,
        handoverNotes: ss.handover_notes,
        mainSessionStatus: ss.main_session_status,
        transactions: transactions.map(t => ({
          id: t.id,
          transactionNo: t.transaction_no,
          total: Number(t.total),
          paidAmount: Number(t.paid_amount),
          changeAmount: Number(t.change_amount),
          paymentStatus: t.payment_status,
          status: t.status,
          createdAt: t.created_at,
        })),
        summary: {
          transactionCount,
          totalPaid,
          totalChange,
          expectedCash,
        },
      },
    });
  } catch (error) {
    console.error('[getSubSessionById] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail sub-session.',
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/handover/create
// Create a handover record between sub-sessions
// This is for handover ANTAR KASIR (sub-session to sub-session)
// ══════════════════════════════════════════════════════════════════════════════
export async function createHandover(req, res) {
  const conn = await db.getConnection();

  try {
    const {
      outgoingSubSessionId,
      incomingSubSessionId,
      outgoingEndingCash,
      incomingBeginningCash,
      handoverNotes,
      acknowledged = false,
    } = req.body;
    const userId = req.user?.userId || req.user?.id;

    await conn.beginTransaction();

    // ── Get outgoing sub-session ─────────────────────────────────────────────
    const [[outgoingSS]] = await conn.execute(`
      SELECT ss.*, u.name as cashier_name
      FROM tr_cashier_sub_session ss
      JOIN mst_user u ON ss.cashier_id = u.id
      WHERE ss.id = ?
      LIMIT 1 FOR UPDATE
    `, [outgoingSubSessionId]);

    if (!outgoingSS) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Sub-session outgoing tidak ditemukan.',
      });
    }

    // Only owner or admin can create handover
    const userRole = req.user?.roleCode;
    if (outgoingSS.cashier_id !== userId && !['admin', 'superadmin'].includes(userRole)) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengoper sub-session ini.',
      });
    }

    // ── Get incoming sub-session if provided ────────────────────────────────
    let incomingCashierId = null;
    let incomingCashierName = null;
    if (incomingSubSessionId) {
      const [[incomingSS]] = await conn.execute(`
        SELECT ss.*, u.name as cashier_name
        FROM tr_cashier_sub_session ss
        JOIN mst_user u ON ss.cashier_id = u.id
        WHERE ss.id = ?
        LIMIT 1 FOR UPDATE
      `, [incomingSubSessionId]);

      if (incomingSS) {
        incomingCashierId = incomingSS.cashier_id;
        incomingCashierName = incomingSS.cashier_name;
      }
    }

    // ── Calculate variance ────────────────────────────────────────────────────
    const varianceAtHandover = incomingBeginningCash != null && outgoingEndingCash != null
      ? Number(incomingBeginningCash) - Number(outgoingEndingCash)
      : null;

    // ── Get transaction counts ───────────────────────────────────────────────
    const [outgoingTxCount] = await conn.execute(`
      SELECT COUNT(*) as count FROM tr_transaction
      WHERE sub_session_id = ? AND deleted_at IS NULL
    `, [outgoingSubSessionId]);

    let incomingTxCount = 0;
    if (incomingSubSessionId) {
      const [result] = await conn.execute(`
        SELECT COUNT(*) as count FROM tr_transaction
        WHERE sub_session_id = ? AND deleted_at IS NULL
      `, [incomingSubSessionId]);
      incomingTxCount = Number(result[0]?.count || 0);
    }

    // ── Create handover record ───────────────────────────────────────────────
    const [insertResult] = await conn.execute(`
      INSERT INTO tr_shift_handover (
        outgoing_sub_session_id, incoming_sub_session_id,
        outgoing_cashier_id, incoming_cashier_id,
        outgoing_ending_cash, incoming_beginning_cash,
        variance_at_handover,
        outgoing_transaction_count, incoming_transaction_count,
        handover_notes, acknowledged,
        created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      outgoingSubSessionId,
      incomingSubSessionId || null,
      outgoingSS.cashier_id,
      incomingCashierId,
      Number(outgoingEndingCash) || outgoingSS.ending_cash,
      Number(incomingBeginningCash) || null,
      varianceAtHandover,
      Number(outgoingTxCount[0]?.count || 0),
      incomingTxCount,
      handoverNotes || null,
      acknowledged ? 1 : 0,
      userId,
    ]);

    const handoverId = insertResult.insertId;

    // ── Update outgoing sub-session status if acknowledged ───────────────────
    if (acknowledged) {
      await conn.execute(`
        UPDATE tr_cashier_sub_session
        SET status = 'handed_over', updated_at = NOW()
        WHERE id = ?
      `, [outgoingSubSessionId]);

      // Update incoming sub-session beginning_cash
      if (incomingSubSessionId && incomingBeginningCash != null) {
        await conn.execute(`
          UPDATE tr_cashier_sub_session
          SET beginning_cash = ?, updated_at = NOW()
          WHERE id = ?
        `, [Number(incomingBeginningCash), incomingSubSessionId]);
      }
    }

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: 'Handover berhasil dicatat.',
      data: {
        handoverId,
        outgoingSubSessionId,
        incomingSubSessionId,
        outgoingCashierName: outgoingSS.cashier_name,
        incomingCashierName,
        outgoingEndingCash: Number(outgoingEndingCash) || outgoingSS.ending_cash,
        incomingBeginningCash: Number(incomingBeginningCash) || null,
        varianceAtHandover,
        acknowledged: !!acknowledged,
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('[createHandover] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mencatat handover.',
      error: error.message,
    });
  } finally {
    conn.release();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/shifts/handover/:subSessionId/history
// Get handover history for a sub-session
// ══════════════════════════════════════════════════════════════════════════════
export async function getHandoverHistory(req, res) {
  try {
    const { subSessionId } = req.params;

    const [rows] = await db.execute(`
      SELECT
        h.id,
        h.outgoing_sub_session_id,
        h.incoming_sub_session_id,
        h.outgoing_cashier_id,
        h.incoming_cashier_id,
        h.outgoing_ending_cash,
        h.incoming_beginning_cash,
        h.variance_at_handover,
        h.outgoing_transaction_count,
        h.incoming_transaction_count,
        h.handover_notes,
        h.acknowledged,
        h.created_at,
        ou.name as outgoing_cashier_name,
        iu.name as incoming_cashier_name
      FROM tr_shift_handover h
      LEFT JOIN mst_user ou ON h.outgoing_cashier_id = ou.id
      LEFT JOIN mst_user iu ON h.incoming_cashier_id = iu.id
      WHERE h.outgoing_sub_session_id = ? OR h.incoming_sub_session_id = ?
      ORDER BY h.created_at DESC
    `, [subSessionId, subSessionId]);

    return res.json({
      success: true,
      data: rows.map(h => ({
        id: h.id,
        outgoingSubSessionId: h.outgoing_sub_session_id,
        incomingSubSessionId: h.incoming_sub_session_id,
        outgoingCashierId: h.outgoing_cashier_id,
        incomingCashierId: h.incoming_cashier_id,
        outgoingCashierName: h.outgoing_cashier_name,
        incomingCashierName: h.incoming_cashier_name,
        outgoingEndingCash: h.outgoing_ending_cash ? Number(h.outgoing_ending_cash) : null,
        incomingBeginningCash: h.incoming_beginning_cash ? Number(h.incoming_beginning_cash) : null,
        varianceAtHandover: h.variance_at_handover ? Number(h.variance_at_handover) : null,
        outgoingTransactionCount: h.outgoing_transaction_count,
        incomingTransactionCount: h.incoming_transaction_count,
        handoverNotes: h.handover_notes,
        acknowledged: !!h.acknowledged,
        createdAt: h.created_at,
      })),
    });
  } catch (error) {
    console.error('[getHandoverHistory] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil riwayat handover.',
    });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/shifts/handover/:id/acknowledge
// Incoming cashier acknowledges handover
// ══════════════════════════════════════════════════════════════════════════════
export async function acknowledgeHandover(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;

    // Check if handover exists and user is the incoming cashier
    const [[handover]] = await db.execute(`
      SELECT * FROM tr_shift_handover WHERE id = ? LIMIT 1
    `, [id]);

    if (!handover) {
      return res.status(404).json({
        success: false,
        message: 'Handover tidak ditemukan.',
      });
    }

    if (handover.incoming_cashier_id && handover.incoming_cashier_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Handover ini bukan untuk Anda.',
      });
    }

    // Update acknowledged status
    await db.execute(`
      UPDATE tr_shift_handover SET acknowledged = 1 WHERE id = ?
    `, [id]);

    // Update outgoing sub-session status
    if (handover.outgoing_sub_session_id) {
      await db.execute(`
        UPDATE tr_cashier_sub_session
        SET status = 'handed_over', updated_at = NOW()
        WHERE id = ?
      `, [handover.outgoing_sub_session_id]);
    }

    return res.json({
      success: true,
      message: 'Handover berhasil diacknowledge.',
    });
  } catch (error) {
    console.error('[acknowledgeHandover] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal acknowledge handover.',
    });
  }
}
