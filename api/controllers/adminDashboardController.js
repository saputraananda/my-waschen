import { readFileSync } from 'fs';
import { poolWaschenPos } from '../db/connection.js';
import logger from '../utils/logger.js';

const DEBUG_ENV_PATH = '.dbg/admin-dashboard-500.env';
const DEBUG_FALLBACK_URL = 'http://127.0.0.1:7777/event';
const DEBUG_FALLBACK_SESSION = 'admin-dashboard-500';

const debugReport = (hypothesisId, location, msg, data = {}, runId = 'pre-fix') => {
  // Skip debug reporting if DEBUG_MODE is not enabled
  if (process.env.DEBUG_MODE !== 'true') return;

  let debugServerUrl = DEBUG_FALLBACK_URL;
  let debugSessionId = DEBUG_FALLBACK_SESSION;

  try {
    const envContent = readFileSync(DEBUG_ENV_PATH, 'utf8');
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl;
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId;
  } catch {
    // Debug env file not found - skip silently
    return;
  }

  fetch(debugServerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId,
      hypothesisId,
      location,
      msg,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {}); // Silent fail for debug reporting
};

// Get outlet performance data (revenue per outlet)
export const getOutletPerformance = async (req, res) => {
  try {
    const { period = '7d' } = req.query; // 7d, 30d, 90d
    // #region debug-point A:request-entry
    debugReport('A', 'adminDashboardController.js:getOutletPerformance:entry', '[DEBUG] getOutletPerformance called', {
      period,
      userRole: req.user?.roleCode || null,
      userOutletId: req.user?.outletId || null,
    });
    // #endregion
    
    let dateCondition = 'DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    if (period === '30d') {
      dateCondition = 'DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    } else if (period === '90d') {
      dateCondition = 'DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
    }
    // #region debug-point B:date-condition
    debugReport('B', 'adminDashboardController.js:getOutletPerformance:dateCondition', '[DEBUG] date condition resolved', {
      period,
      dateCondition,
    });
    // #endregion

    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        o.id,
        o.name,
        o.is_active,
        COALESCE(SUM(t.total), 0) as total_revenue,
        COUNT(DISTINCT t.id) as total_transactions
      FROM mst_outlet o
      LEFT JOIN tr_transaction t ON o.id = t.outlet_id 
        AND t.deleted_at IS NULL 
        AND t.status NOT IN ('cancelled')
        AND ${dateCondition}
      WHERE o.deleted_at IS NULL
      GROUP BY o.id, o.name, o.is_active
      ORDER BY total_revenue DESC`,
      []
    );
    // #region debug-point C:query-success
    debugReport('C', 'adminDashboardController.js:getOutletPerformance:querySuccess', '[DEBUG] outlet performance query succeeded', {
      period,
      rowCount: rows.length,
      sample: rows[0] || null,
    });
    // #endregion

    const data = rows.map(row => ({
      outletId: row.id,
      outletName: row.name,
      isActive: row.is_active === 1 || row.is_active === true,
      totalRevenue: Number(row.total_revenue),
      totalTransactions: Number(row.total_transactions)
    }));
    // #region debug-point D:response-shape
    debugReport('D', 'adminDashboardController.js:getOutletPerformance:responseShape', '[DEBUG] outlet performance response mapped', {
      period,
      dataCount: data.length,
      firstItem: data[0] || null,
    });
    // #endregion

    return res.json({
      success: true,
      data,
      period
    });
  } catch (err) {
    // #region debug-point E:error
    debugReport('E', 'adminDashboardController.js:getOutletPerformance:error', '[DEBUG] getOutletPerformance failed', {
      name: err?.name || null,
      message: err?.message || null,
      code: err?.code || null,
      sqlMessage: err?.sqlMessage || null,
      stack: err?.stack || null,
    });
    // #endregion
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to get outlet performance data' 
    });
  }
};

// Get cash deposit status per outlet
export const getCashDepositStatus = async (req, res) => {
  try {
    const { period = '30d' } = req.query; // 7d, 30d, 90d
    
    let dateCondition = 'DATE(cd.deposit_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    if (period === '7d') {
      dateCondition = 'DATE(cd.deposit_date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === '90d') {
      dateCondition = 'DATE(cd.deposit_date) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        o.id,
        o.name,
        o.is_active,
        cd.status,
        COALESCE(COUNT(cd.id), 0) as count,
        COALESCE(SUM(cd.deposit_amount), 0) as total_amount
      FROM mst_outlet o
      LEFT JOIN tr_cash_deposit cd ON o.id = cd.outlet_id 
        AND cd.deleted_at IS NULL
        AND ${dateCondition}
      WHERE o.deleted_at IS NULL
      GROUP BY o.id, o.name, o.is_active, cd.status
      ORDER BY o.name`,
      []
    );

    // Transform data for chart
    const outletData = {};
    rows.forEach(row => {
      if (!outletData[row.id]) {
        outletData[row.id] = {
          outletId: row.id,
          outletName: row.name,
          isActive: row.is_active === 1 || row.is_active === true,
          pending: 0,
          approved: 0,
          rejected: 0,
          pendingAmount: 0,
          approvedAmount: 0,
          rejectedAmount: 0
        };
      }
      if (row.status) {
        outletData[row.id][row.status] = Number(row.count);
        outletData[row.id][`${row.status}Amount`] = Number(row.total_amount);
      }
    });

    const data = Object.values(outletData);

    return res.json({
      success: true,
      data,
      period
    });
  } catch (err) {
    logger.error('Gagal memuat cash deposit status', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to get cash deposit status data'
    });
  }
};

// Get payment method trend (cash vs non-cash)
export const getPaymentMethodTrend = async (req, res) => {
  try {
    const { days = 14 } = req.query;
    
    // Get data for last N days
    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        DATE(t.created_at) as date,
        SUM(CASE WHEN pi.method = 'cash' THEN pi.amount ELSE 0 END) as cash_amount,
        SUM(CASE WHEN pi.method != 'cash' THEN pi.amount ELSE 0 END) as non_cash_amount,
        COUNT(DISTINCT CASE WHEN pi.method = 'cash' THEN t.id END) as cash_transactions,
        COUNT(DISTINCT CASE WHEN pi.method != 'cash' THEN t.id END) as non_cash_transactions
      FROM tr_transaction t
      JOIN tr_payment_item pi ON t.id = pi.transaction_id
      WHERE t.deleted_at IS NULL 
        AND t.status NOT IN ('cancelled', 'void')
        AND DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC`,
      [Number(days)]
    );

    const data = rows.map(row => ({
      date: row.date,
      cashAmount: Number(row.cash_amount),
      nonCashAmount: Number(row.non_cash_amount),
      cashTransactions: Number(row.cash_transactions),
      nonCashTransactions: Number(row.non_cash_transactions)
    }));

    return res.json({
      success: true,
      data
    });
  } catch (err) {
    logger.error('Gagal memuat payment method trend', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment method trend data'
    });
  }
};
