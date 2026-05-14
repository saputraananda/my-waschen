import { poolWaschenPos } from '../db/connection.js';

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

    // Count services
    const [[svcCount]] = await poolWaschenPos.execute(
      'SELECT COUNT(*) AS cnt FROM mst_service WHERE outlet_id = ? AND is_active = 1',
      [id]
    );

    // Count team members
    const [[teamCount]] = await poolWaschenPos.execute(
      'SELECT COUNT(*) AS cnt FROM mst_user WHERE outlet_id = ? AND is_active = 1',
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
    console.error('[getOutletDetail] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat detail outlet.' });
  }
};

// ─── GET /api/outlets/:id/team ────────────────────────────────────────────────
export const getOutletTeam = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        u.id, u.name, u.username, u.phone, u.email, u.is_active AS isActive,
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
    console.error('[getOutletTeam] Error:', err);
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
    console.error('[getOutletKasBalance] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat saldo kas outlet.' });
  }
};
