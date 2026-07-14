// ─────────────────────────────────────────────────────────────────────────────
// errorHandler.js — Global Error Handling Middleware
// Phase 8: Technical Debt & Optimization
// Centralized error handling with proper logging
// ─────────────────────────────────────────────────────────────────────────────

const logger = require('../utils/logger');

// ─── Error Types ──────────────────────────────────────────────────────────────

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programming bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

// Pre-defined error classes
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

// ─── Error Handler Middleware ─────────────────────────────────────────────────

/**
 * Global error handler middleware
 * Should be the LAST middleware in the chain
 */
const errorHandler = (err, req, res, next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Log the error
  const logContext = 'ErrorHandler';
  const logMeta = {
    path: req?.path,
    method: req?.method,
    userId: req?.user?.id,
    ip: req?.ip,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  };

  // Handle different error types
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
    logger.warn(logContext, 'JWT Error', logMeta);
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
    logger.warn(logContext, 'JWT Expired', logMeta);
  } else if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'A record with this value already exists';
    logger.warn(logContext, 'Duplicate Entry', logMeta);
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    statusCode = 400;
    code = 'INVALID_REFERENCE';
    message = 'Referenced record does not exist';
    logger.warn(logContext, 'Invalid Foreign Key', logMeta);
  } else if (err.isOperational) {
    // Known operational errors - log as warning
    logger.warn(logContext, message, logMeta);
  } else {
    // Unknown errors (programming bugs) - log as error with stack
    statusCode = 500;
    code = 'INTERNAL_ERROR';
    message = process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message;
    logger.error(logContext, 'Unhandled Error', { ...logMeta, stack: err.stack });
  }

  // Build response
  const response = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV !== 'production' && !err.isOperational && { stack: err.stack }),
    },
  };

  // Send response
  res.status(statusCode).json(response);
};

// ─── Async Handler Wrapper ─────────────────────────────────────────────────────

/**
 * Wraps async route handlers to catch errors automatically
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ─── Not Found Handler ─────────────────────────────────────────────────────────

/**
 * Handles 404 for undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};

// ─── Validation Middleware Factory ────────────────────────────────────────────

/**
 * Creates a validation middleware using a Zod schema
 * Usage: const validate = requireValidation(schema); router.post('/path', validate, handler);
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        return next(new ValidationError('Validation failed', errors));
      }

      // Replace with validated/parsed data
      if (source === 'body') req.body = result.data;
      else if (source === 'query') req.query = result.data;
      else req.params = result.data;

      next();
    } catch (err) {
      next(new ValidationError('Validation error', err.message));
    }
  };
};

// ─── Request Logger Middleware ─────────────────────────────────────────────────

/**
 * Logs all HTTP requests with duration
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req.method, req.path, res.statusCode, duration, {
      userId: req?.user?.id,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  });

  next();
};

// ─── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,

  // Middleware
  errorHandler,
  asyncHandler,
  notFoundHandler,
  validate,
  requestLogger,
};
