// ─────────────────────────────────────────────────────────────────────────────
// errorTrackingController.js — Error Tracking System
// Phase 8: Technical Debt & Optimization
// ─────────────────────────────────────────────────────────────────────────────
import { poolWaschenPos } from '../db/connection.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ErrorTracking');

// ─── Helper: Sanitize request data (remove sensitive info) ─────────────────────
function sanitizeRequest(req) {
  const sanitized = {
    method: req.method,
    endpoint: req.originalUrl || req.url,
    query_params: JSON.stringify(req.query || {}),
    ip_address: req.ip || req.connection?.remoteAddress,
    user_agent: req.get('user-agent'),
  };

  // Remove sensitive fields from body
  const sensitiveFields = ['password', 'token', 'secret', 'api_key', 'authorization', 'cookie', 'credit_card'];
  const body = { ...req.body };
  for (const field of sensitiveFields) {
    if (body[field]) body[field] = '[REDACTED]';
  }

  // Truncate large bodies
  const bodyStr = JSON.stringify(body);
  sanitized.request_body = bodyStr.length > 2000 ? bodyStr.substring(0, 2000) + '...[TRUNCATED]' : bodyStr;

  return sanitized;
}

// ─── Helper: Determine severity from error ─────────────────────────────────────
function determineSeverity(error) {
  const message = (error?.message || '').toLowerCase();
  const type = error?.constructor?.name || '';

  // Critical: database, authentication, payment errors
  if (message.includes('er_dump') || message.includes('connection refused') ||
      message.includes('authentication') || message.includes('payment')) {
    return 'critical';
  }

  // High: validation, not found
  if (message.includes('validation') || message.includes('not found') ||
      message.includes('unauthorized') || message.includes('forbidden')) {
    return 'high';
  }

  // Medium: general errors
  return 'medium';
}

