// ─────────────────────────────────────────────────────────────────────────────
// Transaction Merge Controller
// Handles merging/splitting of separate transactions into one
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TransactionMerge');

// ─── Generate Merge No ────────────────────────────────────────────────────────
const generateMergeNo = async (conn, outletId) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePrefix = `MG-${yy}${mm}${dd}-`;

  const [rows] = await conn.execute(
    `SELECT merge_no FROM tr_transaction_merge
     WHERE outlet_id = ? AND merge_no LIKE ?
     ORDER BY merge_no DESC LIMIT 1 FOR UPDATE`,
    [outletId, `${datePrefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].merge_no;
    const lastSeqStr = lastNo.slice(datePrefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (Number.isFinite(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${datePrefix}${String(nextSeq).padStart(3, '0')}`;
};

// ─── GET /api/merges ──────────────────────────────────────────────────────────
// List all merge records
export const getMerges = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      outletId,
      status,
      dateFrom,
      dateTo,
    } = req.query;

    const { userId, outletId: tokenOutletId, roleCode } = req.user;
    const offset = (Number(page) - 1) * Number(limit);

    const conditions = ['1=1'];
    const params = [];

    if (roleCode === 'frontline') {
      if (tokenOutletId) {
        conditions.push('m.outlet_id = ?');
        params.push(tokenOutletId);
      }
    } else if (outletId) {
      conditions.push('m.outlet_id = ?');
      params.push(outletId);
    }

    if (status) {
      conditions.push('m.status = ?');
      params.push(status);
    }

    if (dateFrom) {
      conditions.push('DATE(m.created_at) >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('DATE(m.created_at) <= ?');
      params.push(dateTo);
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await poolWaschenPos.execute(
      `SELECT m.*,
              t.transaction_no as primary_transaction_no,
              c.name as customer_name,
              u.name as created_by_name,
              o.name as outlet_name
       FROM tr_transaction_merge m
       JOIN tr_transaction t ON m.primary_transaction_id = t.id
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       LEFT JOIN mst_user u ON m.created_by = u.id
       LEFT JOIN mst_outlet o ON m.outlet_id = o.id
       WHERE ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    // Get items for each merge
    for (const merge of rows) {
      const [items] = await poolWaschenPos.execute(
        `SELECT mi.*, t.transaction_no
         FROM tr_transaction_merge_item mi
         JOIN tr_transaction t ON mi.transaction_id = t.id
         WHERE mi.merge_id = ?
         ORDER BY mi.created_at`,
        [merge.id]
      );
      merge.items = items;
    }

    const [countResult] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total FROM tr_transaction_merge m WHERE ${whereClause}`,
      params
    );

    return res.json({
      success: true,
      data: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / Number(limit)),
      },
    });

  } catch (error) {
    logger.error('[getMerges] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data merge' });
  }
};

