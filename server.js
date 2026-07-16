import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import http from 'http'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Environment validation ──────────────────────────────────────────────────
// Crash early jika env penting hilang, daripada error runtime nanti
const REQUIRED_ENV = [
  'JWT_SECRET',
  'HOST_WASCHEN_POS',
  'PORT_WASCHEN_POS',
  'USER_WASCHEN_POS',
  'DB_WASCHEN_POS',
];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error('\n❌ Missing required environment variables:');
  missingEnv.forEach(k => console.error(`   - ${k}`));
  console.error('\nCek file .env atau set environment variables sebelum start server.\n');
  process.exit(1);
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32 && process.env.NODE_ENV === 'production') {
  console.error('\n❌ JWT_SECRET terlalu pendek untuk production (minimum 32 karakter).');
  process.exit(1);
}

// ─── Global Error Handlers ───────────────────────────────────────────────────
// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED_REJECTION]', reason);
  if (process.env.NODE_ENV !== 'production') {
    console.error('Stack:', reason?.stack);
  }
});

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err.message);
  console.error('Stack:', err.stack);
});

import authRoutes from './api/routes/auth.routes.js'
import userRoutes from './api/routes/user.routes.js'
import serviceRoutes from './api/routes/services.routes.js'
import customerRoutes from './api/routes/customers.routes.js'
import transactionRoutes from './api/routes/transactions.routes.js'
import approvalRoutes from './api/routes/approvals.routes.js'
import dashboardRoutes from './api/routes/dashboard.routes.js'
import financeRoutes from './api/routes/finance.routes.js'
import logisticsRoutes from './api/routes/logistics.routes.js'
import notificationRoutes from './api/routes/notifications.routes.js';
import shiftRoutes from './api/routes/shift.routes.js';
import masterRoutes from './api/routes/master.routes.js';
import inventoryRoutes from './api/routes/inventory.routes.js';
import promoRoutes from './api/routes/promo.routes.js';
import outletRoutes from './api/routes/outlet.routes.js';
import cashDrawerRoutes from './api/routes/cashDrawer.routes.js';
import reportRoutes from './api/routes/report.routes.js';
import targetRoutes from './api/routes/targets.routes.js';
import periodRoutes from './api/routes/periods.routes.js';
import auditRoutes from './api/routes/audit.routes.js';

import outletCashRoutes from './api/routes/outletCash.routes.js';
import purchaseRequestRoutes from './api/routes/purchaseRequests.routes.js';
import settingsRoutes from './api/routes/settings.routes.js';
import realtimeRoutes from './api/routes/realtime.routes.js';
import whatsappRoutes from './api/routes/whatsapp.routes.js';
import customerAddressRoutes from './api/routes/customerAddress.routes.js';
import cashDepositRoutes from './api/routes/cashDeposit.routes.js';
import adminDashboardRoutes from './api/routes/adminDashboard.routes.js';
import dashboardIntelligenceRoutes from './api/routes/dashboardIntelligence.routes.js';
import deliveryRoutes from './api/routes/delivery.routes.js';
import membershipRoutes from './api/routes/membership.routes.js';
import membershipHistoryRoutes from './api/routes/membershipHistory.routes.js';
import productionRoutes from './api/routes/production.routes.js';
import refundRoutes from './api/routes/refund.routes.js';
import segmentationRoutes from './api/routes/segmentation.routes.js';
import birthdayRoutes from './api/routes/birthday.routes.js';
import errorRoutes from './api/routes/error.routes.js';
import adjustmentRoutes from './api/routes/adjustment.routes.js';
import outstandingRoutes from './api/routes/outstanding.routes.js';
import mergeRoutes from './api/routes/merge.routes.js';
import dailyReportRoutes from './api/routes/dailyReport.routes.js';
import pengajuanBelanjaRoutes from './api/routes/pengajuanBelanja.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
const PORT = Number(process.env.PORT || 5000)

