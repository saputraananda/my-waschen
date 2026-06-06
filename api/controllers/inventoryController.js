import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';

const canManageStock = (role) => ['kasir', 'frontline', 'admin', 'produksi', 'finance', 'superadmin', 'owner'].includes(role);
const canAdminInventory = (role) => ['admin', 'finance', 'superadmin', 'owner'].includes(role);

const parseOutletId = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const canAccessOutlet = (userOutlet, role, targetOutletId) => {
  const target = parseOutletId(targetOutletId);
  if (!target) return { ok: false, status: 400, message: 'Outlet tidak ditemukan.' };
  const own = parseOutletId(userOutlet);
  const isGlobal = ['admin', 'finance', 'superadmin', 'owner'].includes(role);
  if (own && !isGlobal && own !== target) {
    return { ok: false, status: 403, message: 'Akses outlet ditolak.' };
  }
  return { ok: true, outletId: target };
};

// ─── Helper: auto-create PR kalau stok di bawah min ────────────────────────
// Dipanggil setelah adjustInventoryStock commit. Idempotent: kalau sudah ada
// PR pending untuk inventory_id + outlet_id yang sama, tidak buat baru.
//
// Strategi reorder qty: 2× min_stock - current_stock (cukup untuk safety buffer)
// Dengan minimum 1 unit. Urgency 'urgent' (bukan 'critical') supaya admin masih
// bisa filter dan ga panik tiap kali low.
export async function autoCreateReorderPR({ outletId, inventoryId, currentQty, requestedBy }) {
  try {
    // 1. Cek min_stock outlet ini & item info
    const [[stockInfo]] = await poolWaschenPos.execute(
      `SELECT s.min_stock, s.stock_qty, i.name, i.unit, i.default_cost
         FROM mst_inventory_outlet_stock s
         JOIN mst_inventory_item i ON i.id = s.inventory_id
        WHERE s.outlet_id = ? AND s.inventory_id = ?
        LIMIT 1`,
      [outletId, inventoryId]
    );
    if (!stockInfo) return { skipped: 'no_stock_record' };

    const minStock = Number(stockInfo.min_stock);
    const stockQty = Number(currentQty != null ? currentQty : stockInfo.stock_qty);

    // Skip kalau min_stock 0 (item ga di-track) atau stok masih di atas threshold
    if (minStock <= 0) return { skipped: 'no_min_stock' };
    if (stockQty > minStock) return { skipped: 'above_min' };

    // 2. Cek apakah sudah ada PR pending/approved untuk item ini di outlet ini
    const [[existing]] = await poolWaschenPos.execute(
      `SELECT id FROM tr_purchase_request
        WHERE outlet_id = ? AND inventory_id = ?
          AND status IN ('pending', 'approved', 'revised')
          AND deleted_at IS NULL
        LIMIT 1`,
      [outletId, inventoryId]
    );
    if (existing) return { skipped: 'already_exists', prId: existing.id };

    // 3. Hitung reorder qty: 2× min - current, minimal 1
    const reorderQty = Math.max(1, Math.ceil(2 * minStock - stockQty));
    const estimatedPrice = Number(stockInfo.default_cost) > 0
      ? Number(stockInfo.default_cost) * reorderQty
      : null;

    const [result] = await poolWaschenPos.execute(
      `INSERT INTO tr_purchase_request
         (outlet_id, inventory_id, item_name, qty, unit, estimated_price, urgency, reason, status, requested_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'urgent', ?, 'pending', ?, NOW())`,
      [
        outletId,
        inventoryId,
        stockInfo.name,
        reorderQty,
        stockInfo.unit || 'pcs',
        estimatedPrice,
        `[Auto-Reorder] Stok ${stockInfo.name} ${stockQty} ${stockInfo.unit || 'pcs'} sudah di bawah minimum ${minStock}.`,
        requestedBy || null,
      ]
    );

    return { created: true, prId: result.insertId, qty: reorderQty };
  } catch (err) {
    console.error('[autoCreateReorderPR]', err.message);
    return { error: err.message };
  }
}

