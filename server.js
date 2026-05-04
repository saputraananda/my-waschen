import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

// Import Routes Baru (Pastikan ditaruh di folder /api/routes/)
import authRoutes from './api/routes/auth.js'
import userRoutes from './api/routes/users.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)

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