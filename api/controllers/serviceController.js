import { poolWaschenPos } from '../db/connection.js';
import { notDeleted, softDeleteRecord } from '../utils/softDelete.js';

// Helper: Get default outlet
const getDefaultOutlet = async () => {
  const [outlets] = await poolWaschenPos.execute("SELECT id FROM mst_outlet LIMIT 1");
  if (outlets.length > 0) return outlets[0].id;
  // id AUTO_INCREMENT — biarkan DB yang generate
  const [result] = await poolWaschenPos.execute(
    "INSERT INTO mst_outlet (outlet_code, name, address) VALUES ('OUT-01', 'Default Outlet', 'Alamat Default')"
  );
  return result.insertId;
};

// Helper: Get or create category (truly race-safe via INSERT IGNORE)
const getOrCreateCategory = async (categoryName) => {
  const name = String(categoryName || 'Umum').trim();
  const code = name.toUpperCase().substring(0, 20).replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') || 'UMUM';

  // 1. Cek by code dulu (paling deterministik karena unique constraint)
  const [byCode] = await poolWaschenPos.execute(
    "SELECT id FROM mst_service_category WHERE code = ? LIMIT 1",
    [code]
  );
  if (byCode.length > 0) return byCode[0].id;

  // 2. Cek by name (case-insensitive) — kalau code beda tapi name match
  const [byName] = await poolWaschenPos.execute(
    "SELECT id FROM mst_service_category WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1",
    [name]
  );
  if (byName.length > 0) return byName[0].id;

  // 3. Race-safe insert: INSERT IGNORE = ga pernah throw DUP_ENTRY
  await poolWaschenPos.execute(
    "INSERT IGNORE INTO mst_service_category (code, name, is_active) VALUES (?, ?, 1)",
    [code, name]
  );

  // 4. Re-select by code (pasti ada sekarang, baik dari INSERT atau race winner)
  const [final] = await poolWaschenPos.execute(
    "SELECT id FROM mst_service_category WHERE code = ? LIMIT 1",
    [code]
  );
  if (final.length > 0) return final[0].id;

  // Last resort fallback (seharusnya ga pernah sampe sini)
  throw new Error(`Gagal mendapatkan kategori untuk "${name}" (code: ${code})`);
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
    const sort = req.query?.sort; // 'popular' | 'alphabetical' (default)

    // Admin, finance, owner bisa lihat semua outlet (atau filter via query)
    const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
    const isGlobalRole = globalRoles.includes(userRole) || globalRoles.includes(req.user?.originalRoleCode);

    let outletFilter = '';
    const params = [];

    let targetOutletId = null;
    if (queryOutletId) {
      if (!isGlobalRole) {
        if (!userOutletId) {
          return res.status(403).json({ success: false, message: 'Outlet tidak dikenali. Akses ditolak.' });
        }
        if (String(queryOutletId) !== String(userOutletId)) {
          return res.status(403).json({ success: false, message: 'Akses ditolak. Tidak bisa melihat layanan outlet lain.' });
        }
      }
      // Explicit outlet filter via query param
      targetOutletId = queryOutletId;
      outletFilter = 'AND s.outlet_id = ?';
      params.push(queryOutletId);
    } else if (!isGlobalRole) {
      // Non-global roles: filter by their own outlet
      if (!userOutletId) {
        return res.status(403).json({ success: false, message: 'Outlet tidak dikenali. Akses ditolak.' });
      }
      targetOutletId = userOutletId;
      outletFilter = 'AND s.outlet_id = ?';
      params.push(userOutletId);
    }

    if (targetOutletId) {
      // 1. Cek apakah ada layanan terdaftar di outlet ini
      const [countRow] = await poolWaschenPos.execute(
        "SELECT COUNT(*) AS cnt FROM mst_service WHERE outlet_id = ?",
        [targetOutletId]
      );
      if (countRow[0]?.cnt === 0) {
        // 2. Ambil default outlet
        const masterOutletId = await getDefaultOutlet();
        if (masterOutletId && masterOutletId !== targetOutletId) {
          // 3. Copy semua active service dari master ke target
          const hasSla = await hasServiceSlaColumns();
          const [masterServices] = await poolWaschenPos.execute(
            "SELECT * FROM mst_service WHERE outlet_id = ? AND is_active = 1",
            [masterOutletId]
          );
          for (const ms of masterServices) {
            if (hasSla) {
              await poolWaschenPos.execute(
                `INSERT INTO mst_service 
                  (outlet_id, category_id, service_code, legacy_smartlink_no, name, unit_type, price, min_qty, 
                   express_multiplier, is_express_eligible, is_requires_unit_detail, sort_order, sla_regular_hours, sla_express_hours, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [targetOutletId, ms.category_id, ms.service_code, ms.legacy_smartlink_no, ms.name, ms.unit_type, ms.price, ms.min_qty,
                 ms.express_multiplier, ms.is_express_eligible, ms.is_requires_unit_detail, ms.sort_order, ms.sla_regular_hours, ms.sla_express_hours]
              );
            } else {
              await poolWaschenPos.execute(
                `INSERT INTO mst_service 
                  (outlet_id, category_id, service_code, legacy_smartlink_no, name, unit_type, price, min_qty, 
                   express_multiplier, is_express_eligible, is_requires_unit_detail, sort_order, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [targetOutletId, ms.category_id, ms.service_code, ms.legacy_smartlink_no, ms.name, ms.unit_type, ms.price, ms.min_qty,
                 ms.express_multiplier, ms.is_express_eligible, ms.is_requires_unit_detail, ms.sort_order]
              );
            }
          }
        }
      }
    }

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

    // Cek apakah kolom service_kind sudah ada (migrasi user_requests)
    let hasServiceKind = false;
    try {
      const [kindCheck] = await poolWaschenPos.execute(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_service' AND COLUMN_NAME = 'service_kind'`
      );
      hasServiceKind = kindCheck[0]?.cnt > 0;
    } catch { hasServiceKind = false; }
    const kindSelect = hasServiceKind
      ? "s.service_kind AS serviceKind,"
      : "'waschen' AS serviceKind,";

    const pinJoin = hasPinTable
      ? 'LEFT JOIN mst_service_pin sp ON sp.service_id = s.id AND sp.outlet_id = s.outlet_id'
      : '';
    const pinSelect = hasPinTable ? 'sp.pin_context,' : 'NULL AS pin_context,';

    // ── Calculate popular services (frequency in last 30 days per outlet) ───────
    // Populated only when sort='popular' or for display purposes
    let popularSelect = '0 AS popular_count';
    let popularJoin = '';
    if (targetOutletId) {
      popularSelect = 'COALESCE(pop.popular_count, 0) AS popular_count';
      popularJoin = `
 LEFT JOIN (
          SELECT ti.service_id, COUNT(*) AS popular_count
          FROM tr_transaction_item ti
          JOIN tr_transaction t ON t.id = ti.transaction_id
          WHERE t.outlet_id = ?
            AND t.deleted_at IS NULL
            AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY ti.service_id
        ) pop ON pop.service_id = s.id
      `;
    }

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
        s.requires_material AS requiresMaterial,
        ${slaSelect}
        ${kindSelect}
        ${pinSelect}
        ${favSelect},
        ${popularSelect},
        s.created_at AS createdAt,
        s.updated_at AS updatedAt
      FROM mst_service s
      JOIN mst_service_category c ON c.id = s.category_id
      ${pinJoin}
      ${popularJoin}
      ${favJoin}
      WHERE s.is_active = 1 AND s.deleted_at IS NULL ${outletFilter}
      ORDER BY c.sort_order, c.name, s.name`,
      targetOutletId ? [targetOutletId, ...finalParams] : finalParams
    );

    // ── Apply sorting based on sort parameter ─────────────────────────────────
    // Default: alphabetical (c.sort_order, c.name, s.name)
    // Popular: popular_count DESC, then pinned, then favorites, then alphabetical
    let sortedRows = rows;
    if (sort === 'popular') {
      const pinned = rows.filter((s) => s.pin_context);
      const pinnedIds = new Set(pinned.map((s) => s.id));

      const popular = rows
        .filter((s) => !pinnedIds.has(s.id) && Number(s.popular_count) > 0)
        .sort((a, b) => Number(b.popular_count) - Number(a.popular_count));
      const popularIds = new Set(popular.map((s) => s.id));

      const favorites = rows
        .filter((s) => !pinnedIds.has(s.id) && !popularIds.has(s.id) && Number(s.usage_count) > 0)
        .sort((a, b) => Number(b.usage_count) - Number(a.usage_count));
      const favIds = new Set(favorites.map((s) => s.id));

      const others = rows
        .filter((s) => !pinnedIds.has(s.id) && !popularIds.has(s.id) && !favIds.has(s.id))
        .sort((a, b) => {
          const catCmp = (a.category || '').localeCompare(b.category || '', 'id');
          return catCmp !== 0 ? catCmp : (a.name || '').localeCompare(b.name || '', 'id');
        });

      sortedRows = [...pinned, ...popular, ...favorites, ...others];
    }

    return res.status(200).json({ success: true, data: sortedRows });
  } catch (err) {
    console.error('[getServices] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data layanan.' });
  }
};

// ─── POST /api/services
export const createService = async (req, res) => {
  try {
    const { name, category, price, unit, expressExtra, active, expressEligible, minQty, slaRegular, slaExpress, outletId: bodyOutletId } = req.body;

    if (!name || !price || !unit) {
      return res.status(400).json({ success: false, message: 'Nama, harga, dan satuan wajib diisi' });
    }

    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
    const isGlobalRole = globalRoles.includes(userRole);

    let targetOutletId;
    if (isGlobalRole) {
      targetOutletId = bodyOutletId || userOutletId || await getDefaultOutlet();
    } else {
      targetOutletId = userOutletId;
      if (!targetOutletId) {
        return res.status(403).json({ success: false, message: 'Outlet tidak dikenali. Akses ditolak.' });
      }
    }

    const [[existing]] = await poolWaschenPos.execute(
      `SELECT id, is_active FROM mst_service WHERE outlet_id = ? AND name = ? LIMIT 1`,
      [targetOutletId, name.trim()]
    );

    const categoryId = await getOrCreateCategory(category);
    const isActive = active !== undefined ? active : true;
    const isExpressEligible = expressEligible !== undefined ? expressEligible : true;
    const basePrice = Number(price);
    // Default: express harga ×2 dari normal (multiplier = 2.0).
    let expressMul = 2.0;
    let expressNominal = Math.round(basePrice * 1.0);
    if (expressExtra != null && expressExtra !== '') {
      expressNominal = Number(expressExtra);
      expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 2.0;
    }
    const minQ = minQty ? Number(minQty) : 1;
    // Default SLA: regular 48 jam, express setengah dari regular.
    const slaReg = slaRegular ? Number(slaRegular) : 48;
    const slaExp = slaExpress ? Number(slaExpress) : Math.max(1, Math.floor(slaReg / 2));

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
    // id BIGINT AUTO_INCREMENT — biarkan DB yang generate
    let newId;
    if (hasSlaColumns) {
      const [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO mst_service 
          (outlet_id, category_id, service_code, name, unit_type, price, min_qty, express_multiplier, is_express_eligible, sla_regular_hours, sla_express_hours, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [targetOutletId, categoryId, serviceCode, name.trim(), unit, basePrice, minQ, expressMul, isExpressEligible ? 1 : 0, slaReg, slaExp, isActive ? 1 : 0]
      );
      newId = insertResult.insertId;
    } else {
      const [insertResult] = await poolWaschenPos.execute(
        `INSERT INTO mst_service 
          (outlet_id, category_id, service_code, name, unit_type, price, min_qty, express_multiplier, is_express_eligible, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [targetOutletId, categoryId, serviceCode, name.trim(), unit, basePrice, minQ, expressMul, isExpressEligible ? 1 : 0, isActive ? 1 : 0]
      );
      newId = insertResult.insertId;
    }

    const newService = { id: newId, name: name.trim(), category, price: basePrice, unit, expressExtra: expressNominal, active: isActive, expressEligible: isExpressEligible, minQty: minQ, slaRegular: slaReg, slaExpress: slaExp };
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

    const [[service]] = await poolWaschenPos.execute("SELECT outlet_id FROM mst_service WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const globalRoles = ['admin', 'superadmin', 'finance', 'owner'];
    const isGlobalRole = globalRoles.includes(userRole);

    if (!isGlobalRole && service.outlet_id !== userOutletId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak berhak mengubah layanan dari outlet lain.' });
    }

    const categoryId = await getOrCreateCategory(category);
    const basePrice = Number(price);
    // Default: express harga ×2 dari normal (multiplier = 2.0).
    // Kalau user kirim expressExtra eksplisit, hitung multiplier dari nominal tsb.
    let expressMul = 2.0;
    let expressNominal = Math.round(basePrice * 1.0); // selisih harga express vs normal
    if (expressExtra != null && expressExtra !== '') {
      expressNominal = Number(expressExtra);
      expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 2.0;
    }
    const isActive = active !== undefined ? active : true;
    const isExpressEligible = expressEligible !== undefined ? expressEligible : true;
    const minQ = minQty ? Number(minQty) : 1;
    // Default SLA: regular 48 jam, express setengah dari regular (24 jam).
    // Kalau user kirim eksplisit, pakai itu.
    const slaReg = slaRegular ? Number(slaRegular) : 48;
    const slaExp = slaExpress ? Number(slaExpress) : Math.max(1, Math.floor(slaReg / 2));

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
    const deletedBy = req.user?.userId || null;

    const [[service]] = await poolWaschenPos.execute("SELECT outlet_id FROM mst_service WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobalRole = ['admin', 'superadmin', 'finance', 'owner'].includes(userRole);

    if (!isGlobalRole && service.outlet_id !== userOutletId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak berhak menghapus layanan ini.' });
    }

    try {
      await poolWaschenPos.execute(
        `UPDATE mst_service SET is_active = 0, deleted_at = NOW(), deleted_by = ?, updated_at = NOW() WHERE id = ?`,
        [deletedBy, id]
      );
    } catch (colErr) {
      // Fallback jika kolom deleted_by belum ada di tabel mst_service
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        await poolWaschenPos.execute(
          `UPDATE mst_service SET is_active = 0, deleted_at = NOW(), updated_at = NOW() WHERE id = ?`,
          [id]
        );
      } else {
        throw colErr;
      }
    }
    return res.status(200).json({ success: true, message: 'Layanan berhasil dihapus.' });
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

    const [[service]] = await poolWaschenPos.execute("SELECT outlet_id FROM mst_service WHERE id = ? AND deleted_at IS NULL", [id]);
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobalRole = ['admin', 'superadmin', 'finance', 'owner'].includes(userRole);

    if (!isGlobalRole && service.outlet_id !== userOutletId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak berhak mengubah layanan ini.' });
    }

    await poolWaschenPos.execute(`UPDATE mst_service SET is_active = ?, updated_at = NOW() WHERE id = ?`, [active ? 1 : 0, id]);
    return res.status(200).json({ success: true, message: 'Status layanan berhasil diubah' });
  } catch (err) {
    console.error('[toggleService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah status layanan.' });
  }
};

