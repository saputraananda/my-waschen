import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getMe, getAllUsers } from '../controllers/userController.js';

const router = Router();

router.get('/me',  authenticate,                        getMe);
router.get('/',    authenticate, requireRole('admin'),  getAllUsers);

export default router;
