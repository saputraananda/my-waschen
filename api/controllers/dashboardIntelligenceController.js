// ─────────────────────────────────────────────────────────────────────────────
// dashboardIntelligenceController.js — Dashboard Intelligence API
// Phase 4: Dashboard Intelligence - Additional endpoints
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/dashboard/low-stock ────────────────────────────────────────────────
// Proactive low stock alerts for admin dashboard
export const getLowStockAlerts = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);
    const userOutletId = req.user?.outletId;

    // Build outlet filter
    let outletFilter = '';
    let params = [];

    if (isGlobal) {
      const qOutlet = req.query?.outletId;
      if (qOutlet) {
        outletFilter = 'AND o.id = ?';
        params.push(qOutlet);
      }
      // All outlets for global admin
    } else {
      if (!userOutletId) {
        return res.status(400).json({ success: false, message: 'User outlet not set.' });
      }
      outletFilter = 'AND o.id = ?';
      params.push(userOutletId);
    }

    // Query low stock items with outlet breakdown
    const [rows] = await poolWaschenPos.execute(
      `SELECT
        i.id AS itemId,
        i.name AS itemName,
        i.item_code AS itemCode,
        i.unit,
        o.id AS outletId,
        o.name AS outletName,
        COALESCE(st.stock_qty, 0) AS currentStock,
        COALESCE(st.min_stock, i.min_stock_default) AS minStock,
        ROUND(COALESCE(st.stock_qty, 0) / NULLIF(COALESCE(st.min_stock, i.min_stock_default), 0) * 100, 1) AS stockPercentage
      FROM mst_inventory_item i
      JOIN mst_inventory_category c ON c.id = i.category_id
      CROSS JOIN mst_outlet o
      LEFT JOIN mst_inventory_outlet_stock st ON st.inventory_id = i.id AND st.outlet_id = o.id
      WHERE i.is_active = 1
        AND o.is_active = 1
        AND o.deleted_at IS NULL
        AND i.deleted_at IS NULL
        ${outletFilter}
        AND COALESCE(st.stock_qty, 0) <= COALESCE(st.min_stock, i.min_stock_default)
      ORDER BY stockPercentage ASC, o.name, i.name
      LIMIT 50`,
      params
    );

    // Categorize by urgency
    const alerts = rows.map(r => {
      const current = Number(r.currentStock);
      const min = Number(r.minStock);
      const pct = Number(r.stockPercentage || 0);

      let urgency;
      if (current === 0 || pct <= 25) urgency = 'critical';
      else if (pct <= 50) urgency = 'high';
      else if (pct <= 75) urgency = 'medium';
      else urgency = 'low';

      return {
        itemId: r.itemId,
        itemName: r.itemName,
        itemCode: r.itemCode,
        unit: r.unit,
        outletId: r.outletId,
        outletName: r.outletName,
        currentStock: current,
        minStock: min,
        stockPercentage: pct,
        urgency,
        shortage: Math.max(0, min - current),
      };
    });

    // Summary by urgency
    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.urgency === 'critical').length,
      high: alerts.filter(a => a.urgency === 'high').length,
      medium: alerts.filter(a => a.urgency === 'medium').length,
      low: alerts.filter(a => a.urgency === 'low').length,
    };

    return res.json({
      success: true,
      data: {
        alerts,
        summary,
        hasAlerts: alerts.length > 0,
      },
    });
  } catch (err) {
    console.error('[getLowStockAlerts] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat low stock alerts.' });
  }
};

