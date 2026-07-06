import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getWhatsappTemplates,
  getWhatsappTemplateById,
  createWhatsappTemplate,
  updateWhatsappTemplate,
  deleteWhatsappTemplate,
  sendTransactionWhatsapp,
  getTemplateLog,
} from '../controllers/whatsappController.js';
import { readLimiter, writeLimiter } from '../middleware/rateLimit.js';

const router = Router();

// GET /api/whatsapp/templates
router.get('/templates', authenticate, readLimiter, getWhatsappTemplates);

// POST /api/whatsapp/templates
router.post('/templates', authenticate, writeLimiter, createWhatsappTemplate);

// GET /api/whatsapp/templates/:id/log — MUST be before /:id (otherwise "log" captured as :id)
router.get('/templates/:id/log', authenticate, readLimiter, getTemplateLog);

// GET /api/whatsapp/templates/:id
router.get('/templates/:id', authenticate, readLimiter, getWhatsappTemplateById);

// PUT /api/whatsapp/templates/:id
router.put('/templates/:id', authenticate, writeLimiter, updateWhatsappTemplate);

// DELETE /api/whatsapp/templates/:id
router.delete('/templates/:id', authenticate, writeLimiter, deleteWhatsappTemplate);

export default router;
