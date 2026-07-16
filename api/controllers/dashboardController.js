import { poolWaschenPos } from '../db/connection.js';
import logger from '../utils/logger.js';

const globalRoles = ['admin'];

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

    const DONE_STATUSES = "('completed', 'ready_for_pickup', 'ready_for_delivery')";

    // Single query — semua bucket dalam 1 round-trip
    const [statsRows] = await poolWaschenPos.execute(
      `SELECT
        -- All-time totals (status not cancelled = PROYEK)
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total ELSE 0 END), 0)        AS total_omset,
        COALESCE(SUM(CASE WHEN status IN ${DONE_STATUSES} THEN total ELSE 0 END), 0)    AS total_omset_real,
        SUM(CASE WHEN status <> 'cancelled' THEN 1 ELSE 0 END)                          AS total_transaksi,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN paid_amount ELSE 0 END), 0)  AS total_pelunasan,

        -- Today PROYEK (all non-cancelled)
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = CURDATE() THEN total ELSE 0 END), 0)        AS omset_today,
        SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END)                          AS transaksi_today,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = CURDATE() THEN paid_amount ELSE 0 END), 0)  AS pelunasan_today,

        -- Today REAL (completed only = cash received)
        COALESCE(SUM(CASE WHEN status IN ${DONE_STATUSES} AND DATE(created_at) = CURDATE() THEN total ELSE 0 END), 0)  AS omset_today_real,
        SUM(CASE WHEN status IN ${DONE_STATUSES} AND DATE(created_at) = CURDATE() THEN 1 ELSE 0 END)                          AS transaksi_today_real,

        -- Yesterday PROYEK (for trend calculation)
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN total ELSE 0 END), 0)        AS omset_yesterday,
        SUM(CASE WHEN status <> 'cancelled' AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END)                          AS transaksi_yesterday,

        -- This month PROYEK
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN total ELSE 0 END), 0)        AS omset_month,
        SUM(CASE WHEN status <> 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END)                          AS transaksi_month,
        COALESCE(SUM(CASE WHEN status <> 'cancelled' AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN paid_amount ELSE 0 END), 0)  AS pelunasan_month,

        -- This month REAL (completed only = cash received)
        COALESCE(SUM(CASE WHEN status IN ${DONE_STATUSES} AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN total ELSE 0 END), 0)  AS omset_month_real,
        SUM(CASE WHEN status IN ${DONE_STATUSES} AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END)                          AS transaksi_month_real,

        -- Pending workload (active queue = not done yet)
        SUM(CASE WHEN status NOT IN ${DONE_STATUSES} AND status <> 'cancelled' THEN 1 ELSE 0 END) AS pending_transactions
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
    const PRODUCTION_ROLES = ['produksi'];
    const isProduksi = PRODUCTION_ROLES.includes(userRole);
    if (compare && (period === 'today' || period === 'month')) {      const dateSql = period === 'today'
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

    // PRODUCTION role: strip financial data (omset/pelunasan/cash) — operational stats only
    const safeData = {
      outletId: isAllOutlets ? '_all' : effectiveOutlet,
      period,
      // Non-financial: semua role dapat operational stats
      total_transaksi: Number(r.total_transaksi ?? 0),
      transaksi_today: Number(r.transaksi_today ?? 0),
      transaksi_today_real: Number(r.transaksi_today_real ?? 0),
      transaksi_yesterday: Number(r.transaksi_yesterday ?? 0),
      transaksi_month: Number(r.transaksi_month ?? 0),
      transaksi_month_real: Number(r.transaksi_month_real ?? 0),
      pending_transactions: Number(r.pending_transactions ?? 0),
      total_customers: Number(customerRow?.total_customers ?? 0),
    };
    // Financial fields: frontline & admin ONLY — produksi gets empty financial data
    if (!isProduksi) {
      // PROYEK = all non-cancelled (order value)
      safeData.total_omset = Number(r.total_omset ?? 0);
      safeData.omset_today = Number(r.omset_today ?? 0);
      safeData.omset_yesterday = Number(r.omset_yesterday ?? 0);
      safeData.omset_month = Number(r.omset_month ?? 0);
      // REAL = only completed/ready (cash received)
      safeData.total_omset_real = Number(r.total_omset_real ?? 0);
      safeData.omset_today_real = Number(r.omset_today_real ?? 0);
      safeData.omset_month_real = Number(r.omset_month_real ?? 0);
      // Pelunasan
      safeData.total_pelunasan = Number(r.total_pelunasan ?? 0);
      safeData.pelunasan_today = Number(r.pelunasan_today ?? 0);
      safeData.pelunasan_month = Number(r.pelunasan_month ?? 0);
      safeData.outlet_comparison = outletComparison;

      // Calculate trend vs yesterday
      const omsetYesterday = Number(r.omset_yesterday ?? 0);
      const omsetToday = Number(r.omset_today ?? 0);
      const transaksiYesterday = Number(r.transaksi_yesterday ?? 0);
      const transaksiToday = Number(r.transaksi_today ?? 0);

      // Trend percentage: (today - yesterday) / yesterday * 100
      safeData.trend_omset = omsetYesterday > 0
        ? Math.round(((omsetToday - omsetYesterday) / omsetYesterday) * 100)
        : (omsetToday > 0 ? 100 : 0);
      safeData.trend_transaksi = transaksiYesterday > 0
        ? Math.round(((transaksiToday - transaksiYesterday) / transaksiYesterday) * 100)
        : (transaksiToday > 0 ? 100 : 0);
    }
    return res.status(200).json({ success: true, data: safeData });
  } catch (err) {
    logger.error('Get dashboard stats failed', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik dashboard.' });
  }
};

// ─── GET /api/dashboard/revenue-trend ──────────────────────────────────────────
// Revenue trend chart: Aktual vs Target per day
export const getRevenueTrend = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobalRole = globalRoles.includes(userRole);
    const PRODUCTION_ROLES = ['produksi'];
    const isProduksi = PRODUCTION_ROLES.includes(userRole);

    // Parse filters
    const { range = '7d', startDate, endDate, outletId } = req.query;

    // Calculate date range
    let start;
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else if (range === 'today') {
      start = today;
    } else if (range === '7d') {
      start = new Date(today);
      start.setDate(start.getDate() - 6);
    } else if (range === '30d') {
      start = new Date(today);
      start.setDate(start.getDate() - 29);
    } else {
      start = new Date(today);
      start.setDate(start.getDate() - 6);
    }

    // Get outlet filter
    let effectiveOutlet = null;
    if (isGlobalRole) {
      effectiveOutlet = outletId || null;
    } else {
      effectiveOutlet = userOutletId;
    }

    const outletFilter = effectiveOutlet ? 'AND outlet_id = ?' : '';
    const params = effectiveOutlet ? [effectiveOutlet] : [];

    // Get daily revenue for the date range
    const [revenueRows] = await poolWaschenPos.query(
      `SELECT
         DATE(created_at) as date,
         COALESCE(SUM(total), 0) as daily_revenue,
         COUNT(*) as transaction_count
       FROM tr_transaction
       WHERE deleted_at IS NULL
         AND status != 'cancelled'
         AND created_at >= ?
         AND created_at <= ?
         ${outletFilter}
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [start, end, ...params]
    );

    // Get target from database
    let dailyTarget = 500000; // Default 500k per hari
    try {
      const now = new Date();
      let targetQuery, targetParams;

      if (effectiveOutlet) {
        targetQuery = `SELECT target_amount FROM mst_outlet_target
         WHERE deleted_at IS NULL AND outlet_id = ?
         AND period_year = YEAR(CURDATE()) AND period_month = MONTH(CURDATE())
         LIMIT 1`;
        targetParams = [effectiveOutlet];
      } else {
        // Get average target from all outlets if no specific outlet
        targetQuery = `SELECT AVG(target_amount) as avg_target FROM mst_outlet_target
         WHERE deleted_at IS NULL
         AND period_year = YEAR(CURDATE()) AND period_month = MONTH(CURDATE())`;
        targetParams = [];
      }

      const [targetRows] = await poolWaschenPos.query(targetQuery, targetParams);
      if (targetRows.length > 0 && targetRows[0].target_amount > 0) {
        const monthlyTarget = Number(targetRows[0].target_amount);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        dailyTarget = Math.round(monthlyTarget / daysInMonth);
      } else if (targetRows[0]?.avg_target > 0) {
        const avgTarget = Number(targetRows[0].avg_target);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        dailyTarget = Math.round(avgTarget / daysInMonth);
      }
    } catch (e) {
      console.warn('Target query failed, using default:', e.message);
    }

    // Calculate actual revenue
    const dateMap = new Map();
    revenueRows.forEach(r => {
      const dateStr = r.date instanceof Date
        ? r.date.toISOString().slice(0, 10)
        : new Date(r.date).toISOString().slice(0, 10);
      dateMap.set(dateStr, {
        date: dateStr,
        actual: Number(r.daily_revenue),
        transactions: Number(r.transaction_count),
      });
    });

    // Fill missing dates with zero
    const result = [];
    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      if (dateMap.has(dateStr)) {
        result.push(dateMap.get(dateStr));
      } else {
        result.push({
          date: dateStr,
          actual: 0,
          transactions: 0,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    // Calculate target based on database target
    // PRODUCTION: no target/financial data — empty array
    const trendWithTarget = isProduksi ? [] : result.map(day => ({
      ...day,
      target: dailyTarget,
    }));

    // Summary stats — only calculate financials for non-produksi
    const totalActual = isProduksi ? 0 : result.reduce((sum, d) => sum + d.actual, 0);
    const totalTarget = isProduksi ? 0 : trendWithTarget.reduce((sum, d) => sum + d.target, 0);
    const achievementRate = isProduksi ? 0 : (totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0);

    return res.status(200).json({
      success: true,
      data: {
        range: range,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        // PRODUCTION strips financials: daily tanpa target, summary tanpa omset/target/rate
        daily: isProduksi
          ? result.map(d => ({ date: d.date, transactions: d.transactions }))
          : trendWithTarget,
        summary: isProduksi
          ? { dayCount: result.length, avgDailyTarget: 0 }
          : {
              totalActual,
              totalTarget,
              achievementRate,
              avgDailyActual: result.length > 0 ? Math.round(totalActual / result.length) : 0,
              avgDailyTarget: Math.round(dailyTarget),
              dayCount: result.length,
            },
      },
    });
  } catch (err) {
    logger.error('getRevenueTrend failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat tren revenue.' });
  }
};

