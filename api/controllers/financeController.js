import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/finance/stats ─────────────────────────────────────────────────
// Ringkasan keuangan: omset hari ini, minggu ini, bulan ini, pending verification
export const getFinanceStats = async (req, res) => {
  try {
    const outletId = req.query.outletId || req.user?.outletId;

    const outletFilter = outletId ? 'AND t.outlet_id = ?' : '';
    const params = outletId ? [outletId] : [];

    const [[todayRow], [weekRow], [monthRow]] = await Promise.all([
      // Hari ini
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(t.total), 0) AS revenue,
          COUNT(*) AS txCount
        FROM tr_transaction t
        WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
          AND DATE(t.created_at) = CURDATE() ${outletFilter}`,
        params
      ),
      // Minggu ini
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(t.total), 0) AS revenue,
          COUNT(*) AS txCount
        FROM tr_transaction t
        WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
          AND YEARWEEK(t.created_at, 1) = YEARWEEK(CURDATE(), 1) ${outletFilter}`,
        params
      ),
      // Bulan ini
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(t.total), 0) AS revenue,
          COUNT(*) AS txCount
        FROM tr_transaction t
        WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
          AND MONTH(t.created_at) = MONTH(CURDATE())
          AND YEAR(t.created_at) = YEAR(CURDATE()) ${outletFilter}`,
        params
      ),
    ]);

    // Pembayaran belum diverifikasi — graceful jika kolom belum ada
    let pendingRow = [{ cnt: 0, amount: 0 }];
    try {
      const [pr] = await poolWaschenPos.execute(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(t.total), 0) AS amount
        FROM tr_transaction t
        WHERE t.deleted_at IS NULL
          AND t.status <> 'cancelled'
          AND t.primary_payment_method IN ('transfer', 'qris')
          AND (t.payment_verified IS NULL OR t.payment_verified = 0)
          ${outletFilter}`,
        params
      );
      pendingRow = pr;
    } catch { /* kolom payment_verified belum ada */ }

    // Daftar outlet untuk filter
    let outletRows = [];
    try {
      const [or] = await poolWaschenPos.execute(
        `SELECT id, name FROM mst_outlet WHERE is_active = 1 ORDER BY name`
      );
      outletRows = or;
    } catch { /* tabel mst_outlet mungkin belum ada */ }

    return res.json({
      success: true,
      data: {
        today:   { revenue: Number(todayRow[0]?.revenue ?? 0), txCount: Number(todayRow[0]?.txCount ?? 0) },
        week:    { revenue: Number(weekRow[0]?.revenue ?? 0),  txCount: Number(weekRow[0]?.txCount ?? 0) },
        month:   { revenue: Number(monthRow[0]?.revenue ?? 0), txCount: Number(monthRow[0]?.txCount ?? 0) },
        pending: { count: Number(pendingRow[0]?.cnt ?? 0), amount: Number(pendingRow[0]?.amount ?? 0) },
        outlets: outletRows,
      },
    });
  } catch (err) {
    console.error('[getFinanceStats] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik keuangan.' });
  }
};

// ─── GET /api/finance/payments ──────────────────────────────────────────────
// Daftar pembayaran yang perlu diverifikasi + riwayat verifikasi
export const getPayments = async (req, res) => {
  try {
    const { status, outletId, page = 1 } = req.query;
    const limit = 50;
    const offset = (Number(page) - 1) * limit;

    const effectiveOutletId = outletId || null;

    let where = `t.deleted_at IS NULL AND t.status <> 'cancelled'
      AND t.primary_payment_method IN ('transfer', 'qris')`;
    const params = [];

    if (effectiveOutletId) {
      where += ' AND t.outlet_id = ?';
      params.push(effectiveOutletId);
    }

    // Coba pakai kolom payment_verified (jika DDL sudah dijalankan)
    let useVerifiedCol = true;
    try {
      await poolWaschenPos.execute(`SELECT payment_verified FROM tr_transaction LIMIT 0`);
    } catch { useVerifiedCol = false; }

    if (useVerifiedCol) {
      if (status === 'pending') {
        where += ' AND (t.payment_verified IS NULL OR t.payment_verified = 0)';
      } else if (status === 'verified') {
        where += ' AND t.payment_verified = 1';
      }
    }

    const verifiedCols = useVerifiedCol
      ? `t.payment_verified AS verified, t.payment_verified_at AS verifiedAt,`
      : `0 AS verified, NULL AS verifiedAt,`;

    const verifierJoin = useVerifiedCol
      ? `LEFT JOIN mst_user u_verifier ON u_verifier.id = t.payment_verified_by`
      : ``;

    const verifierCol = useVerifiedCol ? `u_verifier.name AS verifiedByName` : `NULL AS verifiedByName`;

    const orderCol = useVerifiedCol ? 't.payment_verified ASC,' : '';

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.total,
        t.primary_payment_method AS payMethod,
        ${verifiedCols}
        t.created_at AS createdAt,
        c.name AS customerName,
        c.phone AS customerPhone,
        o.name AS outletName,
        u_cashier.name AS cashierName,
        ${verifierCol}
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      LEFT JOIN mst_user u_cashier ON u_cashier.id = t.cashier_id
      ${verifierJoin}
      WHERE ${where}
      ORDER BY ${orderCol} t.created_at DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const data = rows.map((r) => ({
      ...r,
      total: Number(r.total),
      verified: r.verified === 1,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      verifiedAt: r.verifiedAt ? new Date(r.verifiedAt).toISOString() : null,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[getPayments] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar pembayaran.' });
  }
};

// ─── PATCH /api/finance/payments/:id/verify ─────────────────────────────────
export const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const verifiedBy = req.user?.userId;

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, payment_verified FROM tr_transaction
       WHERE deleted_at IS NULL AND (id = ? OR transaction_no = ?) LIMIT 1`,
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    if (rows[0].payment_verified === 1) {
      return res.status(409).json({ success: false, message: 'Pembayaran sudah diverifikasi.' });
    }

    await poolWaschenPos.execute(
      `UPDATE tr_transaction
       SET payment_verified = 1,
           payment_verified_by = ?,
           payment_verified_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [verifiedBy, rows[0].id]
    );

    return res.json({ success: true, message: 'Pembayaran berhasil diverifikasi.' });
  } catch (err) {
    console.error('[verifyPayment] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memverifikasi pembayaran.' });
  }
};

