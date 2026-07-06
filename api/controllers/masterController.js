import { poolWaschenPos } from '../db/connection.js';

/**
 * Master Data Controller
 * Handles endpoints for cascading address and materials
 */

// ═══════════════════════════════════════════════════════════════════════════
// CASCADING ADDRESS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/provinces
 * Returns all provinces
 */
export const getProvinces = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT province_id, province_name FROM mst_province ORDER BY province_name'
    );
    
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('[getProvinces] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data provinsi'
    });
  }
};

/**
 * GET /api/master/cities?province_id=1
 * Returns cities for a specific province
 */
export const getCities = async (req, res) => {
  try {
    const { province_id } = req.query;
    
    if (!province_id) {
      return res.status(400).json({
        success: false,
        message: 'province_id query parameter required'
      });
    }
    
    const [rows] = await poolWaschenPos.execute(
      'SELECT city_id, province_id, city_name FROM mst_city WHERE province_id = ? ORDER BY city_name',
      [province_id]
    );
    
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('[getCities] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data kota/kabupaten'
    });
  }
};

/**
 * GET /api/master/districts?city_id=1
 * Returns districts for a specific city
 */
export const getDistricts = async (req, res) => {
  try {
    const { city_id } = req.query;
    
    if (!city_id) {
      return res.status(400).json({
        success: false,
        message: 'city_id query parameter required'
      });
    }
    
    const [rows] = await poolWaschenPos.execute(
      'SELECT district_id, city_id, district_name FROM mst_district WHERE city_id = ? ORDER BY district_name',
      [city_id]
    );
    
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('[getDistricts] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data kecamatan'
    });
  }
};

/**
 * GET /api/master/sub-districts?district_id=1
 * Returns sub-districts for a specific district
 */
