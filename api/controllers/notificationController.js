import { poolWaschenPos } from '../db/connection.js';
import { getSettingValue } from './settingsController.js';

const isAdminRole = (role) => ['admin', 'superadmin', 'owner', 'finance'].includes(role);

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

    // ─── 6. Stok bahan di bawah minimum (kasir/produksi/admin outlet) ─────────
    if (['kasir', 'frontline', 'produksi', 'admin'].includes(userRole) && userOutletId) {
      try {
        const [lowStock] = await poolWaschenPos.execute(
          `SELECT i.name, COALESCE(st.stock_qty, 0) AS qty, COALESCE(st.min_stock, i.min_stock_default) AS minq
           FROM mst_inventory_item i
           LEFT JOIN mst_inventory_outlet_stock st ON st.inventory_id = i.id AND st.outlet_id = ?
           WHERE i.is_active = 1 AND COALESCE(st.stock_qty, 0) <= COALESCE(st.min_stock, i.min_stock_default)
           ORDER BY i.name
           LIMIT 8`,
          [userOutletId]
        );
        lowStock.forEach((r, idx) => {
          notifications.push({
            id: `stock-low-${idx}-${r.name}`,
            type: 'warning',
            title: 'Stok bahan rendah',
            message: `${r.name}: sisa ${Number(r.qty).toLocaleString('id-ID')} (min ${Number(r.minq).toLocaleString('id-ID')})`,
            time: 'Hari ini',
            timestamp: new Date().toISOString(),
            read: false,
          });
        });
      } catch { /* inventaris belum dipakai */ }
    }

    // ─── 7. Status pengajuan stok berubah (kasir) ───────────────────────────
    if (['kasir', 'frontline'].includes(userRole) && userOutletId) {
      try {
        const [prRows] = await poolWaschenPos.execute(
          `SELECT id, item_name, qty, unit, status, admin_note, approved_qty,
                  resolved_at, revised_at
             FROM tr_purchase_request
            WHERE deleted_at IS NULL
              AND outlet_id = ?
              AND status IN ('approved', 'revised', 'rejected')
              AND COALESCE(resolved_at, revised_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY COALESCE(resolved_at, revised_at) DESC
            LIMIT 8`,
          [userOutletId]
        );
        prRows.forEach((r) => {
          const ts = r.resolved_at || r.revised_at;
          let title, type, message;
          if (r.status === 'approved') {
            title = 'Pengajuan Disetujui';
            type = 'selesai';
            const finalQty = r.approved_qty != null ? Number(r.approved_qty) : Number(r.qty);
            message = `${r.item_name}: ${finalQty.toLocaleString('id-ID')} ${r.unit} disetujui & masuk stok`;
          } else if (r.status === 'revised') {
            title = 'Pengajuan Perlu Revisi';
            type = 'warning';
            message = `${r.item_name}: ${r.admin_note || 'Mohon edit ulang sesuai catatan admin.'}`;
          } else {
            title = 'Pengajuan Ditolak';
            type = 'warning';
            message = `${r.item_name}: ${r.admin_note || 'Pengajuan ditolak admin.'}`;
          }
          notifications.push({
            id: `pr-${r.id}-${r.status}`,
            type,
            title,
            message,
            time: formatTimeAgo(ts),
            timestamp: ts,
            read: false,
          });
        });
      } catch { /* tabel pr belum ada */ }
    }

    // ─── 8. Pengajuan stok masuk yang belum diproses (admin) ────────────────
    if (isAdminRole(userRole)) {
      try {
        const [pendingRows] = await poolWaschenPos.execute(
          `SELECT p.id, p.item_name, p.qty, p.unit, p.urgency, p.created_at,
                  o.name AS outletName
             FROM tr_purchase_request p
             LEFT JOIN mst_outlet o ON o.id = p.outlet_id
            WHERE p.deleted_at IS NULL AND p.status = 'pending'
            ORDER BY FIELD(p.urgency, 'critical', 'urgent', 'normal'), p.created_at DESC
            LIMIT 8`
        );
        pendingRows.forEach((r) => {
          const urgIcon = r.urgency === 'critical' ? '🚨' : r.urgency === 'urgent' ? '⚠️' : '📋';
          notifications.push({
            id: `pr-pending-${r.id}`,
            type: r.urgency === 'critical' ? 'warning' : 'info',
            title: `${urgIcon} Pengajuan Baru — ${r.outletName || 'Outlet'}`,
            message: `${r.item_name} (${Number(r.qty).toLocaleString('id-ID')} ${r.unit})`,
            time: formatTimeAgo(r.created_at),
            timestamp: r.created_at,
            read: false,
          });
        });
      } catch { /* skip kalau tabel belum ada */ }
    }

    // ─── 9. Saldo kas operasional di bawah minimum ──────────────────────────
    // Threshold dari mst_setting.kas_minimum_balance (default 2.000.000)
    let kasMinBalance;
    try {
      kasMinBalance = Number(await getSettingValue('kas_minimum_balance', 2_000_000));
    } catch { kasMinBalance = 2_000_000; }

    // Kasir/frontline: cek saldo outlet sendiri
    if (['kasir', 'frontline'].includes(userRole) && userOutletId) {
      try {
        const [balRows] = await poolWaschenPos.execute(
          `SELECT b.balance, o.name AS outletName, b.updated_at
             FROM mst_outlet_cash_balance b
             LEFT JOIN mst_outlet o ON o.id = b.outlet_id
            WHERE b.outlet_id = ?`,
          [userOutletId]
        );
        if (balRows.length) {
          const bal = Number(balRows[0].balance || 0);
          if (bal < kasMinBalance) {
            notifications.push({
              id: `kas-low-${userOutletId}`,
              type: 'warning',
              title: '💰 Saldo Kas Mendekati Batas Minimum',
              message: `Saldo: Rp ${bal.toLocaleString('id-ID')} (min Rp ${kasMinBalance.toLocaleString('id-ID')}). Hubungi admin untuk top-up.`,
              time: formatTimeAgo(balRows[0].updated_at),
              timestamp: balRows[0].updated_at,
              read: false,
            });
          }
        }

        // Top-up baru masuk (3 hari terakhir)
        const [topupRows] = await poolWaschenPos.execute(
          `SELECT t.id, t.amount, t.notes, t.created_at, u.name AS adminName
             FROM tr_outlet_cash_topup t
             LEFT JOIN mst_user u ON u.id = t.topup_by
            WHERE t.outlet_id = ?
              AND t.created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)
            ORDER BY t.created_at DESC
            LIMIT 5`,
          [userOutletId]
        );
        topupRows.forEach((r) => {
          notifications.push({
            id: `kas-topup-${r.id}`,
            type: 'info',
            title: '✅ Top-up Kas Masuk',
            message: `Rp ${Number(r.amount).toLocaleString('id-ID')} oleh ${r.adminName || 'admin'}${r.notes ? ` — ${r.notes}` : ''}`,
            time: formatTimeAgo(r.created_at),
            timestamp: r.created_at,
            read: false,
          });
        });
      } catch { /* tabel kas belum ada */ }
    }

    // Admin: cek semua outlet yang saldonya di bawah minimum
    if (isAdminRole(userRole)) {
      try {
        const [lowKasRows] = await poolWaschenPos.execute(
          `SELECT b.outlet_id AS outletId, b.balance, b.updated_at,
                  o.name AS outletName
             FROM mst_outlet_cash_balance b
             JOIN mst_outlet o ON o.id = b.outlet_id
            WHERE o.is_active = 1 AND o.deleted_at IS NULL
              AND b.balance < ?
            ORDER BY b.balance ASC
            LIMIT 8`,
          [kasMinBalance]
        );
        lowKasRows.forEach((r) => {
          notifications.push({
            id: `kas-low-admin-${r.outletId}`,
            type: 'warning',
            title: `💰 Kas ${r.outletName} Di Bawah Minimum`,
            message: `Saldo: Rp ${Number(r.balance || 0).toLocaleString('id-ID')} (min Rp ${kasMinBalance.toLocaleString('id-ID')})`,
            time: formatTimeAgo(r.updated_at),
            timestamp: r.updated_at,
            read: false,
          });
        });
      } catch { /* skip kalau tabel belum ada */ }
    }

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
