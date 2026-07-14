import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import logger from '../utils/logger.js';

const canManagePromo = (role) => role === 'admin';

// ─── Safe JSON parser ──────────────────────────────────────────────────────────
const parseJsonField = (val) => {
  if (!val) return null;
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch {
    // Plain string like "KARPET" — wrap in array
    return [val];
  }
};

// ─── GET /api/promos — promo aktif (opsional filter outlet) ───────────────────
export const getPromos = async (req, res) => {
  try {
    const { outletId, includeInactive } = req.query;
    const userOutlet = req.user?.outletId;
    const role = req.user?.roleCode;
    const effOutlet = outletId || userOutlet;

    let sql = `
      SELECT DISTINCT
        p.id, p.code, p.name, p.type, p.value, p.min_trx_amount AS minTrxAmount,
        p.max_discount AS maxDiscount, p.valid_from AS validFrom, p.valid_until AS validUntil,
        p.is_global AS isGlobal, p.is_active AS isActive,
        p.applicable_type AS applicableType, p.applicable_services AS applicableServices,
        p.applicable_categories AS applicableCategories, p.promo_type AS promoType
      FROM mst_promo p
      LEFT JOIN mst_promo_outlet po ON po.promo_id = p.id AND po.is_active = 1
      WHERE p.deleted_at IS NULL
    `;
    const params = [];

    const showAllAdmin = includeInactive === '1' && canManagePromo(role);
    if (!showAllAdmin) {
      sql += ' AND p.is_active = 1 AND p.valid_until >= NOW() AND p.valid_from <= NOW()';
    }

    if (effOutlet) {
      sql += ' AND (p.is_global = 1 OR po.outlet_id = ?)';
      params.push(effOutlet);
    }

    sql += ' ORDER BY p.valid_until DESC, p.name';

    const [rows] = await poolWaschenPos.execute(sql, params);

    return res.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        value: Number(r.value),
        minTrxAmount: r.minTrxAmount != null ? Number(r.minTrxAmount) : null,
        maxDiscount: r.maxDiscount != null ? Number(r.maxDiscount) : null,
        isGlobal: !!r.isGlobal,
        isActive: !!r.isActive,
        applicableServices: parseJsonField(r.applicableServices),
        applicableCategories: parseJsonField(r.applicableCategories),
      })),
    });
  } catch (err) {
    logger.error('Gagal memuat promo', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Gagal memuat promo.' });
  }
};