export const getSubDistricts = async (req, res) => {
  try {
    const { district_id } = req.query;
    
    if (!district_id) {
      return res.status(400).json({
        success: false,
        message: 'district_id query parameter required'
      });
    }
    
    const [rows] = await poolWaschenPos.execute(
      `SELECT sub_district_id, district_id, sub_district_name, postal_code 
       FROM mst_sub_district 
       WHERE district_id = ? 
       ORDER BY sub_district_name`,
      [district_id]
    );
    
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('[getSubDistricts] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data kelurahan/desa'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MATERIALS ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/materials
 * Returns all materials (for satuan services)
 */
export const getMaterials = async (req, res) => {
  try {
    // Check if table exists first
    // Restarted server
    const [tables] = await poolWaschenPos.execute("SHOW TABLES LIKE 'mst_material'");
    if (tables.length === 0) {
      // Table doesn't exist, return fallback materials
      const fallbackMaterials = [
        { id: 1, material_id: 1, material_name: 'Sutra', name: 'Sutra', description: 'Bahan sutra halus, memerlukan penanganan khusus' },
        { id: 2, material_id: 2, material_name: 'Katun', name: 'Katun', description: 'Bahan katun standar, mudah dicuci' },
        { id: 3, material_id: 3, material_name: 'Wool', name: 'Wool', description: 'Bahan wool, memerlukan dry cleaning' },
        { id: 4, material_id: 4, material_name: 'Linen', name: 'Linen', description: 'Bahan linen natural, tahan lama' },
        { id: 5, material_id: 5, material_name: 'Polyester', name: 'Polyester', description: 'Bahan sintetis polyester, cepat kering' },
        { id: 6, material_id: 6, material_name: 'Sintetis', name: 'Sintetis', description: 'Bahan sintetis umum' },
        { id: 7, material_id: 7, material_name: 'Kulit', name: 'Kulit', description: 'Bahan kulit, memerlukan treatment khusus' },
        { id: 8, material_id: 8, material_name: 'Rayon', name: 'Rayon', description: 'Bahan rayon semi-sintetis' },
        { id: 9, material_id: 9, material_name: 'Nilon', name: 'Nilon', description: 'Bahan nilon sintetis, tahan air' },
        { id: 10, material_id: 10, material_name: 'Campuran', name: 'Campuran', description: 'Bahan campuran berbagai jenis' },
      ];
      return res.status(200).json({
        success: true,
        data: fallbackMaterials.map(m => ({ ...m, id: m.id || m.material_id, name: m.name || m.material_name }))
      });
    }

    const [rows] = await poolWaschenPos.execute(
      'SELECT id, code, name, description FROM mst_material WHERE is_active = 1 ORDER BY name'
    );

    // Format to include both id and name for frontend compatibility
    const formattedRows = rows.map(row => ({
      ...row,
      material_id: row.id,
      material_name: row.name
    }));

    return res.status(200).json({
      success: true,
      data: formattedRows
    });
  } catch (err) {
    console.error('[getMaterials] Error:', err);
    // Return fallback materials if there's an error
    const fallbackMaterials = [
      { id: 1, material_id: 1, material_name: 'Sutra', name: 'Sutra', description: 'Bahan sutra halus, memerlukan penanganan khusus' },
      { id: 2, material_id: 2, material_name: 'Katun', name: 'Katun', description: 'Bahan katun standar, mudah dicuci' },
      { id: 3, material_id: 3, material_name: 'Wool', name: 'Wool', description: 'Bahan wool, memerlukan dry cleaning' },
      { id: 4, material_id: 4, material_name: 'Linen', name: 'Linen', description: 'Bahan linen natural, tahan lama' },
      { id: 5, material_id: 5, material_name: 'Polyester', name: 'Polyester', description: 'Bahan sintetis polyester, cepat kering' },
      { id: 6, material_id: 6, material_name: 'Sintetis', name: 'Sintetis', description: 'Bahan sintetis umum' },
      { id: 7, material_id: 7, material_name: 'Kulit', name: 'Kulit', description: 'Bahan kulit, memerlukan treatment khusus' },
      { id: 8, material_id: 8, material_name: 'Rayon', name: 'Rayon', description: 'Bahan rayon semi-sintetis' },
      { id: 9, material_id: 9, material_name: 'Nilon', name: 'Nilon', description: 'Bahan nilon sintetis, tahan air' },
      { id: 10, material_id: 10, material_name: 'Campuran', name: 'Campuran', description: 'Bahan campuran berbagai jenis' },
    ];
    return res.status(200).json({
      success: true,
      data: fallbackMaterials.map(m => ({ ...m, id: m.id || m.material_id, name: m.name || m.material_name }))
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// OUTLETS ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/outlets
 * Returns all active outlets
 */
export const getOutlets = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT 
        id,
        outlet_code AS code,
        name,
        address,
        phone,
        email,
        is_active,
        created_at
      FROM mst_outlet
      WHERE deleted_at IS NULL AND is_active = 1
      ORDER BY name ASC`
    );
    
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('[getOutlets] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data outlet'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// OTHER MASTER DATA (if needed in the future)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/services?outlet_id=1
 * Returns all active services for an outlet
 * (Optional: add this if you want centralized service listing)
 */
export const getServices = async (req, res) => {
  try {
    const { outlet_id } = req.query;

    let query;
    const params = [];

    if (outlet_id) {
      query = `
        SELECT
          s.id AS service_id,
          s.name AS service_name,
          sc.name AS category,
          s.unit_type AS unit,
          s.price AS unit_price,
          s.requires_material,
          s.is_active
        FROM mst_service s
        LEFT JOIN mst_service_category sc ON sc.id = s.category_id
        WHERE s.is_active = 1 AND s.outlet_id = ?
        ORDER BY s.sort_order, s.name
      `;
      params.push(outlet_id);
    } else {
      query = `
        SELECT
          s.id AS service_id,
          s.name AS service_name,
          sc.name AS category,
          s.unit_type AS unit,
          s.price AS unit_price,
          s.requires_material,
          s.is_active
        FROM mst_service s
        LEFT JOIN mst_service_category sc ON sc.id = s.category_id
        WHERE s.is_active = 1
        ORDER BY s.sort_order, s.name
      `;
    }

    const [rows] = await poolWaschenPos.execute(query, params);

    return res.status(200).json({
      success: true,
      data: rows.map(row => ({
        ...row,
        unit_price: Number(row.unit_price),
        requires_material: row.requires_material === 1
      }))
    });
  } catch (err) {
    console.error('[getServices] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal memuat data layanan'
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// FRAGRANCE ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/fragrances
 * Returns all active fragrances for dropdown
 */
export const getFragrances = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT id, code, name, description FROM mst_service_fragrance WHERE is_active = 1 ORDER BY sort_order, name'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getFragrances] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat data parfum.' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// DEPOSIT PACKAGE ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/master/deposit-packages
 * Returns all active deposit packages for topup selection
 */
export const getDepositPackages = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, code, name, face_value, sell_price, bonus_pct
       FROM mst_deposit_package
       WHERE is_active = 1 AND deleted_at IS NULL
       ORDER BY sort_order, face_value ASC`
    );
    return res.status(200).json({
      success: true,
      data: rows.map(r => ({
        ...r,
        face_value: Number(r.face_value),
        sell_price: Number(r.sell_price),
        bonus_pct: Number(r.bonus_pct),
      })),
    });
  } catch (err) {
    console.error('[getDepositPackages] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat paket deposit.' });
  }
};

/**
 * GET /api/master/awareness
 * Returns all awareness sources for customer form
 */
export const getAwarenessSources = async (req, res) => {
  try {
    // Fallback data in case table doesn't exist
    const fallbackSources = [
      { id: 1, name: 'Instagram', is_other: false },
      { id: 2, name: 'Tiktok', is_other: false },
      { id: 3, name: 'Google Maps', is_other: false },
      { id: 4, name: 'Facebook', is_other: false },
      { id: 5, name: 'Rekomendasi Teman', is_other: false },
      { id: 6, name: 'Lainnya', is_other: true },
    ];

    return res.status(200).json({
      success: true,
      data: fallbackSources
    });
  } catch (err) {
    console.error('[getAwarenessSources] Error:', err);
    // Fallback on error
    const fallbackSources = [
      { id: 1, name: 'Instagram', is_other: false },
      { id: 2, name: 'Tiktok', is_other: false },
      { id: 3, name: 'Google Maps', is_other: false },
      { id: 4, name: 'Facebook', is_other: false },
      { id: 5, name: 'Rekomendasi Teman', is_other: false },
      { id: 6, name: 'Lainnya', is_other: true },
    ];
    return res.status(200).json({ success: true, data: fallbackSources });
  }
};

/**
 * GET /api/master/area-zones
 * Returns all area zones for customer form
 */
export const getAreaZones = async (req, res) => {
  try {
    // Fallback data in case table doesn't exist
    const fallbackZones = [
      { id: 1, name: 'Setiabudi', is_other: false },
      { id: 2, name: 'Ciputat', is_other: false },
      { id: 3, name: 'Pondok Aren', is_other: false },
      { id: 4, name: 'Ciputat', is_other: false },
      { id: 5, name: 'Serpong', is_other: false },
      { id: 6, name: 'Lainnya', is_other: true },
    ];

    return res.status(200).json({
      success: true,
      data: fallbackZones
    });
  } catch (err) {
    console.error('[getAreaZones] Error:', err);
    // Fallback on error
    const fallbackZones = [
      { id: 1, name: 'Setiabudi', is_other: false },
      { id: 2, name: 'Ciputat', is_other: false },
      { id: 3, name: 'Pondok Aren', is_other: false },
      { id: 4, name: 'Ciputat', is_other: false },
      { id: 5, name: 'Serpong', is_other: false },
      { id: 6, name: 'Lainnya', is_other: true },
    ];
    return res.status(200).json({ success: true, data: fallbackZones });
  }
};
