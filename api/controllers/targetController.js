import { poolWaschenPos } from '../db/connection.js';
import logger from '../utils/logger.js';

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Transaksi yang dianggap "selesai" untuk perhitungan capaian
// Gunakan status DB yang sebenarnya (bukan label frontend)
const DONE_STATUSES = `('completed', 'ready_for_pickup', 'ready_for_delivery')`;

// ── GET /api/targets — list semua target (admin) ──────────────────────────────
export const listTargets = async (req, res) => {
  try {
    const filterYear  = Number(req.query.year)     || new Date().getFullYear();
    const filterMonth = Number(req.query.month)    || null;
    const filterOutlet = req.query.outletId        || null;

    const params = [filterYear];
    let monthFilter  = '';
    let outletFilter = '';

    if (filterMonth) { monthFilter  = 'AND t.period_month = ?'; params.push(filterMonth); }
    if (filterOutlet) { outletFilter = 'AND t.outlet_id = ?';   params.push(filterOutlet); }

    const [rows] = await poolWaschenPos.execute(
      `SELECT
         t.id, t.outlet_id AS outletId, o.name AS outletName,
         t.period_year AS year, t.period_month AS month,
         t.target_amount AS targetAmount, t.notes,
         COALESCE((
           SELECT SUM(tr.total)
           FROM tr_transaction tr
           WHERE tr.outlet_id = t.outlet_id
             AND tr.status IN ${DONE_STATUSES}
             AND tr.deleted_at IS NULL
             AND YEAR(tr.created_at)  = t.period_year
             AND MONTH(tr.created_at) = t.period_month
         ), 0) AS actualAmount
       FROM mst_outlet_target t
       JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE t.deleted_at IS NULL AND t.period_year = ? ${monthFilter} ${outletFilter}
       ORDER BY t.period_month ASC, o.name ASC`,
      params
    );

    const data = rows.map(r => ({
      ...r,
      targetAmount: Number(r.targetAmount),
      actualAmount: Number(r.actualAmount),
      pct: Number(r.targetAmount) > 0
        ? Math.round((Number(r.actualAmount) / Number(r.targetAmount)) * 100)
        : 0,
      monthName: MONTH_NAMES[r.month] || '',
    }));

    return res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, data: [], _note: 'Tabel target belum dibuat. Jalankan migration_target_period_tables.sql' });
    }
    logger.error('Gagal memuat data target', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data target.' });
  }
};

// ── GET /api/targets/progress — capaian target outlet user (kasir/frontliner) ──
export const getTargetProgress = async (req, res) => {
  try {
    const outletId = req.user?.outletId;
    if (!outletId) return res.json({ success: true, data: null });

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;

    const [rows] = await poolWaschenPos.execute(
      `SELECT
         t.id, t.target_amount AS targetAmount, t.notes,
         COALESCE((
           SELECT SUM(tr.total)
           FROM tr_transaction tr
           WHERE tr.outlet_id = ?
             AND tr.status IN ${DONE_STATUSES}
             AND tr.deleted_at IS NULL
             AND YEAR(tr.created_at)  = ?
             AND MONTH(tr.created_at) = ?
         ), 0) AS actualAmount
       FROM mst_outlet_target t
       WHERE t.deleted_at IS NULL AND t.outlet_id = ? AND t.period_year = ? AND t.period_month = ?
       LIMIT 1`,
      [outletId, year, month, outletId, year, month]
    );

    if (!rows.length) return res.json({ success: true, data: null });

    const { targetAmount, actualAmount, notes } = rows[0];
    const target = Number(targetAmount);
    const actual = Number(actualAmount);
    const pct    = target > 0 ? Math.round((actual / target) * 100) : 0;

    return res.json({
      success: true,
      data: { targetAmount: target, actualAmount: actual, pct, notes, year, month, monthName: MONTH_NAMES[month] },
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, data: null });
    }
    logger.error('Gagal memuat capaian target', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat capaian target.' });
  }
};

