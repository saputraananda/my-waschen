import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';
import { writeAudit } from '../utils/auditLog.js';

const canManageStock = (role) => ['kasir', 'admin', 'produksi', 'finance', 'superadmin', 'owner'].includes(role);
const canAdminInventory = (role) => ['admin', 'finance', 'superadmin', 'owner'].includes(role);

// ─── GET /api/inventory/stock?outletId= — stok per outlet (kasir / admin filter) ─
export const getOutletStock = async (req, res) => {
  try {
    const { outletId: qOutlet } = req.query;
    const role = req.user?.roleCode;
    const userOutlet = req.user?.outletId;
    let outletId = qOutlet || userOutlet;

    if (!outletId && (role === 'admin' || role === 'finance')) {
      return res.status(400).json({ success: false, message: 'Untuk ringkasan semua outlet gunakan GET /api/inventory/summary-outlets' });
    }
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'Outlet tidak ditemukan.' });
    }
    if (userOutlet && role !== 'admin' && role !== 'finance' && userOutlet !== outletId) {
      return res.status(403).json({ success: false, message: 'Akses outlet ditolak.' });
    }

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
    const outletId = bodyOutlet || userOutlet;
    const userId = req.user?.userId;

    if (!inventoryId || qtyDelta === undefined || qtyDelta === null) {
      return res.status(400).json({ success: false, message: 'inventoryId dan qtyDelta wajib.' });
    }
    const delta = Number(qtyDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: 'qtyDelta tidak valid.' });
    }
    if (!outletId) {
      return res.status(400).json({ success: false, message: 'outletId wajib.' });
    }
    if (userOutlet && role !== 'admin' && role !== 'finance' && userOutlet !== outletId) {
      return res.status(403).json({ success: false, message: 'Akses outlet ditolak.' });
    }

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
      const stockId = randomUUID();
      await conn.execute(
        `INSERT INTO mst_inventory_outlet_stock (id, outlet_id, inventory_id, stock_qty, min_stock, last_cost, last_updated_at)
         VALUES (?, ?, ?, ?, ?, 0, NOW())`,
        [stockId, outletId, inventoryId, newQty, item.min_stock_default]
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
    await conn.execute(
      `INSERT INTO tr_inventory_movement (
        id, outlet_id, inventory_id, movement_type, qty, unit_cost, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NOW())`,
      [
        randomUUID(),
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
export const getInventoryCategories = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
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
export const listInventoryItems = async (req, res) => {
  try {
    if (!canAdminInventory(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Tidak diizinkan.' });
    }
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
    const id = randomUUID();
    const minDef = minStockDefault != null ? Number(minStockDefault) : 0;
    await poolWaschenPos.execute(
      `INSERT INTO mst_inventory_item (
        id, category_id, item_code, name, unit, tracking_type, default_cost, min_stock_default,
        is_auto_deduct, is_hpp_component, is_active, created_by_data_analyst, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'real_time', 0, ?, 0, 1, 1, ?, NOW(), NOW())`,
      [id, categoryId, code, String(name).trim(), String(unit).trim(), minDef, userId || null]
    );
    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'inventory_item',
      entityId: id,
      action: 'create',
      newData: { categoryId, itemCode: code, name, unit, minStockDefault: minDef },
      req,
    });
    return res.status(201).json({ success: true, message: 'SKU dibuat.', data: { id, itemCode: code } });
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
      const sid = randomUUID();
      await poolWaschenPos.execute(
        `INSERT INTO mst_inventory_outlet_stock (id, outlet_id, inventory_id, stock_qty, min_stock, last_cost, last_updated_at)
         VALUES (?, ?, ?, 0, ?, 0, NOW())`,
        [sid, outletId, inventoryId, minV]
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
      rowId = randomUUID();
      await poolWaschenPos.execute(
        `INSERT INTO mst_service_inventory_usage (
          id, service_id, inventory_id, usage_type, qty_per_unit, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())`,
        [rowId, serviceId, inventoryId, ut, q]
      );
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
