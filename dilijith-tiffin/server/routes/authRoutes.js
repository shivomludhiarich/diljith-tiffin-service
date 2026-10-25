import { requestEmailVerification, verifyEmailCode } from '../controllers/emailVerificationController.js';
import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { resetPassword, forgotPassword } from '../controllers/passwordResetController.js';
import { protect } from '../middleware/auth.js';
import { authThrottle } from '../middleware/authThrottle.js';
import { clearSessionCookie } from '../middleware/sessionCookie.js';

const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.post('/email-verification/request', requestEmailVerification);
router.post('/email-verification/verify', verifyEmailCode);
router.post('/register', authThrottle('register'), register);
router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.post('/login', authThrottle('login'), login);
router.get('/me', protect, getMe);
router.post('/logout', (req, res) => { clearSessionCookie(res); res.json({ ok: true }); });

export default router;
