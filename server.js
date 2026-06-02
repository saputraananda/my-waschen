import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
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
  'PASS_WASCHEN_POS',
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
import paymentRoutes from './api/routes/payment.routes.js';
import webhookRoutes from './api/routes/webhook.routes.js';
import outletCashRoutes from './api/routes/outletCash.routes.js';
import purchaseRequestRoutes from './api/routes/purchaseRequests.routes.js';
import settingsRoutes from './api/routes/settings.routes.js';
import realtimeRoutes from './api/routes/realtime.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
const PORT = process.env.APP_PORT || 5000

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
    // Cek DB connection juga
    await poolWaschenPos.query('SELECT 1');
    res.json({
      status: 'OK',
      message: 'My Waschen API is running',
      database: 'connected',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
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
app.use('/api/payments', paymentRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/outlet-cash', outletCashRoutes);
app.use('/api/purchase-requests', purchaseRequestRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/realtime', realtimeRoutes);

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`,
  })
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err.stack || err)
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server.'
      : err.message || 'Internal Server Error',
  })
})

const server = http.createServer(app);
server.listen(PORT, () => {
  const localIPAddress = getLocalIPAddress()
  const frontendPort = 5173

  console.log(`[server] Running on http://localhost:${PORT}`)
  if (localIPAddress) {
    console.log(`[server] Open on phone: http://${localIPAddress}:${frontendPort}`)
  }
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`)
});