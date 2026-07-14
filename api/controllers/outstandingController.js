// ─────────────────────────────────────────────────────────────────────────────
// Outstanding/Receivables Controller
// Handles customer debt tracking and payment reminders
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { writeAudit } from '../utils/auditLog.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Outstanding');

// ─── Status Constants ─────────────────────────────────────────────────────────
const OUTSTANDING_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  OVERDUE: 'overdue',
  WRITTEN_OFF: 'written_off',
};

// ─── Generate Outstanding Invoice No ───────────────────────────────────────────
const generateOutstandingNo = async (conn, outletId) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const datePrefix = `OS-${yy}${mm}-`;

  const [rows] = await conn.execute(
    `SELECT invoice_no FROM tr_outstanding
     WHERE outlet_id = ? AND invoice_no LIKE ?
     ORDER BY invoice_no DESC LIMIT 1 FOR UPDATE`,
    [outletId, `${datePrefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].invoice_no;
    const lastSeqStr = lastNo.slice(datePrefix.length);
    const lastSeq = parseInt(lastSeqStr, 10);
    if (Number.isFinite(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${datePrefix}${String(nextSeq).padStart(4, '0')}`;
};

// ─── POST /api/outstandings ────────────────────────────────────────────────────
// Create new outstanding record
export const createOutstanding = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const {
      transactionId,
      customerId,
      amount,
      dueDate,
      principalName,
      phone,
      notes,
    } = req.body;

    const { userId, outletId: tokenOutletId, name: userName } = req.user;

    // Validation
    if (!customerId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Customer ID wajib diisi' });
    }

    if (!amount || parseFloat(amount) <= 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Jumlah piutang harus lebih dari 0' });
    }

    // Get outlet from transaction or token
    let outletId = tokenOutletId;
    if (transactionId) {
      const [txRows] = await conn.execute(
        'SELECT outlet_id FROM tr_transaction WHERE id = ?',
        [transactionId]
      );
      if (txRows.length > 0) {
        outletId = txRows[0].outlet_id;
      }
    }

    if (!outletId) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Outlet ID tidak ditemukan' });
    }

    // Verify customer exists
    const [custRows] = await conn.execute(
      'SELECT id, name, phone FROM mst_customer WHERE id = ?',
      [customerId]
    );

    if (custRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Customer tidak ditemukan' });
    }

    const customer = custRows[0];
    const invoiceNo = await generateOutstandingNo(conn, outletId);

    // Insert outstanding
    const [insertResult] = await conn.execute(
      `INSERT INTO tr_outstanding (
        outlet_id, transaction_id, customer_id, invoice_no,
        principal_name, phone, amount, due_date, notes,
        created_by, pic_name, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid')`,
      [
        outletId,
        transactionId || null,
        customerId,
        invoiceNo,
        principalName || customer.name,
        phone || customer.phone,
        amount,
        dueDate || null,
        notes || null,
        userId,
        userName || 'Unknown',
      ]
    );

    await conn.commit();

    const outstandingId = insertResult.insertId;

    logger.info('[createOutstanding]', { outstandingId, invoiceNo, customerId, amount });

    return res.status(201).json({
      success: true,
      message: 'Piutang berhasil dicatat',
      data: {
        id: outstandingId,
        invoice_no: invoiceNo,
        customer_id: customerId,
        customer_name: customer.name,
        amount: parseFloat(amount),
        status: 'unpaid',
        due_date: dueDate,
        created_at: new Date().toISOString(),
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[createOutstanding] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal membuat piutang' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/outstandings ────────────────────────────────────────────────────
export const getOutstandings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      outletId,
      status,
      customerId,
      dateFrom,
      dateTo,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = req.query;

    const { userId, outletId: tokenOutletId, role } = req.user;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const offsetNum = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions = ['1=1'];
    const params = [];

    // Boundary enforcement
    if (role === 'frontline') {
      if (tokenOutletId) {
        conditions.push('o.outlet_id = ?');
        params.push(tokenOutletId);
      }
    } else if (outletId) {
      conditions.push('o.outlet_id = ?');
      params.push(outletId);
    }

    if (status) {
      conditions.push('o.status = ?');
      params.push(status);
    }

    if (customerId) {
      conditions.push('o.customer_id = ?');
      params.push(customerId);
    }

    if (dateFrom) {
      conditions.push('DATE(o.created_at) >= ?');
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push('DATE(o.created_at) <= ?');
      params.push(dateTo);
    }

    if (search) {
      conditions.push('(o.invoice_no LIKE ? OR o.principal_name LIKE ? OR c.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.join(' AND ');
    const validSortColumns = ['created_at', 'due_date', 'amount', 'remaining_amount', 'status'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Query - LIMIT/OFFSET must be integers for mysql2 execute()
    const safeLimit = Math.max(1, Math.min(parseInt(limitNum, 10) || 20, 200));
    const safeOffset = Math.max(0, parseInt(offsetNum, 10) || 0);
    const [rows] = await poolWaschenPos.execute(
      `SELECT o.*,
              c.name as customer_name, c.phone as customer_phone, c.is_member as is_member,
              ot.name as outlet_name,
              u.name as created_by_name
       FROM tr_outstanding o
       LEFT JOIN mst_customer c ON o.customer_id = c.id
       LEFT JOIN mst_outlet ot ON o.outlet_id = ot.id
       LEFT JOIN mst_user u ON o.created_by = u.id
       WHERE ${whereClause}
       ORDER BY o.${sortColumn} ${order}
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    // Count
    const [countResult] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total FROM tr_outstanding o WHERE ${whereClause}`,
      params
    );

    // Summary by status
    const [summary] = await poolWaschenPos.execute(
      `SELECT
        COUNT(*) as total_count,
        SUM(o.amount) as total_amount,
        SUM(o.paid_amount) as total_paid,
        SUM(o.remaining_amount) as total_remaining,
        SUM(CASE WHEN o.status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
        SUM(CASE WHEN o.status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        SUM(CASE WHEN o.status = 'overdue' THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) as paid_count
       FROM tr_outstanding o
       WHERE ${whereClause}`,
      params
    );

    return res.json({
      success: true,
      data: rows,
      summary: summary[0],
      pagination: {
        page: pageNum,
        limit: safeLimit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / safeLimit),
      },
    });

  } catch (error) {
    logger.error('[getOutstandings] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data piutang' });
  }
};

// ─── GET /api/outstandings/:id ────────────────────────────────────────────────
export const getOutstandingById = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, outletId: tokenOutletId, role } = req.user;

    const [rows] = await poolWaschenPos.execute(
      `SELECT o.*,
              c.name as customer_name, c.phone as customer_phone, c.is_member as is_member, c.address,
              ot.name as outlet_name,
              u.name as created_by_name,
              t.transaction_no, t.total as transaction_total
       FROM tr_outstanding o
       LEFT JOIN mst_customer c ON o.customer_id = c.id
       LEFT JOIN mst_outlet ot ON o.outlet_id = ot.id
       LEFT JOIN mst_user u ON o.created_by = u.id
       LEFT JOIN tr_transaction t ON o.transaction_id = t.id
       WHERE o.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Piutang tidak ditemukan' });
    }

    const outstanding = rows[0];

    // Boundary check
    if ((role === 'frontline') && tokenOutletId && outstanding.outlet_id !== tokenOutletId) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }

    // Get payment history
    const [payments] = await poolWaschenPos.execute(
      `SELECT p.*, u.name as paid_by_name
       FROM tr_outstanding_payment p
       LEFT JOIN mst_user u ON p.paid_by = u.id
       WHERE p.outstanding_id = ?
       ORDER BY p.created_at DESC`,
      [id]
    );

    // Get reminder history
    const [reminders] = await poolWaschenPos.execute(
      `SELECT r.*, u.name as sent_by_name
       FROM tr_outstanding_reminder r
       LEFT JOIN mst_user u ON r.sent_by = u.id
       WHERE r.outstanding_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...outstanding,
        payments,
        reminders,
      },
    });

  } catch (error) {
    logger.error('[getOutstandingById] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil detail piutang' });
  }
};