// ── POST /api/targets — buat / update (upsert) target ────────────────────────
export const upsertTarget = async (req, res) => {
  try {
    const { outletId, year, month, targetAmount, notes } = req.body;
    if (!outletId || !year || !month || targetAmount == null) {
      return res.status(400).json({ success: false, message: 'outletId, year, month, targetAmount wajib diisi.' });
    }

    // id AUTO_INCREMENT — biarkan DB yang generate (ON DUPLICATE KEY UPDATE tetap bekerja)
    // Re-create otomatis kalau record sudah pernah soft-deleted (deleted_at di-reset)
    try {
      await poolWaschenPos.execute(
        `INSERT INTO mst_outlet_target
           (outlet_id, period_year, period_month, target_amount, notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           target_amount = VALUES(target_amount),
           notes         = VALUES(notes),
           deleted_at    = NULL,
           deleted_by    = NULL,
           updated_at    = NOW()`,
        [outletId, Number(year), Number(month), Number(targetAmount), notes || null, req.user?.userId]
      );
    } catch (colErr) {
      // Fallback jika kolom created_by / deleted_by belum ada
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        await poolWaschenPos.execute(
          `INSERT INTO mst_outlet_target
             (outlet_id, period_year, period_month, target_amount, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             target_amount = VALUES(target_amount),
             notes         = VALUES(notes),
             deleted_at    = NULL,
             updated_at    = NOW()`,
          [outletId, Number(year), Number(month), Number(targetAmount), notes || null]
        );
      } else {
        throw colErr;
      }
    }

    return res.json({ success: true, message: 'Target berhasil disimpan.' });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ success: false, message: 'Tabel target belum tersedia. Jalankan migration_target_period_tables.sql terlebih dahulu.' });
    }
    logger.error('Gagal menyimpan target', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menyimpan target.' });
  }
};

