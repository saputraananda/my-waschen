import { poolWaschenPos } from '../db/connection.js';

const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];

// ─── GET /api/dashboard/stats ──────────────────────────────────────────────────
// Multi-outlet admin: query outletId wajib. Omset per hari / bulan / akumulasi + opsional banding outlet.
export const getDashboardStats = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const queryOutletId = req.query?.outletId;
    const userRole = req.user?.roleCode;
    const compare = req.query?.compare === '1';
    const period = ['today', 'month', 'all'].includes(req.query?.period) ? req.query.period : 'all';

    const isGlobalRole = globalRoles.includes(userRole);

    let effectiveOutlet = null;
    if (isGlobalRole) {
      if (!queryOutletId) {
        return res.status(400).json({
          success: false,
          message: 'Pilih outlet terlebih dahulu (kirim query outletId).',
        });
      }
      effectiveOutlet = queryOutletId;
    } else {
      effectiveOutlet = userOutletId;
      if (queryOutletId && queryOutletId !== userOutletId) {
        return res.status(403).json({ success: false, message: 'Akses outlet ditolak.' });
      }
      if (!effectiveOutlet) {
        return res.status(400).json({ success: false, message: 'Outlet pengguna tidak terpasang.' });
      }
    }

    const outletParam = [effectiveOutlet];
    const baseWhere = `t.status <> 'cancelled' AND t.deleted_at IS NULL AND t.outlet_id = ?`;

    const [[totals], [todayAgg], [monthAgg], [summary], [customerRow]] = await Promise.all([
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(t.total), 0) AS total_omset,
          COUNT(t.id) AS total_transaksi
         FROM tr_transaction t
         WHERE ${baseWhere}`,
        outletParam
      ),
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(t.total), 0) AS omset,
          COUNT(t.id) AS cnt
         FROM tr_transaction t
         WHERE ${baseWhere} AND DATE(t.created_at) = CURDATE()`,
        outletParam
      ),
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(t.total), 0) AS omset,
          COUNT(t.id) AS cnt
         FROM tr_transaction t
         WHERE ${baseWhere}
           AND YEAR(t.created_at) = YEAR(CURDATE())
           AND MONTH(t.created_at) = MONTH(CURDATE())`,
        outletParam
      ),
      poolWaschenPos.execute(
        `SELECT COUNT(id) AS pending_transactions
         FROM tr_transaction
         WHERE status IN ('pending', 'process', 'ready_for_pickup', 'ready_for_delivery')
           AND deleted_at IS NULL AND outlet_id = ?`,
        outletParam
      ),
      poolWaschenPos.execute(`SELECT COUNT(*) AS total_customers FROM mst_customer WHERE is_active = 1`),
    ]);

    const totalsRow = totals[0] || {};
    const todayRow = todayAgg[0] || {};
    const monthRow = monthAgg[0] || {};
    const summaryRow = summary[0] || {};
    const custRow = customerRow[0] || {};

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
         WHERE o.is_active = 1
         GROUP BY o.id, o.name
         ORDER BY omset DESC`
      );
      outletComparison = cmpRows.map((r) => ({
        outletId: r.outletId,
        outletName: r.outletName,
        omset: Number(r.omset || 0),
        transaksi: Number(r.transaksi || 0),
      }));
    }

    return res.status(200).json({
      success: true,
      data: {
        outletId: effectiveOutlet,
        period,
        total_omset: Number(totalsRow.total_omset ?? 0),
        total_transaksi: Number(totalsRow.total_transaksi ?? 0),
        omset_today: Number(todayRow.omset ?? 0),
        transaksi_today: Number(todayRow.cnt ?? 0),
        omset_month: Number(monthRow.omset ?? 0),
        transaksi_month: Number(monthRow.cnt ?? 0),
        pending_transactions: Number(summaryRow.pending_transactions ?? 0),
        total_customers: Number(custRow.total_customers ?? 0),
        outlet_comparison: outletComparison,
      },
    });
  } catch (err) {
    console.error('[getDashboardStats] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik dashboard.' });
  }
};
