import { poolWaschenPos } from '../db/connection.js';
import { softDeleteRecord } from '../utils/softDelete.js';
import logger from '../utils/logger.js';

// ─── Helpers ─────────────────────────────────────────────────────────

const getOrCreateCategory = async (categoryName) => {
  const name = String(categoryName || 'Umum').trim();
  const code = name.toUpperCase().substring(0, 20).replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') || 'UMUM';

  const [byCode] = await poolWaschenPos.execute(
    "SELECT id FROM mst_service_category WHERE code = ? LIMIT 1", [code]
  );
  if (byCode.length > 0) return byCode[0].id;

  const [byName] = await poolWaschenPos.execute(
    "SELECT id FROM mst_service_category WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1", [name]
  );
  if (byName.length > 0) return byName[0].id;

  await poolWaschenPos.execute(
    "INSERT IGNORE INTO mst_service_category (code, name, is_active) VALUES (?, ?, 1)", [code, name]
  );
  const [final] = await poolWaschenPos.execute(
    "SELECT id FROM mst_service_category WHERE code = ? LIMIT 1", [code]
  );
  if (final.length > 0) return final[0].id;
  throw new Error(`Gagal mendapatkan kategori untuk "${name}"`);
};

const generateServiceCode = async () => {
  const [rows] = await poolWaschenPos.execute("SELECT COUNT(*) as cnt FROM mst_service");
  return `SVC-${String(rows[0].cnt + 1).padStart(4, '0')}`;
};

const hasSlaColumns = async () => {
  try {
    const [rows] = await poolWaschenPos.execute(
      "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mst_service' AND COLUMN_NAME = 'sla_regular_hours'"
    );
    return rows[0]?.cnt > 0;
  } catch { return false; }
};

const safeId = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : String(v);
  }
  return v;
};

