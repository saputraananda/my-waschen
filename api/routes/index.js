import { Router } from 'express'

const router = Router()

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'My Waschen API is running' })
})

export default router
