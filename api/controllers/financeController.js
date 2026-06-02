import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/finance/stats ─────────────────────────────────────────────────
// Ringkasan keuangan: omset hari ini, minggu ini, bulan ini, pending verification
export const getFinanceStats = async (req, res) => {
  try {
    const outletId = req.query.outletId || req.user?.outletId;

    const outletFilter = outletId ? 'AND t.outlet_id = ?' : '';
    const params = outletId ? [outletId] : [];

    // Jalankan sequential untuk menghindari ECONNRESET ke DB remote
    const [todayRows] = await poolWaschenPos.execute(
      `SELECT
        COALESCE(SUM(t.total), 0) AS revenue,
        COUNT(*) AS txCount
      FROM tr_transaction t
      WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
        AND DATE(t.created_at) = CURDATE() ${outletFilter}`,
      params
    );

    const [weekRows] = await poolWaschenPos.execute(
      `SELECT
        COALESCE(SUM(t.total), 0) AS revenue,
        COUNT(*) AS txCount
      FROM tr_transaction t
      WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
        AND YEARWEEK(t.created_at, 1) = YEARWEEK(CURDATE(), 1) ${outletFilter}`,
      params
    );

    const [monthRows] = await poolWaschenPos.execute(
      `SELECT
        COALESCE(SUM(t.total), 0) AS revenue,
        COUNT(*) AS txCount
      FROM tr_transaction t
      WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
        AND MONTH(t.created_at) = MONTH(CURDATE())
        AND YEAR(t.created_at) = YEAR(CURDATE()) ${outletFilter}`,
      params
    );

    const todayRow = todayRows;
    const weekRow  = weekRows;
    const monthRow = monthRows;

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
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
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

// ─── PATCH /api/finance/payments/bulk-verify ────────────────────────────────
// Bulk verify multiple payments at once
export const bulkVerifyPayments = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    const { ids } = req.body;
    const verifiedBy = req.user?.userId;

    if (!Array.isArray(ids) || ids.length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'IDs wajib berupa array dan tidak kosong.' });
    }
    if (ids.length > 100) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Maksimal 100 item per bulk operation.' });
    }

    await conn.beginTransaction();

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await conn.execute(
      `SELECT id, payment_verified, transaction_no FROM tr_transaction
       WHERE deleted_at IS NULL
         AND (id IN (${placeholders}) OR transaction_no IN (${placeholders}))`,
      [...ids, ...ids]
    );

    const toVerify = rows.filter(r => r.payment_verified !== 1);
    const alreadyVerified = rows.filter(r => r.payment_verified === 1);
    const notFound = ids.length - rows.length;

    if (toVerify.length > 0) {
      const ph = toVerify.map(() => '?').join(',');
      await conn.execute(
        `UPDATE tr_transaction
         SET payment_verified = 1,
             payment_verified_by = ?,
             payment_verified_at = NOW(),
             updated_at = NOW()
         WHERE id IN (${ph})`,
        [verifiedBy, ...toVerify.map(r => r.id)]
      );
    }

    await conn.commit();

    return res.json({
      success: true,
      message: `${toVerify.length} pembayaran berhasil diverifikasi.`,
      data: {
        verified: toVerify.length,
        alreadyVerified: alreadyVerified.length,
        notFound,
        verifiedIds: toVerify.map(r => r.transaction_no || r.id),
      },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[bulkVerifyPayments] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memverifikasi pembayaran (bulk).' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/finance/revenue-recap ──────────────────────────────────────────
// Rekap pendapatan per transaksi — paginated, filterable
export const getRevenueRecap = async (req, res) => {
  try {
    const { outletId, startDate, endDate, page = 1, limit = 5 } = req.query;
    const pageNum = Math.max(Number(page) || 1, 1);
    const perPage = Math.min(Math.max(Number(limit) || 5, 1), 100);
    const offset = (pageNum - 1) * perPage;

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    let where = `t.deleted_at IS NULL AND t.status <> 'cancelled'
      AND DATE(t.created_at) BETWEEN ? AND ?`;
    const params = [start, end];

    if (outletId) {
      where += ' AND t.outlet_id = ?';
      params.push(outletId);
    }

    // Total count
    const [countRows] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total FROM tr_transaction t WHERE ${where}`,
      params
    );
    const totalRecords = Number(countRows[0]?.total || 0);
    const totalPages = Math.ceil(totalRecords / perPage) || 1;

    // Summary totals (across ALL filtered records, not just current page)
    const [sumRows] = await poolWaschenPos.execute(
      `SELECT
        COALESCE(SUM(t.total), 0) AS grandTotal,
        COUNT(*) AS totalTx,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'cash' THEN t.total ELSE 0 END), 0) AS totalCash,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'transfer' THEN t.total ELSE 0 END), 0) AS totalTransfer,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'qris' THEN t.total ELSE 0 END), 0) AS totalQris,
        COALESCE(SUM(CASE WHEN t.primary_payment_method = 'deposit' THEN t.total ELSE 0 END), 0) AS totalDeposit
      FROM tr_transaction t
      WHERE ${where}`,
      params
    );

    // Paginated detail rows
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        t.id,
        t.transaction_no AS transactionNo,
        t.total,
        t.subtotal,
        (COALESCE(t.member_discount,0) + COALESCE(t.promo_discount,0) + COALESCE(t.manual_discount,0)) AS discount,
        t.delivery_fee AS deliveryFee,
        t.primary_payment_method AS payMethod,
        t.status,
        t.is_express AS isExpress,
        t.created_at AS createdAt,
        c.name AS customerName,
        c.phone AS customerPhone,
        o.name AS outletName,
        u.name AS cashierName
      FROM tr_transaction t
      JOIN mst_customer c ON c.id = t.customer_id
      LEFT JOIN mst_outlet o ON o.id = t.outlet_id
      LEFT JOIN mst_user u ON u.id = t.cashier_id
      WHERE ${where}
      ORDER BY t.created_at DESC
      LIMIT ${Number(perPage)} OFFSET ${Number(offset)}`,
      params
    );

    // Batch fetch payment items untuk semua transaksi sekaligus (1 query, bukan N+1)
    const txIds = rows.map((r) => r.id);
    let paymentByTx = new Map();
    if (txIds.length > 0) {
      const placeholders = txIds.map(() => '?').join(',');
      const [piRows] = await poolWaschenPos.execute(
        `SELECT transaction_id, method, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS cnt
         FROM tr_payment_item
         WHERE transaction_id IN (${placeholders}) AND status = 'paid'
         GROUP BY transaction_id, method`,
        txIds
      );
      for (const p of piRows) {
        const list = paymentByTx.get(p.transaction_id) || [];
        list.push({ method: p.method, amount: Number(p.amount), count: Number(p.cnt) });
        paymentByTx.set(p.transaction_id, list);
      }
    }

    const transactions = rows.map((t) => ({
      id: t.id,
      transactionNo: t.transactionNo,
      total: Number(t.total),
      subtotal: Number(t.subtotal || 0),
      discount: Number(t.discount || 0),
      deliveryFee: Number(t.deliveryFee || 0),
      payMethod: t.payMethod,
      status: t.status,
      isExpress: !!t.isExpress,
      createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
      customerName: t.customerName,
      customerPhone: t.customerPhone,
      outletName: t.outletName,
      cashierName: t.cashierName,
      payments: paymentByTx.get(t.id) || [],
    }));

    const s = sumRows[0];
    return res.json({
      success: true,
      data: {
        period: { start, end },
        pagination: { page: pageNum, limit: perPage, totalRecords, totalPages },
        summary: {
          grandTotal: Number(s?.grandTotal || 0),
          totalTx: Number(s?.totalTx || 0),
          totalCash: Number(s?.totalCash || 0),
          totalTransfer: Number(s?.totalTransfer || 0),
          totalQris: Number(s?.totalQris || 0),
          totalDeposit: Number(s?.totalDeposit || 0),
        },
        transactions,
      },
    });
  } catch (err) {
    console.error('[getRevenueRecap] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat rekap pendapatan.' });
  }
};

