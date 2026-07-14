// ─────────────────────────────────────────────────────────────────────────────
// birthdayAutomationController.js — Birthday Automation System
// Phase 5-7: Birthday Automation with Promotional Campaigns
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { rp } from '../utils/helpers.js';
import logger from '../utils/logger.js';

// ─── Birthday Campaign Config ────────────────────────────────────────────────
const CAMPAIGN_TYPES = {
  GREETING: 'greeting',
  DISCOUNT: 'discount',
  DEPOSIT_BONUS: 'deposit_bonus',
  FREE_SERVICE: 'free_service',
};

const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ENDED: 'ended',
};

// ─── Helper: Get config value ────────────────────────────────────────────────
async function getConfig(key, defaultValue = null) {
  try {
    const [[row]] = await poolWaschenPos.execute(
      'SELECT config_val FROM mst_app_config WHERE config_key = ? AND is_active = 1 LIMIT 1',
      [key]
    );
    return row?.config_val ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

// ─── Helper: Check if birthday notification already sent ───────────────────
async function hasSentToday(customerId, campaignType) {
  const today = new Date().toISOString().slice(0, 10);
  const [rows] = await poolWaschenPos.execute(
    `SELECT id FROM tr_birthday_notification
     WHERE customer_id = ? AND campaign_type = ? AND DATE(sent_at) = ? LIMIT 1`,
    [customerId, campaignType, today]
  );
  return rows.length > 0;
}

// ─── GET /api/birthday/today — Get today's birthdays ───────────────────────
export const getTodayBirthdays = async (req, res) => {
  try {
    const userRole = req.user?.roleCode;
    const userOutletId = req.user?.outletId;
    const isGlobal = ['admin'].includes(userRole);

    // Get customers with birthday today
    let outletFilter = '';
    const params = [];
    if (!isGlobal && userOutletId) {
      outletFilter = 'AND c.registered_outlet_id = ?';
      params.push(userOutletId);
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.gender,
              c.birth_date, c.birth_month, c.birth_day,
              w.balance as depositBalance,
              o.name as outletName,
              tx.tx_count as transactionCount,
              tx.total_spending as totalSpending,
              tx.last_tx_date as lastTransactionDate
       FROM mst_customer c
       LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
       LEFT JOIN mst_outlet o ON o.id = c.registered_outlet_id
       LEFT JOIN (
         SELECT customer_id, COUNT(*) as tx_count, SUM(total) as total_spending, MAX(created_at) as last_tx_date
         FROM tr_transaction
         WHERE deleted_at IS NULL AND status != 'cancelled'
         GROUP BY customer_id
       ) tx ON tx.customer_id = c.id
       WHERE c.is_active = 1
         AND c.deleted_at IS NULL
         AND c.birth_day = DAY(CURDATE())
         AND c.birth_month = MONTH(CURDATE())
         ${outletFilter}
       ORDER BY c.name`,
      params
    );

    // Check which ones have been notified today
    const notifiedIds = new Set();
    const [notifRows] = await poolWaschenPos.execute(
      `SELECT customer_id FROM tr_birthday_notification
       WHERE campaign_type = ? AND DATE(sent_at) = CURDATE()`,
      [CAMPAIGN_TYPES.GREETING]
    );
    notifRows.forEach(r => notifiedIds.add(r.customer_id));

    // Group by notification status
    const toNotify = [];
    const alreadyNotified = [];

    rows.forEach(c => {
      const hasNotified = notifiedIds.has(c.id);
      const data = {
        id: c.id,
        name: c.name,
        phone: c.phone,
        gender: c.gender,
        birthDate: c.birth_date,
        depositBalance: Number(c.depositBalance || 0),
        outletName: c.outletName,
        transactionCount: Number(c.transactionCount || 0),
        totalSpending: Number(c.totalSpending || 0),
        lastTransactionDate: c.lastTransactionDate,
        notified: hasNotified,
      };
      if (hasNotified) {
        alreadyNotified.push(data);
      } else {
        toNotify.push(data);
      }
    });

    return res.json({
      success: true,
      data: {
        date: new Date().toISOString().slice(0, 10),
        total: rows.length,
        toNotify: toNotify.length,
        alreadyNotified: alreadyNotified.length,
        customers: rows.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          gender: c.gender,
          depositBalance: Number(c.depositBalance || 0),
          outletName: c.outletName,
          transactionCount: Number(c.transactionCount || 0),
          totalSpending: Number(c.totalSpending || 0),
          lastTransactionDate: c.lastTransactionDate,
          notified: notifiedIds.has(c.id),
        })),
        toNotify,
        alreadyNotified,
      },
    });
  } catch (err) {
    logger.error('Get today birthdays gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data.' });
  }
};

// ─── GET /api/birthday/upcoming — Get upcoming birthdays (7 days) ──────────
export const getUpcomingBirthdays = async (req, res) => {
  try {
    const days = Number(req.query.days) || 7;
    const { search } = req.query;

    let searchFilter = '';
    const params = [days];
    if (search && search.trim()) {
      searchFilter = 'AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    const [rows] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.birth_month, c.birth_day,
              DATEDIFF(DATE(CONCAT(YEAR(CURDATE()), '-', LPAD(c.birth_month, 2, '0'), '-', LPAD(c.birth_day, 2, '0')) , CURDATE()) +
              CASE
                WHEN DATE(CONCAT(YEAR(CURDATE()), '-', LPAD(c.birth_month, 2, '0'), '-', LPAD(c.birth_day, 2, '0')) < CURDATE()
                THEN 365 ELSE 0
              END as daysUntil
       FROM mst_customer c
       WHERE c.is_active = 1
         AND c.deleted_at IS NULL
         AND c.birth_month IS NOT NULL
         AND c.birth_day IS NOT NULL
         AND DATEDIFF(DATE(CONCAT(YEAR(CURDATE()), '-', LPAD(c.birth_month, 2, '0'), '-', LPAD(c.birth_day, 2, '0')) , CURDATE()) +
              CASE
                WHEN DATE(CONCAT(YEAR(CURDATE()), '-', LPAD(c.birth_month, 2, '0'), '-', LPAD(c.birth_day, 2, '0')) < CURDATE()
                THEN 365 ELSE 0
              END BETWEEN 1 AND ?
         ${searchFilter}
       ORDER BY daysUntil`,
      params
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        birthMonth: r.birth_month,
        birthDay: r.birth_day,
        daysUntil: Number(r.daysUntil),
        formattedDate: `${r.birth_day}/${String(r.birth_month).padStart(2, '0')}`,
      })),
    });
  } catch (err) {
    logger.error('Get upcoming birthdays gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat data.' });
  }
};

