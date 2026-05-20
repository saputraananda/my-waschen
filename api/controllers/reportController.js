import { poolWaschenPos } from '../db/connection.js';

const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];

function buildOutletFilter(req, alias = 't') {
  const userRole = req.user?.roleCode;
  const isGlobal = globalRoles.includes(userRole);
  const qOutlet = req.query?.outletId;
  const uOutlet = req.user?.outletId;

  if (isGlobal && qOutlet) return { where: `AND ${alias}.outlet_id = ?`, params: [qOutlet] };
  if (!isGlobal && uOutlet) return { where: `AND ${alias}.outlet_id = ?`, params: [uOutlet] };
  return { where: '', params: [] };
}

function parseDates(query) {
  const end = query.endDate || new Date().toISOString().slice(0, 10);
  const start = query.startDate || (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();
  const days = Math.max(1, Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1);
  const prevEnd = new Date(`${start}T00:00:00`); prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1));
  return {
    startDate: start, endDate: end, days,
    prevStart: prevStart.toISOString().slice(0, 10),
    prevEnd: prevEnd.toISOString().slice(0, 10),
  };
}

// ─── GET /api/reports/executive-summary ─────────────────────────────────────
export const getExecutiveSummary = async (req, res) => {
  try {
    const { startDate, endDate, days, prevStart, prevEnd } = parseDates(req.query);
    const outlet = buildOutletFilter(req);
    const base = `t.status <> 'cancelled' AND t.deleted_at IS NULL AND DATE(t.created_at) BETWEEN ? AND ?`;
    const baseParams = [startDate, endDate, ...outlet.params];
    const prevParams = [prevStart, prevEnd, ...outlet.params];

    // Jalankan sequential untuk menghindari ECONNRESET ke DB remote
    const [currentAgg] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount
       FROM tr_transaction t WHERE ${base} ${outlet.where}`, baseParams);

    const [prevAgg] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount
       FROM tr_transaction t WHERE ${base} ${outlet.where}`, prevParams);

    const [dailyRows] = await poolWaschenPos.execute(
      `SELECT DATE(t.created_at) AS date, COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount
       FROM tr_transaction t WHERE ${base} ${outlet.where}
       GROUP BY DATE(t.created_at) ORDER BY date`, baseParams);

    const [hourlyRows] = await poolWaschenPos.execute(
      `SELECT HOUR(t.created_at) AS hour, COUNT(t.id) AS txCount, COALESCE(SUM(t.total),0) AS revenue
       FROM tr_transaction t WHERE ${base} ${outlet.where}
       GROUP BY HOUR(t.created_at) ORDER BY hour`, baseParams);

    const [methodRows] = await poolWaschenPos.execute(
      `SELECT t.primary_payment_method AS method, COALESCE(SUM(t.total),0) AS amount, COUNT(t.id) AS cnt
       FROM tr_transaction t WHERE ${base} ${outlet.where}
       GROUP BY t.primary_payment_method ORDER BY amount DESC`, baseParams);

    const cur = currentAgg[0] || {};
    const prev = prevAgg[0] || {};
    const revenue = Number(cur.revenue || 0);
    const txCount = Number(cur.txCount || 0);
    const prevRevenue = Number(prev.revenue || 0);
    const prevTxCount = Number(prev.txCount || 0);
    const totalMethods = methodRows.reduce((s, r) => s + Number(r.amount || 0), 0) || 1;

    return res.json({
      success: true, data: {
        revenue, txCount,
        avgPerTx: txCount > 0 ? Math.round(revenue / txCount) : 0,
        avgPerDay: days > 0 ? Math.round(revenue / days) : 0,
        prevRevenue, prevTxCount,
        revenueGrowth: prevRevenue > 0 ? Number((((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1)) : (revenue > 0 ? 100 : 0),
        txGrowth: prevTxCount > 0 ? Number((((txCount - prevTxCount) / prevTxCount) * 100).toFixed(1)) : (txCount > 0 ? 100 : 0),
        daily: dailyRows.map(r => ({ date: r.date, revenue: Number(r.revenue), txCount: Number(r.txCount) })),
        peakHours: Array.from({ length: 24 }, (_, h) => {
          const row = hourlyRows.find(r => Number(r.hour) === h);
          return { hour: h, txCount: row ? Number(row.txCount) : 0, revenue: row ? Number(row.revenue) : 0 };
        }),
        paymentMix: methodRows.map(r => ({
          method: r.method || 'unknown', amount: Number(r.amount), count: Number(r.cnt),
          pct: Number(((Number(r.amount) / totalMethods) * 100).toFixed(1)),
        })),
        period: { startDate, endDate, days },
      },
    });
  } catch (err) {
    console.error('[getExecutiveSummary]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat executive summary.' });
  }
};

