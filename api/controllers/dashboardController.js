import { poolWaschenPos } from '../db/connection.js';

const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];

// ─── GET /api/dashboard/stats ──────────────────────────────────────────────────
// Multi-outlet admin: query outletId opsional (default semua outlet untuk admin).
// Optimized: SINGLE query dengan conditional aggregation untuk semua bucket
// (total/today/month/pending) — sebelumnya 5 query sequential = 5 round-trip ke DB.
export const getDashboardStats = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const queryOutletId = req.query?.outletId;
    const userRole = req.user?.roleCode;
    const compare = req.query?.compare === '1';
    const period = ['today', 'month', 'all'].includes(req.query?.period) ? req.query.period : 'all';

    const isGlobalRole = globalRoles.includes(userRole);

    let effectiveOutlet = null;
    let isAllOutlets = false;

    if (isGlobalRole) {
      if (!queryOutletId) {
        isAllOutlets = true;
      } else {
        effectiveOutlet = queryOutletId;
      }
    } else {
      effectiveOutlet = userOutletId;
      if (queryOutletId && queryOutletId !== userOutletId) {
        return res.status(403).json({ success: false, message: 'Akses outlet ditolak.' });
      }
      if (!effectiveOutlet) {
        return res.status(400).json({ success: false, message: 'Outlet pengguna tidak terpasang.' });
      }
    }

    const outletFilter = isAllOutlets ? '' : 'AND outlet_id = ?';
    const params = isAllOutlets ? [] : [effectiveOutlet];

    // Single query — semua bucket dalam 1 round-trip
    const [statsRows] = await poolWaschenPos.execute(
      `SELECT
        -- All-time totals (status not cancelled)
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END), 0)        AS total_omset,
        SUM(CASE WHEN status <> 'cancelled' THEN 1 ELSE 0 END)                          AS total_transaksi,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN paid_amount ELSE 0 END), 0)  AS total_pelunasan,

        -- Today
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = CURDATE() THEN total ELSE 0 END), 0)        AS omset_today,
        SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END)                          AS transaksi_today,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = CURDATE() THEN paid_amount ELSE 0 END), 0)  AS pelunasan_today,

        -- This month
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN total ELSE 0 END), 0)        AS omset_month,
        SUM(CASE WHEN status <> 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END)                          AS transaksi_month,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN paid_amount ELSE 0 END), 0)  AS pelunasan_month,

        -- Pending workload (active queue)
        SUM(CASE WHEN status IN ('pending', 'process', 'ready_for_pickup', 'ready_for_delivery') THEN 1 ELSE 0 END) AS pending_transactions
       FROM tr_transaction
       WHERE deleted_at IS NULL ${outletFilter}`,
      params
    );

    // Customer count — separate query (tidak bisa di-join karena scope global)
    const [[customerRow]] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS total_customers FROM mst_customer WHERE is_active = 1 AND deleted_at IS NULL`
    );

    const r = statsRows[0] || {};

    let outletComparison = null;
    if (compare && (period === 'today' || period === 'month')) {
      const dateSql = period === 'today'
        ? 'DATE(t.created_at) = CURDATE()'
        : 'YEAR(t.created_at) = YEAR(CURDATE()) AND MONTH(t.created_at) = MONTH(CURDATE())';
      const [cmpRows] = await poolWaschenPos.execute(
        `SELECT o.id AS outletId, o.name AS outletName,
          COALESCE(SUM(t.total), 0) AS omset,
          COUNT(t.id) AS transaksi
         FROM mst_outlet o
         LEFT JOIN tr_transaction t ON t.outlet_id = o.id
           AND t.deleted_at IS NULL AND t.status <> 'cancelled' AND ${dateSql}
         WHERE o.is_active = 1 AND o.deleted_at IS NULL
         GROUP BY o.id, o.name
         ORDER BY omset DESC`
      );
      outletComparison = cmpRows.map((row) => ({
        outletId: row.outletId,
        outletName: row.outletName,
        omset: Number(row.omset || 0),
        transaksi: Number(row.transaksi || 0),
      }));
    }

    return res.status(200).json({
      success: true,
      data: {
        outletId: isAllOutlets ? '_all' : effectiveOutlet,
        period,
        total_omset: Number(r.total_omset ?? 0),
        total_transaksi: Number(r.total_transaksi ?? 0),
        total_pelunasan: Number(r.total_pelunasan ?? 0),
        omset_today: Number(r.omset_today ?? 0),
        pelunasan_today: Number(r.pelunasan_today ?? 0),
        transaksi_today: Number(r.transaksi_today ?? 0),
        omset_month: Number(r.omset_month ?? 0),
        pelunasan_month: Number(r.pelunasan_month ?? 0),
        transaksi_month: Number(r.transaksi_month ?? 0),
        pending_transactions: Number(r.pending_transactions ?? 0),
        total_customers: Number(customerRow?.total_customers ?? 0),
        outlet_comparison: outletComparison,
      },
    });
  } catch (err) {
    console.error('[getDashboardStats] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik dashboard.' });
  }
};
