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

    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        s.id,
        s.name,
        c.name AS category,
        s.price,
        s.unit_type AS unit,
        ROUND(s.price * (s.express_multiplier - 1)) AS expressExtra,
        s.is_active AS active,
        s.outlet_id AS outletId,
        sp.pin_context,
        ${favSelect},
        s.created_at AS createdAt,
        s.updated_at AS updatedAt
      FROM mst_service s
      JOIN mst_service_category c ON c.id = s.category_id
      LEFT JOIN mst_service_pin sp ON sp.service_id = s.id AND sp.outlet_id = s.outlet_id
      ${favJoin}
      WHERE s.is_active = 1 ${outletFilter}
      ORDER BY c.name, s.name`,
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
    const { name, category, price, unit, expressExtra, active } = req.body;

    if (!name || !price || !unit) {
      return res.status(400).json({ success: false, message: 'Nama, harga, dan satuan wajib diisi' });
    }

    const id = randomUUID();
    const outletId = await getDefaultOutlet();
    const categoryId = await getOrCreateCategory(category);
    const serviceCode = await generateServiceCode();
    const isActive = active !== undefined ? active : true;
    const basePrice = Number(price);
    const expressNominal = expressExtra ? Number(expressExtra) : 0;
    const expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 1.0;

    await poolWaschenPos.execute(
      `INSERT INTO mst_service 
        (id, outlet_id, category_id, service_code, name, unit_type, price, express_multiplier, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, outletId, categoryId, serviceCode, name.trim(), unit, basePrice, expressMul, isActive ? 1 : 0]
    );

    const newService = { id, name: name.trim(), category, price: basePrice, unit, expressExtra: expressNominal, active: isActive };
    return res.status(201).json({ success: true, message: 'Layanan berhasil ditambahkan', data: newService });
  } catch (err) {
    console.error('[createService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan layanan.' });
  }
};

// ─── PUT /api/services/:id
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, unit, expressExtra, active } = req.body;

    if (!name || !price || !unit) {
      return res.status(400).json({ success: false, message: 'Nama, harga, dan satuan wajib diisi' });
    }

    const categoryId = await getOrCreateCategory(category);
    const basePrice = Number(price);
    const expressNominal = expressExtra ? Number(expressExtra) : 0;
    const expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 1.0;
    const isActive = active !== undefined ? active : true;

    await poolWaschenPos.execute(
      `UPDATE mst_service 
       SET name = ?, category_id = ?, unit_type = ?, price = ?, express_multiplier = ?, is_active = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name.trim(), categoryId, unit, basePrice, expressMul, isActive ? 1 : 0, id]
    );

    const updatedService = { id, name: name.trim(), category, price: basePrice, unit, expressExtra: expressNominal, active: isActive };
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
