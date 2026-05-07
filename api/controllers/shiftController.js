import { randomUUID } from 'crypto';
import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/shifts/status ────────────────────────────────────────────────
// Mendapatkan status shift kasir hari ini
export const getShiftStatus = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;

    if (!outletId) {
      // Jika Superadmin/Owner yang tidak punya outlet masuk ke layar Kasir, anggap saja shift selalu buka (bypass)
      return res.status(200).json({ success: true, isOpen: true, bypass: true });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT * FROM tr_cashier_session 
       WHERE cashier_id = ? AND status = 'open' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (rows.length > 0) {
      return res.status(200).json({ success: true, data: rows[0], isOpen: true });
    } else {
      return res.status(200).json({ success: true, isOpen: false });
    }
  } catch (err) {
    console.error('[getShiftStatus] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengecek status shift.' });
  }
};

// ─── POST /api/shifts/open ──────────────────────────────────────────────────
// Membuka shift (Buka Kas)
export const openShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const outletId = req.user?.outletId;
    const { openingCash, shift } = req.body;

    if (!outletId) {
      return res.status(400).json({ success: false, message: 'User tidak terikat pada outlet manapun.' });
    }

    // Cek apakah sudah ada shift yang open
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
      [sessionId, outletId, userId, today, shift || 'full', openingCash || 0]
    );

    return res.status(201).json({ success: true, message: 'Operasional harian (Kas) berhasil dibuka.' });
  } catch (err) {
    console.error('[openShift] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuka operasional toko.' });
  }
};

// ─── POST /api/shifts/close ─────────────────────────────────────────────────
// Menutup shift (Tutup Kas) dan rekonsiliasi
export const closeShift = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { closingCash, notes } = req.body;

    const [rows] = await poolWaschenPos.execute(
      `SELECT * FROM tr_cashier_session WHERE cashier_id = ? AND status = 'open' LIMIT 1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada operasional kas yang sedang terbuka.' });
    }

    const session = rows[0];

    // Hitung total tunai dari transaksi selama shift ini
    const [txCash] = await poolWaschenPos.execute(
      `SELECT SUM(pi.amount) AS total_cash
       FROM tr_payment_item pi
       JOIN tr_transaction t ON t.id = pi.transaction_id
       WHERE t.cashier_id = ? AND pi.method = 'cash' 
         AND pi.created_at >= ?`,
      [userId, session.opened_at]
    );

    const systemCash = Number(session.opening_cash) + Number(txCash[0].total_cash || 0);
    const actualCash = Number(closingCash || 0);
    const diff = actualCash - systemCash;

    await poolWaschenPos.execute(
      `UPDATE tr_cashier_session
       SET status = 'closed', closed_at = NOW(),
           closing_cash = ?, system_cash = ?, cash_diff = ?, notes = ?
       WHERE id = ?`,
      [actualCash, systemCash, diff, notes || null, session.id]
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Operasional harian (Kas) berhasil ditutup dan direkonsiliasi.',
      data: { systemCash, actualCash, diff }
    });
  } catch (err) {
    console.error('[closeShift] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menutup operasional toko.' });
  }
};
