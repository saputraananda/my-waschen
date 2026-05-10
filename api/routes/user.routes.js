import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getMe, getAllUsers, registerUser, toggleUser, updateMyProfile, changeMyPassword, updateUser, deleteUser } from '../controllers/userController.js';

const router = Router();

router.get('/me',                  authenticate, getMe);
router.patch('/me/profile',        authenticate, updateMyProfile);
router.patch('/me/password',       authenticate, changeMyPassword);
router.get('/',                    authenticate, requireRole('admin'), getAllUsers);
router.post('/register',           authenticate, requireRole('admin'), registerUser);
router.put('/:id',                 authenticate, requireRole('admin'), updateUser);
router.patch('/:id/toggle',        authenticate, requireRole('admin'), toggleUser);
router.delete('/:id',              authenticate, requireRole('admin'), deleteUser);

export default router;