// ─── GET /api/services ────────────────────────────────────────────────
export const getServices = async (req, res) => {
  try {
    const userOutletId = req.user?.outletId;
    const queryOutletId = req.query?.outletId;
    const customerId = req.query?.customerId;
    const userRole = req.user?.roleCode;
    const sort = req.query?.sort; // 'popular' | 'alphabetical' (default)
    const serviceKind = req.query?.serviceKind; // 'waschen' | 'cleanox'

    const globalRoles = ['admin'];
    const isGlobalRole = globalRoles.includes(userRole) ||
                         globalRoles.includes(req.user?.originalRoleCode);

    // Determine target outlet
    let targetOutletId = null;
    if (queryOutletId) {
      if (!isGlobalRole) {
        if (!userOutletId) return res.status(403).json({ success: false, message: 'Outlet tidak dikenali.' });
        if (String(queryOutletId) !== String(userOutletId))
          return res.status(403).json({ success: false, message: 'Akses ditolak.' });
      }
      targetOutletId = queryOutletId;
    } else if (!isGlobalRole) {
      if (!userOutletId) return res.status(403).json({ success: false, message: 'Outlet tidak dikenali.' });
      targetOutletId = userOutletId;
    }

    // Build service_kind filter
    let kindFilter = '';
    const kindParams = [];
    if (serviceKind && ['waschen', 'cleanox'].includes(serviceKind)) {
      kindFilter = ' AND s.service_kind = ?';
      kindParams.push(serviceKind);
    }

    // Popular count subquery
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

    // Pin join via tr_outlet_service
    let pinSelect = 'NULL AS pin_context';
    let pinJoin = '';
    if (targetOutletId) {
      pinSelect = 'os.pin_context';
      pinJoin = 'LEFT JOIN tr_outlet_service os ON os.service_id = s.id AND os.outlet_id = ?';
    }

    // Favorite join
    let favJoin = '';
    let favSelect = '0 AS usage_count';
    const favParams = [];
    if (customerId) {
      favJoin = 'LEFT JOIN mst_customer_service_favorite fav ON fav.service_id = s.id AND fav.customer_id = ?';
      favSelect = 'COALESCE(fav.usage_count, 0) AS usage_count';
      favParams.push(customerId);
    }

    // Build params array
    const params = [];
    if (targetOutletId) params.push(targetOutletId);
    if (targetOutletId) params.push(targetOutletId); // for popularJoin
    const finalParams = [...favParams, ...params, ...kindParams];

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
        s.service_kind AS serviceKind,
        ${pinSelect},
        ${favSelect},
        ${popularSelect},
        s.durasi_hari AS durationDays,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt
      FROM mst_service s
      JOIN mst_service_category c ON c.id = s.category_id
      ${pinJoin}
      ${popularJoin}
      ${favJoin}
      WHERE s.is_active = 1 AND s.deleted_at IS NULL ${kindFilter}
      ORDER BY c.sort_order, c.name, s.name`,
      finalParams
    );

    const fixedRows = rows.map(row => ({
      ...row,
      id: safeId(row.id),
      requiresMaterial: row.requiresMaterial ? 1 : 0,
    }));

    // Sort: popular
    let sortedRows = fixedRows;
    if (sort === 'popular' && targetOutletId) {
      const pinned = fixedRows.filter(s => s.pin_context);
      const pinnedIds = new Set(pinned.map(s => s.id));
      const popular = fixedRows
        .filter(s => !pinnedIds.has(s.id) && Number(s.popular_count) > 0)
        .sort((a, b) => Number(b.popular_count) - Number(a.popular_count));
      const popularIds = new Set(popular.map(s => s.id));
      const favorites = fixedRows
        .filter(s => !pinnedIds.has(s.id) && !popularIds.has(s.id) && Number(s.usage_count) > 0)
        .sort((a, b) => Number(b.usage_count) - Number(a.usage_count));
      const favIds = new Set(favorites.map(s => s.id));
      const others = fixedRows
        .filter(s => !pinnedIds.has(s.id) && !popularIds.has(s.id) && !favIds.has(s.id))
        .sort((a, b) => {
          const catCmp = (a.category || '').localeCompare(b.category || '', 'id');
          return catCmp !== 0 ? catCmp : (a.name || '').localeCompare(b.name || '', 'id');
        });
      sortedRows = [...pinned, ...popular, ...favorites, ...others];
    }

    return res.status(200).json({ success: true, data: sortedRows });
  } catch (err) {
    logger.error('Gagal memuat data layanan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data layanan.' });
  }
};

// ─── POST /api/services ────────────────────────────────────────────────
export const createService = async (req, res) => {
  try {
    const { name, category, price, unit, expressExtra, active, expressEligible, minQty, slaRegular, slaExpress, durasiHari, serviceKind } = req.body;

    if (!name || !price || !unit) {
      return res.status(400).json({ success: false, message: 'Nama, harga, dan satuan wajib diisi' });
    }

    const kind = serviceKind || 'waschen';
    const categoryId = await getOrCreateCategory(category);
    const isActive = active !== undefined ? active : true;
    const isExpressEligible = expressEligible !== undefined ? expressEligible : true;
    const basePrice = Number(price);

    let expressMul = 2.0;
    let expressNominal = Math.round(basePrice * 1.0);
    if (expressExtra != null && expressExtra !== '') {
      expressNominal = Number(expressExtra);
      expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 2.0;
    }
    const minQ = minQty ? Number(minQty) : 1;
    const slaReg = slaRegular ? Number(slaRegular) : 48;
    const slaExp = slaExpress ? Number(slaExpress) : Math.max(1, Math.floor(slaReg / 2));
    const durasi = durasiHari ? Number(durasiHari) : 2;

    // Check duplicate by (service_kind, name)
    const [[existing]] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service WHERE service_kind = ? AND name = ? LIMIT 1",
      [kind, name.trim()]
    );
    if (existing) {
      if (existing.is_active === 1) {
        return res.status(400).json({ success: false, message: 'Layanan dengan nama yang sama sudah ada.' });
      }
      // Reactivate soft-deleted service
      const hasSla = await hasSlaColumns();
      if (hasSla) {
        await poolWaschenPos.execute(
          `UPDATE mst_service SET category_id=?, unit_type=?, price=?, express_multiplier=?,
           is_express_eligible=?, min_qty=?, sla_regular_hours=?, sla_express_hours=?,
           durasi_hari=?, is_active=1, deleted_at=NULL, updated_at=NOW() WHERE id=?`,
          [categoryId, unit, basePrice, expressMul, isExpressEligible?1:0, minQ, slaReg, slaExp, durasi, existing.id]
        );
      } else {
        await poolWaschenPos.execute(
          `UPDATE mst_service SET category_id=?, unit_type=?, price=?, express_multiplier=?,
           is_express_eligible=?, min_qty=?, durasi_hari=?, is_active=1, deleted_at=NULL,
           updated_at=NOW() WHERE id=?`,
          [categoryId, unit, basePrice, expressMul, isExpressEligible?1:0, minQ, durasi, existing.id]
        );
      }
      // Also seed tr_outlet_service for all active outlets
      await poolWaschenPos.execute(
        `INSERT IGNORE INTO tr_outlet_service (outlet_id, service_id, sort_order_override)
         SELECT o.id, ?, s.sort_order
         FROM mst_outlet o
         JOIN (SELECT sort_order FROM mst_service WHERE id=?) s WHERE s.is_active=1`,
        [existing.id, existing.id]
      );
      return res.status(201).json({ success: true, message: 'Layanan berhasil diaktifkan kembali.', data: { id: existing.id, name: name.trim() } });
    }

    const serviceCode = await generateServiceCode();
    let newId;
    const hasSla = await hasSlaColumns();
    if (hasSla) {
      const [result] = await poolWaschenPos.execute(
        `INSERT INTO mst_service (category_id, service_code, name, unit_type, price, min_qty,
         express_multiplier, is_express_eligible, sla_regular_hours, sla_express_hours,
         durasi_hari, is_active, service_kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [categoryId, serviceCode, name.trim(), unit, basePrice, minQ, expressMul,
         isExpressEligible ? 1 : 0, slaReg, slaExp, durasi, isActive ? 1 : 0, kind]
      );
      newId = result.insertId;
    } else {
      const [result] = await poolWaschenPos.execute(
        `INSERT INTO mst_service (category_id, service_code, name, unit_type, price, min_qty,
         express_multiplier, is_express_eligible, durasi_hari, is_active, service_kind, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [categoryId, serviceCode, name.trim(), unit, basePrice, minQ, expressMul,
         isExpressEligible ? 1 : 0, durasi, isActive ? 1 : 0, kind]
      );
      newId = result.insertId;
    }

    // Seed tr_outlet_service for all active outlets
    await poolWaschenPos.execute(
      `INSERT IGNORE INTO tr_outlet_service (outlet_id, service_id, sort_order_override)
       SELECT o.id, ?, 0
       FROM mst_outlet o WHERE o.is_active = 1`,
      [newId]
    );

    return res.status(201).json({
      success: true,
      message: 'Layanan berhasil ditambahkan',
      data: { id: newId, name: name.trim(), price: basePrice, unit, kind }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Layanan dengan nama tersebut sudah ada.' });
    }
    logger.error('Gagal menambahkan layanan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menambahkan layanan.' });
  }
};

// ─── PUT /api/services/:id ────────────────────────────────────────────
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, unit, expressExtra, active, expressEligible, minQty, slaRegular, slaExpress } = req.body;

    if (!name || !price || !unit) {
      return res.status(400).json({ success: false, message: 'Nama, harga, dan satuan wajib diisi' });
    }

    const [[service]] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service WHERE id = ? AND deleted_at IS NULL", [id]
    );
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    const categoryId = await getOrCreateCategory(category);
    const basePrice = Number(price);
    let expressMul = 2.0;
    let expressNominal = Math.round(basePrice * 1.0);
    if (expressExtra != null && expressExtra !== '') {
      expressNominal = Number(expressExtra);
      expressMul = basePrice > 0 ? 1 + (expressNominal / basePrice) : 2.0;
    }
    const isActive = active !== undefined ? active : true;
    const isExpressEligible = expressEligible !== undefined ? expressEligible : true;
    const minQ = minQty ? Number(minQty) : 1;
    const slaReg = slaRegular ? Number(slaRegular) : 48;
    const slaExp = slaExpress ? Number(slaExpress) : Math.max(1, Math.floor(slaReg / 2));

    const hasSla = await hasSlaColumns();
    if (hasSla) {
      await poolWaschenPos.execute(
        `UPDATE mst_service SET name=?, category_id=?, unit_type=?, price=?, express_multiplier=?,
         is_express_eligible=?, min_qty=?, sla_regular_hours=?, sla_express_hours=?,
         is_active=?, updated_at=NOW() WHERE id=?`,
        [name.trim(), categoryId, unit, basePrice, expressMul, isExpressEligible?1:0, minQ,
         slaReg, slaExp, isActive?1:0, id]
      );
    } else {
      await poolWaschenPos.execute(
        `UPDATE mst_service SET name=?, category_id=?, unit_type=?, price=?, express_multiplier=?,
         is_express_eligible=?, min_qty=?, is_active=?, updated_at=NOW() WHERE id=?`,
        [name.trim(), categoryId, unit, basePrice, expressMul, isExpressEligible?1:0, minQ, isActive?1:0, id]
      );
    }

    return res.status(200).json({ success: true, message: 'Layanan berhasil diupdate' });
  } catch (err) {
    logger.error('Gagal mengupdate layanan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengupdate layanan.' });
  }
};

// ─── DELETE /api/services/:id ─────────────────────────────────────────
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBy = req.user?.userId || null;

    const [[service]] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service WHERE id = ? AND deleted_at IS NULL", [id]
    );
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    await softDeleteRecord('mst_service', id, deletedBy);
    return res.status(200).json({ success: true, message: 'Layanan berhasil dihapus.' });
  } catch (err) {
    logger.error('Gagal menghapus layanan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal menghapus layanan.' });
  }
};

// ─── PATCH /api/services/:id/toggle ───────────────────────────────────
export const toggleService = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const [[service]] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service WHERE id = ? AND deleted_at IS NULL", [id]
    );
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    await poolWaschenPos.execute(
      "UPDATE mst_service SET is_active = ?, updated_at = NOW() WHERE id = ?",
      [active ? 1 : 0, id]
    );
    return res.status(200).json({ success: true, message: 'Status layanan berhasil diubah' });
  } catch (err) {
    logger.error('Gagal mengubah status layanan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengubah status layanan.' });
  }
};

// ─── POST /api/services/:id/pin ────────────────────────────────────────
export const togglePinService = async (req, res) => {
  try {
    const { id } = req.params; // service_id (global)
    const { outletId, pinContext = 'priority', notes = '' } = req.body;
    const pinnedBy = req.user?.userId || 'system';
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobalRole = ['admin'].includes(userRole);

    if (!outletId) {
      return res.status(400).json({ success: false, message: 'outletId wajib diisi' });
    }
    if (!isGlobalRole && String(outletId) !== String(userOutletId)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak.' });
    }

    // Verify service exists
    const [[service]] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service WHERE id = ? AND deleted_at IS NULL", [id]
    );
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    // Check existing pin in tr_outlet_service
    const [existing] = await poolWaschenPos.execute(
      "SELECT id, pin_context FROM tr_outlet_service WHERE service_id = ? AND outlet_id = ?",
      [id, outletId]
    );

    if (existing.length > 0 && existing[0].pin_context === pinContext) {
      // Unpin: clear pin_context
      await poolWaschenPos.execute(
        "UPDATE tr_outlet_service SET pin_context=NULL, notes=NULL, pinned_by=NULL, updated_at=NOW() WHERE service_id=? AND outlet_id=?",
        [id, outletId]
      );
      return res.json({ success: true, pinned: false, message: 'Layanan berhasil dilepas sematan.' });
    } else {
      // Pin: update or insert
      await poolWaschenPos.execute(
        `INSERT INTO tr_outlet_service (outlet_id, service_id, pin_context, notes, pinned_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE pin_context=VALUES(pin_context), notes=VALUES(notes),
         pinned_by=VALUES(pinned_by), updated_at=NOW()`,
        [outletId, id, pinContext, notes, pinnedBy]
      );
      return res.json({ success: true, pinned: true, message: 'Layanan berhasil disematkan.' });
    }
  } catch (err) {
    logger.error('Gagal mengubah status sematan layanan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengubah status sematan layanan.' });
  }
};

// ─── POST /api/services/:id/favorite ───────────────────────────────────
export const toggleFavoriteService = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId wajib diisi' });
    }

    const [[service]] = await poolWaschenPos.execute(
      "SELECT id FROM mst_service WHERE id = ?", [id]
    );
    if (!service) return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });

    const [existing] = await poolWaschenPos.execute(
      "SELECT 1 FROM mst_customer_service_favorite WHERE service_id = ? AND customer_id = ?",
      [id, customerId]
    );

    if (existing.length > 0) {
      await poolWaschenPos.execute(
        "DELETE FROM mst_customer_service_favorite WHERE service_id = ? AND customer_id = ?",
        [id, customerId]
      );
      return res.json({ success: true, favorite: false, message: 'Layanan dihapus dari favorit.' });
    } else {
      await poolWaschenPos.execute(
        "INSERT INTO mst_customer_service_favorite (customer_id, service_id, usage_count, is_manual_pin) VALUES (?, ?, 1, 1)",
        [customerId, id]
      );
      return res.json({ success: true, favorite: true, message: 'Layanan ditambahkan ke favorit.' });
    }
  } catch (err) {
    logger.error('Gagal mengubah status favorit layanan', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengubah favorit layanan.' });
  }
};