// ─── POST /api/birthday/send — Send birthday greeting ───────────────────────
export const sendBirthdayGreeting = async (req, res) => {
  try {
    const { customerId, messageType = 'greeting', customMessage } = req.body;
    const userId = req.user?.userId;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID wajib diisi.' });
    }

    // Get customer data
    const [custRows] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.gender,
              DATE_FORMAT(CURDATE(), '%d %M %Y') as todayFormatted
       FROM mst_customer c
       WHERE c.id = ? AND c.is_active = 1`,
      [customerId]
    );

    if (custRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }

    const customer = custRows[0];

    // Check if already sent today
    if (await hasSentToday(customerId, CAMPAIGN_TYPES.GREETING)) {
      return res.status(409).json({
        success: false,
        message: 'Sudah ada notifikasi terkirim hari ini untuk customer ini.'
      });
    }

    // Build greeting message
    const greeting = customer.gender === 'male' ? 'Bapak' : 'Ibu';
    let message = customMessage;
    if (!message) {
      const templates = [
        `Selamat ulang tahun, ${greeting} ${customer.name}! 🎂\n\nSemoga tahun ini penuh kebahagiaan dan keberkahan. Terima kasih sudah menjadi bagian dari keluarga Waschen!`,
        `Happy Birthday, ${greeting} ${customer.name}! 🎉\n\nDi hari spesial ini, kami ucapkan semua harapan baik untuk ${greeting.includes('Bapak') ? 'Bapak' : 'Ibu'}. Selamat ulang tahun! 🎂✨`,
      ];
      message = templates[Math.floor(Math.random() * templates.length)];
    }

    // Send via WhatsApp (placeholder - integrate with WhatsApp API)
    let sent = false;
    let messageId = null;
    try {
      // TODO: Integrate with WhatsApp API
      // const waResult = await sendWhatsApp(customer.phone, message);
      // sent = waResult.success;
      // messageId = waResult.messageId;
      // [Birthday] Simulation mode - would send notification
      sent = true; // Simulated for now
    } catch (waErr) {
      logger.error('WhatsApp send failed', { error: waErr.message });
    }

    // Log notification
    await poolWaschenPos.execute(
      `INSERT INTO tr_birthday_notification (
        customer_id, campaign_type, message, message_type,
        status, sent_via, sent_by, sent_at
      ) VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, NOW())`,
      [
        customerId,
        CAMPAIGN_TYPES.GREETING,
        message,
        messageType,
        sent ? 'sent' : 'failed',
        userId,
      ]
    );

    // Audit log
    writeAudit(poolWaschenPos, {
      userId,
      entityType: 'birthday_notification',
      entityId: customerId,
      action: 'send_birthday_greeting',
      newData: { customerName: customer.name, messageType },
      req,
    }).catch(() => {});

    return res.json({
      success: true,
      message: sent
        ? `Ucapan ulang tahun berhasil dikirim ke ${customer.phone}!`
        : 'Gagal mengirim. Coba lagi nanti.',
      data: {
        customerId,
        customerName: customer.name,
        phone: customer.phone,
        sent,
        message,
      },
    });
  } catch (err) {
    logger.error('Send birthday greeting gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengirim ucapan.' });
  }
};

// ─── POST /api/birthday/send-bulk — Bulk send birthday greetings ───────────
export const sendBulkBirthdayGreeting = async (req, res) => {
  try {
    const { customerIds, messageType = 'greeting', customMessage } = req.body;
    const userId = req.user?.userId;

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Minimal 1 customer harus dipilih.' });
    }

    // Get customers
    const placeholders = customerIds.map(() => '?').join(',');
    const [custRows] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.gender
       FROM mst_customer c
       WHERE c.id IN (${placeholders}) AND c.is_active = 1`,
      customerIds
    );

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const customer of custRows) {
      // Skip if already notified today
      if (await hasSentToday(customer.id, CAMPAIGN_TYPES.GREETING)) {
        results.push({
          customerId: customer.id,
          name: customer.name,
          phone: customer.phone,
          status: 'skipped',
          reason: 'Sudah dikirim hari ini',
        });
        continue;
      }

      const greeting = customer.gender === 'male' ? 'Bapak' : 'Ibu';
      let message = customMessage;
      if (!message) {
        message = `Selamat ulang tahun, ${greeting} ${customer.name}! 🎂\n\nSemoga tahun ini penuh kebahagiaan. Terima kasih sudah menjadi bagian dari keluarga Waschen!`;
      }

      let sent = false;
      try {
        // TODO: Integrate with WhatsApp API
        // [Birthday Bulk] Simulation mode - would send notification
        sent = true; // Simulated
      } catch (e) {
        logger.warn('birthday', 'Bulk send failed', { error: e.message, phone: customer.phone });
      }

      // Log notification
      await poolWaschenPos.execute(
        `INSERT INTO tr_birthday_notification (
          customer_id, campaign_type, message, message_type,
          status, sent_via, sent_by, sent_at
        ) VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, NOW())`,
        [
          customer.id,
          CAMPAIGN_TYPES.GREETING,
          message,
          messageType,
          sent ? 'sent' : 'failed',
          userId,
        ]
      );

      results.push({
        customerId: customer.id,
        name: customer.name,
        phone: customer.phone,
        status: sent ? 'sent' : 'failed',
      });

      if (sent) successCount++;
      else failCount++;
    }

    return res.json({
      success: true,
      message: `Selesai. ${successCount} terkirim, ${failCount} gagal.`,
      data: {
        total: customerIds.length,
        success: successCount,
        failed: failCount,
        skipped: customerIds.length - custRows.length,
        results,
      },
    });
  } catch (err) {
    logger.error('Send bulk birthday greeting gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal mengirim bulk.' });
  }
};