// ─── GET /api/inventory/stock?outletId= — stok per outlet (kasir / admin filter) ─
export const getOutletStock = async (req, res) => {
  try {
    const { outletId: qOutlet } = req.query;
    const role = req.user?.roleCode;
    const userOutlet = req.user?.outletId;

    if (!qOutlet && !userOutlet && (role === 'admin' || role === 'finance')) {
      return res.status(400).json({ success: false, message: 'Untuk ringkasan semua outlet gunakan GET /api/inventory/summary-outlets' });
    }

    const access = canAccessOutlet(userOutlet, role, qOutlet || userOutlet);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const outletId = access.outletId;

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        i.id,
        i.item_code AS itemCode,
        i.name,
        i.unit,
        c.code AS categoryCode,
        c.name AS categoryName,
        COALESCE(st.stock_qty, 0) AS stockQty,
        COALESCE(st.min_stock, i.min_stock_default) AS minStock,
        i.tracking_type AS trackingType,
        st.id AS stockRowId
      FROM mst_inventory_item i
      JOIN mst_inventory_category c ON c.id = i.category_id
      LEFT JOIN mst_inventory_outlet_stock st ON st.inventory_id = i.id AND st.outlet_id = ?
      WHERE i.is_active = 1
      ORDER BY c.name, i.name`,
      [outletId]
    );

    return res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        stockQty: Number(r.stockQty),
        minStock: Number(r.minStock),
        lowStock: Number(r.stockQty) <= Number(r.minStock),
      })),
    });
  } catch (err) {
    console.error('[getOutletStock]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat stok.' });
  }
};

// ─── GET /api/inventory/summary-outlets — admin: ringkasan stok rendah per outlet ─
export const getInventoryOutletSummary = async (req, res) => {
  try {
    const role = req.user?.roleCode;
    if (!canAdminInventory(role)) {
      return res.status(403).json({ success: false, message: 'Hanya admin/finance.' });
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT
        o.id AS outletId,
        o.name AS outletName,
        COUNT(DISTINCT i.id) AS skuCount,
        SUM(
          CASE
            WHEN COALESCE(st.stock_qty, 0) <= COALESCE(st.min_stock, i.min_stock_default) THEN 1
            ELSE 0
          END
        ) AS lowStockCount
      FROM mst_outlet o
      JOIN mst_inventory_item i ON i.is_active = 1
      LEFT JOIN mst_inventory_outlet_stock st ON st.outlet_id = o.id AND st.inventory_id = i.id
      WHERE o.is_active = 1
      GROUP BY o.id, o.name
      ORDER BY o.name`
    );

    return res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        skuCount: Number(r.skuCount),
        lowStockCount: Number(r.lowStockCount),
      })),
    });
  } catch (err) {
    console.error('[getInventoryOutletSummary]', err);
    return res.status(500).json({ success: false, message: 'Gagal ringkasan stok.' });
  }
};

