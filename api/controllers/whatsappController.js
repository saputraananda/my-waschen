import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import logger from '../utils/logger.js';

// ─── GET /api/whatsapp-templates ─────────────────────────────────────────────
export const getWhatsappTemplates = async (req, res) => {
  try {
    const { type, is_active } = req.query;
    let sql = 'SELECT id, code, name, type, body, is_active, is_default, created_at, updated_at FROM mst_whatsapp_template WHERE 1=1';
    const params = [];

    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(is_active === 'true' || is_active === '1' ? 1 : 0); }

    sql += ' ORDER BY is_default DESC, type ASC, name ASC';
    const [rows] = await poolWaschenPos.execute(sql, params);

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    logger.error('Gagal memuat template WhatsApp', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat template WhatsApp.' });
  }
};

// ─── GET /api/whatsapp-templates/:id ───────────────────────────────────────
export const getWhatsappTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[row]] = await poolWaschenPos.execute(
      'SELECT id, code, name, type, body, is_active, is_default, created_at, updated_at FROM mst_whatsapp_template WHERE id = ?',
      [id]
    );
    if (!row) return res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });
    return res.status(200).json({ success: true, data: row });
  } catch (err) {
    logger.error('Gagal memuat template', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat template.' });
  }
};

// ─── POST /api/whatsapp-templates ──────────────────────────────────────────
export const createWhatsappTemplate = async (req, res) => {
  try {
    const { code, name, type, body, is_active = 1, is_default = 0 } = req.body;
    if (!code || !name || !type || !body) {
      return res.status(400).json({ success: false, message: 'code, name, type, dan body wajib diisi.' });
    }

    const [existing] = await poolWaschenPos.execute(
      'SELECT id FROM mst_whatsapp_template WHERE code = ? LIMIT 1',
      [code]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: `Kode template '${code}' sudah digunakan.` });
    }

    const [result] = await poolWaschenPos.execute(
      `INSERT INTO mst_whatsapp_template (code, name, type, body, is_active, is_default, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, name, type, body, is_active ? 1 : 0, is_default ? 1 : 0, req.user?.userId || null]
    );

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      entityType: 'whatsapp_template',
      entityId: result.insertId,
      action: 'create_whatsapp_template',
      newData: { code, name, type },
      req,
    }).catch(err => logger.error('[createWhatsappTemplate] writeAudit gagal:', err));

    return res.status(201).json({
      success: true,
      message: 'Template WhatsApp berhasil dibuat.',
      data: { id: result.insertId, code, name, type },
    });
  } catch (err) {
    logger.error('Gagal membuat template', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal membuat template.' });
  }
};

// ─── PUT /api/whatsapp-templates/:id ───────────────────────────────────────
export const updateWhatsappTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, body, is_active, is_default } = req.body;

    const [[existing]] = await poolWaschenPos.execute(
      'SELECT id FROM mst_whatsapp_template WHERE id = ? LIMIT 1',
      [id]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (body !== undefined) { updates.push('body = ?'); params.push(body); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (is_default !== undefined) { updates.push('is_default = ?'); params.push(is_default ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate.' });
    }

    params.push(id);
    await poolWaschenPos.execute(
      `UPDATE mst_whatsapp_template SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      entityType: 'whatsapp_template',
      entityId: Number(id),
      action: 'update_whatsapp_template',
      req,
    }).catch(err => logger.error('[updateWhatsappTemplate] writeAudit gagal:', err));

    return res.status(200).json({ success: true, message: 'Template berhasil diupdate.' });
  } catch (err) {
    logger.error('Gagal update template', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal update template.' });
  }
};

// ─── DELETE /api/whatsapp-templates/:id ─────────────────────────────────────
export const deleteWhatsappTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const [[existing]] = await poolWaschenPos.execute(
      'SELECT id, code FROM mst_whatsapp_template WHERE id = ? LIMIT 1',
      [id]
    );
    if (!existing) return res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });

    await poolWaschenPos.execute(
      'UPDATE mst_whatsapp_template SET is_active = 0 WHERE id = ?',
      [id]
    );

    writeAudit(poolWaschenPos, {
      userId: req.user?.userId,
      entityType: 'whatsapp_template',
      entityId: Number(id),
      action: 'delete_whatsapp_template',
      newData: { code: existing.code },
      req,
    }).catch(err => logger.error('[deleteWhatsappTemplate] writeAudit gagal:', err));

    return res.status(200).json({ success: true, message: 'Template berhasil dihapus.' });
  } catch (err) {
    logger.error('Gagal hapus template', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal hapus template.' });
  }
};