// ─── POST /api/birthday/offer-deposit-bonus — Offer deposit bonus ─────────
export const offerDepositBonus = async (req, res) => {
  try {
    const { customerId, bonusAmount, message } = req.body;
    const userId = req.user?.userId;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID wajib diisi.' });
    }

    const bonus = Number(bonusAmount) || Number(await getConfig('birthday_deposit_bonus_default', 50000));

    // Get customer
    const [custRows] = await poolWaschenPos.execute(
      `SELECT c.id, c.name, c.phone, c.gender, w.balance
       FROM mst_customer c
       LEFT JOIN mst_customer_wallet w ON w.customer_id = c.id
       WHERE c.id = ? AND c.is_active = 1`,
      [customerId]
    );

    if (custRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan.' });
    }

    const customer = custRows[0];

    // Check if already sent today
    if (await hasSentToday(customerId, CAMPAIGN_TYPES.DEPOSIT_BONUS)) {
      return res.status(409).json({
        success: false,
        message: 'Offer bonus sudah dikirim hari ini.'
      });
    }

    const greeting = customer.gender === 'male' ? 'Bapak' : 'Ibu';
    const finalMessage = message || `Hai ${greeting} ${customer.name}! 🎁\n\nSebagai hadiah ulang tahun, Waschen berikan bonus deposit Rp ${bonus.toLocaleString('id-ID')} yang bisa digunakan kapan saja!`;

    // Create offer record
    const [result] = await poolWaschenPos.execute(
      `INSERT INTO tr_birthday_offer (
        customer_id, offer_type, bonus_amount, message,
        status, expires_at, created_by, created_at
      ) VALUES (?, ?, ?, ?, 'pending', DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, NOW())`,
      [customerId, CAMPAIGN_TYPES.DEPOSIT_BONUS, bonus, finalMessage, userId]
    );

    // Log notification
    await poolWaschenPos.execute(
      `INSERT INTO tr_birthday_notification (
        customer_id, campaign_type, message, message_type,
        status, sent_via, sent_by, sent_at,
        offer_id
      ) VALUES (?, ?, ?, 'deposit_bonus_offer', 'sent', 'whatsapp', ?, NOW(), ?)`,
      [customerId, CAMPAIGN_TYPES.DEPOSIT_BONUS, finalMessage, userId, result.insertId]
    );

    return res.json({
      success: true,
      message: `Bonus deposit Rp ${bonus.toLocaleString('id-ID')} berhasil di-offer ke ${customer.phone}`,
      data: {
        customerId,
        customerName: customer.name,
        bonusAmount: bonus,
        offerId: result.insertId,
        expiresIn: '30 days',
      },
    });
  } catch (err) {
    logger.error('Offer deposit bonus gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal membuat offer.' });
  }
};

