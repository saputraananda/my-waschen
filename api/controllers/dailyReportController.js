// ─────────────────────────────────────────────────────────────────────────────
// Daily Report Controller
// Handles auto daily report generation and WhatsApp sending
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('DailyReport');

// ─── Helper: Format currency ──────────────────────────────────────────────────
const formatRp = (amount) => {
  return new Intl.NumberFormat('id-ID').format(Math.round(amount || 0));
};

// ─── Helper: Format date ─────────────────────────────────────────────────────
const formatDate = (date) => {
  const d = new Date(date);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// ─── Helper: Format time ─────────────────────────────────────────────────────
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ─── GET /api/daily-reports/generate ─────────────────────────────────────────
// Generate daily report for current day
export const generateDailyReport = async (req, res) => {
  try {
    const { outletId, date } = req.query;
    const { userId, outletId: tokenOutletId, role } = req.user;

    const targetOutletId = outletId || tokenOutletId;
    const reportDate = date || new Date().toISOString().split('T')[0];

    if (!targetOutletId) {
      return res.status(400).json({ success: false, message: 'Outlet ID diperlukan' });
    }

    // Get outlet info
    const [outletRows] = await poolWaschenPos.execute(
      'SELECT * FROM mst_outlet WHERE id = ?',
      [targetOutletId]
    );

    if (outletRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Outlet tidak ditemukan' });
    }

    const outlet = outletRows[0];

    // Get cashier sessions for the date
    const [sessionRows] = await poolWaschenPos.execute(
      `SELECT s.*, u.name as cashier_name
       FROM tr_cashier_session s
       LEFT JOIN mst_user u ON s.cashier_id = u.id
       WHERE s.outlet_id = ? AND DATE(s.created_at) = ?
       ORDER BY s.created_at`,
      [targetOutletId, reportDate]
    );

    const cashierNames = [...new Set(sessionRows.map(s => s.cashier_name).filter(Boolean))].join(', ');

    // Get transaction summary
    const [txSummary] = await poolWaschenPos.execute(
      `SELECT
        COUNT(*) as total_count,
        SUM(total) as total_sales,
        SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as cash_amount,
        SUM(CASE WHEN payment_method = 'debit' THEN total ELSE 0 END) as debit_amount,
        SUM(CASE WHEN payment_method = 'qris' THEN total ELSE 0 END) as qris_amount,
        SUM(CASE WHEN payment_method = 'mix' THEN total ELSE 0 END) as mix_amount,
        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as lunas_count,
        SUM(CASE WHEN payment_status IN ('unpaid', 'partial', 'dp') THEN 1 ELSE 0 END) as unpaid_count,
        SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as lunas_amount
       FROM tr_transaction
       WHERE outlet_id = ? AND DATE(created_at) = ?`,
      [targetOutletId, reportDate]
    );

    // Get uang kas expenses from unified pengajuan system (tr_pengajuan_belanja)
    // group_type = 'operasional' = uang makan, bbm_transport, biaya_kantor, biaya_lain
    const [uangKasSummary] = await poolWaschenPos.execute(
      `SELECT
        c.code as category_code,
        COALESCE(SUM(i.total_price), 0) as total
       FROM mst_pengajuan_category c
       LEFT JOIN tr_pengajuan_belanja_item i ON c.id = i.category_id
       LEFT JOIN tr_pengajuan_belanja pb ON i.pengajuan_id = pb.id
         AND pb.outlet_id = ? AND DATE(pb.created_at) = ?
         AND pb.status IN ('approved', 'auto_approved')
         AND pb.source_type = 'operasional'
       WHERE c.is_active = 1 AND c.group_type = 'operasional'
       GROUP BY c.code`,
      [targetOutletId, reportDate]
    );

    // Get deposit amount
    const [depositSummary] = await poolWaschenPos.execute(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM tr_cash_deposit
       WHERE outlet_id = ? AND DATE(created_at) = ?`,
      [targetOutletId, reportDate]
    );

    // Get cash balance (from last session)
    const [cashBalance] = await poolWaschenPos.execute(
      `SELECT current_balance
       FROM tr_cashier_session
       WHERE outlet_id = ? AND DATE(created_at) <= ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [targetOutletId, reportDate]
    );

    // Build category amounts
    const uangKas = {};
    uangKasSummary.forEach(row => {
      uangKas[row.category_code] = parseFloat(row.total || 0);
    });

    const totalExpenses = Object.values(uangKas).reduce((sum, val) => sum + val, 0);
    const totalNonCash = parseFloat(txSummary[0].debit_amount || 0) + parseFloat(txSummary[0].qris_amount || 0) + parseFloat(txSummary[0].mix_amount || 0) / 2;

    // Generate report content
    const reportContent = `📊 *LAPORAN PENJUALAN HARIAN*
━━━━━━━━━━━━━━━━━━
🏪 Outlet : *${outlet.name}*
📅 Tanggal : *${formatDate(reportDate)}*
👤 Kasir : *${cashierNames || '-'}*
━━━━━━━━━━━━━━━━━━

💵 *PEMBAYARAN*
━━━━━━━━━━━━━━━━━━
💵 Tunai : Rp ${formatRp(txSummary[0].cash_amount)}
📱 Non Tunai : Rp ${formatRp(totalNonCash)}
💳 QRIS : Rp ${formatRp(txSummary[0].qris_amount)}
━━━━━━━━━━━━━━━━━━

💰 *TOTAL PENJUALAN : Rp ${formatRp(txSummary[0].total_sales)}*
━━━━━━━━━━━━━━━━━━

📤 *PENGELUARAN*
━━━━━━━━━━━━━━━━━━
🍽️ Biaya Makan : Rp ${formatRp(uangKas.uang_makan || 0)}
🚗 Transport : Rp ${formatRp(uangKas.bbm_transport || 0)}
📦 Biaya Kantor : Rp ${formatRp(uangKas.biaya_kantor || 0)}
📝 Biaya Lain : Rp ${formatRp(uangKas.biaya_lain || 0)}
━━━━━━━━━━━━━━━━━━
💸 Total Pengeluaran : Rp ${formatRp(totalExpenses)}
━━━━━━━━━━━━━━━━━━

💵 *POSISI KAS*
━━━━━━━━━━━━━━━━━━
📥 Setoran : Rp ${formatRp(depositSummary[0].total)}
💵 Sisa Cash : Rp ${formatRp(cashBalance[0]?.current_balance || 0)}
📦 Petty Cash : Rp ${formatRp(totalExpenses)}
━━━━━━━━━━━━━━━━━━

📋 *TRANSAKSI*
━━━━━━━━━━━━━━━━━━
✅ Lunas : ${txSummary[0].lunas_count} nota
⏳ Belum Lunas : ${txSummary[0].unpaid_count} nota
━━━━━━━━━━━━━━━━━━

_Report generated: ${formatTime(new Date())}_
_${outlet.name}_`;

    // Generate data object for frontend
    const reportData = {
      outlet_name: outlet.name,
      date: formatDate(reportDate),
      date_raw: reportDate,
      cashier_names: cashierNames || '-',
      total_count: txSummary[0].total_count || 0,
      cash_amount: formatRp(txSummary[0].cash_amount),
      non_cash_amount: formatRp(totalNonCash),
      qris_amount: formatRp(txSummary[0].qris_amount),
      total_sales: formatRp(txSummary[0].total_sales),
      makan_amount: formatRp(uangKas.uang_makan || 0),
      transport_amount: formatRp(uangKas.bbm_transport || 0),
      kantor_amount: formatRp(uangKas.biaya_kantor || 0),
      lain_amount: formatRp(uangKas.biaya_lain || 0),
      total_expense: formatRp(totalExpenses),
      deposit_amount: formatRp(depositSummary[0].total),
      cash_balance: formatRp(cashBalance[0]?.current_balance || 0),
      uang_kas_balance: formatRp(totalExpenses),
      lunas_count: txSummary[0].lunas_count || 0,
      unpaid_count: txSummary[0].unpaid_count || 0,
      generated_at: formatTime(new Date()),
    };

    return res.json({
      success: true,
      data: {
        content: reportContent,
        formatted: reportData,
        raw: {
          transactions: txSummary[0],
          uang_kas: uangKas,
          sessions: sessionRows,
        },
      },
    });

  } catch (error) {
    logger.error('[generateDailyReport] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal generate report' });
  }
};