// ─── POST /api/errors/log — Log an error (from frontend) ─────────────────────
export const logFrontendError = async (req, res) => {
  try {
    const {
      errorType,
      errorMessage,
      errorCode,
      stackTrace,
      componentStack,
      severity = 'medium',
    } = req.body;

    const userId = req.user?.userId;
    const userRole = req.user?.roleCode;
    const requestData = sanitizeRequest(req);

    // Truncate stack trace
    const truncatedStack = stackTrace?.substring(0, 4000) || null;
    const truncatedComponentStack = componentStack?.substring(0, 2000) || null;

    // Combine stacks
    const fullStack = [truncatedStack, truncatedComponentStack]
      .filter(Boolean)
      .join('\n\nComponent Stack:\n');

    await poolWaschenPos.execute(
      `INSERT INTO tr_error_log (
        error_type, error_message, error_code, stack_trace,
        method, endpoint, query_params, request_body,
        user_id, user_role, session_id,
        ip_address, user_agent,
        severity, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        errorType || 'Unknown',
        errorMessage || 'No message provided',
        errorCode || null,
        fullStack,
        requestData.method,
        requestData.endpoint,
        requestData.query_params,
        requestData.request_body,
        userId || null,
        userRole || null,
        req.headers['x-session-id'] || null,
        requestData.ip_address,
        requestData.user_agent,
        ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium',
      ]
    );

    logger.info('Frontend error logged', { errorType, errorMessage, userId });

    return res.status(201).json({
      success: true,
      message: 'Error logged successfully',
    });
  } catch (err) {
    logger.error('Failed to log frontend error', err.message);
    // Don't fail the request, just return success anyway
    return res.status(201).json({
      success: true,
      message: 'Error logged',
    });
  }
};

// ─── GET /api/errors — Get error logs (admin only) ───────────────────────────
export const getErrorLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      severity,
      status,
      errorType,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let where = '1=1';
    const params = [];

    if (severity) {
      where += ' AND e.severity = ?';
      params.push(severity);
    }

    if (status) {
      where += ' AND e.status = ?';
      params.push(status);
    }

    if (errorType) {
      where += ' AND e.error_type LIKE ?';
      params.push(`%${errorType}%`);
    }

    if (startDate) {
      where += ' AND e.occurred_at >= ?';
      params.push(new Date(startDate));
    }

    if (endDate) {
      where += ' AND e.occurred_at <= ?';
      params.push(new Date(endDate));
    }

    if (search) {
      where += ' AND (e.error_message LIKE ? OR e.error_type LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const [[{ total }]] = await poolWaschenPos.execute(
      `SELECT COUNT(*) as total FROM tr_error_log e WHERE ${where}`,
      params
    );

    // Get rows
    const [rows] = await poolWaschenPos.execute(
      `SELECT e.*, u.name as resolved_by_name
       FROM tr_error_log e
       LEFT JOIN mst_user u ON u.id = e.resolved_by
       WHERE ${where}
       ORDER BY e.occurred_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        errorType: r.error_type,
        errorMessage: r.error_message,
        errorCode: r.error_code,
        stackTrace: r.stack_trace,
        method: r.method,
        endpoint: r.endpoint,
        userId: r.user_id,
        userRole: r.user_role,
        severity: r.severity,
        status: r.status,
        occurredAt: r.occurred_at,
        resolvedBy: r.resolved_by_name,
        resolutionNotes: r.resolution_notes,
        resolvedAt: r.resolved_at,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error('Failed to get error logs', err.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat error logs' });
  }
};

// ─── GET /api/errors/stats — Get error statistics ─────────────────────────────
export const getErrorStats = async (req, res) => {
  try {
    // Today's errors by severity
    const [severityStats] = await poolWaschenPos.execute(`
      SELECT severity, COUNT(*) as count
      FROM tr_error_log
      WHERE DATE(occurred_at) = CURDATE()
      GROUP BY severity
    `);

    // Last 7 days trend
    const [trend] = await poolWaschenPos.execute(`
      SELECT DATE(occurred_at) as date, COUNT(*) as count
      FROM tr_error_log
      WHERE occurred_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(occurred_at)
      ORDER BY date DESC
    `);

    // Top error types
    const [topTypes] = await poolWaschenPos.execute(`
      SELECT error_type, COUNT(*) as count
      FROM tr_error_log
      WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY error_type
      ORDER BY count DESC
      LIMIT 5
    `);

    // Unresolved count
    const [[{ unresolved }]] = await poolWaschenPos.execute(`
      SELECT COUNT(*) as unresolved
      FROM tr_error_log
      WHERE status = 'new'
    `);

    return res.json({
      success: true,
      data: {
        today: {
          total: severityStats.reduce((sum, s) => sum + Number(s.count), 0),
          bySeverity: severityStats.reduce((acc, s) => {
            acc[s.severity] = Number(s.count);
            return acc;
          }, {}),
        },
        trend7Days: trend.map(t => ({
          date: t.date,
          count: Number(t.count),
        })),
        topErrorTypes: topTypes.map(t => ({
          type: t.error_type,
          count: Number(t.count),
        })),
        unresolved,
      },
    });
  } catch (err) {
    logger.error('Failed to get error stats', err.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik' });
  }
};

// ─── PATCH /api/errors/:id/resolve — Mark error as resolved ──────────────────
export const resolveError = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const userId = req.user?.userId;

    await poolWaschenPos.execute(
      `UPDATE tr_error_log SET
        status = 'resolved',
        resolved_by = ?,
        resolution_notes = ?,
        resolved_at = NOW()
       WHERE id = ?`,
      [userId, resolutionNotes || null, id]
    );

    logger.info('Error resolved', { id, userId });

    return res.json({
      success: true,
      message: 'Error marked as resolved',
    });
  } catch (err) {
    logger.error('Failed to resolve error', err.message);
    return res.status(500).json({ success: false, message: 'Gagal update error' });
  }
};

// ─── PATCH /api/errors/:id — Update error status ──────────────────────────────
export const updateErrorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolutionNotes } = req.body;
    const userId = req.user?.userId;

    if (!['new', 'reviewed', 'resolved', 'ignored'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: new, reviewed, resolved, or ignored',
      });
    }

    const updates = ['status = ?'];
    const params = [status];

    if (status === 'resolved') {
      updates.push('resolved_by = ?', 'resolution_notes = ?', 'resolved_at = NOW()');
      params.push(userId, resolutionNotes || null);
    }

    params.push(id);

    await poolWaschenPos.execute(
      `UPDATE tr_error_log SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return res.json({
      success: true,
      message: `Error status updated to ${status}`,
    });
  } catch (err) {
    logger.error('Failed to update error status', err.message);
    return res.status(500).json({ success: false, message: 'Gagal update error' });
  }
};

// ─── Error Logging Middleware for Express ──────────────────────────────────────
export const errorLoggingMiddleware = (err, req, res, next) => {
  const requestData = sanitizeRequest(req);
  const severity = determineSeverity(err);

  // Log to console with structured format
  logger.error('Unhandled error', err.message, {
    stack: err.stack,
    ...requestData,
    userId: req.user?.userId,
  });

  // Store in database (best effort, don't block)
  poolWaschenPos.execute(
    `INSERT INTO tr_error_log (
      error_type, error_message, stack_trace,
      method, endpoint, query_params, request_body,
      user_id, user_role,
      ip_address, user_agent,
      severity, occurred_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      err.constructor?.name || 'Error',
      err.message || 'Unknown error',
      err.stack?.substring(0, 4000) || null,
      requestData.method,
      requestData.endpoint,
      requestData.query_params,
      requestData.request_body,
      req.user?.userId || null,
      req.user?.roleCode || null,
      requestData.ip_address,
      requestData.user_agent,
      severity,
    ]
  ).catch(() => {}); // Best effort

  next(err);
};