// ─── GET /api/inventory/all-outlet-stocks — admin: matrix item × outlet ─────
// Query: ?onlyLowStock=1 untuk filter cuma yang tipis/habis
// Response: [{ inventoryId, itemCode, name, unit, categoryName, outlets: [{outletId, outletName, stockQty, minStock, status}] }]
export const getAllOutletStocks = async (req, res) => {
  try {
    const role = req.user?.roleCode;
    if (!canAdminInventory(role)) {
      return res.status(403).json({ success: false, message: 'Hanya admin/finance.' });
    }

    const onlyLowStock = req.query.onlyLowStock === '1';
    const search = String(req.query.search || '').trim();

    const params = [];
    let where = 'i.is_active = 1';
    if (search) {
      where += ' AND (i.name LIKE ? OR i.item_code LIKE ? OR c.name LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q);
    }

    // Ambil semua item × outlet aktif (cross join) + LEFT JOIN stok
    const [rows] = await poolWaschenPos.execute(
      `SELECT
          i.id AS inventoryId,
          i.item_code AS itemCode,
          i.name AS itemName,
          i.unit,
          i.min_stock_default AS minStockDefault,
          c.name AS categoryName,
          o.id AS outletId,
          o.name AS outletName,
          COALESCE(st.stock_qty, 0) AS stockQty,
          COALESCE(st.min_stock, i.min_stock_default) AS minStock
        FROM mst_inventory_item i
        JOIN mst_inventory_category c ON c.id = i.category_id
        CROSS JOIN mst_outlet o
        LEFT JOIN mst_inventory_outlet_stock st
          ON st.outlet_id = o.id AND st.inventory_id = i.id
        WHERE ${where} AND o.is_active = 1
        ORDER BY c.name, i.name, o.name`,
      params
    );

    // Group by item
    const itemMap = new Map();
    for (const r of rows) {
      const key = r.inventoryId;
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          inventoryId: r.inventoryId,
          itemCode: r.itemCode,
          itemName: r.itemName,
          unit: r.unit,
          categoryName: r.categoryName,
          outlets: [],
          totalStock: 0,
          lowStockOutletCount: 0,
        });
      }
      const entry = itemMap.get(key);
      const stockQty = Number(r.stockQty);
      const minStock = Number(r.minStock);
      const status = stockQty === 0 ? 'empty' : stockQty <= minStock ? 'low' : 'safe';
      entry.outlets.push({
        outletId: r.outletId,
        outletName: r.outletName,
        stockQty, minStock, status,
      });
      entry.totalStock += stockQty;
      if (status !== 'safe') entry.lowStockOutletCount += 1;
    }

    let result = Array.from(itemMap.values());
    if (onlyLowStock) {
      result = result.filter((it) => it.lowStockOutletCount > 0);
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[getAllOutletStocks]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat stok semua outlet.' });
  }
};

