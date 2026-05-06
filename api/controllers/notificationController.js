import { poolWaschenPos } from '../db/connection.js';

// ─── GET /api/notifications ─────────────────────────────────────────────────
// Generate notifikasi real-time dari data transaksi (tanpa tabel khusus)
export const getNotifications = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;

    const notifications = [];

    // ─── 1. Transaksi ready for pickup (semua role) ───────────────────────
    const outletFilter = userOutletId ? 'AND t.outlet_id = ?' : '';
    const outletParams = userOutletId ? [userOutletId] : [];

    const [readyRows] = await poolWaschenPos.execute(
      `SELECT t.transaction_no, c.name AS customerName, t.updated_at
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.deleted_at IS NULL
         AND t.status IN ('ready_for_pickup', 'ready_for_delivery')
         AND t.picked_up_at IS NULL
         ${outletFilter}
       ORDER BY t.updated_at DESC
       LIMIT 10`,
      outletParams
    );

    readyRows.forEach((r) => {
      notifications.push({
        id: `ready-${r.transaction_no}`,
        type: 'selesai',
        title: 'Nota Siap Diambil',
        message: `${r.transaction_no} (${r.customerName}) sudah selesai dan siap diambil`,
        time: formatTimeAgo(r.updated_at),
        timestamp: r.updated_at,
        read: false,
      });
    });

    // ─── 2. Transaksi baru hari ini ──────────────────────────────────────
    const [newRows] = await poolWaschenPos.execute(
      `SELECT t.transaction_no, c.name AS customerName, t.total, t.created_at
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.deleted_at IS NULL
         AND t.status IN ('draft', 'pending')
         AND DATE(t.created_at) = CURDATE()
         ${outletFilter}
       ORDER BY t.created_at DESC
       LIMIT 8`,
      outletParams
    );

    newRows.forEach((r) => {
      notifications.push({
        id: `new-${r.transaction_no}`,
        type: 'info',
        title: 'Nota Baru',
        message: `${r.transaction_no} — ${r.customerName} (Rp ${Number(r.total).toLocaleString('id-ID')})`,
        time: formatTimeAgo(r.created_at),
        timestamp: r.created_at,
        read: true,
      });
    });

    // ─── 3. Pembayaran pending verifikasi (finance & admin only) ─────────
    if (userRole === 'finance' || userRole === 'admin') {
      try {
        const [pendingRows] = await poolWaschenPos.execute(
          `SELECT t.transaction_no, c.name AS customerName, t.total,
                  t.primary_payment_method AS payMethod, t.created_at
           FROM tr_transaction t
           JOIN mst_customer c ON c.id = t.customer_id
           WHERE t.deleted_at IS NULL
             AND t.status <> 'cancelled'
             AND t.primary_payment_method IN ('transfer', 'qris')
             AND (t.payment_verified IS NULL OR t.payment_verified = 0)
             ${outletFilter}
           ORDER BY t.created_at DESC
           LIMIT 10`,
          outletParams
        );

        pendingRows.forEach((r) => {
          const methodLabel = r.payMethod === 'qris' ? 'QRIS' : 'Transfer';
          notifications.push({
            id: `verify-${r.transaction_no}`,
            type: 'payment',
            title: 'Pembayaran Perlu Verifikasi',
            message: `${r.transaction_no} — ${r.customerName} (${methodLabel} Rp ${Number(r.total).toLocaleString('id-ID')})`,
            time: formatTimeAgo(r.created_at),
            timestamp: r.created_at,
            read: false,
          });
        });
      } catch {
        // kolom payment_verified belum ada — skip
      }
    }

    // ─── 4. Transaksi dibatalkan hari ini ─────────────────────────────────
    const [cancelledRows] = await poolWaschenPos.execute(
      `SELECT t.transaction_no, c.name AS customerName, t.updated_at
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       WHERE t.deleted_at IS NULL
         AND t.status = 'cancelled'
         AND DATE(t.updated_at) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
         ${outletFilter}
       ORDER BY t.updated_at DESC
       LIMIT 5`,
      outletParams
    );

    cancelledRows.forEach((r) => {
      notifications.push({
        id: `cancel-${r.transaction_no}`,
        type: 'warning',
        title: 'Transaksi Dibatalkan',
        message: `${r.transaction_no} (${r.customerName}) telah dibatalkan`,
        time: formatTimeAgo(r.updated_at),
        timestamp: r.updated_at,
        read: true,
      });
    });

    // ─── 5. Customer baru (3 hari terakhir) ──────────────────────────────
    const [custRows] = await poolWaschenPos.execute(
      `SELECT name, phone, created_at
       FROM mst_customer
       WHERE is_active = 1
         AND DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
       ORDER BY created_at DESC
       LIMIT 5`
    );

    custRows.forEach((r) => {
      notifications.push({
        id: `cust-${r.phone}`,
        type: 'info',
        title: 'Customer Baru',
        message: `${r.name} (${r.phone}) terdaftar sebagai customer baru`,
        time: formatTimeAgo(r.created_at),
        timestamp: r.created_at,
        read: true,
      });
    });

    // Sort by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({ success: true, data: notifications.slice(0, 30) });
  } catch (err) {
    console.error('[getNotifications] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat notifikasi.' });
  }
};

// ─── Helper: Format time ago ─────────────────────────────────────────────────
function formatTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Baru saja';
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return then.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
