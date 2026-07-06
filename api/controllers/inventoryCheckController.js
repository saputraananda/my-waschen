// ─────────────────────────────────────────────────────────────────────────────
// inventoryCheckController.js — Read-Only Inventory Check for Production Role B
// Phase 5: Dual Role System for Production Team
// Task 29.3: Create inventory checking interface for Role B
// ─────────────────────────────────────────────────────────────────────────────
// Role B can:
// - View current stock levels
// - View low-stock items
// - Send low-stock alerts to frontliners
// Role B CANNOT:
// - Create purchase requests
// - Update production status
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos as db } from '../db/connection.js';
import { canCheckInventory } from '../utils/productionRolePermission.js';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory/check
// Get inventory stock for checking (read-only)
// ─────────────────────────────────────────────────────────────────────────────
export async function getInventoryStock(req, res) {
  try {
    // ── Permission Check ──────────────────────────────────────────────
    if (!canCheckInventory(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk melihat inventory.',
      });
    }

    const userOutletId = req.user?.outletId;
    const qOutletId = req.query?.outletId;
    const qCategory = req.query?.category;
    const qFilter = req.query?.filter || 'all'; // all, low, out
    const isGlobal = ['admin', 'superadmin'].includes(req.user?.roleCode);

    // Determine outlet filter
    let outletCondition = '';
    let params = [];

    if (isGlobal && qOutletId) {
      outletCondition = 'AND s.outlet_id = ?';
      params.push(qOutletId);
    } else if (userOutletId) {
      outletCondition = 'AND s.outlet_id = ?';
      params.push(userOutletId);
    } else if (!isGlobal) {
      return res.status(400).json({
        success: false,
        message: 'User outlet tidak dikonfigurasi.',
      });
    }

    // Category filter
    let categoryCondition = '';
    if (qCategory) {
      categoryCondition = 'AND i.category_id = ?';
      params.push(qCategory);
    }

    // Stock filter
    let stockCondition = '';
    if (qFilter === 'low') {
      stockCondition = 'AND s.stock_qty <= s.min_stock';
    } else if (qFilter === 'out') {
      stockCondition = 'AND s.stock_qty <= 0';
    }

    // ── Get stock data ─────────────────────────────────────────────────
    const [rows] = await db.execute(`
      SELECT
        s.id as stock_id,
        s.outlet_id,
        o.name as outlet_name,
        i.id as item_id,
        i.item_code,
        i.name as item_name,
        c.name as category_name,
        s.stock_qty,
        s.min_stock,
        s.last_cost,
        s.last_updated_at,
        ROUND(s.stock_qty / NULLIF(s.min_stock, 0) * 100, 1) as stock_ratio,
        CASE
          WHEN s.stock_qty <= 0 THEN 'out'
          WHEN s.stock_qty < s.min_stock * 0.25 THEN 'critical'
          WHEN s.stock_qty < s.min_stock * 0.5 THEN 'high'
          WHEN s.stock_qty < s.min_stock THEN 'medium'
          ELSE 'ok'
        END as stock_status
      FROM mst_inventory_outlet_stock s
      JOIN mst_inventory_item i ON s.inventory_id = i.id
      JOIN mst_inventory_category c ON i.category_id = c.id
      JOIN mst_outlet o ON s.outlet_id = o.id
      WHERE i.is_active = 1
        AND o.is_active = 1
        AND o.deleted_at IS NULL
        AND i.deleted_at IS NULL
        ${outletCondition}
        ${categoryCondition}
        ${stockCondition}
      ORDER BY stock_status DESC, s.stock_qty ASC, i.name
      LIMIT 100
    `, params);

    // ── Summary by status ─────────────────────────────────────────────
    const summary = {
      total: rows.length,
      out: rows.filter(r => r.stock_status === 'out').length,
      critical: rows.filter(r => r.stock_status === 'critical').length,
      high: rows.filter(r => r.stock_status === 'high').length,
      medium: rows.filter(r => r.stock_status === 'medium').length,
      ok: rows.filter(r => r.stock_status === 'ok').length,
    };

    // ── Get categories for filter dropdown ──────────────────────────────
    const [categories] = await db.execute(`
      SELECT id, name FROM mst_inventory_category WHERE is_active = 1 ORDER BY name
    `);

    // ── Get outlets for filter dropdown ────────────────────────────────
    const [outlets] = await db.execute(`
      SELECT id, name FROM mst_outlet WHERE is_active = 1 AND deleted_at IS NULL ORDER BY name
    `);

    return res.json({
      success: true,
      data: {
        items: rows.map(r => ({
          stockId: r.stock_id,
          outletId: r.outlet_id,
          outletName: r.outlet_name,
          itemId: r.item_id,
          itemCode: r.item_code,
          itemName: r.item_name,
          categoryName: r.category_name,
          currentStock: Number(r.stock_qty),
          minStock: Number(r.min_stock),
          lastCost: Number(r.last_cost),
          lastUpdated: r.last_updated_at,
          stockRatio: Number(r.stock_ratio || 0),
          stockStatus: r.stock_status,
          urgencyLabel: r.stock_status === 'out' ? 'STOK HABIS'
            : r.stock_status === 'critical' ? 'KRITIS'
            : r.stock_status === 'high' ? 'TINGGI'
            : r.stock_status === 'medium' ? 'SEDANG'
            : 'OK',
          urgencyColor: r.stock_status === 'out' ? '#DC2626'
            : r.stock_status === 'critical' ? '#DC2626'
            : r.stock_status === 'high' ? '#F59E0B'
            : r.stock_status === 'medium' ? '#FBBF24'
            : '#22C55E',
        })),
        summary,
        filters: {
          categories: categories.map(c => ({ id: c.id, name: c.name })),
          outlets: outlets.map(o => ({ id: o.id, name: o.name })),
        },
      },
    });

  } catch (error) {
    console.error('[getInventoryStock] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data inventory.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory/check/summary
// Quick summary for dashboard badge
// ─────────────────────────────────────────────────────────────────────────────
export async function getInventorySummary(req, res) {
  try {
    if (!canCheckInventory(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk melihat inventory.',
      });
    }

    const userOutletId = req.user?.outletId;
    const isGlobal = ['admin', 'superadmin'].includes(req.user?.roleCode);

    let condition = '';
    let params = [];

    if (!isGlobal && userOutletId) {
      condition = 'WHERE s.outlet_id = ?';
      params.push(userOutletId);
    }

    const [rows] = await db.execute(`
      SELECT
        COUNT(*) as total_items,
        SUM(CASE WHEN s.stock_qty <= 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN s.stock_qty < s.min_stock * 0.25 THEN 1 ELSE 0 END) as critical,
        SUM(CASE WHEN s.stock_qty < s.min_stock AND s.stock_qty > 0 THEN 1 ELSE 0 END) as below_min
      FROM mst_inventory_outlet_stock s
      JOIN mst_inventory_item i ON s.inventory_id = i.id
      JOIN mst_outlet o ON s.outlet_id = o.id
      ${condition ? condition + ' AND i.is_active = 1 AND o.is_active = 1 AND o.deleted_at IS NULL AND i.deleted_at IS NULL' : 'WHERE i.is_active = 1 AND o.is_active = 1 AND o.deleted_at IS NULL AND i.deleted_at IS NULL'}
    `, params);

    const stats = rows[0] || {};

    return res.json({
      success: true,
      data: {
        totalItems: Number(stats.total_items || 0),
        outOfStock: Number(stats.out_of_stock || 0),
        critical: Number(stats.critical || 0),
        belowMin: Number(stats.below_min || 0),
        hasAlerts: (Number(stats.out_of_stock || 0) + Number(stats.critical || 0)) > 0,
      },
    });

  } catch (error) {
    console.error('[getInventorySummary] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil ringkasan inventory.',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory/check/alert
// Send low-stock alert to frontliners (Role B can do this)
// ─────────────────────────────────────────────────────────────────────────────
export async function sendLowStockAlert(req, res) {
  const conn = await db.getConnection();

  try {
    if (!canCheckInventory(req.user)) {
      conn.release();
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk mengirim alert.',
      });
    }

    const { stockId, urgency, notes } = req.body;
    const userId = req.user?.userId || req.user?.id;
    const userOutletId = req.user?.outletId;

    if (!stockId) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Stock ID wajib diisi.',
      });
    }

    await conn.beginTransaction();

    // Get stock info
    const [[stock]] = await conn.execute(`
      SELECT
        s.*, i.name as item_name, o.name as outlet_name
      FROM mst_inventory_outlet_stock s
      JOIN mst_inventory_item i ON s.inventory_id = i.id
      JOIN mst_outlet o ON s.outlet_id = o.id
      WHERE s.id = ?
      LIMIT 1
    `, [stockId]);

    if (!stock) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Item stock tidak ditemukan.',
      });
    }

    // Determine urgency if not provided
    const stockRatio = stock.stock_qty / (stock.min_stock || 1);
    const alertUrgency = urgency || (
      stock.stock_qty <= 0 ? 'critical'
      : stockRatio < 0.25 ? 'critical'
      : stockRatio < 0.5 ? 'high'
      : 'medium'
    );

    // Create notification for frontliners at outlet
    const [frontliners] = await conn.execute(`
      SELECT u.id, u.name FROM mst_user u
      WHERE u.outlet_id = ?
        AND u.role_code IN ('kasir', 'frontline')
        AND u.is_active = 1
        AND u.deleted_at IS NULL
    `, [stock.outlet_id]);

    const notificationType = 'low_stock_alert';
    const message = `[LOW STOCK] ${stock.item_name} di ${stock.outlet_name}: ${stock.stock_qty} ${stock.min_stock > 0 ? `(${Math.round(stockRatio * 100)}% dari min)` : ''}. ${notes || ''}`;

    let notificationCount = 0;
    for (const fl of frontliners) {
      await conn.execute(`
        INSERT INTO tr_notification (
          type, send_mode, recipient_customer_id, wa_number,
          message_body, status, sent_by, created_at
        ) VALUES (?, 'in_app', NULL, NULL, ?, 'queued', ?, NOW())
      `, [notificationType, message, userId]);
      notificationCount++;
    }

    await conn.commit();

    return res.json({
      success: true,
      message: `Alert berhasil dikirim ke ${notificationCount} frontliner.`,
      data: {
        itemName: stock.item_name,
        outletName: stock.outlet_name,
        currentStock: stock.stock_qty,
        minStock: stock.min_stock,
        urgency: alertUrgency,
        notifiedCount: notificationCount,
      },
    });

  } catch (error) {
    await conn.rollback();
    console.error('[sendLowStockAlert] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengirim alert.',
    });
  } finally {
    conn.release();
  }
}