// ─── GET /api/reports/outlet-performance ────────────────────────────────────
export const getOutletPerformance = async (req, res) => {
  try {
    const { startDate, endDate, days, prevStart, prevEnd } = parseDates(req.query);
    const base = `t.status <> 'cancelled' AND t.deleted_at IS NULL`;

    const [curRows] = await poolWaschenPos.execute(
      `SELECT o.id AS outletId, o.name AS outletName,
        COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount,
        COUNT(DISTINCT t.customer_id) AS uniqueCustomers,
        SUM(CASE WHEN t.is_express = 1 THEN 1 ELSE 0 END) AS expressCount,
        SUM(CASE WHEN t.is_express = 0 OR t.is_express IS NULL THEN 1 ELSE 0 END) AS regularCount
       FROM mst_outlet o
       LEFT JOIN tr_transaction t ON t.outlet_id = o.id AND ${base} AND DATE(t.created_at) BETWEEN ? AND ?
       WHERE o.is_active = 1
       GROUP BY o.id, o.name ORDER BY revenue DESC`,
      [startDate, endDate]
    );

    const [prevRows] = await poolWaschenPos.execute(
      `SELECT t.outlet_id AS outletId, COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount
       FROM tr_transaction t WHERE ${base} AND DATE(t.created_at) BETWEEN ? AND ?
       GROUP BY t.outlet_id`,
      [prevStart, prevEnd]
    );

    const [shiftRows] = await poolWaschenPos.execute(
      `SELECT s.outlet_id AS outletId,
        AVG(ABS(COALESCE(s.cash_diff,0))) AS avgCashDiff, COUNT(s.id) AS shiftCount
       FROM tr_cashier_session s
       WHERE s.status = 'closed' AND DATE(s.session_date) BETWEEN ? AND ?
       GROUP BY s.outlet_id`,
      [startDate, endDate]
    );

    const prevMap = Object.fromEntries(prevRows.map(r => [r.outletId, r]));
    const shiftMap = Object.fromEntries(shiftRows.map(r => [r.outletId, r]));

    const outlets = curRows.map(r => {
      const p = prevMap[r.outletId] || {};
      const s = shiftMap[r.outletId] || {};
      const rev = Number(r.revenue); const pRev = Number(p.revenue || 0);
      return {
        outletId: r.outletId, outletName: r.outletName,
        revenue: rev, txCount: Number(r.txCount),
        avgPerTx: Number(r.txCount) > 0 ? Math.round(rev / Number(r.txCount)) : 0,
        uniqueCustomers: Number(r.uniqueCustomers),
        expressCount: Number(r.expressCount), regularCount: Number(r.regularCount),
        avgCashDiff: s.avgCashDiff != null ? Math.round(Number(s.avgCashDiff)) : null,
        shiftCount: Number(s.shiftCount || 0),
        growth: pRev > 0 ? Number((((rev - pRev) / pRev) * 100).toFixed(1)) : (rev > 0 ? 100 : 0),
      };
    });

    return res.json({ success: true, data: { outlets, period: { startDate, endDate, days } } });
  } catch (err) {
    console.error('[getOutletPerformance]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat outlet performance.' });
  }
};

