import { poolWaschenPos } from '../db/connection.js';

export const getBankAccountsByOutlet = async (req, res) => {
  try {
    const { outletId } = req.params;
    const [rows] = await poolWaschenPos.execute(
      `SELECT id, bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder
       FROM mst_bank_account
       WHERE outlet_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY display_order ASC`,
      [outletId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Gagal memuat rekening bank.' });
  }
};
