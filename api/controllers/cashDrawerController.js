import { randomUUID } from 'crypto';
import { poolWaschenPos } from '../db/connection.js';

const CATEGORY_ENUM = new Set([
  'modal',
  'setoran_bank',
  'pengeluaran_operasional',
  'cash_adjustment',
  'lainnya',
]);

const CATEGORY_LABEL = {
  modal: 'Modal Awal',
  setoran_bank: 'Setoran Bank',
  pengeluaran_operasional: 'Pengeluaran Operasional',
  cash_adjustment: 'Penyesuaian Kas',
  lainnya: 'Lainnya',
};

// ─── GET /api/cash-drawer/entries ──────────────────────────────────────────
// Ambil semua entri kas laci untuk sesi aktif kasir yang sedang login
export const getDrawerEntries = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.query;

    let targetSessionId = sessionId;

    // Jika tidak ada sessionId di query, pakai sesi aktif user
    if (!targetSessionId) {
      const [sessions] = await poolWaschenPos.execute(
        `SELECT id FROM tr_cashier_session WHERE cashier_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
        [userId]
      );
      if (sessions.length === 0) {
        return res.json({ success: true, data: [], sessionId: null, summary: null });
      }
      targetSessionId = sessions[0].id;
    }

    const [entries] = await poolWaschenPos.execute(
      `SELECT
         cd.id,
         cd.session_id    AS sessionId,
         cd.type,
         cd.category,
         cd.amount,
         cd.description,
         cd.recorded_by   AS recordedById,
         u.name           AS recordedByName,
         cd.created_at    AS createdAt
       FROM tr_cash_drawer cd
       JOIN mst_user u ON u.id = cd.recorded_by
       WHERE cd.session_id = ?
       ORDER BY cd.created_at ASC`,
      [targetSessionId]
    );

    // Hitung ringkasan
    let totalIn = 0;
    let totalOut = 0;
    for (const e of entries) {
      if (e.type === 'in') totalIn += Number(e.amount);
      else totalOut += Number(e.amount);
    }

    const data = entries.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      type: e.type,
      category: e.category,
      categoryLabel: CATEGORY_LABEL[e.category] || e.category,
      amount: Number(e.amount),
      description: e.description,
      recordedById: e.recordedById,
      recordedByName: e.recordedByName,
      createdAt: e.createdAt,
    }));

    return res.json({
      success: true,
      data,
      sessionId: targetSessionId,
      summary: {
        totalIn,
        totalOut,
        balance: totalIn - totalOut,
      },
    });
  } catch (err) {
    console.error('[getDrawerEntries] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat entri kas laci.' });
  }
};

// ─── POST /api/cash-drawer/entry ───────────────────────────────────────────
// Tambah entri kas masuk/keluar manual (pengeluaran, penyesuaian, dll)
export const addDrawerEntry = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { type, category, amount, description } = req.body;

    // Validasi type
    if (!['in', 'out'].includes(type)) {
      return res.status(400).json({ success: false, message: "Tipe harus 'in' atau 'out'." });
    }

    // Validasi category
    if (!CATEGORY_ENUM.has(category)) {
      return res.status(400).json({
        success: false,
        message: `Kategori tidak valid. Gunakan: ${[...CATEGORY_ENUM].join(', ')}`,
      });
    }

    // Validasi amount
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Jumlah harus lebih dari 0.' });
    }

    // Cek sesi aktif
    const [sessions] = await poolWaschenPos.execute(
      `SELECT id FROM tr_cashier_session WHERE cashier_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1`,
      [userId]
    );
    if (sessions.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada shift yang sedang terbuka.' });
    }
    const sessionId = sessions[0].id;

    const id = randomUUID();
    await poolWaschenPos.execute(
      `INSERT INTO tr_cash_drawer (id, session_id, type, category, amount, description, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionId, type, category, amt, description?.trim() || null, userId]
    );

    return res.status(201).json({
      success: true,
      message: 'Entri kas berhasil dicatat.',
      data: {
        id,
        sessionId,
        type,
        category,
        categoryLabel: CATEGORY_LABEL[category] || category,
        amount: amt,
        description: description?.trim() || null,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[addDrawerEntry] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mencatat entri kas.' });
  }
};

// ─── DELETE /api/cash-drawer/entry/:id ─────────────────────────────────────
// Hapus entri (hanya oleh pencatat atau admin, dan hanya saat sesi masih open)
export const deleteDrawerEntry = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const roleCode = req.user?.roleCode;
    const { id } = req.params;

    const [rows] = await poolWaschenPos.execute(
      `SELECT cd.id, cd.recorded_by, cd.session_id, cs.status AS sessionStatus
       FROM tr_cash_drawer cd
       JOIN tr_cashier_session cs ON cs.id = cd.session_id
       WHERE cd.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Entri kas tidak ditemukan.' });
    }

    const entry = rows[0];

    if (entry.sessionStatus !== 'open') {
      return res.status(400).json({ success: false, message: 'Tidak bisa hapus entri dari sesi yang sudah tutup.' });
    }

    const isOwner = entry.recorded_by === userId;
    const isAdmin = ['admin', 'superadmin', 'finance', 'owner'].includes(roleCode);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Hanya pencatat atau admin yang bisa menghapus entri ini.' });
    }

    await poolWaschenPos.execute(`DELETE FROM tr_cash_drawer WHERE id = ?`, [id]);

    return res.json({ success: true, message: 'Entri kas berhasil dihapus.' });
  } catch (err) {
    console.error('[deleteDrawerEntry] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus entri kas.' });
  }
};

// ─── GET /api/cash-drawer/summary-by-session/:sessionId ────────────────────
// Ringkasan lengkap untuk satu sesi (dipakai di tutup shift & laporan)
export const getDrawerSummaryBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [sessionRows] = await poolWaschenPos.execute(
      `SELECT cs.id, cs.opening_cash, cs.closing_cash, cs.system_cash, cs.cash_diff,
              cs.opened_at, cs.closed_at, cs.shift, cs.status,
              u.name AS cashierName, o.name AS outletName
       FROM tr_cashier_session cs
       JOIN mst_user u ON u.id = cs.cashier_id
       JOIN mst_outlet o ON o.id = cs.outlet_id
       WHERE cs.id = ?`,
      [sessionId]
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });
    }

    const session = sessionRows[0];

    const [entries] = await poolWaschenPos.execute(
      `SELECT type, category, SUM(amount) AS total
       FROM tr_cash_drawer
       WHERE session_id = ?
       GROUP BY type, category
       ORDER BY type, category`,
      [sessionId]
    );

    const [cashSalesRow] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(pi.amount), 0) AS cash_sales
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.session_id = ?
         AND t.deleted_at IS NULL
         AND t.status <> 'cancelled'
         AND pi.method = 'cash'
         AND pi.status = 'paid'`,
      [sessionId]
    );

    const cashSales = Number(cashSalesRow[0]?.cash_sales || 0);
    const openingCash = Number(session.opening_cash || 0);

    let totalManualIn = 0;
    let totalManualOut = 0;
    const byCategory = {};

    for (const e of entries) {
      const total = Number(e.total);
      byCategory[e.category] = (byCategory[e.category] || 0) + (e.type === 'out' ? -total : total);
      if (e.type === 'in') totalManualIn += total;
      else totalManualOut += total;
    }

    // system_cash = modal + penjualan tunai - pengeluaran
    const computedSystemCash = openingCash + cashSales - totalManualOut;

    return res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          cashierName: session.cashierName,
          outletName: session.outletName,
          shift: session.shift,
          status: session.status,
          openedAt: session.opened_at,
          closedAt: session.closed_at,
          openingCash,
          closingCash: session.closing_cash != null ? Number(session.closing_cash) : null,
          recordedSystemCash: session.system_cash != null ? Number(session.system_cash) : null,
          cashDiff: session.cash_diff != null ? Number(session.cash_diff) : null,
        },
        cashDrawer: {
          openingCash,
          cashSales,
          totalManualIn,
          totalManualOut,
          computedSystemCash,
          byCategory,
        },
      },
    });
  } catch (err) {
    console.error('[getDrawerSummaryBySession] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat ringkasan kas sesi.' });
  }
};
