/**
 * Label Printing Controller
 * GET /api/transactions/:id/labels — Generate label data for printing
 * POST /api/transactions/:id/labels/print — Log print action
 */
import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import logger from '../utils/logger.js';

export const getTransactionLabels = async (req, res) => {
  const { id } = req.params;
  const isNumeric = /^\d+$/.test(id);

  try {
    const [rows] = isNumeric
      ? await poolWaschenPos.execute(
          `SELECT
             t.id AS transaction_id, t.transaction_no,
             t.created_at AS transaction_created_at, t.estimated_done_at,
             c.name AS customer_name, c.phone AS customer_phone,
             ti.id AS item_id, ti.service_id,
             s.name AS service_name, s.category_id AS service_category,
             ti.unit_type_snapshot AS unit, s.durasi_hari,
             ti.qty, ti.is_express,
             ti.carpet_panjang_cm AS item_length, ti.carpet_lebar_cm AS item_width,
             m.name AS material_name, ti.notes AS item_notes,
             o.name AS outlet_name
           FROM tr_transaction t
           INNER JOIN mst_customer c ON t.customer_id = c.id
           INNER JOIN tr_transaction_item ti ON t.id = ti.transaction_id
           INNER JOIN mst_service s ON ti.service_id = s.id
           LEFT JOIN mst_material m ON m.id = ti.material_id
           LEFT JOIN mst_outlet o ON o.id = t.outlet_id
           WHERE t.id = ? AND t.deleted_at IS NULL
           ORDER BY ti.id ASC`,
          [id]
        )
      : await poolWaschenPos.execute(
          `SELECT
             t.id AS transaction_id, t.transaction_no,
             t.created_at AS transaction_created_at, t.estimated_done_at,
             c.name AS customer_name, c.phone AS customer_phone,
             ti.id AS item_id, ti.service_id,
             s.name AS service_name, s.category_id AS service_category,
             ti.unit_type_snapshot AS unit, s.durasi_hari,
             ti.qty, ti.is_express,
             ti.carpet_panjang_cm AS item_length, ti.carpet_lebar_cm AS item_width,
             m.name AS material_name, ti.notes AS item_notes,
             o.name AS outlet_name
           FROM tr_transaction t
           INNER JOIN mst_customer c ON t.customer_id = c.id
           INNER JOIN tr_transaction_item ti ON t.id = ti.transaction_id
           INNER JOIN mst_service s ON ti.service_id = s.id
           LEFT JOIN mst_material m ON m.id = ti.material_id
           LEFT JOIN mst_outlet o ON o.id = t.outlet_id
           WHERE t.transaction_no = ? AND t.deleted_at IS NULL
           ORDER BY ti.id ASC`,
          [id]
        );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const txId = rows[0].transaction_id;
    const txNo = rows[0].transaction_no;

    const labels = rows.map((row, index) => {
      const edDate = row.estimated_done_at
        ? new Date(row.estimated_done_at)
        : new Date(row.transaction_created_at);
      if (!row.estimated_done_at) {
        const days = row.is_express ? Math.ceil((row.durasi_hari || 3) / 2) : (row.durasi_hari || 3);
        edDate.setDate(edDate.getDate() + days);
      }

      const estDate = edDate.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const estTime = edDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
      const createdDate = new Date(row.transaction_created_at).toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });

      let qtyDisplay = row.unit ? `${row.qty} ${row.unit}` : `${row.qty} pcs`;
      if (row.unit === 'm2' && row.item_length && row.item_width) {
        qtyDisplay = `${row.item_length} x ${row.item_width} = ${row.qty} m2`;
      }

      return {
        transaction_id: txId,
        transaction_no: txNo,
        item_sequence: index + 1,
        item_id: row.item_id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        service_name: row.service_name,
        service_category: row.service_category,
        material_name: row.material_name || null,
        qty: Number(row.qty),
        unit: row.unit,
        qty_display: qtyDisplay,
        created_date: createdDate,
        estimated_completion: `${estDate} ${estTime}`,
        estimated_completion_date: estDate,
        estimated_completion_time: estTime,
        is_express: row.is_express === 1 || row.is_express === true,
        outlet_name: row.outlet_name,
        item_notes: row.item_notes || null,
        barcode_data: `${txNo}#${index + 1}`,
      };
    });

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      outletId: req.user?.outletId,
      entityType: 'transaction',
      entityId: txId,
      action: 'label_viewed',
      newData: { labelCount: labels.length },
      req,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      data: labels,
      meta: { transaction_id: txId, transaction_no: txNo, label_count: labels.length },
    });
  } catch (err) {
    logger.error('Gagal generate data label', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal generate data label.' });
  }
};

export const printTransactionLabels = async (req, res) => {
  const { id } = req.params;
  const { print_count = 1, printer_name, notes } = req.body;
  const conn = await poolWaschenPos.getConnection();

  try {
    const isNumeric = /^\d+$/.test(id);

    const [[tx]] = isNumeric
      ? await conn.execute(
          'SELECT id, transaction_no, outlet_id FROM tr_transaction WHERE id = ? AND deleted_at IS NULL LIMIT 1',
          [id])
      : await conn.execute(
          'SELECT id, transaction_no, outlet_id FROM tr_transaction WHERE transaction_no = ? AND deleted_at IS NULL LIMIT 1',
          [id]);

    if (!tx) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });
    }

    const [[countRow]] = await conn.execute(
      'SELECT COUNT(*) AS cnt FROM tr_transaction_item WHERE transaction_id = ?', [tx.id]);

    await conn.beginTransaction();
    try {
      const [[log]] = await conn.execute(
        'SELECT id FROM tr_transaction_label_print_log WHERE transaction_id = ? ORDER BY created_at DESC LIMIT 1', [tx.id]);
      if (log) {
        await conn.execute(
          'UPDATE tr_transaction_label_print_log SET print_count = print_count + ?, last_printed_at = NOW(), last_printed_by = ?, printer_name = ?, notes = ? WHERE id = ?',
          [print_count, req.user?.userId || null, printer_name || null, notes || null, log.id]);
      } else {
        await conn.execute(
          'INSERT INTO tr_transaction_label_print_log (transaction_id, print_count, first_printed_at, first_printed_by, last_printed_at, last_printed_by, printer_name, notes) VALUES (?, ?, NOW(), ?, NOW(), ?, ?, ?, NOW())',
          [tx.id, print_count, req.user?.userId || null, printer_name || null, notes || null]);
      }
    } catch { /* log table optional */ }

    await conn.commit();

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      outletId: req.user?.outletId,
      entityType: 'transaction',
      entityId: tx.id,
      action: 'label_printed',
      newData: { transactionCode: tx.transaction_no, labelCount: countRow.cnt, printCount: print_count, printerName: printer_name || null },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `${print_count} label dicetak (${countRow.cnt} item).`,
      data: { transaction_id: tx.id, transaction_no: tx.transaction_no, label_count: countRow.cnt, print_count },
    });
  } catch (err) {
    await conn.rollback();
    logger.error('Gagal catat label print', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mencatat print label.' });
  } finally {
    conn.release();
  }
};