// ─── POST /api/outstandings/:id/payment ────────────────────────────────────────
// Record a payment towards outstanding
export const recordPayment = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const {
      amount,
      paymentMethod = 'cash',
      referenceNo,
      notes,
    } = req.body;

    const { userId, name: userName } = req.user;

    if (!amount || parseFloat(amount) <= 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'Jumlah pembayaran harus lebih dari 0' });
    }

    // Get outstanding
    const [outRows] = await conn.execute(
      'SELECT * FROM tr_outstanding WHERE id = ? FOR UPDATE',
      [id]
    );

    if (outRows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Piutang tidak ditemukan' });
    }

    const outstanding = outRows[0];

    if (outstanding.status === 'paid') {
      conn.release();
      return res.status(400).json({ success: false, message: 'Piutang sudah lunas' });
    }

    const paymentAmount = parseFloat(amount);
    const newPaidAmount = parseFloat(outstanding.paid_amount) + paymentAmount;
    const newStatus = newPaidAmount >= parseFloat(outstanding.amount) ? 'paid' : 'partial';

    // Insert payment record
    await conn.execute(
      `INSERT INTO tr_outstanding_payment (outstanding_id, amount, payment_method, reference_no, paid_by, pic_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, paymentAmount, paymentMethod, referenceNo || null, userId, userName, notes || null]
    );

    // Update outstanding
    await conn.execute(
      `UPDATE tr_outstanding
       SET paid_amount = ?, status = ?, paid_at = CASE WHEN ? >= amount THEN NOW() ELSE paid_at END
       WHERE id = ?`,
      [newPaidAmount, newStatus, newPaidAmount, id]
    );

    await conn.commit();

    logger.info('[recordPayment]', { outstandingId: id, amount: paymentAmount, newStatus });

    return res.json({
      success: true,
      message: newStatus === 'paid' ? 'Piutang sudah lunas!' : 'Pembayaran berhasil dicatat',
      data: {
        id,
        paid_amount: newPaidAmount,
        remaining_amount: parseFloat(outstanding.amount) - newPaidAmount,
        status: newStatus,
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[recordPayment] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal mencatat pembayaran' });
  } finally {
    conn.release();
  }
};

// ─── POST /api/outstandings/:id/reminder ───────────────────────────────────────
// Send reminder (WA/Call)
export const sendReminder = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { reminderType = 'wa', message } = req.body;

    const { userId, name: userName } = req.user;

    // Get outstanding
    const [rows] = await conn.execute(
      'SELECT * FROM tr_outstanding WHERE id = ? FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Piutang tidak ditemukan' });
    }

    const outstanding = rows[0];

    // Log reminder
    await conn.execute(
      `INSERT INTO tr_outstanding_reminder (outstanding_id, reminder_type, sent_to, message_preview, sent_by, pic_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, reminderType, outstanding.phone, message || null, userId, userName]
    );

    // Update reminder count
    await conn.execute(
      `UPDATE tr_outstanding
       SET reminder_count = reminder_count + 1, last_reminder_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await conn.commit();

    logger.info('[sendReminder]', { outstandingId: id, type: reminderType });

    return res.json({
      success: true,
      message: 'Reminder berhasil dikirim',
      data: {
        reminder_count: outstanding.reminder_count + 1,
      },
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[sendReminder] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal mengirim reminder' });
  } finally {
    conn.release();
  }
};

// ─── PATCH /api/outstandings/:id/close ─────────────────────────────────────────
// Write off outstanding
export const writeOffOutstanding = async (req, res) => {
  const conn = await poolWaschenPos.getConnection();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { userId, name: userName, role } = req.user;

    // Only admin can write off
    if (role !== 'admin') {
      conn.release();
      return res.status(403).json({ success: false, message: 'Hanya admin yang dapat menTulis off piutang' });
    }

    const [rows] = await conn.execute(
      'SELECT * FROM tr_outstanding WHERE id = ? AND status NOT IN ("paid", "written_off") FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Piutang tidak ditemukan atau sudah lunas' });
    }

    await conn.execute(
      `UPDATE tr_outstanding
       SET status = 'written_off', notes = CONCAT(IFNULL(notes, ''), '\nWrite-off: ', ?)
       WHERE id = ?`,
      [reason || `Write-off by ${userName}`, id]
    );

    await conn.commit();

    logger.info('[writeOffOutstanding]', { outstandingId: id, by: userName });

    return res.json({
      success: true,
      message: 'Piutang berhasil di-write off',
    });

  } catch (error) {
    await conn.rollback();
    logger.error('[writeOffOutstanding] Error:', error);
    conn.release();
    return res.status(500).json({ success: false, message: 'Gagal write-off piutang' });
  } finally {
    conn.release();
  }
};

// ─── GET /api/outstandings/dashboard ──────────────────────────────────────────
// Get summary for dashboard
export const getOutstandingDashboard = async (req, res) => {
  try {
    const { outletId } = req.query;
    const { userId, outletId: tokenOutletId, role } = req.user;

    const conditions = ['1=1'];
    const params = [];

    if (role === 'frontline') {
      if (tokenOutletId) {
        conditions.push('o.outlet_id = ?');
        params.push(tokenOutletId);
      }
    } else if (outletId) {
      conditions.push('o.outlet_id = ?');
      params.push(outletId);
    }

    const whereClause = conditions.join(' AND ');

    // Summary by status
    const [statusSummary] = await poolWaschenPos.execute(
      `SELECT
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        SUM(remaining_amount) as total_remaining
       FROM tr_outstanding o
       WHERE ${whereClause}
       GROUP BY status`,
      params
    );

    // Overdue items (past due date, not paid)
    const [overdueItems] = await poolWaschenPos.execute(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone,
              DATEDIFF(CURDATE(), o.due_date) as days_overdue
       FROM tr_outstanding o
       LEFT JOIN mst_customer c ON o.customer_id = c.id
       WHERE ${whereClause}
         AND o.status NOT IN ('paid', 'written_off')
         AND o.due_date < CURDATE()
       ORDER BY days_overdue DESC
       LIMIT 10`,
      params
    );

    // Recent payments - use separate conditions since table alias is same
    const paymentConditions = ['1=1'];
    const paymentParams = [];

    // Same boundary as main query
    if (role === 'frontline') {
      if (tokenOutletId) {
        paymentConditions.push('o.outlet_id = ?');
        paymentParams.push(tokenOutletId);
      }
    } else if (outletId) {
      paymentConditions.push('o.outlet_id = ?');
      paymentParams.push(outletId);
    }

    const paymentWhere = paymentConditions.join(' AND ');

    const [recentPayments] = await poolWaschenPos.execute(
      `SELECT p.*, o.invoice_no, c.name as customer_name
       FROM tr_outstanding_payment p
       JOIN tr_outstanding o ON p.outstanding_id = o.id
       LEFT JOIN mst_customer c ON o.customer_id = c.id
       WHERE ${paymentWhere}
       ORDER BY p.created_at DESC
       LIMIT 5`,
      paymentParams
    );

    // Calculate totals
    const totals = {
      total_piutang: 0,
      total_remaining: 0,
      total_paid: 0,
      unpaid: 0,
      partial: 0,
      overdue: 0,
    };

    statusSummary.forEach(s => {
      totals.total_piutang += parseFloat(s.total_amount || 0);
      totals.total_remaining += parseFloat(s.total_remaining || 0);
      if (s.status === 'unpaid') totals.unpaid = s.count;
      if (s.status === 'partial') totals.partial = s.count;
      if (s.status === 'overdue') totals.overdue = s.count;
    });

    totals.total_paid = totals.total_piutang - totals.total_remaining;

    return res.json({
      success: true,
      data: {
        summary: totals,
        overdueItems,
        recentPayments,
      },
    });

  } catch (error) {
    logger.error('[getOutstandingDashboard] Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil dashboard piutang' });
  }
};