// ── DELETE /api/targets/:id — soft delete target ──────────────────────────────
export const deleteTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBy = req.user?.userId || null;

    let result;
    try {
      [result] = await poolWaschenPos.execute(
        `UPDATE mst_outlet_target
            SET deleted_at = NOW(), deleted_by = ?, updated_at = NOW()
          WHERE id = ? AND deleted_at IS NULL`,
        [deletedBy, id]
      );
    } catch (colErr) {
      // Fallback jika kolom deleted_by atau updated_at belum ada
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        [result] = await poolWaschenPos.execute(
          `UPDATE mst_outlet_target SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
          [id]
        );
      } else {
        throw colErr;
      }
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Target tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Target dihapus.' });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(404).json({ success: false, message: 'Target tidak ditemukan.' });
    }
    logger.error('Gagal menghapus target', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menghapus target.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/targets/daily-progress?outletId=&year=&month=
// ─────────────────────────────────────────────────────────────────────────────
// Pecah target bulanan jadi target harian (target_amount / hari kerja bulan).
// Return per-day breakdown: target, actual, selisih, status.
//
// Logic:
//   - Default: target dibagi rata ke jumlah hari di bulan itu
//   - Tiap hari: query SUM(total) dari tr_transaction
//   - Selisih = actual - target_harian (positif = surplus, negatif = kurang)
//   - Status: aman (≥100% target), kurang (<100% & masih > 0), nihil (0)
// ─────────────────────────────────────────────────────────────────────────────
export const getDailyProgress = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobal = userRole !== 'admin';

    const targetOutletId = isGlobal && req.query.outletId
      ? Number(req.query.outletId)
      : userOutletId;

    if (!targetOutletId) {
      return res.status(400).json({ success: false, message: 'outletId wajib.' });
    }

    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);

    // 1. Ambil target bulanan
    const [targetRows] = await poolWaschenPos.execute(
      `SELECT id, target_amount AS targetAmount, notes
         FROM mst_outlet_target
        WHERE deleted_at IS NULL AND outlet_id = ? AND period_year = ? AND period_month = ?
        LIMIT 1`,
      [targetOutletId, year, month]
    );

    const monthlyTarget = targetRows.length ? Number(targetRows[0].targetAmount) : 0;

    // 2. Hitung jumlah hari di bulan itu
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyTarget = monthlyTarget / daysInMonth;

    // 3. Ambil semua transaksi yang dianggap "selesai" di bulan ini, group by tanggal
    const [actualRows] = await poolWaschenPos.execute(
      `SELECT DAY(created_at) AS day,
              COUNT(*) AS txCount,
              COALESCE(SUM(total), 0) AS dailyActual
         FROM tr_transaction
        WHERE outlet_id = ?
          AND status IN ${DONE_STATUSES}
          AND deleted_at IS NULL
          AND YEAR(created_at) = ?
          AND MONTH(created_at) = ?
        GROUP BY DAY(created_at)
        ORDER BY day`,
      [targetOutletId, year, month]
    );

    const actualByDay = new Map();
    actualRows.forEach(r => {
      actualByDay.set(Number(r.day), {
        actual: Number(r.dailyActual),
        txCount: Number(r.txCount),
      });
    });

    // 4. Build daily breakdown (semua hari di bulan, even kalau tidak ada transaksi)
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const todayDay = isCurrentMonth ? today.getDate() : daysInMonth;

    const days = [];
    let cumulativeActual = 0;
    let cumulativeTarget = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const actualData = actualByDay.get(d) || { actual: 0, txCount: 0 };
      const isPast = d < todayDay || !isCurrentMonth;
      const isToday = d === todayDay && isCurrentMonth;
      const isFuture = !isPast && !isToday;

      cumulativeActual += actualData.actual;
      cumulativeTarget += dailyTarget;

      // Status hari:
      //   safe: actual >= dailyTarget
      //   warning: actual antara 50-99% dailyTarget
      //   missed: actual < 50% (& bukan future)
      //   pending: future (belum lewat)
      let status;
      if (isFuture) status = 'pending';
      else if (dailyTarget === 0) status = 'no_target';
      else if (actualData.actual >= dailyTarget) status = 'safe';
      else if (actualData.actual >= dailyTarget * 0.5) status = 'warning';
      else if (actualData.actual > 0) status = 'missed';
      else status = 'zero';

      days.push({
        day: d,
        date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        target: Math.round(dailyTarget),
        actual: actualData.actual,
        txCount: actualData.txCount,
        diff: actualData.actual - dailyTarget,
        diffPct: dailyTarget > 0 ? Math.round(((actualData.actual - dailyTarget) / dailyTarget) * 100) : 0,
        status,
        isPast,
        isToday,
        isFuture,
      });
    }

    // 5. Summary bulanan
    const cumActualPast = days.filter(d => d.isPast || d.isToday).reduce((s, d) => s + d.actual, 0);
    const cumTargetPast = days.filter(d => d.isPast || d.isToday).reduce((s, d) => s + d.target, 0);
    const totalActual = days.reduce((s, d) => s + d.actual, 0);
    const remaining = Math.max(0, monthlyTarget - totalActual);
    const daysLeft = days.filter(d => d.isFuture).length + (isCurrentMonth ? 1 : 0); // include today if running
    const requiredDailyForRest = daysLeft > 0 ? remaining / daysLeft : 0;

    return res.json({
      success: true,
      data: {
        outletId: targetOutletId,
        year,
        month,
        monthName: MONTH_NAMES[month] || '',
        daysInMonth,
        monthlyTarget,
        dailyTarget: Math.round(dailyTarget),
        days,
        summary: {
          totalActual,
          totalTxCount: days.reduce((s, d) => s + d.txCount, 0),
          progressPct: monthlyTarget > 0 ? Math.round((totalActual / monthlyTarget) * 100) : 0,
          remaining,
          daysLeft,
          requiredDailyForRest: Math.round(requiredDailyForRest),
          // Cumulative gap (sampai hari ini): apakah sebenarnya tercapai akumulasi?
          cumActualPast,
          cumTargetPast,
          cumulativeGap: cumActualPast - cumTargetPast,
          isOnTrack: cumActualPast >= cumTargetPast,
          // Breakdown status:
          safeDays: days.filter(d => d.status === 'safe').length,
          warningDays: days.filter(d => d.status === 'warning').length,
          missedDays: days.filter(d => d.status === 'missed').length,
          zeroDays: days.filter(d => d.status === 'zero').length,
        },
        notes: targetRows[0]?.notes || null,
      },
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ success: true, data: null });
    }
    logger.error('Gagal memuat progress harian', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat progress harian.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/targets/today-summary — capaian hari ini untuk widget dashboard
// ─────────────────────────────────────────────────────────────────────────────
// Dipakai widget kasir di dashboard. Bahasa awam supaya tidak perlu lihat raw data.
// Output: target hari ini, sudah masuk berapa, kurang berapa, motivational message.
// ─────────────────────────────────────────────────────────────────────────────
export const getTodaySummary = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    if (!userOutletId) {
      return res.json({ success: true, data: null });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // 1. Ambil target bulanan
    const [targetRows] = await poolWaschenPos.execute(
      `SELECT target_amount AS targetAmount FROM mst_outlet_target
        WHERE deleted_at IS NULL AND outlet_id = ? AND period_year = ? AND period_month = ? LIMIT 1`,
      [userOutletId, year, month]
    );

    if (!targetRows.length || Number(targetRows[0].targetAmount) <= 0) {
      return res.json({ success: true, data: null }); // Belum ada target
    }

    const monthlyTarget = Number(targetRows[0].targetAmount);
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyTarget = Math.round(monthlyTarget / daysInMonth);

    // 2. Actual hari ini
    const [todayRows] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(total), 0) AS actual,
              COUNT(*) AS txCount
         FROM tr_transaction
        WHERE outlet_id = ?
          AND status IN ${DONE_STATUSES}
          AND deleted_at IS NULL
          AND DATE(created_at) = CURDATE()`,
      [userOutletId]
    );
    const todayActual = Number(todayRows[0]?.actual || 0);
    const todayTxCount = Number(todayRows[0]?.txCount || 0);

    // 3. Actual bulan ini sampai hari ini (akumulasi)
    const [monthRows] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(total), 0) AS actual
         FROM tr_transaction
        WHERE outlet_id = ?
          AND status IN ${DONE_STATUSES}
          AND deleted_at IS NULL
          AND YEAR(created_at) = ?
          AND MONTH(created_at) = ?`,
      [userOutletId, year, month]
    );
    const monthActual = Number(monthRows[0]?.actual || 0);

    // 4. Target kumulatif sampai hari ini (berapa seharusnya sudah masuk)
    const cumulativeTargetToToday = dailyTarget * day;
    const cumulativeGap = monthActual - cumulativeTargetToToday;

    // 5. Build motivational message
    const todayDiff = todayActual - dailyTarget;
    const todayPct = dailyTarget > 0 ? Math.round((todayActual / dailyTarget) * 100) : 0;

    let mood, message;
    if (todayActual >= dailyTarget) {
      mood = 'great';
      message = `🎉 Target hari ini tercapai! Surplus ${formatRp(todayDiff)}.`;
    } else if (todayPct >= 80) {
      mood = 'good';
      message = `💪 Hampir tercapai! Kurang ${formatRp(dailyTarget - todayActual)} lagi.`;
    } else if (todayPct >= 50) {
      mood = 'warning';
      message = `⚠️ Setengah jalan. Masih butuh ${formatRp(dailyTarget - todayActual)} hari ini.`;
    } else if (todayActual > 0) {
      mood = 'low';
      message = `📉 Pelan-pelan, butuh dorongan ${formatRp(dailyTarget - todayActual)} lagi.`;
    } else {
      mood = 'zero';
      message = `🔥 Belum ada transaksi hari ini. Yuk semangat!`;
    }

    return res.json({
      success: true,
      data: {
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        monthName: MONTH_NAMES[month],
        // Hari ini
        dailyTarget,
        todayActual,
        todayTxCount,
        todayDiff,
        todayPct,
        // Bulanan
        monthlyTarget,
        monthActual,
        monthPct: Math.round((monthActual / monthlyTarget) * 100),
        cumulativeTargetToToday,
        cumulativeGap,
        isOnTrack: cumulativeGap >= 0,
        // Sisa
        remaining: Math.max(0, monthlyTarget - monthActual),
        daysLeftInMonth: daysInMonth - day + 1,
        requiredDailyForRest: Math.round(Math.max(0, monthlyTarget - monthActual) / Math.max(1, daysInMonth - day)),
        // Motivational
        mood,
        message,
      },
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, data: null });
    logger.error('Gagal memuat target hari ini', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat target hari ini.' });
  }
};

function formatRp(n) {
  return `Rp ${Number(Math.round(n || 0)).toLocaleString('id-ID')}`;
}
