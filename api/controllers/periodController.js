import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ── Helper: hitung batas periode 26-25 ───────────────────────────────────────
// Periode berlabel dari bulan "akhir" (tgl 25):
//   April 26 – Mei 25   → label "Mei 2025"
//   Mei 26   – Jun 25   → label "Juni 2025"
function getPeriodBounds(refDate = new Date()) {
  const d = refDate.getDate();
  const m = refDate.getMonth(); // 0-indexed
  const y = refDate.getFullYear();

  let startY, startM, endY, endM; // all 0-indexed months

  if (d >= 26) {
    // Periode: 26 bulan ini → 25 bulan depan
    startY = y; startM = m;
    endY   = m === 11 ? y + 1 : y;
    endM   = m === 11 ? 0 : m + 1;
  } else {
    // Periode: 26 bulan lalu → 25 bulan ini
    startY = m === 0 ? y - 1 : y;
    startM = m === 0 ? 11 : m - 1;
    endY   = y; endM = m;
  }

  const periodStart = new Date(startY, startM, 26);
  const periodEnd   = new Date(endY,   endM,   25, 23, 59, 59);
  const labelMonth  = endM + 1; // convert to 1-indexed for MONTH_NAMES
  const periodLabel = `${MONTH_NAMES[labelMonth]} ${endY}`;

  return {
    periodStart, periodEnd, periodLabel,
    startStr: `${startY}-${String(startM + 1).padStart(2, '0')}-26`,
    endStr:   `${endY}-${String(endM + 1).padStart(2, '0')}-25`,
  };
}

// ── GET /api/periods/current ─────────────────────────────────────────────────
// Untuk kasir: pakai outlet dari token. Untuk admin: bisa pass ?outletId=xxx
export const getCurrentPeriod = async (req, res) => {
  try {
    const outletId = req.query.outletId || req.user?.outletId;
    if (!outletId) return res.status(400).json({ success: false, message: 'outletId diperlukan.' });

    const now = new Date();
    const { periodStart, periodEnd, periodLabel, startStr, endStr } = getPeriodBounds(now);

    // Sisa hari sampai tutup (termasuk hari ini)
    const msLeft  = periodEnd.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));

    // Sudah ditutup?
    const [closedRows] = await poolWaschenPos.execute(
      `SELECT id, closed_at FROM tr_period_close WHERE outlet_id = ? AND period_start = ? LIMIT 1`,
      [outletId, startStr]
    );
    const alreadyClosed = closedRows.length > 0;

    // Hitung stats periode ini
    const [stats] = await poolWaschenPos.execute(
      `SELECT
         COALESCE(SUM(total), 0)                                           AS totalOmset,
         COALESCE(SUM(paid_amount), 0)                                     AS totalPelunasan,
         COUNT(id)                                                          AS totalTransaksi,
         SUM(CASE WHEN status IN ('selesai','diambil') THEN 1 ELSE 0 END)  AS totalSelesai
       FROM tr_transaction
       WHERE outlet_id = ?
         AND deleted_at IS NULL
         AND status <> 'cancelled'
         AND created_at >= ?
         AND created_at <= ?`,
      [outletId, `${startStr} 00:00:00`, `${endStr} 23:59:59`]
    );

    return res.json({
      success: true,
      data: {
        periodLabel,
        periodStart: startStr,
        periodEnd:   endStr,
        daysLeft,
        isClosing:    daysLeft <= 3,
        alreadyClosed,
        closedAt:     alreadyClosed ? closedRows[0].closed_at : null,
        stats: {
          totalOmset:      Number(stats[0].totalOmset),
          totalPelunasan:  Number(stats[0].totalPelunasan),
          totalTransaksi:  Number(stats[0].totalTransaksi),
          totalSelesai:    Number(stats[0].totalSelesai),
        },
      },
    });
  } catch (err) {
    console.error('[getCurrentPeriod] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data periode.' });
  }
};