// ─── GET /api/dashboard/sparkline ────────────────────────────────────────────
// Returns sparkline data: array of daily values for mini charts
export const getSparkline = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobalRole = globalRoles.includes(userRole);
    const PRODUCTION_ROLES = ['produksi'];
    const isProduksi = PRODUCTION_ROLES.includes(userRole);
    const days = Math.min(parseInt(req.query.days) || 7, 30);

    // Get outlet filter
    let effectiveOutlet = null;
    if (isGlobalRole) {
      effectiveOutlet = req.query.outletId || userOutletId || null;
    } else {
      effectiveOutlet = userOutletId;
      if (!effectiveOutlet) {
        return res.status(400).json({
          success: false,
          message: 'User tidak memiliki outlet yang ditetapkan.'
        });
      }
    }

    const outletFilter = effectiveOutlet ? 'AND outlet_id = ?' : '';
    const params = effectiveOutlet ? [effectiveOutlet] : [];

    // Calculate date range
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);

    // Get daily data for sparkline
    const [rows] = await poolWaschenPos.query(
      `SELECT
         DATE(created_at) as date,
         COALESCE(SUM(total), 0) as omset,
         COUNT(*) as transaksi,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as selesai
       FROM tr_transaction
       WHERE deleted_at IS NULL
         AND status != 'cancelled'
         AND created_at >= ? AND created_at <= ?
         ${outletFilter}
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [start, end, ...params]
    );

    // Fill missing dates with zero
    const omsetArr = [];
    const transaksiArr = [];
    const selesaiArr = [];
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      const row = rows.find(r => {
        const rowDate = r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : new Date(r.date).toISOString().slice(0, 10);
        return rowDate === dateStr;
      });
      omsetArr.push(row ? Number(row.omset) : 0);
      transaksiArr.push(row ? Number(row.transaksi) : 0);
      selesaiArr.push(row ? Number(row.selesai) : 0);
      current.setDate(current.getDate() + 1);
    }

    // Calculate target array (target per day)
    const totalOmset = omsetArr.reduce((a, b) => a + b, 0);
    const targetPerDay = totalOmset > 0 ? Math.round(totalOmset / Math.max(omsetArr.filter(v => v > 0).length, 1)) : 500000;

    const safeData = isProduksi
      ? { transaksi: transaksiArr, selesai: selesaiArr }
      : { omset: omsetArr, target: omsetArr.map(() => targetPerDay), transaksi: transaksiArr, selesai: selesaiArr };
    return res.status(200).json({ success: true, data: safeData });
  } catch (err) {
    logger.error('Get sparkline failed', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data sparkline.' });
  }
};

// ─── GET /api/dashboard/target-tracking ────────────────────────────────────────────
// Returns monthly target with daily breakdown for target achievement tracking
export const getTargetTracking = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const userRole = req.user?.roleCode;
    const isGlobalRole = globalRoles.includes(userRole);
    const PRODUCTION_ROLES = ['produksi'];
    const isProduksi = PRODUCTION_ROLES.includes(userRole);
    const requestedOutletId = req.query.outletId;

    let effectiveOutlet = null;
    if (isGlobalRole) {
      effectiveOutlet = requestedOutletId || null;
    } else {
      effectiveOutlet = userOutletId;
      if (!effectiveOutlet) {
        return res.status(400).json({
          success: false,
          message: 'User tidak memiliki outlet yang ditetapkan.'
        });
      }
    }

    const outletFilter = effectiveOutlet ? 'AND outlet_id = ?' : '';
    const params = effectiveOutlet ? [effectiveOutlet] : [];

    // Get current month's date range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of month
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get monthly target from config (default 40jt)
    const [[targetConfig]] = await poolWaschenPos.execute(
      `SELECT value FROM mst_setting WHERE category = 'target' AND setting_key = 'monthly_revenue_target' LIMIT 1`
    );
    const monthlyTarget = Number(targetConfig?.value) || 40000000;

    // Get daily target (monthly / days in month)
    const daysInMonth = monthEnd.getDate();
    const dayOfMonth = today.getDate();
    const dailyTarget = Math.round(monthlyTarget / daysInMonth);

    // Calculate target until today (for "should be" calculation)
    const targetUntilToday = dailyTarget * dayOfMonth;

    // Get daily revenue for current month
    const [dailyRows] = await poolWaschenPos.execute(
      `SELECT
         DATE(created_at) as date,
         COALESCE(SUM(total), 0) as omset,
         COUNT(*) as transaksi
       FROM tr_transaction
       WHERE deleted_at IS NULL
         AND status != 'cancelled'
         AND YEAR(created_at) = YEAR(CURDATE())
         AND MONTH(created_at) = MONTH(CURDATE())
         ${outletFilter}
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      params
    );

    // Build daily data with target comparison
    const dailyData = [];
    let cumulativeActual = 0;
    let cumulativeTarget = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(now.getFullYear(), now.getMonth(), d);
      const dateStr = dateObj.toISOString().slice(0, 10);
      const dayData = dailyRows.find(r => {
        const rowDate = r.date instanceof Date
          ? r.date.toISOString().slice(0, 10)
          : new Date(r.date).toISOString().slice(0, 10);
        return rowDate === dateStr;
      });

      const actual = dayData ? Number(dayData.omset) : 0;
      cumulativeActual += actual;
      cumulativeTarget += dailyTarget;

      const isToday = d === dayOfMonth;
      const isPast = d < dayOfMonth;

      dailyData.push({
        date: dateStr,
        day: d,
        actual,
        target: dailyTarget,
        cumulativeActual,
        cumulativeTarget,
        achievementPct: cumulativeTarget > 0 ? Math.round((cumulativeActual / cumulativeTarget) * 100) : 0,
        dailyAchievementPct: actual > 0 ? Math.round((actual / dailyTarget) * 100) : 0,
        isToday,
        isPast,
        isFuture: d > dayOfMonth,
      });
    }

    // Summary
    const totalActualMonth = cumulativeActual;
    const monthAchievement = cumulativeTarget > 0 ? Math.round((totalActualMonth / cumulativeTarget) * 100) : 0;
    const remainingDays = daysInMonth - dayOfMonth;
    const remainingTarget = cumulativeTarget - totalActualMonth;
    const neededPerDay = remainingDays > 0 ? Math.round(remainingTarget / remainingDays) : 0;

    // Status
    let status = 'on_track';
    if (monthAchievement < 90) status = 'behind';
    else if (monthAchievement >= 100) status = 'achieved';
    else if (monthAchievement >= 95) status = 'almost';

    // PRODUCTION: strip all financial data — only operational status
    const safeData = {
      month: {
        name: now.toLocaleString('id-ID', { month: 'long', year: 'numeric' }),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      },
      dailyData: isProduksi
        ? dailyData.map(d => ({
            date: d.date,
            day: d.day,
            transactions: d.actual > 0 ? 1 : 0, // count days with transactions
            isToday: d.isToday,
            isPast: d.isPast,
            isFuture: d.isFuture,
          }))
        : dailyData,
      status: isProduksi ? 'on_track' : status,
    };
    return res.status(200).json({ success: true, data: safeData });
  } catch (err) {
    logger.error('Get target tracking failed', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat data target.' });
  }
};

