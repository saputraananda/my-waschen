import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/dashboard/stats ──────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const queryOutletId = req.query?.outletId;
    const userRole = req.user?.roleCode;

    // Admin, finance, owner bisa lihat semua outlet (atau filter via query)
    const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
    const isGlobalRole = globalRoles.includes(userRole);

    let outletFilter = '';
    const params = [];

    if (queryOutletId) {
      outletFilter = 'AND outlet_id = ?';
      params.push(queryOutletId);
    } else if (userOutletId && !isGlobalRole) {
      outletFilter = 'AND outlet_id = ?';
      params.push(userOutletId);
    }

    const [[daily], [summary], [customerRow]] = await Promise.all([
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(total), 0) AS total_omset,
          COUNT(id)  AS total_transaksi
         FROM tr_transaction
         WHERE DATE(created_at) = CURDATE() AND status != 'cancelled' AND deleted_at IS NULL ${outletFilter}`,
        params
      ),
      poolWaschenPos.execute(
        `SELECT
          COUNT(id) AS pending_transactions
         FROM tr_transaction
         WHERE status IN ('pending', 'process', 'ready_for_pickup', 'ready_for_delivery') AND deleted_at IS NULL ${outletFilter}`,
        params
      ),
      poolWaschenPos.execute(
        `SELECT COUNT(*) AS total_customers FROM mst_customer WHERE is_active = 1`
      ),
    ]);

    const dailyRow    = daily[0]   || {};
    const summaryRow  = summary[0] || {};
    const custRow     = customerRow[0] || {};

    return res.status(200).json({
      success: true,
      data: {
        total_omset:          Number(dailyRow.total_omset          ?? 0),
        total_transaksi:      Number(dailyRow.total_transaksi      ?? 0),
        pending_transactions: Number(summaryRow.pending_transactions ?? 0),
        total_customers:      Number(custRow.total_customers        ?? 0),
      },
    });
  } catch (err) {
    console.error('[getDashboardStats] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik dashboard.' });
  }
};
