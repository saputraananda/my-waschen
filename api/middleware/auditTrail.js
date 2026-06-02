import { writeAudit } from '../utils/auditLog.js';

/**
 * Middleware: Auto Audit Trail
 * Otomatis log semua mutasi (POST/PUT/PATCH/DELETE) ke tr_audit_log.
 * Dipasang setelah authenticate middleware.
 * 
 * Cara kerja:
 * - Intercept response via res.json override
 * - Kalau method = POST/PUT/PATCH/DELETE dan response success, tulis audit
 * - Entity type di-infer dari URL path
 * - Tidak blocking — audit ditulis async (fire-and-forget)
 */

// Routes yang di-skip (tidak perlu audit)
const SKIP_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/shifts/status',
  '/api/transactions/dashboard',
  '/api/reports/',
  '/api/audit-log',
  '/api/notifications',
];

// Infer entity type dari URL
function inferEntity(path, method) {
  const clean = path.replace(/^\/api\//, '').split('?')[0];
  const parts = clean.split('/');
  
  // Map common paths to entity types
  const entityMap = {
    'transactions': 'transaction',
    'customers': 'customer',
    'users': 'user',
    'services': 'service',
    'outlets': 'outlet',
    'shifts': 'shift',
    'cash-drawer': 'cash_drawer',
    'targets': 'target',
    'approvals': 'approval',
    'inventory': 'inventory',
    'periods': 'period',
    'promo': 'promo',
  };

  const base = parts[0];
  return entityMap[base] || base;
}

// Infer action dari method + path
function inferAction(method, path) {
  const clean = path.replace(/^\/api\//, '').split('?')[0];
  const parts = clean.split('/');
  
  // Specific action patterns
  if (parts.includes('cancel')) return 'cancel';
  if (parts.includes('toggle')) return 'toggle';
  if (parts.includes('status')) return 'update_status';
  if (parts.includes('production-stage')) return 'update_production_stage';
  if (parts.includes('topup')) return 'topup_deposit';
  if (parts.includes('pin')) return 'toggle_pin';
  if (parts.includes('favorite')) return 'toggle_favorite';
  if (parts.includes('condition')) return 'upload_condition';
  if (parts.includes('packing')) return 'update_packing';
  
  // Generic by method
  switch (method) {
    case 'POST': return 'create';
    case 'PUT': return 'update';
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return method.toLowerCase();
  }
}

// Extract entity ID dari URL params
function extractEntityId(path) {
  const parts = path.replace(/^\/api\//, '').split('?')[0].split('/');
  // Pattern: /api/entity/:id/... → id is parts[1] if numeric
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    return parts[1];
  }
  return null;
}

export function auditTrailMiddleware(pool) {
  return (req, res, next) => {
    // Skip non-mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Skip certain paths
    const shouldSkip = SKIP_PATHS.some(p => req.path.startsWith(p));
    if (shouldSkip) return next();

    // Override res.json to intercept response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      // Only audit successful mutations
      if (body?.success === true && req.user?.userId) {
        const entityType = inferEntity(req.path, req.method);
        const action = inferAction(req.method, req.path);

        // Cari ID numerik. Skip kalau string non-numeric (mis. transaction_no "WSC-...")
        let entityId = extractEntityId(req.path);
        if (!entityId) {
          const candidate = body?.data?.id ?? body?.data?.transactionId ?? null;
          if (candidate != null && /^\d+$/.test(String(candidate))) {
            entityId = String(candidate);
          }
        }

        // Fire-and-forget — don't block response
        setImmediate(() => {
          writeAudit(pool, {
            userId: req.user.userId,
            outletId: req.user.outletId || null,
            transactionId: entityType === 'transaction' ? entityId : null,
            entityType,
            entityId,
            action,
            oldData: null, // Could be enhanced with before-snapshot
            newData: sanitizeBody(req.body),
            req,
          }).catch(() => {}); // Silent fail
        });
      }

      return originalJson(body);
    };

    next();
  };
}

// Sanitize request body — remove sensitive fields
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return null;
  const sanitized = { ...body };
  // Remove sensitive fields
  delete sanitized.password;
  delete sanitized.pin;
  delete sanitized.token;
  delete sanitized.refreshToken;
  // Truncate large fields (photos, etc)
  for (const key of Object.keys(sanitized)) {
    if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
      sanitized[key] = sanitized[key].slice(0, 500) + '...[truncated]';
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}
