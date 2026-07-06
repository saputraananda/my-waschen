// ─────────────────────────────────────────────────────────────────────────────
// logger.js — Centralized Logging Utility
// Phase 8: Technical Debt & Optimization
// Replaces console.log with structured, environment-aware logging
// ─────────────────────────────────────────────────────────────────────────────

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

// Current log level (default: info in production, debug in development)
const currentLevel = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info
  : process.env.NODE_ENV === 'production'
    ? LOG_LEVELS.info
    : LOG_LEVELS.debug;

// Whether debug mode is enabled (for verbose output)
const isDebugEnabled = process.env.DEBUG === 'true' || process.env.DEBUG === '1';
const isTestEnv = process.env.NODE_ENV === 'test';

// Format: timestamp, level, context, message
const formatMessage = (level, context, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}]${context ? ` [${context}]` : ''} ${message}${metaStr}`;
};

// Core logging functions
const log = (level, context, message, meta) => {
  if (LOG_LEVELS[level] > currentLevel) return;

  // In production, don't log debug/trace unless DEBUG=true
  if ((level === 'debug' || level === 'trace') && !isDebugEnabled && process.env.NODE_ENV === 'production') return;

  const formatted = formatMessage(level, context, message, meta);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
};

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Error level logging - for actual errors/exceptions
 * @param {string} context - Module or component name
 * @param {string} message - Error message
 * @param {object} meta - Additional metadata
 */
export const error = (context, message, meta = {}) => {
  log('error', context, message, meta);
};

/**
 * Warning level logging - for non-critical issues
 * @param {string} context - Module or component name
 * @param {string} message - Warning message
 * @param {object} meta - Additional metadata
 */
export const warn = (context, message, meta = {}) => {
  log('warn', context, message, meta);
};

/**
 * Info level logging - for important business events
 * @param {string} context - Module or component name
 * @param {string} message - Info message
 * @param {object} meta - Additional metadata
 */
export const info = (context, message, meta = {}) => {
  log('info', context, message, meta);
};

/**
 * Debug level logging - for development/troubleshooting
 * Only shows when DEBUG=true or NODE_ENV!=production
 * @param {string} context - Module or component name
 * @param {string} message - Debug message
 * @param {object} meta - Additional metadata
 */
export const debug = (context, message, meta = {}) => {
  log('debug', context, message, meta);
};

/**
 * Trace level logging - for detailed flow tracing
 * @param {string} context - Module or component name
 * @param {string} message - Trace message
 * @param {object} meta - Additional metadata
 */
export const trace = (context, message, meta = {}) => {
  log('trace', context, message, meta);
};

// ─── Specialized Loggers ──────────────────────────────────────────────────────

/**
 * Create a namespaced logger for a specific module
 * @param {string} namespace - Module/component name
 * @returns {object} Logger with error, warn, info, debug, trace methods
 */
export const createLogger = (namespace) => ({
  error: (message, meta = {}) => error(namespace, message, meta),
  warn: (message, meta = {}) => warn(namespace, message, meta),
  info: (message, meta = {}) => info(namespace, message, meta),
  debug: (message, meta = {}) => debug(namespace, message, meta),
  trace: (message, meta = {}) => trace(namespace, message, meta),
});

/**
 * Log HTTP request/response
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} status - Response status code
 * @param {number} duration - Request duration in ms
 * @param {object} extras - Additional info (userId, ip, etc)
 */
export const logRequest = (method, path, status, duration, extras = {}) => {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  const context = 'HTTP';

  if (level === 'error') {
    error(context, `${method} ${path} ${status} ${duration}ms`, extras);
  } else if (level === 'warn') {
    warn(context, `${method} ${path} ${status} ${duration}ms`, extras);
  } else {
    info(context, `${method} ${path} ${status} ${duration}ms`, extras);
  }
};

/**
 * Log database query (for debugging)
 * @param {string} query - SQL query or operation name
 * @param {number} duration - Query duration in ms
 * @param {object} extras - Additional info
 */
export const logQuery = (query, duration, extras = {}) => {
  // Only log slow queries (> 100ms) in production, all in debug
  if (duration > 100 || isDebugEnabled) {
    debug('DB', `${query} (${duration}ms)`, extras);
  }
};

/**
 * Log business event (for audit trails)
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export const logBusinessEvent = (event, data = {}) => {
  info('BIZ', event, data);
};

// ─── Default logger instance ──────────────────────────────────────────────────
const logger = createLogger('APP');

export default logger;