// ─── GET /api/birthday/stats — Birthday campaign statistics ─────────────────
export const getBirthdayStats = async (req, res) => {
  try {
    const month = Number(req.query.month) || new Date().getMonth() + 1;
    const year = Number(req.query.year) || new Date().getFullYear();

    // Notifications this month
    const [monthStats] = await poolWaschenPos.execute(
      `SELECT
         DATE(sent_at) as date,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM tr_birthday_notification
       WHERE campaign_type IN (?, ?)
         AND YEAR(sent_at) = ?
         AND MONTH(sent_at) = ?
       GROUP BY DATE(sent_at)
       ORDER BY date DESC`,
      [CAMPAIGN_TYPES.GREETING, CAMPAIGN_TYPES.DEPOSIT_BONUS, year, month]
    );

    // Pending offers
    const [pendingOffers] = await poolWaschenPos.execute(
      `SELECT bo.id, bo.customer_id, c.name, bo.bonus_amount, bo.created_at
       FROM tr_birthday_offer bo
       JOIN mst_customer c ON c.id = bo.customer_id
       WHERE bo.status = 'pending'
         AND bo.expires_at >= CURDATE()
       ORDER BY bo.created_at DESC
       LIMIT 20`
    );

    // Total customers with birthday this month
    const [birthdayCount] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total
       FROM mst_customer
       WHERE is_active = 1
         AND deleted_at IS NULL
         AND birth_month = ?`,
      [month]
    );

    return res.json({
      success: true,
      data: {
        month,
        year,
        totalCustomersWithBirthday: Number(birthdayCount[0]?.total || 0),
        dailyStats: monthStats.map(s => ({
          date: s.date,
          total: Number(s.total),
          sent: Number(s.sent),
          failed: Number(s.failed),
        })),
        pendingOffers: pendingOffers.map(o => ({
          id: o.id,
          customerId: o.customer_id,
          customerName: o.name,
          bonusAmount: Number(o.bonus_amount),
          createdAt: o.created_at,
        })),
      },
    });
  } catch (err) {
    logger.error('Get birthday stats gagal', { error: err.message });
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik.' });
  }
};