// ─── POST /api/transactions/:id/send-whatsapp ────────────────────────────────
// Kirim pesan WhatsApp ke customer menggunakan template
export const sendTransactionWhatsapp = async (req, res) => {
  try {
    const { id } = req.params;
    const { template_type } = req.body; // 'nota_baru' | 'siap_diambil' | 'reschedule' | 'reminder'

    if (!template_type) {
      return res.status(400).json({ success: false, message: 'template_type wajib diisi.' });
    }

    // Ambil data transaksi + customer + outlet
    const [[tx]] = await poolWaschenPos.execute(
      `SELECT t.id, t.transaction_no, t.total, t.created_at, t.estimated_done_at,
 t.pickup_type, t.status AS txStatus, t.payment_status,
              c.id AS custId, c.name AS custName, c.phone AS custPhone, c.greeting,
              o.name AS outletName, o.phone AS outletPhone
       FROM tr_transaction t
       JOIN mst_customer c ON c.id = t.customer_id
       JOIN mst_outlet o ON o.id = t.outlet_id
       WHERE t.deleted_at IS NULL AND (t.id = ? OR t.transaction_no = ?) LIMIT 1`,
      [id, id]
    );
    if (!tx) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan.' });

    if (!tx.custPhone) {
      return res.status(400).json({ success: false, message: 'Nomor HP customer belum tersedia.' });
    }

    // Ambil template default untuk type tsb
    const [[tmpl]] = await poolWaschenPos.execute(
      `SELECT id, code, name, body FROM mst_whatsapp_template
       WHERE type = ? AND is_active = 1 AND is_default = 1 LIMIT 1`,
      [template_type]
    );
    if (!tmpl) {
      return res.status(404).json({ success: false, message: `Template '${template_type}' tidak ditemukan atau tidak aktif.` });
    }

    // Render placeholders
    const itemRows = await poolWaschenPos.execute(
      `SELECT ti.service_name_snapshot AS name, ti.qty, ti.unit_type_snapshot AS unit, ti.subtotal
       FROM tr_transaction_item ti WHERE ti.transaction_id = ? AND ti.is_active = 1`,
      [tx.id]
    );
    const itemsSummary = (itemRows[0] || []).map(item =>
      `• ${item.name} (${item.qty} ${item.unit}) - Rp ${Number(item.subtotal).toLocaleString('id-ID')}`
    ).join('\n') || '• Tidak ada item';

    const placeholders = {
      customer_name: tx.custName || '',
      nota_code: tx.transaction_no || tx.id,
      total: `Rp ${Number(tx.total || 0).toLocaleString('id-ID')}`,
      date: tx.created_at ? new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
      estimated_done: tx.estimated_done_at ? new Date(tx.estimated_done_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'belum ditentukan',
      outlet_name: tx.outletName || '',
      items_summary: itemsSummary,
      greeting: tx.greeting || 'Bapak/Ibu',
      payment_info: tx.payment_status === 'paid' ? '✅ Sudah Lunas' : `💳 Belum Lunas: Rp ${Number(tx.total || 0).toLocaleString('id-ID')}`,
      schedule_type: 'jadwal',
      new_datetime: '',
      reason: '',
      remaining_time: '',
    };

    let messageBody = tmpl.body;
    for (const [key, val] of Object.entries(placeholders)) {
      messageBody = messageBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
    }

    // Simpan log
    const [logResult] = await poolWaschenPos.execute(
      `INSERT INTO tr_whatsapp_log (transaction_id, customer_id, template_id, template_code, recipient_phone, message_body, status, sent_by, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [tx.id, tx.custId, tmpl.id, tmpl.code, tx.custPhone, messageBody, req.user?.userId || null]
    );

    // Emit event realtime (bisa换成真正的 WA gateway integration di sini)
    try {
      const { emitWhatsappSent } = await import('../services/eventBus.js');
      emitWhatsappSent({ transactionId: tx.id, customerId: tx.custId, templateCode: tmpl.code });
    } catch (err) { logger.warn('[sendTransactionWhatsapp] Emit WhatsApp sent gagal:', err?.message); }

    return res.status(200).json({
      success: true,
      message: 'Pesan WhatsApp dalam antrean.',
      data: {
        log_id: logResult.insertId,
        status: 'pending',
        to: tx.custPhone,
        message_preview: messageBody.slice(0, 100) + (messageBody.length > 100 ? '...' : ''),
      },
    });
  } catch (err) {
    logger.error('Gagal mengirim WhatsApp', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengirim WhatsApp.' });
  }
};

// ─── GET /api/whatsapp-templates/:id/log ────────────────────────────────────
// Riwayat pengiriman untuk template tertentu
export const getTemplateLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [[totalRow]] = await poolWaschenPos.execute(
      'SELECT COUNT(*) AS total FROM tr_whatsapp_log WHERE template_id = ?',
      [id]
    );
    const [logs] = await poolWaschenPos.execute(
      `SELECT wl.id, wl.recipient_phone, wl.message_body, wl.status, wl.sent_at,
              t.transaction_no, c.name AS customer_name
       FROM tr_whatsapp_log wl
       LEFT JOIN tr_transaction t ON t.id = wl.transaction_id
       LEFT JOIN mst_customer c ON c.id = wl.customer_id
       WHERE wl.template_id = ?
       ORDER BY wl.sent_at DESC
       LIMIT ? OFFSET ?`,
      [id, Number(limit), offset]
    );

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total: totalRow.total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(totalRow.total / Number(limit)),
      },
    });
  } catch (err) {
    logger.error('Gagal memuat log template', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat log template.' });
  }
};