// ── GET /api/periods/history ─────────────────────────────────────────────────
export const getPeriodHistory = async (req, res) => {
  try {
    const userRole  = req.user?.roleCode;
    const isGlobal  = ['admin', 'superadmin', 'finance', 'owner'].includes(userRole);
    const outletId  = req.query.outletId || (isGlobal ? null : req.user?.outletId);

    const params = outletId ? [outletId] : [];
    const where  = outletId ? 'WHERE pc.outlet_id = ?' : '';

    const [rows] = await poolWaschenPos.execute(
      `SELECT
         pc.id, pc.outlet_id AS outletId, o.name AS outletName,
         pc.period_label AS periodLabel,
         pc.period_start AS periodStart, pc.period_end AS periodEnd,
         pc.total_omset AS totalOmset, pc.total_pelunasan AS totalPelunasan,
         pc.total_transaksi AS totalTransaksi, pc.total_selesai AS totalSelesai,
         pc.target_amount AS targetAmount,
         pc.notes, pc.closed_at AS closedAt,
         u.name AS closedByName
       FROM tr_period_close pc
       JOIN mst_outlet o ON o.id = pc.outlet_id
       LEFT JOIN mst_user u ON u.id = pc.closed_by
       ${where}
       ORDER BY pc.period_start DESC
       LIMIT 36`,
      params
    );

    const data = rows.map(r => ({
      ...r,
      totalOmset:     Number(r.totalOmset),
      totalPelunasan: Number(r.totalPelunasan),
      totalTransaksi: Number(r.totalTransaksi),
      totalSelesai:   Number(r.totalSelesai),
      targetAmount:   r.targetAmount != null ? Number(r.targetAmount) : null,
      pct:            r.targetAmount > 0 ? Math.round((Number(r.totalOmset) / Number(r.targetAmount)) * 100) : null,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[getPeriodHistory] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat riwayat tutup buku.' });
  }
};

// ── POST /api/periods/close ──────────────────────────────────────────────────
export const closePeriod = async (req, res) => {
  try {
    const { outletId: bodyOutletId, notes } = req.body;
    const outletId = bodyOutletId || req.user?.outletId;
    if (!outletId) return res.status(400).json({ success: false, message: 'outletId diperlukan.' });

    const now = new Date();
    const { periodLabel, startStr, endStr } = getPeriodBounds(now);

    // Cek duplikat
    const [existing] = await poolWaschenPos.execute(
      `SELECT id FROM tr_period_close WHERE outlet_id = ? AND period_start = ? LIMIT 1`,
      [outletId, startStr]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `Periode ${periodLabel} sudah ditutup sebelumnya.` });
    }

    // Snapshot stats
    const [stats] = await poolWaschenPos.execute(
      `SELECT
         COALESCE(SUM(total), 0)                                           AS totalOmset,
         COALESCE(SUM(paid_amount), 0)                                     AS totalPelunasan,
         COUNT(id)                                                          AS totalTransaksi,
         SUM(CASE WHEN status IN ('selesai','diambil') THEN 1 ELSE 0 END)  AS totalSelesai
       FROM tr_transaction
       WHERE outlet_id = ? AND deleted_at IS NULL AND status <> 'cancelled'
         AND created_at >= ? AND created_at <= ?`,
      [outletId, `${startStr} 00:00:00`, `${endStr} 23:59:59`]
    );

    // Ambil target (pakai bulan akhir periode sebagai referensi)
    const endDate    = new Date(endStr);
    const tgtMonth   = endDate.getMonth() + 1;
    const tgtYear    = endDate.getFullYear();
    const [tgtRows]  = await poolWaschenPos.execute(
      `SELECT target_amount FROM mst_outlet_target WHERE outlet_id = ? AND period_year = ? AND period_month = ? LIMIT 1`,
      [outletId, tgtYear, tgtMonth]
    );

    const id = randomUUID();
    await poolWaschenPos.execute(
      `INSERT INTO tr_period_close
         (id, outlet_id, period_label, period_start, period_end,
          total_omset, total_pelunasan, total_transaksi, total_selesai,
          target_amount, notes, closed_by, closed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id, outletId, periodLabel, startStr, endStr,
        Number(stats[0].totalOmset),
        Number(stats[0].totalPelunasan),
        Number(stats[0].totalTransaksi),
        Number(stats[0].totalSelesai),
        tgtRows.length > 0 ? Number(tgtRows[0].target_amount) : null,
        notes || null,
        req.user?.userId,
      ]
    );

    return res.json({
      success: true,
      message: `Tutup buku periode ${periodLabel} berhasil dicatat.`,
      data: { id, periodLabel, periodStart: startStr, periodEnd: endStr },
    });
  } catch (err) {
    console.error('[closePeriod] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal melakukan tutup buku.' });
  }
};
