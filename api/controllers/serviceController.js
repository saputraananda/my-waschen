import { poolWaschenPos } from '../db/connection.js';
import { randomUUID } from 'crypto';

// ─── Controller: GET /api/services ───────────────────────────────────────────
export const getServices = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        id,
        service_name AS name,
        category,
        price,
        unit,
        express_extra AS expressExtra,
        is_active AS active,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM mst_service 
      ORDER BY category, service_name`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getServices] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data layanan.' });
  }
};

// ─── Controller: POST /api/services ───────────────────────────────────────────
export const createService = async (req, res) => {
  try {
    const { name, category, price, unit, expressExtra, active } = req.body;

    // Validasi required fields
    if (!name || !category || !price || !unit) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nama, kategori, harga, dan satuan wajib diisi' 
      });
    }

    const id = randomUUID();
    const isActive = active !== undefined ? active : true;
    const expressVal = expressExtra || null;

    await poolWaschenPos.execute(
      `INSERT INTO mst_service 
        (id, service_name, category, price, unit, express_extra, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, name.trim(), category, Number(price), unit, expressVal, isActive ? 1 : 0]
    );

    const newService = {
      id,
      name: name.trim(),
      category,
      price: Number(price),
      unit,
      expressExtra: expressVal,
      active: isActive,
    };

    return res.status(201).json({ 
      success: true, 
      message: 'Layanan berhasil ditambahkan',
      data: newService 
    });
  } catch (err) {
    console.error('[createService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menambahkan layanan.' });
  }
};

// ─── Controller: PATCH /api/services/:id/toggle ───────────────────────────────
export const toggleService = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    if (active === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status active wajib diisi' 
      });
    }

    await poolWaschenPos.execute(
      `UPDATE mst_service 
       SET is_active = ?, updated_at = NOW() 
       WHERE id = ?`,
      [active ? 1 : 0, id]
    );

    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        id,
        service_name AS name,
        category,
        price,
        unit,
        express_extra AS expressExtra,
        is_active AS active,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM mst_service 
      WHERE id = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Layanan tidak ditemukan' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Status layanan berhasil diubah',
      data: rows[0] 
    });
  } catch (err) {
    console.error('[toggleService] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah status layanan.' });
  }
};
