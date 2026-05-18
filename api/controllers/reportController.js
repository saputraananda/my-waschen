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

    const [[currentAgg], [prevAgg], [dailyRows], [hourlyRows], [methodRows]] = await Promise.all([
      poolWaschenPos.execute(
        `SELECT COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount
         FROM tr_transaction t WHERE ${base} ${outlet.where}`, baseParams),
      poolWaschenPos.execute(
        `SELECT COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount
         FROM tr_transaction t WHERE ${base} ${outlet.where}`, prevParams),
      poolWaschenPos.execute(
        `SELECT DATE(t.created_at) AS date, COALESCE(SUM(t.total),0) AS revenue, COUNT(t.id) AS txCount
         FROM tr_transaction t WHERE ${base} ${outlet.where}
         GROUP BY DATE(t.created_at) ORDER BY date`, baseParams),
      poolWaschenPos.execute(
        `SELECT HOUR(t.created_at) AS hour, COUNT(t.id) AS txCount, COALESCE(SUM(t.total),0) AS revenue
         FROM tr_transaction t WHERE ${base} ${outlet.where}
         GROUP BY HOUR(t.created_at) ORDER BY hour`, baseParams),
      poolWaschenPos.execute(
        `SELECT t.primary_payment_method AS method, COALESCE(SUM(t.total),0) AS amount, COUNT(t.id) AS cnt
         FROM tr_transaction t WHERE ${base} ${outlet.where}
         GROUP BY t.primary_payment_method ORDER BY amount DESC`, baseParams),
    ]);

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
