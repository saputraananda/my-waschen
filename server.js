import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

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
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// API Routes
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'My Waschen API is running' }))
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

app.listen(PORT, () => {
  const localIPAddress = getLocalIPAddress()
  const frontendPort = 5173

  console.log(`[server] Running on http://localhost:${PORT}`)
  if (localIPAddress) {
    console.log(`[server] Open on phone: http://${localIPAddress}:${frontendPort}`)
  }
  console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`)
});