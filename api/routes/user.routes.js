import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getMe, getAllUsers, registerUser, toggleUser } from '../controllers/userController.js';

const router = Router();

router.get('/me',       authenticate, getMe);
router.get('/',         authenticate, requireRole('admin'), getAllUsers);
router.post('/register', authenticate, requireRole('admin'), registerUser);
router.patch('/:id/toggle', authenticate, requireRole('admin'), toggleUser);

export default router;
