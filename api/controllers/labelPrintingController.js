/**
 * Label Printing Controller
 * BUG FIX 5 & 6: Label Printing Endpoint (Requirements 2.7, 2.8)
 * 
 * Implements:
 * - GET /transactions/:id/labels - Generate label data for printing
 * - POST /transactions/:id/labels/print - Log print/reprint action
 */

import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import logger from '../utils/logger.js';

/**
 * GET /api/transactions/:id/labels
 * Generate label data for internal production tracking
 * 
 * Returns array of label objects (one per transaction item):
 * - transaction_code
 * - item_sequence
 * - customer_name
 * - service_name
 * - material_name (if applicable)
 * - qty
 * - unit
 * - created_date
 * - estimated_completion
 * - is_express
 */
export const getTransactionLabels = async (req, res) => {
  try {
    const { id } = req.params;

    // Query transaction with items
    const [rows] = await poolWaschenPos.execute(
      `SELECT 
         t.id AS transaction_id,
         t.transaction_code,
         t.created_at AS transaction_created_at,
         t.estimated_completion,
         c.name AS customer_name,
         c.phone AS customer_phone,
         ti.id AS item_id,
         ti.service_id,
         s.service_name,
         s.category AS service_category,
         s.unit,
         s.estimated_days,
         ti.qty,
         ti.is_express,
         ti.length,
         ti.width,
         m.material_name,
         ti.notes AS item_notes,
         o.name AS outlet_name
       FROM tr_transaction t
       INNER JOIN mst_customer c ON t.customer_id = c.id
       INNER JOIN tr_transaction_item ti ON t.id = ti.transaction_id
       INNER JOIN mst_service s ON ti.service_id = s.id
       LEFT JOIN mst_material m ON ti.material_id = m.material_id
       LEFT JOIN mst_outlet o ON t.outlet_id = o.id
       WHERE t.id = ? 
         AND t.deleted_at IS NULL
       ORDER BY ti.id ASC`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Transaksi tidak ditemukan atau tidak memiliki item.'
      });
    }

    // Generate label data for each item
    const labels = rows.map((row, index) => {
      // Calculate estimated completion date
      let estimatedCompletionDate;
      if (row.estimated_completion) {
        estimatedCompletionDate = new Date(row.estimated_completion);
      } else {
        // Fallback: calculate from created_at + estimated_days
        estimatedCompletionDate = new Date(row.transaction_created_at);
        const daysToAdd = row.is_express ? Math.ceil((row.estimated_days || 3) / 2) : (row.estimated_days || 3);
        estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + daysToAdd);
      }

      // Format dates
      const createdDate = new Date(row.transaction_created_at).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      const estimatedDate = estimatedCompletionDate.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      const estimatedTime = estimatedCompletionDate.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      // Build quantity display with dimensions for m²
      let qtyDisplay = `${row.qty} ${row.unit}`;
      if (row.unit === 'm2' || row.unit === 'm²') {
        if (row.length && row.width) {
          qtyDisplay = `${row.length}m × ${row.width}m = ${row.qty} m²`;
        }
      }

      return {
        // Label identification
        transaction_code: row.transaction_code,
        item_sequence: index + 1,
        item_id: row.item_id,
        
        // Customer info
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        
        // Service details
        service_name: row.service_name,
        service_category: row.service_category,
        material_name: row.material_name || null,
        
        // Quantity
        qty: Number(row.qty),
        unit: row.unit,
        qty_display: qtyDisplay,
        
        // Dates
        created_date: createdDate,
        estimated_completion: `${estimatedDate} ${estimatedTime}`,
        estimated_completion_date: estimatedDate,
        estimated_completion_time: estimatedTime,
        
        // Flags
        is_express: row.is_express === 1 || row.is_express === true,
        
        // Additional info
        outlet_name: row.outlet_name,
        item_notes: row.item_notes || null,
        
        // Barcode data (can be used to generate QR/barcode)
        barcode_data: `${row.transaction_code}-${index + 1}`,
      };
    });

    // Log label generation to audit trail
    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      outletId: req.user?.outletId,
      entityType: 'transaction',
      entityId: id,
      action: 'label_viewed',
      newData: {
        labelCount: labels.length,
        viewedAt: new Date().toISOString(),
      },
      req,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      data: labels,
      meta: {
        transaction_id: id,
        transaction_code: rows[0].transaction_code,
        label_count: labels.length,
      }
    });
  } catch (err) {
    logger.error('Gagal generate data label', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal generate data label.'
    });
  }
};

/**
 * POST /api/transactions/:id/labels/print
 * Log label print/reprint action to audit trail
 */
export const printTransactionLabels = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();
  
  try {
    const { id } = req.params;
    const { print_count = 1, printer_name, notes } = req.body;

    // Verify transaction exists
    const [[transaction]] = await conn.execute(
      `SELECT id, transaction_code, outlet_id 
       FROM tr_transaction 
       WHERE id = ? AND deleted_at IS NULL 
       LIMIT 1`,
      [id]
    );

    if (!transaction) {
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Transaksi tidak ditemukan.'
      });
    }

    // Count items for this transaction
    const [[itemCount]] = await conn.execute(
      'SELECT COUNT(*) as count FROM tr_transaction_item WHERE transaction_id = ?',
      [id]
    );

    await conn.beginTransaction();

    // Insert or update print log
    try {
      const [existingLog] = await conn.execute(
        `SELECT id, print_count FROM tr_transaction_label_print_log 
         WHERE transaction_id = ? 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [id]
      );

      if (existingLog.length > 0) {
        // Update existing log (reprint)
        await conn.execute(
          `UPDATE tr_transaction_label_print_log 
           SET print_count = print_count + ?,
               last_printed_at = NOW(),
               last_printed_by = ?,
               printer_name = ?,
               notes = ?
           WHERE id = ?`,
          [print_count, req.user?.userId || null, printer_name || null, notes || null, existingLog[0].id]
        );
      } else {
        // Insert new log (first print)
        await conn.execute(
          `INSERT INTO tr_transaction_label_print_log 
             (transaction_id, print_count, first_printed_at, first_printed_by, 
              last_printed_at, last_printed_by, printer_name, notes, created_at)
           VALUES (?, ?, NOW(), ?, NOW(), ?, ?, ?, NOW())`,
          [id, print_count, req.user?.userId || null, req.user?.userId || null, 
           printer_name || null, notes || null]
        );
      }
    } catch (logErr) {
      // If table doesn't exist, continue without logging (best-effort)
      // [printTransactionLabels] log table unavailable - optional
    }

    // Log to audit trail
    await writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      outletId: req.user?.outletId,
      entityType: 'transaction',
      entityId: id,
      action: 'label_printed',
      newData: {
        transactionCode: transaction.transaction_code,
        labelCount: itemCount.count,
        printCount: print_count,
        printerName: printer_name || null,
        printedAt: new Date().toISOString(),
      },
      req,
    });

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Label berhasil dicetak (${print_count}x untuk ${itemCount.count} item).`,
      data: {
        transaction_id: id,
        transaction_code: transaction.transaction_code,
        label_count: itemCount.count,
        print_count: print_count,
      }
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Gagal mencatat print label', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Gagal mencatat print label.'
    });
  } finally {
    conn.release();
  }
};
