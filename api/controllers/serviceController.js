import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';

// Helper: Get default outlet
const getDefaultOutlet = async () => {
  const [outlets] = await poolWaschenPos.execute("SELECT id FROM mst_outlet LIMIT 1");
  if (outlets.length > 0) return outlets[0].id;
  const newId = randomUUID();
  await poolWaschenPos.execute(
    "INSERT INTO mst_outlet (id, outlet_code, name, address) VALUES (?, 'OUT-01', 'Default Outlet', 'Alamat Default')",
    [newId]
  );
  return newId;
};

// Helper: Get or create category
const getOrCreateCategory = async (categoryName) => {
  const name = categoryName || 'Umum';
  const [rows] = await poolWaschenPos.execute("SELECT id FROM mst_service_category WHERE name = ? LIMIT 1", [name]);
  if (rows.length > 0) return rows[0].id;
  const newId = randomUUID();
  await poolWaschenPos.execute(
    "INSERT INTO mst_service_category (id, code, name) VALUES (?, ?, ?)",
    [newId, name.toUpperCase().substring(0, 20).replace(/\s/g, '_'), name]
  );
  return newId;
};

// Helper: Generate service_code
const generateServiceCode = async () => {
  const [rows] = await poolWaschenPos.execute("SELECT COUNT(*) as cnt FROM mst_service");
  return `SVC-${String(rows[0].cnt + 1).padStart(4, '0')}`;
};

const hasServiceSlaColumns = async () => {
  try {
    const [rows] = await poolWaschenPos.execute(
      "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_service' AND COLUMN_NAME = 'sla_regular_hours'"
    );
    return rows[0]?.cnt > 0;
  } catch {
    return false;
  }
};