// ─── GET /api/promos/auto-applicable — promos auto-apply berdasarkan layanan ─────
// Digunakan di NotaStep3 untuk auto-detect promo yang applicable
export const getAutoApplicablePromos = async (req, res) => {
  try {
    const userOutlet = req.user?.outletId;
    const { serviceIds, customerId } = req.query;

    // Parse service IDs
    const serviceIdList = serviceIds ? serviceIds.split(',').map(Number).filter(Boolean) : [];

    // Get today's date info for birthday check
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth() + 1;

    // Get customer birthday info if customerId provided
    let customerBirthday = false;
    if (customerId) {
      const [custRows] = await poolWaschenPos.execute(
        `SELECT birth_day, birth_month FROM mst_customer WHERE id = ? AND is_active = 1 AND deleted_at IS NULL`,
        [customerId]
      );
      if (custRows.length > 0) {
        const c = custRows[0];
        customerBirthday = c.birth_day === todayDay && c.birth_month === todayMonth;
      }
    }

    // Get applicable promos
    let sql = `
      SELECT DISTINCT
        p.id, p.code, p.name, p.type, p.value, p.min_trx_amount AS minTrxAmount,
        p.max_discount AS maxDiscount, p.valid_from AS validFrom, p.valid_until AS validUntil,
        p.is_global AS isGlobal, p.applicable_type AS applicableType,
        p.applicable_services AS applicableServices,
        p.applicable_categories AS applicableCategories,
        p.promo_type AS promoType
      FROM mst_promo p
      LEFT JOIN mst_promo_outlet po ON po.promo_id = p.id AND po.is_active = 1
      WHERE p.deleted_at IS NULL
        AND p.is_active = 1
        AND p.valid_until >= NOW()
        AND p.valid_from <= NOW()
    `;
    const params = [];

    if (userOutlet) {
      sql += ' AND (p.is_global = 1 OR po.outlet_id = ?)';
      params.push(userOutlet);
    }

    const [rows] = await poolWaschenPos.execute(sql, params);

    // Pre-fetch service categories for category-based matching
    let serviceCategoryMap = new Map(); // serviceId -> categoryCode
    if (serviceIdList.length > 0) {
      const serviceIdPlaceholders = serviceIdList.map(() => '?').join(',');
      const [categoryRows] = await poolWaschenPos.execute(
        `SELECT s.id, sc.code AS category_code
         FROM mst_service s
         JOIN mst_service_category sc ON sc.id = s.category_id
         WHERE s.id IN (${serviceIdPlaceholders})`,
        serviceIdList
      );
      categoryRows.forEach((r) => {
        serviceCategoryMap.set(r.id, r.category_code);
      });
    }

    // Parse and filter applicable promos
    const applicablePromos = rows
      .map((r) => {
        const applicableServices = parseJsonField(r.applicableServices);
        const applicableCategories = parseJsonField(r.applicableCategories);

        return {
          id: r.id,
          code: r.code,
          name: r.name,
          type: r.type,
          value: Number(r.value),
          minTrxAmount: r.minTrxAmount != null ? Number(r.minTrxAmount) : null,
          maxDiscount: r.maxDiscount != null ? Number(r.maxDiscount) : null,
          validFrom: r.validFrom,
          validUntil: r.validUntil,
          isGlobal: !!r.isGlobal,
          applicableType: r.applicableType || 'all',
          applicableServices,
          applicableCategories,
          promoType: r.promoType || 'general',
        };
      })
      .filter((promo) => {
        // Birthday promo: only if customer has birthday today
        if (promo.promoType === 'birthday') {
          return customerBirthday;
        }

        // All promos (general, campaign, loyalty): apply based on applicable type
        if (promo.applicableType === 'all') {
          return true;
        }

        // Category-based promo: check if any service belongs to applicable categories
        if (promo.applicableType === 'category' && promo.applicableCategories && serviceIdList.length > 0) {
          for (const sid of serviceIdList) {
            const catCode = serviceCategoryMap.get(sid);
            if (catCode && promo.applicableCategories.includes(catCode)) {
              return true;
            }
          }
          return false;
        }

        // Service-based promo: check if any service ID matches
        if (promo.applicableType === 'service' && promo.applicableServices && serviceIdList.length > 0) {
          return serviceIdList.some((sid) => promo.applicableServices.includes(sid));
        }

        return false;
      })
      // Sort by priority: birthday > campaign > loyalty > general
      .sort((a, b) => {
        const priority = { birthday: 0, campaign: 1, loyalty: 2, general: 3 };
        return (priority[a.promoType] || 3) - (priority[b.promoType] || 3);
      });

    return res.json({
      success: true,
      data: applicablePromos,
      meta: {
        customerBirthday,
        serviceCount: serviceIdList.length,
        applicableCount: applicablePromos.length,
      },
    });
  } catch (err) {
    logger.error('Gagal memuat auto-applicable promos', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat promo.' });
  }
};

// ─── POST /api/promos — buat promo (admin/finance) ───────────────────────────
export const createPromo = async (req, res) => {
  try {
    const role = req.user?.roleCode;
    if (!canManagePromo(role)) {
      return res.status(403).json({ success: false, message: 'Hanya admin/finance.' });
    }

    const {
      code, name, type, value, minTrxAmount, maxDiscount,
      validFrom, validUntil, isGlobal, outletIds,
      promoType, applicableType, applicableServices, applicableCategories,
    } = req.body;

    if (!code || !name || !type || value == null || !validFrom || !validUntil) {
      return res.status(400).json({ success: false, message: 'code, name, type, value, validFrom, validUntil wajib.' });
    }
    if (!['percent', 'fixed'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type harus percent atau fixed.' });
    }

    const userId = req.user?.userId;

    // Serialize JSON fields
    const applicableServicesJson = applicableServices && Array.isArray(applicableServices)
      ? JSON.stringify(applicableServices) : null;
    const applicableCategoriesJson = applicableCategories && Array.isArray(applicableCategories)
      ? JSON.stringify(applicableCategories) : null;

    // id AUTO_INCREMENT — biarkan DB yang generate
    const [insertResult] = await poolWaschenPos.execute(
      `INSERT INTO mst_promo (
        code, name, type, value, min_trx_amount, max_discount, valid_from, valid_until,
        is_global, is_active, promo_type, applicable_type, applicable_services, applicable_categories,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        String(code).trim(),
        String(name).trim(),
        type,
        Number(value),
        minTrxAmount != null ? Number(minTrxAmount) : null,
        maxDiscount != null ? Number(maxDiscount) : null,
        validFrom,
        validUntil,
        isGlobal ? 1 : 0,
        promoType || 'general',
        applicableType || 'all',
        applicableServicesJson,
        applicableCategoriesJson,
        userId,
      ]
    );
    const newPromoId = insertResult.insertId;

    if (!isGlobal && Array.isArray(outletIds) && outletIds.length > 0) {
      for (const oid of outletIds) {
        await poolWaschenPos.execute(
          'INSERT INTO mst_promo_outlet (promo_id, outlet_id, is_active, created_at) VALUES (?, ?, 1, NOW())',
          [newPromoId, oid]
        );
      }
    }

    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'promo',
      entityId: newPromoId,
      action: 'create_promo',
      newData: { code, name, type, value, validFrom, validUntil, isGlobal, outletIds },
      req,
    });

    return res.status(201).json({ success: true, message: 'Promo dibuat.', data: { id: newPromoId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Kode promo sudah dipakai.' });
    }
    logger.error('Gagal membuat promo', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal membuat promo.' });
  }
};

// ─── PATCH /api/promos/:id — aktif/nonaktif ───────────────────────────────────
export const patchPromo = async (req, res) => {
  try {
    const role = req.user?.roleCode;
    if (!canManagePromo(role)) {
      return res.status(403).json({ success: false, message: 'Hanya admin/finance.' });
    }
    const { id } = req.params;
    const { isActive } = req.body;
    const userId = req.user?.userId;
    if (isActive === undefined) {
      return res.status(400).json({ success: false, message: 'isActive wajib.' });
    }

    const [[prev]] = await poolWaschenPos.execute(
      'SELECT id, code, name, is_active AS isActive FROM mst_promo WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!prev) return res.status(404).json({ success: false, message: 'Promo tidak ditemukan.' });

    const [r] = await poolWaschenPos.execute('UPDATE mst_promo SET is_active = ?, updated_at = NOW() WHERE id = ?', [isActive ? 1 : 0, id]);
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: 'Promo tidak ditemukan.' });

    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'promo',
      entityId: id,
      action: 'patch_promo',
      oldData: prev,
      newData: { isActive: !!isActive },
      req,
    });

    return res.json({ success: true, message: 'Promo diperbarui.' });
  } catch (err) {
    logger.error('Gagal update promo', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal update promo.' });
  }
};
