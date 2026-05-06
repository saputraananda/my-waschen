import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/dashboard/stats ──────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const [[daily], [summary], [customerRow]] = await Promise.all([
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(total_omset), 0)      AS total_omset,
          COALESCE(SUM(total_transaksi), 0)  AS total_transaksi
         FROM vw_daily_transaction_summary
         WHERE tanggal = CURDATE()`
      ),
      poolWaschenPos.execute(
        `SELECT
          COALESCE(SUM(pending_transactions), 0) AS pending_transactions
         FROM vw_owner_dashboard_summary`
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