// ─── GET /api/services
export const getServices = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const queryOutletId = req.query?.outletId;
    const customerId = req.query?.customerId;
    const userRole = req.user?.roleCode;

    // Admin, finance, owner bisa lihat semua outlet (atau filter via query)
    const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
    const isGlobalRole = globalRoles.includes(userRole);

    let outletFilter = '';
    const params = [];

    if (queryOutletId) {
      // Explicit outlet filter via query param
      outletFilter = 'AND s.outlet_id = ?';
      params.push(queryOutletId);
    } else if (userOutletId && !isGlobalRole) {
      // Non-global roles: filter by their own outlet
      outletFilter = 'AND s.outlet_id = ?';
      params.push(userOutletId);
    }
    // else: global role tanpa query filter → tampilkan semua

    let favJoin = '';
    let favSelect = '0 AS usage_count';
    const favParams = [];
    if (customerId) {
      favJoin = 'LEFT JOIN mst_customer_service_favorite fav ON fav.service_id = s.id AND fav.customer_id = ?';
      favSelect = 'COALESCE(fav.usage_count, 0) AS usage_count';
      favParams.push(customerId);
    }

    const finalParams = [...favParams, ...params];

    let hasSlaColumns = true;
    let hasPinTable = true;

    hasSlaColumns = await hasServiceSlaColumns();

    try {
      const [tblCheck] = await poolWaschenPos.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_service_pin'`
      );
      hasPinTable = tblCheck[0]?.cnt > 0;
    } catch { hasPinTable = false; }

    const slaSelect = hasSlaColumns
      ? 's.sla_regular_hours AS slaRegular, s.sla_express_hours AS slaExpress,'
      : 'NULL AS slaRegular, NULL AS slaExpress,';

    const pinJoin = hasPinTable
      ? 'LEFT JOIN mst_service_pin sp ON sp.service_id = s.id AND sp.outlet_id = s.outlet_id'
      : '';
    const pinSelect = hasPinTable ? 'sp.pin_context,' : 'NULL AS pin_context,';

    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        s.id,
        s.name,
        c.name AS category,
        c.code AS categoryCode,
        c.sort_order AS categorySort,
        s.price,
        s.unit_type AS unit,
        s.min_qty AS minQty,
        s.express_multiplier AS expressMultiplier,
        ROUND(s.price * (s.express_multiplier - 1)) AS expressExtra,
        s.is_express_eligible AS expressEligible,
        s.is_active AS active,
        s.outlet_id AS outletId,
        ${slaSelect}
        ${pinSelect}
        ${favSelect},
        s.created_at AS createdAt,
        s.updated_at AS updatedAt
      FROM mst_service s
      JOIN mst_service_category c ON c.id = s.category_id
      ${pinJoin}
      ${favJoin}
      WHERE s.is_active = 1 ${outletFilter}
      ORDER BY c.sort_order, c.name, s.name`,
      finalParams
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getServices] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data layanan.' });
  }
};

// ─── POST /api/services
export const createService = async (req, res) => {
  try {
    const { name, category, price, unit, expressExtra, active, expressEligible, minQty, slaRegular, slaExpress } = req.body;

    if (!name || !price || !unit) {
      return res.status(400).json({ success: false, message: 'Nama, harga, dan satuan wajib diisi' });
    }

    const id = randomUUID();
    const outletId = await getDefaultOutlet();

    const [[existing]] = await poolWaschenPos.execute(
      `SELECT id, is_active FROM mst_service WHERE outlet_id = ? AND name = ? LIMIT 1`,
      [outletId, name.trim()]
    );

    const categoryId = await getOrCreateCategory(category);
    const isActive = active !== undefined ? active : true;
    const isExpressEligible = expressEligible !== undefined ? expressEligible : true;
    const basePrice = Number(price);
    const expressNominal = expressExtra ? Number(expressExtra) : 0;
    const expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 1.0;
    const minQ = minQty ? Number(minQty) : 1;
    const slaReg = slaRegular ? Number(slaRegular) : null;
    const slaExp = slaExpress ? Number(slaExpress) : null;

    const hasSlaColumns = await hasServiceSlaColumns();

    if (existing) {
      if (existing.is_active === 1) {
        return res.status(400).json({ success: false, message: 'Layanan dengan nama yang sama sudah ada.' });
      } else {
        if (hasSlaColumns) {
          await poolWaschenPos.execute(
            `UPDATE mst_service 
             SET category_id = ?, unit_type = ?, price = ?, express_multiplier = ?, is_express_eligible = ?,
                 min_qty = ?, sla_regular_hours = ?, sla_express_hours = ?, is_active = ?, updated_at = NOW() 
             WHERE id = ?`,
            [categoryId, unit, basePrice, expressMul, isExpressEligible ? 1 : 0, minQ, slaReg, slaExp, isActive ? 1 : 0, existing.id]
          );
        } else {
          await poolWaschenPos.execute(
            `UPDATE mst_service 
             SET category_id = ?, unit_type = ?, price = ?, express_multiplier = ?, is_express_eligible = ?,
                 min_qty = ?, is_active = ?, updated_at = NOW() 
             WHERE id = ?`,
            [categoryId, unit, basePrice, expressMul, isExpressEligible ? 1 : 0, minQ, isActive ? 1 : 0, existing.id]
          );
        }
        const updService = { id: existing.id, name: name.trim(), category, price: basePrice, unit, expressExtra: expressNominal, active: isActive, expressEligible: isExpressEligible, minQty: minQ, slaRegular: slaReg, slaExpress: slaExp };
        return res.status(201).json({ success: true, message: 'Layanan yang sempat terhapus berhasil diaktifkan kembali.', data: updService });
      }
    }

    const serviceCode = await generateServiceCode();
    if (hasSlaColumns) {
      await poolWaschenPos.execute(
        `INSERT INTO mst_service 
          (id, outlet_id, category_id, service_code, name, unit_type, price, min_qty, express_multiplier, is_express_eligible, sla_regular_hours, sla_express_hours, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [id, outletId, categoryId, serviceCode, name.trim(), unit, basePrice, minQ, expressMul, isExpressEligible ? 1 : 0, slaReg, slaExp, isActive ? 1 : 0]
      );
    } else {
      await poolWaschenPos.execute(
        `INSERT INTO mst_service 
          (id, outlet_id, category_id, service_code, name, unit_type, price, min_qty, express_multiplier, is_express_eligible, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [id, outletId, categoryId, serviceCode, name.trim(), unit, basePrice, minQ, expressMul, isExpressEligible ? 1 : 0, isActive ? 1 : 0]
      );
    }

    const newService = { id, name: name.trim(), category, price: basePrice, unit, expressExtra: expressNominal, active: isActive, expressEligible: isExpressEligible, minQty: minQ, slaRegular: slaReg, slaExpress: slaExp };
    return res.status(201).json({ success: true, message: 'Layanan berhasil ditambahkan', data: newService });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Layanan dengan nama tersebut sudah ada (duplikat)' });
    }
    console.error('[createService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan layanan.' });
  }
};

// ─── PUT /api/services/:id
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, unit, expressExtra, active, expressEligible, minQty, slaRegular, slaExpress } = req.body;

    if (!name || !price || !unit) {
      return res.status(400).json({ success: false, message: 'Nama, harga, dan satuan wajib diisi' });
    }

    const categoryId = await getOrCreateCategory(category);
    const basePrice = Number(price);
    const expressNominal = expressExtra ? Number(expressExtra) : 0;
    const expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 1.0;
    const isActive = active !== undefined ? active : true;
    const isExpressEligible = expressEligible !== undefined ? expressEligible : true;
    const minQ = minQty ? Number(minQty) : 1;
    const slaReg = slaRegular ? Number(slaRegular) : null;
    const slaExp = slaExpress ? Number(slaExpress) : null;

    const hasSlaColumns = await hasServiceSlaColumns();

    if (hasSlaColumns) {
      await poolWaschenPos.execute(
        `UPDATE mst_service 
         SET name = ?, category_id = ?, unit_type = ?, price = ?, express_multiplier = ?, is_express_eligible = ?,
             min_qty = ?, sla_regular_hours = ?, sla_express_hours = ?, is_active = ?, updated_at = NOW() 
         WHERE id = ?`,
        [name.trim(), categoryId, unit, basePrice, expressMul, isExpressEligible ? 1 : 0, minQ, slaReg, slaExp, isActive ? 1 : 0, id]
      );
    } else {
      await poolWaschenPos.execute(
        `UPDATE mst_service 
         SET name = ?, category_id = ?, unit_type = ?, price = ?, express_multiplier = ?, is_express_eligible = ?,
             min_qty = ?, is_active = ?, updated_at = NOW() 
         WHERE id = ?`,
        [name.trim(), categoryId, unit, basePrice, expressMul, isExpressEligible ? 1 : 0, minQ, isActive ? 1 : 0, id]
      );
    }

    const updatedService = { id, name: name.trim(), category, price: basePrice, unit, expressExtra: expressNominal, active: isActive, expressEligible: isExpressEligible, minQty: minQ, slaRegular: slaReg, slaExpress: slaExp };
    return res.status(200).json({ success: true, message: 'Layanan berhasil diupdate', data: updatedService });
  } catch (err) {
    console.error('[updateService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengupdate layanan.' });
  }
};

// ─── DELETE /api/services/:id
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    await poolWaschenPos.execute(`UPDATE mst_service SET is_active = 0, updated_at = NOW() WHERE id = ?`, [id]);
    return res.status(200).json({ success: true, message: 'Layanan berhasil dihapus' });
  } catch (err) {
    console.error('[deleteService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus layanan.' });
  }
};

// ─── PATCH /api/services/:id/toggle
export const toggleService = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    await poolWaschenPos.execute(`UPDATE mst_service SET is_active = ?, updated_at = NOW() WHERE id = ?`, [active ? 1 : 0, id]);
    return res.status(200).json({ success: true, message: 'Status layanan berhasil diubah' });
  } catch (err) {
    console.error('[toggleService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah status layanan.' });
  }
};