// ─── POST /api/daily-reports/send ────────────────────────────────────────────
// Send daily report via WhatsApp
export const sendDailyReport = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const {
      outletId,
      reportDate,
      recipientPhone,
      recipientName,
      reportContent,
    } = req.body;

    const { userId, name: userName } = req.user;

    const targetOutletId = outletId || req.user.outletId;

    if (!reportContent) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Report content diperlukan' });
    }

    if (!recipientPhone) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp diperlukan' });
    }

    // Clean phone number
    const cleanPhone = recipientPhone.replace(/\D/g, '');
    const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

    // Insert log
    const [insertResult] = await conn.execute(
      `INSERT INTO tr_daily_report_log (
        outlet_id, report_date, report_content, recipient_phone, recipient_name,
        sent_via, sent_by, pic_name, sent_at, status
      ) VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, ?, NOW(), 'sent')`,
      [
        targetOutletId,
        reportDate || new Date().toISOString().split('T')[0],
        reportContent,
        waNumber,
        recipientName || 'Unknown',
        userId,
        userName,
      ]
    );

    await conn.commit();

    // TODO: Integrate with WhatsApp API
    // For now, return the message that would be sent
    const waMessage = reportContent;
    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

    logger.info('[sendDailyReport]', { outletId: targetOutletId, recipient: waNumber, by: userName });

    return res.json({
      success: true,
      message: 'Report siap dikirim via WhatsApp',
      data: {
        log_id: insertResult.insertId,
        wa_link: waLink,
        recipient: waNumber,
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[sendDailyReport] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal mengirim report' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/daily-reports/history ──────────────────────────────────────────
// Get report history
export const getReportHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, outletId, dateFrom, dateTo } = req.query;
    const { userId, outletId: tokenOutletId, role } = req.user;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions = ['1=1'];
    const params = [];

    if (role === 'frontline') {
      if (tokenOutletId) {
        conditions.push('r.outlet_id = ?');
        params.push(tokenOutletId);
      }
    } else if (outletId) {
      conditions.push('r.outlet_id = ?');
      params.push(outletId);
    }

    if (dateFrom) {
      conditions.push('r.report_date >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('r.report_date <= ?');
      params.push(dateTo);
    }

    const whereClause = conditions.join(' AND ');

    const [rows] = await poolWaschenPos.execute(
      `SELECT r.*, o.name as outlet_name, u.name as sent_by_name
       FROM tr_daily_report_log r
       JOIN mst_outlet o ON r.outlet_id = o.id
       LEFT JOIN mst_user u ON r.sent_by = u.id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [countResult] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total FROM tr_daily_report_log r WHERE ${whereClause}`,
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
    logger.error('[getReportHistory] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil history' });
  }
};

// ─── GET /api/daily-reports/templates ────────────────────────────────────────
// Get available templates
export const getTemplates = async (req, res) => {
  try {
    const [rows] = await poolWaschenPos.execute(
      'SELECT * FROM mst_daily_report_template WHERE is_active = 1 ORDER BY id'
    );

    return res.json({
      success: true,
      data: rows,
    });

  } catch (error) {
    logger.error('[getTemplates] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil templates' });
  }
};
