// ─────────────────────────────────────────────────────────────────────────────
// Settings Controller — admin-managed key-value config
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { cache } from '../utils/cache.js';

const ADMIN_ROLES = ['admin', 'superadmin', 'owner'];
const isAdmin = (role) => ADMIN_ROLES.includes(role);

// In-memory cache untuk hot read (tiap pengeluaran cek kas_minimum_balance)
const SETTING_CACHE_TTL = 60_000;
const cacheKey = (k) => `setting:${k}`;

// ─── Public helper: dipakai controller lain untuk baca setting cepat ───────
export async function getSettingValue(key, fallback = null) {
  const cached = await cache.get(cacheKey(key));
  if (cached !== null && cached !== undefined) return cached;

  const [rows] = await poolWaschenPos.execute(
    `SELECT setting_value, data_type FROM mst_setting WHERE setting_key = ? LIMIT 1`,
    [key]
  );
  if (!rows.length) return fallback;

  const raw = rows[0].setting_value;
  const t = rows[0].data_type;
  let value;
  if (t === 'number') value = Number(raw);
  else if (t === 'boolean') value = raw === 'true' || raw === '1';
  else if (t === 'json') {
    try { value = JSON.parse(raw); } catch { value = fallback; }
  } else value = raw;

  await cache.set(cacheKey(key), value, SETTING_CACHE_TTL);
  return value;
}

// ─── GET /api/settings — list semua (admin) ────────────────────────────────
export const getSettings = async (req, res) => {
  try {
    if (!isAdmin(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Hanya admin.' });
    }
    const category = req.query.category || null;
    const params = [];
    let where = '1=1';
    if (category) { where += ' AND category = ?'; params.push(category); }

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, setting_key AS settingKey, setting_value AS settingValue,
              data_type AS dataType, description, category,
              updated_by AS updatedBy, updated_at AS updatedAt
         FROM mst_setting WHERE ${where}
        ORDER BY category, setting_key`,
      params
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getSettings]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat settings.' });
  }
};

// ─── GET /api/settings/:key — single by key (admin) ────────────────────────
export const getSettingByKey = async (req, res) => {
  try {
    if (!isAdmin(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Hanya admin.' });
    }
    const { key } = req.params;
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, setting_key AS settingKey, setting_value AS settingValue,
              data_type AS dataType, description, category, updated_at AS updatedAt
         FROM mst_setting WHERE setting_key = ? LIMIT 1`,
      [key]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Setting tidak ditemukan.' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getSettingByKey]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat setting.' });
  }
};

// ─── PATCH /api/settings/:key — update value (admin) ───────────────────────
export const updateSetting = async (req, res) => {
  try {
    if (!isAdmin(req.user?.roleCode)) {
      return res.status(403).json({ success: false, message: 'Hanya admin yang bisa ubah settings.' });
    }
    const { key } = req.params;
    const { value } = req.body || {};
    const userId = req.user?.userId;

    if (value === undefined || value === null) {
      return res.status(400).json({ success: false, message: 'value wajib diisi.' });
    }

    const [existing] = await poolWaschenPos.execute(
      `SELECT id, setting_value, data_type FROM mst_setting WHERE setting_key = ? LIMIT 1`,
      [key]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Setting tidak ditemukan.' });
    }
    const cur = existing[0];
    const newValueStr = String(value).trim();

    // Validasi by type
    if (cur.data_type === 'number') {
      const n = Number(newValueStr);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ success: false, message: 'Nilai harus angka >= 0.' });
      }
    } else if (cur.data_type === 'boolean') {
      if (!['true', 'false', '0', '1'].includes(newValueStr.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Nilai harus true/false.' });
      }
    } else if (cur.data_type === 'json') {
      try { JSON.parse(newValueStr); } catch {
        return res.status(400).json({ success: false, message: 'Nilai harus JSON valid.' });
      }
    }

    await poolWaschenPos.execute(
      `UPDATE mst_setting
          SET setting_value = ?, updated_by = ?, updated_at = NOW()
        WHERE setting_key = ?`,
      [newValueStr, userId, key]
    );

    // Bust cache supaya read berikutnya pakai value baru
    await cache.del(cacheKey(key));

    await writeAudit(poolWaschenPos, {
      userId,
      entityType: 'setting',
      action: 'update',
      oldData: { settingKey: key, value: cur.setting_value },
      newData: { settingKey: key, value: newValueStr },
      req,
    });

    return res.json({ success: true, data: { settingKey: key, settingValue: newValueStr } });
  } catch (err) {
    console.error('[updateSetting]', err);
    return res.status(500).json({ success: false, message: 'Gagal update setting.' });
  }
};