// ─── GET /api/reports/service-analytics ─────────────────────────────────────
export const getServiceAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = parseDates(req.query);
    const outlet = buildOutletFilter(req);
    const base = `t.status <> 'cancelled' AND t.deleted_at IS NULL AND DATE(t.created_at) BETWEEN ? AND ?`;
    const params = [startDate, endDate, ...outlet.params];

    const [serviceRows] = await poolWaschenPos.execute(
      `SELECT ti.service_name_snapshot AS name, COUNT(ti.id) AS orderCount,
        COALESCE(SUM(ti.subtotal),0) AS revenue
       FROM tr_transaction_item ti
       JOIN tr_transaction t ON t.id = ti.transaction_id
       WHERE ${base} ${outlet.where}
       GROUP BY ti.service_name_snapshot ORDER BY revenue DESC LIMIT 15`, params);

    let categoryRows = [];
    try {
      const [catRes] = await poolWaschenPos.execute(
        `SELECT COALESCE(c.name, 'Lainnya') AS category, COUNT(ti.id) AS orderCount,
          COALESCE(SUM(ti.subtotal),0) AS revenue
         FROM tr_transaction_item ti
         JOIN tr_transaction t ON t.id = ti.transaction_id
         LEFT JOIN mst_service s ON s.id = ti.service_id
         LEFT JOIN mst_service_category c ON c.id = s.category_id
         WHERE ${base} ${outlet.where}
         GROUP BY c.name ORDER BY revenue DESC`, params);
      categoryRows = catRes;
    } catch { /* category join may fail if schema not aligned */ }

    const [expressRow] = await poolWaschenPos.execute(
      `SELECT
        SUM(CASE WHEN t.is_express = 1 THEN 1 ELSE 0 END) AS expressCount,
        SUM(CASE WHEN t.is_express = 1 THEN t.total ELSE 0 END) AS expressRevenue,
        SUM(CASE WHEN t.is_express = 0 OR t.is_express IS NULL THEN 1 ELSE 0 END) AS regularCount,
        SUM(CASE WHEN t.is_express = 0 OR t.is_express IS NULL THEN t.total ELSE 0 END) AS regularRevenue
       FROM tr_transaction t WHERE ${base} ${outlet.where}`, params);

    const totalServiceRevenue = serviceRows.reduce((s, r) => s + Number(r.revenue || 0), 0) || 1;
    const ex = expressRow[0] || {};

    return res.json({
      success: true, data: {
        topServices: serviceRows.map(r => ({
          name: r.name, orderCount: Number(r.orderCount), revenue: Number(r.revenue),
          pct: Number(((Number(r.revenue) / totalServiceRevenue) * 100).toFixed(1)),
        })),
        categories: categoryRows.map(r => ({ category: r.category, orderCount: Number(r.orderCount), revenue: Number(r.revenue) })),
        expressVsRegular: {
          express: { count: Number(ex.expressCount || 0), revenue: Number(ex.expressRevenue || 0) },
          regular: { count: Number(ex.regularCount || 0), revenue: Number(ex.regularRevenue || 0) },
        },
      },
    });
  } catch (err) {
    console.error('[getServiceAnalytics]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat service analytics.' });
  }
};