// ─── GET /api/finance/report ────────────────────────────────────────────────
// Laporan ringkasan per hari dalam range tertentu
export const getFinanceReport = async (req, res) => {
  try {
    const { startDate, endDate, outletId } = req.query;
    const effectiveOutletId = outletId || null;

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    let where = `t.deleted_at IS NULL AND t.status <> 'cancelled'
      AND DATE(t.created_at) BETWEEN ? AND ?`;
    const params = [start, end];

    if (effectiveOutletId) {
      where += ' AND t.outlet_id = ?';
      params.push(effectiveOutletId);
    }

    // Ringkasan per hari
    const [dailyRows] = await poolWaschenPos.execute(
      `SELECT
        DATE(t.created_at) AS date,
        COUNT(*) AS txCount,
        COALESCE(SUM(t.total), 0) AS revenue,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'cash' THEN t.total ELSE 0 END), 0) AS cashRevenue,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'transfer' THEN t.total ELSE 0 END), 0) AS transferRevenue,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'qris' THEN t.total ELSE 0 END), 0) AS qrisRevenue,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'deposit' THEN t.total ELSE 0 END), 0) AS depositRevenue
      FROM tr_transaction t
      WHERE ${where}
      GROUP BY DATE(t.created_at)
      ORDER BY DATE(t.created_at) DESC`,
      params
    );

    // Ringkasan per outlet
    const [outletRows] = await poolWaschenPos.execute(
      `SELECT
        o.name AS outletName,
        COUNT(*) AS txCount,
        COALESCE(SUM(t.total), 0) AS revenue
      FROM tr_transaction t
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      WHERE ${where}
      GROUP BY t.outlet_id, o.name
      ORDER BY revenue DESC`,
      params
    );

    // Ringkasan per metode bayar
    const [methodRows] = await poolWaschenPos.execute(
      `SELECT
        t.primary_payment_method AS method,
        COUNT(*) AS txCount,
        COALESCE(SUM(t.total), 0) AS revenue
      FROM tr_transaction t
      WHERE ${where}
      GROUP BY t.primary_payment_method
      ORDER BY revenue DESC`,
      params
    );

    const daily = dailyRows.map((r) => ({
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
      txCount: Number(r.txCount),
      revenue: Number(r.revenue),
      cashRevenue: Number(r.cashRevenue),
      transferRevenue: Number(r.transferRevenue),
      qrisRevenue: Number(r.qrisRevenue),
      depositRevenue: Number(r.depositRevenue),
    }));

    const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0);
    const totalTx = daily.reduce((s, d) => s + d.txCount, 0);

    return res.json({
      success: true,
      data: {
        period: { start, end },
        summary: { totalRevenue, totalTx },
        daily,
        byOutlet: outletRows.map((r) => ({ ...r, txCount: Number(r.txCount), revenue: Number(r.revenue) })),
        byMethod: methodRows.map((r) => ({ ...r, txCount: Number(r.txCount), revenue: Number(r.revenue) })),
      },
    });
  } catch (err) {
    console.error('[getFinanceReport] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat laporan keuangan.' });
  }
};
