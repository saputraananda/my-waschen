import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';
import { writeAudit } from '../utils/auditLog.js';

const canManagePromo = (role) => ['admin', 'finance', 'superadmin', 'owner'].includes(role);

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
        p.is_global AS isGlobal, p.is_active AS isActive
      FROM mst_promo p
      LEFT JOIN mst_promo_outlet po ON po.promo_id = p.id AND po.is_active = 1
      WHERE 1=1
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
      })),
    });
  } catch (err) {
    console.error('[getPromos]', err);
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
    } = req.body;

    if (!code || !name || !type || value == null || !validFrom || !validUntil) {
      return res.status(400).json({ success: false, message: 'code, name, type, value, validFrom, validUntil wajib.' });
    }
    if (!['percent', 'fixed'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type harus percent atau fixed.' });
    }

    const id = randomUUID();
    const userId = req.user?.userId;

    await poolWaschenPos.execute(
      `INSERT INTO mst_promo (
        id, code, name, type, value, min_trx_amount, max_discount, valid_from, valid_until,
        is_global, is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
      [
        id,
        String(code).trim(),
        String(name).trim(),
        type,
        Number(value),
        minTrxAmount != null ? Number(minTrxAmount) : null,
        maxDiscount != null ? Number(maxDiscount) : null,
        validFrom,
        validUntil,
        isGlobal ? 1 : 0,
        userId,
      ]
    );

    if (!isGlobal && Array.isArray(outletIds) && outletIds.length > 0) {
      for (const oid of outletIds) {
        await poolWaschenPos.execute(
          'INSERT INTO mst_promo_outlet (promo_id, outlet_id, is_active, created_at) VALUES (?, ?, 1, NOW())',
          [id, oid]
        );
      }
    }

    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'promo',
      entityId: id,
      action: 'create_promo',
      newData: { code, name, type, value, validFrom, validUntil, isGlobal, outletIds },
      req,
    });

    return res.status(201).json({ success: true, message: 'Promo dibuat.', data: { id } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Kode promo sudah dipakai.' });
    }
    console.error('[createPromo]', err);
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
      'SELECT id, code, name, is_active AS isActive FROM mst_promo WHERE id = ?',
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
    console.error('[patchPromo]', err);
    return res.status(500).json({ success: false, message: 'Gagal update promo.' });
  }
};