// ─── GET /api/reports/cashier-performance ────────────────────────────────────
export const getCashierPerformance = async (req, res) => {
  try {
    const { startDate, endDate } = parseDates(req.query);
    const outlet = buildOutletFilter(req);
    const base = `t.status <> 'cancelled' AND t.deleted_at IS NULL AND DATE(t.created_at) BETWEEN ? AND ?`;
    const params = [startDate, endDate, ...outlet.params];

    const [txRows] = await poolWaschenPos.execute(
      `SELECT t.cashier_id AS cashierId, u.name AS cashierName, o.name AS outletName,
        COUNT(t.id) AS txCount, COALESCE(SUM(t.total),0) AS revenue
       FROM tr_transaction t
       LEFT JOIN mst_user u ON u.id = t.cashier_id
       LEFT JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE ${base} ${outlet.where}
       GROUP BY t.cashier_id, u.name, o.name ORDER BY revenue DESC`, params);

    const [shiftRows] = await poolWaschenPos.execute(
      `SELECT s.cashier_id AS cashierId,
        COUNT(s.id) AS shiftCount,
        AVG(ABS(COALESCE(s.cash_diff,0))) AS avgCashDiff
       FROM tr_cashier_session s
       WHERE s.status = 'closed' AND DATE(s.session_date) BETWEEN ? AND ?
       GROUP BY s.cashier_id`,
      [startDate, endDate]
    );

    const shiftMap = Object.fromEntries(shiftRows.map(r => [r.cashierId, r]));

    return res.json({
      success: true, data: {
        cashiers: txRows.map(r => {
          const s = shiftMap[r.cashierId] || {};
          return {
            cashierId: r.cashierId, name: r.cashierName || '—', outlet: r.outletName || '—',
            txCount: Number(r.txCount), revenue: Number(r.revenue),
            shiftCount: Number(s.shiftCount || 0),
            avgCashDiff: s.avgCashDiff != null ? Math.round(Number(s.avgCashDiff)) : null,
          };
        }),
      },
    });
  } catch (err) {
    console.error('[getCashierPerformance]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat cashier performance.' });
  }
};

