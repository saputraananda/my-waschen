import { poolWaschenPos } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('BankAccount');

// ─── GET /api/bank-accounts — list all (admin) or by outlet ────────────────
export const getBankAccounts = async (req, res) => {
  try {
    const { outletId } = req.query;
    const user = req.user;

    let query = `
      SELECT ba.id, ba.outlet_id AS outletId, ba.bank_name AS bankName,
             ba.account_number AS accountNumber, ba.account_holder AS accountHolder,
             ba.is_active AS isActive, ba.display_order AS displayOrder,
             o.name AS outletName
      FROM mst_bank_account ba
      JOIN mst_outlet o ON o.id = ba.outlet_id
      WHERE ba.deleted_at IS NULL
    `;
    const params = [];

    // Admin can see all, others only their outlet
    if (user.roleCode !== 'admin') {
      if (!user.outletId) {
        return res.json({ success: true, data: [] });
      }
      query += ' AND ba.outlet_id = ?';
      params.push(user.outletId);
    } else if (outletId) {
      query += ' AND ba.outlet_id = ?';
      params.push(outletId);
    }

    query += ' ORDER BY ba.outlet_id, ba.display_order ASC';

    const [rows] = await poolWaschenPos.execute(query, params);
    return res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('[getBankAccounts] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data rekening bank.' });
  }
};

// ─── GET /api/bank-accounts/by-outlet/:outletId — list by outlet (public for kasir) ──
export const getBankAccountsByOutlet = async (req, res) => {
  try {
    const { outletId } = req.params;

    const [rows] = await poolWaschenPos.execute(
      `SELECT id, bank_name AS bankName, account_number AS accountNumber,
              account_holder AS accountHolder, display_order AS displayOrder
       FROM mst_bank_account
       WHERE outlet_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY display_order ASC`,
      [outletId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('[getBankAccountsByOutlet] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memuat rekening bank.' });
  }
};

// ─── POST /api/bank-accounts — create (admin only) ─────────────────────────
export const createBankAccount = async (req, res) => {
  try {
    const { outletId, bankName, accountNumber, accountHolder, displayOrder = 0 } = req.body;

    if (!outletId || !bankName || !accountNumber || !accountHolder) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }

    const [result] = await poolWaschenPos.execute(
      `INSERT INTO mst_bank_account (outlet_id, bank_name, account_number, account_holder, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [outletId, bankName.trim(), accountNumber.trim(), accountHolder.trim(), Number(displayOrder)]
    );

    logger.info('[createBankAccount] Created:', { id: result.insertId, bankName, accountNumber });

    return res.status(201).json({
      success: true,
      message: 'Rekening bank berhasil ditambahkan.',
      data: { id: result.insertId }
    });
  } catch (err) {
    logger.error('[createBankAccount] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal membuat rekening bank.' });
  }
};

// ─── PUT /api/bank-accounts/:id — update (admin only) ───────────────────────
export const updateBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { bankName, accountNumber, accountHolder, displayOrder, isActive } = req.body;

    const updates = [];
    const params = [];

    if (bankName !== undefined) { updates.push('bank_name = ?'); params.push(bankName.trim()); }
    if (accountNumber !== undefined) { updates.push('account_number = ?'); params.push(accountNumber.trim()); }
    if (accountHolder !== undefined) { updates.push('account_holder = ?'); params.push(accountHolder.trim()); }
    if (displayOrder !== undefined) { updates.push('display_order = ?'); params.push(Number(displayOrder)); }
    if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diubah.' });
    }

    params.push(id);
    await poolWaschenPos.execute(
      `UPDATE mst_bank_account SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    logger.info('[updateBankAccount] Updated:', { id, updates: updates.join(', ') });

    return res.json({ success: true, message: 'Rekening bank berhasil diperbarui.' });
  } catch (err) {
    logger.error('[updateBankAccount] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui rekening bank.' });
  }
};

// ─── DELETE /api/bank-accounts/:id — soft delete (admin only) ───────────────
export const deleteBankAccount = async (req, res) => {
  try {
    const { id } = req.params;

    await poolWaschenPos.execute(
      `UPDATE mst_bank_account SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    logger.info('[deleteBankAccount] Deleted:', { id });

    return res.json({ success: true, message: 'Rekening bank berhasil dihapus.' });
  } catch (err) {
    logger.error('[deleteBankAccount] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal menghapus rekening bank.' });
  }
};

// ─── POST /api/bank-accounts/seed — Create table + seed dummy data (admin only) ──
export const seedBankAccounts = async (req, res) => {
  try {
    // Create table if not exists
    await poolWaschenPos.execute(`
      CREATE TABLE IF NOT EXISTS mst_bank_account (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        outlet_id BIGINT NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        account_number VARCHAR(30) NOT NULL,
        account_holder VARCHAR(120) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        display_order INT DEFAULT 0,
        deleted_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_bank_account_outlet (outlet_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Get all active outlets
    const [outlets] = await poolWaschenPos.execute(
      `SELECT id, name FROM mst_outlet WHERE deleted_at IS NULL`
    );

    const dummyAccounts = [
      { bankName: 'BCA', accountNumber: '1234567890', accountHolder: 'PT Waschen Laundry Indonesia', displayOrder: 1 },
      { bankName: 'Mandiri', accountNumber: '1300098765432', accountHolder: 'PT Waschen Laundry Indonesia', displayOrder: 2 },
      { bankName: 'BNI', accountNumber: '0123456789', accountHolder: 'PT Waschen Laundry Indonesia', displayOrder: 3 },
      { bankName: 'BRI', accountNumber: '002001000987654', accountHolder: 'PT Waschen Laundry Indonesia', displayOrder: 4 },
    ];

    let created = 0;
    for (const outlet of outlets) {
      for (const acc of dummyAccounts) {
        const [existing] = await poolWaschenPos.execute(
          `SELECT id FROM mst_bank_account WHERE outlet_id = ? AND bank_name = ? AND deleted_at IS NULL LIMIT 1`,
          [outlet.id, acc.bankName]
        );
        if (existing.length === 0) {
          await poolWaschenPos.execute(
            `INSERT INTO mst_bank_account (outlet_id, bank_name, account_number, account_holder, display_order)
             VALUES (?, ?, ?, ?, ?)`,
            [outlet.id, acc.bankName, acc.accountNumber, acc.accountHolder, acc.displayOrder]
          );
          created++;
        }
      }
    }

    logger.info('[seedBankAccounts] Created:', created, 'accounts');
    return res.json({ success: true, message: `${created} rekening bank berhasil ditambahkan.` });
  } catch (err) {
    logger.error('[seedBankAccounts] Error:', err);
    return res.status(500).json({ success: false, message: 'Gagal seed rekening bank.', error: err.message });
  }
};
