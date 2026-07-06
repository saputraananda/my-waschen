import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { authLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validateUserCreate, validateUserUpdate } from '../schemas/validationSchemas.js';
import { getMe, getAllUsers, registerUser, toggleUser, updateMyProfile, changeMyPassword, updateUser, deleteUser } from '../controllers/userController.js';

const router = Router();

router.get('/me',                  authenticate, getMe);
router.patch('/me/profile',        authenticate, writeLimiter, updateMyProfile);
router.patch('/me/password',       authenticate, authLimiter,  changeMyPassword);
router.get('/',                    authenticate, requireRole('admin'), getAllUsers);
router.post('/register', authenticate, requireRole('admin'), writeLimiter, validateUserCreate, registerUser);
router.put('/:id',                 authenticate, requireRole('admin'), writeLimiter, validateUserUpdate, updateUser);
router.patch('/:id/toggle',        authenticate, requireRole('admin'), writeLimiter, toggleUser);
router.delete('/:id',              authenticate, requireRole('admin'), writeLimiter, deleteUser);

export default router;
