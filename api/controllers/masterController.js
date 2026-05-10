import { poolWaschenPos } from '../db/connection.js';

export const getAwarenessSources = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT id, code, name, is_other FROM mst_awareness_source WHERE is_active = TRUE ORDER BY sort_order'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[getAwarenessSources] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil sumber informasi.' });
  }
};

export const getAreaZones = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT id, code, name, is_other, delivery_fee FROM mst_area_zone WHERE is_active = TRUE'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[getAreaZones] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil area pengiriman.' });
  }
};

export const getMaterials = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT id, code, name FROM mst_material WHERE is_active = TRUE ORDER BY sort_order'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[getMaterials] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil material layanan.' });
  }
};

export const getOutlets = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT id, outlet_code AS code, name FROM mst_outlet WHERE is_active = TRUE ORDER BY name'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('[getOutlets] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data outlet.' });
  }
};