// ─── GET /api/finance/report ────────────────────────────────────────────────
// Laporan ringkasan per hari dalam range tertentu
export const getFinanceReport = async (req, res) => {
  try {
    const { startDate, endDate, outletId, groupBy } = req.query;
    const effectiveOutletId = outletId || null;
    const byMonth = String(groupBy || 'day').toLowerCase() === 'month';

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const end = endDate || new Date().toISOString().slice(0, 10);

    let where = `t.deleted_at IS NULL AND t.status <> 'cancelled'
      AND DATE(t.created_at) BETWEEN ? AND ?`;
    const params = [start, end];

    if (effectiveOutletId) {
      where += ' AND t.outlet_id = ?';
      params.push(effectiveOutletId);
    }

    let dailyRows = [];
    let monthlyRows = [];

    if (byMonth) {
      const [mRows] = await poolWaschenPos.execute(
        `SELECT
          DATE_FORMAT(t.created_at, '%Y-%m') AS period,
          COUNT(*) AS txCount,
          COALESCE(SUM(t.total), 0) AS revenue,
          COALESCE(SUM(t.paid_amount), 0) AS pelunasan,
          COALESCE(SUM(CASE WHEN t.primary_payment_method = 'cash' THEN t.total ELSE 0 END), 0) AS cashRevenue,
          COALESCE(SUM(CASE WHEN t.primary_payment_method = 'transfer' THEN t.total ELSE 0 END), 0) AS transferRevenue,
          COALESCE(SUM(CASE WHEN t.primary_payment_method = 'qris' THEN t.total ELSE 0 END), 0) AS qrisRevenue,
          COALESCE(SUM(CASE WHEN t.primary_payment_method = 'deposit' THEN t.total ELSE 0 END), 0) AS depositRevenue
        FROM tr_transaction t
        WHERE ${where}
        GROUP BY DATE_FORMAT(t.created_at, '%Y-%m')
        ORDER BY period ASC`,
        params
      );
      monthlyRows = mRows;
    } else {
      const [dRows] = await poolWaschenPos.execute(
        `SELECT
          DATE(t.created_at) AS date,
          COUNT(*) AS txCount,
          COALESCE(SUM(t.total), 0) AS revenue,
          COALESCE(SUM(t.paid_amount), 0) AS pelunasan,
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
      dailyRows = dRows;
    }

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

    const daily = (dailyRows || []).map((r) => ({
      date: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
      txCount: Number(r.txCount),
      revenue: Number(r.revenue),
      pelunasan: Number(r.pelunasan || 0),
      cashRevenue: Number(r.cashRevenue),
      transferRevenue: Number(r.transferRevenue),
      qrisRevenue: Number(r.qrisRevenue),
      depositRevenue: Number(r.depositRevenue),
    }));

    const monthly = (monthlyRows || []).map((r) => ({
      period: r.period,
      txCount: Number(r.txCount),
      revenue: Number(r.revenue),
      pelunasan: Number(r.pelunasan || 0),
      cashRevenue: Number(r.cashRevenue),
      transferRevenue: Number(r.transferRevenue),
      qrisRevenue: Number(r.qrisRevenue),
      depositRevenue: Number(r.depositRevenue),
    }));

    const series = byMonth ? monthly : daily;
    const totalRevenue = series.reduce((s, d) => s + d.revenue, 0);
    const totalPelunasan = series.reduce((s, d) => s + d.pelunasan, 0);
    const totalTx = series.reduce((s, d) => s + d.txCount, 0);

    return res.json({
      success: true,
      data: {
        period: { start, end },
        groupBy: byMonth ? 'month' : 'day',
        summary: { totalRevenue, totalPelunasan, totalTx },
        daily,
        monthly,
        byOutlet: outletRows.map((r) => ({ ...r, txCount: Number(r.txCount), revenue: Number(r.revenue) })),
        byMethod: methodRows.map((r) => ({ ...r, txCount: Number(r.txCount), revenue: Number(r.revenue) })),
      },
    });
  } catch (err) {
    console.error('[getFinanceReport] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat laporan keuangan.' });
  }
};