// Compress all responses except SSE (realtime events)
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/realtime')) {
    // Explicitly disable compression for SSE
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    return next();
  }
  compression()(req, res, next);
});

function getLocalIPAddress() {
  const networkInterfaces = os.networkInterfaces()
  for (const interfaceName of Object.keys(networkInterfaces)) {
    const addresses = networkInterfaces[interfaceName] || []
    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address
      }
    }
  }
  return null
}

// Middleware
app.use(helmet())

// CORS — support multiple origins (HP, iPad, browser desktop)
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // In development, allow any localhost / local network IP
    if (process.env.NODE_ENV !== 'production') {
      if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)) {
        return callback(null, true);
      }
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// API Routes
import { poolWaschenPos } from './api/db/connection.js'

// Audit Trail — auto-log semua mutasi (POST/PUT/PATCH/DELETE)
import { auditTrailMiddleware } from './api/middleware/auditTrail.js'
app.use(auditTrailMiddleware(poolWaschenPos))

app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await poolWaschenPos.healthCheck();
    const memUsage = process.memoryUsage();
    res.json({
      status: dbHealth.ok ? 'OK' : 'DEGRADED',
      message: 'My Waschen API is running',
      database: dbHealth.ok ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      uptime: process.uptime().toFixed(0) + 's',
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      },
    });
  } catch (err) {
    res.status(503).json({
      status: 'DEGRADED',
      message: 'API running but database is unreachable',
      database: 'disconnected',
      error: process.env.NODE_ENV === 'production' ? 'DB unreachable' : err.message,
    });
  }
})
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/approvals', approvalRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/finance', financeRoutes)
app.use('/api/logistics', logisticsRoutes)
app.use('/api/notifications', notificationRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/outlets', outletRoutes);
app.use('/api/cash-drawer', cashDrawerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/targets', targetRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/audit-log', auditRoutes);

app.use('/api/outlet-cash', outletCashRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/customer-addresses', customerAddressRoutes);
app.use('/api/cash-deposits', cashDepositRoutes);
app.use('/api/admin-dashboard', adminDashboardRoutes);
app.use('/api/dashboard-intelligence', dashboardIntelligenceRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/membership-history', membershipHistoryRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/segmentation', segmentationRoutes);
app.use('/api/birthday', birthdayRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/outstandings', outstandingRoutes);
app.use('/api/merges', mergeRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/pengajuan-belanja', pengajuanBelanjaRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`,
  })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist'), {
    maxAge: '1d',
    etag: false,
    lastModified: true
  }))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// Global error handler — centralized, production-safe
app.use((err, req, res, next) => {
  // Log full error server-side (never expose to client)
  const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
  console.error(`[${errorId}]`, {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user?.userId,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      errorId,
      message: 'Data yang dikirim tidak valid.',
    });
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      success: false,
      errorId,
      message: 'Sesi Anda telah berakhir. Silakan login kembali.',
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      errorId,
      message: 'Data sudah ada. Tidak boleh duplikat.',
    });
  }

  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return res.status(503).json({
      success: false,
      errorId,
      message: 'Koneksi database terputus. Coba beberapa saat lagi.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    errorId,
    message: process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server.'
      : err.message || 'Internal Server Error',
  });
})

const server = http.createServer(app);

// ─── Server Error Handler ─────────────────────────────────────────────────────
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please kill the process using that port.`);
  } else {
    console.error('[SERVER_ERROR]', err.message);
  }
});

server.on('clientError', (err, socket) => {
  console.error('[CLIENT_ERROR]', err.message);
  if (socket) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, () => {
  const localIPAddress = getLocalIPAddress()
  const frontendPort = 5173

  console.log(`[server] Running on http://localhost:${PORT}`)
  if (localIPAddress) {
    console.log(`[server] Open on phone: http://${localIPAddress}:${frontendPort}`)
  }
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`)
});