// ─── GET /api/reports/customer-insights ──────────────────────────────────────
export const getCustomerInsights = async (req, res) => {
  try {
    const { startDate, endDate } = parseDates(req.query);
    const outlet = buildOutletFilter(req);
    const base = `t.status <> 'cancelled' AND t.deleted_at IS NULL AND DATE(t.created_at) BETWEEN ? AND ?`;
    const params = [startDate, endDate, ...outlet.params];

    const [newCustRow] = await poolWaschenPos.execute(
      `SELECT COUNT(*) AS cnt FROM mst_customer WHERE is_active = 1 AND DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const [returningRow] = await poolWaschenPos.execute(
      `SELECT COUNT(DISTINCT t.customer_id) AS cnt
       FROM tr_transaction t
       WHERE ${base} ${outlet.where}
         AND t.customer_id IN (
           SELECT t2.customer_id FROM tr_transaction t2
           WHERE t2.status <> 'cancelled' AND t2.deleted_at IS NULL AND DATE(t2.created_at) < ?
         )`, [...params, startDate]
    );

    const [topCustomers] = await poolWaschenPos.execute(
      `SELECT c.name, COUNT(t.id) AS txCount, COALESCE(SUM(t.total),0) AS totalSpend,
        c.is_member AS isMember
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       WHERE ${base} ${outlet.where}
       GROUP BY t.customer_id, c.name, c.is_member ORDER BY totalSpend DESC LIMIT 10`, params);

    const [memberRow] = await poolWaschenPos.execute(
      `SELECT
        SUM(CASE WHEN c.is_member = 1 THEN 1 ELSE 0 END) AS memberTx,
        SUM(CASE WHEN c.is_member = 1 THEN t.total ELSE 0 END) AS memberRevenue,
        SUM(CASE WHEN c.is_member = 0 OR c.is_member IS NULL THEN 1 ELSE 0 END) AS nonMemberTx,
        SUM(CASE WHEN c.is_member = 0 OR c.is_member IS NULL THEN t.total ELSE 0 END) AS nonMemberRevenue
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON c.id = t.customer_id
       WHERE ${base} ${outlet.where}`, params);

    let awarenessRows = [];
    try {
      const [awRes] = await poolWaschenPos.execute(
        `SELECT COALESCE(a.name, 'Tidak diketahui') AS source, COUNT(DISTINCT c.id) AS cnt
         FROM mst_customer c
         LEFT JOIN mst_awareness_source a ON a.id = c.awareness_source_id
         WHERE c.is_active = 1 AND DATE(c.created_at) BETWEEN ? AND ?
         GROUP BY a.name ORDER BY cnt DESC`,
        [startDate, endDate]
      );
      awarenessRows = awRes;
    } catch { /* awareness table may not exist */ }

    const m = memberRow[0] || {};

    return res.json({
      success: true, data: {
        newCustomers: Number(newCustRow[0]?.cnt || 0),
        returningCustomers: Number(returningRow[0]?.cnt || 0),
        topCustomers: topCustomers.map(r => ({
          name: r.name, txCount: Number(r.txCount), totalSpend: Number(r.totalSpend), isMember: !!r.isMember,
        })),
        memberVsNon: {
          member: { txCount: Number(m.memberTx || 0), revenue: Number(m.memberRevenue || 0) },
          nonMember: { txCount: Number(m.nonMemberTx || 0), revenue: Number(m.nonMemberRevenue || 0) },
        },
        awarenessSources: awarenessRows.map(r => ({ source: r.source, count: Number(r.cnt) })),
      },
    });
  } catch (err) {
    console.error('[getCustomerInsights]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat customer insights.' });
  }
};

// ─── GET /api/reports/comparison ─────────────────────────────────────────────
// Bandingkan 2 periode side-by-side: current vs previous (atau custom)
// Query params: startDate, endDate, compareStart, compareEnd, outletId
export const getComparisonReport = async (req, res) => {
  try {
    const outlet = buildOutletFilter(req);
    const { startDate, endDate, days } = parseDates(req.query);

    // Period B: custom atau auto-previous
    const periodBEnd = req.query.compareEnd || (() => {
      const d = new Date(`${startDate}T00:00:00`);
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const periodBStart = req.query.compareStart || (() => {
      const d = new Date(`${periodBEnd}T00:00:00`);
      d.setDate(d.getDate() - (days - 1));
      return d.toISOString().slice(0, 10);
    })();

    const base = `t.status <> 'cancelled' AND t.deleted_at IS NULL AND DATE(t.created_at) BETWEEN ? AND ?`;

    // Fetch both periods in parallel (sequential to avoid ECONNRESET)
    const [currentAgg] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount,
              COALESCE(SUM(t.paid_amount),0) AS pelunasan,
              COUNT(DISTINCT t.customer_id) AS uniqueCustomers
       FROM tr_transaction t WHERE ${base} ${outlet.where}`,
      [startDate, endDate, ...outlet.params]
    );

    const [prevAgg] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount,
              COALESCE(SUM(t.paid_amount),0) AS pelunasan,
              COUNT(DISTINCT t.customer_id) AS uniqueCustomers
       FROM tr_transaction t WHERE ${base} ${outlet.where}`,
      [periodBStart, periodBEnd, ...outlet.params]
    );

    // Daily breakdown for both periods (normalized to day index 1..N)
    const [currentDaily] = await poolWaschenPos.execute(
      `SELECT DATE(t.created_at) AS date,
              COALESCE(SUM(t.total),0) AS revenue,
              COUNT(t.id) AS txCount
       FROM tr_transaction t WHERE ${base} ${outlet.where}
       GROUP BY DATE(t.created_at) ORDER BY date`,
      [startDate, endDate, ...outlet.params]
    );

    const [prevDaily] = await poolWaschenPos.execute(
      `SELECT DATE(t.created_at) AS date,
              COALESCE(SUM(t.total),0) AS revenue,
              COUNT(t.id) AS txCount
       FROM tr_transaction t WHERE ${base} ${outlet.where}
       GROUP BY DATE(t.created_at) ORDER BY date`,
      [periodBStart, periodBEnd, ...outlet.params]
    );

    // Normalize to day index for overlay chart
    const normalizeDaily = (rows, startStr) => {
      const startMs = new Date(`${startStr}T00:00:00`).getTime();
      return rows.map(r => ({
        dayIndex: Math.round((new Date(r.date).getTime() - startMs) / 86400000) + 1,
        date: r.date,
        revenue: Number(r.revenue),
        txCount: Number(r.txCount),
      }));
    };

    const currentNorm = normalizeDaily(currentDaily, startDate);
    const prevNorm = normalizeDaily(prevDaily, periodBStart);

    // Merge into comparison array
    const maxDays = Math.max(currentNorm.length, prevNorm.length, days);
    const comparisonData = Array.from({ length: maxDays }, (_, i) => {
      const day = i + 1;
      const cur = currentNorm.find(d => d.dayIndex === day);
      const prev = prevNorm.find(d => d.dayIndex === day);
      return {
        day,
        current: cur?.revenue || 0,
        previous: prev?.revenue || 0,
        currentTx: cur?.txCount || 0,
        previousTx: prev?.txCount || 0,
      };
    });

    const cur = currentAgg[0] || {};
    const prev = prevAgg[0] || {};
    const pctChange = (c, p) => {
      const cv = Number(c || 0), pv = Number(p || 0);
      if (pv === 0 && cv === 0) return 0;
      if (pv === 0) return 100;
      return Number((((cv - pv) / pv) * 100).toFixed(1));
    };

    return res.json({
      success: true,
      data: {
        periodA: { start: startDate, end: endDate, days },
        periodB: { start: periodBStart, end: periodBEnd, days },
        current: {
          revenue: Number(cur.revenue || 0),
          txCount: Number(cur.txCount || 0),
          pelunasan: Number(cur.pelunasan || 0),
          uniqueCustomers: Number(cur.uniqueCustomers || 0),
          avgPerTx: Number(cur.txCount) > 0 ? Math.round(Number(cur.revenue) / Number(cur.txCount)) : 0,
        },
        previous: {
          revenue: Number(prev.revenue || 0),
          txCount: Number(prev.txCount || 0),
          pelunasan: Number(prev.pelunasan || 0),
          uniqueCustomers: Number(prev.uniqueCustomers || 0),
          avgPerTx: Number(prev.txCount) > 0 ? Math.round(Number(prev.revenue) / Number(prev.txCount)) : 0,
        },
        changes: {
          revenue: pctChange(cur.revenue, prev.revenue),
          txCount: pctChange(cur.txCount, prev.txCount),
          pelunasan: pctChange(cur.pelunasan, prev.pelunasan),
          uniqueCustomers: pctChange(cur.uniqueCustomers, prev.uniqueCustomers),
        },
        comparisonData,
      },
    });
  } catch (err) {
    console.error('[getComparisonReport]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat comparison report.' });
  }
};

// ─── GET /api/reports/cohort ──────────────────────────────────────────────────
// Customer cohort analysis: retention rate, repeat purchase, lifetime value
export const getCohortAnalysis = async (req, res) => {
  try {
    const outlet = buildOutletFilter(req);
    const { startDate, endDate } = parseDates(req.query);

    // 1. New customers per month (cohort groups)
    const [cohortGroups] = await poolWaschenPos.execute(
      `SELECT DATE_FORMAT(c.created_at, '%Y-%m') AS cohort_month,
              COUNT(DISTINCT c.id) AS new_customers
       FROM mst_customer c
       WHERE c.is_active = 1
         AND DATE(c.created_at) BETWEEN ? AND ?
       GROUP BY cohort_month
       ORDER BY cohort_month`,
      [startDate, endDate]
    );

    // 2. Retention: customers who transacted in month N after first transaction
    const [retentionData] = await poolWaschenPos.execute(
      `SELECT
         DATE_FORMAT(first_tx.first_date, '%Y-%m') AS cohort_month,
         TIMESTAMPDIFF(MONTH, first_tx.first_date, t.created_at) AS months_after,
         COUNT(DISTINCT t.customer_id) AS retained_customers
       FROM tr_transaction t
       JOIN (
         SELECT customer_id, MIN(created_at) AS first_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status <> 'cancelled'
         GROUP BY customer_id
       ) first_tx ON first_tx.customer_id = t.customer_id
       WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
         AND DATE(first_tx.first_date) BETWEEN ? AND ?
         ${outlet.where.replace('AND t.outlet_id', 'AND first_tx.customer_id IN (SELECT customer_id FROM tr_transaction WHERE outlet_id')}
       GROUP BY cohort_month, months_after
       ORDER BY cohort_month, months_after`,
      [startDate, endDate, ...outlet.params]
    );

    // 3. Repeat purchase rate
    const [repeatData] = await poolWaschenPos.execute(
      `SELECT
         COUNT(DISTINCT CASE WHEN tx_count > 1 THEN customer_id END) AS repeat_customers,
         COUNT(DISTINCT customer_id) AS total_customers,
         AVG(tx_count) AS avg_tx_per_customer,
         MAX(tx_count) AS max_tx_per_customer
       FROM (
         SELECT t.customer_id, COUNT(t.id) AS tx_count
         FROM tr_transaction t
         WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
           AND DATE(t.created_at) BETWEEN ? AND ?
           ${outlet.where}
         GROUP BY t.customer_id
       ) sub`,
      [startDate, endDate, ...outlet.params]
    );

    // 4. Customer Lifetime Value (CLV) — avg revenue per customer
    const [clvData] = await poolWaschenPos.execute(
      `SELECT
         AVG(customer_revenue) AS avg_clv,
         MAX(customer_revenue) AS max_clv,
         MIN(customer_revenue) AS min_clv,
         STDDEV(customer_revenue) AS stddev_clv
       FROM (
         SELECT t.customer_id, SUM(t.total) AS customer_revenue
         FROM tr_transaction t
         WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
           AND DATE(t.created_at) BETWEEN ? AND ?
           ${outlet.where}
         GROUP BY t.customer_id
       ) sub`,
      [startDate, endDate, ...outlet.params]
    );

    // 5. Top returning customers
    const [topReturning] = await poolWaschenPos.execute(
      `SELECT c.name, c.phone, c.is_member AS isMember,
              COUNT(t.id) AS txCount,
              SUM(t.total) AS totalSpend,
              MAX(t.created_at) AS lastVisit,
              MIN(t.created_at) AS firstVisit
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
         AND DATE(t.created_at) BETWEEN ? AND ?
         ${outlet.where}
       GROUP BY t.customer_id, c.name, c.phone, c.is_member
       HAVING txCount > 1
       ORDER BY txCount DESC, totalSpend DESC
       LIMIT 10`,
      [startDate, endDate, ...outlet.params]
    );

    const repeat = repeatData[0] || {};
    const clv = clvData[0] || {};
    const totalCust = Number(repeat.total_customers || 0);
    const repeatCust = Number(repeat.repeat_customers || 0);

    return res.json({
      success: true,
      data: {
        period: { start: startDate, end: endDate },
        summary: {
          totalCustomers: totalCust,
          repeatCustomers: repeatCust,
          repeatRate: totalCust > 0 ? Number(((repeatCust / totalCust) * 100).toFixed(1)) : 0,
          avgTxPerCustomer: Number(Number(repeat.avg_tx_per_customer || 0).toFixed(1)),
          avgCLV: Math.round(Number(clv.avg_clv || 0)),
          maxCLV: Math.round(Number(clv.max_clv || 0)),
        },
        cohortGroups: cohortGroups.map(r => ({
          cohortMonth: r.cohort_month,
          newCustomers: Number(r.new_customers),
        })),
        retentionData: retentionData.map(r => ({
          cohortMonth: r.cohort_month,
          monthsAfter: Number(r.months_after),
          retainedCustomers: Number(r.retained_customers),
        })),
        topReturning: topReturning.map(r => ({
          name: r.name,
          phone: r.phone,
          isMember: r.isMember === 1,
          txCount: Number(r.txCount),
          totalSpend: Number(r.totalSpend),
          lastVisit: r.lastVisit,
          firstVisit: r.firstVisit,
        })),
      },
    });
  } catch (err) {
    console.error('[getCohortAnalysis]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat cohort analysis.' });
  }
};

// ─── GET /api/reports/forecast ────────────────────────────────────────────────
// Simple revenue forecast menggunakan linear regression dari data historis
export const getForecast = async (req, res) => {
  try {
    const outlet = buildOutletFilter(req);
    const months = Math.min(12, Math.max(3, parseInt(req.query.months) || 6));
    const forecastMonths = Math.min(6, Math.max(1, parseInt(req.query.forecastMonths) || 3));

    // Ambil data historis N bulan terakhir
    const [historicalData] = await poolWaschenPos.execute(
      `SELECT
         DATE_FORMAT(t.created_at, '%Y-%m') AS month,
         COALESCE(SUM(t.total), 0) AS revenue,
         COUNT(t.id) AS txCount
       FROM tr_transaction t
       WHERE t.deleted_at IS NULL AND t.status <> 'cancelled'
         AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
         ${outlet.where}
       GROUP BY month
       ORDER BY month`,
      [months, ...outlet.params]
    );

    if (historicalData.length < 2) {
      return res.json({
        success: true,
        data: { historical: [], forecast: [], message: 'Data historis tidak cukup untuk forecast (minimal 2 bulan).' },
      });
    }

    // Linear regression: y = a + b*x
    const n = historicalData.length;
    const xs = historicalData.map((_, i) => i);
    const ys = historicalData.map(r => Number(r.revenue));

    const sumX = xs.reduce((s, x) => s + x, 0);
    const sumY = ys.reduce((s, y) => s + y, 0);
    const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
    const sumX2 = xs.reduce((s, x) => s + x * x, 0);

    const b = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const a = (sumY - b * sumX) / n;

    // R² untuk confidence
    const yMean = sumY / n;
    const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const ssRes = ys.reduce((s, y, i) => s + (y - (a + b * xs[i])) ** 2, 0);
    const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    // Generate forecast
    const lastMonth = historicalData[historicalData.length - 1].month;
    const [lastY, lastM] = lastMonth.split('-').map(Number);

    const forecast = Array.from({ length: forecastMonths }, (_, i) => {
      const xIdx = n + i;
      const predicted = Math.max(0, Math.round(a + b * xIdx));
      const m = ((lastM + i) % 12) || 12;
      const y = lastY + Math.floor((lastM + i - 1) / 12);
      const month = `${y}-${String(m).padStart(2, '0')}`;

      // Confidence interval (±1 std error)
      const stdErr = Math.sqrt(ssRes / Math.max(1, n - 2));
      const margin = Math.round(stdErr * 1.5);

      return {
        month,
        predicted,
        low: Math.max(0, predicted - margin),
        high: predicted + margin,
        isForecast: true,
      };
    });

    // Trend direction
    const trendPct = ys[0] > 0 ? ((ys[n - 1] - ys[0]) / ys[0]) * 100 : 0;
    const trend = b > 0 ? 'naik' : b < 0 ? 'turun' : 'stabil';

    return res.json({
      success: true,
      data: {
        historical: historicalData.map((r, i) => ({
          month: r.month,
          revenue: Number(r.revenue),
          txCount: Number(r.txCount),
          trend: Math.round(a + b * i),
          isForecast: false,
        })),
        forecast,
        model: {
          r2: Number(r2.toFixed(3)),
          confidence: r2 >= 0.8 ? 'tinggi' : r2 >= 0.5 ? 'sedang' : 'rendah',
          trend,
          trendPct: Number(trendPct.toFixed(1)),
          slope: Number(b.toFixed(0)),
          intercept: Number(a.toFixed(0)),
        },
      },
    });
  } catch (err) {
    console.error('[getForecast]', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat forecast.' });
  }
};