// ─── POST /api/inventory/adjust — tambah/kurangi stok + movement ledger ─────────
export const adjustInventoryStock = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  try {
    if (!canManageStock(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }

    const { inventoryId, qtyDelta, notes, outletId: bodyOutlet } = req.body;
    const userOutlet = req.user?.outletId;
    const role = req.user?.roleCode;
    const userId = req.user?.userId;

    if (!inventoryId || qtyDelta === undefined || qtyDelta === null) {
      return res.status(400).json({ success: false, message: 'inventoryId dan qtyDelta wajib.' });
    }
    const delta = Number(qtyDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: 'qtyDelta tidak valid.' });
    }

    const access = canAccessOutlet(userOutlet, role, bodyOutlet || userOutlet);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }
    const outletId = access.outletId;

    await conn.beginTransaction();

    const [[item]] = await conn.execute(
      'SELECT id, min_stock_default FROM mst_inventory_item WHERE id = ? AND is_active = 1',
      [inventoryId]
    );
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Item inventaris tidak ditemukan.' });
    }

    const [[stock]] = await conn.execute(
      'SELECT id, stock_qty FROM mst_inventory_outlet_stock WHERE outlet_id = ? AND inventory_id = ? FOR UPDATE',
      [outletId, inventoryId]
    );

    const prevQty = stock ? Number(stock.stock_qty) : 0;
    let newQty;
    if (!stock) {
      newQty = delta;
      if (newQty < 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Stok tidak mencukupi.' });
      }
      // id AUTO_INCREMENT — biarkan DB yang generate
      await conn.execute(
        `INSERT INTO mst_inventory_outlet_stock (outlet_id, inventory_id, stock_qty, min_stock, last_cost, last_updated_at)
         VALUES (?, ?, ?, ?, 0, NOW())`,
        [outletId, inventoryId, newQty, item.min_stock_default]
      );
    } else {
      newQty = Number(stock.stock_qty) + delta;
      if (newQty < 0) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Stok tidak mencukupi.' });
      }
      await conn.execute(
        'UPDATE mst_inventory_outlet_stock SET stock_qty = ?, last_updated_at = NOW() WHERE id = ?',
        [newQty, stock.id]
      );
    }

    const movementType = delta >= 0 ? 'adjustment' : 'manual_usage';
    // id AUTO_INCREMENT — biarkan DB yang generate
    await conn.execute(
      `INSERT INTO tr_inventory_movement (
        outlet_id, inventory_id, movement_type, qty, unit_cost, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, NOW())`,
      [
        outletId,
        inventoryId,
        movementType,
        delta,
        notes || (delta >= 0 ? 'Penyesuaian masuk (POS)' : 'Penyesuaian keluar (POS)'),
        userId,
      ]
    );

    await writeAudit(conn, {
      userId,
      outletId,
      entityType: 'inventory_stock',
      entityId: inventoryId,
      action: 'adjust_stock',
      oldData: { stockQty: prevQty },
      newData: { stockQty: newQty, qtyDelta: delta, notes: notes || null },
      req,
    });

    await conn.commit();

    // Auto-reorder check (after commit, async — ga blocking response)
    // Hanya trigger kalau stok berkurang (delta negatif) supaya ga over-trigger
    // saat penambahan stok normal.
    if (delta < 0) {
      autoCreateReorderPR({
        outletId,
        inventoryId,
        currentQty: newQty,
        requestedBy: userId,
      }).catch(err => console.error('[reorder check]', err.message));
    }

    return res.status(201).json({ success: true, message: 'Stok diperbarui.', data: { inventoryId, outletId, newQty } });
  } catch (err) {
    await conn.rollback();
    console.error('[adjustInventoryStock]', err);
    return res.status(500).json({ success: false, message: 'Gagal menyesuaikan stok.' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/inventory/categories ───────────────────────────────────────────
// Allow read untuk semua role yang butuh lihat katalog (kasir untuk request,
// produksi untuk reference). Mutation tetap admin only via route guard.
export const getInventoryCategories = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, code, name FROM mst_inventory_category WHERE is_active = 1 ORDER BY name`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getInventoryCategories]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat kategori.' });
  }
};

// ─── GET /api/inventory/items ─────────────────────────────────────────────────
// Allow read untuk semua role berdasarkan route guard. Controller tidak perlu
// double-check role lagi.
export const listInventoryItems = async (req, res) => {
  try {
    const inc = req.query?.includeInactive === '1';
    const [rows] = await poolWaschenPos.execute(
      `SELECT i.id, i.item_code AS itemCode, i.name, i.unit,
              i.min_stock_default AS minStockDefault, i.is_active AS isActive, c.name AS categoryName
       FROM mst_inventory_item i
       JOIN mst_inventory_category c ON c.id = i.category_id
       ${inc ? '' : 'WHERE i.is_active = 1'}
       ORDER BY c.name, i.name`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[listInventoryItems]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat SKU.' });
  }
};

// ─── POST /api/inventory/items ───────────────────────────────────────────────
export const createInventoryItem = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
    const { categoryId, itemCode, name, unit, minStockDefault } = req.body;
    const userId = req.user?.userId;
    if (!categoryId || !name || !unit) {
      return res.status(400).json({ success: false, message: 'categoryId, name, unit wajib.' });
    }
    let code = itemCode?.trim();
    if (!code) {
      code = `SKU-${String(Date.now()).slice(-8)}`;
    }
    const minDef = minStockDefault != null ? Number(minStockDefault) : 0;
    // id AUTO_INCREMENT — biarkan DB yang generate
    const [insertResult] = await poolWaschenPos.execute(
      `INSERT INTO mst_inventory_item (
        category_id, item_code, name, unit, tracking_type, default_cost, min_stock_default,
        is_auto_deduct, is_hpp_component, is_active, created_by_data_analyst, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'real_time', 0, ?, 0, 1, 1, ?, NOW(), NOW())`,
      [categoryId, code, String(name).trim(), String(unit).trim(), minDef, userId || null]
    );
    const newItemId = insertResult.insertId;
    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'inventory_item',
      entityId: newItemId,
      action: 'create',
      newData: { categoryId, itemCode: code, name, unit, minStockDefault: minDef },
      req,
    });
    return res.status(201).json({ success: true, message: 'SKU dibuat.', data: { id: newItemId, itemCode: code } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Kode item sudah dipakai.' });
    }
    console.error('[createInventoryItem]', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat SKU.' });
  }
};

// ─── PATCH /api/inventory/items/:id ──────────────────────────────────────────
export const patchInventoryItem = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
    const { id } = req.params;
    const { name, unit, minStockDefault, isActive } = req.body;
    const userId = req.user?.userId;
    const [[old]] = await poolWaschenPos.execute(
      'SELECT id, name, unit, min_stock_default AS minStockDefault, is_active AS isActive FROM mst_inventory_item WHERE id = ?',
      [id]
    );
    if (!old) return res.status(404).json({ success: false, message: 'Item tidak ditemukan.' });

    const sets = [];
    const vals = [];
    if (name != null && String(name).trim()) {
      sets.push('name = ?');
      vals.push(String(name).trim());
    }
    if (unit != null && String(unit).trim()) {
      sets.push('unit = ?');
      vals.push(String(unit).trim());
    }
    if (minStockDefault !== undefined && minStockDefault !== null) {
      sets.push('min_stock_default = ?');
      vals.push(Number(minStockDefault));
    }
    if (isActive !== undefined && isActive !== null) {
      sets.push('is_active = ?');
      vals.push(isActive ? 1 : 0);
    }
    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada field yang diubah.' });
    }
    vals.push(id);
    await poolWaschenPos.execute(
      `UPDATE mst_inventory_item SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`,
      vals
    );
    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'inventory_item',
      entityId: id,
      action: 'update',
      oldData: old,
      newData: { name, unit, minStockDefault, isActive },
      req,
    });
    return res.json({ success: true, message: 'SKU diperbarui.' });
  } catch (err) {
    console.error('[patchInventoryItem]', err);
    return res.status(500).json({ success: false, message: 'Gagal update SKU.' });
  }
};

// ─── PATCH /api/inventory/outlet-min — set min stok per outlet per SKU ───────
export const patchOutletMinStock = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
    const { outletId, inventoryId, minStock } = req.body;
    const userId = req.user?.userId;
    if (!outletId || !inventoryId || minStock === undefined || minStock === null) {
      return res.status(400).json({ success: false, message: 'outletId, inventoryId, minStock wajib.' });
    }
    const minV = Number(minStock);
    if (!Number.isFinite(minV) || minV < 0) {
      return res.status(400).json({ success: false, message: 'minStock tidak valid.' });
    }

    const [[row]] = await poolWaschenPos.execute(
      'SELECT id, min_stock AS minStock FROM mst_inventory_outlet_stock WHERE outlet_id = ? AND inventory_id = ?',
      [outletId, inventoryId]
    );
    const [[item]] = await poolWaschenPos.execute(
      'SELECT min_stock_default FROM mst_inventory_item WHERE id = ?',
      [inventoryId]
    );
    if (!item) return res.status(404).json({ success: false, message: 'SKU tidak ditemukan.' });

    if (!row) {
      // id AUTO_INCREMENT — biarkan DB yang generate
      await poolWaschenPos.execute(
        `INSERT INTO mst_inventory_outlet_stock (outlet_id, inventory_id, stock_qty, min_stock, last_cost, last_updated_at)
         VALUES (?, ?, 0, ?, 0, NOW())`,
        [outletId, inventoryId, minV]
      );
    } else {
      await poolWaschenPos.execute(
        'UPDATE mst_inventory_outlet_stock SET min_stock = ?, last_updated_at = NOW() WHERE id = ?',
        [minV, row.id]
      );
    }
    await writeAudit(poolWaschenPos, {
      userId,
      outletId,
      entityType: 'inventory_outlet_min',
      entityId: inventoryId,
      action: 'set_min_stock',
      oldData: row ? { minStock: Number(row.minStock) } : null,
      newData: { minStock: minV, outletId },
      req,
    });
    return res.json({ success: true, message: 'Minimum stok outlet diperbarui.' });
  } catch (err) {
    console.error('[patchOutletMinStock]', err);
    return res.status(500).json({ success: false, message: 'Gagal set minimum stok.' });
  }
};

// ─── GET /api/inventory/service-usage?serviceId= ─────────────────────────────
export const listServiceInventoryUsage = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
    const serviceId = req.query?.serviceId;
    if (!serviceId) return res.status(400).json({ success: false, message: 'serviceId wajib.' });
    const [rows] = await poolWaschenPos.execute(
      `SELECT siu.id, siu.service_id AS serviceId, siu.inventory_id AS inventoryId,
              i.name AS inventoryName, i.unit, siu.usage_type AS usageType, siu.qty_per_unit AS qtyPerUnit, siu.is_active AS isActive
       FROM mst_service_inventory_usage siu
       JOIN mst_inventory_item i ON i.id = siu.inventory_id
       WHERE siu.service_id = ? AND siu.is_active = 1
       ORDER BY i.name`,
      [serviceId]
    );
    return res.json({
      success: true,
      data: rows.map((r) => ({ ...r, qtyPerUnit: Number(r.qtyPerUnit) })),
    });
  } catch (err) {
    console.error('[listServiceInventoryUsage]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat pemakaian bahan.' });
  }
};

// ─── POST /api/inventory/service-usage ────────────────────────────────────────
export const upsertServiceInventoryUsage = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
    const { serviceId, inventoryId, qtyPerUnit, usageType = 'auto_deduct' } = req.body;
    const userId = req.user?.userId;
    if (!serviceId || !inventoryId || qtyPerUnit === undefined) {
      return res.status(400).json({ success: false, message: 'serviceId, inventoryId, qtyPerUnit wajib.' });
    }
    const q = Number(qtyPerUnit);
    if (!Number.isFinite(q) || q < 0) {
      return res.status(400).json({ success: false, message: 'qtyPerUnit tidak valid.' });
    }
    const allowed = ['auto_deduct', 'estimated', 'analysis_only'];
    const ut = allowed.includes(usageType) ? usageType : 'auto_deduct';

    const [[existing]] = await poolWaschenPos.execute(
      `SELECT id, qty_per_unit AS qtyPerUnit FROM mst_service_inventory_usage
       WHERE service_id = ? AND inventory_id = ? AND usage_type = ?`,
      [serviceId, inventoryId, ut]
    );

    let rowId;
    if (existing) {
      rowId = existing.id;
      await poolWaschenPos.execute(
        `UPDATE mst_service_inventory_usage SET qty_per_unit = ?, is_active = 1, updated_at = NOW() WHERE id = ?`,
        [q, existing.id]
      );
    } else {
      // id AUTO_INCREMENT — biarkan DB yang generate
      const [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO mst_service_inventory_usage (
          service_id, inventory_id, usage_type, qty_per_unit, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
        [serviceId, inventoryId, ut, q]
      );
      rowId = insertResult.insertId;
    }
    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'service_inventory_usage',
      entityId: rowId,
      action: existing ? 'update_usage' : 'create_usage',
      oldData: existing || null,
      newData: { serviceId, inventoryId, usageType: ut, qtyPerUnit: q },
      req,
    });
    return res.status(201).json({ success: true, message: 'Pemakaian bahan disimpan.', data: { id: rowId } });
  } catch (err) {
    console.error('[upsertServiceInventoryUsage]', err);
    return res.status(500).json({ success: false, message: 'Gagal simpan pemakaian.' });
  }
};

// ─── DELETE /api/inventory/service-usage/:id ───────────────────────────────────
export const deleteServiceInventoryUsage = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
    const { id } = req.params;
    const userId = req.user?.userId;
    const [[row]] = await poolWaschenPos.execute(
      'SELECT id, service_id, inventory_id, usage_type, qty_per_unit FROM mst_service_inventory_usage WHERE id = ?',
      [id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Baris tidak ditemukan.' });
    await poolWaschenPos.execute(
      'UPDATE mst_service_inventory_usage SET is_active = 0, updated_at = NOW() WHERE id = ?',
      [id]
    );
    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'service_inventory_usage',
      entityId: id,
      action: 'delete_usage',
      oldData: row,
      req,
    });
    return res.json({ success: true, message: 'Pemakaian dinonaktifkan.' });
  } catch (err) {
    console.error('[deleteServiceInventoryUsage]', err);
    return res.status(500).json({ success: false, message: 'Gagal hapus.' });
  }
};
