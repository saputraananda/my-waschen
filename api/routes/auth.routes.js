import { Router } from 'express';
import { login, logout, getOutlets } from '../controllers/authController.js';

const router = Router();

router.post('/login',   login);
router.post('/logout',  logout);
router.get('/outlets',  getOutlets);

export default router;