// ─── GET /api/merges/:id ─────────────────────────────────────────────────────
export const getMergeById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await poolWaschenPos.execute(
      `SELECT m.*,
              t.transaction_no as primary_transaction_no, t.total as primary_total,
              t.sub_total as primary_sub_total, t.discount_amount as primary_discount,
              c.name as customer_name, c.phone as customer_phone,
              u.name as created_by_name,
              a.name as approved_by_name,
              o.name as outlet_name
       FROM tr_transaction_merge m
       JOIN tr_transaction t ON m.primary_transaction_id = t.id
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       LEFT JOIN mst_user u ON m.created_by = u.id
       LEFT JOIN mst_user a ON m.approved_by = a.id
       LEFT JOIN mst_outlet o ON m.outlet_id = o.id
       WHERE m.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Merge tidak ditemukan' });
    }

    const merge = rows[0];

    // Get merged items
    const [items] = await poolWaschenPos.execute(
      `SELECT mi.*, t.transaction_no, t.total as transaction_total
       FROM tr_transaction_merge_item mi
       JOIN tr_transaction t ON mi.transaction_id = t.id
       WHERE mi.merge_id = ?
       ORDER BY mi.created_at`,
      [id]
    );

    merge.items = items;

    return res.json({ success: true, data: merge });

  } catch (error) {
    logger.error('[getMergeById] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail merge' });
  }
};

// ─── POST /api/merges ────────────────────────────────────────────────────────
// Create new merge - combine items from secondary transactions to primary
export const createMerge = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const {
      primaryTransactionId,
      secondaryTransactionIds,
      reason,
    } = req.body;

    const { userId, outletId: tokenOutletId, name: userName } = req.user;

    // Validation
    if (!primaryTransactionId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Transaksi utama wajib dipilih' });
    }

    if (!secondaryTransactionIds || secondaryTransactionIds.length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Pilih minimal 1 transaksi untuk digabungkan' });
    }

    // Get outlet from primary transaction
    const [primaryRows] = await conn.execute(
      `SELECT t.*, c.name as customer_name
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       WHERE t.id = ?`,
      [primaryTransactionId]
    );

    if (primaryRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Transaksi utama tidak ditemukan' });
    }

    const primary = primaryRows[0];
    const outletId = primary.outlet_id || tokenOutletId;

    // Boundary check
    if (tokenOutletId && primary.outlet_id !== tokenOutletId) {
      conn.release();
      return res.status(403).json({ success: false, message: 'Tidak dapat menggabungkan transaksi outlet lain' });
    }

    // Check primary transaction status
    if (primary.status === 'cancelled') {
      conn.release();
      return res.status(400).json({ success: false, message: 'Transaksi utama sudah dibatalkan' });
    }

    // Validate secondary transactions
    let totalSecondaryAmount = 0;
    const secondaryDetails = [];

    for (const txId of secondaryTransactionIds) {
      const [secRows] = await conn.execute(
        `SELECT t.*, c.name as customer_name
         FROM tr_transaction t
         LEFT JOIN mst_customer c ON t.customer_id = c.id
         WHERE t.id = ?`,
        [txId]
      );

      if (secRows.length === 0) {
        conn.release();
        return res.status(404).json({ success: false, message: `Transaksi ID ${txId} tidak ditemukan` });
      }

      const sec = secRows[0];

      if (sec.outlet_id !== outletId) {
        conn.release();
        return res.status(400).json({ success: false, message: 'Hanya dapat menggabungkan transaksi satu outlet' });
      }

      if (sec.status === 'cancelled') {
        conn.release();
        return res.status(400).json({ success: false, message: `Transaksi ${sec.transaction_no} sudah dibatalkan` });
      }

      // Check if already merged
      if (sec.is_merged) {
        conn.release();
        return res.status(400).json({ success: false, message: `Transaksi ${sec.transaction_no} sudah pernah digabungkan` });
      }

      totalSecondaryAmount += parseFloat(sec.total || 0);
      secondaryDetails.push({
        id: txId,
        transaction_no: sec.transaction_no,
        total: sec.total,
        customer_name: sec.customer_name,
      });
    }

    const mergeNo = await generateMergeNo(conn, outletId);

    // Insert merge record
    const [insertResult] = await conn.execute(
      `INSERT INTO tr_transaction_merge (
        outlet_id, merge_no, primary_transaction_id, reason, created_by, pic_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
      [outletId, mergeNo, primaryTransactionId, reason || null, userId, userName]
    );

    const mergeId = insertResult.insertId;

    // Move items from secondary transactions to primary
    for (const txId of secondaryTransactionIds) {
      // Get items from secondary transaction
      const [items] = await conn.execute(
        `SELECT * FROM tr_transaction_item WHERE transaction_id = ?`,
        [txId]
      );

      // Move items to primary transaction
      for (const item of items) {
        await conn.execute(
          `INSERT INTO tr_transaction_item (
            transaction_id, service_id, item_name, category, quantity,
            unit_price, sub_total, discount_amount, discount_percent,
            is_promo, promo_id, notes, created_at, merged_from_transaction_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            primaryTransactionId,
            item.service_id,
            item.item_name,
            item.category,
            item.quantity,
            item.unit_price,
            item.sub_total,
            item.discount_amount,
            item.discount_percent,
            item.is_promo,
            item.promo_id,
            item.notes,
            item.created_at,
            txId, // track source
          ]
        );
      }

      // Insert merge item record
      await conn.execute(
        `INSERT INTO tr_transaction_merge_item (
          merge_id, transaction_id, original_no, items_count, total_amount, status, merged_at
        ) VALUES (?, ?, ?, ?, ?, 'merged', NOW())`,
        [mergeId, txId, primary.transaction_no, items.length, parseFloat(primary.total || 0)]
      );

      // Mark secondary transaction as merged (soft delete - keep for audit)
      await conn.execute(
        `UPDATE tr_transaction SET is_merged = 1, merged_into = ?, updated_at = NOW() WHERE id = ?`,
        [primaryTransactionId, txId]
      );
    }

    // Recalculate primary transaction totals
    const [updatedItems] = await conn.execute(
      `SELECT SUM(sub_total) as total_sub, SUM(discount_amount) as total_discount
       FROM tr_transaction_item WHERE transaction_id = ?`,
      [primaryTransactionId]
    );

    const newSubTotal = parseFloat(updatedItems[0].total_sub || 0);
    const newDiscount = parseFloat(updatedItems[0].total_discount || 0);
    const newTotal = Math.max(0, newSubTotal - newDiscount);

    await conn.execute(
      `UPDATE tr_transaction SET
        sub_total = ?, discount_amount = ?, total = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [newSubTotal, newDiscount, newTotal, primaryTransactionId]
    );

    await conn.commit();

    logger.info('[createMerge]', {
      mergeId,
      mergeNo,
      primaryTransactionId,
      secondaryCount: secondaryTransactionIds.length,
      by: userName,
    });

    return res.status(201).json({
      success: true,
      message: `Berhasil menggabungkan ${secondaryTransactionIds.length} transaksi`,
      data: {
        id: mergeId,
        merge_no: mergeNo,
        primary_transaction_id: primaryTransactionId,
        primary_transaction_no: primary.transaction_no,
        secondary_transactions: secondaryDetails,
        new_total: newTotal,
        created_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[createMerge] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal menggabungkan transaksi' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/merges/transactions/:transactionId ──────────────────────────────
// Get available transactions for merge (same customer, same date, not merged)
export const getMergeableTransactions = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { outletId: tokenOutletId, roleCode } = req.user;

    // Get reference transaction
    const [refRows] = await poolWaschenPos.execute(
      `SELECT t.*, c.name as customer_name
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       WHERE t.id = ?`,
      [transactionId]
    );

    if (refRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const ref = refRows[0];

    // Find mergeable transactions
    // Same customer OR same outlet, same day, not cancelled, not already merged
    const [rows] = await poolWaschenPos.execute(
      `SELECT t.*, c.name as customer_name,
              (SELECT SUM(sub_total) FROM tr_transaction_item WHERE transaction_id = t.id) as items_total
       FROM tr_transaction t
       LEFT JOIN mst_customer c ON t.customer_id = c.id
       WHERE t.outlet_id = ?
         AND t.id != ?
         AND t.status != 'cancelled'
         AND t.is_merged IS NULL
         AND DATE(t.created_at) = DATE(?)
         AND t.payment_status IN ('unpaid', 'partial')
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [ref.outlet_id, transactionId, ref.created_at]
    );

    return res.json({
      success: true,
      data: rows,
    });

  } catch (error) {
    logger.error('[getMergeableTransactions] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data' });
  }
};

// ─── POST /api/merges/:id/rollback ───────────────────────────────────────────
// Rollback a merge - separate transactions back
export const rollbackMerge = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { userId, name: userName, roleCode } = req.user;

    // Only admin can rollback
    if (roleCode !== 'admin') {
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat rollback' });
    }

    const [mergeRows] = await conn.execute(
      'SELECT * FROM tr_transaction_merge WHERE id = ? AND status = "completed" FOR UPDATE',
      [id]
    );

    if (mergeRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Merge tidak ditemukan atau belum selesai' });
    }

    const merge = mergeRows[0];

    // Get merged items
    const [mergeItems] = await conn.execute(
      'SELECT * FROM tr_transaction_merge_item WHERE merge_id = ? AND status = "merged"',
      [id]
    );

    // Move items back to original transactions
    for (const item of mergeItems) {
      // Delete items moved to primary
      await conn.execute(
        'DELETE FROM tr_transaction_item WHERE transaction_id = ? AND merged_from_transaction_id = ?',
        [merge.primary_transaction_id, item.transaction_id]
      );

      // Restore secondary transaction status
      await conn.execute(
        `UPDATE tr_transaction SET is_merged = NULL, merged_into = NULL, updated_at = NOW() WHERE id = ?`,
        [item.transaction_id]
      );

      // Mark merge item as rolled back
      await conn.execute(
        `UPDATE tr_transaction_merge_item SET status = 'rolled_back', rolled_back_at = NOW() WHERE id = ?`,
        [item.id]
      );
    }

    // Recalculate primary transaction totals
    const [updatedItems] = await conn.execute(
      `SELECT SUM(sub_total) as total_sub, SUM(discount_amount) as total_discount
       FROM tr_transaction_item WHERE transaction_id = ?`,
      [merge.primary_transaction_id]
    );

    const newSubTotal = parseFloat(updatedItems[0].total_sub || 0);
    const newDiscount = parseFloat(updatedItems[0].total_discount || 0);
    const newTotal = Math.max(0, newSubTotal - newDiscount);

    await conn.execute(
      `UPDATE tr_transaction SET
        sub_total = ?, discount_amount = ?, total = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [newSubTotal, newDiscount, newTotal, merge.primary_transaction_id]
    );

    // Update merge status
    await conn.execute(
      `UPDATE tr_transaction_merge
       SET status = 'cancelled', approved_by = ?, approved_at = NOW(),
           notes = CONCAT(IFNULL(notes, ''), '\nRollback: ', ?)
       WHERE id = ?`,
      [userId, reason || `Rollback by ${userName}`, id]
    );

    await conn.commit();

    logger.info('[rollbackMerge]', { mergeId: id, by: userName });

    return res.json({
      success: true,
      message: 'Merge berhasil di-rollback',
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[rollbackMerge] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal rollback' });
  } finally {
    conn.release();
  }
};