// ─── POST /api/services/:id/pin
export const togglePinService = async (req, res) => {
  try {
    const { id } = req.params; // service_id
    const { outletId, pinContext = 'priority', notes = '' } = req.body;
    const pinnedBy = req.user?.userId || 'system';
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobalRole = ['admin', 'superadmin', 'finance', 'owner'].includes(userRole);

    if (!outletId) {
      return res.status(400).json({ success: false, message: 'outletId wajib diisi' });
    }

    if (!isGlobalRole && outletId !== userOutletId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Tidak bisa menyematkan layanan outlet lain.' });
    }

    const [[service]] = await poolWaschenPos.execute(
      "SELECT outlet_id FROM mst_service WHERE id = ? AND deleted_at IS NULL",
      [id]
    );

    if (!service) {
      return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });
    }

    if (service.outlet_id !== outletId) {
      return res.status(400).json({ success: false, message: 'Outlet layanan tidak sesuai.' });
    }

    // Check if already pinned
    const [existing] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service_pin WHERE service_id = ? AND outlet_id = ?",
      [id, outletId]
    );

    if (existing.length > 0) {
      // Unpin
      await poolWaschenPos.execute(
        "DELETE FROM mst_service_pin WHERE service_id = ? AND outlet_id = ?",
        [id, outletId]
      );
      return res.json({ success: true, pinned: false, message: 'Layanan berhasil dilepas sematan.' });
    } else {
      // Pin — id AUTO_INCREMENT, biarkan DB yang generate
      await poolWaschenPos.execute(
        "INSERT INTO mst_service_pin (service_id, outlet_id, pin_context, notes, pinned_by) VALUES (?, ?, ?, ?, ?)",
        [id, outletId, pinContext, notes, pinnedBy]
      );
      return res.json({ success: true, pinned: true, message: 'Layanan berhasil disematkan.' });
    }
  } catch (err) {
    console.error('[togglePinService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah status sematan layanan.' });
  }
};

// ─── POST /api/services/:id/favorite
export const toggleFavoriteService = async (req, res) => {
  try {
    const { id } = req.params; // service_id
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId wajib diisi' });
    }

    const [[service]] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service WHERE id = ?",
      [id]
    );

    if (!service) {
      return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });
    }

    const [existing] = await poolWaschenPos.execute(
      "SELECT 1 FROM mst_customer_service_favorite WHERE service_id = ? AND customer_id = ?",
      [id, customerId]
    );

    if (existing.length > 0) {
      // Unfavorite
      await poolWaschenPos.execute(
        "DELETE FROM mst_customer_service_favorite WHERE service_id = ? AND customer_id = ?",
        [id, customerId]
      );
      return res.json({ success: true, favorite: false, message: 'Layanan dihapus dari favorit.' });
    } else {
      // Favorite
      await poolWaschenPos.execute(
        "INSERT INTO mst_customer_service_favorite (customer_id, service_id, usage_count, is_manual_pin) VALUES (?, ?, 1, 1)",
        [customerId, id]
      );
      return res.json({ success: true, favorite: true, message: 'Layanan ditambahkan ke favorit.' });
    }
  } catch (err) {
    console.error('[toggleFavoriteService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah status favorit layanan.' });
  }
};