// ─── GET /api/dashboard/outlet-comparison ────────────────────────────────────────
// Side-by-side outlet performance comparison
export const getOutletComparison = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

    if (!isGlobal) {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const period = req.query?.period || 'today'; // today, week, month
    let dateCondition;

    if (period === 'today') {
      dateCondition = 'DATE(t.created_at) = CURDATE()';
    } else if (period === 'week') {
      dateCondition = 'DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'month') {
      dateCondition = 'DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    } else {
      dateCondition = '1=1'; // All time
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        o.id AS outletId,
        o.name AS outletName,
        o.is_active AS isActive,
        COALESCE(SUM(t.total), 0) AS revenue,
        COUNT(DISTINCT t.id) AS transactionCount,
        COUNT(DISTINCT t.customer_id) AS uniqueCustomers
      FROM mst_outlet o
      LEFT JOIN tr_transaction t ON t.outlet_id = o.id
        AND t.deleted_at IS NULL
        AND t.status NOT IN ('cancelled')
        AND ${dateCondition}
      WHERE o.deleted_at IS NULL
      GROUP BY o.id, o.name, o.is_active
      ORDER BY revenue DESC`,
      []
    );

    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue || 0), 0);

    const outlets = rows.map(r => {
      const revenue = Number(r.revenue || 0);
      const txCount = Number(r.transactionCount || 0);
      const avgValue = txCount > 0 ? Math.round(revenue / txCount) : 0;
      const pct = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;

      return {
        outletId: r.outletId,
        outletName: r.outletName,
        isActive: r.isActive === 1 || r.isActive === true,
        revenue,
        transactionCount: txCount,
        uniqueCustomers: Number(r.uniqueCustomers || 0),
        avgTransactionValue: avgValue,
        marketShare: pct,
      };
    });

    return res.json({
      success: true,
      data: {
        outlets,
        period,
        totalRevenue,
        totalTransactions: outlets.reduce((s, o) => s + o.transactionCount, 0),
      },
    });
  } catch (err) {
    console.error('[getOutletComparison] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat perbandingan outlet.' });
  }
};

// ─── GET /api/dashboard/target-daily ───────────────────────────────────────────
// Daily target progress for admin dashboard
export const getDailyTargetProgress = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);

    if (!isGlobal) {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const today = new Date();
    const year = Number(req.query?.year) || today.getFullYear();
    const month = Number(req.query?.month) || (today.getMonth() + 1);
    const qOutletId = req.query?.outletId;

    // Get outlets to iterate
    let outletParams = [];
    let outletFilter = '';
    if (qOutletId) {
      outletFilter = 'AND o.id = ?';
      outletParams.push(qOutletId);
    }

    // Get targets for period
    const [targetRows] = await poolWaschenPos.execute(
      `SELECT
        t.outlet_id AS outletId,
        o.name AS outletName,
        t.target_amount AS targetAmount
      FROM mst_outlet_target t
      JOIN mst_outlet o ON o.id = t.outlet_id
      WHERE t.deleted_at IS NULL
        AND t.period_year = ?
        AND t.period_month = ?
        ${outletFilter}`,
      [year, month, ...outletParams]
    );

    if (targetRows.length === 0) {
      return res.json({ success: true, data: { targets: [], message: 'No targets set for this period.' } });
    }

    // Get actual revenue for period
    const [actualRows] = await poolWaschenPos.execute(
      `SELECT
        t.outlet_id AS outletId,
        COALESCE(SUM(t.total), 0) AS actualAmount
      FROM tr_transaction t
      WHERE t.deleted_at IS NULL
        AND t.status NOT IN ('cancelled', 'void')
        AND YEAR(t.created_at) = ?
        AND MONTH(t.created_at) = ?
        AND t.outlet_id IN (${targetRows.map(() => '?').join(',')})
      GROUP BY t.outlet_id`,
      [year, month, ...targetRows.map(r => r.outletId)]
    );

    const actualMap = new Map(actualRows.map(r => [r.outletId, Number(r.actualAmount)]));

    // Calculate days
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayDate = today.getFullYear() === year && (today.getMonth() + 1) === month ? today.getDate() : daysInMonth;
    const dailyTarget = targetRows[0].targetAmount / daysInMonth;
    const cumulativeTarget = dailyTarget * todayDate;

    const targets = targetRows.map(r => {
      const target = Number(r.targetAmount);
      const actual = actualMap.get(r.outletId) || 0;
      const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
      const remaining = Math.max(0, target - actual);
      const isOnTrack = actual >= cumulativeTarget;

      return {
        outletId: r.outletId,
        outletName: r.outletName,
        targetAmount: target,
        actualAmount: actual,
        percentage: pct,
        remaining,
        dailyTarget: Math.round(dailyTarget),
        cumulativeTarget: Math.round(cumulativeTarget),
        isOnTrack,
        status: pct >= 100 ? 'achieved' : pct >= 80 ? 'on_track' : pct >= 50 ? 'behind' : 'critical',
      };
    });

    return res.json({
      success: true,
      data: {
        year,
        month,
        targets,
        summary: {
          totalTarget: targets.reduce((s, t) => s + t.targetAmount, 0),
          totalActual: targets.reduce((s, t) => s + t.actualAmount, 0),
          avgPercentage: targets.length > 0 ? Math.round(targets.reduce((s, t) => s + t.percentage, 0) / targets.length) : 0,
          onTrackCount: targets.filter(t => t.isOnTrack).length,
          achievedCount: targets.filter(t => t.status === 'achieved').length,
        },
      },
    });
  } catch (err) {
    console.error('[getDailyTargetProgress] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat progress target.' });
  }
};

// ─── GET /api/dashboard/metrics ────────────────────────────────────────────────
// Transaction metrics summary
export const getDashboardMetrics = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const isGlobal = ['admin', 'superadmin', 'owner', 'finance'].includes(userRole);
    const userOutletId = req.user?.outletId;

    let outletFilter = '';
    let params = [];

    if (isGlobal) {
      const qOutlet = req.query?.outletId;
      if (qOutlet) {
        outletFilter = 'AND t.outlet_id = ?';
        params.push(qOutlet);
      }
    } else {
      if (!userOutletId) {
        return res.status(400).json({ success: false, message: 'User outlet not set.' });
      }
      outletFilter = 'AND t.outlet_id = ?';
      params.push(userOutletId);
    }

    // Today stats
    const [todayRows] = await poolWaschenPos.execute(
      `SELECT
        COUNT(*) AS totalTransactions,
        COALESCE(SUM(total), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS paidAmount,
        COALESCE(SUM(CASE WHEN payment_status = 'partial' THEN total ELSE 0 END), 0) AS partialAmount,
        COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total ELSE 0 END), 0) AS unpaidAmount,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completedCount,
        COUNT(CASE WHEN status IN ('pending', 'process', 'ready_for_pickup', 'ready_for_delivery') THEN 1 END) AS pendingCount
      FROM tr_transaction t
      WHERE t.deleted_at IS NULL
        AND DATE(t.created_at) = CURDATE()
        ${outletFilter}`,
      params
    );

    // This month stats
    const [monthRows] = await poolWaschenPos.execute(
      `SELECT
        COUNT(*) AS totalTransactions,
        COALESCE(SUM(total), 0) AS totalRevenue,
        COALESCE(SUM(paid_amount), 0) AS totalPaid
      FROM tr_transaction t
      WHERE t.deleted_at IS NULL
        AND YEAR(t.created_at) = YEAR(CURDATE())
        AND MONTH(t.created_at) = MONTH(CURDATE())
        ${outletFilter}`,
      params
    );

    const today = todayRows[0] || {};
    const month = monthRows[0] || {};

    const todayTxCount = Number(today.totalTransactions || 0);
    const todayRevenue = Number(today.totalRevenue || 0);
    const avgTransactionValue = todayTxCount > 0 ? Math.round(todayRevenue / todayTxCount) : 0;

    return res.json({
      success: true,
      data: {
        today: {
          transactionCount: todayTxCount,
          totalRevenue: todayRevenue,
          avgTransactionValue,
          completedCount: Number(today.completedCount || 0),
          pendingCount: Number(today.pendingCount || 0),
          paidAmount: Number(today.paidAmount || 0),
          partialAmount: Number(today.partialAmount || 0),
          unpaidAmount: Number(today.unpaidAmount || 0),
        },
        month: {
          transactionCount: Number(month.totalTransactions || 0),
          totalRevenue: Number(month.totalRevenue || 0),
          totalPaid: Number(month.totalPaid || 0),
        },
      },
    });
  } catch (err) {
    console.error('[getDashboardMetrics] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat metrics.' });
  }
};
