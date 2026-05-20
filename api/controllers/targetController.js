import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Transaksi yang dianggap "selesai" untuk perhitungan capaian
// Gunakan status DB yang sebenarnya (bukan label frontend)
const DONE_STATUSES = `('completed', 'ready_for_pickup', 'ready_for_delivery')`;

// ── GET /api/targets — list semua target (admin) ──────────────────────────────
export const listTargets = async (req, res) => {
  try {
    const filterYear  = Number(req.query.year)     || new Date().getFullYear();
    const filterMonth = Number(req.query.month)    || null; // null = semua bulan
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
       WHERE t.period_year = ? ${monthFilter} ${outletFilter}
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
    console.error('[listTargets] Error:', err);
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
       WHERE t.outlet_id = ? AND t.period_year = ? AND t.period_month = ?
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
    console.error('[getTargetProgress] Error:', err);
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

    const id = randomUUID();
    await poolWaschenPos.execute(
      `INSERT INTO mst_outlet_target
         (id, outlet_id, period_year, period_month, target_amount, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         target_amount = VALUES(target_amount),
         notes         = VALUES(notes),
         updated_at    = NOW()`,
      [id, outletId, Number(year), Number(month), Number(targetAmount), notes || null, req.user?.userId]
    );

    return res.json({ success: true, message: 'Target berhasil disimpan.' });
  } catch (err) {
    console.error('[upsertTarget] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan target.' });
  }
};

// ── DELETE /api/targets/:id — hapus target ────────────────────────────────────
export const deleteTarget = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await poolWaschenPos.execute('DELETE FROM mst_outlet_target WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Target tidak ditemukan.' });
    }
    return res.json({ success: true, message: 'Target dihapus.' });
  } catch (err) {
    console.error('[deleteTarget] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus target.' });
  }
};
