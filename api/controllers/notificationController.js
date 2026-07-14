import { poolWaschenPos } from '../db/connection.js';
import { getSettingValue } from './settingsController.js';
import logger from '../utils/logger.js';

const isAdminRole = (role) => role === 'admin';

// ─── Helper: format time ago ─────────────────────────────────────────────────
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
  return then.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ─── GET /api/notifications ─────────────────────────────────────────────────
// Notifikasi DIPISAH per role& per outlet.
// Role: frontline → notif frontline outlet tsb
//       produksi → notif produksi outlet tsb (team-specific)
//       admin/owner/finance → notif approval & lintas outlet
export const getNotifications = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const notifications = [];

    const isAdmin = isAdminRole(userRole);
    const isProduksi = userRole === 'produksi';
    const isFrontliner = ['frontline'].includes(userRole);

    // ─── Outlet filter helper ───────────────────────────────────────────────
    const outletFilter = userOutletId ? 'AND t.outlet_id = ?' : '';
    const outletParams = userOutletId ? [userOutletId] : [];

    // ════════════════════════════════════════════════════════════════════════
    // 1. FRONTLINER — notifikasi frontline outlet sendiri
    // ════════════════════════════════════════════════════════════════════════
    if (isFrontliner && userOutletId) {
      // 1a. Nota baru hari ini (dari checkout)
      const [newRows] = await poolWaschenPos.execute(
        `SELECT t.transaction_no, c.name AS customerName, t.total, t.created_at
         FROM tr_transaction t
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.status IN ('draft', 'pending')
           AND DATE(t.created_at) = CURDATE()
           AND t.outlet_id = ?
         ORDER BY t.created_at DESC
         LIMIT 8`,
        [userOutletId]
      );
      newRows.forEach((r) => {
        notifications.push({
          id: `new-${r.transaction_no}`,
          type: 'info',
          title: '📥 Nota Baru',
          message: `${r.transaction_no} — ${r.customerName} (Rp ${Number(r.total).toLocaleString('id-ID')})`,
          time: formatTimeAgo(r.created_at),
          timestamp: r.created_at,
          read: true,
          category: 'frontline',
        });
      });

      // 1b. Nota siap diambil (semua item ready) — INFORM ke frontline
      const [readyRows] = await poolWaschenPos.execute(
        `SELECT t.transaction_no, c.name AS customerName, t.updated_at
         FROM tr_transaction t
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.status IN ('ready_for_pickup', 'ready_for_delivery')
           AND t.picked_up_at IS NULL
           AND t.outlet_id = ?
         ORDER BY t.updated_at DESC
         LIMIT 10`,
        [userOutletId]
      );
      readyRows.forEach((r) => {
        notifications.push({
          id: `ready-${r.transaction_no}`,
          type: 'selesai',
          title: '✅ Nota Siap Diambil',
          message: `${r.transaction_no} (${r.customerName}) sudah selesai — bisa diambil customer`,
          time: formatTimeAgo(r.updated_at),
          timestamp: r.updated_at,
          read: false,
          category: 'frontline',
        });
      });

      // 1c. Pembayaran masuk (settled)
      const [paidRows] = await poolWaschenPos.execute(
        `SELECT t.transaction_no, c.name AS customerName, t.paid_amount, t.updated_at
         FROM tr_transaction t
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.payment_status = 'paid'
           AND DATE(t.updated_at) = CURDATE()
           AND t.outlet_id = ?
         ORDER BY t.updated_at DESC
         LIMIT 5`,
        [userOutletId]
      );
      paidRows.forEach((r) => {
        notifications.push({
          id: `paid-${r.transaction_no}`,
          type: 'payment',
          title: '💳 Pembayaran Lunas',
          message: `${r.transaction_no} — ${r.customerName} (Rp ${Number(r.paid_amount).toLocaleString('id-ID')})`,
          time: formatTimeAgo(r.updated_at),
          timestamp: r.updated_at,
          read: true,
          category: 'frontline',
        });
      });

      // 1d. Status pengajuan stok berubah
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
          title = '✅ Pengajuan Disetujui';
          type = 'selesai';
          const finalQty = r.approved_qty != null ? Number(r.approved_qty) : Number(r.qty);
          message = `${r.item_name}: ${finalQty.toLocaleString('id-ID')} ${r.unit} disetujui & masuk stok`;
        } else if (r.status === 'revised') {
          title = '⚠️ Pengajuan Perlu Revisi';
          type = 'warning';
          message = `${r.item_name}: ${r.admin_note || 'Mohon edit ulang.'}`;
        } else {
          title = '❌ Pengajuan Ditolak';
          type = 'warning';
          message = `${r.item_name}: ${r.admin_note || 'Pengajuan ditolak.'}`;
        }
        notifications.push({
          id: `pr-${r.id}-${r.status}`,
          type,
          title,
          message,
          time: formatTimeAgo(ts),
          timestamp: ts,
          read: false,
          category: 'frontline',
        });
      });

      // 1e. Stok rendah
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
        lowStock.forEach((r) => {
          notifications.push({
            id: `stock-low-${r.name}`,
            type: 'warning',
            title: '⚠️ Stok Bahan Rendah',
            message: `${r.name}: sisa ${Number(r.qty).toLocaleString('id-ID')} (min ${Number(r.minq).toLocaleString('id-ID')})`,
            time: 'Hari ini',
            timestamp: new Date().toISOString(),
            read: false,
            category: 'frontline',
          });
        });
      } catch { /* inventaris belum dipakai */ }

      // 1f. Saldo kas rendah
      let kasMinBalance;
      try {
        kasMinBalance = Number(await getSettingValue('kas_minimum_balance', 2_000_000));
      } catch { kasMinBalance = 2_000_000; }

      try {
        const [balRows] = await poolWaschenPos.execute(
          `SELECT balance, updated_at FROM mst_outlet_cash_balance WHERE outlet_id = ?`,
          [userOutletId]
        );
        if (balRows.length) {
          const bal = Number(balRows[0].balance || 0);
          if (bal < kasMinBalance) {
            notifications.push({
              id: `kas-low-${userOutletId}`,
              type: 'warning',
              title: '💰 Saldo Kas Rendah',
              message: `Saldo: Rp ${bal.toLocaleString('id-ID')} (min Rp ${kasMinBalance.toLocaleString('id-ID')})`,
              time: formatTimeAgo(balRows[0].updated_at),
              timestamp: balRows[0].updated_at,
              read: false,
              category: 'frontline',
            });
          }
        }
        const [topupRows] = await poolWaschenPos.execute(
          `SELECT t.id, t.amount, t.notes, t.created_at, u.name AS adminName
           FROM tr_outlet_cash_topup t
           LEFT JOIN mst_user u ON u.id = t.topup_by
           WHERE t.outlet_id = ? AND t.created_at >= DATE_SUB(NOW(), INTERVAL 3 DAY)
           ORDER BY t.created_at DESC LIMIT 5`,
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
            category: 'frontline',
          });
        });
      } catch { /* kas belum dipakai */ }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. PRODUKSI — notifikasi produksi per outlet & per team
    // ════════════════════════════════════════════════════════════════════════
    if (isProduksi && userOutletId) {
      // 2a. Item baru masuk (status 'Diterima') — notif untuk tim Cuci
      const [newItems] = await poolWaschenPos.execute(
        `SELECT ti.id AS itemId, ti.service_name_snapshot AS itemName,
                ti.qty, ti.unit_type_snapshot AS unit,
                t.transaction_no, c.name AS customerName,
                t.is_express, t.estimated_done_at AS deadline,
                iu.production_status AS currentStage
         FROM tr_item_unit iu
         JOIN tr_transaction_item ti ON ti.id = iu.transaction_item_id
         JOIN tr_transaction t ON t.id = ti.transaction_id
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.outlet_id = ?
           AND t.status NOT IN ('cancelled', 'draft')
           AND iu.production_status = 'received'
           AND DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
         ORDER BY t.is_express DESC, t.estimated_done_at ASC
         LIMIT 15`,
        [userOutletId]
      );
      newItems.forEach((r) => {
        const express = r.is_express ? ' [⚡Express]' : '';
        notifications.push({
          id: `prod-new-${r.itemId}`,
          type: 'info',
          title: '🆕 Item Baru Masuk',
          message: `${r.itemName} (${r.qty} ${r.unit}) — ${r.customerName} — Nota ${r.transaction_no}${express}`,
          time: formatTimeAgo(r.deadline),
          timestamp: r.deadline,
          read: false,
          category: 'produksi',
          stage: 'Diterima',
          isExpress: !!r.is_express,
        });
      });

      // 2b. Item yang sudah di-Cuci (siap Setrika) — notif untuk tim Setrika
      const [setrikaReady] = await poolWaschenPos.execute(
        `SELECT ti.id AS itemId, ti.service_name_snapshot AS itemName,
                ti.qty, ti.unit_type_snapshot AS unit,
                t.transaction_no, c.name AS customerName,
                t.is_express, t.estimated_done_at AS deadline
         FROM tr_item_unit iu
         JOIN tr_transaction_item ti ON ti.id = iu.transaction_item_id
         JOIN tr_transaction t ON t.id = ti.transaction_id
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.outlet_id = ?
           AND iu.production_status = 'washing'
           AND DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
         ORDER BY t.is_express DESC, t.estimated_done_at ASC
         LIMIT 10`,
        [userOutletId]
      );
      setrikaReady.forEach((r) => {
        notifications.push({
          id: `prod-setrika-${r.itemId}`,
          type: 'info',
          title: '👕 Siap Disetrika',
          message: `${r.itemName} (${r.qty} ${r.unit}) — ${r.customerName} — Nota ${r.transaction_no}`,
          time: formatTimeAgo(r.deadline),
          timestamp: r.deadline,
          read: false,
          category: 'produksi',
          stage: 'Cuci',
        });
      });

      // 2c. Item yang sudah di-Setrika (siap Packing) — notif untuk tim Packing
      const [packingReady] = await poolWaschenPos.execute(
        `SELECT ti.id AS itemId, ti.service_name_snapshot AS itemName,
                ti.qty, ti.unit_type_snapshot AS unit,
                t.transaction_no, c.name AS customerName,
                t.is_express, t.estimated_done_at AS deadline
         FROM tr_item_unit iu
         JOIN tr_transaction_item ti ON ti.id = iu.transaction_item_id
         JOIN tr_transaction t ON t.id = ti.transaction_id
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.outlet_id = ?
           AND iu.production_status = 'ironing'
           AND DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
         ORDER BY t.is_express DESC, t.estimated_done_at ASC
         LIMIT 10`,
        [userOutletId]
      );
      packingReady.forEach((r) => {
        notifications.push({
          id: `prod-packing-${r.itemId}`,
          type: 'info',
          title: '📦 Siap Dikemas',
          message: `${r.itemName} (${r.qty} ${r.unit}) — ${r.customerName} — Nota ${r.transaction_no}`,
          time: formatTimeAgo(r.deadline),
          timestamp: r.deadline,
          read: false,
          category: 'produksi',
          stage: 'Setrika',
        });
      });

      // 2d. Item telat dari estimasi
      const [overdueItems] = await poolWaschenPos.execute(
        `SELECT ti.id AS itemId, ti.service_name_snapshot AS itemName,
                ti.qty, ti.unit_type_snapshot AS unit,
                t.transaction_no, c.name AS customerName,
                t.is_express, t.estimated_done_at AS deadline,
                iu.production_status AS currentStage
         FROM tr_item_unit iu
         JOIN tr_transaction_item ti ON ti.id = iu.transaction_item_id
         JOIN tr_transaction t ON t.id = ti.transaction_id
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.outlet_id = ?
           AND t.estimated_done_at< NOW()
           AND iu.production_status <> 'ready'
           AND DATE(t.created_at) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
         ORDER BY t.estimated_done_at ASC
         LIMIT 10`,
        [userOutletId]
      );
      overdueItems.forEach((r) => {
        notifications.push({
          id: `prod-overdue-${r.itemId}`,
          type: 'warning',
          title: '🔥 Item Telat',
          message: `${r.itemName} (${r.qty} ${r.unit}) — ${r.customerName} — Nota ${r.transaction_no} — Stage: ${r.currentStage}`,
          time: formatTimeAgo(r.deadline),
          timestamp: r.deadline,
          read: false,
          category: 'produksi',
          stage: r.currentStage,
          isUrgent: true,
        });
      });

      // 2e. Item selesai (ready) — notif ke tim Packing / produksi bahwa nota siap serah
      const [doneItems] = await poolWaschenPos.execute(
        `SELECT ti.id AS itemId, ti.service_name_snapshot AS itemName,
                ti.qty, ti.unit_type_snapshot AS unit,
                t.transaction_no, c.name AS customerName,
                t.is_express, t.updated_at AS doneAt
         FROM tr_item_unit iu
         JOIN tr_transaction_item ti ON ti.id = iu.transaction_item_id
         JOIN tr_transaction t ON t.id = ti.transaction_id
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.outlet_id = ?
           AND iu.production_status = 'ready'
           AND DATE(t.updated_at) = CURDATE()
         ORDER BY t.updated_at DESC
         LIMIT 10`,
        [userOutletId]
      );
      doneItems.forEach((r) => {
        notifications.push({
          id: `prod-done-${r.itemId}`,
          type: 'selesai',
          title: '✅ Item Selesai',
          message: `${r.itemName} (${r.qty} ${r.unit}) — ${r.customerName} — Nota ${r.transaction_no} — SIAP SERAH`,
          time: formatTimeAgo(r.doneAt),
          timestamp: r.doneAt,
          read: false,
          category: 'produksi',
          stage: 'Selesai',
        });
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. ADMIN / OWNER / FINANCE — notifikasi approval& lintas outlet
    // ════════════════════════════════════════════════════════════════════════
    if (isAdmin) {
      // 3a. Pengajuan purchase request baru (pending)
      try {
        const [pendingPR] = await poolWaschenPos.execute(
          `SELECT p.id, p.item_name, p.qty, p.unit, p.urgency, p.created_at,
                  o.name AS outletName
             FROM tr_purchase_request p
             LEFT JOIN mst_outlet o ON o.id = p.outlet_id
             WHERE p.deleted_at IS NULL AND p.status = 'pending'
             ORDER BY FIELD(p.urgency, 'critical', 'urgent', 'normal'), p.created_at DESC
             LIMIT 10`
        );
        pendingPR.forEach((r) => {
          const urgIcon = r.urgency === 'critical' ? '🚨' : r.urgency === 'urgent' ? '⚠️' : '📋';
          notifications.push({
            id: `pr-pending-${r.id}`,
            type: r.urgency === 'critical' ? 'warning' : 'info',
            title: `${urgIcon} Pengajuan Baru — ${r.outletName || 'Outlet'}`,
            message: `${r.item_name} (${Number(r.qty).toLocaleString('id-ID')} ${r.unit})`,
            time: formatTimeAgo(r.created_at),
            timestamp: r.created_at,
            read: false,
            category: 'admin',
          });
        });
      } catch { /* skip */ }

      // 3b. Pengajuan kas (outlet_cash expense request)
      try {
        const [pendingCash] = await poolWaschenPos.execute(
          `SELECT e.id, e.description, e.amount, e.created_at,
                  o.name AS outletName, u.name AS requestByName
             FROM tr_outlet_cash_expense e
             LEFT JOIN mst_outlet o ON o.id = e.outlet_id
             LEFT JOIN mst_user u ON u.id = e.requested_by
             WHERE e.status = 'pending_approval'
             ORDER BY e.created_at DESC
             LIMIT 8`
        );
        pendingCash.forEach((r) => {
          notifications.push({
            id: `cash-req-${r.id}`,
            type: 'payment',
            title: '💰 Pengajuan Kas Baru',
            message: `${r.outletName}: ${r.description} — Rp ${Number(r.amount).toLocaleString('id-ID')} (oleh ${r.requestByName})`,
            time: formatTimeAgo(r.created_at),
            timestamp: r.created_at,
            read: false,
            category: 'admin',
          });
        });
      } catch { /* skip */ }

      // 3c. Pembayaran perlu verifikasi
      try {
        const [verifyRows] = await poolWaschenPos.execute(
          `SELECT t.transaction_no, c.name AS customerName, t.total,
 t.primary_payment_method AS payMethod, t.created_at
           FROM tr_transaction t
           JOIN mst_customer c ON c.id = t.customer_id
           WHERE t.deleted_at IS NULL
             AND t.status <> 'cancelled'
             AND t.primary_payment_method IN ('transfer', 'qris')
             AND (t.payment_verified IS NULL OR t.payment_verified = 0)
           ORDER BY t.created_at DESC
           LIMIT 10`
        );
        verifyRows.forEach((r) => {
          const methodLabel = r.payMethod === 'qris' ? 'QRIS' : 'Transfer';
          notifications.push({
            id: `verify-${r.transaction_no}`,
            type: 'payment',
            title: '💳 Pembayaran Perlu Verifikasi',
            message: `${r.transaction_no} — ${r.customerName} (${methodLabel} Rp ${Number(r.total).toLocaleString('id-ID')})`,
            time: formatTimeAgo(r.created_at),
            timestamp: r.created_at,
            read: false,
            category: 'admin',
          });
        });
      } catch { /* payment_verified belum ada */ }

      // 3d. Transaksi dibatalkan (3 hari terakhir)
      const [cancelledRows] = await poolWaschenPos.execute(
        `SELECT t.transaction_no, c.name AS customerName, t.updated_at
         FROM tr_transaction t
         JOIN mst_customer c ON c.id = t.customer_id
         WHERE t.deleted_at IS NULL
           AND t.status = 'cancelled'
           AND DATE(t.updated_at) >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
         ORDER BY t.updated_at DESC
         LIMIT 5`
      );
      cancelledRows.forEach((r) => {
        notifications.push({
          id: `cancel-${r.transaction_no}`,
          type: 'warning',
          title: '❌ Transaksi Dibatalkan',
          message: `${r.transaction_no} (${r.customerName}) telah dibatalkan`,
          time: formatTimeAgo(r.updated_at),
          timestamp: r.updated_at,
          read: true,
          category: 'admin',
        });
      });

      // 3e. Kas semua outlet rendah
      let kasMinBalance;
      try {
        kasMinBalance = Number(await getSettingValue('kas_minimum_balance', 2_000_000));
      } catch { kasMinBalance = 2_000_000; }

      try {
        const [lowKasRows] = await poolWaschenPos.execute(
          `SELECT b.outlet_id AS outletId, b.balance, b.updated_at, o.name AS outletName
           FROM mst_outlet_cash_balance b
           JOIN mst_outlet o ON o.id = b.outlet_id
           WHERE o.is_active = 1 AND o.deleted_at IS NULL AND b.balance < ?
           ORDER BY b.balance ASC
           LIMIT 8`,
          [kasMinBalance]
        );
        lowKasRows.forEach((r) => {
          notifications.push({
            id: `kas-low-admin-${r.outletId}`,
            type: 'warning',
            title: `💰 Kas ${r.outletName} Rendah`,
            message: `Saldo: Rp ${Number(r.balance || 0).toLocaleString('id-ID')} (min Rp ${kasMinBalance.toLocaleString('id-ID')})`,
            time: formatTimeAgo(r.updated_at),
            timestamp: r.updated_at,
            read: false,
            category: 'admin',
          });
        });
      } catch { /* skip */ }

      // 3f. Pool kas tertahan (setor pending menumpuk)
      try {
        const [poolRows] = await poolWaschenPos.execute(
          `SELECT o.name AS outletName, o.id AS outletId,
                  COUNT(CASE WHEN cd.status = 'pending' THEN 1 END) AS pendingCount,
                  COALESCE(SUM(CASE WHEN cd.status = 'pending' THEN cd.deposit_amount ELSE 0 END), 0) AS pendingTotal
           FROM mst_outlet o
           LEFT JOIN tr_cash_deposit cd ON cd.outlet_id = o.id
           WHERE o.is_active = 1 AND o.deleted_at IS NULL
           GROUP BY o.id, o.name
           HAVING pendingCount > 0 OR pendingTotal > 5000000
           ORDER BY pendingTotal DESC
           LIMIT 5`
        );
        poolRows.forEach((r) => {
          if (Number(r.pendingCount) > 0) {
            notifications.push({
              id: `pool-pending-${r.outletId}`,
              type: 'warning',
              title: `💵 Setor Pending — ${r.outletName}`,
              message: `${r.pendingCount} setor pending (Rp ${Number(r.pendingTotal).toLocaleString('id-ID')}). Perlu approval.`,
              time: 'Hari ini',
              timestamp: new Date().toISOString(),
              read: false,
              category: 'admin',
            });
          }
        });
      } catch { /* skip */ }
    }

    // Sort by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({ success: true, data: notifications.slice(0, 40) });
  } catch (err) {
    logger.error('Gagal memuat notifikasi', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat notifikasi.' });
  }
};