// ─── GET /api/dashboard/outlets ──────────────────────────────────────────────
// Returns list of all outlets with their dashboard summary (admin only)
export const getOutletDashboard = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const isGlobalRole = globalRoles.includes(userRole);

    if (!isGlobalRole) {
      return res.status(403).json({
        success: false,
        message: 'Hanya admin yang dapat melihat semua outlet.'
      });
    }

    // Get all active outlets
    const [outlets] = await poolWaschenPos.execute(
      `SELECT id, name, address, phone, is_active
       FROM mst_outlet
       WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY name ASC`
    );

    // Get stats for each outlet (today + month)
    const outletStats = await Promise.all(
      outlets.map(async (outlet) => {
        const [[todayStats]] = await poolWaschenPos.execute(
          `SELECT
             COALESCE(SUM(total), 0) as omset_today,
             COUNT(*) as transaksi_today,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as selesai_today
           FROM tr_transaction
           WHERE deleted_at IS NULL
             AND status != 'cancelled'
             AND outlet_id = ?
             AND DATE(created_at) = CURDATE()`,
          [outlet.id]
        );

        const [[monthStats]] = await poolWaschenPos.execute(
          `SELECT
             COALESCE(SUM(total), 0) as omset_month,
             COUNT(*) as transaksi_month
           FROM tr_transaction
           WHERE deleted_at IS NULL
             AND status != 'cancelled'
             AND outlet_id = ?
             AND YEAR(created_at) = YEAR(CURDATE())
             AND MONTH(created_at) = MONTH(CURDATE())`,
          [outlet.id]
        );

        const [[pendingStats]] = await poolWaschenPos.execute(
          `SELECT COUNT(*) as pending
           FROM tr_transaction
           WHERE deleted_at IS NULL
             AND status IN ('pending', 'process', 'ready_for_pickup', 'ready_for_delivery')
             AND outlet_id = ?`,
          [outlet.id]
        );

        const [[customerStats]] = await poolWaschenPos.execute(
          `SELECT COUNT(*) as total_customers
           FROM mst_customer
           WHERE is_active = 1 AND deleted_at IS NULL
             AND registered_outlet_id = ?`,
          [outlet.id]
        );

        return {
          id: outlet.id,
          name: outlet.name,
          address: outlet.address,
          phone: outlet.phone,
          stats: {
            today: {
              omset: Number(todayStats?.omset_today || 0),
              transaksi: Number(todayStats?.transaksi_today || 0),
              selesai: Number(todayStats?.selesai_today || 0),
            },
            month: {
              omset: Number(monthStats?.omset_month || 0),
              transaksi: Number(monthStats?.transaksi_month || 0),
            },
            pending: Number(pendingStats?.pending || 0),
            customers: Number(customerStats?.total_customers || 0),
          },
        };
      })
    );

    // Sort by today's revenue descending
    outletStats.sort((a, b) => b.stats.today.omset - a.stats.today.omset);

    // Add ranking
    const rankedOutlets = outletStats.map((outlet, index) => ({
      ...outlet,
      rank: index + 1,
    }));

    // Calculate totals
    const totals = {
      omsetToday: rankedOutlets.reduce((sum, o) => sum + o.stats.today.omset, 0),
      omsetMonth: rankedOutlets.reduce((sum, o) => sum + o.stats.month.omset, 0),
      transaksiToday: rankedOutlets.reduce((sum, o) => sum + o.stats.today.transaksi, 0),
      pending: rankedOutlets.reduce((sum, o) => sum + o.stats.pending, 0),
    };

    return res.status(200).json({
      success: true,
      data: {
        outlets: rankedOutlets,
        totals,
        count: rankedOutlets.length,
      },
    });
  } catch (err) {
    logger.error('Get outlet dashboard failed', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat data outlet.' });
  }
};
