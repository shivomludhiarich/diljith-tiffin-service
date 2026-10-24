import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { resetPassword } from '../controllers/passwordResetController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/register', register);
router.post('/reset-password', resetPassword);
router.post('/login', login);
router.get('/me', protect, getMe);

export default router;
