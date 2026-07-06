import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';

// ─── GET /api/customer-addresses/:customerId ─────────────────────────────────
// List all addresses for a customer
export const getCustomerAddresses = async (req, res) => {
  try {
    const { customerId } = req.params;
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, label, address_housing, address_block, address_no,
              address_detail, address_other, area_zone_id,
              province_id, city_id, district_id, sub_district_id,
              is_default, created_at, updated_at
       FROM mst_customer_address
       WHERE customer_id = ? AND deleted_at IS NULL
       ORDER BY is_default DESC, label ASC`,
      [customerId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getCustomerAddresses]', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat alamat.' });
  }
};

// ─── POST /api/customer-addresses/:customerId ────────────────────────────────
// Create new address
export const createCustomerAddress = async (req, res) => {
  try {
    const { customerId } = req.params;
    const {
      label = 'Rumah',
      address_housing, address_block, address_no,
      address_detail, address_other, area_zone_id,
      province_id, city_id, district_id, sub_district_id,
      is_default = 0,
    } = req.body;

    // If setting as default, unset others first
    if (is_default) {
      await poolWaschenPos.execute(
        'UPDATE mst_customer_address SET is_default = 0 WHERE customer_id = ? AND deleted_at IS NULL',
        [customerId]
      );
    }

    const [result] = await poolWaschenPos.execute(
      `INSERT INTO mst_customer_address
        (customer_id, label, address_housing, address_block, address_no,
         address_detail, address_other, area_zone_id,
         province_id, city_id, district_id, sub_district_id, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerId, label, address_housing, address_block, address_no,
       address_detail, address_other, area_zone_id,
       province_id, city_id, district_id, sub_district_id, is_default ? 1 : 0]
    );

    await writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      entityType: 'customer_address',
      entityId: result.insertId,
      action: 'create',
      newData: { customerId, label },
      req,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Alamat berhasil ditambahkan.',
      data: { id: result.insertId },
    });
  } catch (err) {
    console.error('[createCustomerAddress]', err);
    return res.status(500).json({ success: false, message: 'Gagal menambah alamat.' });
  }
};

// ─── PUT /api/customer-addresses/:id ─────────────────────────────────────────
// Update an address
export const updateCustomerAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [
      'label', 'address_housing', 'address_block', 'address_no',
      'address_detail', 'address_other', 'area_zone_id',
      'province_id', 'city_id', 'district_id', 'sub_district_id', 'is_default',
    ];

    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(f === 'is_default' ? (req.body[f] ? 1 : 0) : req.body[f]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate.' });
    }

    // If setting as default, unset others
    if (req.body.is_default) {
      const [[row]] = await poolWaschenPos.execute(
        'SELECT customer_id FROM mst_customer_address WHERE id = ? LIMIT 1', [id]
      );
      if (row) {
        await poolWaschenPos.execute(
          'UPDATE mst_customer_address SET is_default = 0 WHERE customer_id = ? AND deleted_at IS NULL',
          [row.customer_id]
        );
      }
    }

    params.push(id);
    await poolWaschenPos.execute(
      `UPDATE mst_customer_address SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    return res.json({ success: true, message: 'Alamat berhasil diupdate.' });
  } catch (err) {
    console.error('[updateCustomerAddress]', err);
    return res.status(500).json({ success: false, message: 'Gagal update alamat.' });
  }
};

// ─── DELETE /api/customer-addresses/:id ──────────────────────────────────────
// Soft delete
export const deleteCustomerAddress = async (req, res) => {
  try {
    const { id } = req.params;
    await poolWaschenPos.execute(
      'UPDATE mst_customer_address SET deleted_at = NOW() WHERE id = ?',
      [id]
    );
    return res.json({ success: true, message: 'Alamat berhasil dihapus.' });
  } catch (err) {
    console.error('[deleteCustomerAddress]', err);
    return res.status(500).json({ success: false, message: 'Gagal hapus alamat.' });
  }
};
